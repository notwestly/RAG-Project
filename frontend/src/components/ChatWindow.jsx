import { useState, useRef, useEffect } from 'react'
import MessageBubble from './MessageBubble'

const SUGGESTIONS = [
  'What is this document about?',
  'Summarize the key points',
  'What are the main conclusions?',
]

const MAX_CHARS = 500
const MAX_USER_TURNS = 20
const MAX_DOCS = 5

export default function ChatWindow({ sessionId, docs = [], onFileDrop, onReset }) {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const bottomRef = useRef(null)
  const inputRef = useRef(null)
  const dropInputRef = useRef(null)

  const userTurns = messages.filter(m => m.role === 'user').length
  const sessionLimitReached = userTurns >= MAX_USER_TURNS
  const charsLeft = MAX_CHARS - input.length
  const nearLimit = input.length >= MAX_CHARS * 0.8
  const atLimit = input.length >= MAX_CHARS

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    if (sessionId) inputRef.current?.focus()
  }, [sessionId])

  useEffect(() => {
    setMessages([])
    setInput('')
  }, [sessionId])

  async function sendMessage(e) {
    e?.preventDefault()
    const text = input.trim()
    if (!text || streaming || !sessionId || sessionLimitReached) return

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
          let token
          try { token = JSON.parse(line.slice(6)) } catch { continue }
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

  function handleAreaDrop(e) {
    e.preventDefault()
    setDragOver(false)
    if (sessionId || !onFileDrop) return
    onFileDrop(e.dataTransfer.files)
  }

  function useSuggestion(text) {
    setInput(text)
    inputRef.current?.focus()
  }

  const showEmptyState = messages.length === 0

  return (
    <div className="flex flex-col h-full">
      {/* Doc bar — only when session active */}
      {sessionId && docs.length > 0 && (
        <div className="border-b border-gray-200 dark:border-[#21262d] px-4 md:px-5 py-2.5 md:py-3 shrink-0 flex items-center gap-2">
          <p className="text-sm text-gray-500 dark:text-[#8b949e] truncate flex-1 min-w-0">
            {docs.length === 1
              ? <><span className="hidden md:inline">Chatting with </span><span className="text-gray-900 dark:text-white font-medium">{docs[0].name}</span></>
              : <><span className="hidden md:inline">Chatting with </span><span className="text-gray-900 dark:text-white font-medium">{docs.length} documents</span></>
            }
          </p>
          {/* Mobile: add more docs */}
          {docs.length < MAX_DOCS && onFileDrop && (
            <>
              <input
                id="mobile-add-input"
                type="file"
                accept="application/pdf"
                multiple
                className="hidden"
                onChange={(e) => onFileDrop(e.target.files)}
              />
              <label
                htmlFor="mobile-add-input"
                className="md:hidden shrink-0 text-xs text-blue-500 dark:text-blue-400 font-medium
                           px-2.5 py-1 rounded-lg border border-blue-200 dark:border-blue-900/50
                           hover:bg-blue-50 dark:hover:bg-blue-950/20 active:scale-95 transition-all cursor-pointer"
              >
                + Add
              </label>
            </>
          )}
          {/* Mobile: start over */}
          {onReset && (
            <button
              onClick={onReset}
              className="md:hidden shrink-0 text-xs text-gray-400 dark:text-[#484f58] font-medium
                         px-2.5 py-1 rounded-lg border border-gray-200 dark:border-[#30363d]
                         hover:text-gray-600 dark:hover:text-[#8b949e] active:scale-95 transition-all"
            >
              Reset
            </button>
          )}
        </div>
      )}

      {/* Message list or empty state */}
      <div
        className={`flex-1 overflow-y-auto p-4 md:p-5 flex flex-col gap-3 min-h-0 transition-colors
          ${!sessionId && dragOver ? 'bg-blue-50/40 dark:bg-blue-950/10' : ''}`}
        onDragOver={(e) => { e.preventDefault(); if (!sessionId) setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleAreaDrop}
      >
        {showEmptyState ? (
          <div className="flex flex-col items-center justify-center h-full px-2">
            {!sessionId ? (
              /* ── No session: label triggers file input natively (works on mobile) ── */
              <>
                <input
                  id="drop-file-input"
                  ref={dropInputRef}
                  type="file"
                  accept="application/pdf"
                  multiple
                  className="hidden"
                  onChange={(e) => { if (onFileDrop) onFileDrop(e.target.files) }}
                />
                <label
                  htmlFor={onFileDrop ? 'drop-file-input' : undefined}
                  className={`flex flex-col items-center gap-5 text-center px-6 py-8
                              rounded-2xl border border-gray-200 dark:border-[#30363d]
                              bg-white dark:bg-[#161b22] w-full max-w-sm
                              ${onFileDrop
                                ? 'cursor-pointer hover:border-blue-400 dark:hover:border-blue-500 active:scale-[0.98] transition-all'
                                : ''}`}
                >
                  <div className="w-14 h-14 rounded-2xl bg-blue-50 dark:bg-blue-950/30 flex items-center justify-center">
                    <svg className="w-7 h-7 text-blue-500 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                        d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                  </div>
                  <div className="space-y-1.5">
                    <h2 className="text-base font-semibold text-gray-800 dark:text-[#e6edf3]">
                      Ask anything about your document
                    </h2>
                    <p className="text-sm text-gray-400 dark:text-[#484f58] leading-relaxed">
                      Upload a PDF and get instant AI-powered answers from your documents
                    </p>
                  </div>
                  <div className="w-full pt-3 border-t border-gray-100 dark:border-[#21262d]">
                    <p className="text-sm font-medium text-blue-600 dark:text-blue-400">
                      Tap to attach a file
                    </p>
                    <p className="text-xs text-gray-400 dark:text-[#484f58] mt-0.5">
                      or drag &amp; drop a PDF here · up to 5 files
                    </p>
                  </div>
                </label>
              </>
            ) : (
              /* ── Session active: show suggestion pills ── */
              <div className="flex flex-col items-center gap-5 text-center px-6 py-8
                              rounded-2xl border border-gray-200 dark:border-[#30363d]
                              bg-white dark:bg-[#161b22] w-full max-w-sm">
                <svg className="w-9 h-9 text-gray-300 dark:text-[#30363d]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                <div>
                  <h2 className="text-sm font-semibold text-gray-800 dark:text-[#e6edf3]">
                    Ask anything about your document
                  </h2>
                  <p className="text-xs text-gray-400 dark:text-[#484f58] mt-1">
                    Your document is ready
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 justify-center">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      onClick={() => useSuggestion(s)}
                      className="px-3 py-2 rounded-full text-xs border
                                 border-gray-200 dark:border-[#30363d]
                                 bg-gray-50 dark:bg-[#1c2128]
                                 text-gray-600 dark:text-[#8b949e]
                                 hover:border-blue-400 dark:hover:border-blue-500
                                 hover:text-blue-600 dark:hover:text-blue-400
                                 active:scale-95 transition-all"
                    >
                      {s}
                    </button>
                  ))}
                </div>
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

      {/* Input area */}
      {sessionLimitReached ? (
        <div className="border-t border-gray-200 dark:border-[#21262d] px-4 md:px-5 py-4 shrink-0 bg-white dark:bg-[#0d1117]">
          <div className="rounded-xl border border-amber-200 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-950/20 px-4 py-3 text-center">
            <p className="text-xs font-medium text-amber-700 dark:text-amber-400">
              Session limit reached ({MAX_USER_TURNS} messages)
            </p>
            {onReset ? (
              <button
                onClick={onReset}
                className="md:hidden text-xs text-amber-600 dark:text-amber-400 font-medium underline mt-0.5"
              >
                Start a new session
              </button>
            ) : null}
            <p className="hidden md:block text-xs text-amber-600/70 dark:text-amber-500/60 mt-0.5">
              Click "Start over" in the sidebar to begin a new session.
            </p>
          </div>
        </div>
      ) : (
        <form
          onSubmit={sendMessage}
          className="border-t border-gray-200 dark:border-[#21262d] p-3 md:p-4 flex flex-col gap-1.5 shrink-0 bg-white dark:bg-[#0d1117]"
        >
          <div className="flex gap-2">
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value.slice(0, MAX_CHARS))}
              disabled={!sessionId || streaming}
              placeholder={sessionId ? 'Ask a question about the document…' : 'Upload a PDF to start chatting…'}
              className="flex-1 bg-gray-100 dark:bg-[#161b22] border border-gray-200 dark:border-[#30363d]
                         rounded-xl px-4 py-3 text-sm text-gray-900 dark:text-white
                         placeholder-gray-400 dark:placeholder-[#484f58]
                         outline-none focus:border-blue-500 transition-colors
                         disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <button
              type="submit"
              disabled={!input.trim() || streaming || !sessionId}
              className="bg-blue-600 hover:bg-blue-500 active:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed
                         text-white text-sm font-medium px-4 py-3 rounded-xl transition-colors shrink-0"
            >
              Send
            </button>
          </div>
          {sessionId && input.length > 0 && (
            <p className={`text-right text-xs pr-1 transition-colors
              ${atLimit
                ? 'text-red-500 dark:text-red-400 font-medium'
                : nearLimit
                  ? 'text-amber-500 dark:text-amber-400'
                  : 'text-gray-300 dark:text-[#30363d]'
              }`}>
              {charsLeft} characters remaining
            </p>
          )}
        </form>
      )}
    </div>
  )
}
