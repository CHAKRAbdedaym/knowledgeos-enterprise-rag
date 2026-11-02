# Security and privacy boundaries

KnowledgeOS is a **local, single-enterprise portfolio demonstration**, not a production multi-user service. Its included IAWEB.DEV policies and identities are fictional. Do not use this installation for real employee, client, confidential or regulated information.

## Administrator access

Administrator sessions, Argon2id passwords, CSRF and server-side route authorization are now enforced. Bootstrap is interactive, with no default credentials. See [ADMIN_AUTH.md](ADMIN_AUTH.md) for cookie/HTTPS requirements, limits and setup. The authenticated admin has access to the single company corpus; employee and integration permissions are enforced as described below.

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

The implemented integration/document permissions do not constitute multi-tenant isolation. Before a real deployment, review these controls and add an actual corporate identity provider and tenant boundaries if needed. Add TLS, secret management, authenticated Qdrant/PostgreSQL networks, encrypted disks/backups, auditable access and retention policies. Put a durable rate limiter and request-size limits at the edge; do not trust arbitrary forwarded IP headers. Isolate parsers with memory/time limits and malware scanning. Use ingestion workers, transactional outbox/reconciliation and deployment migrations separate from API replicas. Establish monitoring, dependency update procedures, incident response and restore drills. Evaluate prompt injection, multilingual retrieval, near-topic unsupported questions and source faithfulness with a representative reviewed dataset.

CORS is not authentication. Localhost binding reduces exposure but does not replace authorization. This repository makes no claim of production security certification, guaranteed hallucination prevention or authentic company data.


## Enterprise authorization controls (implemented)

- Permanent integration secrets are random and stored as hashes, with expiry, endpoint scopes, revocation and transactional rotation. Only issuance returns the secret. Server-key requests reject browser Origin/fetch headers.
- A trusted portal server attests the subject after its own authentication. Browser tokens are opaque, hashed, short-lived and bound to that integration, employee, key and exact Origin. No permanent key is distributed in the widget.
- SQL-backed per-integration/employee rate buckets apply to employee API traffic. Credential metadata records last use; security audits record lifecycle actions without secrets/messages.
- Documents default to admin-only. Explicit integration selection and document publication are both required. Qdrant filters before top-k; authoritative SQL passages are checked before prompts. History and source endpoints enforce the same rights.
- Employee query text is redacted in analytics logs; aggregate activity includes actual counts, outcome modes and latency. Administrator playground history remains separate. Persistent employee messages do contain content: retention/encryption policies remain a deployment responsibility.
- Local admin uses localhost, portal uses 127.0.0.1: cookies are hostname-scoped, not port-scoped. Production needs separate HTTPS hostnames, host-only cookies and a real portal identity/session implementation.

The fictional portal's fixed persona selector and process-local sessions are demonstration mechanisms only. Stolen integration keys allow subject impersonation within their scope. Stolen browser tokens remain usable until expiry or key/integration revocation. XSS on a trusted portal can steal in-memory tokens. Prompt instructions/citation validation cannot guarantee absence of hallucinations or prompt injection. No certification, penetration test, MFA/SSO for admins, complete erasure policy or multi-tenant security claim is made.
