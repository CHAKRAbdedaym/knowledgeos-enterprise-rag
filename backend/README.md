# KnowledgeOS API

Python 3.13, FastAPI, SQLAlchemy/Alembic, LangChain QdrantVectorStore, and local FastEmbed ONNX MiniLM. The default `LLM_PROVIDER=none` returns passages with an explicit retrieval-only message; it never generates a pretend answer.

```sh
python -m venv .venv
. .venv/bin/activate
pip install -r requirements-dev.txt
alembic upgrade head
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

Run these commands from `backend/`. Settings load environment variables and a local `.env`; the repository root Compose setup supplies its environment directly. The first upload downloads the ONNX model (approximately 90 MB); subsequent requests reuse `MODEL_CACHE_DIR`. Keep this cache persistent. `UPLOAD_DIR` stores original uploads under generated UUID filenames. Database and Qdrant must be available. Deployment always runs migrations, never `create_all`.

Interactive OpenAPI is `/api/docs` (`/docs` redirects). Liveness is `/api/health`; `/api/readiness` checks real Qdrant connectivity and a migrated database schema. API errors use `{detail, error:{code,message,details}}`. Uploads are synchronous and return an `indexed` or recoverable `failed` document. Retrying `/api/documents/{id}/reindex` rebuilds its vectors. Hash duplicates return 409. Deletion removes Qdrant points, relational chunks, metadata, and the original file.

Documents accept UTF-8 `.txt`, `.md`, and text-based `.pdf`. Both MIME types and signatures are checked; files are limited to 10 MB by default, 500 PDF pages, and one million extracted characters. Scanned documents require OCR before upload. PDF parsing uses BSD-licensed `pypdf`. Plain text does not have a page number. Chunk offsets refer to the exact stored document text, including two newlines between PDF pages.

The model is `sentence-transformers/all-MiniLM-L6-v2`, 384-dimensional cosine similarity, through CPU ONNX Runtime rather than PyTorch. The download pins upstream snapshot `d13954661f83248295ba75c1ed411eef3b7b936e` and verifies the expected ONNX SHA-256 before loading. `embedding_revision` records the SHA-256 of those bytes. It is `not-loaded` until initial use. Existing indexed document revisions are checked before retrieval and indexing to prevent mixing model artifacts. Changing models or dimensions requires an explicit collection/schema migration. Chunk size defaults to 900 characters with 150-character overlap; MiniLM has a 256-token context limit, so token-dense input may be truncated by the embedding model. Scores are cosine similarities rather than answer confidence.

For generated answers, set `LLM_PROVIDER=openai`, `LLM_MODEL` to a JSON-mode-compatible chat model, and `OPENAI_API_KEY`; or set `LLM_PROVIDER=ollama`, `LLM_MODEL`, and `OLLAMA_URL`. OpenAI uses the official Chat Completions endpoint; Ollama uses `/api/chat`. Evidence is numbered and bounded to at most ten 1000-character chunks. History is limited to six messages of 1500 characters. The system prompt treats document text and history as untrusted. Responses without valid citation numbers, inline citations, or sufficient evidence abstain. Citation validation cannot prove semantic entailment; evaluate the selected provider before relying on its answers. Provider failures return a sanitized 503, without substituting an invented answer.

```sh
pytest -q
ruff check app tests migrations
TEST_QDRANT_URL=http://localhost:6333 pytest -q tests/test_api_deterministic.py
TEST_DATABASE_URL=postgresql+psycopg://user:password@localhost:5432/isolated_test pytest -q -m integration
```

Default API tests migrate a fresh SQLite database through Alembic, use deterministic **test-only** token embeddings, and exercise the actual Qdrant local engine and LangChain store. Provider tests mock HTTP responses. They validate contracts, cleanup, provenance, abstention, and adapters; they do not measure model quality. Set `TEST_QDRANT_URL` to run the same suite against a server. PostgreSQL tests validate real migration compatibility and drift. Real model/provider smoke tests should be run separately with the intended model cache, corpus, and API credentials.

This is a local, single-worker portfolio deployment with an in-memory per-IP request limiter and process-local mutation lock. Authentication, tenant isolation, cross-worker rate limiting, distributed ingestion queues, and production operational hardening are outside this demo. Do not expose it to untrusted networks or upload confidential material. Query logs store questions for local analytics; delete/reset local volumes to clear demo history.

`requirements.in` describes supported dependency ranges; `requirements.txt` locks the resolved runtime dependency tree, and `requirements-dev.txt` adds pinned test tooling. Resolve and test updates together. `app/routes.py` implements HTTP orchestration, `indexing.py` manages ingestion state and cleanup, `retrieval.py` owns embeddings/vector storage, `generation.py` owns provider adapters and grounding checks, and `security.py` owns sanitized errors and request limits.
