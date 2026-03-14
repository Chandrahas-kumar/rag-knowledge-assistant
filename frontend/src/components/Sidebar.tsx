import { Fragment, useState } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import {
  PlusIcon,
  DocumentTextIcon,
  Cog6ToothIcon,
  SunIcon,
  MoonIcon,
  SwatchIcon,
  Bars3Icon,
  PencilIcon,
  TrashIcon,
} from '@heroicons/react/24/outline';
import type { Chat } from '../lib/api';

function ChatListItem({
  chat,
  isActive,
  onSelect,
  onRename,
  onDelete,
}: {
  chat: Chat;
  isActive: boolean;
  onSelect: () => void;
  onRename: (name: string) => void;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(chat.name);

  const handleSave = () => {
    const trimmed = editName.trim();
    if (trimmed && trimmed !== chat.name) {
      onRename(trimmed);
    } else {
      setEditName(chat.name);
    }
    setEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSave();
    if (e.key === 'Escape') {
      setEditName(chat.name);
      setEditing(false);
    }
  };

  return (
    <div
      className={`group flex items-center gap-2 px-3 py-2.5 rounded-lg transition-colors ${
        isActive ? 'bg-zinc-800 text-zinc-100' : 'hover:bg-zinc-800/50 text-zinc-400 hover:text-zinc-300'
      }`}
    >
      {editing ? (
        <input
          autoFocus
          value={editName}
          onChange={(e) => setEditName(e.target.value)}
          onBlur={handleSave}
          onKeyDown={handleKeyDown}
          className="flex-1 min-w-0 bg-zinc-700 border border-zinc-600 rounded px-2 py-1 text-sm text-zinc-100 focus:outline-none focus:ring-1 focus:ring-violet-500"
          onClick={(e) => e.stopPropagation()}
        />
      ) : (
        <>
          <button
            onClick={onSelect}
            className="flex-1 min-w-0 text-left truncate text-sm"
          >
            {chat.name}
          </button>
          <span className="text-xs text-zinc-500 shrink-0">{chat.document_count}</span>
          <div className="flex items-center gap-0.5 shrink-0">
            <button
              onClick={(e) => { e.stopPropagation(); setEditing(true); setEditName(chat.name); }}
              className="p-1.5 rounded hover:bg-zinc-700 text-zinc-500 hover:text-zinc-300"
              title="Rename"
            >
              <PencilIcon className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (window.confirm('Delete this chat? Documents will be removed.')) onDelete();
              }}
              className="p-1.5 rounded hover:bg-red-500/20 text-zinc-500 hover:text-red-400"
              title="Delete"
            >
              <TrashIcon className="w-3.5 h-3.5" />
            </button>
          </div>
        </>
      )}
    </div>
  );
}

interface SidebarProps {
  chats: Chat[];
  currentChatId: string | null;
  onNewChat: () => void;
  onSelectChat: (id: string) => void;
  onRenameChat: (id: string, name: string) => void;
  onDeleteChat: (id: string) => void;
  onManageDocs: () => void;
  onSettings: () => void;
  theme: 'light' | 'dark' | 'loki';
  onThemeToggle: () => void;
  mobileOpen: boolean;
  onMobileClose: () => void;
}

export function Sidebar({
  chats,
  currentChatId,
  onNewChat,
  onSelectChat,
  onRenameChat,
  onDeleteChat,
  onManageDocs,
  onSettings,
  theme,
  onThemeToggle,
  mobileOpen,
  onMobileClose,
}: SidebarProps) {
  const content = (
    <div className="flex h-full flex-col">
      {/* Logo */}
      <div className="p-4 border-b border-zinc-800">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-white font-bold text-lg">
            L
          </div>
          <div>
            <h1 className="font-semibold text-zinc-100">LOKI</h1>
            <p className="text-xs text-zinc-500">Local Omniscient Knowledge Interface</p>
          </div>
        </div>
        <p className="text-xs text-zinc-600 mt-2">Developed by Chandrahas Kumar</p>
      </div>

      {/* New Chat */}
      <div className="p-3">
        <button
          onClick={() => { onNewChat(); onMobileClose(); }}
          className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-medium transition-all"
        >
          <PlusIcon className="w-5 h-5" />
          New Chat
        </button>
      </div>

      {/* Chat List */}
      <div className="flex-1 overflow-y-auto px-2">
        <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider px-2 mb-2">Chats</p>
        {chats.length === 0 ? (
          <p className="text-sm text-zinc-600 px-2">No chats yet</p>
        ) : (
          <div className="space-y-1">
            {chats.map((c) => (
              <ChatListItem
                key={c.id}
                chat={c}
                isActive={currentChatId === c.id}
                onSelect={() => { onSelectChat(c.id); onMobileClose(); }}
                onRename={(name) => onRenameChat(c.id, name)}
                onDelete={() => onDeleteChat(c.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Document Library */}
      <div className="p-3 border-t border-zinc-800">
        <button
          onClick={() => { onManageDocs(); onMobileClose(); }}
          className="w-full flex items-center gap-2 py-2.5 px-3 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-zinc-300 text-sm"
        >
          <DocumentTextIcon className="w-4 h-4" />
          Document Library
        </button>
      </div>

      {/* Bottom */}
      <div className="p-3 border-t border-zinc-800 space-y-1">
        <button
          onClick={onThemeToggle}
          className="w-full flex items-center gap-2 py-2 px-3 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-zinc-300 text-sm"
          title={theme === 'dark' ? 'Light mode' : theme === 'loki' ? 'Dark mode' : 'LOKI theme'}
        >
          {theme === 'dark' ? <SunIcon className="w-5 h-5" /> : theme === 'loki' ? <MoonIcon className="w-5 h-5" /> : <SwatchIcon className="w-5 h-5" />}
          {theme === 'dark' ? 'Light mode' : theme === 'loki' ? 'Dark mode' : 'LOKI theme'}
        </button>
        <button
          onClick={() => { onSettings(); onMobileClose(); }}
          className="w-full flex items-center gap-2 py-2 px-3 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-zinc-300 text-sm"
        >
          <Cog6ToothIcon className="w-4 h-4" />
          Settings
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop */}
      <aside className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0 md:left-0 bg-zinc-900 border-r border-zinc-800">
        {content}
      </aside>

      {/* Mobile overlay */}
      <Transition show={mobileOpen} as={Fragment}>
        <Dialog onClose={onMobileClose} className="relative z-50 md:hidden">
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
          <div className="fixed inset-0 flex">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-200"
              enterFrom="-translate-x-full"
              enterTo="translate-x-0"
              leave="ease-in duration-150"
              leaveFrom="translate-x-0"
              leaveTo="-translate-x-full"
            >
              <Dialog.Panel className="w-72 bg-zinc-900 border-r border-zinc-800">
                {content}
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </Dialog>
      </Transition>
    </>
  );
}

export function SidebarToggle({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="md:hidden p-2 rounded-lg hover:bg-zinc-800 text-zinc-400"
    >
      <Bars3Icon className="w-6 h-6" />
    </button>
  );
}
