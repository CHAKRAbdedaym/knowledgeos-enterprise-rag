# Administrator authentication — first enterprise slice

This slice adds administrator access to the existing single-company portfolio demo. The included IAWEB.DEV documents remain synthetic. Integration API credentials, employee authorization, the independent widget and Gemini were added in the enterprise follow-up; see `FINAL_DELIVERY_FR.md`.

## First access (French)

Depuis un terminal interactif dans la racine du projet :

```sh
docker compose up -d
docker compose exec backend python -m app.admin_cli
```

Choisir son identifiant puis saisir deux fois un mot de passe personnel d’au moins 12 caractères. La saisie est masquée. Ne pas coller le mot de passe dans une conversation, un argument de commande ou un fichier du dépôt. Aucun administrateur n’est créé automatiquement par une migration ou au démarrage. La commande refuse une entrée non interactive et ne remplace pas un compte existant.

Ouvrir http://localhost:8080/login, puis se connecter avec ce compte. Le bouton **Sign out** révoque la session serveur. Actualiser une page après connexion conserve l’accès tant que la session reste valide. L’accès direct à `/documents` sans session affiche la page de connexion ; les API correspondantes renvoient 401.

En développement sans Docker : appliquer `alembic upgrade head` puis exécuter `python -m app.admin_cli` depuis `backend/`, dans son venv et avec la configuration locale correcte.

## Implementation

- Passwords: Argon2id through argon2-cffi, random salts, rehash after successful login when parameters change. No plaintext password is stored.
- Sessions: 256-bit random opaque bearer cookies; PostgreSQL stores only their SHA-256 hashes, administrator owner and absolute expiration. Default lifetime: eight hours; configurable from one to 24 hours. No JWT/signing secret is required.
- Cookie: HttpOnly, SameSite=Strict, Path=/, bounded Max-Age. `AUTH_COOKIE_SECURE=true` adds Secure and uses the `__Host-knowledgeos_session` name. With false, the local HTTP cookie is `knowledgeos_session`. HTTPS deployments must enable Secure. No domain attribute is set.
- Every request checks session existence, expiration and administrator enabled state. Login rotates the current session; logout deletes it. Expired sessions are cleaned on login. Disabling an administrator invalidates their access on subsequent requests.
- CSRF: successful login and `/api/auth/me` return a session-bound HMAC token. React keeps it only in memory and sends `X-CSRF-Token` with mutations, including uploads. Mutations require an exact trusted Origin and a matching token. Login also requires a trusted Origin, preventing login CSRF. The HttpOnly session token is not exposed to JavaScript.
- All historical API routes use a router-wide administrator dependency. Readiness details, OpenAPI JSON, `/api/docs` and `/docs` are protected. Only `/api/health` is public and returns fixed liveness information.
- Auth/private responses use Cache-Control: no-store. Logout/session expiry clears React Query data. Failed logout requests are shown, rather than silently claiming revocation.
- Login throttling is persisted in SQL with atomic counters: five attempts per normalized username and 20 per connection IP per 15-minute window. Errors are generic. Behind the current nginx proxy the IP bucket is shared; forwarded headers are not trusted. This deliberate conservative limit and account lockout risk should be revisited with trusted ingress infrastructure before public operation.
- API operational rate limiting remains in-process. This slice does not claim distributed production ingress protection, MFA, SSO, corporate employee SSO or multi-tenant isolation.

## API

| Route | Access | Result |
|---|---|---|
| POST `/api/auth/login` | Trusted Origin; JSON username/password | HttpOnly session cookie, administrator id/username, CSRF token |
| GET `/api/auth/me` | Session cookie | Administrator identity and CSRF token after reload |
| POST `/api/auth/logout` | Session, trusted Origin, CSRF | Revocation and cookie deletion |
| GET `/api/health` | Public | Minimal process liveness |
| Other application APIs / docs | Administrator session; CSRF on mutations | Existing contracts preserved |

CORS explicitly allows configured frontend origins and credentials; arbitrary origins are rejected. Cookies alone are insufficient for a write request. The CSRF value is not an integration credential and must not be given to an employee widget.

## Scripts and browser workflows

The existing seed, evaluation and acceptance scripts now authenticate interactively, using a masked password prompt and a trusted frontend Origin (default http://localhost:8080). Cookies/CSRF live only in process memory. Authentication headers are added only to the selected API prefix and not to the absolute Qdrant URLs used by acceptance checks. Redirects are refused. These scripts require a TTY; no password is hardcoded or passed as a command argument.

Existing authenticated Playwright workflows require `KNOWLEDGEOS_E2E_USERNAME` and `KNOWLEDGEOS_E2E_PASSWORD` in the local test process environment for a dedicated test account. Without them they explicitly skip. Supply these through a local secret mechanism; do not commit them or use a shared default. Those full workflows upload fixtures and create queries, so they are not suitable for preserving an empty history. The separate isolated browser verification uses an ephemeral database and random credentials, then deletes that test database.

## Data preservation

Migration `0002_admin_auth` adds only `admins`, `admin_sessions` and `login_buckets`. It does not modify or delete existing documents, chunks, conversations, messages, query logs, upload files or Qdrant points. A migration test upgrades populated `0001_initial` data and checks those records survive. An isolated schema test also checks Alembic metadata drift.

Before applying this migration locally, a PostgreSQL dump and a comparison snapshot of document identities/hashes, chunks and Qdrant points were stored outside the repository in `/tmp/knowledgeos-before-admin.dump` and `/tmp/knowledgeos-before-admin.json`. These local temporary artifacts must not be published. They may disappear when the machine clears temporary storage; retain your own secure backups as needed.

## Enterprise follow-up

The protected legacy routes remain administrator-only. `/api/admin/...` additionally manages integrations; `/api/v1/...` uses separate integration/employee bearer authentication and accepts no admin session as employee authority. See [ENTERPRISE_API.md](ENTERPRISE_API.md). Existing administrator accounts and sessions were retained by migration 0003. The independently served widget never receives the administrator cookie or CSRF value.
