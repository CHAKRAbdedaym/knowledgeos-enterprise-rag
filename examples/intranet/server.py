"""Fictional intranet: explicit demo personas, real server-to-server KnowledgeOS API.

This selector is NOT a production identity provider. Replace demo login with SSO.
No integration key is ever returned to the browser.
"""

import hashlib
import hmac
import json
import logging
import os
import secrets
import time
import urllib.error
import urllib.parse
import urllib.request
from http.cookies import SimpleCookie
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Lock

ROOT = Path(__file__).resolve().parent
WIDGET = ROOT.parents[1] / "widget" / "knowledgeos-widget.js"
API_URL = os.getenv("KNOWLEDGEOS_API_URL", "http://localhost:8000/api/v1").rstrip("/")
PUBLIC_API_URL = os.getenv(
    "KNOWLEDGEOS_PUBLIC_API_URL", "http://localhost:8000/api/v1"
).rstrip("/")
PORTAL_ORIGIN = os.getenv("PORTAL_ORIGIN", "http://127.0.0.1:8090").rstrip("/")
COOKIE_SECURE = PORTAL_ORIGIN.startswith("https://")
COOKIE_NAME = "__Host-atlas_demo_session" if COOKIE_SECURE else "atlas_demo_session"
PERSONAS = {
    "camille": {
        "subject": "synthetic-camille-001",
        "name": "Camille Demo",
        "role": "Product designer",
        "initials": "CD",
    },
    "samir": {
        "subject": "synthetic-samir-002",
        "name": "Samir Demo",
        "role": "Software engineer",
        "initials": "SD",
    },
}
SESSIONS = {}
LOCK = Lock()
LOGGER = logging.getLogger("atlas-portal")


def token_hash(value):
    return hashlib.sha256(value.encode()).hexdigest()


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        raise RuntimeError("KnowledgeOS redirected unexpectedly")


class Portal(BaseHTTPRequestHandler):
    server_version = "AtlasDemo/1.0"

    def log_message(self, format, *args):
        # Never record URLs, credential headers, bodies, session identifiers or prompts.
        pass

    def reply(self, code, data=None, *, content_type="application/json", cookie=None):
        body = data if isinstance(data, bytes) else json.dumps(data or {}).encode()
        self.send_response(code)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Referrer-Policy", "no-referrer")
        self.send_header(
            "Content-Security-Policy",
            "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' https:; connect-src 'self' "
            + urllib.parse.urlsplit(PUBLIC_API_URL).scheme
            + "://"
            + urllib.parse.urlsplit(PUBLIC_API_URL).netloc
            + "; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
        )
        if cookie:
            self.send_header("Set-Cookie", cookie)
        self.end_headers()
        self.wfile.write(body)

    def session(self):
        cookie = SimpleCookie()
        try:
            cookie.load(self.headers.get("Cookie", ""))
        except Exception:
            return None
        token = cookie.get(COOKIE_NAME)
        if not token:
            return None
        with LOCK:
            key = token_hash(token.value)
            session = SESSIONS.get(key)
            if session and session["expires_at"] > time.time():
                return session
            SESSIONS.pop(key, None)
        return None

    def json_body(self):
        if self.headers.get("Content-Type", "").split(";")[0] != "application/json":
            raise ValueError("Send application/json")
        length = int(self.headers.get("Content-Length", "0"))
        if length <= 0 or length > 4096:
            raise ValueError("Invalid request size")
        body = json.loads(self.rfile.read(length))
        if not isinstance(body, dict):
            raise ValueError("Send a JSON object")
        return body

    def do_GET(self):
        path = urllib.parse.urlsplit(self.path).path
        if path == "/health":
            return self.reply(200, {"status": "ok", "demo": True})
        if path == "/portal/config":
            return self.reply(200, {"knowledgeos_api_url": PUBLIC_API_URL})
        if path == "/portal/me":
            session = self.session()
            if not session:
                return self.reply(401, {"detail": "Sign in to the fictional portal."})
            return self.reply(
                200,
                {
                    "employee": PERSONAS[session["persona"]],
                    "csrf_token": session["csrf"],
                    "demo": True,
                },
            )
        files = {
            "/": (ROOT / "static/index.html", "text/html; charset=utf-8"),
            "/portal.js": (ROOT / "static/portal.js", "text/javascript; charset=utf-8"),
            "/portal.css": (ROOT / "static/portal.css", "text/css; charset=utf-8"),
            "/widget/knowledgeos-widget.js": (WIDGET, "text/javascript; charset=utf-8"),
        }
        if path in files:
            file, mime = files[path]
            return self.reply(200, file.read_bytes(), content_type=mime)
        return self.reply(404, {"detail": "Not found"})

    def do_POST(self):
        path = urllib.parse.urlsplit(self.path).path
        if self.headers.get("Origin") != PORTAL_ORIGIN:
            return self.reply(403, {"detail": "Portal origin is not allowed."})
        try:
            body = self.json_body()
        except (ValueError, json.JSONDecodeError):
            return self.reply(422, {"detail": "Invalid JSON request."})
        if path == "/portal/login":
            persona = body.get("persona")
            if persona not in PERSONAS:
                return self.reply(
                    422, {"detail": "Choose a synthetic demonstration persona."}
                )
            token, csrf = secrets.token_urlsafe(32), secrets.token_urlsafe(32)
            with LOCK:
                now = time.time()
                for key in list(SESSIONS):
                    if SESSIONS[key]["expires_at"] <= now:
                        SESSIONS.pop(key, None)
                if len(SESSIONS) >= 1000:
                    return self.reply(
                        429, {"detail": "Too many demonstration sessions."}
                    )
                SESSIONS[token_hash(token)] = {
                    "persona": persona,
                    "csrf": csrf,
                    "expires_at": now + 3600,
                }
            cookie = (
                f"{COOKIE_NAME}={token}; Path=/; Max-Age=3600; HttpOnly; SameSite=Strict"
                + ("; Secure" if COOKIE_SECURE else "")
            )
            return self.reply(
                200,
                {"employee": PERSONAS[persona], "csrf_token": csrf, "demo": True},
                cookie=cookie,
            )
        session = self.session()
        if not session:
            return self.reply(
                401, {"detail": "The portal session expired. Sign in again."}
            )
        if not hmac.compare_digest(
            self.headers.get("X-CSRF-Token", ""), session["csrf"]
        ):
            return self.reply(403, {"detail": "Portal CSRF verification failed."})
        if path == "/portal/logout":
            cookie = SimpleCookie(self.headers.get("Cookie", ""))
            with LOCK:
                SESSIONS.pop(token_hash(cookie[COOKIE_NAME].value), None)
            return self.reply(
                200,
                {"logged_out": True},
                cookie=f"{COOKIE_NAME}=; Path=/; Max-Age=0; HttpOnly; SameSite=Strict"
                + ("; Secure" if COOKIE_SECURE else ""),
            )
        if path == "/portal/widget-session":
            key = os.getenv("KNOWLEDGEOS_INTEGRATION_KEY", "")
            if not key:
                return self.reply(
                    503,
                    {
                        "detail": "The demonstration portal integration is not configured on the server."
                    },
                )
            # Identity comes exclusively from the authenticated portal session, not request JSON.
            payload = {
                "subject": PERSONAS[session["persona"]]["subject"],
                "origin": PORTAL_ORIGIN,
            }
            request = urllib.request.Request(
                API_URL + "/widget-sessions",
                json.dumps(payload).encode(),
                {"Content-Type": "application/json", "Authorization": "Bearer " + key},
                method="POST",
            )
            try:
                with urllib.request.build_opener(NoRedirect()).open(
                    request, timeout=20
                ) as response:
                    result = json.load(response)
                if (
                    not isinstance(result, dict)
                    or not isinstance(result.get("access_token"), str)
                    or not result["access_token"].startswith("kws_")
                ):
                    raise ValueError("Invalid short session response")
                # Strict allowlist avoids reflecting any server-side credential or internal metadata.
                return self.reply(
                    200,
                    {
                        name: result[name]
                        for name in ["access_token", "expires_at", "expires_in"]
                        if name in result
                    },
                )
            except urllib.error.HTTPError as exc:
                code = 429 if exc.code == 429 else 503
                return self.reply(
                    code,
                    {
                        "detail": "KnowledgeOS refused the employee session. Check integration scope, expiration and allowed origins in the admin console."
                    },
                )
            except (OSError, ValueError, RuntimeError):
                return self.reply(
                    503, {"detail": "KnowledgeOS is temporarily unavailable."}
                )
        return self.reply(404, {"detail": "Not found"})


def main():
    api = urllib.parse.urlsplit(API_URL)
    if (
        api.scheme not in {"http", "https"}
        or not api.netloc
        or api.username
        or api.password
        or api.query
        or api.fragment
    ):
        raise SystemExit("Invalid server-side KNOWLEDGEOS_API_URL")
    if api.scheme == "http" and api.hostname not in {
        "localhost",
        "127.0.0.1",
        "backend",
        "host.docker.internal",
    }:
        raise SystemExit("Use HTTPS for external KnowledgeOS connections")
    public = urllib.parse.urlsplit(PUBLIC_API_URL)
    origin = urllib.parse.urlsplit(PORTAL_ORIGIN)
    for value in [public, origin]:
        if (
            value.scheme not in {"http", "https"}
            or not value.hostname
            or value.username
            or value.password
            or value.query
            or value.fragment
        ):
            raise SystemExit(
                "Public portal URLs must not contain credentials, query strings or fragments"
            )
        if value.scheme == "http" and value.hostname not in {
            "localhost",
            "127.0.0.1",
            "::1",
        }:
            raise SystemExit("Use HTTPS for public URLs outside loopback development")
    if origin.path not in {"", "/"}:
        raise SystemExit("PORTAL_ORIGIN must be an origin without a path")
    # Local/server-network listener; Compose must bind published port to loopback.
    server = ThreadingHTTPServer(
        (os.getenv("PORTAL_HOST", "127.0.0.1"), int(os.getenv("PORTAL_PORT", "8090"))),
        Portal,
    )
    LOGGER.info("Synthetic intranet demonstration started")
    server.serve_forever()


if __name__ == "__main__":
    main()
