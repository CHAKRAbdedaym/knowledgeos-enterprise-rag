"""Immutable model provenance checks without network access or model downloads."""

import pytest
from app.config import Settings
from app.retrieval import LocalEmbeddings


def test_corrupt_pinned_model_cache_is_rejected_before_loading(tmp_path):
    snapshot = tmp_path / "models--Qdrant--all-MiniLM-L6-v2-onnx" / "snapshots" / "d13954661f83248295ba75c1ed411eef3b7b936e"
    snapshot.mkdir(parents=True)
    for filename in ["config.json", "tokenizer.json", "tokenizer_config.json", "special_tokens_map.json"]:
        (snapshot / filename).write_text("{}")
    (snapshot / "model.onnx").write_bytes(b"corrupted model bytes")
    embeddings = LocalEmbeddings(Settings(model_cache_dir=tmp_path))
    with pytest.raises(RuntimeError, match="checksum mismatch"):
        embeddings.load()
    assert embeddings._model is None
    assert embeddings.revision == "not-loaded"


def test_model_and_chunk_schema_configuration_constraints():
    with pytest.raises(ValueError, match="collection schema"):
        Settings(embedding_model="another-model")
    with pytest.raises(ValueError, match="chunk_overlap"):
        Settings(chunk_size=200, chunk_overlap=200)
    with pytest.raises(ValueError, match="OPENAI_API_KEY"):
        Settings(llm_provider="openai", openai_api_key="", llm_model="some-model")


def test_embedding_normalization_preserves_original_input(monkeypatch):
    import numpy as np
    captured = []

    class Encoder:
        def embed(self, texts, batch_size):
            captured.extend(texts)
            return [np.zeros(384) for _ in texts]

    embeddings = LocalEmbeddings(Settings())
    monkeypatch.setattr(embeddings, "load", lambda: Encoder())
    source = "  Remote\n work\tpolicy  "
    assert len(embeddings.embed_documents([source])[0]) == 384
    assert captured == ["Remote work policy"]
    assert source == "  Remote\n work\tpolicy  "
