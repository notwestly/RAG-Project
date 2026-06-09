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
