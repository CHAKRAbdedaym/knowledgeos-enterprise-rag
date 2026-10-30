FROM python:3.13-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt && useradd --uid 10001 --create-home appuser
COPY --chown=appuser:appuser app ./app
COPY --chown=appuser:appuser migrations ./migrations
COPY --chown=appuser:appuser alembic.ini entrypoint.sh ./
RUN mkdir -p /app/uploads /app/model-cache && chown -R appuser:appuser /app/uploads /app/model-cache && chmod +x /app/entrypoint.sh
USER appuser
EXPOSE 8000
ENTRYPOINT ["/app/entrypoint.sh"]
