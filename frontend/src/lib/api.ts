const API = '/api';

export interface Chat {
  id: string;
  name: string;
  document_count: number;
  created_at: string;
}

export interface Document {
  id: string;
  name: string;
  size: number;
}

export interface Source {
  file: string;
  page: number;
}

export interface Message {
  role: 'user' | 'assistant';
  content: string;
  sources?: Source[];
}

export interface Settings {
  theme: string;
  n_results: number;
  streaming: boolean;
  show_citations: boolean;
  sound_notifications?: boolean;
  llm_provider?: string;
  ollama_model?: string;
  openai_model?: string;
  openai_api_key?: string;
}

export interface SystemStatus {
  model_provider: 'ollama' | 'openai' | 'none';
  model_name: string;
  model_display_name: string;
  mode: 'local' | 'cloud' | 'none';
  embedding_model: string;
  documents: number;
  chunks: number;
  latency: string | null;
  status: 'ok' | 'indexing' | 'error';
}

export async function getSystemStatus(chatId?: string | null): Promise<SystemStatus> {
  const url = chatId ? `${API}/system/status?chat_id=${chatId}` : `${API}/system/status`;
  const res = await fetch(url);
  return res.json();
}

export async function getChats(): Promise<Chat[]> {
  const res = await fetch(`${API}/chats`);
  const data = await res.json();
  return data.chats || [];
}

export async function createChat(name = 'New Chat'): Promise<Chat> {
  const res = await fetch(`${API}/chats`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Failed to create chat (${res.status})`);
  }
  const data = await res.json();
  return { ...data, document_count: 0 };
}

export async function updateChat(id: string, name: string): Promise<void> {
  await fetch(`${API}/chats/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });
}

export async function deleteChat(id: string): Promise<void> {
  await fetch(`${API}/chats/${id}`, { method: 'DELETE' });
}

export async function getDocuments(chatId: string): Promise<Document[]> {
  const res = await fetch(`${API}/chats/${chatId}/documents`);
  const data = await res.json();
  return data.documents || [];
}

export async function removeDocument(chatId: string, docId: string): Promise<void> {
  const res = await fetch(`${API}/chats/${chatId}/documents/${docId}`, { method: 'DELETE' });
  if (!res.ok) throw new Error(await res.text());
}

export async function uploadDocuments(chatId: string, files: File[]): Promise<{ chunks_added: number; files: number }> {
  const form = new FormData();
  files.forEach((f) => form.append('files', f));  // FastAPI expects 'files' for list[UploadFile]
  const res = await fetch(`${API}/chats/${chatId}/documents`, {
    method: 'POST',
    body: form,
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

function parseApiError(text: string): string {
  try {
    const o = JSON.parse(text);
    if (o && typeof o.detail === 'string') return o.detail;
  } catch {
    /* ignore */
  }
  return text;
}

export async function query(chatId: string, message: string): Promise<{ answer: string; sources: Source[] }> {
  const res = await fetch(`${API}/chats/${chatId}/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message }),
  });
  if (!res.ok) throw new Error(parseApiError(await res.text()));
  return res.json();
}

export async function getSettings(): Promise<Settings> {
  const res = await fetch(`${API}/settings`);
  if (!res.ok) return getDefaultSettings();
  return res.json();
}

function getDefaultSettings(): Settings {
  return {
    theme: 'dark',
    n_results: 5,
    streaming: false,
    show_citations: true,
  };
}

export async function updateSettings(s: Partial<Settings>): Promise<Settings> {
  const res = await fetch(`${API}/settings`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(s),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
