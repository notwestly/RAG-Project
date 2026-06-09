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
