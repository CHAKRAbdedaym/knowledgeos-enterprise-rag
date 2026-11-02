import secrets
from datetime import datetime, timedelta, timezone
from fastapi.routing import APIRoute
from sqlalchemy import select, func
from app.main import app
from app.models import Admin, AdminSession
from app.auth import digest, cookie_name


def anonymous(client):
    client.cookies.clear()
    client.headers.pop("X-CSRF-Token", None)


def signin(client, password=None):
    return client.post("/api/auth/login", json={"username": "fixture-admin", "password": password or client.admin_password})


def test_all_admin_routes_reject_anonymous(client):
    anonymous(client)
    for route in app.routes:
        if not isinstance(route, APIRoute) or route.path == "/api/health" or route.path.startswith("/api/auth/"):
            continue
        path = route.path.replace("{document_id}", "missing").replace("{conversation_id}", "missing")
        for method in route.methods - {"HEAD", "OPTIONS"}:
            response = client.request(method, path, json={} if method in {"POST", "PATCH"} else None)
            assert response.status_code == 401, (method, path, response.text)
    assert client.get("/api/health").status_code == 200


def test_correct_login_hashes_cookie_csrf_and_rotation(client):
    old = client.cookies.get(cookie_name(client.settings))
    r = signin(client)
    assert r.status_code == 200
    assert client.cookies.get(cookie_name(client.settings)) != old
    cookie = r.headers["set-cookie"].lower()
    assert "httponly" in cookie and "samesite=strict" in cookie and "path=/" in cookie
    assert r.headers["cache-control"] == "no-store"
    assert "password" not in r.text
    token = client.cookies.get(cookie_name(client.settings))
    with client.db_sessions() as db:
        assert db.get(AdminSession, digest(old)) is None
        assert db.get(AdminSession, digest(token)) is not None
        assert db.scalar(select(Admin)).password_hash.startswith("$argon2id$")
        assert db.scalar(select(Admin)).password_hash != client.admin_password
    assert client.get("/api/auth/me").json()["csrf_token"] == r.json()["csrf_token"]
    client.headers["X-CSRF-Token"] = r.json()["csrf_token"]
    assert client.get("/api/documents").status_code == 200


def test_bad_credentials_and_unknown_user_are_generic(client):
    anonymous(client)
    r = signin(client, secrets.token_urlsafe(24))
    unknown = client.post("/api/auth/login", json={"username": "unknown", "password": secrets.token_urlsafe(24)})
    assert r.status_code == unknown.status_code == 401
    assert r.json() == unknown.json()
    assert "set-cookie" not in r.headers


def test_csrf_origin_and_logout_revocation(client):
    token = client.cookies.get(cookie_name(client.settings))
    csrf = client.headers.pop("X-CSRF-Token")
    assert client.post("/api/conversations", json={}).status_code == 403
    assert client.post("/api/auth/logout").status_code == 403
    client.headers["X-CSRF-Token"] = "invalid"
    assert client.post("/api/conversations", json={}).status_code == 403
    client.headers["X-CSRF-Token"] = csrf
    assert client.post("/api/conversations", json={}, headers={"Origin": "https://evil.example"}).status_code == 403
    assert client.post("/api/conversations", json={}).status_code == 201
    assert client.post("/api/auth/logout").status_code == 200
    client.cookies.set(cookie_name(client.settings), token)
    assert client.get("/api/dashboard").status_code == 401
    with client.db_sessions() as db:
        assert db.get(AdminSession, digest(token)) is None


def test_expired_disabled_and_forged_sessions(client):
    with client.db_sessions() as db:
        session = db.scalar(select(AdminSession))
        session.expires_at = datetime.now(timezone.utc) - timedelta(seconds=1)
        db.commit()
    assert client.get("/api/documents").status_code == 401
    assert signin(client).status_code == 200
    with client.db_sessions() as db:
        db.scalar(select(Admin)).enabled = False
        db.commit()
    assert client.get("/api/config").status_code == 401
    assert signin(client).status_code == 401
    client.cookies.clear()
    client.cookies.set(cookie_name(client.settings), secrets.token_urlsafe(32))
    assert client.get("/api/readiness").status_code == 401


def test_login_origin_throttle_and_no_default_account(client):
    anonymous(client)
    assert (
        client.post(
            "/api/auth/login",
            json={"username": "fixture-admin", "password": client.admin_password},
            headers={"Origin": "https://evil.example"},
        ).status_code
        == 403
    )
    for _ in range(5):
        signin(client, "incorrect")
    r = signin(client, "incorrect")
    assert r.status_code == 429
    assert r.headers["retry-after"] == "900"
    with client.db_sessions() as db:
        assert db.scalar(select(func.count()).select_from(Admin)) == 1  # explicitly seeded fixture only


def test_secure_cookie_configuration(client):
    client.settings.auth_cookie_secure = True
    # Cookie issuance can be inspected on HTTP, but browser acceptance requires HTTPS.
    r = signin(client)
    assert "Secure" in r.headers["set-cookie"]
    assert "__Host-knowledgeos_session=" in r.headers["set-cookie"]
