"""Official Google Gemini REST adapter. Secrets are headers, never URLs or logs."""

import json
import random
import time
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from urllib.parse import quote
import httpx


class ProviderError(RuntimeError):
    def __init__(self, status_code=503, retry_after=None):
        super().__init__("Generation provider unavailable")
        self.status_code = status_code
        self.retry_after = retry_after


def retry_seconds(value):
    if not value:
        return None
    try:
        seconds = float(value)
    except ValueError:
        try:
            seconds = (parsedate_to_datetime(value) - datetime.now(timezone.utc)).total_seconds()
        except (ValueError, TypeError, OverflowError):
            return None
    if not 0 <= seconds <= 86400:
        return None
    return seconds


SCHEMA = {
    "type": "object",
    "properties": {
        "answer": {
            "type": "string",
            "description": "User-visible answer. Every factual sentence MUST include inline source markers such as [1] or [2]. These markers must match the citations array. An answer without inline markers is rejected.",
        },
        "citations": {
            "type": "array",
            "items": {"type": "integer"},
            "description": "Unique 1-based evidence numbers actually referenced by [n] markers inside the answer text.",
        },
        "insufficient_evidence": {"type": "boolean"},
    },
    "required": ["answer", "citations", "insufficient_evidence"],
    "additionalProperties": False,
}


def generate(messages, settings, metadata=None):
    model = settings.llm_model.removeprefix("models/")
    if not settings.gemini_api_key or not model:
        raise ProviderError()
    contents = [
        {"role": "model" if m["role"] == "assistant" else "user", "parts": [{"text": m["content"]}]}
        for m in messages
        if m["role"] != "system"
    ]
    payload = {
        "systemInstruction": {"parts": [{"text": messages[0]["content"]}]},
        "contents": contents,
        "generationConfig": {
            "responseFormat": {"text": {"mimeType": "APPLICATION_JSON", "schema": SCHEMA}},
            "maxOutputTokens": 1000,
            "temperature": 0,
        },
    }
    started = time.monotonic()
    with httpx.Client(follow_redirects=False) as client:
        for attempt in range(settings.provider_max_attempts):
            remaining = settings.provider_timeout_seconds - (time.monotonic() - started)
            if remaining <= 0:
                raise ProviderError(504)
            try:
                response = client.post(
                    "https://generativelanguage.googleapis.com/v1beta/models/" + quote(model, safe="") + ":generateContent",
                    headers={"x-goog-api-key": settings.gemini_api_key},
                    json=payload,
                    timeout=httpx.Timeout(remaining, connect=min(5, remaining)),
                )
            except httpx.TimeoutException:
                raise ProviderError(504) from None
            except httpx.RequestError:
                # A transport failure may occur after consumption; do not blindly retry it.
                raise ProviderError() from None
            if response.status_code in {429, 502, 503, 504}:
                wait = retry_seconds(response.headers.get("Retry-After"))
                delay = wait if wait is not None else 0.25 * 2**attempt + random.uniform(0, 0.15)
                status = 429 if response.status_code == 429 else 503
                remaining = settings.provider_timeout_seconds - (time.monotonic() - started)
                if attempt + 1 >= settings.provider_max_attempts or delay >= remaining or delay > 2:
                    raise ProviderError(status, int(wait + 1) if wait is not None else None)
                time.sleep(delay)
                continue
            if response.status_code != 200:
                raise ProviderError()
            try:
                result = response.json()
                candidate = result.get("candidates", [{}])[0]
                if candidate.get("finishReason") != "STOP" or result.get("promptFeedback", {}).get("blockReason"):
                    raise ProviderError()
                parts = candidate.get("content", {}).get("parts", [])
                raw = "".join(p.get("text", "") for p in parts if not p.get("thought"))
                if not raw or len(raw) > 40000:
                    raise ProviderError()
                json.loads(raw)
                if metadata is not None:
                    usage = result.get("usageMetadata", {})
                    metadata["usage"] = {
                        k: v
                        for k, v in usage.items()
                        if k in {"promptTokenCount", "candidatesTokenCount", "totalTokenCount", "thoughtsTokenCount"}
                        and type(v) is int
                        and v >= 0
                    }
                    metadata["generation_ms"] = round((time.monotonic() - started) * 1000)
                    metadata["attempts"] = attempt + 1
                return raw
            except (ValueError, KeyError, IndexError, TypeError, AttributeError):
                raise ProviderError() from None
    raise ProviderError()
