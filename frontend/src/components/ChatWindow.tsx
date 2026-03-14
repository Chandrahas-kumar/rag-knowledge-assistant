import { useRef, useEffect, useState } from 'react';
import { PaperClipIcon, ArrowUpIcon, DocumentTextIcon, CheckCircleIcon } from '@heroicons/react/24/outline';
import { ChatMessage } from './ChatMessage';
import type { Message, SystemStatus } from '../lib/api';

interface Document {
  id: string;
  name: string;
  size: number;
}

interface ChatWindowProps {
  chatId: string | null;
  chatName: string;
  documentCount: number;
  documents: Document[];
  chunksCount: number;
  messages: Message[];
  isLoading: boolean;
  onSend: (text: string) => void;
  onAddDocuments: () => void;
  showCitations: boolean;
  systemStatus: SystemStatus | null;
}

export function ChatWindow({
  chatId,
  chatName,
  documentCount,
  documents,
  chunksCount,
  messages,
  isLoading,
  onSend,
  onAddDocuments,
  showCitations,
  systemStatus,
}: ChatWindowProps) {
  const [input, setInput] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || !chatId) return;
    onSend(text);
    setInput('');
  };

  if (!chatId) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-zinc-500 p-8">
        <div className="w-16 h-16 rounded-2xl bg-zinc-800 flex items-center justify-center mb-4 text-3xl">
          L
        </div>
        <p className="text-lg font-medium text-zinc-400">Select a chat or create a new one</p>
        <p className="text-sm mt-1">Upload documents and start asking questions</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Header */}
      <header className="flex flex-col gap-3 px-4 py-3 border-b border-zinc-800 bg-zinc-900/50 shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-zinc-100">{chatName}</h2>
            <p className="text-xs text-zinc-500">
              {documentCount} document{documentCount !== 1 ? 's' : ''}
              {chunksCount > 0 && ` • ${chunksCount} chunks indexed`}
            </p>
          </div>
          <button
            onClick={onAddDocuments}
            className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-zinc-300 text-sm"
          >
            <PaperClipIcon className="w-4 h-4" />
            Add Documents
          </button>
        </div>
        {documents.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {documents.map((d) => (
              <div
                key={d.id}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-800/80 border border-zinc-700/50"
              >
                <DocumentTextIcon className="w-4 h-4 text-zinc-500 shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm text-zinc-300 truncate max-w-[180px]">{d.name}</p>
                  <p className="flex items-center gap-1 text-xs text-emerald-500/90">
                    <CheckCircleIcon className="w-3.5 h-3.5 shrink-0" />
                    Indexed successfully
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
        {/* Model status badge */}
        {systemStatus && (
          <div className="flex items-center gap-2">
            {systemStatus.model_provider === 'ollama' && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-400 text-xs font-medium border border-emerald-500/30">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> Local Model: Ollama ({systemStatus.model_name || 'Llama'})
              </span>
            )}
            {systemStatus.model_provider === 'openai' && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-sky-500/20 text-sky-400 text-xs font-medium border border-sky-500/30">
                <span>☁️</span> Cloud Model: OpenAI {systemStatus.model_name || 'GPT-4'}
              </span>
            )}
            {systemStatus.model_provider === 'none' && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/20 text-amber-400 text-xs font-medium border border-amber-500/30">
                No model provider configured
              </span>
            )}
          </div>
        )}
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        {systemStatus?.model_provider === 'none' && (
          <div className="flex flex-col items-center justify-center h-full text-center p-6">
            <div className="max-w-md rounded-xl bg-amber-500/10 border border-amber-500/30 p-6 text-left">
              <p className="font-medium text-amber-400 mb-2">No model provider configured</p>
              <p className="text-sm text-zinc-400 mb-3">To run locally (recommended):</p>
              <ul className="text-sm text-zinc-500 space-y-1 list-disc list-inside mb-3">
                <li>Install and run <a href="https://ollama.com" target="_blank" rel="noreferrer" className="text-violet-400 hover:underline">Ollama</a></li>
                <li>Then run: <code className="text-zinc-400">ollama pull llama3</code></li>
              </ul>
              <p className="text-sm text-zinc-500">Or add <code className="text-zinc-400">OPENAI_API_KEY</code> in Settings for cloud mode.</p>
            </div>
          </div>
        )}
        {systemStatus?.model_provider !== 'none' && messages.length === 0 && !isLoading ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <p className="text-zinc-500 mb-2">Ask a question about your documents</p>
            <p className="text-sm text-zinc-600">Upload PDFs first if you haven&apos;t already</p>
          </div>
        ) : systemStatus?.model_provider !== 'none' ? (
          <>
            {messages.map((m, i) => (
              <ChatMessage
                key={i}
                role={m.role}
                content={m.content}
                sources={m.sources}
                showCitations={showCitations}
              />
            ))}
            {isLoading && (
              <div className="flex justify-start mb-4">
                <div className="bg-zinc-800/80 rounded-2xl px-4 py-3 border border-zinc-700/50">
                  <div className="flex gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-violet-500 animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-2 h-2 rounded-full bg-violet-500 animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-2 h-2 rounded-full bg-violet-500 animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </>
        ) : null}
      </div>

      {/* Input */}
      <div className="p-4 border-t border-zinc-800 bg-zinc-900/30">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <button
            type="button"
            onClick={onAddDocuments}
            className="p-2.5 rounded-xl hover:bg-zinc-800 text-zinc-500 shrink-0"
            title="Attach document"
          >
            <PaperClipIcon className="w-5 h-5" />
          </button>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={systemStatus?.model_provider === 'none' ? 'Configure a model provider first...' : 'Ask a question about your documents...'}
            className="flex-1 bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500"
            disabled={isLoading || systemStatus?.model_provider === 'none'}
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading || systemStatus?.model_provider === 'none'}
            className="p-3 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white shrink-0"
          >
            <ArrowUpIcon className="w-5 h-5" />
          </button>
        </form>
      </div>
    </div>
  );
}
