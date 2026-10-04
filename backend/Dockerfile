# ---- Build stage ----
FROM python:3.12-slim AS builder

WORKDIR /build

COPY requirements.txt .

RUN pip install --no-cache-dir --prefix=/install -r requirements.txt


# ---- Runtime stage ----
FROM python:3.12-slim

WORKDIR /app

# Install curl for health checks
RUN apt-get update \
    && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

# Create non-root application user
RUN useradd --create-home --uid 10001 appuser

# Copy installed dependencies
COPY --from=builder /install /usr/local

# Copy application files with correct ownership
COPY --chown=appuser:appuser . .

EXPOSE 8000

# Run application as non-root user
USER appuser

# Check backend health
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
    CMD curl -f http://127.0.0.1:8000/v1/health || exit 1

# Start FastAPI
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]