# Verification record

This file distinguishes executed checks from planned coverage. All content used in verification is synthetic. A deterministic embedding fixture is used only in tests; the running application uses the pinned MiniLM ONNX model.

## Executed on 2026-10-30

The environment provides Python 3.13, Node 20 for host development, Node 22 for the frontend container, Docker 27.4.1, Compose 2.32.1 and Google Chrome. PostgreSQL 16.13 and Qdrant 1.20.0 run in Docker. Host PostgreSQL port 5432 was already occupied, so this project publishes its database on loopback port 5433 without changing the existing service.

| Check | Evidence / result |
|---|---|
| Default backend pytest | 36 passed, one optional PostgreSQL integration skipped in the default invocation |
| Full backend suite with real Qdrant + PostgreSQL enabled | 37 passed; migrations and schema drift check included |
| Ruff backend checks | Passed |
| Pinned real encoder | Successfully loaded, 384 dimensions, SHA-256 `bbd7b466f6d58e646fdc2bd5fd67b2f5e93c0b687011bd4548c420f7bd46f0c5` |
| Real corpus ingestion | All 20 documents indexed, 100 actual chunks |
| Repeat seeding | All 20 duplicate files skipped; no duplicate vectors created |
| Real API acceptance | 19 checks passed; [machine-readable record](acceptance-results.json) |
| Retrieval evaluation | 17/18 expected-source hits at top-k 5, threshold 0.30; [full measured results](../data/evaluation-results.json) |
| Unsupported evaluation | 3/5 returned no passages; two near-topic questions retrieved related passages that do not establish the requested fact |
| Frontend component tests | Six interaction/regression tests passed after final UI changes |
| Frontend lint, typecheck, build | Passed after final UI changes; npm audit reports zero findings |
| Browser lifecycle | Real upload, reindex, query, source/trace inspection, reload persistence, unsupported-question abstention and delete executed successfully |

Both backend and frontend Docker images built successfully, all four Compose services started, and containerized API readiness reported PostgreSQL and Qdrant ready. The complete Playwright workflow passed against Vite with the real containerized API, including six routes at 768px/390px, persisted theme, and zero captured console errors. The final walkthrough also passed against Nginx at http://localhost:8080 in 25.2 seconds (one complete lifecycle scenario), with populated responsive screenshots and zero captured console errors. This evaluation is a small authored retrieval smoke set, **not model accuracy**, generated-answer faithfulness or a benchmark on client data.

## Reproduce automated checks

```sh
cd backend
.venv/bin/python -m pytest -q
.venv/bin/ruff check app tests migrations
TEST_QDRANT_URL=http://localhost:6333 \
TEST_DATABASE_URL=postgresql+psycopg://knowledgeos:knowledgeos_local_demo@localhost:5433/knowledgeos \
  .venv/bin/python -m pytest -q
```

The default tests use Alembic-migrated isolated SQLite databases, deterministic test-only embeddings, the actual local Qdrant engine and mocked HTTP provider responses. Setting `TEST_QDRANT_URL` exercises the same workflows against real Qdrant collections, each isolated and deleted after the fixture. The PostgreSQL test verifies migrations and schema drift; it does not downgrade or drop the database.

```sh
cd frontend
npm ci
npm run lint
npm run typecheck
npm run test
npm run build
npm audit
# With a running, seeded app; Chrome may be supplied by your machine:
CHROME_PATH=/usr/bin/google-chrome npx playwright test
# Or install the Playwright browser and omit CHROME_PATH:
npx playwright install chromium
npx playwright test
```

Browser base URL defaults to `http://localhost:8080`. Set `E2E_BASE_URL=http://localhost:5173` for the Vite server. The browser test expects the 20-document starter corpus, creates a uniquely named synthetic fixture, deletes that document and leaves a real persisted research conversation. Use a disposable local demo workspace, not private data.

From the root:

```sh
python3 scripts/seed.py
python3 scripts/acceptance.py
python3 scripts/evaluate.py
docker compose config --quiet
docker compose ps
```

Evaluation and acceptance queries contribute to real analytics. There is no fake historical traffic. Acceptance cleans up only its own temporary document/conversation; query events remain. A rerun can therefore increase displayed query counts.

## Defects found and addressed

- Analytics query-string enum coercion was corrected after an API test failure.
- Upload MIME claims and frontend advertised types were aligned to PDF/TXT/MD; unsupported Word uploads are not advertised.
- Questions were limited consistently to 2000 characters.
- A malformed or changed model artifact is rejected; a complete verified model cache can load without network access.
- Every inline numeric citation is checked against returned evidence identifiers.
- A tablet architecture layout overflow was fixed and checked at 768px and 390px.
- Deleting a document no longer refetches its deleted detail endpoint.
- Failed conversation creation keeps the visible error and retry path.
- Replacing a valid upload selection with an unsupported file clears the previous file.
- The synthetic corpus was aligned to English to match the default encoder. Interview material remains French.

An initial real-Qdrant test run during concurrent image builds failed the artifact-drift test after an unsuccessful indexing setup. The isolated rerun and subsequent complete real-Qdrant/PostgreSQL suite both passed (37 tests in the final suite). A failed setup is not treated as a successful drift check.

## Remaining coverage and product limitations

- **No live paid OpenAI or local Ollama generation was invoked.** Provider adapters, grounding prompts, response parsing, invalid citations and provider failure behavior are covered with deterministic HTTP mocks. Configure and test the intended model before presenting generated answers.
- No load benchmark, throughput/SLA claim or large-corpus performance test.
- No scanned-document OCR or exhaustive adversarial PDF corpus.
- No screen-reader audit, formal WCAG assessment or Safari/Firefox browser matrix.
- Near-topic unsupported facts remain a limitation of similarity-based evidence gating. The evaluation keeps these failures visible. Retrieval-only output makes no claim to answer them.
- Citation shape validation does not prove claim-level entailment.
- Administrator authentication is now implemented (see the follow-up below); integration/employee authorization is covered by the later enterprise follow-up; multi-tenant isolation, a production backup restore drill and distributed crash-consistency guarantees remain absent.
- Initial model/dependency downloads required network access. The verified model cache was reused for container testing; this does not independently prove cold downloads on every network.
- A separate independent fresh-clone run was not performed; the Docker builds executed the tracked dependency installation/build steps and initial schema migration was tested.
- GitHub Actions runs on pushes and pull requests after publication. Check [hosted results](https://github.com/CHAKRAbdedaym/knowledgeos-enterprise-rag/actions) for the status of each revision; local results do not substitute for a hosted run.

## Floating assistant follow-up

Added the bottom-right assistant on every route, using the same persisted conversation and RAG endpoints. Frontend lint, typecheck, formatting and production build passed; the component suite now passes eight tests, including quick-chat retry and handoff into Research. The dedicated real-browser scenario passed against the rebuilt Docker frontend: source inspection, keyboard focus/Escape, reload persistence, Research handoff, new-chat reset, 390px mobile bounds and zero captured console errors. Screenshots: [desktop assistant](screenshots/floating-assistant-desktop.png), [mobile assistant](screenshots/floating-assistant-mobile.png). The browser fixture removes its own test conversation afterward; its real query event remains in analytics.

### IAWEB-inspired visual update

After the widget restyle, frontend lint, TypeScript checks, all eight component tests and the production build passed again. The frontend Docker image was rebuilt and deployed locally. `CHROME_PATH=/usr/bin/google-chrome npx playwright test e2e/floating-assistant.spec.ts` passed against that running image, covering the same real retrieval and conversation lifecycle at desktop and mobile widths. A separate Chromium check verified the dark-theme panel fits a 768 × 1024 tablet viewport with no JavaScript page errors. Visual inspection caught a pre-existing root canvas color that stayed light in dark mode; the canvas and default text now use their theme tokens. The [welcome panel](screenshots/floating-assistant-welcome.png) and [dark tablet panel](screenshots/floating-assistant-dark-tablet.png) were captured from the running application and visually inspected. No backend behavior changed in this visual update; the backend suite was not rerun for it.

### Application-wide IAWEB visual update (2026-10-31)

The public IAWEB logo now appears in the desktop sidebar, mobile header and dashboard illustration. Shared styling covers all routes, with white/blue navigation, Space Grotesk headings, blue charts, rounded controls and navy dark-theme surfaces. The original logo’s source and rights are recorded in `THIRD_PARTY_NOTICES.md`.

- `npm run lint`, `npm run typecheck` and formatting checks passed.
- `npm run test`: all eight tests passed. The initial run hit the existing five-second settings-test timeout while a separate browser preview was running; the isolated full-suite rerun passed without changing test timeouts or assertions.
- `docker compose build frontend` passed, including TypeScript and the Vite production build. The frontend was recreated with `docker compose up -d --no-deps frontend`.
- `CHROME_PATH=/usr/bin/google-chrome npx playwright test e2e/workspace.spec.ts e2e/floating-assistant.spec.ts`: two tests passed against port 8080. These exercised upload, reindex, deletion, real retrieval/citations, unsupported-question abstention, conversation reload, floating-chat handoff, all six routes at 768px and 390px, theme persistence and captured console errors.
- Additional Chromium inspection confirmed the original SVG loads on desktop and mobile, headings use Space Grotesk, active navigation is `#2458ff`, mobile navigation opens/closes, and dark-theme canvas/text resolve to the intended contrasting colors. The backdrop check clicks its exposed area outside the drawer; an initial center click was correctly intercepted by the open drawer.
- Current overview, document, research and assistant screenshots were recaptured from the rebuilt container. No backend code changed, so backend tests were not rerun for this update.

### Tab and chatbot logo follow-up

The browser favicon, floating launcher and Research avatars now use the compact IAWEB symbol; the floating-chat header uses the full wordmark. Lint, TypeScript, all eight component tests and the Docker production build passed. The dedicated floating-assistant Playwright scenario passed again against the rebuilt frontend, including real cited retrieval, conversation persistence, Research handoff and mobile bounds. A separate Chromium check verified the favicon URL responds as `image/svg+xml` and that the launcher, header and Research images load, with no captured JavaScript page errors. The SVG and [chat header](screenshots/chat-iaweb-logo.png) were rendered and visually inspected; browser chrome itself was not captured in the headless screenshots.


## Administrator authentication slice — 2026-11-01

The local deployment now applies additive migration `0002_admin_auth`. Existing document/chunk identifiers, file hashes, chunk text/offsets, embedding revisions, and every Qdrant point (payload and vector included) were compared with a pre-migration snapshot: identical. PostgreSQL still contains 20 documents, 100 chunks, no administrator, and zero conversations/messages/query events. Qdrant retains 100 points. No volumes were removed. A pre-migration PostgreSQL dump was saved outside the repository with mode 0600.

Executed checks:

- Backend Ruff passed. The default backend invocation passed 44 tests with one optional PostgreSQL skip before the two bootstrap CLI tests were added. After adding bootstrap CLI coverage, the final full PostgreSQL/Qdrant suite passed **47 tests in 39.24 seconds**, using a temporary PostgreSQL database and isolated Qdrant test collections.
- The populated-legacy migration test upgrades from `0001_initial`, checks retained document/chunk/history records, confirms no automatic account creation and passes Alembic schema drift detection.
- Auth tests cover all registered protected routes without authentication, valid/invalid/unknown-user login, Argon2id hashes, session rotation, cookie flags, expiration, disabled accounts, forged cookies, logout revocation, CSRF/malicious Origin rejection, persistent throttling and Secure cookie configuration.
- Frontend lint, typecheck and 10 component tests passed; Vite production builds passed locally and inside Docker. Existing workspace tests now explicitly simulate authenticated sessions rather than bypassing the gate.
- Chromium exercised real HTTP login against the actual new backend code using an isolated migrated SQLite database and a random temporary password. Protected page access, cookie flags, reload persistence, logout and 390px layout passed with no captured JavaScript page errors. That account/database were temporary, not added to the running corpus database.
- Against the rebuilt running Docker frontend, anonymous access redirected to `/login`. Direct backend requests to documents, dashboard, configuration, conversations, readiness details, API docs/schema and `/docs` returned 401. Desktop/mobile login screenshots were captured. The frontend nginx SPA fallback for `/docs` is HTML with the login gate; the protected API documentation route is `/api/docs`.
- An initial remote-Qdrant suite during container builds had two unsuccessful indexing setups. They were not counted as drift/inspector verification. The test client timeout was made explicit at 30 seconds and those tests now assert indexing succeeded before their checks. The subsequent full real PostgreSQL/Qdrant run passed 45 tests, before the bootstrap tests were added.

The original complete authenticated UI workflows now require dedicated local test credentials and explicitly skip without them. They were not rerun against the owner’s instance, since no administrator was created there and its history was preserved. Interactive owner bootstrap and later complete UI workflows remain to be performed by the owner using the instructions in `ADMIN_AUTH.md`. No external LLM was invoked, no integration/widget implementation was changed and nothing was pushed to GitHub.


## Enterprise API and widget implementation — 2026-11-02

These results supersede the earlier statements that employee integrations are absent. Gemini live verification is still pending, and the application continues in retrieval-only mode.

### Executed checks

- `backend/.venv/bin/ruff check backend/app backend/tests`: passed. New enterprise/Gemini/migration modules also pass Ruff formatting checks.
- Full backend suite with `TEST_QDRANT_URL=http://localhost:6333` and a temporary real PostgreSQL `TEST_DATABASE_URL`: **80 passed in 130.80 seconds**. Most API unit fixtures use isolated migrated SQLite databases plus actual Qdrant test collections and deterministic test embeddings. The PostgreSQL migration test uses the temporary PostgreSQL database. This result is not a claim that every fixture uses PostgreSQL or actual MiniLM.
- `cd frontend && npm run lint && npm run typecheck && npm test && npm run build`: passed; **26 component tests**. Includes login, protected workspace, integration issuance/rotation/revocation/publication, persisted settings and safe provider status. Settings show configured credentials, not verified account/model availability.
- `python3 -m unittest discover -s examples/intranet/tests -v`: **4 passed**. Token issuer is isolated test transport; it is not a live model request.
- `node --check widget/knowledgeos-widget.js`: passed.
- `frontend/node_modules/.bin/tsc -p examples/intranet/react/tsconfig.json`: passed.
- `node widget/tests/widget-browser.unit.mjs`: passed in Chromium. Covers open/close, submission, source display, loading/retry, one token refresh, history/new conversation, 390px viewport, no localStorage credentials and no page errors. Its network is intentionally mocked.

### Real local-service acceptance

`scripts/enterprise_acceptance.py` provides a repeatable real browser scenario. Run from the repository root with `backend/.venv/bin/python scripts/enterprise_acceptance.py`, with Compose services and frontend dependencies installed. It expects local retrieval-only mode and system Chrome (override `CHROME_PATH`). It creates a random temporary administrator, a unique synthetic policy and an integration restricted to that policy, then starts a temporary real example portal on port 18763. It removes only its own policy, vectors, conversation and temporary administrator afterward. Redacted query events, audit metadata and a disabled/revoked synthetic test integration remain intentionally as executed activity.

The scenario passed against the actual running FastAPI/PostgreSQL/Qdrant/MiniLM services:

1. Temporary administrator login and integration management UI.
2. Actual document upload, extraction, chunking, MiniLM embedding and Qdrant indexing.
3. Separate portal persona session and server-side token exchange.
4. Widget query with authorized real retrieval, cited policy text and source endpoint access.
5. Honest generation-disabled badge, with no simulated generated answer.
6. Employee request to administrator documents API rejected with 401.
7. Conversation reopens after portal reload; mobile 390px UI; no captured page errors or localStorage credentials.
8. Actual integration query events persisted and reflected in admin analytics.

An initial browser run failed because the assertion expected a different mode label; a later run waited for a passage to become visible before opening its collapsed source details. These assertion failures were corrected to check the actual honest label and attach/open the real source before asserting visibility. They were not counted as successful runs. The final successful run is the evidence above.

Screenshots from that real scenario: [integration administration](screenshots/enterprise-integrations.png), [employee portal](screenshots/employee-intranet.png), [mobile widget](screenshots/employee-intranet-mobile.png). They show a synthetic verification policy, not authentic company content.

### Preservation and migration evidence

Before applying additive migration `0003_enterprise_integrations`, a PostgreSQL dump and full source/vector snapshot were written outside Git under `/tmp/knowledgeos-before-enterprise.*` with restrictive file permissions. Migration 0003 was applied to the existing instance. After cleanup, all original row fields were compared by ID, including the existing personal administrator; all original Qdrant point payloads and embedding arrays compared identical. Counts: **20 original documents, 100 SQL chunks, 100 Qdrant points, 1 existing administrator**. All original documents retain `employee_available=false`. No collection was replaced, no embedding model changed and no Docker volume was deleted. The temporary backup is a local safety copy, not a documented durable backup/restore service.

### Security coverage and remaining gaps

Tests cover default deny; pre-top-k vector filtering; canonical SQL source reconstruction; forbidden passages excluded from prompts; employee/integration history isolation; old source revocation; key hashes/expiry/revoke/rotate/scopes; token expiry/Origin and CORS; rate limits; redacted metrics; settings validation; provider error responses and access changes during generation. Gemini tests use HTTPX mocks for structured response parsing, citations, blocked/truncated content, bounded retries, Retry-After, 429, timeouts and transport failures. Dependency failure injection tests are separate from actually stopping the owner's services.

No real Gemini request, provider free-tier/account/quota verification, multi-tenant implementation, external SSO, load benchmark, formal accessibility assessment or public deployment was performed. The permanent demo portal key on port 8090 must still be configured by its administrator; acceptance used a temporary integration/portal rather than silently granting all original policies. English embeddings remain unchanged; no French-retrieval quality improvement is claimed.

After adding explicit SQL/vector outage recovery cases, `cd backend && .venv/bin/python -m pytest -q tests/test_enterprise.py` passed **16 tests in 13.44 seconds**. Those two new cases were run after the full 80-test invocation; they are not represented as having been in that earlier invocation. Ruff passed for backend code/tests and both new scripts.

The final Docker build for backend/frontend/intranet succeeded and services were recreated without changing database/vector volumes. The real acceptance script passed again against those rebuilt images, including the latest authorized-response checks and administrative activity panels. No Gemini request was involved.


## Final Gemini delivery verification — 2026-11-02

This follow-up supersedes the earlier pending-key/retrieval-only checkpoint. The owner securely configured the local key. No secret was printed, committed or sent to the browser.

- **Real model metadata:** HTTP 200 for `models/gemini-3.5-flash-lite`, announcing `generateContent` support.
- **Real generation:** `docker compose exec -T backend python -m app.verify_gemini` retrieved actual MiniLM/Qdrant passages, checked canonical SQL sources, called Gemini and returned `grounded` with validated inline citations. One observed successful request took 1658 ms of generation and reported 1108 total tokens. This single observation is not a latency benchmark or billing/quota measurement.
- Initial real provider responses omitted inline citation markers despite returning a citation array; the existing validator abstained. The system prompt and Gemini schema descriptions now explicitly require inline markers. Citation validation was not weakened.
- **Backend final full suite:** `backend/.venv/bin/python scripts/test_real_services.py` — **82 passed in 255.80 seconds**. Uses an isolated PostgreSQL migration database, isolated actual Qdrant test collections, SQLite API unit fixtures and deterministic test embeddings. Real MiniLM and provider behavior are established separately by live acceptance, not attributed to those unit doubles.
- **Gemini + enterprise target:** **35 passed in 36.84 seconds**, including error/429/retry/timeout and authorization boundaries.
- **Frontend final:** lint, TypeScript and Vite production build passed; **26 component tests passed in 64.98 seconds**. Initial parallel runs exceeded the five-second whole-test budget on the local 8 GB machine. DOM suites now use one worker and a 15-second bounded test budget; assertions and async element checks were not removed. The full suite then passed. This is test-runner resource tuning, not an application performance claim.
- **Real ingestion-to-Gemini acceptance:** `backend/.venv/bin/python scripts/enterprise_acceptance.py` passed after activation. It verified actual upload/index/retrieval, authorized Gemini output, inline citations, source access, portal identity, reload history, admin denial, 390px layout, zero captured widget page errors and persisted analytics. Its temporary document/vectors/conversation/admin were removed; executed query events and disabled audit integrations remain.
- **Final deployed portal:** the live `e2e/employee-portal.spec.ts` scenario passed (**1 test, 29.0 seconds**) against port 8090: real `grounded` response using only the Atlas scope, source lookup matching the actual returned SQL passage, unsupported-pension-question abstention, reload persistence, mobile bounds, persona isolation, private `.env` 404, anonymous admin API 401, no localStorage credentials and no captured page errors. Earlier test assertions incorrectly expected 200 rather than the documented 201 message-creation status, and assumed the remote-days sentence must be in the first ranked chunk. Those assumptions were corrected; the successful test checks the actual relevant returned chunk. Application authorization/retrieval was not weakened.
- **Admin Playground:** `e2e/admin-playground.spec.ts` passed with a temporary random administrator (**1 test, 52.5 seconds**), actual Gemini response, provider/model trace, source modal and cleanup of its own conversation/account. An earlier assertion looked for a retrieval-only control in generated-answer mode; it now uses the existing source citation chips. The failed-assertion fixture was explicitly cleaned up without touching original history.
- Portal server unit tests: **4 passed**. Widget browser unit scenario, JS syntax and React wrapper TypeScript checks passed. These are separately labeled mock-transport checks.

Both new live-provider Playwright scenarios require `KNOWLEDGEOS_LIVE_E2E=1` to avoid accidental external model requests. The administrator scenario additionally requires a dedicated local test administrator in the process environment; no test password is committed.

```sh
make real-services-test
make frontend-check
make enterprise-acceptance
cd frontend
KNOWLEDGEOS_LIVE_E2E=1 CHROME_PATH=/usr/bin/google-chrome npx playwright test e2e/employee-portal.spec.ts
```

### Final preservation and runnable state

The original 20 document records, 100 chunk records, personal administrator, original conversation/message/query rows and all 100 original vector payloads/embedding arrays were compared unchanged with a fresh private backup. All original documents remain admin-only. Stored original files were also re-read from the uploads volume and verified against their metadata SHA-256 hashes.

A dedicated additional synthetic Atlas handbook and three actual chunks/vectors were intentionally added and explicitly published to one active demo integration only. Current corpus totals: **21 documents, 103 chunks, 103 Qdrant vectors, 1 personal administrator**. Real synthetic conversations/query events from the tests remain where documented. Backups live outside Git in `~/.local/share/knowledgeos-backups/` with restrictive permissions; no volume was deleted and no embedding model/collection was replaced.

All five Compose services are running. Frontend/backend/portal/PostgreSQL health checks passed; Qdrant's HTTP health endpoint returned 200. The public minimal API liveness returned 200 and unauthenticated documents returned 401. The local `.env` is ignored and mode 0600; `understand.md` remains ignored and local. No GitHub push or hosted CI execution was performed in this phase.

Remaining limits: Google project billing tier and remaining quota are not exposed by these API checks; a successful request proves access only at that moment. No free-tier or unlimited-usage guarantee, production SSO, multi-tenant isolation, formal accessibility/security audit, load benchmark or fresh-clone-on-another-machine claim is made. The fictional portal has process-local demo auth and a 90-day revocable server credential. English MiniLM retrieval remains unchanged.
