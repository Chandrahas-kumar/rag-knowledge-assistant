import { Fragment, useState } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import {
  XMarkIcon,
  CpuChipIcon,
  SwatchIcon,
  ChatBubbleLeftRightIcon,
  KeyIcon,
} from '@heroicons/react/24/outline';
import type { Settings, SystemStatus } from '../lib/api';

interface SettingsPanelProps {
  open: boolean;
  onClose: () => void;
  settings: Settings;
  systemStatus: SystemStatus | null;
  onUpdate: (s: Partial<Settings>) => void;
}

const OLLAMA_MODELS = ['llama3.1:8b', 'llama3', 'mistral', 'codellama', 'phi3'];
const OPENAI_MODELS = ['gpt-4o', 'gpt-4', 'gpt-3.5-turbo'];

function Toggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors ${
        checked ? 'bg-violet-600' : 'bg-zinc-700'
      }`}
    >
      <span
        className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow ring-0 transition-transform ${
          checked ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
  );
}

export function SettingsPanel({
  open,
  onClose,
  settings,
  systemStatus,
  onUpdate,
}: SettingsPanelProps) {
  const [apiKeyVisible, setApiKeyVisible] = useState(false);

  return (
    <Transition show={open} as={Fragment}>
      <Dialog onClose={onClose} className="relative z-50">
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-200"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-150"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/60" />
        </Transition.Child>
        <div className="fixed inset-0 flex justify-end">
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-200"
            enterFrom="translate-x-full"
            enterTo="translate-x-0"
            leave="ease-in duration-150"
            leaveFrom="translate-x-0"
            leaveTo="translate-x-full"
          >
            <Dialog.Panel className="w-full sm:max-w-lg bg-zinc-900 border-l border-zinc-800 shadow-xl overflow-y-auto">
              <div className="flex items-center justify-between p-4 border-b border-zinc-800 sticky top-0 bg-zinc-900 z-10">
                <Dialog.Title className="text-lg font-semibold text-zinc-100">
                  Settings
                </Dialog.Title>
                <button
                  onClick={onClose}
                  className="p-2 rounded-lg hover:bg-zinc-800 text-zinc-400"
                >
                  <XMarkIcon className="w-5 h-5" />
                </button>
              </div>

              <div className="p-4 space-y-8">
                {/* AI Provider */}
                <section>
                  <h3 className="flex items-center gap-2 text-sm font-medium text-zinc-500 uppercase tracking-wider mb-3">
                    <CpuChipIcon className="w-4 h-4" />
                    AI Provider
                  </h3>
                  <div className="space-y-3">
                    <div className="flex gap-2">
                      {['', 'ollama', 'openai'].map((p) => (
                        <button
                          key={p || 'auto'}
                          onClick={() => onUpdate({ llm_provider: p })}
                          className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                            (settings.llm_provider || '') === p
                              ? 'bg-violet-600/20 text-violet-400 border border-violet-500/30'
                              : 'bg-zinc-800/50 text-zinc-400 hover:text-zinc-300 border border-transparent'
                          }`}
                        >
                          {p === '' ? 'Auto' : p === 'ollama' ? 'Ollama' : 'OpenAI'}
                        </button>
                      ))}
                    </div>
                    {systemStatus && (
                      <p className="text-xs text-zinc-500">
                        Detected: {systemStatus.model_provider === 'ollama'
                          ? `Ollama (${systemStatus.model_display_name || systemStatus.model_name})`
                          : systemStatus.model_provider === 'openai'
                            ? `OpenAI (${systemStatus.model_display_name || systemStatus.model_name})`
                            : 'None'}
                      </p>
                    )}
                    {(settings.llm_provider === 'ollama' || !settings.llm_provider) && (
                      <div className="space-y-2">
                        {systemStatus && (
                          <p className="text-xs text-zinc-500">
                            Status: {systemStatus.model_provider === 'ollama' ? (
                              <span className="text-emerald-500">Connected — {systemStatus.model_display_name || systemStatus.model_name}</span>
                            ) : systemStatus.model_provider === 'none' ? (
                              <span className="text-amber-500">Not connected — run <code className="text-zinc-400">ollama serve</code></span>
                            ) : (
                              <span className="text-zinc-400">Using {systemStatus.model_provider}</span>
                            )}
                          </p>
                        )}
                        <div>
                          <label className="block text-sm text-zinc-400 mb-1">Ollama model</label>
                          <select
                          value={settings.ollama_model || 'llama3.1:8b'}
                          onChange={(e) => onUpdate({ ollama_model: e.target.value })}
                          className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-zinc-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/50"
                        >
                          {OLLAMA_MODELS.map((m) => (
                            <option key={m} value={m}>{m}</option>
                          ))}
                          <option value="_custom">Custom (set in .env)</option>
                        </select>
                        </div>
                      </div>
                    )}
                    {(settings.llm_provider === 'openai' || !settings.llm_provider) && (
                      <>
                        <div>
                          <label className="block text-sm text-zinc-400 mb-1">OpenAI model</label>
                          <select
                            value={settings.openai_model || 'gpt-4o'}
                            onChange={(e) => onUpdate({ openai_model: e.target.value })}
                            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-zinc-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/50"
                          >
                            {OPENAI_MODELS.map((m) => (
                              <option key={m} value={m}>{m}</option>
                            ))}
                          </select>
                        </div>
                      </>
                    )}
                  </div>
                </section>

                {/* API Configuration - shown when OpenAI is an option */}
                {(settings.llm_provider === 'openai' || !settings.llm_provider) && (
                  <section>
                    <h3 className="flex items-center gap-2 text-sm font-medium text-zinc-500 uppercase tracking-wider mb-3">
                      <KeyIcon className="w-4 h-4" />
                      API Configuration
                    </h3>
                    <div>
                      <label className="block text-sm text-zinc-400 mb-1">OpenAI API Key</label>
                      <input
                        type={apiKeyVisible ? 'text' : 'password'}
                        value={settings.openai_api_key || ''}
                        onChange={(e) => onUpdate({ openai_api_key: e.target.value })}
                        placeholder="sk-... (or set OPENAI_API_KEY in .env)"
                        className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-zinc-200 text-sm placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50"
                      />
                      <button
                        type="button"
                        onClick={() => setApiKeyVisible(!apiKeyVisible)}
                        className="mt-1 text-xs text-zinc-500 hover:text-zinc-400"
                      >
                        {apiKeyVisible ? 'Hide' : 'Show'} key
                      </button>
                    </div>
                  </section>
                )}

                {/* Appearance */}
                <section>
                  <h3 className="flex items-center gap-2 text-sm font-medium text-zinc-500 uppercase tracking-wider mb-3">
                    <SwatchIcon className="w-4 h-4" />
                    Appearance
                  </h3>
                  <div className="space-y-2">
                    {[
                      { id: 'dark', label: 'Dark' },
                      { id: 'light', label: 'Light' },
                      { id: 'loki', label: 'LOKI theme' },
                    ].map((t) => (
                      <button
                        key={t.id}
                        onClick={() => onUpdate({ theme: t.id })}
                        className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-colors ${
                          settings.theme === t.id
                            ? 'bg-violet-600/20 text-violet-400 border border-violet-500/30'
                            : 'bg-zinc-800/50 text-zinc-400 hover:text-zinc-300 border border-transparent'
                        }`}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                </section>

                {/* Chat Settings */}
                <section>
                  <h3 className="flex items-center gap-2 text-sm font-medium text-zinc-500 uppercase tracking-wider mb-3">
                    <ChatBubbleLeftRightIcon className="w-4 h-4" />
                    Chat Settings
                  </h3>
                  <div className="space-y-3">
                    <label className="flex items-center justify-between">
                      <span className="text-sm text-zinc-400">Show citations</span>
                      <Toggle
                        checked={settings.show_citations}
                        onChange={() => onUpdate({ show_citations: !settings.show_citations })}
                      />
                    </label>
                    <label className="flex items-center justify-between">
                      <span className="text-sm text-zinc-400">Streaming responses</span>
                      <Toggle
                        checked={settings.streaming}
                        onChange={() => onUpdate({ streaming: !settings.streaming })}
                      />
                    </label>
                    <label className="flex items-center justify-between">
                      <span className="text-sm text-zinc-400">Sound notifications</span>
                      <Toggle
                        checked={settings.sound_notifications ?? false}
                        onChange={() =>
                          onUpdate({ sound_notifications: !(settings.sound_notifications ?? false) })
                        }
                      />
                    </label>
                  </div>
                </section>

                {/* Retrieval */}
                <section>
                  <h3 className="text-sm font-medium text-zinc-500 uppercase tracking-wider mb-3">
                    Retrieval
                  </h3>
                  <div>
                    <label className="block text-sm text-zinc-400 mb-2">
                      Chunks to retrieve: {settings.n_results}
                    </label>
                    <input
                      type="range"
                      min={3}
                      max={10}
                      value={settings.n_results}
                      onChange={(e) => onUpdate({ n_results: parseInt(e.target.value, 10) })}
                      className="w-full accent-violet-500"
                    />
                  </div>
                </section>
              </div>
            </Dialog.Panel>
          </Transition.Child>
        </div>
      </Dialog>
    </Transition>
  );
}
