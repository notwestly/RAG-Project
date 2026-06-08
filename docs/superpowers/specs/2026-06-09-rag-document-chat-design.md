# RAG Document Chat App — Design Spec
**Date:** 2026-06-09

## Overview

A portfolio side project: users upload PDFs and chat with them using natural language. Under the hood the app chunks, embeds, and retrieves relevant content via vector similarity search + reranking before feeding context into Claude. Lives at `sideprojects/RAG/`.

---

## Stack

| Layer | Technology |
|---|---|
| Frontend | React + Tailwind CSS (Vite) |
| Backend | Python + FastAPI |
| PDF Parsing | PyMuPDF |
| Embeddings | Voyage AI `voyage-3` (1024 dims) |
| Reranker | Voyage AI `rerank-2` |
| LLM | Claude Sonnet 4.6 (streaming) |
| Vector DB | Supabase (pgvector extension) |

---

## Architecture

### Upload Flow

```
User uploads PDF
      ↓
FastAPI receives file
      ↓
PyMuPDF extracts raw text
      ↓
Chunk text (512 tokens, 50-token overlap)
      ↓
Voyage AI voyage-3 embeds each chunk → vector[1024]
      ↓
Store chunk text + vector + metadata in Supabase (pgvector)
```

### Chat Flow

```
User types question + React sends message + conversation history
      ↓
FastAPI embeds question via Voyage AI
      ↓
Supabase similarity search → top-20 candidate chunks
      ↓
Voyage rerank-2 re-scores candidates → top-5 selected
      ↓
System prompt + top-5 chunks + full conversation history → Claude Sonnet 4.6
      ↓
Claude streams tokens → FastAPI StreamingResponse → React renders live
```

**Streaming note:** FastAPI uses `anthropic.stream()` context manager (not `await complete()`). Never buffer the full response before sending. `STREAM_CHUNK_SIZE` is a config constant so it can be tuned without touching business logic.

**Conversation history:** Kept in React state (in-memory), sent with every request as a `messages` array. No database storage for chat history — session-scoped only.

---

## Project Structure

```
sideprojects/RAG/
├── backend/
│   ├── main.py           # FastAPI app, all routes
│   ├── config.py         # os.getenv() for all keys + tunable constants
│   ├── ingest.py         # PDF parsing, chunking, embedding, DB write
│   ├── retrieval.py      # pgvector similarity search + Voyage reranking
│   ├── chat.py           # Claude streaming call + history assembly
│   ├── db.py             # Supabase client, pgvector query helpers
│   ├── .env.example      # Template with empty values (committed)
│   ├── .env              # Actual keys (gitignored, never committed)
│   └── requirements.txt
└── frontend/
    ├── src/
    │   ├── App.jsx
    │   ├── components/
    │   │   ├── UploadPanel.jsx   # PDF drag-and-drop / file picker
    │   │   ├── ChatWindow.jsx    # Message list + input bar
    │   │   └── MessageBubble.jsx # Individual message, handles streaming tokens
    │   └── main.jsx
    ├── index.html
    ├── package.json
    └── vite.config.js
```

---

## config.py Pattern

```python
import os
from dotenv import load_dotenv

load_dotenv()

ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY")
VOYAGE_API_KEY    = os.getenv("VOYAGE_API_KEY")
SUPABASE_URL      = os.getenv("SUPABASE_URL")
SUPABASE_KEY      = os.getenv("SUPABASE_KEY")

CHUNK_SIZE        = 512
CHUNK_OVERLAP     = 50
TOP_K_RETRIEVE    = 20
TOP_K_RERANK      = 5
STREAM_CHUNK_SIZE = 1     # tokens per yield to frontend
```

API keys never appear in source files. `.env` is gitignored from the first commit.

---

## Data Model (Supabase)

```sql
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE documents (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  text NOT NULL,
  content     text NOT NULL,
  embedding   vector(1024),
  metadata    jsonb,           -- filename, page_number, chunk_index
  created_at  timestamptz DEFAULT now()
);

-- Index is optional for v1 (portfolio volumes are in the hundreds of rows, not millions).
-- If added: rule of thumb is lists = sqrt(row_count). Use lists = 10 for ~100 chunks.
-- Skip entirely until query latency is actually a problem.
CREATE INDEX ON documents
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 10);
```

`session_id` ties chunks to an upload session so the similarity search is scoped to the active document.

---

## API Routes

| Method | Path | Description | Response |
|---|---|---|---|
| `POST` | `/upload` | Accepts PDF, runs ingest pipeline, returns `session_id` | `application/json` |
| `POST` | `/chat` | Accepts `{session_id, messages}`, streams tokens | `text/event-stream` (SSE) |
| `DELETE` | `/session/{session_id}` | Cleans up chunks for a session from Supabase | `application/json` |

**CORS:** `main.py` must mount `CORSMiddleware` before any routes. Vite dev server runs on `localhost:5173`, FastAPI on `localhost:8000` — without this every browser request fails with a CORS error. Allow origins `["http://localhost:5173"]` in dev, tighten in production.

---

## Component Responsibilities

**`ingest.py`** — One job: take a file path, return nothing (side effect: chunks in Supabase). Handles PyMuPDF extraction, chunking logic, Voyage embedding calls, and DB writes.

**`retrieval.py`** — One job: take a query string + session_id, return the top-k chunk texts. Handles embedding the query, pgvector search, and Voyage reranking.

**`chat.py`** — One job: take retrieved chunks + conversation history, yield streamed tokens. Assembles the system prompt with chunks, calls Claude via `anthropic.stream()`, yields each delta.

**`db.py`** — One job: Supabase client setup and raw pgvector query helpers. Nothing else.

---

## Error Handling

- Upload: validate PDF mime type before processing; return 400 for non-PDFs
- Empty PDF (no extractable text): return 422 with clear message
- Supabase write failure: return 500, do not leave partial chunks
- Voyage API error: propagate as 502 with message
- Claude stream error mid-response: frontend shows partial response + error indicator

---

## .gitignore Additions

```
sideprojects/RAG/backend/.env
sideprojects/RAG/frontend/node_modules/
sideprojects/RAG/frontend/dist/
__pycache__/
*.pyc
```

---

## Future Extensions (out of scope for v1)

- Authentication (session tied to a user account)
- Multiple simultaneous documents per session
- Contextual RAG (Claude-generated chunk context before embedding)
- Job auto-applier reusing the same Supabase + Voyage + Claude stack
