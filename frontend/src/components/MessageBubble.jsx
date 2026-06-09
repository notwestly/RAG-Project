import ReactMarkdown from 'react-markdown'

export default function MessageBubble({ role, content, streaming }) {
  const isUser = role === 'user'
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[78%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed
          ${isUser
            ? 'bg-blue-600 text-white rounded-br-sm whitespace-pre-wrap'
            : 'bg-white dark:bg-[#1c2128] text-gray-800 dark:text-[#e6edf3] border border-gray-200 dark:border-[#30363d] rounded-bl-sm'
          }`}
      >
        {isUser ? content : (
          <ReactMarkdown
            components={{
              p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
              ul: ({ children }) => <ul className="list-disc list-outside pl-4 mb-2 space-y-1">{children}</ul>,
              ol: ({ children }) => <ol className="list-decimal list-outside pl-4 mb-2 space-y-1">{children}</ol>,
              li: ({ children }) => <li className="leading-relaxed">{children}</li>,
              strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
              h1: ({ children }) => <h1 className="text-base font-bold mb-2 mt-1">{children}</h1>,
              h2: ({ children }) => <h2 className="text-sm font-bold mb-1.5 mt-1">{children}</h2>,
              h3: ({ children }) => <h3 className="text-sm font-semibold mb-1 mt-1">{children}</h3>,
              code: ({ children }) => <code className="bg-gray-100 dark:bg-[#0d1117] rounded px-1 py-0.5 text-xs font-mono">{children}</code>,
              hr: () => <hr className="border-gray-200 dark:border-[#30363d] my-2" />,
            }}
          >
            {content}
          </ReactMarkdown>
        )}
        {streaming && (
          <span className="inline-block w-1.5 h-3.5 ml-0.5 bg-gray-400 animate-pulse align-middle rounded-sm" />
        )}
      </div>
    </div>
  )
}
