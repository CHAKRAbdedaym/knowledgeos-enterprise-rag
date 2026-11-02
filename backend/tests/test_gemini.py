import json
import secrets
from datetime import datetime, timedelta, timezone
from email.utils import format_datetime
from types import SimpleNamespace
import httpx
import pytest
from app.config import Settings
from app.generation import answer, ABSTENTION
from app.gemini import ProviderError, retry_seconds


def settings():
    return Settings(llm_provider="gemini", llm_model="gemini-3.5-flash-lite", gemini_api_key=secrets.token_urlsafe(32))


def respond(payload=None, status=200, headers=None):
    payload = (
        payload
        if payload is not None
        else {
            "candidates": [
                {
                    "finishReason": "STOP",
                    "content": {
                        "parts": [{"text": json.dumps({"answer": "Three days [1]", "citations": [1], "insufficient_evidence": False})}]
                    },
                }
            ],
            "usageMetadata": {"promptTokenCount": 25, "candidatesTokenCount": 10, "totalTokenCount": 35, "secret_field": "ignored"},
        }
    )
    return httpx.Response(status, json=payload, headers=headers)


def mock_client(monkeypatch, handler):
    original = httpx.Client

    def factory(*args, **kwargs):
        return original(*args, **kwargs, transport=httpx.MockTransport(handler))

    monkeypatch.setattr("app.gemini.httpx.Client", factory)


SOURCES = [{"title": "Synthetic policy", "text": "Up to three remote days with approval."}]


def test_real_adapter_contract_grounding_and_usage(monkeypatch):
    cfg = settings()
    requests = []

    def handler(request):
        requests.append(request)
        assert str(request.url) == "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent"
        assert cfg.gemini_api_key not in str(request.url)
        assert request.headers["x-goog-api-key"] == cfg.gemini_api_key
        body = json.loads(request.content)
        assert "untrusted" in body["systemInstruction"]["parts"][0]["text"]
        assert "Up to three remote days" in json.dumps(body["contents"])
        assert body["generationConfig"]["responseFormat"]["text"]["schema"]["required"] == ["answer", "citations", "insufficient_evidence"]
        assert body["contents"][0]["role"] == "model"
        return respond()

    mock_client(monkeypatch, handler)
    metadata = {}
    result = answer("What is the remote policy?", SOURCES, [SimpleNamespace(role="assistant", content="Prior context")], cfg, metadata)
    assert result == ("Three days [1]", "grounded") and len(requests) == 1
    assert metadata["usage"] == {"promptTokenCount": 25, "candidatesTokenCount": 10, "totalTokenCount": 35}


def test_empty_evidence_never_calls_gemini(monkeypatch):
    mock_client(monkeypatch, lambda request: pytest.fail("No provider call with empty evidence"))
    assert answer("Unknown", [], [], settings()) == (ABSTENTION, "abstained")


@pytest.mark.parametrize(
    "payload",
    [
        {"answer": "Invented [2]", "citations": [2], "insufficient_evidence": False},
        {"answer": "Missing marker", "citations": [1], "insufficient_evidence": False},
        {"answer": "Unsupported", "citations": [], "insufficient_evidence": True},
        ["unexpected list"],
    ],
)
def test_invalid_citations_or_abstention(monkeypatch, payload):
    mock_client(
        monkeypatch,
        lambda request: respond({"candidates": [{"finishReason": "STOP", "content": {"parts": [{"text": json.dumps(payload)}]}}]}),
    )
    assert answer("question", SOURCES, [], settings())[1] == "abstained"


def test_quota_retry_honors_retry_after_and_is_bounded(monkeypatch):
    calls = []
    delays = []

    def handler(request):
        calls.append(1)
        return respond(status=429, headers={"Retry-After": "1"})

    mock_client(monkeypatch, handler)
    monkeypatch.setattr("app.gemini.time.sleep", delays.append)
    with pytest.raises(ProviderError) as exc:
        answer("question", SOURCES, [], settings())
    assert exc.value.status_code == 429 and len(calls) == 3 and delays == [1, 1]
    assert "x-goog" not in str(exc.value)


def test_long_retry_after_fails_fast_instead_of_ignoring_quota(monkeypatch):
    calls = []

    def handler(request):
        calls.append(1)
        return respond(status=429, headers={"Retry-After": "3600"})

    mock_client(monkeypatch, handler)
    monkeypatch.setattr("app.gemini.time.sleep", lambda _: pytest.fail("Should surface retry delay, not block for an hour"))
    with pytest.raises(ProviderError) as exc:
        answer("question", SOURCES, [], settings())
    assert exc.value.status_code == 429 and len(calls) == 1


def test_transient_error_can_retry_then_succeed(monkeypatch):
    calls = []

    def handler(request):
        calls.append(1)
        return respond(status=503) if len(calls) == 1 else respond()

    mock_client(monkeypatch, handler)
    delays = []
    monkeypatch.setattr("app.gemini.time.sleep", delays.append)
    assert answer("question", SOURCES, [], settings())[1] == "grounded"
    assert len(calls) == 2 and 0.25 <= delays[0] <= 0.4


@pytest.mark.parametrize("status", [400, 401, 403, 404])
def test_access_and_model_errors_are_safe_and_not_retried(monkeypatch, status):
    calls = []

    def handler(request):
        calls.append(1)
        return respond({"error": {"message": "Never reflect upstream private details"}}, status=status)

    mock_client(monkeypatch, handler)
    with pytest.raises(ProviderError) as exc:
        answer("question", SOURCES, [], settings())
    assert len(calls) == 1 and str(exc.value) == "Generation provider unavailable"


@pytest.mark.parametrize("failure", [httpx.ReadTimeout("private request"), httpx.ConnectError("private location")])
def test_timeout_and_transport_failures_are_safe(monkeypatch, failure):
    def handler(request):
        raise failure

    mock_client(monkeypatch, handler)
    with pytest.raises(ProviderError) as exc:
        answer("question", SOURCES, [], settings())
    assert exc.value.status_code in {503, 504}
    assert "private" not in str(exc.value)


@pytest.mark.parametrize(
    "payload",
    [
        {"promptFeedback": {"blockReason": "SAFETY"}},
        {"candidates": [{"finishReason": "MAX_TOKENS", "content": {"parts": [{"text": "partial"}]}}]},
        {"candidates": []},
    ],
)
def test_blocked_missing_and_truncated_results_fail_safely(monkeypatch, payload):
    mock_client(monkeypatch, lambda request: respond(payload))
    with pytest.raises(ProviderError):
        answer("question", SOURCES, [], settings())


def test_retry_after_dates_and_invalid_values():
    value = format_datetime(datetime.now(timezone.utc) + timedelta(seconds=30))
    assert 28 <= retry_seconds(value) <= 30
    assert retry_seconds("nonsense") is None
    assert retry_seconds("-5") is None
    assert retry_seconds("inf") is None
