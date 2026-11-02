from fastapi import FastAPI, Depends
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse, HTMLResponse
from fastapi.openapi.docs import get_swagger_ui_html
from app.auth import router as auth_router, require_admin
from starlette.exceptions import HTTPException as StarletteHTTPException
from app.config import get_settings
from app.logging_config import configure_logging
from app.routes import app as router
from app.security import http_error, validation_error, unexpected_error, limits
from app.employee_cors import employee_cors
from app.enterprise import admin as integration_admin, access as document_access, api as integration_api

configure_logging()

app = FastAPI(title="KnowledgeOS API", version="1.0.0", docs_url=None, openapi_url=None)
app.add_middleware(
    CORSMiddleware,
    allow_origins=get_settings().cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "X-CSRF-Token"],
)
app.add_exception_handler(StarletteHTTPException, http_error)
app.add_exception_handler(RequestValidationError, validation_error)
app.add_exception_handler(Exception, unexpected_error)
app.middleware("http")(limits)
app.include_router(auth_router)
app.include_router(router)
app.include_router(integration_admin)
app.include_router(document_access)
app.include_router(integration_api)



@app.get("/api/openapi.json", dependencies=[Depends(require_admin)], include_in_schema=False)
def protected_schema():
    return app.openapi()


@app.get("/api/docs", dependencies=[Depends(require_admin)], include_in_schema=False, response_class=HTMLResponse)
def protected_docs():
    return get_swagger_ui_html(openapi_url="/api/openapi.json", title="KnowledgeOS Admin API")


@app.get("/docs", dependencies=[Depends(require_admin)], include_in_schema=False)
def docs_redirect():
    return RedirectResponse("/api/docs")

app.middleware("http")(employee_cors)
