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
        let message = `Upload failed (${res.status})`
        try {
          const data = await res.json()
          message = data.detail || message
        } catch { /* response wasn't JSON */ }
        throw new Error(message)
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
          onClick={() => { setError(null); onReset() }}
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
