"""HTTP workflows using deterministic embeddings and real Qdrant local storage."""

import pytest


def upload(client, content=b"Incident escalation: notify the security incident commander within fifteen minutes.", filename="policy.md"):
    response = client.post(
        "/api/documents", files={"file": (filename, content, "text/markdown")}, data={"category": "Security", "tags": "policy,synthetic"}
    )
    assert response.status_code == 201, response.text
    return response.json()


def test_full_document_conversation_and_analytics_workflow(client):
    assert client.get("/api/health").json()["status"] == "ok"
    assert client.get("/api/readiness").status_code == 200
    config = client.get("/api/config").json()
    assert config["embedding_dimension"] == 384
    assert "openai_api_key" not in config
    document = upload(client)
    assert document["status"] == "indexed", document
    assert document["chunk_count"] == 1
    detail = client.get("/api/documents/" + document["id"]).json()
    assert "fifteen minutes" in detail["text"]
    assert client.get("/api/documents").json()[0]["id"] == document["id"]
    duplicate = client.post("/api/documents", files={"file": ("again.md", detail["text"].encode())})
    assert duplicate.status_code == 409
    result = client.post("/api/retrieval", json={"question": "incident security commander", "top_k": 3, "score_threshold": 0.1}).json()
    assert result["sources"][0]["document_id"] == document["id"]
    source = result["sources"][0]
    assert detail["text"][source["start_offset"] : source["end_offset"]] == source["text"]
    conversation = client.post("/api/conversations", json={"title": "Escalation policy"}).json()
    url = "/api/conversations/" + conversation["id"]
    result = client.post(url + "/messages", json={"question": "incident security commander", "score_threshold": 0.1})
    assert result.status_code == 201, result.text
    message = result.json()
    assert message["mode"] == "retrieval_only"
    assert "generation is disabled" in message["content"]
    assert message["trace"]["matched_chunks"] == 1
    assert len(client.get(url).json()["messages"]) == 2
    assert client.patch(url, json={"title": "Renamed"}).json()["title"] == "Renamed"
    dashboard = client.get("/api/dashboard").json()
    assert dashboard["documents"] == 1 and dashboard["queries"] == 2
    analytics = client.get("/api/analytics?days=30").json()
    assert analytics["queries"] == 2
    assert len(analytics["query_trend"]) == 30
    assert analytics["most_referenced"][0]["id"] == document["id"]
    assert client.post("/api/documents/" + document["id"] + "/reindex").json()["chunk_count"] == 1
    assert client.delete("/api/documents/" + document["id"]).json()["deleted"]
    assert client.post("/api/retrieval", json={"question": "incident security commander", "score_threshold": 0}).json()["sources"] == []
    assert client.delete(url).status_code == 200
    assert client.get(url).status_code == 404


def test_abstention_with_empty_index(client):
    conversation = client.post("/api/conversations", json={}).json()
    response = client.post(f"/api/conversations/{conversation['id']}/messages", json={"question": "What is the deployment password?"})
    assert response.json()["mode"] == "abstained"
    assert response.json()["sources"] == []


@pytest.mark.parametrize(
    "body", [{"question": ""}, {"question": "   "}, {"question": "hi", "top_k": 11}, {"question": "hi", "score_threshold": -1}]
)
def test_question_validation(client, body):
    response = client.post("/api/retrieval", json=body)
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "validation_error"


def test_upload_validation_and_path_safety(client):
    assert client.post("/api/documents", files={"file": ("x.pdf", b"not a pdf")}).status_code == 422
    assert client.post("/api/documents", files={"file": ("x.exe", b"not a doc")}).status_code == 422
    document = upload(client, filename="../../escape.md")
    assert document["filename"] == "escape.md"
    assert (client.settings.upload_dir / document["id"]).is_file()
    assert not (client.settings.upload_dir.parent / "escape.md").exists()
    assert client.post("/api/documents", files={"file": ("large.txt", b"a" * (10 * 1024 * 1024 + 1))}).status_code == 413


def test_index_failure_visible_and_recoverable(client, monkeypatch):
    original = client.vectors.add

    def fail(*args):
        raise RuntimeError("secret infrastructure address")

    monkeypatch.setattr(client.vectors, "add", fail)
    document = upload(client)
    assert document["status"] == "failed"
    assert "secret" not in document["error"]
    assert client.post("/api/retrieval", json={"question": "security"}).json()["sources"] == []
    monkeypatch.setattr(client.vectors, "add", original)
    assert client.post("/api/documents/" + document["id"] + "/reindex").json()["status"] == "indexed"


def test_readiness_reports_real_dependency_failure(client, monkeypatch):
    def fail():
        raise ConnectionError("private address")

    monkeypatch.setattr(client.vectors, "ready", fail)
    response = client.get("/api/readiness")
    assert response.status_code == 503
    assert response.json()["checks"]["qdrant"] is False
    assert "private" not in response.text


def test_cors_and_invalid_analytics_window(client):
    response = client.options("/api/documents", headers={"Origin": "http://localhost:5173", "Access-Control-Request-Method": "POST"})
    assert response.headers["access-control-allow-origin"] == "http://localhost:5173"
    assert client.get("/api/analytics?days=8").status_code == 422


def test_mime_mismatch_and_error_sanitization(client):
    response = client.post("/api/documents", files={"file": ("policy.md", b"hello", "application/pdf")})
    assert response.status_code == 422
    assert "Content type" in response.json()["detail"]
    assert client.get("/docs", follow_redirects=False).headers["location"] == "/api/docs"


def test_embedding_artifact_drift_is_rejected(client):
    document = upload(client)
    client.vectors.embeddings.revision = "different-artifact"
    response = client.post("/api/retrieval", json={"question": "incident security commander"})
    assert response.status_code == 409
    assert "artifact changed" in response.json()["detail"]
    assert client.get("/api/documents/" + document["id"]).json()["status"] == "indexed"


def test_rate_limit_applies_and_health_stays_available(client, monkeypatch):
    from app import security

    settings = client.settings
    settings.rate_limit_per_minute = 2
    monkeypatch.setattr(security, "get_settings", lambda: settings)
    assert client.get("/api/documents").status_code == 200
    assert client.get("/api/documents").status_code == 200
    response = client.get("/api/documents")
    assert response.status_code == 429
    assert response.headers["retry-after"] == "60"
    assert client.get("/api/health").status_code == 200


def test_provider_failure_is_safe_and_does_not_invent_answer(client, monkeypatch):
    upload(client)
    conversation = client.post("/api/conversations", json={}).json()

    def fail(*args):
        raise ValueError("private provider body and secret")

    monkeypatch.setattr("app.routes.answer", fail)
    response = client.post(
        f"/api/conversations/{conversation['id']}/messages", json={"question": "incident security commander", "score_threshold": 0.1}
    )
    assert response.status_code == 503
    assert "secret" not in response.text and "private" not in response.text
    assert client.get("/api/conversations/" + conversation["id"]).json()["messages"] == []
    assert client.get("/api/analytics").json()["queries"] == 1


def test_heading_title_and_stored_chunk_inspector(client):
    document = upload(client, content=b"# Synthetic Security Policy\n\nNotify the incident commander.")
    assert document["title"] == "Synthetic Security Policy"
    assert document["page_count"] == 1
    assert document["updated_at"]
    detail = client.get("/api/documents/" + document["id"]).json()
    assert detail["chunks"][0]["text"] == detail["text"]
    result = client.post("/api/retrieval", json={"question": "incident commander", "score_threshold": 0}).json()
    assert result["trace"]["question"] == "incident commander"
