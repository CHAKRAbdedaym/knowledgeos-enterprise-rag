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
- No authentication, tenant isolation, production backup restore drill or distributed crash-consistency guarantee.
- Initial model/dependency downloads required network access. The verified model cache was reused for container testing; this does not independently prove cold downloads on every network.
- A separate independent fresh-clone run was not performed; the Docker builds executed the tracked dependency installation/build steps and initial schema migration was tested.
- GitHub Actions is configured but cannot be claimed to have run remotely before this repository is published.

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
