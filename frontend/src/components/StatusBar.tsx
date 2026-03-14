import type { SystemStatus } from '../lib/api';

interface StatusBarProps {
  status: SystemStatus | null;
}

function Pill({ children, title }: { children: React.ReactNode; title?: string }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-zinc-800/80 text-zinc-400 text-xs border border-zinc-700/50"
      title={title}
    >
      {children}
    </span>
  );
}

export function StatusBar({ status }: StatusBarProps) {
  if (!status) {
    return (
      <span className="text-xs text-zinc-500 px-2 py-1">Connecting...</span>
    );
  }

  const statusDot = () => {
    if (status.status === 'error')
      return <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" title="Error" />;
    if (status.status === 'indexing')
      return <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse shrink-0" title="Indexing" />;
    return <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" title="Ready" />;
  };

  const providerLabel =
    status.model_provider === 'ollama'
      ? 'Ollama (Local)'
      : status.model_provider === 'openai'
        ? 'OpenAI (Cloud)'
        : 'No provider';

  const modelLabel = status.model_display_name
    ? `${providerLabel} (${status.model_display_name})`
    : providerLabel;

  return (
    <div className="flex flex-wrap items-center gap-1.5 md:gap-2 text-xs">
      <Pill title="Model provider and name">
        {statusDot()}
        <span className="truncate max-w-[140px] sm:max-w-[200px]">{modelLabel}</span>
      </Pill>
      <Pill title="Embedding model">
        <span>🧠</span>
        <span className="truncate max-w-[100px] md:max-w-[160px]">{status.embedding_model}</span>
      </Pill>
      <Pill title="Indexed documents">
        <span>📄</span>
        <span>{status.documents}</span>
      </Pill>
      <Pill title="Vector chunks">
        <span>🧩</span>
        <span>{status.chunks}</span>
      </Pill>
      {status.latency && (
        <Pill title="Last response latency">
          <span>⚡</span>
          <span>{status.latency}</span>
        </Pill>
      )}
    </div>
  );
}
