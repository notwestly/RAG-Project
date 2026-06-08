# RAG Document Chat — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a full-stack RAG app where users upload PDFs and chat with them using Claude, Voyage AI embeddings, and Supabase pgvector.

**Architecture:** Python FastAPI backend handles PDF ingestion (PyMuPDF → Voyage embed → Supabase pgvector), retrieval (pgvector similarity + Voyage rerank), and Claude streaming. React + Vite frontend handles upload and streaming chat UI. No direct Supabase access from the frontend — all goes through FastAPI.

**Tech Stack:** Python 3.11+, FastAPI, PyMuPDF, voyageai, anthropic, supabase-py, React 18, Vite, Tailwind CSS

---

## File Map

```
(project root: c:\Users\West\Documents\RAG Project\)
├── .gitignore
├── README.md
├── db_setup.sql                    # Run once in Supabase SQL editor
├── backend/
│   ├── .env                        # GITIGNORED — actual secrets
│   ├── .env.example                # Committed — empty template
│   ├── requirements.txt
│   ├── config.py                   # All env vars + tunable constants
│   ├── db.py                       # Supabase client + pgvector helpers
│   ├── ingest.py                   # PDF parse → chunk → embed → store
│   ├── retrieval.py                # embed query → pgvector search → rerank
│   ├── chat.py                     # assemble prompt → Claude stream
│   ├── main.py                     # FastAPI app + all routes
│   └── tests/
│       ├── test_ingest.py
│       ├── test_retrieval.py
│       └── test_chat.py
└── frontend/
    ├── index.html
    ├── package.json
    ├── vite.config.js
    ├── tailwind.config.js
    ├── postcss.config.js
    └── src/
        ├── main.jsx
        ├── App.jsx
        └── components/
            ├── UploadPanel.jsx     # PDF drag-and-drop/file picker
            ├── ChatWindow.jsx      # Message list + streaming input bar
            └── MessageBubble.jsx  # Individual bubble, renders streaming tokens
```

---

## Phase 1: Project Scaffolding

### Task 1: Supabase — enable pgvector and run db_setup.sql ⚡ DO THIS FIRST

**Files:**
- Create: `db_setup.sql`

- [ ] **Step 1: Create `db_setup.sql`**

```sql
-- Enable pgvector extension (may already be enabled)
CREATE EXTENSION IF NOT EXISTS vector;

-- Documents table: one row per chunk
CREATE TABLE IF NOT EXISTS documents (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  text NOT NULL,
  content     text NOT NULL,
  embedding   vector(1024),
  metadata    jsonb,
  created_at  timestamptz DEFAULT now()
);

-- RPC function for vector similarity search scoped to a session
CREATE OR REPLACE FUNCTION match_documents(
  query_embedding vector(1024),
  match_session_id text,
  match_count int
)
RETURNS TABLE (
  id uuid,
  content text,
  metadata jsonb,
  similarity float
)
LANGUAGE sql STABLE
AS $$
  SELECT
    id,
    content,
    metadata,
    1 - (embedding <=> query_embedding) AS similarity
  FROM documents
  WHERE session_id = match_session_id
  ORDER BY embedding <=> query_embedding
  LIMIT match_count;
$$;
```

- [ ] **Step 2: Run it in Supabase**

Go to [Supabase Dashboard](https://supabase.com/dashboard) → your project → SQL Editor → paste the entire file → click Run.

Expected: No errors. Confirm in Table Editor that `documents` table exists with columns: `id`, `session_id`, `content`, `embedding`, `metadata`, `created_at`.

- [ ] **Step 3: Verify pgvector is active**

In the SQL Editor run:

```sql
SELECT extname FROM pg_extension WHERE extname = 'vector';
```

Expected: one row returned with `vector`.

---

### Task 2: .gitignore, .env files, README

**Files:**
- Create: `.gitignore`
- Create: `backend/.env`
- Create: `backend/.env.example`
- Create: `README.md`

- [ ] **Step 1: Create `.gitignore`**

```
backend/.env
frontend/node_modules/
frontend/dist/
__pycache__/
*.pyc
*.pyo
.pytest_cache/
*.egg-info/
.venv/
venv/
```

- [ ] **Step 2: Create `backend/.env` with real secrets**

```
ANTHROPIC_API_KEY=API Key here
VOYAGE_API_KEY=pa-LP4YerqnocsjLt9St-Umyj8iMGcSnC17mzG3YdP0kyb
SUPABASE_URL=https://llecfaxdnizsplvgafrf.supabase.co
SUPABASE_KEY=sb_publishable_JvlZSP-NG6btKAf9T0IaXw_ZxWr7KxN
```

- [ ] **Step 3: Create `backend/.env.example` (committed, no real values)**

```
ANTHROPIC_API_KEY=
VOYAGE_API_KEY=
SUPABASE_URL=
SUPABASE_KEY=
```

- [ ] **Step 4: Create `README.md`**

```markdown
# RAG Document Chat

Upload a PDF and chat with it. Uses Voyage AI embeddings + reranking, Supabase pgvector, and Claude for streaming responses.

## Stack

| Layer | Tech |
|---|---|
| Frontend | React + Tailwind (Vite) |
| Backend | Python + FastAPI |
| PDF Parsing | PyMuPDF |
| Embeddings | Voyage AI `voyage-3` |
| Reranker | Voyage AI `rerank-2` |
| LLM | Claude Sonnet 4.6 (streaming) |
| Vector DB | Supabase (pgvector) |

## Setup

### 1. Database

Run `db_setup.sql` in your Supabase SQL editor (Dashboard → SQL Editor).

### 2. Backend

```bash
cd backend
python -m venv venv
# Windows:
venv\Scripts\activate
# Mac/Linux:
source venv/bin/activate

pip install -r requirements.txt
cp .env.example .env
# Fill in your keys in .env
uvicorn main:app --reload --port 8000
```

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
# Opens at http://localhost:5173
```

## Usage

1. Open `http://localhost:5173`
2. Drag and drop (or click to select) a PDF
3. Wait for upload + indexing to complete
4. Type questions in the chat box
```

- [ ] **Step 5: Verify .env is gitignored**

```bash
git init
git status
```

Expected: `.env` should NOT appear in untracked files. `.env.example` should appear.

---

## Phase 2: Backend Foundation

### Task 3: `requirements.txt` and `config.py`

**Files:**
- Create: `backend/requirements.txt`
- Create: `backend/config.py`

- [ ] **Step 1: Create `backend/requirements.txt`**

```
fastapi==0.115.5
uvicorn[standard]==0.32.1
python-multipart==0.0.17
pydantic==2.10.3
python-dotenv==1.0.1
pymupdf==1.24.14
voyageai==0.3.2
anthropic==0.40.0
supabase==2.10.0
pytest==8.3.4
pytest-asyncio==0.24.0
httpx==0.28.1
```

- [ ] **Step 2: Create virtual environment and install**

```bash
cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
```

Expected: All packages install with no errors.

- [ ] **Step 3: Create `backend/config.py`**

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
STREAM_CHUNK_SIZE = 1
```

- [ ] **Step 4: Verify config loads**

Run from `backend/` with venv active:

```bash
python -c "import config; print(config.SUPABASE_URL)"
```

Expected: prints `https://llecfaxdnizsplvgafrf.supabase.co`

---

### Task 4: `db.py` — Supabase client + pgvector helpers

**Files:**
- Create: `backend/db.py`
- Create: `backend/tests/test_db_smoke.py` (manual smoke test only, not automated)

- [ ] **Step 1: Write failing test for `store_chunks` and `delete_session`**

Create `backend/tests/__init__.py` (empty).

Create `backend/tests/test_ingest.py` (we'll add more in Task 5, just the db-layer test here):

```python
import pytest
from unittest.mock import MagicMock, patch

def test_store_chunks_calls_supabase_insert():
    mock_client = MagicMock()
    mock_client.table.return_value.insert.return_value.execute.return_value = MagicMock()

    with patch("db.get_client", return_value=mock_client):
        import db
        db.store_chunks([{"session_id": "s1", "content": "hello", "embedding": [0.1] * 1024}])

    mock_client.table.assert_called_once_with("documents")
    mock_client.table.return_value.insert.assert_called_once()

def test_delete_session_calls_supabase_delete():
    mock_client = MagicMock()
    mock_client.table.return_value.delete.return_value.eq.return_value.execute.return_value = MagicMock()

    with patch("db.get_client", return_value=mock_client):
        import db
        db.delete_session("session-abc")

    mock_client.table.assert_called_once_with("documents")
    mock_client.table.return_value.delete.return_value.eq.assert_called_once_with("session_id", "session-abc")
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
cd backend
pytest tests/test_ingest.py -v
```

Expected: `ModuleNotFoundError: No module named 'db'`

- [ ] **Step 3: Create `backend/db.py`**

```python
from supabase import create_client, Client
from config import SUPABASE_URL, SUPABASE_KEY


def get_client() -> Client:
    return create_client(SUPABASE_URL, SUPABASE_KEY)


def store_chunks(chunks: list[dict]) -> None:
    client = get_client()
    client.table("documents").insert(chunks).execute()


def similarity_search(embedding: list[float], session_id: str, top_k: int) -> list[dict]:
    client = get_client()
    result = client.rpc(
        "match_documents",
        {
            "query_embedding": embedding,
            "match_session_id": session_id,
            "match_count": top_k,
        },
    ).execute()
    return result.data


def delete_session(session_id: str) -> None:
    client = get_client()
    client.table("documents").delete().eq("session_id", session_id).execute()
```

- [ ] **Step 4: Run test to confirm it passes**

```bash
pytest tests/test_ingest.py -v
```

Expected: `PASSED` for both tests.

- [ ] **Step 5: Commit**

```bash
git add .gitignore README.md db_setup.sql backend/requirements.txt backend/config.py backend/db.py backend/tests/ backend/.env.example
git commit -m "feat: project scaffold, db layer, Supabase setup"
```

---

## Phase 3: Ingest Pipeline

### Task 5: `ingest.py` — PDF parse, chunk, embed, store

**Files:**
- Create: `backend/ingest.py`
- Modify: `backend/tests/test_ingest.py`

- [ ] **Step 1: Add ingest tests to `backend/tests/test_ingest.py`**

Append to the existing file (keep the db tests at the top):

```python
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from unittest.mock import MagicMock, patch, mock_open
import pytest


# ── db layer tests (already written in Task 4) ──────────────────────────────

def test_store_chunks_calls_supabase_insert():
    mock_client = MagicMock()
    mock_client.table.return_value.insert.return_value.execute.return_value = MagicMock()

    with patch("db.get_client", return_value=mock_client):
        import db
        db.store_chunks([{"session_id": "s1", "content": "hello", "embedding": [0.1] * 1024}])

    mock_client.table.assert_called_once_with("documents")
    mock_client.table.return_value.insert.assert_called_once()


def test_delete_session_calls_supabase_delete():
    mock_client = MagicMock()
    mock_client.table.return_value.delete.return_value.eq.return_value.execute.return_value = MagicMock()

    with patch("db.get_client", return_value=mock_client):
        import db
        db.delete_session("session-abc")

    mock_client.table.assert_called_once_with("documents")
    mock_client.table.return_value.delete.return_value.eq.assert_called_once_with("session_id", "session-abc")


# ── ingest tests ─────────────────────────────────────────────────────────────

def test_chunk_text_produces_overlapping_windows():
    from ingest import chunk_text
    words = ["word"] * 600
    text = " ".join(words)
    chunks = chunk_text(text, chunk_size=512, overlap=50)
    assert len(chunks) >= 2
    # Each chunk should be at most 512 words
    for chunk in chunks:
        assert len(chunk.split()) <= 512


def test_chunk_text_short_text_gives_one_chunk():
    from ingest import chunk_text
    text = "hello world this is a short text"
    chunks = chunk_text(text)
    assert len(chunks) == 1
    assert chunks[0] == text


def test_ingest_pdf_raises_on_empty_text():
    with patch("ingest.extract_text", return_value="   "):
        with patch("ingest.store_chunks"):
            from ingest import ingest_pdf
            with pytest.raises(ValueError, match="No extractable text"):
                ingest_pdf("/fake/path.pdf", "session-1", "fake.pdf")


def test_ingest_pdf_returns_chunk_count():
    fake_text = " ".join(["word"] * 100)
    fake_embedding = [0.1] * 1024

    mock_voyage_result = MagicMock()
    mock_voyage_result.embeddings = [fake_embedding] * 1  # one chunk

    with patch("ingest.extract_text", return_value=fake_text), \
         patch("ingest.voyageai.Client") as mock_voyage_cls, \
         patch("ingest.store_chunks") as mock_store:

        mock_voyage_cls.return_value.embed.return_value = mock_voyage_result
        from ingest import ingest_pdf
        count = ingest_pdf("/fake/path.pdf", "session-1", "fake.pdf")

    assert count >= 1
    mock_store.assert_called_once()
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd backend
pytest tests/test_ingest.py -v -k "ingest"
```

Expected: `ModuleNotFoundError: No module named 'ingest'`

- [ ] **Step 3: Create `backend/ingest.py`**

```python
import fitz  # PyMuPDF
import voyageai
from config import VOYAGE_API_KEY, CHUNK_SIZE, CHUNK_OVERLAP
from db import store_chunks


def extract_text(file_path: str) -> str:
    doc = fitz.open(file_path)
    text = "".join(page.get_text() for page in doc)
    doc.close()
    return text


def chunk_text(text: str, chunk_size: int = CHUNK_SIZE, overlap: int = CHUNK_OVERLAP) -> list[str]:
    words = text.split()
    chunks = []
    i = 0
    while i < len(words):
        chunks.append(" ".join(words[i : i + chunk_size]))
        i += chunk_size - overlap
    return chunks


def embed_chunks(chunks: list[str]) -> list[list[float]]:
    client = voyageai.Client(api_key=VOYAGE_API_KEY)
    result = client.embed(chunks, model="voyage-3", input_type="document")
    return result.embeddings


def ingest_pdf(file_path: str, session_id: str, filename: str) -> int:
    text = extract_text(file_path)
    if not text.strip():
        raise ValueError("No extractable text found in PDF")

    chunks = chunk_text(text)
    embeddings = embed_chunks(chunks)

    records = [
        {
            "session_id": session_id,
            "content": chunk,
            "embedding": embedding,
            "metadata": {"filename": filename, "chunk_index": i},
        }
        for i, (chunk, embedding) in enumerate(zip(chunks, embeddings))
    ]

    store_chunks(records)
    return len(records)
```

- [ ] **Step 4: Run all ingest tests**

```bash
pytest tests/test_ingest.py -v
```

Expected: All 6 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/ingest.py backend/tests/test_ingest.py
git commit -m "feat: ingest pipeline — PDF parse, chunk, embed, store"
```

---

### Task 5b: Ingest integration smoke test — verify chunks land in Supabase

**Purpose:** Catch ingest issues (wrong key, table missing, embedding dim mismatch) before moving on. Run this once manually with a real small PDF.

**Files:**
- Create: `backend/smoke_ingest.py` (run manually, not in pytest)

- [ ] **Step 1: Create `backend/smoke_ingest.py`**

```python
"""
Manual smoke test — run once to confirm ingest works end to end.
Usage: python smoke_ingest.py path/to/small.pdf
"""
import sys
import uuid
from ingest import ingest_pdf
from db import get_client

if len(sys.argv) < 2:
    print("Usage: python smoke_ingest.py <path_to_pdf>")
    sys.exit(1)

path = sys.argv[1]
session_id = f"smoke-{uuid.uuid4()}"
print(f"Ingesting {path} with session_id={session_id} ...")

count = ingest_pdf(path, session_id, "smoke_test.pdf")
print(f"Stored {count} chunks.")

client = get_client()
result = client.table("documents").select("id, content, metadata").eq("session_id", session_id).execute()
print(f"Supabase returned {len(result.data)} rows.")

if len(result.data) != count:
    print("MISMATCH — stored count doesn't match rows in DB!")
    sys.exit(1)

print("First chunk preview:", result.data[0]["content"][:120])

# Clean up
client.table("documents").delete().eq("session_id", session_id).execute()
print("Smoke test passed. Rows cleaned up.")
```

- [ ] **Step 2: Find or create a small test PDF**

Any 1–2 page PDF works. If you don't have one handy, print a webpage to PDF or grab a short paper. Put it anywhere accessible.

- [ ] **Step 3: Run the smoke test**

```bash
cd backend
venv\Scripts\activate
python smoke_ingest.py path\to\your\small.pdf
```

Expected output (numbers will vary by PDF length):
```
Ingesting ... with session_id=smoke-...
Stored 3 chunks.
Supabase returned 3 rows.
First chunk preview: ...
Smoke test passed. Rows cleaned up.
```

**If it fails here:** Fix before moving to Phase 4. Common issues:
- `SUPABASE_KEY` wrong or missing → check `.env`
- `documents` table not found → re-run `db_setup.sql`
- `vector(1024)` dimension mismatch → Voyage `voyage-3` produces 1024-dim vectors, table must match
- `voyageai` auth error → check `VOYAGE_API_KEY` in `.env`

---

## Phase 4: Retrieval Pipeline

### Task 6: `retrieval.py` — embed query, vector search, rerank

**Files:**
- Create: `backend/retrieval.py`
- Create: `backend/tests/test_retrieval.py`

- [ ] **Step 1: Write failing tests**

Create `backend/tests/test_retrieval.py`:

```python
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from unittest.mock import MagicMock, patch
import pytest


def test_embed_query_returns_single_vector():
    mock_result = MagicMock()
    mock_result.embeddings = [[0.1] * 1024]

    with patch("retrieval.voyageai.Client") as mock_cls:
        mock_cls.return_value.embed.return_value = mock_result
        from retrieval import embed_query
        vec = embed_query("what is the main topic?")

    assert len(vec) == 1024
    mock_cls.return_value.embed.assert_called_once_with(
        ["what is the main topic?"], model="voyage-3", input_type="query"
    )


def test_rerank_chunks_returns_top_k_strings():
    reranked_doc_1 = MagicMock()
    reranked_doc_1.document = "most relevant chunk"
    reranked_doc_2 = MagicMock()
    reranked_doc_2.document = "second chunk"

    mock_result = MagicMock()
    mock_result.results = [reranked_doc_1, reranked_doc_2]

    with patch("retrieval.voyageai.Client") as mock_cls:
        mock_cls.return_value.rerank.return_value = mock_result
        from retrieval import rerank_chunks
        results = rerank_chunks("query", ["most relevant chunk", "second chunk", "irrelevant"], top_k=2)

    assert results == ["most relevant chunk", "second chunk"]


def test_retrieve_returns_empty_list_when_no_chunks():
    with patch("retrieval.embed_query", return_value=[0.1] * 1024), \
         patch("retrieval.similarity_search", return_value=[]):
        from retrieval import retrieve
        result = retrieve("any question", "session-xyz")

    assert result == []


def test_retrieve_full_pipeline():
    fake_candidates = [{"content": f"chunk {i}", "id": str(i)} for i in range(3)]
    reranked_doc = MagicMock()
    reranked_doc.document = "chunk 0"
    mock_rerank_result = MagicMock()
    mock_rerank_result.results = [reranked_doc]

    with patch("retrieval.embed_query", return_value=[0.1] * 1024), \
         patch("retrieval.similarity_search", return_value=fake_candidates), \
         patch("retrieval.voyageai.Client") as mock_cls:

        mock_cls.return_value.rerank.return_value = mock_rerank_result
        from retrieval import retrieve
        result = retrieve("question", "session-abc")

    assert result == ["chunk 0"]
```

- [ ] **Step 2: Run to confirm failure**

```bash
pytest tests/test_retrieval.py -v
```

Expected: `ModuleNotFoundError: No module named 'retrieval'`

- [ ] **Step 3: Create `backend/retrieval.py`**

```python
import voyageai
from config import VOYAGE_API_KEY, TOP_K_RETRIEVE, TOP_K_RERANK
from db import similarity_search


def embed_query(query: str) -> list[float]:
    client = voyageai.Client(api_key=VOYAGE_API_KEY)
    result = client.embed([query], model="voyage-3", input_type="query")
    return result.embeddings[0]


def rerank_chunks(query: str, chunks: list[str], top_k: int = TOP_K_RERANK) -> list[str]:
    client = voyageai.Client(api_key=VOYAGE_API_KEY)
    result = client.rerank(query, chunks, model="rerank-2", top_k=top_k)
    return [r.document for r in result.results]


def retrieve(query: str, session_id: str) -> list[str]:
    embedding = embed_query(query)
    candidates = similarity_search(embedding, session_id, TOP_K_RETRIEVE)

    if not candidates:
        return []

    texts = [c["content"] for c in candidates]
    return rerank_chunks(query, texts, TOP_K_RERANK)
```

- [ ] **Step 4: Run tests**

```bash
pytest tests/test_retrieval.py -v
```

Expected: All 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/retrieval.py backend/tests/test_retrieval.py
git commit -m "feat: retrieval pipeline — embed query, vector search, rerank"
```

---

## Phase 5: Chat Pipeline

### Task 7: `chat.py` — system prompt assembly + Claude streaming

**Files:**
- Create: `backend/chat.py`
- Create: `backend/tests/test_chat.py`

- [ ] **Step 1: Write failing tests**

Create `backend/tests/test_chat.py`:

```python
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from unittest.mock import MagicMock, patch


def test_build_system_prompt_includes_all_chunks():
    from chat import build_system_prompt
    chunks = ["chunk one content", "chunk two content"]
    prompt = build_system_prompt(chunks)
    assert "chunk one content" in prompt
    assert "chunk two content" in prompt


def test_build_system_prompt_separates_chunks():
    from chat import build_system_prompt
    chunks = ["first", "second"]
    prompt = build_system_prompt(chunks)
    # chunks should be separated (not just concatenated)
    assert prompt.index("first") < prompt.index("second")


def test_stream_response_yields_tokens():
    mock_stream = MagicMock()
    mock_stream.__enter__ = MagicMock(return_value=mock_stream)
    mock_stream.__exit__ = MagicMock(return_value=False)
    mock_stream.text_stream = iter(["Hello", " world", "!"])

    with patch("chat.anthropic.Anthropic") as mock_cls:
        mock_cls.return_value.messages.stream.return_value = mock_stream
        from chat import stream_response
        tokens = list(stream_response(["context chunk"], [{"role": "user", "content": "hi"}]))

    assert tokens == ["Hello", " world", "!"]


def test_stream_response_uses_correct_model():
    mock_stream = MagicMock()
    mock_stream.__enter__ = MagicMock(return_value=mock_stream)
    mock_stream.__exit__ = MagicMock(return_value=False)
    mock_stream.text_stream = iter([])

    with patch("chat.anthropic.Anthropic") as mock_cls:
        mock_cls.return_value.messages.stream.return_value = mock_stream
        from chat import stream_response
        list(stream_response([], [{"role": "user", "content": "hi"}]))

    call_kwargs = mock_cls.return_value.messages.stream.call_args[1]
    assert call_kwargs["model"] == "claude-sonnet-4-6"
```

- [ ] **Step 2: Run to confirm failure**

```bash
pytest tests/test_chat.py -v
```

Expected: `ModuleNotFoundError: No module named 'chat'`

- [ ] **Step 3: Create `backend/chat.py`**

```python
import anthropic
from typing import Generator
from config import ANTHROPIC_API_KEY

_SYSTEM_TEMPLATE = """You are a helpful assistant that answers questions based on the provided document context.

Context from the document:
{context}

Answer questions based on this context. If the answer is not found in the context, say so clearly."""


def build_system_prompt(chunks: list[str]) -> str:
    context = "\n\n---\n\n".join(chunks)
    return _SYSTEM_TEMPLATE.format(context=context)


def stream_response(chunks: list[str], messages: list[dict]) -> Generator[str, None, None]:
    client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
    system_prompt = build_system_prompt(chunks)

    with client.messages.stream(
        model="claude-sonnet-4-6",
        max_tokens=1024,
        system=system_prompt,
        messages=messages,
    ) as stream:
        for text in stream.text_stream:
            yield text
```

- [ ] **Step 4: Run tests**

```bash
pytest tests/test_chat.py -v
```

Expected: All 4 tests PASS.

- [ ] **Step 5: Run entire test suite**

```bash
pytest tests/ -v
```

Expected: All tests PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/chat.py backend/tests/test_chat.py
git commit -m "feat: chat pipeline — Claude streaming with RAG context"
```

---

## Phase 6: FastAPI Routes

### Task 8: `main.py` — all routes with CORS

**Files:**
- Create: `backend/main.py`

No unit tests for routes — integration-tested manually by running the server.

- [ ] **Step 1: Create `backend/main.py`**

```python
import uuid
import tempfile
import os
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from ingest import ingest_pdf
from retrieval import retrieve
from chat import stream_response
from db import delete_session

app = FastAPI(title="RAG Document Chat API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class ChatRequest(BaseModel):
    session_id: str
    messages: list[dict]


@app.post("/upload")
async def upload_pdf(file: UploadFile = File(...)):
    if file.content_type != "application/pdf":
        raise HTTPException(status_code=400, detail="Only PDF files are accepted")

    session_id = str(uuid.uuid4())

    with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
        content = await file.read()
        tmp.write(content)
        tmp_path = tmp.name

    try:
        chunk_count = ingest_pdf(tmp_path, session_id, file.filename)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ingestion failed: {str(e)}")
    finally:
        os.unlink(tmp_path)

    return {"session_id": session_id, "chunk_count": chunk_count}


@app.post("/chat")
async def chat(request: ChatRequest):
    if not request.messages:
        raise HTTPException(status_code=400, detail="messages array is empty")

    last_message = request.messages[-1]["content"]

    try:
        chunks = retrieve(last_message, request.session_id)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Retrieval failed: {str(e)}")

    def generate():
        try:
            for token in stream_response(chunks, request.messages):
                yield f"data: {token}\n\n"
        except Exception:
            yield "data: [ERROR]\n\n"
        yield "data: [DONE]\n\n"

    return StreamingResponse(generate(), media_type="text/event-stream")


@app.delete("/session/{session_id}")
async def delete_session_route(session_id: str):
    try:
        delete_session(session_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    return {"status": "deleted", "session_id": session_id}
```

- [ ] **Step 2: Start the server**

```bash
cd backend
uvicorn main:app --reload --port 8000
```

Expected: `Application startup complete.` with no errors.

- [ ] **Step 3: Smoke-test the API docs**

Open `http://localhost:8000/docs` in a browser.

Expected: Swagger UI showing `/upload`, `/chat`, `/session/{session_id}` routes.

- [ ] **Step 4: Commit**

```bash
git add backend/main.py
git commit -m "feat: FastAPI routes — upload, chat, delete session"
```

---

## Phase 7: React Frontend

### Task 9: Vite + Tailwind project setup

**Files:**
- Create: `frontend/` (scaffold via npm create vite)

- [ ] **Step 1: Scaffold the Vite + React project**

```bash
cd "c:\Users\West\Documents\RAG Project"
npm create vite@latest frontend -- --template react
cd frontend
npm install
```

- [ ] **Step 2: Install Tailwind**

```bash
npm install -D tailwindcss@3 postcss autoprefixer
npx tailwindcss init -p
```

- [ ] **Step 3: Configure Tailwind content paths**

Edit `frontend/tailwind.config.js`:

```js
/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: { extend: {} },
  plugins: [],
}
```

- [ ] **Step 4: Replace `frontend/src/index.css` with Tailwind directives**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

- [ ] **Step 5: Verify dev server starts**

```bash
npm run dev
```

Expected: Vite dev server at `http://localhost:5173` with the default React page.

- [ ] **Step 6: Commit**

```bash
cd ..
git add frontend/
git commit -m "feat: Vite + React + Tailwind frontend scaffold"
```

---

### Task 10: `UploadPanel.jsx` — PDF drag-and-drop

**Files:**
- Create: `frontend/src/components/UploadPanel.jsx`

- [ ] **Step 1: Create `frontend/src/components/UploadPanel.jsx`**

```jsx
import { useState, useRef } from 'react'

export default function UploadPanel({ onUpload }) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState(null)
  const [uploadedFile, setUploadedFile] = useState(null)
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef(null)

  async function handleFile(file) {
    if (!file || file.type !== 'application/pdf') {
      setError('Please select a PDF file.')
      return
    }
    setError(null)
    setUploading(true)

    const form = new FormData()
    form.append('file', file)

    try {
      const res = await fetch('http://localhost:8000/upload', {
        method: 'POST',
        body: form,
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.detail || 'Upload failed')
      }
      const { session_id } = await res.json()
      setUploadedFile(file.name)
      onUpload(session_id, file.name)
    } catch (e) {
      setError(e.message)
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Document</h2>

      <div
        onClick={() => inputRef.current.click()}
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragging(false)
          handleFile(e.dataTransfer.files[0])
        }}
        className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors
          ${dragging ? 'border-blue-500 bg-blue-950/20' : 'border-gray-700 hover:border-gray-500'}`}
      >
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf"
          className="hidden"
          onChange={(e) => handleFile(e.target.files[0])}
        />
        {uploading ? (
          <p className="text-gray-400 text-sm">Indexing PDF…</p>
        ) : uploadedFile ? (
          <p className="text-green-400 text-sm font-medium">{uploadedFile}</p>
        ) : (
          <p className="text-gray-500 text-sm">Drop a PDF here or click to select</p>
        )}
      </div>

      {error && <p className="text-red-400 text-xs">{error}</p>}

      {uploadedFile && !uploading && (
        <p className="text-xs text-gray-500">Ready to chat</p>
      )}
    </div>
  )
}
```

---

### Task 11: `MessageBubble.jsx` and `ChatWindow.jsx`

**Files:**
- Create: `frontend/src/components/MessageBubble.jsx`
- Create: `frontend/src/components/ChatWindow.jsx`

- [ ] **Step 1: Create `frontend/src/components/MessageBubble.jsx`**

```jsx
export default function MessageBubble({ role, content, streaming }) {
  const isUser = role === 'user'
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap
          ${isUser
            ? 'bg-blue-600 text-white rounded-br-sm'
            : 'bg-gray-800 text-gray-100 rounded-bl-sm'
          }`}
      >
        {content}
        {streaming && (
          <span className="inline-block w-1.5 h-4 ml-0.5 bg-gray-400 animate-pulse align-middle" />
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create `frontend/src/components/ChatWindow.jsx`**

```jsx
import { useState, useRef, useEffect } from 'react'
import MessageBubble from './MessageBubble'

export default function ChatWindow({ sessionId, filename }) {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const bottomRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function sendMessage(e) {
    e.preventDefault()
    const text = input.trim()
    if (!text || streaming) return

    const userMessage = { role: 'user', content: text }
    const nextMessages = [...messages, userMessage]
    setMessages(nextMessages)
    setInput('')
    setStreaming(true)

    // Add placeholder assistant message
    setMessages([...nextMessages, { role: 'assistant', content: '' }])

    try {
      const res = await fetch('http://localhost:8000/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId, messages: nextMessages }),
      })

      if (!res.ok) throw new Error('Chat request failed')

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let assistantText = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value)
        const lines = chunk.split('\n')
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const token = line.slice(6)
          if (token === '[DONE]' || token === '[ERROR]') continue
          assistantText += token
          setMessages([
            ...nextMessages,
            { role: 'assistant', content: assistantText },
          ])
        }
      }
    } catch (err) {
      setMessages([
        ...nextMessages,
        { role: 'assistant', content: `Error: ${err.message}` },
      ])
    } finally {
      setStreaming(false)
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="border-b border-gray-800 px-4 py-3">
        <p className="text-sm text-gray-400">
          Chatting with <span className="text-white font-medium">{filename}</span>
        </p>
      </div>

      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
        {messages.length === 0 && (
          <p className="text-center text-gray-600 text-sm mt-8">
            Ask anything about the document.
          </p>
        )}
        {messages.map((msg, i) => (
          <MessageBubble
            key={i}
            role={msg.role}
            content={msg.content}
            streaming={streaming && i === messages.length - 1 && msg.role === 'assistant'}
          />
        ))}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={sendMessage} className="border-t border-gray-800 p-4 flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={streaming}
          placeholder="Ask a question about the document…"
          className="flex-1 bg-gray-900 border border-gray-700 rounded-xl px-4 py-2.5 text-sm
                     text-white placeholder-gray-600 outline-none focus:border-blue-600
                     disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={!input.trim() || streaming}
          className="bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed
                     text-white text-sm font-medium px-4 py-2.5 rounded-xl transition-colors"
        >
          Send
        </button>
      </form>
    </div>
  )
}
```

---

### Task 12: `App.jsx` and `main.jsx` — wire it all together

**Files:**
- Modify: `frontend/src/App.jsx`
- Modify: `frontend/src/main.jsx`

- [ ] **Step 1: Replace `frontend/src/App.jsx`**

```jsx
import { useState } from 'react'
import UploadPanel from './components/UploadPanel'
import ChatWindow from './components/ChatWindow'

export default function App() {
  const [session, setSession] = useState(null)

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col">
      <header className="border-b border-gray-800 px-6 py-4 flex items-center gap-3">
        <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center text-xs font-bold">R</div>
        <h1 className="text-base font-semibold tracking-tight">RAG Document Chat</h1>
      </header>
      <div className="flex flex-1 overflow-hidden">
        <aside className="w-72 border-r border-gray-800 p-5 shrink-0">
          <UploadPanel onUpload={(id, name) => setSession({ id, name })} />
        </aside>
        <main className="flex-1 overflow-hidden">
          {session
            ? <ChatWindow sessionId={session.id} filename={session.name} />
            : (
              <div className="flex items-center justify-center h-full">
                <p className="text-gray-600 text-sm">Upload a PDF on the left to start chatting</p>
              </div>
            )}
        </main>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Replace `frontend/src/main.jsx`**

```jsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
```

- [ ] **Step 3: Remove boilerplate files**

Delete `frontend/src/App.css` and `frontend/src/assets/react.svg`.

- [ ] **Step 4: Start both servers and verify full flow**

Terminal 1 (backend):
```bash
cd backend
venv\Scripts\activate
uvicorn main:app --reload --port 8000
```

Terminal 2 (frontend):
```bash
cd frontend
npm run dev
```

Open `http://localhost:5173`.

Expected:
- Dark UI with upload panel on left
- Upload a real PDF → see "Ready to chat"
- Type a question → see streaming response appear token by token

- [ ] **Step 5: Commit**

```bash
git add frontend/src/
git commit -m "feat: React frontend — upload panel, streaming chat UI"
```

---

## Spec Coverage Checklist

| Spec requirement | Task |
|---|---|
| Upload flow: PDF → PyMuPDF → chunk → embed → Supabase | Task 5 (ingest.py) |
| Chat flow: embed query → pgvector search → rerank → Claude stream | Task 6 + 7 (retrieval.py + chat.py) |
| Streaming via `anthropic.stream()` | Task 7 (chat.py) |
| Conversation history in React state | Task 11 (ChatWindow.jsx) |
| CORS for localhost:5173 | Task 8 (main.py) |
| session_id scopes similarity search | Task 4 (db.py match_documents) |
| Config constants (CHUNK_SIZE, OVERLAP, TOP_K, etc.) | Task 3 (config.py) |
| .env gitignored, .env.example committed | Task 1 |
| Error handling: 400 non-PDF, 422 empty PDF, 500 Supabase fail, 502 Voyage fail | Task 8 (main.py) |
| DELETE /session/{session_id} | Task 8 (main.py) |
| UploadPanel, ChatWindow, MessageBubble components | Tasks 10–12 |
| README.md | Task 1 |
