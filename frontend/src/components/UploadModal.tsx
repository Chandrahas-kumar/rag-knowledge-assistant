import { Fragment, useState, useCallback, useEffect } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import {
  XMarkIcon,
  DocumentArrowUpIcon,
  DocumentTextIcon,
  TrashIcon,
  CheckCircleIcon,
} from '@heroicons/react/24/outline';
import type { Document } from '../lib/api';
import { removeDocument } from '../lib/api';

interface UploadModalProps {
  open: boolean;
  onClose: () => void;
  chatId: string | null;
  documents: Document[];
  chunksCount?: number;
  onUpload: (files: File[]) => Promise<{ chunks_added: number }>;
  onRefresh: () => void;
}

export function UploadModal({
  open,
  onClose,
  chatId,
  documents,
  chunksCount = 0,
  onUpload,
  onRefresh,
}: UploadModalProps) {
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastUploadResult, setLastUploadResult] = useState<{ files: number; chunks: number } | null>(null);

  // Reset state when modal opens
  useEffect(() => {
    if (open) {
      setError(null);
      setLastUploadResult(null);
    }
  }, [open]);

  const handleFiles = useCallback(
    async (files: FileList | File[]) => {
      const list = Array.from(files).filter((f) => f.name.toLowerCase().endsWith('.pdf'));
      if (list.length === 0) {
        setError('Please select PDF files');
        return;
      }
      setError(null);
      setLastUploadResult(null);
      setUploading(true);
      setUploadProgress(`Indexing ${list.length} file${list.length > 1 ? 's' : ''}...`);
      try {
        const result = await onUpload(list);
        onRefresh();
        setLastUploadResult({ files: list.length, chunks: result.chunks_added });
        setUploadProgress(null);
        setUploading(false);
        // Auto-close modal after successful upload
        setTimeout(() => onClose(), 600);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Upload failed');
        setUploadProgress(null);
        setUploading(false);
      }
    },
    [onUpload, onRefresh, onClose]
  );

  const handleRemoveDoc = useCallback(
    async (docId: string) => {
      if (!chatId) return;
      try {
        await removeDocument(chatId, docId);
        onRefresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to remove document');
      }
    },
    [chatId, onRefresh]
  );

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    handleFiles(e.dataTransfer.files);
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(true);
  };

  const onDragLeave = () => setDragActive(false);

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

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
        <div className="fixed inset-0 flex items-center justify-center p-4">
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-200"
            enterFrom="opacity-0 scale-95"
            enterTo="opacity-100 scale-100"
            leave="ease-in duration-150"
            leaveFrom="opacity-100 scale-100"
            leaveTo="opacity-0 scale-95"
          >
            <Dialog.Panel className="w-full max-w-lg bg-zinc-900 rounded-2xl border border-zinc-800 shadow-xl max-h-[90vh] flex flex-col">
              <div className="flex items-center justify-between p-4 border-b border-zinc-800">
                <Dialog.Title className="text-lg font-semibold text-zinc-100">
                  Manage Documents
                </Dialog.Title>
                <button onClick={onClose} className="p-2 rounded-lg hover:bg-zinc-800 text-zinc-400">
                  <XMarkIcon className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {/* Drop zone */}
                <div
                  onDrop={onDrop}
                  onDragOver={onDragOver}
                  onDragLeave={onDragLeave}
                  className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
                    dragActive ? 'border-violet-500 bg-violet-500/10' : 'border-zinc-700 hover:border-zinc-600'
                  }`}
                >
                  <DocumentArrowUpIcon className="w-12 h-12 mx-auto text-zinc-500 mb-3" />
                  <p className="text-zinc-400 mb-1">Drag and drop PDFs here</p>
                  <p className="text-sm text-zinc-600 mb-4">or</p>
                  <label className="inline-block px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 cursor-pointer text-sm">
                    Browse files
                    <input
                      type="file"
                      accept=".pdf"
                      multiple
                      className="hidden"
                      onChange={(e) => e.target.files && handleFiles(e.target.files)}
                      disabled={uploading || !chatId}
                    />
                  </label>
                </div>

                {error && (
                  <p className="text-sm text-red-400">{error}</p>
                )}

                {uploading && uploadProgress && (
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-violet-500/10 border border-violet-500/30">
                    <div className="flex gap-1">
                      <span className="w-2 h-2 rounded-full bg-violet-500 animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-2 h-2 rounded-full bg-violet-500 animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-2 h-2 rounded-full bg-violet-500 animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                    <p className="text-sm text-violet-400">{uploadProgress}</p>
                  </div>
                )}

                {lastUploadResult && !uploading && (
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
                    <CheckCircleIcon className="w-5 h-5 text-emerald-600 shrink-0" />
                    <p className="text-sm text-emerald-400">
                      Indexed {lastUploadResult.files} file{lastUploadResult.files > 1 ? 's' : ''} ({lastUploadResult.chunks} chunks)
                    </p>
                  </div>
                )}

                {/* Document list */}
                {documents.length > 0 && (
                  <div>
                    <h3 className="text-sm font-medium text-zinc-500 mb-2">Documents in this chat</h3>
                    <ul className="space-y-2">
                      {documents.map((d) => (
                        <li
                          key={d.id}
                          className="flex items-center gap-3 p-3 rounded-lg bg-zinc-800/50 border border-zinc-700/50 group"
                        >
                          <DocumentTextIcon className="w-5 h-5 text-zinc-500 shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-zinc-300 truncate">{d.name}</p>
                            <p className="text-xs text-zinc-600">{formatSize(d.size)}</p>
                          </div>
                          <button
                            onClick={() => handleRemoveDoc(d.id)}
                            className="p-2 rounded-lg hover:bg-red-500/20 text-zinc-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                            title="Remove document"
                          >
                            <TrashIcon className="w-4 h-4" />
                          </button>
                        </li>
                      ))}
                    </ul>
                    {chunksCount > 0 && (
                      <p className="text-xs text-zinc-500 mt-2">Total chunks: {chunksCount}</p>
                    )}
                  </div>
                )}
              </div>
            </Dialog.Panel>
          </Transition.Child>
        </div>
      </Dialog>
    </Transition>
  );
}
