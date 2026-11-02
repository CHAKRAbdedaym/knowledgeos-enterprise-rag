"""Separate bearer-only CORS policy; never grants access to administrator cookies."""

from fastapi.responses import Response
from sqlalchemy import select
from app.database import get_db
from app.models import Integration


async def employee_cors(request, call_next):
    if not request.url.path.startswith("/api/v1/"):
        return await call_next(request)
    origin = request.headers.get("origin")
    allowed = False
    if origin:
        factory = request.app.dependency_overrides.get(get_db, get_db)
        generator = factory()
        try:
            db = next(generator)
            allowed = any(
                origin in origins for origins in db.scalars(select(Integration.allowed_origins).where(Integration.enabled.is_(True)))
            )
        except Exception:
            # Fail closed when the authorization registry is unavailable.
            allowed = False
        finally:
            generator.close()
    if request.method == "OPTIONS":
        methods = {"GET", "POST", "DELETE", "OPTIONS"}
        headers = {h.strip().lower() for h in request.headers.get("access-control-request-headers", "").split(",") if h.strip()}
        if (
            not allowed
            or request.headers.get("access-control-request-method") not in methods
            or not headers <= {"authorization", "content-type", "x-employee-subject"}
        ):
            return Response(status_code=403)
        response = Response(status_code=204)
        response.headers["Access-Control-Allow-Methods"] = "GET, POST, DELETE, OPTIONS"
        response.headers["Access-Control-Allow-Headers"] = "Authorization, Content-Type, X-Employee-Subject"
        response.headers["Access-Control-Max-Age"] = "300"
    else:
        response = await call_next(request)
    for header in ["access-control-allow-origin", "access-control-allow-credentials"]:
        if header in response.headers:
            del response.headers[header]
    response.headers["Vary"] = "Origin"
    response.headers["Cache-Control"] = "no-store"
    if allowed:
        response.headers["Access-Control-Allow-Origin"] = origin
        response.headers["Access-Control-Expose-Headers"] = "Retry-After, X-Request-ID"
    return response
