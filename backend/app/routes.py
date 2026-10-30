from fastapi import APIRouter
import hashlib
import json
import logging
from collections import Counter
from datetime import datetime, timedelta, timezone
from pathlib import Path
from threading import Lock
from time import perf_counter
from typing import Annotated, Literal

from fastapi import Depends, File, Form, HTTPException, Query, UploadFile
from fastapi.responses import JSONResponse
from sqlalchemy import delete, func, select, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.schemas import (
    ConversationInput,
    QuestionInput,
    DocumentResponse,
    DocumentDetailResponse,
    MessageResponse,
    ConversationResponse,
    ConversationDetailResponse,
    RetrievalResponse,
    DeleteResponse,
    DashboardResponse,
    AnalyticsResponse,
)
from app.config import Settings, get_settings
from app.database import get_db
from app.ingestion import InvalidDocument, extract
from app.indexing import check_embedding_revision, index_document
from app.models import Chunk, Conversation, Document, Message, QueryLog, uid
from app.retrieval import get_vectors, retrieve
from app.generation import answer

logger = logging.getLogger("knowledgeos")
app = APIRouter()
Db = Annotated[Session, Depends(get_db)]
Config = Annotated[Settings, Depends(get_settings)]
Vectors = Annotated[object, Depends(get_vectors)]
mutation_lock = Lock()


def iso(value):
    return value.replace(tzinfo=timezone.utc).isoformat() if value.tzinfo is None else value.isoformat()


def document_json(document, detail=False):
    result = {
        key: getattr(document, key)
        for key in [
            "id",
            "title",
            "filename",
            "category",
            "tags",
            "status",
            "chunk_count",
            "size_bytes",
            "error",
            "embedding_revision",
            "page_count",
        ]
    }
    result["created_at"] = iso(document.created_at)
    result["updated_at"] = iso(document.updated_at)
    if detail:
        result["text"] = document.text
    return result


def message_json(message):
    return {
        **{key: getattr(message, key) for key in ["id", "role", "content", "mode", "sources", "trace"]},
        "created_at": iso(message.created_at),
    }


def conversation_json(conversation):
    return {"id": conversation.id, "title": conversation.title, "created_at": iso(conversation.created_at)}


def required(db, model, id):
    obj = db.get(model, id)
    if obj is None:
        raise HTTPException(404, "Resource not found")
    return obj


@app.get("/api/health")
def health():
    return {"status": "ok", "service": "knowledgeos-api"}


@app.get("/api/readiness")
def readiness(db: Db, vectors: Vectors):
    checks = {"database": False, "qdrant": False}
    try:
        db.execute(text("SELECT 1"))
        # A live database without migrations is not ready.
        db.execute(select(Document.id).limit(1))
        checks["database"] = True
    except Exception:
        db.rollback()
    try:
        vectors.ready()
        checks["qdrant"] = True
    except Exception:
        pass
    return JSONResponse(
        status_code=200 if all(checks.values()) else 503,
        content={"status": "ready" if all(checks.values()) else "not_ready", "checks": checks},
    )


@app.get("/api/config")
def config(settings: Config, vectors: Vectors):
    return {
        "llm_provider": settings.llm_provider,
        "llm_model": settings.llm_model or None,
        "embedding_model": settings.embedding_model,
        "embedding_dimension": settings.embedding_dimension,
        "embedding_revision": vectors.revision,
        "collection": settings.qdrant_collection,
        "max_upload_mb": settings.max_upload_mb,
        "chunk_size": settings.chunk_size,
        "chunk_overlap": settings.chunk_overlap,
        "default_top_k": settings.default_top_k,
        "default_score_threshold": settings.default_score_threshold,
        "supported_file_types": ["pdf", "txt", "md"],
    }


@app.get("/api/documents", response_model=list[DocumentResponse])
def list_documents(db: Db):
    return [document_json(d) for d in db.scalars(select(Document).order_by(Document.created_at.desc())).all()]


@app.post("/api/documents", status_code=201, response_model=DocumentResponse)
def upload_document(
    db: Db,
    vectors: Vectors,
    settings: Config,
    file: Annotated[UploadFile, File()],
    category: Annotated[str, Form(max_length=80)] = "General",
    tags: Annotated[str, Form(max_length=1000)] = "",
):
    suffix = Path(file.filename or "").suffix.lower()
    accepted_mimes = {
        ".pdf": {"application/pdf", "application/octet-stream"},
        ".txt": {"text/plain", "application/octet-stream"},
        ".md": {"text/markdown", "text/plain", "application/octet-stream"},
    }
    if suffix in accepted_mimes and file.content_type and file.content_type.split(";")[0] not in accepted_mimes[suffix]:
        raise HTTPException(422, "Content type does not match the file extension")
    data = file.file.read(settings.max_upload_mb * 1024 * 1024 + 1)
    if len(data) > settings.max_upload_mb * 1024 * 1024:
        raise HTTPException(413, f"File exceeds {settings.max_upload_mb} MB upload limit")
    filename = Path((file.filename or "upload.txt").replace("\\", "/")).name[:255]
    if not filename:
        raise HTTPException(422, "A filename is required")
    try:
        content, pages = extract(filename, data, settings.max_document_chars)
        parsed_tags = json.loads(tags) if tags.lstrip().startswith("[") else [tag.strip() for tag in tags.split(",") if tag.strip()]
        if not isinstance(parsed_tags, list) or len(parsed_tags) > 20 or any(not isinstance(t, str) or len(t) > 50 for t in parsed_tags):
            raise InvalidDocument("Use up to 20 tags of at most 50 characters")
    except (InvalidDocument, json.JSONDecodeError) as exc:
        raise HTTPException(422, str(exc)) from exc
    title = Path(filename).stem
    if suffix == ".md":
        for line in content.splitlines():
            if line.startswith("# ") and line[2:].strip():
                title = line[2:].strip()[:255]
                break
    digest = hashlib.sha256(data).hexdigest()
    with mutation_lock:
        existing = db.scalar(select(Document).where(Document.sha256 == digest))
        if existing:
            raise HTTPException(409, f"Duplicate file: already uploaded as {existing.id}")
        document = Document(
            id=uid(),
            title=title,
            filename=filename,
            category=category.strip() or "General",
            tags=parsed_tags,
            sha256=digest,
            size_bytes=len(data),
            text=content,
            pages=pages,
            page_count=len(pages),
        )
        db.add(document)
        try:
            db.commit()
        except IntegrityError as exc:
            db.rollback()
            raise HTTPException(409, "Duplicate file") from exc
        settings.upload_dir.mkdir(parents=True, exist_ok=True)
        try:
            (settings.upload_dir / document.id).write_bytes(data)
        except OSError as exc:
            db.delete(document)
            db.commit()
            raise HTTPException(503, "Upload storage is unavailable") from exc
        document = index_document(db, document, vectors, settings)
    return document_json(document)


@app.get("/api/documents/{document_id}", response_model=DocumentDetailResponse)
def get_document(document_id: str, db: Db):
    result = document_json(required(db, Document, document_id), detail=True)
    result["chunks"] = [
        {"id": c.id, "text": c.text, "page": c.page, "start_offset": c.start_offset, "end_offset": c.end_offset}
        for c in db.scalars(select(Chunk).where(Chunk.document_id == document_id).order_by(Chunk.start_offset)).all()
    ]
    return result


@app.delete("/api/documents/{document_id}", response_model=DeleteResponse)
def delete_document(document_id: str, db: Db, vectors: Vectors, settings: Config):
    with mutation_lock:
        document = required(db, Document, document_id)
        vectors.delete(document.id)
        db.execute(delete(Chunk).where(Chunk.document_id == document.id))
        db.delete(document)
        db.commit()
        (settings.upload_dir / document.id).unlink(missing_ok=True)
    return {"deleted": True, "id": document_id}


@app.post("/api/documents/{document_id}/reindex", response_model=DocumentResponse)
def reindex(document_id: str, db: Db, vectors: Vectors, settings: Config):
    with mutation_lock:
        document = index_document(db, required(db, Document, document_id), vectors, settings)
    return document_json(document)


@app.get("/api/conversations", response_model=list[ConversationResponse])
def list_conversations(db: Db):
    return [conversation_json(c) for c in db.scalars(select(Conversation).order_by(Conversation.created_at.desc())).all()]


@app.post("/api/conversations", status_code=201, response_model=ConversationResponse)
def create_conversation(body: ConversationInput, db: Db):
    conversation = Conversation(title=body.title)
    db.add(conversation)
    db.commit()
    return conversation_json(conversation)


@app.get("/api/conversations/{conversation_id}", response_model=ConversationDetailResponse)
def get_conversation(conversation_id: str, db: Db):
    result = conversation_json(required(db, Conversation, conversation_id))
    result["messages"] = [
        message_json(m)
        for m in db.scalars(
            select(Message).where(Message.conversation_id == conversation_id).order_by(Message.created_at, Message.id)
        ).all()
    ]
    return result


@app.patch("/api/conversations/{conversation_id}", response_model=ConversationResponse)
def rename_conversation(conversation_id: str, body: ConversationInput, db: Db):
    conversation = required(db, Conversation, conversation_id)
    conversation.title = body.title
    db.commit()
    return conversation_json(conversation)


@app.delete("/api/conversations/{conversation_id}", response_model=DeleteResponse)
def delete_conversation(conversation_id: str, db: Db):
    conversation = required(db, Conversation, conversation_id)
    db.execute(delete(Message).where(Message.conversation_id == conversation_id))
    db.delete(conversation)
    db.commit()
    return {"deleted": True, "id": conversation_id}


def search(body, db, vectors, settings):
    if db.scalar(select(Document.id).where(Document.status == "indexed").limit(1)):
        check_embedding_revision(db, vectors)
    sources, trace = retrieve(
        body.question,
        body.top_k if body.top_k is not None else settings.default_top_k,
        body.score_threshold if body.score_threshold is not None else settings.default_score_threshold,
        vectors,
        settings,
    )
    # SQL is authoritative; ignore incomplete indexing and stale vectors after failures.
    valid = set(db.scalars(select(Document.id).where(Document.status == "indexed")).all())
    sources = [s for s in sources if s["document_id"] in valid]
    trace["matched_chunks"] = len(sources)
    return sources, trace


def log_query(db, body, sources, trace, mode, conversation_id=None):
    db.add(
        QueryLog(
            conversation_id=conversation_id,
            question=body.question,
            mode=mode,
            latency_ms=trace["latency_ms"],
            matched_chunks=len(sources),
            document_ids=list(dict.fromkeys(s["document_id"] for s in sources)),
        )
    )


@app.post("/api/retrieval", response_model=RetrievalResponse)
def retrieval(body: QuestionInput, db: Db, vectors: Vectors, settings: Config):
    sources, trace = search(body, db, vectors, settings)
    log_query(db, body, sources, trace, "retrieval_only")
    db.commit()
    return {"question": body.question, "sources": sources, "trace": trace}


@app.post("/api/conversations/{conversation_id}/messages", status_code=201, response_model=MessageResponse)
def send_message(conversation_id: str, body: QuestionInput, db: Db, vectors: Vectors, settings: Config):
    required(db, Conversation, conversation_id)
    start = perf_counter()
    sources, trace = search(body, db, vectors, settings)
    history = list(
        reversed(
            db.scalars(select(Message).where(Message.conversation_id == conversation_id).order_by(Message.created_at.desc()).limit(6)).all()
        )
    )
    try:
        content, mode = answer(body.question, sources, history, settings)
    except Exception as exc:
        logger.error("answer_provider_failed", extra={"error_type": type(exc).__name__})
        trace["latency_ms"] = round((perf_counter() - start) * 1000)
        log_query(db, body, sources, trace, "provider_error", conversation_id)
        db.commit()
        raise HTTPException(
            503, "Answer provider unavailable or returned an invalid response. Try again or use retrieval diagnostics."
        ) from exc
    trace["latency_ms"] = round((perf_counter() - start) * 1000)
    user = Message(conversation_id=conversation_id, role="user", content=body.question, sources=[])
    db.add(user)
    db.flush()
    assistant = Message(conversation_id=conversation_id, role="assistant", content=content, mode=mode, sources=sources, trace=trace)
    db.add(assistant)
    log_query(db, body, sources, trace, mode, conversation_id)
    db.commit()
    return message_json(assistant)


def query_trend(logs, days):
    counts = Counter(iso(q.created_at)[:10] for q in logs)
    today = datetime.now(timezone.utc).date()
    return [
        {"date": (today - timedelta(days=i)).isoformat(), "count": counts[(today - timedelta(days=i)).isoformat()]}
        for i in reversed(range(days))
    ]


def categories(documents):
    return [{"name": name, "count": count} for name, count in sorted(Counter(d.category for d in documents).items())]


@app.get("/api/dashboard", response_model=DashboardResponse)
def dashboard(db: Db):
    documents = db.scalars(select(Document).order_by(Document.created_at.desc())).all()
    logs = db.scalars(select(QueryLog).order_by(QueryLog.created_at.desc())).all()
    activity = [
        {"id": q.id, "type": "query", "title": q.question, "description": q.mode.replace("_", " "), "created_at": iso(q.created_at)}
        for q in logs[:8]
    ]
    activity += [
        {
            "id": d.id,
            "type": "document",
            "title": d.title,
            "description": f"{d.status} · {d.chunk_count} chunks",
            "created_at": iso(d.created_at),
        }
        for d in documents[:8]
    ]
    return {
        "documents": sum(d.status == "indexed" for d in documents),
        "chunks": db.scalar(select(func.count()).select_from(Chunk)),
        "conversations": db.scalar(select(func.count()).select_from(Conversation)),
        "queries": len(logs),
        "categories": categories(documents),
        "query_trend": query_trend(logs, 7),
        "recent_documents": [document_json(d) for d in documents[:5]],
        "recent_activity": sorted(activity, key=lambda a: a["created_at"], reverse=True)[:8],
    }


@app.get("/api/analytics", response_model=AnalyticsResponse)
def analytics(db: Db, days: Annotated[Literal["7", "30", "90"], Query()] = "7"):
    days = int(days)
    cutoff = datetime.now(timezone.utc) - timedelta(days=days - 1)
    cutoff = cutoff.replace(hour=0, minute=0, second=0, microsecond=0)
    logs = db.scalars(select(QueryLog).where(QueryLog.created_at >= cutoff)).all()
    documents = db.scalars(select(Document)).all()
    counts = Counter(document_id for q in logs for document_id in q.document_ids)
    titles = {d.id: d.title for d in documents}
    return {
        "queries": len(logs),
        "average_latency_ms": round(sum(q.latency_ms for q in logs) / len(logs), 1) if logs else 0,
        "average_chunks": round(sum(q.matched_chunks for q in logs) / len(logs), 1) if logs else 0,
        "query_trend": query_trend(logs, days),
        "most_referenced": [{"id": key, "title": titles[key], "count": count} for key, count in counts.most_common(10) if key in titles],
        "categories": categories(documents),
    }
