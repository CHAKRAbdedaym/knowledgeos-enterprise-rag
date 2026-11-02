"""Explicit, bounded live verification using real local retrieval; never prints secrets."""

import argparse
import json
from urllib.parse import quote

import httpx
from sqlalchemy.orm import Session

from app.config import Settings, get_settings
from app.database import engine
from app.gemini import ProviderError
from app.generation import answer
from app.models import Chunk, Document
from app.retrieval import VectorService


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--model", default="gemini-3.5-flash-lite")
    parser.add_argument("--question", default="What is the remote work policy?")
    args = parser.parse_args()
    base = get_settings()
    if not base.gemini_api_key:
        raise SystemExit("GEMINI_API_KEY is not configured on the backend; no request sent.")
    settings = Settings.model_validate(base.model_dump() | {"llm_provider": "gemini", "llm_model": args.model})
    report = {"model": args.model, "quota_remaining": "Not exposed by this API; check Google AI Studio", "billing_tier": "Not verified"}
    try:
        with httpx.Client(timeout=20, follow_redirects=False) as client:
            response = client.get(
                "https://generativelanguage.googleapis.com/v1beta/models/" + quote(args.model, safe=""),
                headers={"x-goog-api-key": settings.gemini_api_key},
            )
        report["model_metadata_http_status"] = response.status_code
        if response.status_code != 200:
            print(json.dumps(report))
            raise SystemExit("Model access failed; provider/model configuration was not changed.")
        data = response.json()
        if "generateContent" not in data.get("supportedGenerationMethods", []):
            raise SystemExit("Selected model does not announce generateContent support.")
        sources = VectorService(settings).search(args.question, 4, settings.default_score_threshold)
        verified = []
        with Session(engine()) as db:
            for item in sources:
                chunk = db.get(Chunk, item["chunk_id"])
                doc = db.get(Document, chunk.document_id) if chunk else None
                if doc is not None and doc.status == "indexed" and item["document_id"] == doc.id:
                    verified.append(item | {"text": chunk.text, "title": doc.title, "page": chunk.page})
        if not verified:
            raise SystemExit("No real evidence retrieved; no generation request sent.")
        metadata = {}
        content, mode = answer(args.question, verified, [], settings, metadata)
        report.update({"mode": mode, "answer": content, "source_titles": [s["title"] for s in verified], **metadata})
        print(json.dumps(report, ensure_ascii=False))
        if mode != "grounded":
            raise SystemExit("Generation did not pass grounded citation validation.")
    except ProviderError as exc:
        report.update({"mode": "provider_error", "safe_http_status": exc.status_code, "retry_after": exc.retry_after})
        print(json.dumps(report))
        raise SystemExit("Live generation failed; inspect safe status and account quota, never print raw provider payloads.") from None
    except httpx.HTTPError:
        raise SystemExit("Google model metadata request failed (network/timeout); no secret or provider payload emitted.") from None


if __name__ == "__main__":
    main()
