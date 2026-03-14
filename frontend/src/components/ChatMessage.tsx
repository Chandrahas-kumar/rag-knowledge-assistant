import { useState } from 'react';
import { DocumentTextIcon, ClipboardDocumentIcon, ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/24/outline';
import { CheckIcon } from '@heroicons/react/24/solid';
import ReactMarkdown from 'react-markdown';

interface SourceItem {
  file: string;
  page: number;
}

interface ChatMessageProps {
  role: 'user' | 'assistant';
  content: string;
  sources?: SourceItem[];
  showCitations?: boolean;
}

export function ChatMessage({ role, content, sources = [], showCitations = true }: ChatMessageProps) {
  const [copied, setCopied] = useState(false);
  const [sourcesExpanded, setSourcesExpanded] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isUser = role === 'user';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}>
      <div
        className={`max-w-[85%] md:max-w-[75%] rounded-2xl px-4 py-3 ${
          isUser
            ? 'bg-violet-600/20 text-zinc-100 border border-violet-500/30'
            : 'bg-zinc-800/80 text-zinc-200 border border-zinc-700/50'
        }`}
      >
        {isUser ? (
          <p className="text-sm whitespace-pre-wrap">{content}</p>
        ) : (
          <div className="space-y-2">
            <div className="prose prose-invert prose-sm max-w-none">
              <ReactMarkdown>{content}</ReactMarkdown>
            </div>
            {showCitations && sources.length > 0 && (
              <div className="mt-3 pt-3 border-t border-zinc-700">
                <button
                  onClick={() => setSourcesExpanded(!sourcesExpanded)}
                  className="flex items-center gap-2 text-xs text-zinc-500 hover:text-zinc-400"
                >
                  <DocumentTextIcon className="w-4 h-4" />
                  Sources ({sources.length})
                  {sourcesExpanded ? <ChevronUpIcon className="w-4 h-4" /> : <ChevronDownIcon className="w-4 h-4" />}
                </button>
                {sourcesExpanded && (
                  <ul className="mt-2 space-y-1.5 text-xs text-zinc-500">
                    {sources.map((s, i) => (
                      <li key={i} className="flex flex-col gap-0.5">
                        <span className="text-violet-400 font-medium">{s.file}</span>
                        <span className="text-zinc-600 pl-2">{s.page > 0 ? `Page ${s.page}` : '—'}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-400 mt-2"
            >
              {copied ? <CheckIcon className="w-4 h-4" /> : <ClipboardDocumentIcon className="w-4 h-4" />}
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
