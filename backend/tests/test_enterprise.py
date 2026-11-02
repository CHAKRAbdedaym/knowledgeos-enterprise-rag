from datetime import datetime, timedelta, timezone
from unittest.mock import Mock
import httpx
import pytest
from sqlalchemy import select
from app.models import IntegrationKey, WidgetSession, QueryLog

ORIGIN = "http://localhost:8090"


def upload(client, text, name="policy.md"):
    r = client.post("/api/documents", files={"file": (name, text.encode(), "text/markdown")})
    assert r.status_code == 201, r.text
    assert r.json()["status"] == "indexed", r.text
    return r.json()


def configured(client, ids=(), publish=True, name="Synthetic intranet"):
    for id in ids:
        if publish:
            assert client.patch(f"/api/documents/{id}/access", json={"employee_available": True}).status_code == 200
    r = client.post("/api/admin/integrations", json={"name": name, "allowed_origins": [ORIGIN], "document_ids": list(ids)})
    assert r.status_code == 201, r.text
    obj = r.json()
    key = client.post(f"/api/admin/integrations/{obj['id']}/keys", json={"expires_in_days": 30})
    assert key.status_code == 201, key.text
    return obj, key.json()


def v1(client, secret, method, path, body=None, subject="alice", origin=None):
    req = client.build_request(method, "/api/v1" + path, json=body)
    req.headers.pop("origin", None)
    req.headers.pop("x-csrf-token", None)
    req.headers["Authorization"] = "Bearer " + secret
    if secret.startswith("kos_"):
        req.headers["X-Employee-Subject"] = subject
    if origin is not None:
        req.headers["Origin"] = origin
    elif secret.startswith("kws_"):
        req.headers["Origin"] = ORIGIN
    return client.send(req)


def token(client, key, subject="alice"):
    r = v1(client, key, "POST", "/widget-sessions", {"subject": subject, "origin": ORIGIN})
    assert r.status_code == 201, r.text
    return r.json()["access_token"]


def test_default_deny_historical_and_unpublished_documents(client):
    doc = upload(client, "Synthetic remote work policy allows three remote days.")
    assert doc["employee_available"] is False
    integration, key = configured(client, [doc["id"]], publish=False)
    r = v1(client, key["secret"], "POST", "/query", {"question": "remote work policy"})
    assert r.json()["mode"] == "abstained" and r.json()["sources"] == []
    client.patch(f"/api/documents/{doc['id']}/access", json={"employee_available": True})
    assert v1(client, key["secret"], "POST", "/query", {"question": "remote work policy"}).json()["sources"]
    client.patch(f"/api/admin/integrations/{integration['id']}", json={"document_ids": []})
    assert v1(client, key["secret"], "POST", "/query", {"question": "remote work policy"}).json()["sources"] == []


def test_filter_precedes_topk_and_forbidden_passages_never_reach_prompt(client, monkeypatch):
    public = upload(client, "Synthetic remote policy allows three remote days.", "public.md")
    private = upload(client, "Confidential salary secret violet cipher remote policy remote remote.", "private.md")
    _, key = configured(client, [public["id"]])
    captured = []
    from app import enterprise

    def generation(question, sources, history, settings, metadata=None):
        captured.extend(sources)
        assert all(s["document_id"] == public["id"] for s in sources)
        assert "violet cipher" not in str(sources)
        return "Grounded fixture [1]", "grounded"

    monkeypatch.setattr(enterprise, "answer", generation)
    search = Mock(wraps=client.vectors.search)
    monkeypatch.setattr(client.vectors, "search", search)
    r = v1(client, key["secret"], "POST", "/query", {"question": "remote policy", "top_k": 1, "score_threshold": 0})
    assert r.status_code == 200, r.text
    assert r.json()["mode"] == "grounded" and captured
    assert search.call_args.kwargs["document_ids"] == {public["id"]}
    chunks = client.get("/api/documents/" + private["id"]).json()["chunks"]
    assert v1(client, key["secret"], "GET", "/sources/" + chunks[0]["id"]).status_code == 404
    assert v1(client, key["secret"], "GET", "/sources/" + captured[0]["chunk_id"]).json()["text"] == captured[0]["text"]


def test_payload_text_is_not_trusted_and_sql_revocation_is_rechecked(client, monkeypatch):
    doc = upload(client, "Synthetic remote policy says three days.")
    _, key = configured(client, [doc["id"]])
    chunk = client.get("/api/documents/" + doc["id"]).json()["chunks"][0]
    monkeypatch.setattr(
        client.vectors,
        "search",
        lambda *a, **kw: [{"document_id": doc["id"], "chunk_id": chunk["id"], "text": "INJECTED SECRET", "title": "forged", "score": 0.9}],
    )
    r = v1(client, key["secret"], "POST", "/query", {"question": "remote"})
    assert r.status_code == 200 and "INJECTED SECRET" not in r.text
    assert r.json()["sources"][0]["text"] == chunk["text"]


def test_employee_and_integration_ownership_and_admin_separation(client):
    doc = upload(client, "Synthetic remote policy says three days.")
    _, key = configured(client, [doc["id"]])
    alice = token(client, key["secret"])
    bob = token(client, key["secret"], "bob")
    _, other_key = configured(client, [doc["id"]], name="Second integration")
    other = token(client, other_key["secret"])
    c = v1(client, alice, "POST", "/conversations", {"title": "My private conversation"}).json()
    path = "/conversations/" + c["id"]
    assert v1(client, alice, "POST", path + "/messages", {"question": "remote policy"}).status_code == 201
    for credential in [bob, other]:
        assert v1(client, credential, "GET", path).status_code == 404
        assert v1(client, credential, "DELETE", path).status_code == 404
        assert v1(client, credential, "POST", path + "/messages", {"question": "remote"}).status_code == 404
    assert v1(client, alice, "GET", path).json()["messages"]
    assert v1(client, bob, "GET", "/conversations").json() == []
    assert client.get("/api/conversations").json() == []
    assert client.get("/api/conversations/" + c["id"]).status_code == 404
    # An employee token alone cannot access the administrator API.
    cookies = dict(client.cookies)
    client.cookies.clear()
    assert client.get("/api/documents", headers={"Authorization": "Bearer " + alice}).status_code == 401
    client.cookies.update(cookies)
    assert v1(client, alice, "DELETE", path).status_code == 200


def test_scope_revocation_denies_historical_sources_and_followup(client):
    doc = upload(client, "Synthetic remote policy says three days.")
    obj, key = configured(client, [doc["id"]])
    t = token(client, key["secret"])
    c = v1(client, t, "POST", "/conversations", {}).json()
    path = "/conversations/" + c["id"]
    answer = v1(client, t, "POST", path + "/messages", {"question": "remote policy"}).json()
    assert answer["sources"]
    client.patch("/api/admin/integrations/" + obj["id"], json={"document_ids": []})
    assert v1(client, t, "GET", path).status_code == 404
    assert v1(client, t, "POST", path + "/messages", {"question": "repeat earlier answer"}).status_code == 404
    assert v1(client, t, "GET", "/sources/" + answer["sources"][0]["chunk_id"]).status_code == 404
    assert v1(client, t, "GET", "/conversations").json() == []
    assert v1(client, t, "DELETE", path).status_code == 200


def test_keys_hash_once_rotation_expiry_revocation_and_disable(client):
    obj, key = configured(client)
    secret = key["secret"]
    t = token(client, secret)
    inventory = client.get("/api/admin/integrations").json()
    assert secret not in str(inventory)
    with client.db_sessions() as db:
        stored = db.get(IntegrationKey, key["id"])
        assert secret not in stored.secret_hash and stored.secret_hash != secret
    rotated = client.post(f"/api/admin/integrations/{obj['id']}/keys/{key['id']}/rotate", json={}).json()
    assert rotated["secret"] != secret
    assert v1(client, secret, "GET", "/capabilities").status_code == 401
    assert v1(client, t, "GET", "/capabilities").status_code == 401
    assert v1(client, rotated["secret"], "GET", "/capabilities").status_code == 200
    with client.db_sessions() as db:
        db.get(IntegrationKey, rotated["id"]).expires_at = datetime.now(timezone.utc) - timedelta(seconds=1)
        db.commit()
    assert v1(client, rotated["secret"], "GET", "/capabilities").status_code == 401
    new = client.post(f"/api/admin/integrations/{obj['id']}/keys", json={}).json()
    assert client.delete(f"/api/admin/integrations/{obj['id']}/keys/{new['id']}").status_code == 200
    assert v1(client, new["secret"], "GET", "/capabilities").status_code == 401
    new = client.post(f"/api/admin/integrations/{obj['id']}/keys", json={}).json()
    client.patch("/api/admin/integrations/" + obj["id"], json={"enabled": False})
    assert v1(client, new["secret"], "GET", "/capabilities").status_code == 401


def test_widget_origin_expiration_identity_and_cors(client):
    obj, key = configured(client)
    secret = key["secret"]
    assert v1(client, secret, "POST", "/widget-sessions", {"subject": "alice", "origin": "https://evil.example"}).status_code == 403
    assert v1(client, secret, "POST", "/widget-sessions", {"subject": "alice", "origin": ORIGIN}, origin=ORIGIN).status_code == 401
    t = token(client, secret)
    assert v1(client, t, "GET", "/capabilities", origin="https://evil.example").status_code == 403
    assert v1(client, t, "POST", "/query", {"question": "hi", "employee_id": "bob"}).status_code == 422
    r = v1(client, t, "GET", "/capabilities")
    assert r.headers["access-control-allow-origin"] == ORIGIN
    assert "access-control-allow-credentials" not in r.headers
    preflight = client.options(
        "/api/v1/query",
        headers={"Origin": ORIGIN, "Access-Control-Request-Method": "POST", "Access-Control-Request-Headers": "authorization,content-type"},
    )
    assert preflight.status_code == 204
    assert (
        client.options("/api/v1/query", headers={"Origin": "https://evil.example", "Access-Control-Request-Method": "POST"}).status_code
        == 403
    )
    assert (
        client.options(
            "/api/v1/query",
            headers={"Origin": ORIGIN, "Access-Control-Request-Method": "POST", "Access-Control-Request-Headers": "x-csrf-token"},
        ).status_code
        == 403
    )
    with client.db_sessions() as db:
        db.scalar(select(WidgetSession)).expires_at = datetime.now(timezone.utc) - timedelta(seconds=1)
        db.commit()
    assert v1(client, t, "GET", "/capabilities").status_code == 401


def test_employee_queries_are_redacted_in_admin_analytics(client):
    _, key = configured(client)
    phrase = "Synthetic personal question that must not be disclosed in aggregate data"
    assert v1(client, key["secret"], "POST", "/query", {"question": phrase}).status_code == 200
    assert phrase not in client.get("/api/dashboard").text
    assert phrase not in client.get("/api/admin/analytics").text
    with client.db_sessions() as db:
        q = db.scalar(select(QueryLog))
        assert q.question == "[employee query redacted]" and q.integration_id
    metrics = client.get("/api/admin/analytics").json()
    assert metrics["query_count"] == 1 and metrics["no_result_count"] == 1


def test_rate_limit_shared_by_integration_and_employee(client):
    obj, key = configured(client)
    client.patch("/api/admin/integrations/" + obj["id"], json={"rate_limit_per_minute": 1})
    assert v1(client, key["secret"], "GET", "/capabilities").status_code == 200
    r = v1(client, key["secret"], "GET", "/capabilities", subject="bob")
    assert r.status_code == 429 and r.headers["retry-after"] == "60"


@pytest.mark.parametrize("failure", [httpx.ConnectError("private upstream location"), httpx.ReadTimeout("secret internal address")])
def test_dependency_provider_errors_are_safe(client, monkeypatch, failure):
    doc = upload(client, "Synthetic remote policy says three days.")
    _, key = configured(client, [doc["id"]])
    from app import enterprise

    def fail(*args, **kwargs):
        raise failure

    monkeypatch.setattr(enterprise, "answer", fail)
    r = v1(client, key["secret"], "POST", "/query", {"question": "remote policy"})
    assert r.status_code == 503 and "private upstream" not in r.text and "secret internal" not in r.text
    assert client.get("/api/admin/analytics").json()["provider_error_count"] == 1


def test_conversation_constraint_legacy_no_employee_data_leak(client):
    legacy = client.post("/api/conversations", json={"title": "Admin only"}).json()
    obj, key = configured(client)
    assert v1(client, key["secret"], "GET", "/conversations/" + legacy["id"]).status_code == 404
    assert v1(client, key["secret"], "POST", "/query", {"question": "anything"}, subject="").status_code == 401
    assert client.patch("/api/admin/integrations/" + obj["id"], json={"allowed_origins": None}).status_code == 422


def test_capability_scopes_rotation_and_settings(client):
    obj, original = configured(client)
    restricted = client.post(f"/api/admin/integrations/{obj['id']}/keys", json={"scopes": ["sources"]}).json()
    assert restricted["scopes"] == ["sources"]
    assert v1(client, restricted["secret"], "POST", "/query", {"question": "hello"}).status_code == 403
    assert v1(client, restricted["secret"], "POST", "/widget-sessions", {"subject": "alice", "origin": ORIGIN}).status_code == 403
    rotated = client.post(f"/api/admin/integrations/{obj['id']}/keys/{restricted['id']}/rotate", json={}).json()
    assert rotated["scopes"] == ["sources"]
    assert v1(client, rotated["secret"], "POST", "/conversations", {}).status_code == 403
    assert (
        client.patch(
            "/api/admin/settings", json={"default_top_k": 3, "default_score_threshold": 0.4, "llm_provider": "none", "llm_model": ""}
        ).status_code
        == 200
    )
    assert client.get("/api/config").json()["default_top_k"] == 3
    assert client.get("/api/admin/settings").json()["default_score_threshold"] == 0.4
    assert client.patch("/api/admin/settings", json={"llm_provider": "gemini", "llm_model": "gemini-3.5-flash-lite"}).status_code == 422
    assert "api_key" not in client.get("/api/admin/settings").text
    assert client.patch("/api/admin/settings", json={"gemini_api_key": "not-accepted"}).status_code == 422


def test_provider_quota_headers_and_scope_change_during_generation(client, monkeypatch):
    doc = upload(client, "Synthetic remote policy says three days.")
    _, key = configured(client, [doc["id"]])
    from app import enterprise
    from app.gemini import ProviderError

    def fail(*args, **kwargs):
        raise ProviderError(429, 60)

    monkeypatch.setattr(enterprise, "answer", fail)
    r = v1(client, key["secret"], "POST", "/query", {"question": "remote policy"})
    assert r.status_code == 429 and r.headers["retry-after"] == "60"

    def change_scope(*args, **kwargs):
        from app.models import Document

        with client.db_sessions() as db:
            db.get(Document, doc["id"]).employee_available = False
            db.commit()
        return "Previously retrieved content [1]", "grounded"

    monkeypatch.setattr(enterprise, "answer", change_scope)
    r = v1(client, key["secret"], "POST", "/query", {"question": "remote policy"})
    assert r.status_code == 403 and "Previously retrieved content" not in r.text


def test_vector_outage_fails_safely_and_recovers(client, monkeypatch):
    document = upload(client, "Synthetic remote work policy allows three days.")
    _, key = configured(client, [document["id"]])

    def unavailable(*args, **kwargs):
        raise ConnectionError("private vector endpoint and credentials")

    with monkeypatch.context() as patch:
        patch.setattr(client.vectors, "search", unavailable)
        response = v1(client, key["secret"], "POST", "/query", {"question": "remote work policy"})
        assert response.status_code == 503
        assert "private vector" not in response.text and key["secret"] not in response.text
    assert v1(client, key["secret"], "POST", "/query", {"question": "remote work policy"}).status_code == 200


def test_database_outage_fails_closed_without_leaking_credentials(client, monkeypatch):
    from sqlalchemy.orm import Session

    def unavailable(*args, **kwargs):
        raise ConnectionError("private SQL endpoint and password")

    with monkeypatch.context() as patch:
        patch.setattr(Session, "execute", unavailable)
        response = client.get("/api/documents")
        assert response.status_code == 503
        assert "private SQL" not in response.text and "password" not in response.text
    assert client.get("/api/documents").status_code == 200
