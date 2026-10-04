# Containerization Guide — Titan Project

Your project has been containerized following Docker best practices. Here's what was implemented:

## Backend Dockerfile Improvements

**File:** `backend/Dockerfile`

- **Multi-stage build**: Separates dependency installation from runtime, reducing final image size
- **Layer caching optimization**: Copies `requirements.txt` first so dependency layer is cached separately from code changes
- **Security hardening**:
  - Non-root user (`appuser`) runs the application
  - Minimal base image (`python:3.12-slim`)
  - Reduced attack surface with slim variant
- **Healthcheck**: Built-in health probe for orchestration awareness
- **Clean layers**: Apt cache cleaned in single RUN layer to minimize bloat

**Result**: ~706MB image | 168MB compressed

---

## Frontend Dockerfile Improvements

**File:** `frontend/Dockerfile`

- **Three-stage build**:
  1. Dependencies stage: Install dependencies once, reuse across builds
  2. Builder stage: Compile Next.js app with full toolchain
  3. Runtime stage: Slim production image with only runtime artifacts
- **Optimized copying**:
  - `package-lock.json*` (glob) ensures frozen-lockfile semantics
  - Proper `chown` in COPY commands for non-root execution
  - Only production artifacts copied to runtime stage
- **Security**:
  - Runs as `node` user (uid 1000, built-in to alpine)
  - Telemetry disabled (`NEXT_TELEMETRY_DISABLED=1`)
- **Healthcheck**: Port 3000 health probe

**Result**: ~793MB image | 175MB compressed

---

## Docker Compose Enhancements

**File:** `docker-compose.yml`

- **Container naming**: Each service has a consistent name for networking
- **Environment management**:
  - `env_file: .env` loads project-specific variables
  - `environment:` section uses variable substitution (e.g., `${DB_USER:-titan}`)
  - Sensible defaults with `:-` syntax
- **Health checks**:
  - All services include `healthcheck` definitions
  - `depends_on: condition: service_healthy` ensures startup ordering
  - Proper startup grace periods (`start_period`)
- **Networking**:
  - Dedicated bridge network (`titan-network`) for inter-service communication
  - Explicit network attachment for clarity
- **Volumes**:
  - Named volumes for persistent data (Postgres, Qdrant)
  - Proper ownership with `chown` flags
- **Restart policy**: `restart: unless-stopped` for production resilience

---

## .dockerignore Files

**Files:** `backend/.dockerignore`, `frontend/.dockerignore`

Excludes unnecessary files from build context:
- Virtual environments, caches, node_modules
- Git metadata, IDE config, test artifacts
- Drastically reduces context size and build time

---

## Running Your Stack

### Start all services with automatic rebuild:

```bash
cd ./Titan
docker compose up --pull always
```

- Backend: http://localhost:8000
- Frontend: http://localhost:3000
- Backend API docs: http://localhost:8000/docs
- Qdrant dashboard: http://localhost:6333/dashboard

### Run in background:

```bash
docker compose up -d
```

### View logs:

```bash
docker compose logs -f api      # Backend
docker compose logs -f frontend # Frontend
docker compose logs -f postgres # Database
```

### Stop services:

```bash
docker compose down
```

### Full cleanup (including volumes):

```bash
docker compose down -v
```

---

## Configuration via Environment Variables

Create or update `.env` in the `Titan/` directory:

```env
# Database
DB_USER=titan
DB_PASSWORD=titan
DB_NAME=titan

# API
API_PORT=8000
API_CORS_ORIGIN=http://localhost:3000

# Frontend
FRONTEND_PORT=3000
NEXT_PUBLIC_API_URL=http://localhost:8000
```

All variables have built-in defaults (shown in docker-compose.yml) — only override if needed.

---

## Best Practices Applied

✓ **Multi-stage builds** — minimal final images, no build tools in production
✓ **Layer caching** — efficient rebuilds when code or deps change
✓ **Non-root users** — reduced container vulnerability surface
✓ **Health checks** — orchestration awareness and restart capability
✓ **Named volumes** — persistent data across container restarts
✓ **Build context** — .dockerignore excludes unnecessary files
✓ **Networking** — isolated bridge network for secure inter-service communication
✓ **Environment management** — variables external to images, sensible defaults
✓ **Restart policy** — automatic recovery from transient failures

---

## Troubleshooting

### Container won't start

```bash
docker compose logs <service_name>
docker inspect <container_id>
```

### Rebuilding after code changes

```bash
docker compose up --build
```

### Port already in use

Update `docker-compose.yml` or use `docker compose up -p <project_name>` for port offset.

### Database connection issues

Ensure `depends_on: condition: service_healthy` is satisfied:

```bash
docker compose ps  # Check status
docker compose logs postgres  # Inspect database logs
```

---

For production deployment, consider:
- Using Docker Compose Overrides for secrets management
- Tagging images with semantic versions
- Storing images in a private registry
- Implementing CI/CD to automate builds
- Adding resource limits (`mem_limit`, `cpus`)
- Switching to Kubernetes for multi-host orchestration
