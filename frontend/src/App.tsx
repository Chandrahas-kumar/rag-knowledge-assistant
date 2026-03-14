import { useState, useEffect, useCallback } from 'react';
import { Sidebar, SidebarToggle } from './components/Sidebar';
import { ChatWindow } from './components/ChatWindow';
import { StatusBar } from './components/StatusBar';
import { UploadModal } from './components/UploadModal';
import { SettingsPanel } from './components/SettingsPanel';
import {
  getChats,
  createChat,
  updateChat,
  deleteChat,
  getDocuments,
  uploadDocuments,
  query,
  getSettings,
  updateSettings,
  getSystemStatus,
  type Chat,
  type Message,
  type Document,
  type Settings,
  type SystemStatus,
} from './lib/api';

function App() {
  const [chats, setChats] = useState<Chat[]>([]);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settings, setSettings] = useState<Settings>({
    theme: 'dark',
    n_results: 5,
    streaming: false,
    show_citations: true,
  });
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);

  const loadChats = useCallback(async () => {
    try {
      const list = await getChats();
      setChats(list);
      if (list.length > 0 && !currentChatId) {
        setCurrentChatId(list[0].id);
      }
    } catch (e) {
      console.error('Failed to load chats', e);
    }
  }, [currentChatId]);

  const loadDocuments = useCallback(async () => {
    if (!currentChatId) return;
    try {
      const docs = await getDocuments(currentChatId);
      setDocuments(docs);
    } catch (e) {
      console.error('Failed to load documents', e);
    }
  }, [currentChatId]);

  useEffect(() => {
    loadChats();
  }, [loadChats]);

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  useEffect(() => {
    getSettings().then(setSettings);
  }, []);

  const refreshStatus = useCallback(() => {
    getSystemStatus(currentChatId).then(setSystemStatus).catch(() => setSystemStatus(null));
  }, [currentChatId]);

  useEffect(() => {
    refreshStatus();
    const id = setInterval(refreshStatus, 5000);
    return () => clearInterval(id);
  }, [refreshStatus]);

  useEffect(() => {
    document.documentElement.classList.remove('dark', 'light', 'loki');
    document.documentElement.classList.add(settings.theme === 'loki' ? 'loki' : settings.theme);
  }, [settings.theme]);

  const handleNewChat = async () => {
    try {
      const chat = await createChat();
      setChats((prev) => [{ ...chat, document_count: 0 }, ...prev]);
      setCurrentChatId(chat.id);
      setMessages([]);
      setDocuments([]);
    } catch (e) {
      console.error('Failed to create chat', e);
    }
  };

  const handleSelectChat = (id: string) => {
    setCurrentChatId(id);
    setMessages([]);
    setDocuments([]);
  };

  const handleRenameChat = async (id: string, name: string) => {
    try {
      await updateChat(id, name);
      setChats((prev) =>
        prev.map((c) => (c.id === id ? { ...c, name } : c))
      );
    } catch (e) {
      console.error('Failed to rename chat', e);
    }
  };

  const handleDeleteChat = async (id: string) => {
    try {
      await deleteChat(id);
      setChats((prev) => prev.filter((c) => c.id !== id));
      if (currentChatId === id) {
        const remaining = chats.filter((c) => c.id !== id);
        setCurrentChatId(remaining[0]?.id ?? null);
        setMessages([]);
        setDocuments([]);
      }
    } catch (e) {
      console.error('Failed to delete chat', e);
    }
  };

  const handleSend = async (text: string) => {
    if (!currentChatId) return;
    setMessages((prev) => [...prev, { role: 'user', content: text }]);
    setIsLoading(true);
    try {
      const { answer, sources } = await query(currentChatId, text);
      setMessages((prev) => [...prev, { role: 'assistant', content: answer, sources }]);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Something went wrong';
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: `Error: ${msg}` },
      ]);
    } finally {
      setIsLoading(false);
      refreshStatus();
    }
  };

  const handleUpload = async (files: File[]) => {
    if (!currentChatId) return { chunks_added: 0 };
    return uploadDocuments(currentChatId, files);
  };

  const handleSettingsUpdate = async (s: Partial<Settings>) => {
    const updated = await updateSettings(s);
    setSettings(updated);
  };

  const currentChat = chats.find((c) => c.id === currentChatId);

  return (
    <div className="flex h-screen bg-zinc-950">
      <Sidebar
        chats={chats}
        currentChatId={currentChatId}
        onNewChat={handleNewChat}
        onSelectChat={handleSelectChat}
        onRenameChat={handleRenameChat}
        onDeleteChat={handleDeleteChat}
        onManageDocs={() => setUploadModalOpen(true)}
        onSettings={() => setSettingsOpen(true)}
        theme={settings.theme === 'dark' ? 'dark' : 'light'}
        onThemeToggle={() => handleSettingsUpdate({ theme: settings.theme === 'dark' ? 'light' : 'dark' })}
        mobileOpen={sidebarOpen}
        onMobileClose={() => setSidebarOpen(false)}
      />

      <div className="flex-1 flex flex-col md:pl-64 min-w-0">
        <div className="flex items-center justify-between gap-2 p-2 md:px-4 border-b border-zinc-800 shrink-0">
          <div className="flex items-center gap-2">
            <SidebarToggle onClick={() => setSidebarOpen(true)} />
            <div>
              <span className="font-semibold text-zinc-100">LOKI</span>
              <span className="hidden sm:inline text-zinc-500 text-sm font-normal ml-2">
                — Local Omniscient Knowledge Interface
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex-1 min-w-0 flex justify-end overflow-x-auto">
              <StatusBar status={systemStatus} />
            </div>
            <button
              onClick={() => setSettingsOpen(true)}
              className="p-2 rounded-lg hover:bg-zinc-800 text-zinc-400 shrink-0"
              title="Settings"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
          </div>
        </div>

        <ChatWindow
          chatId={currentChatId}
          chatName={currentChat?.name ?? 'New Chat'}
          documentCount={currentChat?.document_count ?? documents.length}
          documents={documents}
          chunksCount={systemStatus?.chunks ?? 0}
          messages={messages}
          isLoading={isLoading}
          onSend={handleSend}
          onAddDocuments={() => setUploadModalOpen(true)}
          showCitations={settings.show_citations}
          systemStatus={systemStatus}
        />
      </div>

      <UploadModal
        open={uploadModalOpen}
        onClose={() => setUploadModalOpen(false)}
        chatId={currentChatId}
        documents={documents}
        chunksCount={systemStatus?.chunks ?? 0}
        onUpload={handleUpload}
        onRefresh={() => {
          loadChats();
          loadDocuments();
          refreshStatus();
        }}
      />

      <SettingsPanel
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        settings={settings}
        systemStatus={systemStatus}
        onUpdate={handleSettingsUpdate}
      />
    </div>
  );
}

export default App;
