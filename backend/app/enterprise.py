"""Single-enterprise integration boundary. Browser credentials never grant admin access."""

import secrets
from collections import Counter
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from time import perf_counter
from typing import Annotated, Literal
from urllib.parse import urlsplit
from uuid import uuid4

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, ConfigDict, Field, field_validator
from sqlalchemy import delete, select
from sqlalchemy.exc import IntegrityError

from app.auth import Config, Db, digest, require_admin
from app.config import Settings
from app.runtime import runtime_settings
from app.models import RuntimeSettings
from app.models import (
    Chunk,
    Conversation,
    Document,
    Employee,
    Integration,
    IntegrationDocument,
    IntegrationKey,
    LoginBucket,
    Message,
    QueryLog,
    SecurityAudit,
    WidgetSession,
)
from app.retrieval import get_vectors
from app.generation import answer
from app.gemini import ProviderError
from app.indexing import check_embedding_revision
from app.schemas import QuestionInput, ConversationInput, Source
from app.routes import conversation_json, iso, message_json

admin = APIRouter(prefix="/api/admin", dependencies=[Depends(require_admin)], tags=["Integration administration"])
access = APIRouter(prefix="/api/documents", dependencies=[Depends(require_admin)], tags=["Document publication"])
api = APIRouter(prefix="/api/v1", tags=["Employee integration API"])


def utcnow():
    return datetime.now(timezone.utc)


def expired(value):
    return value.replace(tzinfo=timezone.utc) <= utcnow()


def not_found():
    raise HTTPException(404, "Resource unavailable")


class StrictInput(BaseModel):
    model_config = ConfigDict(extra="forbid")


def valid_origin(value):
    parsed = urlsplit(value)
    if (
        parsed.scheme not in {"https", "http"}
        or not parsed.hostname
        or parsed.username
        or parsed.password
        or parsed.query
        or parsed.fragment
        or parsed.path
    ):
        raise ValueError("Use an exact origin, without path, credentials or trailing slash")
    if parsed.scheme == "http" and parsed.hostname not in {"localhost", "127.0.0.1", "::1"}:
        raise ValueError("Non-loopback origins require HTTPS")
    return value


class IntegrationInput(StrictInput):
    name: str = Field(min_length=1, max_length=120)
    allowed_origins: list[str] = Field(default_factory=list, max_length=10)
    document_ids: list[str] = Field(default_factory=list, max_length=500)
    rate_limit_per_minute: int = Field(default=60, ge=1, le=600)

    @field_validator("name")
    @classmethod
    def name_valid(cls, value):
        if value is None:
            return None
        if not value.strip():
            raise ValueError("Name cannot be blank")
        return value.strip()

    @field_validator("allowed_origins")
    @classmethod
    def origins(cls, values):
        return None if values is None else list(dict.fromkeys(valid_origin(v) for v in values))


class IntegrationPatch(IntegrationInput):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    enabled: bool | None = None
    allowed_origins: list[str] | None = Field(default=None, max_length=10)
    document_ids: list[str] | None = Field(default=None, max_length=500)
    rate_limit_per_minute: int | None = Field(default=None, ge=1, le=600)


Scope = Literal["query", "conversations", "sources", "widget_sessions"]


class KeyInput(StrictInput):
    scopes: list[Scope] | None = Field(default=None, max_length=4)
    expires_in_days: int = Field(default=30, ge=1, le=365)


class AccessInput(StrictInput):
    employee_available: bool


class SessionInput(StrictInput):
    subject: str = Field(min_length=1, max_length=160, pattern=r"^\S(?:.*\S)?$")
    origin: str = Field(max_length=300)

    @field_validator("origin")
    @classmethod
    def origin_valid(cls, value):
        return valid_origin(value)


class QueryInput(QuestionInput):
    model_config = ConfigDict(extra="forbid")


class AnswerResponse(BaseModel):
    generation_ms: int | None = None
    usage: dict[str, int] | None = None
    conversation_id: str | None
    answer: str
    mode: str
    sources: list[Source]
    request_id: str
    latency_ms: int


class SessionResponse(BaseModel):
    access_token: str
    expires_at: str
    expires_in: int


def audit(db, request, action, integration_id=None):
    db.add(SecurityAudit(admin_id=getattr(request.state, "admin_id", None), integration_id=integration_id, action=action))


def integration(db, id):
    obj = db.get(Integration, id)
    if obj is None:
        not_found()
    return obj


def key_json(key):
    return {
        field: iso(getattr(key, field)) if getattr(key, field) is not None else None
        for field in ["expires_at", "revoked_at", "last_used_at", "created_at"]
    } | {"id": key.id, "prefix": key.prefix, "scopes": key.scopes}


def integration_json(db, obj):
    return {
        "id": obj.id,
        "name": obj.name,
        "enabled": obj.enabled,
        "allowed_origins": obj.allowed_origins,
        "rate_limit_per_minute": obj.rate_limit_per_minute,
        "created_at": iso(obj.created_at),
        "document_ids": list(db.scalars(select(IntegrationDocument.document_id).where(IntegrationDocument.integration_id == obj.id))),
        "keys": [
            key_json(k)
            for k in db.scalars(
                select(IntegrationKey).where(IntegrationKey.integration_id == obj.id).order_by(IntegrationKey.created_at.desc())
            )
        ],
    }


def set_documents(db, id, document_ids):
    ids = set(document_ids)
    existing = set(db.scalars(select(Document.id).where(Document.id.in_(ids)))) if ids else set()
    if existing != ids:
        raise HTTPException(422, "A selected document is unavailable")
    db.execute(delete(IntegrationDocument).where(IntegrationDocument.integration_id == id))
    db.add_all(IntegrationDocument(integration_id=id, document_id=doc) for doc in ids)


@admin.get("/integrations")
def list_integrations(db: Db):
    return [integration_json(db, i) for i in db.scalars(select(Integration).order_by(Integration.created_at.desc()))]


@admin.post("/integrations", status_code=201)
def create_integration(body: IntegrationInput, request: Request, db: Db):
    obj = Integration(name=body.name, allowed_origins=body.allowed_origins, rate_limit_per_minute=body.rate_limit_per_minute)
    db.add(obj)
    db.flush()
    set_documents(db, obj.id, body.document_ids)
    audit(db, request, "integration.created", obj.id)
    db.commit()
    return integration_json(db, obj)


@admin.patch("/integrations/{id}")
def patch_integration(id: str, body: IntegrationPatch, request: Request, db: Db):
    obj = integration(db, id)
    changes = body.model_dump(exclude_unset=True)
    if any(value is None for value in changes.values()):
        raise HTTPException(422, "Explicit null settings are not allowed")
    if "document_ids" in changes:
        set_documents(db, id, changes.pop("document_ids"))
    for field, value in changes.items():
        setattr(obj, field, value)
    audit(db, request, "integration.updated", id)
    db.commit()
    return integration_json(db, obj)


def issue_key(db, obj, days, scopes):
    secret = "kos_" + secrets.token_urlsafe(32)
    key = IntegrationKey(
        integration_id=obj.id,
        scopes=list(dict.fromkeys(scopes)),
        secret_hash=digest(secret),
        prefix=secret[:12],
        expires_at=utcnow() + timedelta(days=days),
    )
    db.add(key)
    db.flush()
    return key_json(key) | {"secret": secret}


@admin.post("/integrations/{id}/keys", status_code=201)
def create_key(id: str, body: KeyInput, request: Request, db: Db):
    result = issue_key(
        db,
        integration(db, id),
        body.expires_in_days,
        body.scopes if body.scopes is not None else ["query", "conversations", "sources", "widget_sessions"],
    )
    audit(db, request, "key.created", id)
    db.commit()
    return result


def existing_key(db, integration_id, key_id):
    key = db.get(IntegrationKey, key_id)
    if key is None or key.integration_id != integration_id:
        not_found()
    return key


@admin.delete("/integrations/{id}/keys/{key_id}")
def revoke_key(id: str, key_id: str, request: Request, db: Db):
    key = existing_key(db, id, key_id)
    key.revoked_at = utcnow()
    audit(db, request, "key.revoked", id)
    db.commit()
    return {"revoked": True}


@admin.post("/integrations/{id}/keys/{key_id}/rotate", status_code=201)
def rotate_key(id: str, key_id: str, body: KeyInput, request: Request, db: Db):
    key = existing_key(db, id, key_id)
    if key.revoked_at is not None:
        raise HTTPException(409, "This key was already revoked")
    key.revoked_at = utcnow()
    result = issue_key(db, integration(db, id), body.expires_in_days, body.scopes if body.scopes is not None else key.scopes)
    audit(db, request, "key.rotated", id)
    db.commit()
    return result


@access.patch("/{id}/access")
def document_access(id: str, body: AccessInput, request: Request, db: Db):
    doc = db.get(Document, id)
    if doc is None:
        not_found()
    doc.employee_available = body.employee_available
    audit(db, request, "document.published" if body.employee_available else "document.restricted")
    db.commit()
    return {"id": id, "employee_available": doc.employee_available}


def allowed_documents(db, integration_id):
    return set(
        db.scalars(
            select(Document.id)
            .join(IntegrationDocument, IntegrationDocument.document_id == Document.id)
            .where(
                IntegrationDocument.integration_id == integration_id, Document.employee_available.is_(True), Document.status == "indexed"
            )
        )
    )


def throttle(db, integration_id, employee_id, limit):
    from sqlalchemy.dialects.postgresql import insert as pg_insert
    from sqlalchemy.dialects.sqlite import insert as sqlite_insert

    insert = pg_insert if db.bind.dialect.name == "postgresql" else sqlite_insert
    now = utcnow()
    exceeded = False
    for scope, value, maximum in [("integration", integration_id, limit), ("employee", employee_id, min(limit, 60))]:
        key = digest(f"api-v1:{scope}:{value}:{int(now.timestamp()) // 60}")
        stmt = insert(LoginBucket).values(id=key, attempts=1, expires_at=now + timedelta(minutes=5))
        stmt = stmt.on_conflict_do_update(index_elements=[LoginBucket.id], set_={"attempts": LoginBucket.attempts + 1})
        exceeded |= db.execute(stmt.returning(LoginBucket.attempts)).scalar_one() > maximum
    db.execute(delete(LoginBucket).where(LoginBucket.expires_at < now))
    db.commit()
    if exceeded:
        raise HTTPException(429, "Integration request limit reached", headers={"Retry-After": "60"})


@dataclass
class Principal:
    integration: Integration
    key: IntegrationKey
    employee: Employee | None
    channel: str


def resolve_key(request, db):
    authorization = request.headers.get("authorization", "")
    if (
        len(authorization) > 256
        or not authorization.startswith("Bearer kos_")
        or request.headers.get("origin")
        or request.headers.get("sec-fetch-mode")
    ):
        raise HTTPException(401, "Server integration credential required")
    key = db.scalar(select(IntegrationKey).where(IntegrationKey.secret_hash == digest(authorization[7:])))
    return active_key(db, key)


def active_key(db, key):
    if key is None or key.revoked_at is not None or expired(key.expires_at):
        raise HTTPException(401, "Integration credential invalid or expired")
    obj = db.get(Integration, key.integration_id)
    if obj is None or not obj.enabled:
        raise HTTPException(401, "Integration unavailable")
    return key, obj


def employee_for(db, integration_id, subject):
    employee = db.scalar(select(Employee).where(Employee.integration_id == integration_id, Employee.external_subject == subject))
    if employee is None:
        employee = Employee(integration_id=integration_id, external_subject=subject)
        # Savepoint handles concurrent first visits without rolling back caller state.
        try:
            with db.begin_nested():
                db.add(employee)
                db.flush()
        except IntegrityError:
            employee = db.scalar(select(Employee).where(Employee.integration_id == integration_id, Employee.external_subject == subject))
    return employee


def principal(request: Request, db: Db):
    authorization = request.headers.get("authorization", "")
    if authorization.startswith("Bearer kos_"):
        key, obj = resolve_key(request, db)
        subject = request.headers.get("x-employee-subject", "")
        if not subject.strip() or len(subject) > 160 or subject != subject.strip():
            raise HTTPException(401, "A server-attested employee subject is required")
        employee = employee_for(db, obj.id, subject)
        result = Principal(obj, key, employee, "api")
    else:
        if not authorization.startswith("Bearer kws_") or len(authorization) > 256:
            raise HTTPException(401, "Employee session required")
        token = db.get(WidgetSession, digest(authorization[7:]))
        if token is None or expired(token.expires_at):
            raise HTTPException(401, "Employee session invalid or expired")
        key, obj = active_key(db, db.get(IntegrationKey, token.key_id))
        origin = request.headers.get("origin")
        if token.integration_id != obj.id or origin != token.origin or origin not in obj.allowed_origins:
            raise HTTPException(403, "Employee session origin is not allowed")
        employee = db.get(Employee, token.employee_id)
        if employee is None or employee.integration_id != obj.id:
            raise HTTPException(401, "Employee session invalid")
        result = Principal(obj, key, employee, "widget")
    needed = set()
    path = request.url.path
    if path.endswith("/query") or path.endswith("/messages"):
        needed.add("query")
    if "/conversations" in path:
        needed.add("conversations")
    if "/sources/" in path:
        needed.add("sources")
    if not needed <= set(key.scopes):
        raise HTTPException(403, "Credential capability is not authorized")
    throttle(db, obj.id, employee.id, obj.rate_limit_per_minute)
    key.last_used_at = utcnow()
    db.commit()
    return result


Actor = Annotated[Principal, Depends(principal)]


def server_key(request: Request, db: Db):
    return resolve_key(request, db)


ServerKey = Annotated[tuple, Depends(server_key)]


@api.post("/widget-sessions", response_model=SessionResponse, status_code=201)
def exchange(body: SessionInput, request: Request, db: Db, credential: ServerKey):
    key, obj = credential
    if "widget_sessions" not in key.scopes:
        raise HTTPException(403, "Widget session issuance is not authorized")
    if body.origin not in obj.allowed_origins:
        raise HTTPException(403, "Widget origin is not allowed")
    employee = employee_for(db, obj.id, body.subject)
    throttle(db, obj.id, employee.id, obj.rate_limit_per_minute)
    token = "kws_" + secrets.token_urlsafe(32)
    expires_at = min(utcnow() + timedelta(minutes=5), key.expires_at.replace(tzinfo=timezone.utc))
    db.execute(delete(WidgetSession).where(WidgetSession.expires_at < utcnow()))
    db.add(
        WidgetSession(
            token_hash=digest(token),
            integration_id=obj.id,
            key_id=key.id,
            employee_id=employee.id,
            origin=body.origin,
            expires_at=expires_at,
        )
    )
    key.last_used_at = utcnow()
    db.commit()
    return {"access_token": token, "expires_at": iso(expires_at), "expires_in": max(0, int((expires_at - utcnow()).total_seconds()))}


def authorized_search(body, db, vectors, settings, actor):
    ids = allowed_documents(db, actor.integration.id)
    if ids:
        check_embedding_revision(db, vectors)
        raw = vectors.search(
            body.question,
            body.top_k or settings.default_top_k,
            body.score_threshold if body.score_threshold is not None else settings.default_score_threshold,
            document_ids=ids,
        )
    else:
        raw = []
    # Rebuild source text from SQL. Never trust payload text, title or document/chunk association.
    ids = allowed_documents(db, actor.integration.id)
    sources = []
    for item in raw:
        chunk = db.get(Chunk, item.get("chunk_id"))
        if chunk is None or chunk.document_id not in ids or item.get("document_id") != chunk.document_id:
            continue
        doc = db.get(Document, chunk.document_id)
        sources.append(
            {
                "document_id": doc.id,
                "title": doc.title,
                "chunk_id": chunk.id,
                "text": chunk.text,
                "page": chunk.page,
                "start_offset": chunk.start_offset,
                "end_offset": chunk.end_offset,
                "score": item["score"],
            }
        )
    return sources


def owned_conversation(db, actor, id):
    obj = db.get(Conversation, id)
    if obj is None or obj.integration_id != actor.integration.id or obj.employee_id != actor.employee.id:
        not_found()
    # A revoked/deleted source must not escape through historical answer snapshots or LLM history.
    allowed = allowed_documents(db, actor.integration.id)
    messages = list(db.scalars(select(Message).where(Message.conversation_id == id).order_by(Message.created_at, Message.id)))
    if any(s.get("document_id") not in allowed for m in messages for s in m.sources):
        not_found()
    return obj, messages


@api.get("/capabilities")
def capabilities(actor: Actor, settings: Annotated[Settings, Depends(runtime_settings)]):
    return {
        "integration": actor.integration.name,
        "mode": "retrieval_only" if settings.llm_provider == "none" else "provider_configured",
        "model": settings.llm_model or None,
        "embedding_model": settings.embedding_model,
        "languages": "English retrieval; multilingual generation does not fix cross-language retrieval",
        "capabilities": [scope for scope in actor.key.scopes if scope != "widget_sessions"],
    }


@api.get("/conversations")
def list_conversations(actor: Actor, db: Db):
    rows = db.scalars(
        select(Conversation)
        .where(Conversation.integration_id == actor.integration.id, Conversation.employee_id == actor.employee.id)
        .order_by(Conversation.created_at.desc())
    )
    result = []
    for row in rows:
        try:
            owned_conversation(db, actor, row.id)
            result.append(conversation_json(row))
        except HTTPException as exc:
            if exc.status_code != 404:
                raise
    return result


@api.post("/conversations", status_code=201)
def create_conversation(body: ConversationInput, actor: Actor, db: Db):
    obj = Conversation(title=body.title, integration_id=actor.integration.id, employee_id=actor.employee.id)
    db.add(obj)
    db.commit()
    return conversation_json(obj)


@api.get("/conversations/{id}")
def get_conversation(id: str, actor: Actor, db: Db):
    obj, messages = owned_conversation(db, actor, id)
    return conversation_json(obj) | {"messages": [message_json(m) for m in messages]}


@api.delete("/conversations/{id}")
def delete_conversation(id: str, actor: Actor, db: Db):
    # Deletion is allowed even if a historical source is no longer accessible, but never to another owner.
    obj = db.get(Conversation, id)
    if obj is None or obj.integration_id != actor.integration.id or obj.employee_id != actor.employee.id:
        not_found()
    db.execute(delete(Message).where(Message.conversation_id == id))
    db.delete(obj)
    db.commit()
    return {"deleted": True}


@api.get("/sources/{id}")
def source(id: str, actor: Actor, db: Db):
    chunk = db.get(Chunk, id)
    if chunk is None or chunk.document_id not in allowed_documents(db, actor.integration.id):
        not_found()
    doc = db.get(Document, chunk.document_id)
    return {
        "document_id": doc.id,
        "title": doc.title,
        "chunk_id": chunk.id,
        "text": chunk.text,
        "page": chunk.page,
        "start_offset": chunk.start_offset,
        "end_offset": chunk.end_offset,
    }


def employee_answer(body, request, actor, db, settings, vectors, conversation_id=None):
    started = perf_counter()
    history = []
    if conversation_id:
        _, history = owned_conversation(db, actor, conversation_id)
    sources = authorized_search(body, db, vectors, settings, actor)
    retrieval_ms = round((perf_counter() - started) * 1000)
    request_id = str(uuid4())
    metadata = {}
    try:
        content, mode = answer(body.question, sources, history[-6:], settings, metadata=metadata)
    except (ProviderError, httpx.HTTPError, ValueError, KeyError, IndexError, TypeError) as exc:
        db.add(
            QueryLog(
                conversation_id=conversation_id,
                integration_id=actor.integration.id,
                channel=actor.channel,
                question="[employee query redacted]",
                mode="provider_error",
                latency_ms=round((perf_counter() - started) * 1000),
                matched_chunks=len(sources),
                document_ids=[s["document_id"] for s in sources],
            )
        )
        db.commit()
        status = getattr(exc, "status_code", 503)
        if isinstance(exc, httpx.HTTPStatusError) and exc.response.status_code == 429:
            status = 429
        raise HTTPException(
            status if status in {429, 503, 504} else 503,
            "Answer provider unavailable",
            headers={"X-Request-ID": request_id}
            | ({"Retry-After": str(exc.retry_after)} if getattr(exc, "retry_after", None) is not None else {}),
        ) from None
    # Re-check permissions after generation, so a scope revoked while the provider runs is not returned.
    db.expire_all()
    active_key(db, db.get(IntegrationKey, actor.key.id))
    permitted = allowed_documents(db, actor.integration.id)
    if any(s["document_id"] not in permitted for s in sources) or any(
        s.get("document_id") not in permitted for m in history for s in m.sources
    ):
        raise HTTPException(403, "Document access changed; start a new request")
    if actor.channel == "widget":
        token = db.get(WidgetSession, digest(request.headers["authorization"][7:]))
        if token is None or expired(token.expires_at) or token.origin not in actor.integration.allowed_origins:
            raise HTTPException(401, "Employee session expired or revoked during generation")
    latency = round((perf_counter() - started) * 1000)
    trace = {
        "question": body.question,
        "latency_ms": latency,
        "retrieval_ms": retrieval_ms,
        "provider": settings.llm_provider,
        "model": settings.llm_model if settings.llm_provider != "none" else None,
        "top_k": body.top_k or settings.default_top_k,
        "score_threshold": body.score_threshold if body.score_threshold is not None else settings.default_score_threshold,
        "matched_chunks": len(sources),
        "embedding_model": settings.embedding_model,
        "embedding_revision": vectors.revision,
    }
    trace.update(metadata)
    if conversation_id:
        db.add(Message(conversation_id=conversation_id, role="user", content=body.question))
        db.flush()
        db.add(Message(conversation_id=conversation_id, role="assistant", content=content, mode=mode, sources=sources, trace=trace))
    db.add(
        QueryLog(
            conversation_id=conversation_id,
            integration_id=actor.integration.id,
            channel=actor.channel,
            question="[employee query redacted]",
            mode=mode,
            latency_ms=latency,
            matched_chunks=len(sources),
            document_ids=[s["document_id"] for s in sources],
        )
    )
    db.commit()
    return {
        "conversation_id": conversation_id,
        "answer": content,
        "mode": mode,
        "sources": sources,
        "request_id": request_id,
        "latency_ms": latency,
        "generation_ms": metadata.get("generation_ms"),
        "usage": metadata.get("usage"),
    }


Vectors = Annotated[object, Depends(get_vectors)]
EffectiveConfig = Annotated[Settings, Depends(runtime_settings)]


@api.post("/query", response_model=AnswerResponse)
def query(body: QueryInput, request: Request, actor: Actor, db: Db, settings: EffectiveConfig, vectors: Vectors):
    return employee_answer(body, request, actor, db, settings, vectors)


@api.post("/conversations/{id}/messages", response_model=AnswerResponse, status_code=201)
def send_message(id: str, body: QueryInput, request: Request, actor: Actor, db: Db, settings: EffectiveConfig, vectors: Vectors):
    return employee_answer(body, request, actor, db, settings, vectors, id)


@admin.get("/overview")
@admin.get("/analytics")
def analytics(db: Db, days: Literal["7", "30", "90"] = "7"):
    days = int(days)
    today = utcnow().date()
    start = datetime.combine(today - timedelta(days=days - 1), datetime.min.time(), timezone.utc)
    logs = list(db.scalars(select(QueryLog).where(QueryLog.created_at >= start)))
    integrations = list(db.scalars(select(Integration)))
    counts = Counter(log.integration_id for log in logs if log.integration_id)
    trend = Counter(iso(log.created_at)[:10] for log in logs)
    return {
        "integrations_active": sum(i.enabled for i in integrations),
        "query_count": len(logs),
        "abstention_count": sum(q.mode == "abstained" for q in logs),
        "provider_error_count": sum(q.mode == "provider_error" for q in logs),
        "no_result_count": sum(q.matched_chunks == 0 for q in logs),
        "average_latency_ms": round(sum(q.latency_ms for q in logs) / len(logs), 1) if logs else 0,
        "queries_by_integration": [{"id": i.id, "name": i.name, "count": counts[i.id]} for i in integrations],
        "query_trend": [
            {"date": (today - timedelta(days=d)).isoformat(), "count": trend[(today - timedelta(days=d)).isoformat()]}
            for d in reversed(range(days))
        ],
        "recent_events": [
            {
                "id": q.id,
                "integration_id": q.integration_id,
                "mode": q.mode,
                "latency_ms": q.latency_ms,
                "created_at": iso(q.created_at),
                "channel": q.channel,
            }
            for q in sorted(logs, key=lambda q: iso(q.created_at), reverse=True)[:30]
        ],
    }


class SettingsInput(StrictInput):
    default_top_k: int | None = Field(default=None, ge=1, le=10)
    default_score_threshold: float | None = Field(default=None, ge=0, le=1)
    llm_provider: Literal["none", "gemini", "openai", "ollama"] | None = None
    llm_model: str | None = Field(default=None, max_length=120, pattern=r"^(?:[a-zA-Z0-9][a-zA-Z0-9._:/-]*)?$")


@admin.get("/settings")
def settings_view(db: Db, settings: Config):
    row = db.get(RuntimeSettings, 1)
    values = row.values if row else {}
    return {
        "default_top_k": values.get("default_top_k", settings.default_top_k),
        "default_score_threshold": values.get("default_score_threshold", settings.default_score_threshold),
        "llm_provider": values.get("llm_provider", settings.llm_provider),
        "llm_model": values.get("llm_model", settings.llm_model),
        "embedding_model": settings.embedding_model,
        "embedding_dimension": settings.embedding_dimension,
        "allowed_providers": settings.allowed_llm_providers,
        "configured_providers": {
            "none": True,
            "gemini": bool(settings.gemini_api_key),
            "openai": bool(settings.openai_api_key),
            "ollama": bool(settings.ollama_url),
        },
        "status_note": "Configuration status only; live model access and quotas require a real provider request.",
    }


@admin.patch("/settings")
def change_settings(body: SettingsInput, request: Request, db: Db, settings: Config):
    changes = body.model_dump(exclude_unset=True)
    if any(v is None for v in changes.values()):
        raise HTTPException(422, "Explicit null settings are not allowed")
    row = db.get(RuntimeSettings, 1)
    values = (row.values if row else {}) | changes
    try:
        Settings.model_validate(settings.model_dump() | values)
    except ValueError:
        raise HTTPException(422, "Provider/model not permitted or server-side credentials are missing") from None
    if row is None:
        row = RuntimeSettings(id=1, values=values)
        db.add(row)
    else:
        row.values = values
    audit(db, request, "settings.updated")
    db.commit()
    return settings_view(db, settings)
