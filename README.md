# Titan — Enterprise RAG Platform

Telemetry, evaluation, and observability for enterprise-scale
retrieval-augmented generation.

## About this scaffold

The original brief describes a platform on the scale of a full AI
infrastructure product (comparable to what a whole team at a company like
Databricks or Anthropic would ship over quarters, not one sitting). Rather
than generating thousands of lines of unusable placeholder code that only
*look* complete, this repo is a **real, runnable foundation**:

- a working FastAPI backend with the actual module boundaries the spec
  calls for (ingestion, chunking, embedding, retrieval, reranking, LLM
  gateway, citation, hallucination detection, evaluation, telemetry),
  each with a clean interface and pluggable providers
- a working Next.js frontend with a real homepage and five functional
  pages (chat, documents, experiments, telemetry, dashboard)
- Postgres schema, docker-compose, and the wiring between them

Everywhere a component would require a genuinely large implementation
(actual OCR, real embedding model inference, a production reranker, NLI-
based hallucination scoring, a full experiment scheduler), the code has a
clear typed interface and a `NotImplementedError` with a comment on exactly
what to wire in — so you can build the platform out incrementally, service
by service, on top of an architecture that already matches the spec.

## Repo layout

```
titan/
├── backend/           FastAPI service
│   └── app/
│       ├── api/v1/routes/     documents, search, chat, evaluation, experiments, telemetry, auth
│       ├── services/          ingestion, chunking, embedding, retrieval, reranking,
│       │                      llm_gateway, citation, hallucination, evaluation
│       ├── db/                SQLAlchemy models + async session
│       ├── schemas/           Pydantic request/response models
│       └── core/              config, logging
├── frontend/           Next.js 14 + TypeScript + Tailwind
│   └── app/            /, /chat, /documents, /experiments, /telemetry, /dashboard
├── docker-compose.yml  Postgres, Redis, Qdrant, backend, frontend, otel/prometheus/grafana
└── docs/               PRD and architecture notes
```

## Run it

```bash
docker compose up --build
```

- Frontend: http://localhost:3000
- Backend docs (OpenAPI): http://localhost:8000/docs
- Grafana: http://localhost:3001
- Qdrant dashboard: http://localhost:6333/dashboard

Or run each side locally without Docker:

```bash
# backend
cd backend
pip install -r requirements.txt --break-system-packages
uvicorn app.main:app --reload

# frontend
cd frontend
npm install
npm run dev
```

## Suggested build order

1. **Ingestion + chunking + embedding** for one source type (upload) and
   one embedding model (BGE) — get documents indexed end-to-end.
2. **Hybrid retrieval + citation engine** — get a search endpoint returning
   real, cited results.
3. **LLM gateway + hallucination detector** — wire `/chat` to an actual
   model and score groundedness.
4. **Telemetry** — persist `StageEvent`s per request so `/telemetry/{id}`
   returns real traces instead of the current in-memory stub.
5. **Evaluation + Experiments** — add a labeled gold set, compute
   Recall@K/NDCG/faithfulness per run, populate the leaderboard.
6. **Auth, multi-tenancy, RBAC** — harden before any real enterprise data
   goes in.

See `docs/PRD.md` and `docs/ARCHITECTURE.md` for the fuller design.
