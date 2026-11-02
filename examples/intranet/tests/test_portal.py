"""Isolated tests: a local fake token issuer, never a fake production chat service."""

import importlib.util
import json
import os
import secrets
import threading
import unittest
import urllib.error
import urllib.request
from http.cookiejar import CookieJar
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from unittest.mock import patch

spec = importlib.util.spec_from_file_location(
    "portal", Path(__file__).parents[1] / "server.py"
)
portal = importlib.util.module_from_spec(spec)
spec.loader.exec_module(portal)


class TokenIssuer(BaseHTTPRequestHandler):
    seen = []
    key = secrets.token_urlsafe(32)

    def log_message(self, *args):
        pass

    def do_POST(self):
        body = json.loads(self.rfile.read(int(self.headers["Content-Length"])))
        self.seen.append((self.headers.get("Authorization"), body))
        payload = json.dumps(
            {
                "access_token": "kws_" + secrets.token_urlsafe(32),
                "expires_in": 300,
                "private_internal_field": "not-for-browser",
            }
        ).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(payload)


class PortalTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.issuer = ThreadingHTTPServer(("127.0.0.1", 0), TokenIssuer)
        cls.server = ThreadingHTTPServer(("127.0.0.1", 0), portal.Portal)
        for server in [cls.issuer, cls.server]:
            threading.Thread(target=server.serve_forever, daemon=True).start()
        cls.origin = "http://127.0.0.1:" + str(cls.server.server_port)
        portal.PORTAL_ORIGIN = cls.origin
        portal.API_URL = "http://127.0.0.1:" + str(cls.issuer.server_port) + "/api/v1"
        os.environ["KNOWLEDGEOS_INTEGRATION_KEY"] = TokenIssuer.key

    @classmethod
    def tearDownClass(cls):
        for server in [cls.issuer, cls.server]:
            server.shutdown()
            server.server_close()
        os.environ.pop("KNOWLEDGEOS_INTEGRATION_KEY", None)

    def setUp(self):
        portal.SESSIONS.clear()
        TokenIssuer.seen.clear()
        self.opener = urllib.request.build_opener(
            urllib.request.HTTPCookieProcessor(CookieJar())
        )

    def request(self, path, data=None, csrf="", origin=None):
        request = urllib.request.Request(
            self.origin + path,
            data=None if data is None else json.dumps(data).encode(),
            headers={
                "Content-Type": "application/json",
                "Origin": self.origin if origin is None else origin,
                "X-CSRF-Token": csrf,
            },
        )
        try:
            with self.opener.open(request) as response:
                return response.status, response.read(), response.headers
        except urllib.error.HTTPError as error:
            return error.code, error.read(), error.headers

    def login(self):
        status, body, headers = self.request("/portal/login", {"persona": "camille"})
        self.assertEqual(status, 200)
        self.assertIn("HttpOnly", headers["Set-Cookie"])
        self.assertIn("SameSite=Strict", headers["Set-Cookie"])
        self.assertNotIn("domain=", headers["Set-Cookie"].lower())
        return json.loads(body)["csrf_token"]

    def test_login_requires_origin_and_fixed_persona(self):
        self.assertEqual(
            self.request(
                "/portal/login", {"persona": "camille"}, origin="https://evil.example"
            )[0],
            403,
        )
        self.assertEqual(
            self.request("/portal/login", {"persona": "arbitrary-employee-id"})[0], 422
        )
        self.assertEqual(self.request("/portal/widget-session", {})[0], 401)

    def test_exchange_binds_server_identity_and_only_returns_short_token(self):
        csrf = self.login()
        self.assertEqual(self.request("/portal/widget-session", {})[0], 403)
        status, body, _ = self.request(
            "/portal/widget-session", {"subject": "attacker-chosen"}, csrf
        )
        self.assertEqual(status, 200)
        result = json.loads(body)
        self.assertTrue(result["access_token"].startswith("kws_"))
        self.assertNotIn("private_internal_field", result)
        self.assertNotIn(TokenIssuer.key.encode(), body)
        self.assertEqual(
            TokenIssuer.seen[-1],
            (
                "Bearer " + TokenIssuer.key,
                {"subject": "synthetic-camille-001", "origin": self.origin},
            ),
        )
        self.assertEqual(self.request("/portal/logout", {}, csrf)[0], 200)
        self.assertEqual(self.request("/portal/me")[0], 401)
        self.assertEqual(self.request("/portal/widget-session", {}, csrf)[0], 401)

    def test_expiration_and_missing_configuration_fail_closed(self):
        csrf = self.login()
        with patch.dict(os.environ, {"KNOWLEDGEOS_INTEGRATION_KEY": ""}):
            self.assertEqual(self.request("/portal/widget-session", {}, csrf)[0], 503)
        next(iter(portal.SESSIONS.values()))["expires_at"] = 0
        self.assertEqual(self.request("/portal/me")[0], 401)

    def test_static_assets_and_configuration_never_contain_server_secret(self):
        for path in [
            "/",
            "/portal.js",
            "/widget/knowledgeos-widget.js",
            "/portal/config",
        ]:
            status, body, _ = self.request(path)
            self.assertEqual(status, 200)
            self.assertNotIn(TokenIssuer.key.encode(), body)
        self.assertEqual(self.request("/../../server.py")[0], 404)


if __name__ == "__main__":
    unittest.main()
