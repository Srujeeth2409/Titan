# ---- Build stage ----
# syntax=docker/dockerfile:1
FROM python:3.12-slim AS builder

WORKDIR /build
COPY requirements.txt .
RUN --mount=type=cache,target=/root/.cache/pip \
    pip install --prefix=/install --default-timeout=120 --retries=10 -r requirements.txt
# ---- Runtime stage ----
FROM python:3.12-slim

WORKDIR /app

# Install curl for healthcheck
RUN apt-get update && apt-get install -y --no-install-recommends curl && rm -rf /var/lib/apt/lists/*

COPY --from=builder /install /usr/local
COPY . .

EXPOSE 8000

# No --reload in production container
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
