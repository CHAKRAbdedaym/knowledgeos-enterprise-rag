# Security and privacy boundaries

KnowledgeOS is a **local, single-user portfolio demonstration**, not a production multi-user service. Its included IAWEB.DEV policies and identities are fictional. Do not use this installation for real employee, client, confidential or regulated information.

## Enforced controls

- Compose publishes frontend, API, PostgreSQL and Qdrant on loopback only. Container-network services communicate internally. CORS allows an explicit list of local frontend origins.
- Server configuration, including provider keys, stays on the backend. The configuration endpoint exposes an allowlist of operational fields. `.env`, uploads and model caches are ignored by Git.
- Upload validation checks allowed extensions, MIME compatibility, UTF-8 text and PDF signatures, limits bytes and extracted characters, and rejects empty, encrypted or textless documents. Filenames are display metadata; generated identifiers determine storage paths.
- A content hash prevents duplicate ingestion. Vector deletion precedes metadata deletion; failed operations surface an error and can be retried.
- Markdown rendering does not enable raw HTML. Document instructions are untrusted data in the grounded prompt. Bounded context and numeric citation validation reduce unsupported responses, but cannot guarantee factual correctness.
- The API uses bounded request schemas, per-process rate limiting and safe errors. Documents, questions and provider keys are not intentionally emitted into application logs.

## Data retained locally

PostgreSQL stores extracted text, chunks, chat messages, citations and query events. Qdrant stores vectors and passage payloads. The uploads volume holds originals; the model volume caches public embedding artifacts. Historical messages contain citation snapshots: deleting a document does not erase text already present in previous conversations. Deleting a conversation is not a full query-event retention policy. A full data-erasure workflow is outside this demo's scope.

Retrieval-only processing needs no paid generation API. The initial embedding download contacts the model host. Configuring an external LLM sends the question, selected passages and bounded conversation history to that provider; use only synthetic content and review that provider's terms. Ollama can keep generation local if hosted locally.

## Before a real deployment

Implement identity, tenant authorization and document-level access controls applied **before retrieval**. Add TLS, secret management, authenticated Qdrant/PostgreSQL networks, encrypted disks/backups, auditable access and retention policies. Put a durable rate limiter and request-size limits at the edge; do not trust arbitrary forwarded IP headers. Isolate parsers with memory/time limits and malware scanning. Use ingestion workers, transactional outbox/reconciliation and deployment migrations separate from API replicas. Establish monitoring, dependency update procedures, incident response and restore drills. Evaluate prompt injection, multilingual retrieval, near-topic unsupported questions and source faithfulness with a representative reviewed dataset.

CORS is not authentication. Localhost binding reduces exposure but does not replace authorization. This repository makes no claim of production security certification, guaranteed hallucination prevention or authentic company data.
