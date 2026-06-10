import { useState, useEffect } from 'react'
import UploadPanel from './components/UploadPanel'
import ChatWindow from './components/ChatWindow'

export default function App() {
  const [dark, setDark] = useState(() => localStorage.getItem('theme') !== 'light')
  const [session, setSession] = useState(null)
  const [uploading, setUploading] = useState(false)

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
    localStorage.setItem('theme', dark ? 'dark' : 'light')
  }, [dark])

  function handleUpload(sessionId, name, chunkCount, pageCount) {
    setSession(prev => {
      const newDoc = { name, chunkCount, pageCount }
      if (prev?.id === sessionId) {
        return { ...prev, docs: [...prev.docs, newDoc] }
      }
      return { id: sessionId, docs: [newDoc] }
    })
  }

  async function handleFileDrop(fileList) {
    const files = Array.from(fileList).filter(f => f.type === 'application/pdf')
    if (files.length === 0) return
    setUploading(true)
    let currentSessionId = session?.id
    for (const file of files) {
      const form = new FormData()
      form.append('file', file)
      if (currentSessionId) form.append('session_id', currentSessionId)
      try {
        const res = await fetch(`${import.meta.env.VITE_API_URL}/upload`, { method: 'POST', body: form })
        if (!res.ok) { setUploading(false); return }
        const { session_id, chunk_count, page_count } = await res.json()
        currentSessionId = session_id
        handleUpload(session_id, file.name, chunk_count, page_count)
      } catch { /* silent */ }
    }
    setUploading(false)
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0d1117] text-gray-900 dark:text-[#e6edf3] flex flex-col">
      <header className="border-b border-gray-200 dark:border-[#21262d] px-4 md:px-6 py-3 shrink-0 bg-white dark:bg-[#0d1117]">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center shrink-0">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="currentColor">
              <path d="M7 3a2 2 0 00-2 2v1H4a2 2 0 00-2 2v11a2 2 0 002 2h12a2 2 0 002-2V8a2 2 0 00-2-2h-1V5a2 2 0 00-2-2H7zm6 2v1H7V5h6zm-1 5a1 1 0 110 2H8a1 1 0 110-2h4zm2 4a1 1 0 110 2H8a1 1 0 110-2h6z"/>
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-sm font-semibold tracking-tight">RAG Document Chat</h1>
            <p className="text-xs text-gray-400 dark:text-[#484f58] md:hidden leading-tight mt-0.5">
              Upload PDFs and chat with your documents using AI
            </p>
          </div>
          <button
            onClick={() => setDark(d => !d)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium
                       bg-gray-100 dark:bg-[#21262d] border border-gray-200 dark:border-[#30363d]
                       text-gray-600 dark:text-[#8b949e] hover:border-gray-300 dark:hover:border-[#484f58]
                       transition-colors select-none shrink-0"
          >
            {dark ? '🌙 Dark' : '☀️ Light'}
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar — desktop only */}
        <aside className="hidden md:flex w-72 border-r border-gray-200 dark:border-[#21262d] p-5 shrink-0
                          bg-gray-100 dark:bg-[#161b22] flex-col">
          <UploadPanel
            onUpload={handleUpload}
            session={session}
            onReset={() => setSession(null)}
          />
        </aside>

        <main className="flex-1 overflow-hidden bg-gray-50 dark:bg-[#0d1117]">
          <ChatWindow
            sessionId={session?.id}
            docs={session?.docs ?? []}
            onFileDrop={handleFileDrop}
            onReset={() => setSession(null)}
            uploading={uploading}
          />
        </main>
      </div>
    </div>
  )
}
