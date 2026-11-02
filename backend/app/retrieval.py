"""Real ONNX embeddings and LangChain Qdrant storage; no simulated production path."""

import hashlib
import logging
from functools import lru_cache
from threading import Lock
from time import perf_counter

from langchain_core.documents import Document as LCDocument
from langchain_core.embeddings import Embeddings
from langchain_qdrant import QdrantVectorStore
from qdrant_client import QdrantClient, models

from app.config import Settings, get_settings

logger = logging.getLogger(__name__)


class LocalEmbeddings(Embeddings):
    def __init__(self, settings: Settings):
        self.settings = settings
        self._model = None
        self._lock = Lock()
        self.revision = "not-loaded"

    def load(self):
        with self._lock:
            if self._model is None:
                from fastembed import TextEmbedding
                from huggingface_hub import snapshot_download

                import pathlib

                revision = "d13954661f83248295ba75c1ed411eef3b7b936e"
                required_files = ["config.json", "tokenizer.json", "tokenizer_config.json", "special_tokens_map.json", "model.onnx"]
                cached = self.settings.model_cache_dir / "models--Qdrant--all-MiniLM-L6-v2-onnx" / "snapshots" / revision
                if all((cached / name).is_file() for name in required_files):
                    snapshot = str(cached)
                else:
                    snapshot = snapshot_download(
                        repo_id="Qdrant/all-MiniLM-L6-v2-onnx",
                        revision=revision,
                        cache_dir=str(self.settings.model_cache_dir),
                        allow_patterns=required_files,
                    )
                artifact = pathlib.Path(snapshot) / "model.onnx"
                digest = hashlib.sha256()
                with artifact.open("rb") as stream:
                    for block in iter(lambda: stream.read(1024 * 1024), b""):
                        digest.update(block)
                actual = digest.hexdigest()
                if actual != "bbd7b466f6d58e646fdc2bd5fd67b2f5e93c0b687011bd4548c420f7bd46f0c5":
                    raise RuntimeError("Embedding artifact checksum mismatch")
                model = TextEmbedding(model_name=self.settings.embedding_model, specific_model_path=snapshot, threads=2)
                self.revision = "sha256:" + actual
                self._model = model
        return self._model

    def embed_documents(self, texts: list[str]) -> list[list[float]]:
        return [v.tolist() for v in self.load().embed([" ".join(text.split()) for text in texts], batch_size=32)]

    def embed_query(self, text: str) -> list[float]:
        return self.embed_documents([text])[0]


class VectorService:
    def __init__(self, settings: Settings, client=None, embeddings=None):
        self.settings = settings
        self.client = client or QdrantClient(
            url=settings.qdrant_url, api_key=settings.qdrant_api_key, timeout=10, check_compatibility=False
        )
        self.embeddings = embeddings or LocalEmbeddings(settings)
        self._store = None
        self.lock = Lock()

    @property
    def revision(self):
        return getattr(self.embeddings, "revision", "test-double")

    def ensure_embeddings(self):
        if hasattr(self.embeddings, "load"):
            self.embeddings.load()

    def ready(self):
        self.client.get_collections()
        return True

    def store(self):
        with self.lock:
            if self._store is None:
                name = self.settings.qdrant_collection
                if not self.client.collection_exists(name):
                    self.client.create_collection(
                        name, vectors_config=models.VectorParams(size=self.settings.embedding_dimension, distance=models.Distance.COSINE)
                    )
                self._store = QdrantVectorStore(client=self.client, collection_name=name, embedding=self.embeddings)
        return self._store

    def add(self, document, chunks):
        texts = [
            LCDocument(
                page_content=c.text,
                metadata={
                    "document_id": document.id,
                    "title": document.title,
                    "chunk_id": c.id,
                    "page": c.page,
                    "start_offset": c.start_offset,
                    "end_offset": c.end_offset,
                    "embedding_model": self.settings.embedding_model,
                },
            )
            for c in chunks
        ]
        store = self.store()
        for start in range(0, len(texts), 32):
            store.add_documents(texts[start : start + 32], ids=[c.id for c in chunks[start : start + 32]])

    def delete(self, document_id: str):
        if self.client.collection_exists(self.settings.qdrant_collection):
            self.client.delete(
                collection_name=self.settings.qdrant_collection,
                points_selector=models.FilterSelector(
                    filter=models.Filter(
                        must=[models.FieldCondition(key="metadata.document_id", match=models.MatchValue(value=document_id))]
                    )
                ),
                wait=True,
            )

    def search(self, question, top_k, threshold, document_ids=None):
        if not self.client.collection_exists(self.settings.qdrant_collection):
            return []
        if document_ids is not None and not document_ids:
            return []
        acl = None if document_ids is None else models.Filter(must=[models.FieldCondition(key="metadata.document_id", match=models.MatchAny(any=list(document_ids)))])
        results = self.store().similarity_search_with_score(question, k=top_k, score_threshold=threshold, filter=acl)
        return [
            {
                **{key: doc.metadata.get(key) for key in ["document_id", "title", "chunk_id", "page", "start_offset", "end_offset"]},
                "text": doc.page_content,
                "score": round(float(score), 6),
            }
            for doc, score in results
        ]


@lru_cache
def get_vectors():
    return VectorService(get_settings())


def retrieve(question, top_k, threshold, vectors, settings):
    start = perf_counter()
    sources = vectors.search(question, top_k, threshold)
    elapsed = round((perf_counter() - start) * 1000)
    trace = {
        "question": question,
        "latency_ms": elapsed,
        "retrieval_ms": elapsed,
        "provider": settings.llm_provider,
        "model": (settings.llm_model or None) if settings.llm_provider != "none" else None,
        "top_k": top_k,
        "score_threshold": threshold,
        "matched_chunks": len(sources),
        "embedding_model": settings.embedding_model,
        "embedding_revision": vectors.revision,
    }
    return sources, trace
