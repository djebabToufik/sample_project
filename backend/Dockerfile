# Backend image: uv builds the virtualenv, the final image only holds Python, the virtualenv and the code.

# --- Build stage -----------------------------------------------------------------------------------
FROM python:3.13.17-slim-trixie AS build

COPY --from=ghcr.io/astral-sh/uv:0.11.16 /uv /usr/local/bin/uv

ENV UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    UV_PYTHON_DOWNLOADS=never \
    UV_PROJECT_ENVIRONMENT=/opt/venv

WORKDIR /app
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project

# --- Runtime stage ---------------------------------------------------------------------------------
FROM python:3.13.17-slim-trixie

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PATH=/opt/venv/bin:$PATH

# The app runs as an unprivileged user (fixed id 10001); it only writes collected static files and
# uploaded media (docker-compose.yaml keeps both in named volumes).
RUN groupadd --system --gid 10001 app && useradd --system --uid 10001 --gid app --no-create-home app \
    # pip is not needed at runtime (packages come from the virtualenv); fewer packages, fewer vulnerabilities.
    && python -m pip uninstall --yes --quiet pip

COPY --from=build /opt/venv /opt/venv

WORKDIR /app
COPY --chown=app:app . /app/
RUN mkdir -p /app/staticapi /app/media && chown app:app /app/staticapi /app/media \
    && chmod +x /app/entrypoint.sh

# Refuse to build an image that contains a secrets file (see .dockerignore).
RUN found="$(find /app -name .env -o -name '.env.*' -o -name '*.env')"; \
    if [ -n "$found" ]; then echo "Secret file(s) copied into the image: $found" >&2; exit 1; fi

USER app

ENTRYPOINT ["/app/entrypoint.sh"]

# --no-control-socket: gunicorn's control interface is not used (it would need a home folder).
CMD ["gunicorn", "backend.asgi:application", "--bind", "0.0.0.0:8000", "-k", "uvicorn_worker.UvicornWorker", "--no-control-socket"]
