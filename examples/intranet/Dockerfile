FROM python:3.13-slim
WORKDIR /demo
RUN useradd --uid 10002 --create-home portal
COPY --chown=portal:portal examples/intranet /demo/examples/intranet
COPY --chown=portal:portal widget /demo/widget
USER portal
ENV PORTAL_HOST=0.0.0.0 PORTAL_PORT=8090 PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
EXPOSE 8090
HEALTHCHECK --interval=30s --timeout=3s CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8090/health', timeout=2)"
CMD ["python", "/demo/examples/intranet/server.py"]
