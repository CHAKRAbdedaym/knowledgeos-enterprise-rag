# Enterprise integration API — implemented contract

This reference describes the code in `backend/app/enterprise.py`, the existing administrator authentication, and the independently served employee widget. This is a **single-enterprise instance with multiple integration clients**. It does not claim multi-tenant isolation. All included IAWEB.DEV policies and demo identities are synthetic; the portfolio is not an official IAWEB.DEV service.

The provider adapter supports Gemini, but live Gemini access, free-tier availability and quotas are not established by its existence or unit tests. The owner's configured key passed model metadata and genuine grounded-generation checks on 2026-11-02; remaining quota and billing tier are not disclosed by these checks. Use the final testing report for actual executed deployment results.

## Two separate identities and interfaces

| Actor | Authentication | Surface |
|---|---|---|
| Administrator | HttpOnly session cookie, server-side session hash, CSRF on mutations | Admin console and protected historical `/api/...` routes, `/api/admin/...` |
| Portal backend | Permanent integration bearer key + server-attested employee subject | `/api/v1/...` only |
| Employee widget | Short-lived opaque employee bearer token, exact portal Origin | `/api/v1/...` only |

An integration credential does not grant administrator access. Administrator cookies do not substitute for employee credentials. The portal authenticates employees using its own session/SSO and supplies the resolved subject; KnowledgeOS does not independently verify that SSO system. Possession of the permanent integration key authorizes that trusted portal server to attest subjects within its integration. A leaked key therefore compromises that integration's employee boundary and must be revoked.

The permanent key is never browser configuration. Server-key requests containing `Origin` or `Sec-Fetch-Mode` are rejected. This is an additional browser misuse guard, not a replacement for keeping the secret on the server: a non-browser caller with a stolen key can forge headers and subjects.

## Administrator setup and document publication

1. Create your administrator interactively if needed:

   ```sh
   docker compose exec backend python -m app.admin_cli
   ```

2. Open `http://localhost:8080/login` and sign in. No default administrator password exists.
3. Upload documents in **Knowledge Base**, or retain the existing synthetic indexed corpus.
4. Open **Integrations**. Expand **Employee document availability**. Choose **Publish** for documents that employees may use, then confirm **Publish document**. This only makes a document eligible; it does not grant any integration access by itself.
5. Choose **Create integration**, enter its name, exact allowed origins, explicit document selection and request limit. For the example intranet, use **`http://127.0.0.1:8090`**, with no path or trailing slash.
6. Issue a server credential with an expiration. Copy the full secret once into the portal server's secret configuration. Only its prefix and lifecycle metadata remain visible afterward. The UI also supports rotation, revocation, scope editing and disabling an integration.
7. Configure the portal, then use **AI Playground** (`/research`) for administrator experiments and the separate employee portal for integration tests. Playground uses admin access to the corpus; it is not proof that an employee integration has permission.

The two document controls form an intersection:

```text
employee-visible documents =
  explicitly selected IntegrationDocument records
  ∩ documents whose employee_available is true
  ∩ documents whose indexing status is indexed
```

Empty selection means no access. Existing documents receive `employee_available=false` during migration and remain admin-only until explicitly published. New uploads are also admin-only by default. No historical document is automatically exposed to a newly created integration.

## Administrator management endpoints

All routes below require an administrator session; mutations also require trusted Origin and `X-CSRF-Token`.

| Method and route | Implemented behavior |
|---|---|
| GET `/api/admin/integrations` | Integration list with allowed origins, document IDs and key metadata |
| POST `/api/admin/integrations` | Create a default-deny integration |
| PATCH `/api/admin/integrations/{id}` | Update name, enabled state, allowed origins, document IDs or request limit |
| POST `/api/admin/integrations/{id}/keys` | Issue a credential; returns its secret once |
| DELETE `/api/admin/integrations/{id}/keys/{key_id}` | Revoke that credential |
| POST `/api/admin/integrations/{id}/keys/{key_id}/rotate` | Revoke the old key and issue a replacement transactionally |
| PATCH `/api/documents/{id}/access` | Set `{employee_available: true/false}` |
| GET `/api/admin/overview` | Enterprise aggregate activity |
| GET `/api/admin/analytics?days=7` | Same aggregate contract, accepting 7, 30 or 90 days |
| GET `/api/admin/settings` | Secret-free server/runtime settings and configuration status |
| PATCH `/api/admin/settings` | Persist validated retrieval/provider defaults |

Example integration creation body:

```json
{
  "name": "Atlas fictional intranet",
  "allowed_origins": ["http://127.0.0.1:8090"],
  "document_ids": ["DOCUMENT_ID_SELECTED_BY_ADMIN"],
  "rate_limit_per_minute": 60
}
```

Limits: name 1–120 characters; up to ten exact origins; up to 500 document IDs; integration limit 1–600 requests/minute. Non-loopback origins require HTTPS. Unknown document IDs are rejected. Unknown request fields are rejected for integration management, settings, token exchange and query payloads. Explicit null PATCH values are rejected rather than interpreted as permission resets.

Credential issue/rotation body: `{ "expires_in_days": 30 }`, with a permitted lifetime of 1–365 days. The returned `secret` starts with `kos_`; SQL stores its SHA-256 hash, prefix, expiration, revocation and last-used timestamps. Rotation invalidates the old key and all short sessions depending on it on subsequent authorization checks. Revoked keys cannot be rotated again.

Settings support `default_top_k` (1–10), `default_score_threshold` (0–1), `llm_provider` (`none`, `gemini`, `openai`, `ollama`) and `llm_model`. Server `allowed_llm_providers` and required credentials constrain what can be activated. No setting accepts or returns provider secrets. Configuration status is not a live billing, quota or model availability probe.

### Credential endpoint scopes

Key issuance accepts `expires_in_days` (1–365, default 30) and `scopes`: any explicit subset of `query`, `conversations`, `sources`, `widget_sessions`. Omitting scopes grants these four capabilities; an empty list grants none. Rotation preserves the old scopes unless explicitly replaced. Document access remains the integration's current allowlist, independent of endpoint capabilities. Query responses inherently include their authorized passages; omitting `sources` disables direct source lookup, not citations inside query responses. Widget tokens inherit and recheck their issuing key's scopes. Missing capabilities return 403.

No hash is exposed in management responses. An expiration cannot be extended implicitly by widget token issuance. Revoking/disabling the issuing credential invalidates existing tokens on subsequent requests.

## Server-to-server identity flow

For ordinary v1 requests from a trusted portal backend:

```http
Authorization: Bearer <server-side integration secret>
X-Employee-Subject: <subject resolved from the authenticated portal session>
Content-Type: application/json
```

The subject must be nonblank, trimmed and at most 160 characters. It is mapped to a SQL employee record unique within the integration. Do not copy a freely supplied browser employee ID into this header. Derive it from your authenticated server-side identity provider/session.

Do not include browser `Origin` or `Sec-Fetch-Mode` headers in these server-key calls. Do not put permanent keys in curl command history, documentation, URLs or client-side source. Use your server's secret manager or local environment and an HTTP client that does not log request credentials.

### Short-lived widget session exchange

Only a server integration key can call this endpoint; an existing employee token cannot issue another token.

```http
POST /api/v1/widget-sessions
Authorization: Bearer <server-side integration secret>
Content-Type: application/json
```

```json
{
  "subject": "subject-resolved-by-the-portal-server",
  "origin": "http://127.0.0.1:8090"
}
```

The origin must exactly match one configured for this integration. The response contract is:

```json
{
  "access_token": "kws_<opaque-short-lived-value>",
  "expires_at": "<UTC ISO-8601 expiration>",
  "expires_in": 299
}
```

Values shown are placeholders illustrating field names and types, not a captured successful request or a usable credential. The actual lifetime is at most five minutes and cannot outlast the issuing key. SQL stores only the token hash and its integration, key, employee, origin and expiration. Every request rechecks key expiry/revocation, integration enabled state and current origin permission.

The widget keeps the bearer in memory and sends:

```http
Authorization: Bearer <short-lived employee token>
Origin: http://127.0.0.1:8090
```

The browser sets Origin automatically. Changing request JSON or `X-Employee-Subject` cannot change a widget token's bound identity. Refresh goes through the authenticated portal backend, not an anonymous browser exchange endpoint. Bearer tokens are not replay-proof: a stolen token is usable within its remaining permissions and lifetime until expiry or parent-key/integration revocation.

## Employee endpoint reference

All routes below are under `/api/v1` and require either the trusted server identity above or a valid widget token, except `/widget-sessions`, which specifically requires the server key.

| Method and path | Body | Result |
|---|---|---|
| GET `/capabilities` | None | Integration name, configured mode/model, embedding model, language limitation and capabilities |
| POST `/query` | Question payload | Answer without creating a conversation; a query event is still recorded |
| GET `/conversations` | None | Only the current integration/employee's accessible conversation summaries |
| POST `/conversations` | `{ "title": "Remote work research" }` | New owned conversation summary, HTTP 201 |
| GET `/conversations/{id}` | None | Owned conversation with messages, sources and traces |
| DELETE `/conversations/{id}` | None | `{ "deleted": true }`; messages deleted for that owner |
| POST `/conversations/{id}/messages` | Question payload | Persisted question/answer, HTTP 201 |
| GET `/sources/{id}` | None | Authorized chunk text and current SQL metadata; `{id}` is the **chunk ID** |

There is no `/api/v1/health` endpoint. Use `/capabilities` to inspect authenticated integration capabilities. The public `/api/health` is minimal process liveness; detailed `/api/readiness` remains administrator-only. There is no employee conversation rename endpoint in this implementation.

Question payload:

```json
{
  "question": "What is our remote work policy?",
  "top_k": 5,
  "score_threshold": 0.3
}
```

`question` is nonblank and at most 2,000 characters. Optional retrieval overrides use the schema's bounds (top_k 1–10, threshold 0–1); omitted values use effective server/runtime defaults. An employee/document scope field is not accepted as a way to enlarge permissions.

Successful answer structure:

```json
{
  "conversation_id": "<owned conversation UUID, or null for /query>",
  "answer": "<generated answer, retrieval-only notice, or abstention>",
  "mode": "retrieval_only",
  "sources": [
    {
      "document_id": "<authorized document UUID>",
      "title": "Leave, absence and remote work",
      "chunk_id": "<authorized chunk UUID>",
      "text": "<the actual SQL-backed source passage>",
      "score": 0.82,
      "page": null,
      "start_offset": 0,
      "end_offset": 900
    }
  ],
  "request_id": "<request UUID>",
  "latency_ms": 123
}
```

This is a schema illustration. The passage, score, offsets and latency must come from an executed request; this example is not measured evidence. The real source field is **`text`**, not `excerpt`. A similarity score indicates vector proximity, not probability of correctness.

Modes:

- `retrieval_only`: actual passages, with an explicit generation-disabled notice.
- `grounded`: provider output accepted by citation validation.
- `abstained`: no retrieved evidence or provider output rejected as unsupported/invalid under the implemented checks.
- Provider failure: an HTTP error, not a successful invented answer; an event records `provider_error`.

## Authorization during retrieval and history access

Before vector search, SQL resolves the permitted document IDs. Qdrant receives a document-ID filter **inside the top-k search**. With no permitted IDs, it performs no unrestricted fallback search.

After retrieval, SQL is consulted again. The backend checks the returned chunk exists, its document is permitted, and the payload document/chunk association matches. Source text, title, page and offsets are rebuilt from authoritative SQL rather than trusting Qdrant payload text. Only these passages enter the generation prompt.

Conversation access requires both matching `integration_id` and `employee_id`. Existing administrator conversations have neither and are inaccessible through v1. Revoking/removing a document causes histories containing its source snapshot to become unavailable: read and further message operations return 404, and those histories are omitted from the employee list. This prevents old source/answer snapshots bypassing the new scope. The same owner may still delete an inaccessible historical conversation.

`GET /sources/{chunk_id}` checks current permissions again. The widget rechecks that endpoint when a citation is expanded. Permissions are also rechecked after generation, before returning/persisting the result: a revoked key, expired widget session or newly restricted document fails closed. Content already delivered to a client cannot be recalled from that client's memory or screenshots.

## Errors and rate limits

Safe errors use the existing envelope:

```json
{
  "detail": "Resource unavailable",
  "error": {
    "code": "http_404",
    "message": "Resource unavailable",
    "details": null
  }
}
```

| Status | Typical meaning |
|---|---|
| 401 | Missing, expired, revoked or wrong-kind credential; missing server-attested subject |
| 403 | Widget origin outside its bound scope, or document access changed during generation |
| 404 | Resource absent or outside the employee's ownership/document scope |
| 409 | Key already revoked on rotation or embedding compatibility conflict |
| 422 | Invalid parameters, unknown fields, explicit-null updates or unavailable selected documents |
| 429 | Integration/employee rate limit or provider quota condition |
| 503 | Provider/dependency/configuration unavailable |
| 504 | Provider request timeout |

Do not parse error wording as a permanent protocol; use status and structured error code. Provider errors include `X-Request-ID`; successful answers include `request_id` in JSON. No raw provider error body, key or internal filesystem path is returned.

Integration and employee counters are persisted atomically in PostgreSQL, with fixed one-minute windows. The employee maximum is `min(integration limit, 60)`; the integration counter covers all its authenticated employees. Token exchange, capabilities, source/history and query requests contribute, not just generated answers. This supplements the existing process-level API/IP limiter. Limiter 429 responses provide `Retry-After`; clients should back off rather than loop. CORS exposes Retry-After and X-Request-ID to allowed employee origins.

## CORS, cookies and host separation

Employee CORS is bearer-only, checks enabled integrations' explicit origin registry, and does not allow browser credentials. Actual authentication still verifies that the token belongs to the integration authorizing that origin; a preflight allowance alone grants no document access. Admin CORS/session policy remains separate.

Locally, use **admin `http://localhost:8080`** and **portal `http://127.0.0.1:8090`**. Cookies are not isolated by port. The distinct loopback hostnames prevent a host-only localhost administrator cookie being sent to the demo portal. In production use distinct admin/intranet hostnames, HTTPS and cookies without a Domain attribute; do not rely on ports or broad parent-domain cookies for separation.

## Audit, privacy and persistence

Employee query events record integration, channel (`api` or `widget`), mode, latency and source IDs while replacing the question with `[employee query redacted]`. Enterprise analytics returns aggregate counts, requests per integration, timeline, latency, no-result/abstention/provider-error counts and recent event metadata without employee question text. Counts are derived from stored events, including admin activity where the endpoint includes it.

Actual question/answer content and source/trace snapshots still persist in the employee-owned conversation. Database operators can access those records. Redacted analytics is not an automatic retention/erasure policy. Security audit events record management actions and responsible IDs without credential secrets. No model accuracy or financial-savings metric is invented.

Migration `0003_enterprise_integrations` adds integration credentials/scopes, employees, widget sessions, runtime settings and security audit tables; conversation ownership fields and query integration/channel metadata are additive. A check constraint requires conversation integration/employee IDs to be both null or both set. The migration marks all existing documents admin-only and preserves their IDs and original vectors. Qdrant filtering reuses the existing document_id payload; no mandatory vector-model replacement or full reindex is required. No destructive automatic downgrade is provided.

## Further documentation and evidence

- [Widget integration and React/HTML examples](WIDGET_INTEGRATION.md)
- [Administrator authentication](ADMIN_AUTH.md)
- [Architecture](ARCHITECTURE.md)
- [Testing record](TESTING.md): use this for executed results; live results are recorded separately from unit-provider mocks.
- [French enterprise interview explanation](ENTERPRISE_INTERVIEW_FR.md)

Future multi-tenant operation requires tenant identity in every authorization boundary, compatible SQL constraints and vector filtering/migration, tests against cross-tenant access, and operational separation. The current integration isolation is within one enterprise and is not advertised as tenant isolation.


Successful answer responses additionally include nullable `generation_ms` and `usage` (allowlisted token counts only) when supplied by Gemini. These fields remain empty for retrieval-only responses and are not cost estimates.
