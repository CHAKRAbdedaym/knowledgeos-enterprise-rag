from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse
from starlette.exceptions import HTTPException as StarletteHTTPException
from app.config import get_settings
from app.routes import app as router
from app.security import http_error, validation_error, unexpected_error, limits

app = FastAPI(title="KnowledgeOS API", version="1.0.0", docs_url="/api/docs", openapi_url="/api/openapi.json")
app.add_middleware(
    CORSMiddleware,
    allow_origins=get_settings().cors_origins,
    allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type"],
)
app.add_exception_handler(StarletteHTTPException, http_error)
app.add_exception_handler(RequestValidationError, validation_error)
app.add_exception_handler(Exception, unexpected_error)
app.middleware("http")(limits)
app.include_router(router)


@app.get("/docs", include_in_schema=False)
def docs_redirect():
    return RedirectResponse("/api/docs")
