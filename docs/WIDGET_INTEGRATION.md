# Employee widget and fictional intranet

The employee widget is a separate native ES module with Shadow DOM. It imports none of the admin dashboard, administrator session code, React application routes or provider keys. It uses only the versioned employee API. It contains no fixed answers or production mock transport.

`widget/knowledgeos-widget.js` needs no dependency installation or compilation. Host this public file on your intranet or an approved static asset origin. Its CSS is installed through a constructable stylesheet inside the shadow root; the host does not need to allow inline script/style execution. Modern evergreen browsers with constructable stylesheet support are required.

## Trust and token flow

1. The employee signs in through the company's actual portal/SSO.
2. The portal backend resolves the employee's immutable subject from that session.
3. The portal backend uses its permanent integration key to call `POST /api/v1/widget-sessions` with the resolved subject and exact allowed browser origin.
4. The backend returns only a short-lived `kws_…` token, expiration and lifetime to the browser.
5. The widget keeps that token in memory and sends it as an Authorization bearer to the v1 API. `credentials: omit` prevents administrator cookies from being attached.
6. On expiration/401, the widget requests a replacement once through the portal callback; there is no infinite retry loop. A 429 is shown with its retry delay rather than retried automatically.

The permanent `kos_…` key belongs in the portal server's environment or secret manager. It must never be put in HTML, JavaScript configuration, an iframe URL, query strings or browser storage. Provider keys belong only to the KnowledgeOS backend.

Short-lived bearer tokens can still be stolen by malicious JavaScript running in the same page. Use HTTPS, a trusted portal origin, dependency controls and a restrictive CSP. Portal logout removes the widget and its in-memory token and revokes the portal cookie; an already stolen KnowledgeOS bearer remains usable until its short expiration or integration/key revocation. Short expiry and server-side revocation reduce the exposure; this design does not claim token theft is impossible. Cross-origin API requests require exact integration origin authorization; CORS itself is not identity verification.

## Host and cookie isolation

The local administrator console uses `http://localhost:8080`, while the employee portal deliberately uses **`http://127.0.0.1:8090`**. Browser cookies are scoped by hostname and path, **not by port**. Serving both applications as `localhost` on different ports would allow a host-only administrator cookie to reach the portal server. The distinct loopback hostnames prevent that cookie from being sent to this local demonstration portal. Configure the integration origin to the exact portal URL; `localhost` and `127.0.0.1` are different origins.

In production, use distinct administrator and intranet hostnames, HTTPS, and host-only cookies with **no `Domain` attribute**. Do not treat different ports as cookie isolation, and do not widen cookies to a shared parent domain. The widget's KnowledgeOS requests additionally use `credentials: omit`; portal requests use only the portal's own session cookie.

## Plain HTML/JavaScript

See `widget/examples/minimal.html` and `bootstrap.js`. Mount the widget after the portal has authenticated the user:

```js
import { mountKnowledgeOS } from '/widget/knowledgeos-widget.js';
const assistant = mountKnowledgeOS({
  apiUrl: 'https://knowledge.example/api/v1',
  title: 'Company knowledge assistant',
  accent: '#2458ff',
  // logo: 'https://intranet.example/assets/assistant-logo.png',
  getToken: async () => {
    const response = await fetch('/portal/widget-session', {
      method: 'POST', credentials: 'same-origin',
      headers: {'Content-Type': 'application/json', 'X-CSRF-Token': portalCsrf},
      body: '{}',
    });
    if (!response.ok) throw new Error('Sign in to your intranet again.');
    return response.json();
  },
});
// On portal logout or employee identity change:
// assistant.remove();
```

The callback's `portalCsrf` comes from your authenticated portal, not the KnowledgeOS administrator's session. The portal's token endpoint must ignore user-supplied subject values and derive them server-side. The example server does exactly that. There is no permanent API key parameter in the widget API.

Configuration supports a title, six-digit hexadecimal accent color, optional HTTPS logo URL (same-origin HTTP is permitted only for local assets), API base URL and optional DOM container. Outside loopback development the API must use HTTPS. Logo URLs cannot contain credentials, script schemes or inline data. Text and source snippets use textContent, with no untrusted HTML rendering.

CSP must permit the widget script origin, logo origin if configured, and the public KnowledgeOS API in `connect-src`. No wildcard `connect-src` or `unsafe-eval` is required. The demo serves its widget script from the portal origin. The widget is a web component, not an iframe of the admin dashboard, and it does not use postMessage.

## React portal

Use `examples/intranet/react/KnowledgeAssistant.tsx`. Render it only for an authenticated employee and key it by the employee identity so switching users removes the previous widget and in-memory conversation state. Its `getToken` callback calls your own portal backend. The wrapper is an integration example, not a separate chatbot engine.

```tsx
<KnowledgeAssistant
  key={employee.subject}
  apiUrl="https://knowledge.example/api/v1"
  title="Company knowledge assistant"
  getToken={openEmployeeWidgetSession}
/>
```

The native widget fetches authorized conversation history from KnowledgeOS when first opened. No conversation IDs or tokens are persisted in localStorage. On a portal reload, history is loaded from the authenticated backend again. Starting a new conversation does not delete previous conversations; they remain under the same employee/integration permissions.

## Fictional Atlas intranet demonstration

`examples/intranet/server.py` is a small standard-library portal server. Its static UI is a professional fictional employee dashboard on port 8090. It serves the independent widget and exchanges tokens through the real KnowledgeOS backend.

**The persona selector is deliberately synthetic, not corporate authentication.** Camille Demo and Samir Demo are fixed server-side identities for comparing employee experiences. There is no SSO claim or real employee information. A production integrator must replace this selector with its own authenticated portal session/SSO. Demo portal sessions are random, HttpOnly, SameSite=Strict cookies, with CSRF and exact Origin checks on token acquisition/logout. The server maps persona → subject and ignores a `subject` sent by the browser.

### Local setup

1. Start KnowledgeOS and sign in to the administrator console.
2. Create an integration with origin `http://127.0.0.1:8090` and explicitly select the synthetic documents employees may access. Empty scope must remain deny-all.
3. Issue a credential. Put its one-time secret into the **portal server environment**, as `KNOWLEDGEOS_INTEGRATION_KEY`, using a local secret mechanism. Never paste it into a source file or chat.
4. Configure these nonsecret values:

```dotenv
KNOWLEDGEOS_API_URL=http://localhost:8000/api/v1
KNOWLEDGEOS_PUBLIC_API_URL=http://localhost:8000/api/v1
PORTAL_ORIGIN=http://127.0.0.1:8090
PORTAL_PORT=8090
```

5. From the repository root, start the portal in the environment holding that credential:

```sh
python3 examples/intranet/server.py
```

The server reads process environment only; it does not automatically load an arbitrary `.env` file. Use Compose environment injection or your shell/secret manager. `examples/intranet/.env.example` contains placeholders only.

6. Open http://127.0.0.1:8090, select a clearly synthetic persona, and open the assistant.
7. Ask `What is the remote work policy?`. Inspect the cited passage. Generated vs retrieval-only status reflects the real backend's mode.
8. Reload the portal, reopen history, and inspect the same employee's conversation. Sign out and select the other persona to test that their authorized history differs.

For Compose, build the portal Dockerfile with **repository root as build context**:

```sh
docker build -f examples/intranet/Dockerfile -t knowledgeos-intranet .
```

The root orchestrator wires its backend URL to `http://backend:8000/api/v1`, publishes portal port 8090 on loopback and injects the integration key only into the portal server container. The browser still needs `KNOWLEDGEOS_PUBLIC_API_URL=http://localhost:8000/api/v1`; it cannot resolve the Docker hostname `backend`.

The server exposes minimal `/health`, public `/portal/config`, cookie-authenticated `/portal/me`, demo login/logout, and a CSRF-protected `/portal/widget-session` endpoint. It does not proxy arbitrary URLs, file paths or employee IDs. Its session dictionary is deliberately process-local and lasts one hour; this demo server is not a production identity service or highly available session store.

## Checks provided

```sh
node --check widget/knowledgeos-widget.js
python3 -m unittest discover -s examples/intranet/tests -v
frontend/node_modules/.bin/tsc -p examples/intranet/react/tsconfig.json
node widget/tests/widget-browser.unit.mjs
```

Portal tests use an isolated local token issuer; widget interaction tests use a mocked network transport. They test interface/security handling, not a live Gemini or actual KnowledgeOS end-to-end success. The browser unit script uses the repository's Playwright installation and system Chrome, or `CHROME_PATH`. Live acceptance through the real KnowledgeOS services is recorded separately by the master implementation after the backend and integration are configured.

The demo questions are English because the current MiniLM/corpus retrieval path is English. Gemini's ability to generate French text does not provide French retrieval support.


## Preconfigured local portfolio demo (2026-11-02)

The local instance now has one explicitly created Atlas portal integration, with origin `http://127.0.0.1:8090` and access only to the additional `data/demo_portal/atlas_employee_handbook.md` document. None of the 20 historical documents was published automatically. The permanent credential is stored only in ignored local `.env` and injected into the portal server; backend Compose explicitly blanks that portal credential in its own container. The key expires after 90 days and can be rotated/revoked through Integrations.

`make portal-setup` reproduces the optional setup from a trusted local database-operator environment. Its temporary random setup administrator is removed in `finally`; no shared or default account/password is introduced. Existing configured portal credentials are retained, not silently rotated. The setup uses the actual authenticated upload/ingestion and integration APIs. Never expose this trusted operator script as an HTTP endpoint.

The dedicated real-service browser scenario is `KNOWLEDGEOS_LIVE_E2E=1 CHROME_PATH=/usr/bin/google-chrome npx playwright test e2e/employee-portal.spec.ts` from `frontend`. It expects the configured local Gemini integration and uses actual provider calls; it is not a mocked CI unit test.
