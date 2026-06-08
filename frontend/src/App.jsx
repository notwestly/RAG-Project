import { useState } from 'react'
import UploadPanel from './components/UploadPanel'
import ChatWindow from './components/ChatWindow'

export default function App() {
  const [session, setSession] = useState(null)

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col">
      <header className="border-b border-gray-800 px-6 py-4 flex items-center gap-3 shrink-0">
        <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center text-xs font-bold select-none">
          R
        </div>
        <h1 className="text-base font-semibold tracking-tight">RAG Document Chat</h1>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <aside className="w-72 border-r border-gray-800 p-5 shrink-0">
          <UploadPanel onUpload={(id, name) => setSession({ id, name })} />
        </aside>

        <main className="flex-1 overflow-hidden">
          {session ? (
            <ChatWindow sessionId={session.id} filename={session.name} />
          ) : (
            <div className="flex items-center justify-center h-full">
              <p className="text-gray-600 text-sm">Upload a PDF on the left to start chatting</p>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
