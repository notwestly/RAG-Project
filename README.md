# RAG Document Chat

Upload a PDF and chat with it using natural language. Voyage AI handles embeddings and reranking, Supabase stores and searches vectors, Claude streams the responses.

## Stack

| Layer | Tech |
|---|---|
| Frontend | React + Tailwind CSS (Vite) |
| Backend | Python + FastAPI |
| PDF Parsing | PyMuPDF |
| Embeddings | Voyage AI `voyage-3` |
| Reranker | Voyage AI `rerank-2` |
| LLM | Claude Sonnet 4.6 (streaming) |
| Vector DB | Supabase (pgvector) |

## Setup

### 1. Database

Run `db_setup.sql` in your Supabase project's SQL Editor (Dashboard → SQL Editor → paste → Run).

This creates the `documents` table and the `match_documents` RPC function used by the backend.

### 2. Backend

```bash
cd backend
python -m venv venv

# Windows
venv\Scripts\activate
# Mac/Linux
source venv/bin/activate

pip install -r requirements.txt
cp .env.example .env
# Fill in your API keys in .env
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
2. Drag and drop (or click to select) a PDF in the left panel
3. Wait for indexing to complete
4. Ask questions in the chat box — answers stream back in real time

## Environment Variables

| Variable | Where to get it |
|---|---|
| `ANTHROPIC_API_KEY` | [console.anthropic.com](https://console.anthropic.com) |
| `VOYAGE_API_KEY` | [dash.voyageai.com](https://dash.voyageai.com) |
| `SUPABASE_URL` | Supabase Dashboard → Project Settings → API |
| `SUPABASE_KEY` | Supabase Dashboard → Project Settings → API (anon/publishable key) |
