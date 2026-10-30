# Implementation plan and scope

KnowledgeOS is a reconstructed, single-user portfolio application inspired by an internship experience. It is not an actual deployed IAWEB.DEV client system. All included organizational content is fictional.

## Architecture decisions before implementation

- React/TypeScript SPA with a persistent navigation shell and six routes: Overview, Research, Knowledge Base, Intelligence, Architecture, Settings.
- FastAPI owns the API contract, upload validation, ingestion, retrieval, generation and usage recording. PostgreSQL owns metadata and conversation history. Qdrant owns embeddings.
- Establish real upload → extraction → overlapping chunks → local MiniLM embeddings → Qdrant → cited retrieval before presentation work.
- FastEmbed ONNX is the local embedding runtime: CPU friendly and avoids bundling a large GPU/PyTorch stack. LangChain's current Qdrant integration is the actual vector store abstraction.
- Retrieval-only is the default. External generation is opt-in server configuration. A missing or failing provider must never silently produce a fabricated answer.
- Bounded synchronous ingestion and request/response chat are deliberate single-user demo tradeoffs. No pretend progress or token streaming.
- Alembic migrations initialize schema; persistent named volumes retain metadata, vectors, originals and model files.
- Localhost-only published ports. No authentication claims or external deployment.

## Interface hierarchy

The graphite sidebar anchors product identity and navigation. The soft light canvas has a restrained indigo focus, a clear page title/action row, useful summary panels and denser supporting records. Each screen handles first-run empty content, pending operations, errors, and populated data. Sources and current provider mode remain visible in research. Dark theme and narrow layouts retain the same hierarchy.

## Work ownership

Backend/RAG and tests; frontend/design and component tests; synthetic corpus and French interview material run as focused delegated work. The master agent owns integration, infrastructure, independent acceptance checks, evidence, architecture documentation and final Git audit.

## Acceptance evidence

Execution results belong in TESTING.md after execution. Planned tests are never presented as passed. Provider generation requires separately configured credentials; deterministic tests do not constitute a live provider verification.
