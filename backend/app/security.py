import logging
from collections import defaultdict, deque
from threading import Lock
from time import monotonic
from fastapi import Request
from fastapi.responses import JSONResponse
from app.config import get_settings

logger = logging.getLogger("knowledgeos")

rate_lock = Lock()
request_times: dict[str, deque] = defaultdict(deque)


def error_response(status, message, code=None, details=None):
    return JSONResponse(
        status_code=status, content={"detail": message, "error": {"code": code or f"http_{status}", "message": message, "details": details}}
    )


# registered by app.main


async def http_error(request, exc):
    return error_response(exc.status_code, str(exc.detail))


# registered by app.main


async def validation_error(request, exc):
    details = [{"field": ".".join(str(x) for x in e["loc"]), "message": e["msg"]} for e in exc.errors()]
    return error_response(422, "Request validation failed", "validation_error", details)


# registered by app.main


async def unexpected_error(request, exc):
    logger.error("api_request_failed", extra={"error_type": type(exc).__name__})
    return error_response(503, "Service temporarily unavailable. Check dependency health and try again.", "service_unavailable")


# registered by app.main


async def limits(request: Request, call_next):
    if request.url.path.startswith("/api") and request.url.path not in {"/api/health", "/api/readiness"} and request.method != "OPTIONS":
        settings = get_settings()
        try:
            size = int(request.headers.get("content-length", "0"))
        except ValueError:
            return error_response(400, "Invalid Content-Length")
        if size > settings.max_upload_mb * 1024 * 1024 + 65536:
            return error_response(413, "Request exceeds upload size limit")
        client = request.client.host if request.client else "unknown"
        with rate_lock:
            current = monotonic()
            if len(request_times) > 10000:
                for key in list(request_times):
                    if not request_times[key] or request_times[key][-1] < current - 60:
                        request_times.pop(key, None)
            queue = request_times[client]
            while queue and queue[0] < current - 60:
                queue.popleft()
            if len(queue) >= settings.rate_limit_per_minute:
                response = error_response(429, "Rate limit exceeded. Retry in one minute.")
                response.headers["Retry-After"] = "60"
                return response
            queue.append(current)
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    return response
