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
      const res = await fetch(`${import.meta.env.VITE_API_URL}/upload`, {
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
      <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Document</h2>

      <div
        onClick={() => inputRef.current.click()}
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragging(false)
          handleFile(e.dataTransfer.files[0])
        }}
        className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors select-none
          ${dragging
            ? 'border-blue-500 bg-blue-950/20'
            : 'border-gray-700 hover:border-gray-500 hover:bg-gray-900/40'
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
          <div className="flex flex-col items-center gap-2">
            <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-gray-400 text-sm">Indexing…</p>
          </div>
        ) : uploadedFile ? (
          <div className="flex flex-col items-center gap-1">
            <svg className="w-5 h-5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <p className="text-green-400 text-sm font-medium truncate max-w-full">{uploadedFile}</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <svg className="w-6 h-6 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            <p className="text-gray-500 text-sm">Drop a PDF or click to select</p>
          </div>
        )}
      </div>

      {error && <p className="text-red-400 text-xs">{error}</p>}
      {uploadedFile && !uploading && (
        <button
          onClick={() => { setUploadedFile(null); setError(null) }}
          className="text-xs text-gray-600 hover:text-gray-400 transition-colors text-left"
        >
          Upload a different PDF
        </button>
      )}
    </div>
  )
}
