# Frontend Redesign — RAG Document Chat

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the RAG Document Chat frontend from a functional-but-sparse layout into a polished, visually intentional app that showcases technical depth to recruiters.

**Architecture:** Frontend changes (React + Vite + Tailwind v3) with one small additive backend change (expose `page_count` from `/upload`). Theme state lives in `App.jsx` via `useState` + `localStorage`, propagated as a `dark` class on `<html>`. No new dependencies — `darkMode: 'class'` in `tailwind.config.js`.

**Design direction:** GitHub-inspired dark (Direction B) + L1 clean white light mode. Sidebar slightly elevated (`#161b22` dark / `#f3f4f6` light) against chat area (`#0d1117` dark / `#f9fafb` light). Crisp borders throughout.

---

## Visual Design Tokens

### Dark mode
| Token | Value | Usage |
|---|---|---|
| bg-app | `#0d1117` | Chat area, overall page bg |
| bg-sidebar | `#161b22` | Left sidebar |
| border | `#21262d` | All dividers |
| border-subtle | `#30363d` | Cards, inputs |
| text-primary | `#e6edf3` | Headings, filenames |
| text-secondary | `#8b949e` | Labels, metadata |
| text-muted | `#484f58` | Placeholders, hints |
| accent | `#2563eb` | Button, toggle active, how-it-works stripe |

### Light mode (L1)
| Token | Value | Usage |
|---|---|---|
| bg-app | `#f9fafb` | Chat area, overall page bg |
| bg-sidebar | `#f3f4f6` | Left sidebar |
| border | `#e5e7eb` | All dividers |
| text-primary | `#111827` | Headings, filenames |
| text-secondary | `#6b7280` | Labels, metadata |
| text-muted | `#9ca3af` | Placeholders, hints |
| accent | `#2563eb` | Same blue — consistent in both modes |

---

## Component Breakdown

### 1. `frontend/tailwind.config.js` — Enable class-based dark mode
Add `darkMode: 'class'` (Tailwind v3 — correct location, no v4 concerns).

### 2. `frontend/src/App.jsx` — Theme state + layout shell

**Theme toggle logic:**
- `const [dark, setDark] = useState(() => localStorage.getItem('theme') !== 'light')`
- Defaults to dark on first visit (intentional — matches design intent; does not read `prefers-color-scheme`)
- On mount and on change: `document.documentElement.classList.toggle('dark', dark)` + `localStorage.setItem('theme', dark ? 'dark' : 'light')`

**Header changes:**
- Replace the blue `R` square with an inline SVG document-stack icon (no external dependency)
- Theme toggle pill top-right of header: label always reflects *current* state
  - Dark state renders: `🌙 Dark`
  - Light state renders: `☀️ Light`

**Layout:**
- Sidebar: `bg-[#f3f4f6] dark:bg-[#161b22]`, width `w-72`
- Chat area: `bg-gray-50 dark:bg-[#0d1117]`
- All borders: `border-gray-200 dark:border-[#21262d]`

**Session state shape:** `{ id, name, chunkCount, pageCount }` — set via `onUpload(sessionId, filename, chunkCount, pageCount)`

**ChatWindow always renders:** Remove the conditional mount. Always render `<ChatWindow sessionId={session?.id} filename={session?.name} />`. Null `sessionId` means pre-upload state.

### 3. `frontend/src/components/UploadPanel.jsx` — Sidebar content

**Upload zone (taller, more prominent):**
- Padding: `py-10 px-6` (was `p-6`)
- Larger SVG cloud-arrow-up icon (`w-10 h-10`, muted color)
- Primary label: `"Drop a PDF here"` (`text-sm`)
- Secondary label: `"or click to browse"` (`text-xs`, muted)
- Border: `border-2 border-dashed dark:border-[#30363d] border-gray-300`
- Hover: `hover:dark:border-blue-500 hover:border-blue-400`
- Drag-over: `dark:border-blue-500 dark:bg-blue-950/20`

**Current Document section (shown after upload):**
- Card: `dark:bg-[#1c2128] dark:border-[#30363d] bg-white border-gray-200`
- Label: `📎 CURRENT DOCUMENT` (uppercase, `text-xs`, muted)
- Filename: truncated, `text-sm font-medium`
- Metadata: `{pageCount} pages · {chunkCount} chunks` (`text-xs`, muted)
- Below the card: `"Upload a different PDF"` link (resets upload state)

**How it works blurb (always visible — bottom of sidebar, pinned with `mt-auto`):**
- Present both pre-upload and post-upload — fills sidebar in the active state users spend the most time in
- Accent left-border card: `border-l-2 border-blue-600 dark:bg-[#1c2128] bg-white`
- Label: `HOW IT WORKS` (uppercase, `text-xs`, muted)
- Steps: `① Upload a PDF` / `② Ask a question` / `③ AI answers from doc`

**`onUpload` signature change:** `onUpload(sessionId, filename, chunkCount, pageCount)`

### 4. `frontend/src/components/ChatWindow.jsx` — Empty state + always-present input

**Props change:** Accepts nullable `sessionId`. When `sessionId` is null, input is disabled.

**Empty state (shown when `messages.length === 0`):**
- Centered layout with:
  - SVG chat-bubble icon (`w-12 h-12`, muted)
  - Headline: `"Ask anything about your document"` (`text-lg font-semibold`)
  - Sub-label: `"Upload a PDF to get started"` (no session) or `"Your document is ready"` (session exists)
  - 3 suggested question pills (shown only when `sessionId` is not null):
    - `"What is this document about?"`
    - `"Summarize the key points"`
    - `"What are the main conclusions?"`
    - Clicking a pill sets `input` state to that question text and focuses the input

**Input bar (always rendered):**
- Disabled when `!sessionId`: `disabled` attr + `opacity-50 cursor-not-allowed`
- Placeholder: `"Upload a PDF to start chatting…"` (no session) / `"Ask a question about the document…"` (active)

### 5. `frontend/src/components/MessageBubble.jsx` — Light mode variants
- User bubble: `bg-blue-600 text-white` (unchanged — works in both modes)
- Assistant bubble: `dark:bg-[#1c2128] dark:text-[#e6edf3] bg-white text-gray-800 border dark:border-[#30363d] border-gray-200`

---

## Backend Changes

### `backend/ingest.py` — Return page count, wrap full function

**`extract_text`** returns `tuple[str, int]`:
```python
def extract_text(file_path: str) -> tuple[str, int]:
    doc = fitz.open(file_path)
    text = "".join(page.get_text() for page in doc)
    page_count = len(doc)
    doc.close()
    return text, page_count
```

**`ingest_pdf`** — error handling wraps the entire function body (not just extraction), returns `tuple[int, int]`:
```python
def ingest_pdf(file_path: str, session_id: str, filename: str) -> tuple[int, int]:
    text, page_count = extract_text(file_path)
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
    return len(records), page_count
```

### `backend/main.py` — Unpack tuple from ingest_pdf
```python
chunk_count, page_count = ingest_pdf(tmp_path, session_id, file.filename)
return {"session_id": session_id, "chunk_count": chunk_count, "page_count": page_count}
```

---

## Data Flow

`/upload` response: `{ session_id, chunk_count, page_count }`

Frontend unpacks in `UploadPanel`:
```js
const { session_id, chunk_count, page_count } = await res.json()
onUpload(session_id, file.name, chunk_count, page_count)
```

`App.jsx` session state: `{ id, name, chunkCount, pageCount }`

---

## Test Updates (`backend/tests/test_ingest.py`)

Two tests break after the `extract_text` return type change:

**`test_ingest_pdf_raises_on_empty_text`** — mock must return a tuple:
```python
with patch("ingest.extract_text", return_value=("   ", 1)):
```

**`test_ingest_pdf_returns_chunk_count`** — mock must return tuple, and assertion must unpack:
```python
with patch("ingest.extract_text", return_value=(fake_text, 1)), \
     ...
    chunk_count, page_count = ingest_pdf("/fake/path.pdf", "session-1", "fake.pdf")

assert chunk_count >= 1
assert page_count == 1
```

---

## What Does NOT Change
- SSE streaming logic in `ChatWindow.jsx`
- All backend retrieval, chat, db modules
- Railway/Vercel config, CORS settings
- `test_retrieval.py`, `test_chat.py` — unaffected
