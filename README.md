# RAG Docs Assistant

> **Assignment selected: Option 3 — Hard Level (AI-Powered Technical Documentation Assistant).**

A scalable, AI-powered service that answers natural-language questions about a
large set of technical documents using a **Retrieval-Augmented Generation (RAG)**
pipeline. Built as small, independently deployable microservices that
communicate through a message queue and share a PostgreSQL database (relational
**and** vector, via `pgvector`).

It runs **out of the box with no API key** thanks to a built-in `mock` LLM mode,
and switches to a real LLM (Gemini or OpenAI) with a single config change.

---

## Table of Contents
1. [Architecture overview](#architecture-overview)
2. [Service communication flow](#service-communication-flow)
3. [Full RAG workflow](#full-rag-workflow)
4. [Database schema](#database-schema)
5. [Tech stack](#tech-stack)
6. [Quick start (Docker — recommended)](#quick-start-docker--recommended)
7. [Using the API](#using-the-api)
8. [Using a real LLM (Gemini / OpenAI)](#using-a-real-llm-gemini--openai)
9. [Running locally without Docker](#running-locally-without-docker)
10. [Observability](#observability)
11. [Scaling & fault tolerance](#scaling--fault-tolerance)
12. [Design trade-offs](#design-trade-offs)
13. [Project structure](#project-structure)
14. [Deployment (free tier)](#deployment-free-tier)

---

## Architecture overview

Three stateless services around two stateful backing services (Postgres + RabbitMQ):

- **Ingestion Service** (HTTP API) — accepts document uploads, stores a
  `pending` record, and publishes an ingestion job to the queue. Returns
  immediately (`202 Accepted`) so uploads are non-blocking.
- **Worker Service** (background consumer) — does the heavy lifting:
  extract text → chunk → generate embeddings → store. Retries transient
  failures with exponential backoff.
- **Query Service** (HTTP API) — runs the RAG read path: embed the question,
  vector-search the most relevant chunks, ground an LLM, return an answer with
  citations.

```mermaid
flowchart LR
    Client([Client])

    subgraph Services
      ING[Ingestion Service<br/>:4001]
      WRK[Worker Service<br/>background]
      QRY[Query Service<br/>:4002]
    end

    MQ[(RabbitMQ<br/>document.ingest)]
    PG[(PostgreSQL + pgvector<br/>documents, chunks)]
    LLM{{LLM / Embeddings<br/>mock · gemini · openai}}

    Client -- "POST /documents (upload)" --> ING
    ING -- "INSERT status=pending" --> PG
    ING -- "publish job" --> MQ
    MQ -- "consume job" --> WRK
    WRK -- "embeddings" --> LLM
    WRK -- "store chunks + vectors" --> PG

    Client -- "POST /query (question)" --> QRY
    QRY -- "embed question" --> LLM
    QRY -- "vector search top-K" --> PG
    QRY -- "ground + generate" --> LLM
```

---

## Service communication flow

**Write path (asynchronous ingestion):**
1. Client uploads a file to `POST /documents` on the **Ingestion Service**.
2. Ingestion inserts a `documents` row with `status = pending` and **publishes**
   an `IngestJob` (document id + base64 content) to the `document.ingest` queue.
3. Client gets `202 Accepted` immediately and can poll `GET /documents/:id`.
4. The **Worker** consumes the job, sets `status = processing`, extracts text,
   chunks it, generates embeddings, and stores chunks + vectors in one
   transaction, then sets `status = completed` (or `failed`).

**Read path (synchronous query):**
1. Client sends a question to `POST /query` on the **Query Service**.
2. Query embeds the question, runs a cosine-similarity search over `chunks`,
   assembles the top-K chunks as context, and asks the LLM to answer using only
   that context.
3. Response contains the `answer` plus `sources` (filenames + chunk indexes).

Services never call each other directly on the write path — they are decoupled
by the queue, so the worker can be scaled, restarted, or fail independently.

---

## Full RAG workflow

| Stage | Where | What happens |
|------|-------|--------------|
| **Ingest** | Ingestion | Persist metadata, enqueue job |
| **Extract** | Worker | PDF → `pdf-parse`, DOCX → `mammoth`, MD/TXT → utf-8 |
| **Chunk** | Worker | Sentence-aware chunks (`CHUNK_SIZE`, `CHUNK_OVERLAP`) with overlap to preserve cross-boundary meaning |
| **Embed** | Worker | One vector per chunk via the configured provider |
| **Store** | Worker | Text + metadata in `chunks`; vectors in `pgvector` (same row) |
| **Retrieve** | Query | Embed question → `embedding <=> query` cosine search → top-K chunks |
| **Generate** | Query | LLM answers grounded strictly in retrieved context |
| **Cite** | Query | Return source filenames + chunk indexes |

---

## Database schema

PostgreSQL serves as **both** the relational store and the vector store
(`pgvector`). Schema is created automatically on service startup (see
`src/db/migrate.ts`).

```sql
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE documents (
  id           UUID PRIMARY KEY,
  filename     TEXT NOT NULL,
  mime_type    TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'pending', -- pending|processing|completed|failed
  chunk_count  INTEGER NOT NULL DEFAULT 0,
  error        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE chunks (
  id           UUID PRIMARY KEY,
  document_id  UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  chunk_index  INTEGER NOT NULL,
  content      TEXT NOT NULL,
  embedding    vector(768) NOT NULL,   -- dimension = EMBEDDING_DIM
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_chunks_document_id ON chunks(document_id);
CREATE INDEX idx_chunks_embedding
  ON chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
```

- `documents` — one row per uploaded file; tracks ingestion lifecycle.
- `chunks` — text chunks + their embeddings; `ivfflat` index enables fast
  approximate nearest-neighbour cosine search.

---

## Tech stack

- **Language:** Node.js 20 + TypeScript (strict)
- **HTTP:** Express
- **Queue:** RabbitMQ (`amqplib`)
- **DB:** PostgreSQL 16 + `pgvector`
- **AI:** pluggable provider — `mock` (default), **Gemini**, or **OpenAI**
- **Validation:** Zod
- **Logging:** Pino (structured JSON)
- **Tracing:** OpenTelemetry (opt-in)
- **Containerization:** Docker + Docker Compose

---

## Quick start (Docker — recommended)

**Prerequisites:** Docker Desktop.

```bash
cd rag-docs-assistant
cp .env.example .env        # Windows PowerShell: copy .env.example .env
docker compose up --build
```

This starts Postgres (+pgvector), RabbitMQ, and all three services. Schema is
created automatically. Defaults use `mock` AI mode, so **no API key is needed**.

| Service | URL |
|--------|-----|
| Ingestion API | http://localhost:4001 |
| Query API | http://localhost:4002 |
| RabbitMQ UI | http://localhost:15672 (guest / guest) |

Health checks: `GET http://localhost:4001/health`, `GET http://localhost:4002/ready`.

---

## Using the API

All `/documents` and `/query` endpoints require the header
`x-api-key: dev-secret-key` (configurable via `API_KEY`).

**1. Upload a document**
```bash
curl -X POST http://localhost:4001/documents \
  -H "x-api-key: dev-secret-key" \
  -F "file=@sample-docs/sample.md"
```
Response (`202`): `{ "document": { "id": "...", "status": "pending", ... } }`

**2. Check ingestion status**
```bash
curl http://localhost:4001/documents \
  -H "x-api-key: dev-secret-key"
```
Wait until the document shows `"status": "completed"`.

**3. Ask a question (RAG)**
```bash
curl -X POST http://localhost:4002/query \
  -H "x-api-key: dev-secret-key" \
  -H "Content-Type: application/json" \
  -d "{\"question\": \"How does rate limiting work?\"}"
```
Response:
```json
{
  "answer": "The public API allows 100 requests per minute per API key...",
  "sources": [{ "documentId": "...", "filename": "sample.md", "chunkIndex": 1 }]
}
```

> In `mock` mode the answer is an extractive snippet of the retrieved context
> (proves the pipeline works). Switch to a real LLM for natural-language answers.

---

## Using a real LLM (Gemini / OpenAI)

Edit `.env` and restart (`docker compose up --build`).

**Gemini (free tier — recommended):** get a key at
https://aistudio.google.com/app/apikey
```env
LLM_PROVIDER=gemini
EMBEDDING_PROVIDER=gemini
EMBEDDING_DIM=768          # text-embedding-004 outputs 768 dims (matches default)
GEMINI_API_KEY=your_key_here
```

**OpenAI:**
```env
LLM_PROVIDER=openai
EMBEDDING_PROVIDER=openai
EMBEDDING_DIM=1536         # text-embedding-3-small outputs 1536 dims
OPENAI_API_KEY=your_key_here
```

> Changing `EMBEDDING_DIM` changes the vector column size. If you switch
> providers after ingesting data, recreate the volume:
> `docker compose down -v` then re-upload your documents.

---

## Running locally without Docker

You still need Postgres (with pgvector) and RabbitMQ reachable. The easiest path
is to run just those two with Docker and the Node services on your host:

```bash
docker compose up postgres rabbitmq      # backing services only
npm install

# When Node runs on your host machine, use localhost:
# DATABASE_URL=postgres://rag:ragpass@localhost:5432/ragdb
# RABBITMQ_URL=amqp://guest:guest@localhost:5672
npm run build

# in three terminals:
npm run start:ingestion
npm run start:worker
npm run start:query
```

For development with hot reload use `npm run dev:ingestion`, `dev:worker`, `dev:query`.

---

## Observability

- **Structured logging:** every service logs JSON via Pino, tagged with a
  `service` field; HTTP requests are auto-logged with `pino-http`.
- **Health checks:** `GET /health` (liveness) and `GET /ready` (DB reachable)
  on both APIs; the worker exposes `/health` on its internal port.
- **Request tracing:** OpenTelemetry auto-instrumentation (HTTP, Express, pg,
  amqplib). Opt-in via `OTEL_ENABLED=true` + an OTLP endpoint, so there is no
  overhead by default.

---

## Scaling & fault tolerance

- **Horizontal scaling:** all three services are stateless and share state only
  through Postgres + RabbitMQ. Scale workers with
  `docker compose up --scale worker=4`. The queue's `prefetch=1` gives fair
  round-robin dispatch across workers.
- **Backpressure:** uploads are decoupled from processing by the durable queue,
  so traffic spikes are absorbed instead of overwhelming the embedding step.
- **Retries:** embedding/LLM calls use exponential backoff with jitter
  (`src/shared/retry.ts`). Messages and the queue are durable/persistent, so a
  broker or worker restart does not lose jobs.
- **Failure isolation:** a document that cannot be processed is marked `failed`
  with the error message and the message is acked, preventing poison-message
  redelivery loops while keeping the failure observable via the API.
- **DB performance:** `ivfflat` ANN index for vectors; B-tree index on
  `document_id`; chunk writes are transactional (all-or-nothing per document).

---

## Design trade-offs

- **Monorepo, multiple entrypoints vs. separate repos:** one codebase and one
  Docker image run all three services (selected by the start command). This
  keeps shared code (config, logging, repositories) DRY and the project easy to
  read, while still deploying as independent containers. A larger org might
  split these into separate repos/pipelines.
- **pgvector vs. dedicated vector DB (Pinecone/Milvus):** pgvector keeps
  relational + vector data in one transactional store — simpler ops, free tier,
  and good up to millions of vectors. A dedicated vector DB would scale further
  but adds another system to run and reconcile.
- **Base64 payload in the queue vs. object storage:** files are sent inline in
  the job message for simplicity (bounded to 20 MB). At scale you'd upload to
  object storage (e.g. S3/Supabase Storage) and enqueue only a reference.
- **In-worker retry vs. delay/dead-letter queue:** transient errors are retried
  in-process with backoff; terminal failures are marked `failed`. A
  production-hardened version would add a RabbitMQ dead-letter + delayed-retry
  queue for cross-restart retry scheduling.
- **Mock AI provider:** ships so the system runs and is testable with zero
  secrets/cost. Real semantic quality requires Gemini/OpenAI (one env change).

---

## Project structure

```
rag-docs-assistant/
├─ docker-compose.yml         # postgres + rabbitmq + 3 services
├─ Dockerfile                 # single multi-stage image for all services
├─ .env.example
├─ sample-docs/sample.md      # try the pipeline immediately
└─ src/
   ├─ config/                 # centralized, validated configuration (Zod)
   ├─ db/                     # pool, migrations, pgvector helper
   ├─ queue/                  # RabbitMQ connect/publish/consume
   ├─ llm/                    # provider abstraction: mock | gemini | openai
   ├─ processing/             # text extraction + chunking
   ├─ repositories/           # SQL data-access (documents, chunks)
   ├─ shared/                 # logger, errors, http, health, retry, tracing, types
   ├─ ingestion/              # controller → service → routes → server  (API :4001)
   ├─ query/                  # controller → service → routes → server  (API :4002)
   ├─ worker/                 # queue consumer → processing pipeline
   └─ scripts/migrate.ts      # standalone migration runner
```

Each service follows a clean **Controller → Service → Repository** layering.