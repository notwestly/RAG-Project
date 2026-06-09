# Frontend Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the RAG Document Chat UI — GitHub-inspired dark/light theme, taller upload zone, document info card with page+chunk counts, better empty state with suggestion pills, and a theme toggle pill in the header.

**Architecture:** Backend gets one additive change (expose `page_count` from `/upload`). Frontend gets a class-based dark mode via Tailwind v3 `darkMode: 'class'`, theme state in `App.jsx` persisted to `localStorage`, and visual overhauls to all four components. `ChatWindow` becomes always-rendered (nullable `sessionId`) so the input bar is always visible.

**Tech Stack:** Python FastAPI (backend), React 19 + Vite + Tailwind CSS v3 (frontend), pytest (backend tests).

---

## File Map

| File | Change |
|---|---|
| `backend/ingest.py` | `extract_text` returns `(text, page_count)`, `ingest_pdf` returns `(chunk_count, page_count)` |
| `backend/main.py` | Unpack tuple from `ingest_pdf`, add `page_count` to `/upload` response |
| `backend/tests/test_ingest.py` | Fix two tests broken by tuple return type |
| `frontend/tailwind.config.js` | Add `darkMode: 'class'` |
| `frontend/src/App.jsx` | Theme state + localStorage + dark class on `<html>` + SVG icon + toggle pill + session shape change + always-render ChatWindow |
| `frontend/src/components/UploadPanel.jsx` | Taller upload zone + Current Document card + How It Works blurb |
| `frontend/src/components/ChatWindow.jsx` | Nullable sessionId + empty state + suggestion pills + always-present disabled input |
| `frontend/src/components/MessageBubble.jsx` | Light mode variants for assistant bubble |

---

## Task 1: Fix backend tests first (TDD — update tests before touching impl)

**Files:**
- Modify: `backend/tests/test_ingest.py`

- [ ] **Step 1: Update `test_ingest_pdf_raises_on_empty_text` to expect tuple from mock**

Open `backend/tests/test_ingest.py` and change line 56 from `return_value="   "` to `return_value=("   ", 1)`:

```python
def test_ingest_pdf_raises_on_empty_text():
    with patch("ingest.extract_text", return_value=("   ", 1)):
        with patch("ingest.store_chunks"):
            from ingest import ingest_pdf
            with pytest.raises(ValueError, match="No extractable text"):
                ingest_pdf("/fake/path.pdf", "session-1", "fake.pdf")
```

- [ ] **Step 2: Update `test_ingest_pdf_returns_chunk_count` to expect tuple return**

Replace the entire test (lines 63–79):

```python
def test_ingest_pdf_returns_chunk_count():
    fake_text = " ".join(["word"] * 100)
    fake_embedding = [0.1] * 1024

    mock_voyage_result = MagicMock()
    mock_voyage_result.embeddings = [fake_embedding]

    with patch("ingest.extract_text", return_value=(fake_text, 3)), \
         patch("ingest.voyageai.Client") as mock_voyage_cls, \
         patch("ingest.store_chunks") as mock_store:

        mock_voyage_cls.return_value.embed.return_value = mock_voyage_result
        from ingest import ingest_pdf
        chunk_count, page_count = ingest_pdf("/fake/path.pdf", "session-1", "fake.pdf")

    assert chunk_count >= 1
    assert page_count == 3
    mock_store.assert_called_once()
```

- [ ] **Step 3: Run tests — expect 2 failures**

```bash
cd "c:/Users/West/Documents/RAG Project/backend"
python -m pytest tests/test_ingest.py -v
```

Expected: `test_ingest_pdf_raises_on_empty_text` FAILS (mock returns tuple, code unpacks as string), `test_ingest_pdf_returns_chunk_count` FAILS (same reason). Other tests pass. This confirms the tests are correctly written and waiting for the implementation.

---

## Task 2: Update backend ingest.py

**Files:**
- Modify: `backend/ingest.py`

- [ ] **Step 1: Update `extract_text` to return `(text, page_count)`**

Replace the entire `extract_text` function:

```python
def extract_text(file_path: str) -> tuple[str, int]:
    doc = fitz.open(file_path)
    text = "".join(page.get_text() for page in doc)
    page_count = len(doc)
    doc.close()
    return text, page_count
```

- [ ] **Step 2: Update `ingest_pdf` to unpack tuple and return both counts**

Replace the entire `ingest_pdf` function:

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

- [ ] **Step 3: Run tests — all should pass**

```bash
cd "c:/Users/West/Documents/RAG Project/backend"
python -m pytest tests/test_ingest.py -v
```

Expected: all 6 tests in `test_ingest.py` PASS.

- [ ] **Step 4: Run full test suite to confirm nothing else broke**

```bash
python -m pytest tests/ -v
```

Expected: all 14 tests PASS.

- [ ] **Step 5: Commit**

```bash
cd "c:/Users/West/Documents/RAG Project"
git add backend/ingest.py backend/tests/test_ingest.py
git commit -m "feat: return page_count from ingest_pdf alongside chunk_count"
```

---

## Task 3: Update /upload endpoint to expose page_count

**Files:**
- Modify: `backend/main.py`

- [ ] **Step 1: Update the upload handler to unpack the tuple and return page_count**

Find this block in `backend/main.py` (around line 47):
```python
    try:
        chunk_count = ingest_pdf(tmp_path, session_id, file.filename)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ingestion failed: {str(e)}")
    finally:
        os.unlink(tmp_path)

    return {"session_id": session_id, "chunk_count": chunk_count}
```

Replace with:
```python
    try:
        chunk_count, page_count = ingest_pdf(tmp_path, session_id, file.filename)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ingestion failed: {str(e)}")
    finally:
        os.unlink(tmp_path)

    return {"session_id": session_id, "chunk_count": chunk_count, "page_count": page_count}
```

- [ ] **Step 2: Run full test suite — all 14 should still pass**

```bash
cd "c:/Users/West/Documents/RAG Project/backend"
python -m pytest tests/ -v
```

Expected: all 14 tests PASS.

- [ ] **Step 3: Commit**

```bash
cd "c:/Users/West/Documents/RAG Project"
git add backend/main.py
git commit -m "feat: expose page_count in /upload response"
```

---

## Task 4: Enable Tailwind dark mode

**Files:**
- Modify: `frontend/tailwind.config.js`

- [ ] **Step 1: Add `darkMode: 'class'` to the config**

Replace the entire file:

```js
/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  darkMode: 'class',
  theme: {
    extend: {},
  },
  plugins: [],
}
```

- [ ] **Step 2: Verify dev server still starts**

```bash
cd "c:/Users/West/Documents/RAG Project/frontend"
npm run dev
```

Expected: server starts at `http://localhost:5173` with no errors. The app looks unchanged (dark mode class not applied yet — that comes in Task 5).

- [ ] **Step 3: Commit**

```bash
cd "c:/Users/West/Documents/RAG Project"
git add frontend/tailwind.config.js
git commit -m "feat: enable Tailwind class-based dark mode"
```

---

## Task 5: Rewrite App.jsx — theme toggle, layout, session shape

**Files:**
- Modify: `frontend/src/App.jsx`

- [ ] **Step 1: Replace App.jsx entirely**

```jsx
import { useState, useEffect } from 'react'
import UploadPanel from './components/UploadPanel'
import ChatWindow from './components/ChatWindow'

export default function App() {
  const [dark, setDark] = useState(() => localStorage.getItem('theme') !== 'light')
  const [session, setSession] = useState(null)

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
    localStorage.setItem('theme', dark ? 'dark' : 'light')
  }, [dark])

  function handleUpload(id, name, chunkCount, pageCount) {
    setSession({ id, name, chunkCount, pageCount })
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0d1117] text-gray-900 dark:text-[#e6edf3] flex flex-col">
      <header className="border-b border-gray-200 dark:border-[#21262d] px-6 py-3 flex items-center gap-3 shrink-0 bg-white dark:bg-[#0d1117]">
        {/* Document stack icon */}
        <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center shrink-0">
          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="currentColor">
            <path d="M7 3a2 2 0 00-2 2v1H4a2 2 0 00-2 2v11a2 2 0 002 2h12a2 2 0 002-2V8a2 2 0 00-2-2h-1V5a2 2 0 00-2-2H7zm6 2v1H7V5h6zm-1 5a1 1 0 110 2H8a1 1 0 110-2h4zm2 4a1 1 0 110 2H8a1 1 0 110-2h6z"/>
          </svg>
        </div>
        <h1 className="text-sm font-semibold tracking-tight">RAG Document Chat</h1>
        <button
          onClick={() => setDark(d => !d)}
          className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium
                     bg-gray-100 dark:bg-[#21262d] border border-gray-200 dark:border-[#30363d]
                     text-gray-600 dark:text-[#8b949e] hover:border-gray-300 dark:hover:border-[#484f58]
                     transition-colors select-none"
        >
          {dark ? '🌙 Dark' : '☀️ Light'}
        </button>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <aside className="w-72 border-r border-gray-200 dark:border-[#21262d] p-5 shrink-0
                          bg-gray-100 dark:bg-[#161b22] flex flex-col">
          <UploadPanel
            onUpload={handleUpload}
            session={session}
            onReset={() => setSession(null)}
          />
        </aside>

        <main className="flex-1 overflow-hidden bg-gray-50 dark:bg-[#0d1117]">
          <ChatWindow sessionId={session?.id} filename={session?.name} />
        </main>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify in browser**

With dev server running at `http://localhost:5173`:
- The header shows a blue document-icon square (not "R")
- Top-right shows `🌙 Dark` pill
- Clicking the pill toggles to `☀️ Light` and the background turns white/light gray
- Clicking again returns to dark
- Refresh the page — theme persists (localStorage working)

- [ ] **Step 3: Commit**

```bash
cd "c:/Users/West/Documents/RAG Project"
git add frontend/src/App.jsx
git commit -m "feat: add theme toggle with localStorage persistence and new doc icon"
```

---

## Task 6: Rewrite UploadPanel.jsx — taller zone, doc card, how it works

**Files:**
- Modify: `frontend/src/components/UploadPanel.jsx`

- [ ] **Step 1: Replace UploadPanel.jsx entirely**

```jsx
import { useState, useRef } from 'react'

export default function UploadPanel({ onUpload, session, onReset }) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState(null)
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
      const res = await fetch(`${import.meta.env.VITE_API_URL}/upload`, {
        method: 'POST',
        body: form,
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.detail || 'Upload failed')
      }
      const { session_id, chunk_count, page_count } = await res.json()
      onUpload(session_id, file.name, chunk_count, page_count)
    } catch (e) {
      setError(e.message)
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="flex flex-col gap-4 h-full">
      <p className="text-xs font-semibold text-gray-400 dark:text-[#8b949e] uppercase tracking-widest">
        Document
      </p>

      {/* Upload zone */}
      {!session && (
        <div
          onClick={() => inputRef.current.click()}
          onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault()
            setDragging(false)
            handleFile(e.dataTransfer.files[0])
          }}
          className={`border-2 border-dashed rounded-xl py-10 px-6 text-center cursor-pointer
                      transition-colors select-none
                      ${dragging
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/20'
                        : 'border-gray-300 dark:border-[#30363d] hover:border-blue-400 dark:hover:border-blue-500 hover:bg-gray-50 dark:hover:bg-[#1c2128]/40'
                      }`}
        >
          <input
            ref={inputRef}
            type="file"
            accept="application/pdf"
            className="hidden"
            onChange={(e) => handleFile(e.target.files[0])}
          />
          {uploading ? (
            <div className="flex flex-col items-center gap-3">
              <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-gray-500 dark:text-[#8b949e]">Indexing…</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3">
              <svg className="w-10 h-10 text-gray-300 dark:text-[#484f58]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              <div>
                <p className="text-sm text-gray-600 dark:text-[#8b949e] font-medium">Drop a PDF here</p>
                <p className="text-xs text-gray-400 dark:text-[#484f58] mt-0.5">or click to browse</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Current document card */}
      {session && (
        <div className="rounded-xl border border-gray-200 dark:border-[#30363d] bg-white dark:bg-[#1c2128] p-3 flex flex-col gap-1">
          <p className="text-xs text-gray-400 dark:text-[#8b949e] uppercase tracking-widest font-semibold">
            📎 Current Document
          </p>
          <p className="text-sm font-medium text-gray-900 dark:text-[#e6edf3] truncate">{session.name}</p>
          <p className="text-xs text-gray-500 dark:text-[#484f58]">
            {session.pageCount} {session.pageCount === 1 ? 'page' : 'pages'} · {session.chunkCount} chunks
          </p>
        </div>
      )}

      {session && (
        <button
          onClick={onReset}
          className="text-xs text-gray-400 dark:text-[#484f58] hover:text-gray-600 dark:hover:text-[#8b949e] transition-colors text-left"
        >
          Upload a different PDF
        </button>
      )}

      {error && <p className="text-red-400 text-xs">{error}</p>}

      {/* How it works — always visible, pinned to bottom */}
      <div className="mt-auto rounded-xl border border-gray-200 dark:border-[#30363d] bg-white dark:bg-[#1c2128]
                      border-l-2 border-l-blue-600 p-3">
        <p className="text-xs text-gray-400 dark:text-[#8b949e] uppercase tracking-widest font-semibold mb-2">
          How it works
        </p>
        <ol className="text-xs text-gray-500 dark:text-[#484f58] space-y-1 leading-relaxed">
          <li>① Upload a PDF</li>
          <li>② Ask a question</li>
          <li>③ AI answers from the doc</li>
        </ol>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify in browser**

At `http://localhost:5173`:
- Upload zone is taller with large cloud icon and two-line label
- Drag a PDF over — border turns blue
- Upload a PDF — zone disappears, Current Document card appears with filename + `N pages · N chunks`
- "Upload a different PDF" link appears below the card
- "How it works" blurb is visible at the bottom in both states (before and after upload)
- Toggle to light mode — all colors adapt correctly

- [ ] **Step 3: Commit**

```bash
cd "c:/Users/West/Documents/RAG Project"
git add frontend/src/components/UploadPanel.jsx
git commit -m "feat: redesign sidebar — taller upload zone, document info card, how it works blurb"
```

---

## Task 7: Rewrite ChatWindow.jsx — empty state, suggestion pills, always-present input

**Files:**
- Modify: `frontend/src/components/ChatWindow.jsx`

- [ ] **Step 1: Replace ChatWindow.jsx entirely**

```jsx
import { useState, useRef, useEffect } from 'react'
import MessageBubble from './MessageBubble'

const SUGGESTIONS = [
  'What is this document about?',
  'Summarize the key points',
  'What are the main conclusions?',
]

export default function ChatWindow({ sessionId, filename }) {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const bottomRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    if (sessionId) inputRef.current?.focus()
  }, [sessionId])

  // Reset messages when session changes
  useEffect(() => {
    setMessages([])
    setInput('')
  }, [sessionId])

  async function sendMessage(e) {
    e?.preventDefault()
    const text = input.trim()
    if (!text || streaming || !sessionId) return

    const userMessage = { role: 'user', content: text }
    const nextMessages = [...messages, userMessage]
    setMessages([...nextMessages, { role: 'assistant', content: '' }])
    setInput('')
    setStreaming(true)

    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/chat`, {
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

        const lines = decoder.decode(value).split('\n')
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const token = line.slice(6)
          if (token === '[DONE]' || token === '[ERROR]') continue
          assistantText += token
          setMessages([...nextMessages, { role: 'assistant', content: assistantText }])
        }
      }
    } catch (err) {
      setMessages([...nextMessages, { role: 'assistant', content: `Error: ${err.message}` }])
    } finally {
      setStreaming(false)
    }
  }

  function useSuggestion(text) {
    setInput(text)
    inputRef.current?.focus()
  }

  const showEmptyState = messages.length === 0

  return (
    <div className="flex flex-col h-full">
      {/* Filename bar — only when session active */}
      {sessionId && filename && (
        <div className="border-b border-gray-200 dark:border-[#21262d] px-5 py-3 shrink-0">
          <p className="text-sm text-gray-500 dark:text-[#8b949e] truncate">
            Chatting with <span className="text-gray-900 dark:text-white font-medium">{filename}</span>
          </p>
        </div>
      )}

      {/* Message list or empty state */}
      <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-3 min-h-0">
        {showEmptyState ? (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-center px-6">
            <svg className="w-12 h-12 text-gray-300 dark:text-[#30363d]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            <div>
              <h2 className="text-lg font-semibold text-gray-800 dark:text-[#e6edf3]">
                Ask anything about your document
              </h2>
              <p className="text-sm text-gray-400 dark:text-[#484f58] mt-1">
                {sessionId ? 'Your document is ready' : 'Upload a PDF to get started'}
              </p>
            </div>
            {sessionId && (
              <div className="flex flex-wrap gap-2 justify-center mt-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => useSuggestion(s)}
                    className="px-3 py-1.5 rounded-full text-xs border
                               border-gray-200 dark:border-[#30363d]
                               bg-white dark:bg-[#1c2128]
                               text-gray-600 dark:text-[#8b949e]
                               hover:border-blue-400 dark:hover:border-blue-500
                               hover:text-blue-600 dark:hover:text-blue-400
                               transition-colors"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          messages.map((msg, i) => (
            <MessageBubble
              key={i}
              role={msg.role}
              content={msg.content}
              streaming={streaming && i === messages.length - 1 && msg.role === 'assistant'}
            />
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input bar — always rendered, disabled until session exists */}
      <form onSubmit={sendMessage} className="border-t border-gray-200 dark:border-[#21262d] p-4 flex gap-2 shrink-0 bg-white dark:bg-[#0d1117]">
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={!sessionId || streaming}
          placeholder={sessionId ? 'Ask a question about the document…' : 'Upload a PDF to start chatting…'}
          className="flex-1 bg-gray-100 dark:bg-[#161b22] border border-gray-200 dark:border-[#30363d]
                     rounded-xl px-4 py-2.5 text-sm text-gray-900 dark:text-white
                     placeholder-gray-400 dark:placeholder-[#484f58]
                     outline-none focus:border-blue-500 transition-colors
                     disabled:opacity-50 disabled:cursor-not-allowed"
        />
        <button
          type="submit"
          disabled={!input.trim() || streaming || !sessionId}
          className="bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed
                     text-white text-sm font-medium px-4 py-2.5 rounded-xl transition-colors shrink-0"
        >
          Send
        </button>
      </form>
    </div>
  )
}
```

- [ ] **Step 2: Verify in browser — pre-upload state**

At `http://localhost:5173` with no PDF uploaded:
- Chat area shows centered chat-bubble icon
- Headline: "Ask anything about your document"
- Sub-label: "Upload a PDF to get started"
- No suggestion pills (session is null)
- Input bar visible at bottom, disabled, placeholder says "Upload a PDF to start chatting…"

- [ ] **Step 3: Verify in browser — post-upload state**

Upload a PDF:
- Filename bar appears at top of chat area
- Empty state updates sub-label to "Your document is ready"
- 3 suggestion pills appear: "What is this document about?", "Summarize the key points", "What are the main conclusions?"
- Click a pill — text fills the input box and input gets focus
- Input bar is now enabled
- Send a message — streaming works as before

- [ ] **Step 4: Toggle theme and verify**

Switch to light mode — chat area, input, bubbles all switch correctly. Switch back.

- [ ] **Step 5: Commit**

```bash
cd "c:/Users/West/Documents/RAG Project"
git add frontend/src/components/ChatWindow.jsx
git commit -m "feat: redesign chat area — empty state, suggestion pills, always-present input bar"
```

---

## Task 8: Update MessageBubble.jsx for light mode

**Files:**
- Modify: `frontend/src/components/MessageBubble.jsx`

- [ ] **Step 1: Add light mode classes to assistant bubble**

Replace the entire file:

```jsx
export default function MessageBubble({ role, content, streaming }) {
  const isUser = role === 'user'
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[78%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap
          ${isUser
            ? 'bg-blue-600 text-white rounded-br-sm'
            : 'bg-white dark:bg-[#1c2128] text-gray-800 dark:text-[#e6edf3] border border-gray-200 dark:border-[#30363d] rounded-bl-sm'
          }`}
      >
        {content}
        {streaming && (
          <span className="inline-block w-1.5 h-3.5 ml-0.5 bg-gray-400 animate-pulse align-middle rounded-sm" />
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify in browser**

Send a message, then toggle between dark and light:
- User bubbles: blue background, white text — unchanged in both modes
- Assistant bubbles: white bg with gray border in light mode; dark card (`#1c2128`) with subtle border in dark mode

- [ ] **Step 3: Commit**

```bash
cd "c:/Users/West/Documents/RAG Project"
git add frontend/src/components/MessageBubble.jsx
git commit -m "feat: add light mode variants to assistant message bubble"
```

---

## Task 9: Final smoke test + push

- [ ] **Step 1: Full end-to-end test in dark mode**

At `http://localhost:5173`:
1. Drag and drop a PDF — upload zone shows spinner, then disappears
2. Current Document card shows filename, page count, chunk count
3. "How it works" still visible below the card
4. Chat area shows 3 suggestion pills
5. Click "Summarize the key points" — fills input
6. Hit Send — streaming response appears, cursor blinks during stream
7. After response — conversation looks correct, input clears

- [ ] **Step 2: Repeat smoke test in light mode**

Toggle to light mode and repeat steps 1–7. Verify all colors look correct (no dark text on dark bg or vice versa).

- [ ] **Step 3: Compare before/after, then push when ready**

All changes are committed locally. Review the redesign in the browser at `http://localhost:5173` and compare against the live production app at `https://rag.jhestly.com`.

When you're satisfied, push manually:

```bash
cd "c:/Users/West/Documents/RAG Project"
git push
```

Railway will redeploy the backend (page_count now in /upload response) and Vercel will redeploy the frontend. Both complete within ~2 minutes.

- [ ] **Step 4: Verify production at https://rag.jhestly.com**

Upload a PDF at the live URL. Confirm the Current Document card shows real page + chunk counts from the Railway backend. Toggle theme — persists on refresh.
