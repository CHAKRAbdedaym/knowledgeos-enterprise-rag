"""Interactive administrator login for local CLI scripts; credentials stay in memory."""

import getpass
import http.cookiejar
import json
import sys
import urllib.parse
import urllib.request


def authenticate(api_url):
    if not sys.stdin.isatty():
        raise RuntimeError(
            "Administrator login requires an interactive terminal. Run this command locally."
        )
    parsed = urllib.parse.urlsplit(api_url)
    if (
        parsed.scheme not in {"http", "https"}
        or not parsed.hostname
        or parsed.username
        or parsed.password
    ):
        raise ValueError("Use an HTTP(S) API URL without credentials.")
    if parsed.scheme == "http" and parsed.hostname not in {
        "localhost",
        "127.0.0.1",
        "::1",
    }:
        raise ValueError("Administrator credentials require HTTPS outside loopback.")
    username = input("Administrator username: ").strip()
    password = getpass.getpass("Administrator password: ")
    # This must be an explicitly configured trusted frontend origin.
    origin = (
        input("Trusted frontend origin [http://localhost:8080]: ").strip()
        or "http://localhost:8080"
    )

    class NoRedirect(urllib.request.HTTPRedirectHandler):
        def redirect_request(self, req, fp, code, msg, headers, newurl):
            raise RuntimeError(
                "Unexpected redirect; administrator credentials were not forwarded."
            )

    jar = http.cookiejar.CookieJar()
    opener = urllib.request.build_opener(
        urllib.request.HTTPCookieProcessor(jar), NoRedirect()
    )
    req = urllib.request.Request(
        api_url.rstrip("/") + "/auth/login",
        json.dumps({"username": username, "password": password}).encode(),
        {"Content-Type": "application/json", "Origin": origin},
    )
    del password
    with opener.open(req, timeout=30) as response:
        csrf = json.load(response)["csrf_token"]
    # The login request predates cookie creation, so assemble a new request for the jar.
    carrier = urllib.request.Request(api_url.rstrip("/") + "/auth/me")
    jar.add_cookie_header(carrier)
    cookie = carrier.get_header("Cookie", "")
    del req, carrier

    class AdminHeaders(urllib.request.BaseHandler):
        def http_request(self, request):
            # Do not forward the session/CSRF to Qdrant or other absolute URLs.
            if request.full_url.startswith(api_url.rstrip("/") + "/"):
                request.add_header("Cookie", cookie)
                request.add_header("Origin", origin)
                request.add_header("X-CSRF-Token", csrf)
            return request

        https_request = http_request

    urllib.request.install_opener(
        urllib.request.build_opener(AdminHeaders(), NoRedirect())
    )
