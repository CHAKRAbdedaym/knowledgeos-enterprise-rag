"""Provider tests mock HTTP only; production adapters remain real HTTP calls."""

import json
from types import SimpleNamespace
import httpx
import pytest
from app.config import Settings
from app.generation import ABSTENTION, SYSTEM_PROMPT, answer

SOURCES = [{"title": "Synthetic security policy", "text": "Escalate within fifteen minutes."}]


def mock_provider(monkeypatch, payload, provider="openai"):
    captured = []

    class Client:
        def __init__(self, **kwargs):
            pass

        def __enter__(self):
            return self

        def __exit__(self, *args):
            pass

        def post(self, url, **kwargs):
            captured.append((url, kwargs))
            raw = json.dumps(payload)
            data = {"choices": [{"message": {"content": raw}}]} if provider == "openai" else {"message": {"content": raw}}
            return httpx.Response(200, json=data, request=httpx.Request("POST", url))

    monkeypatch.setattr("app.generation.httpx.Client", Client)
    return captured


@pytest.mark.parametrize("provider", ["openai", "ollama"])
def test_grounded_adapter_uses_evidence_and_bounded_history(monkeypatch, provider):
    captured = mock_provider(
        monkeypatch, {"answer": "Escalate within fifteen minutes [1].", "citations": [1], "insufficient_evidence": False}, provider
    )
    settings = Settings(llm_provider=provider, llm_model="test-model", openai_api_key="test-secret")
    history = [SimpleNamespace(role="user", content="a" * 5000) for _ in range(10)]
    content, mode = answer("When should I escalate?", SOURCES, history, settings)
    assert mode == "grounded" and "[1]" in content
    messages = captured[0][1]["json"]["messages"]
    assert len(messages) == 8
    assert len(messages[1]["content"]) == 1500
    assert messages[0]["content"] == SYSTEM_PROMPT
    assert "untrusted_evidence" in messages[-1]["content"]
    if provider == "openai":
        assert captured[0][1]["headers"]["Authorization"] == "Bearer test-secret"
    else:
        assert captured[0][0].endswith("/api/chat")


@pytest.mark.parametrize(
    "payload",
    [
        {"answer": "Uncited answer", "citations": []},
        {"answer": "Invalid [3]", "citations": [3]},
        {"answer": "Valid [1] and invalid [99]", "citations": [1]},
        {"answer": "No inline citation", "citations": [1]},
        {"answer": "Unknown", "citations": [1], "insufficient_evidence": True},
    ],
)
def test_unsupported_or_invalid_citations_abstain(monkeypatch, payload):
    mock_provider(monkeypatch, payload)
    settings = Settings(llm_provider="openai", llm_model="test-model", openai_api_key="secret")
    assert answer("question", SOURCES, [], settings) == (ABSTENTION, "abstained")


def test_empty_evidence_never_calls_provider(monkeypatch):
    captured = mock_provider(monkeypatch, {})
    settings = Settings(llm_provider="openai", llm_model="test-model", openai_api_key="secret")
    assert answer("question", [], [], settings)[1] == "abstained"
    assert captured == []
