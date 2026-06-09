import { useState, useRef } from 'react'

const MAX_DOCS = 5

export default function UploadPanel({ onUpload, session, onReset }) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState(null)
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef(null)

  const docs = session?.docs ?? []
  const canAddMore = docs.length < MAX_DOCS

  async function handleFiles(fileList) {
    const files = Array.from(fileList).filter(f => f.type === 'application/pdf')

    if (files.length === 0) {
      setError('Please select PDF files only.')
      return
    }

    if (docs.length + files.length > MAX_DOCS) {
      setError(`Too many files — max ${MAX_DOCS} total. You have ${docs.length}, tried to add ${files.length}.`)
      return
    }

    setError(null)
    setUploading(true)

    let currentSessionId = session?.id

    for (const file of files) {
      const form = new FormData()
      form.append('file', file)
      if (currentSessionId) form.append('session_id', currentSessionId)

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
        currentSessionId = session_id
        onUpload(session_id, file.name, chunk_count, page_count)
      } catch (e) {
        setError(e.message)
        break
      }
    }

    inputRef.current.value = ''
    setUploading(false)
  }

  return (
    <div className="flex flex-col gap-4 h-full">
      <p className="text-xs font-semibold text-gray-400 dark:text-[#8b949e] uppercase tracking-widest">
        Documents
      </p>

      {/* Document list */}
      {docs.length > 0 && (
        <div className="flex flex-col gap-2">
          {docs.map((doc, i) => (
            <div key={i} className="rounded-xl border border-gray-200 dark:border-[#30363d] bg-white dark:bg-[#1c2128] px-3 py-2 flex flex-col gap-0.5">
              <p className="text-xs font-medium text-gray-900 dark:text-[#e6edf3] truncate">{doc.name}</p>
              <p className="text-xs text-gray-400 dark:text-[#484f58]">
                {doc.pageCount} {doc.pageCount === 1 ? 'page' : 'pages'} · {doc.chunkCount} chunks
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Upload zone — hidden once 5 docs loaded */}
      {canAddMore && (
        <div
          onClick={() => inputRef.current.click()}
          onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault()
            setDragging(false)
            handleFiles(e.dataTransfer.files)
          }}
          className={`border-2 border-dashed rounded-xl text-center cursor-pointer transition-colors select-none
                      ${docs.length > 0 ? 'py-4 px-4' : 'py-10 px-6'}
                      ${dragging
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/20'
                        : 'border-gray-300 dark:border-[#30363d] hover:border-blue-400 dark:hover:border-blue-500 hover:bg-gray-50 dark:hover:bg-[#1c2128]/40'
                      }`}
        >
          <input
            ref={inputRef}
            type="file"
            accept="application/pdf"
            multiple
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
          />
          {uploading ? (
            <div className="flex flex-col items-center gap-2">
              <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-xs text-gray-500 dark:text-[#8b949e]">Indexing…</p>
            </div>
          ) : docs.length > 0 ? (
            <div className="flex items-center justify-center gap-2">
              <svg className="w-4 h-4 text-gray-400 dark:text-[#484f58]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
              </svg>
              <p className="text-xs text-gray-500 dark:text-[#8b949e]">
                Add more PDFs <span className="text-gray-400 dark:text-[#484f58]">({docs.length}/{MAX_DOCS})</span>
              </p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3">
              <svg className="w-10 h-10 text-gray-300 dark:text-[#484f58]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              <div>
                <p className="text-sm text-gray-600 dark:text-[#8b949e] font-medium">Drop PDFs here</p>
                <p className="text-xs text-gray-400 dark:text-[#484f58] mt-0.5">or click to browse (up to 5)</p>
              </div>
            </div>
          )}
        </div>
      )}

      {session && (
        <button
          onClick={() => { setError(null); onReset() }}
          className="text-xs text-gray-400 dark:text-[#484f58] hover:text-gray-600 dark:hover:text-[#8b949e] transition-colors text-left"
        >
          Start over
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
          <li>① Upload up to 5 PDFs</li>
          <li>② Ask a question</li>
          <li>③ AI answers from all docs</li>
        </ol>
      </div>
    </div>
  )
}
