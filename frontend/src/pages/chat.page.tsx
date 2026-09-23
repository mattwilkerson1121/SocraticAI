import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useChatStore } from '../store/chat.store';
import { useDocumentsStore } from '../store/documents.store';
import { useProjectsStore } from '../store/projects.store';
import { useAuthStore } from '../store/auth.store';
import { ChatSidebar } from '../components/chat-sidebar';
import { ComposerAttachButton } from '../components/composer-attach-button';
import { FileMethodPicker } from '../components/file-method-picker';
import { SocraticModality } from '../types/index';
import { getApiErrorMessage } from '../services/api.client';
import { FILE_ANALYSIS_MODALITIES, FileTypeOption } from '../utils/file-types';

const MODALITY_OPTIONS: {
  value: SocraticModality;
  label: string;
  description: string;
}[] = [
  {
    value: 'bias_blueprint',
    label: 'Bias Blueprint',
    description: 'Find hidden assumptions and biases',
  },
  {
    value: 'devil_advocate',
    label: "Devil's Advocate",
    description: 'Generate counter-arguments',
  },
  {
    value: 'socratic_auditor',
    label: 'Socratic Auditor',
    description: 'Ask probing questions',
  },
  {
    value: 'source_scrutiny',
    label: 'Source Scrutiny',
    description: 'Evaluate evidence quality',
  },
];

/**
 * Chat workspace — Claude / ChatGPT-style sidebar + centered thread.
 */
export function ChatPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const { currentProject, getProject, setCurrentProject } = useProjectsStore();
  const {
    currentSession,
    sessions,
    messages,
    isGenerating,
    isLoadingSessions,
    isLoadingMessages,
    currentModality,
    error: chatError,
    fetchMessages,
    fetchSessions,
    getSession,
    sendMessage,
    setCurrentModality,
    createSession,
    deleteSession,
    clearError,
  } = useChatStore();
  const { documents, fetchDocuments, uploadDocument, isUploading } = useDocumentsStore();

  const [messageInput, setMessageInput] = useState('');
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | undefined>();
  const [pendingMethodFile, setPendingMethodFile] = useState<{ id: string; filename: string } | null>(
    null
  );
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [fileAccept, setFileAccept] = useState('.pdf,.docx,.xlsx,.pptx,.txt,.md');
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const hasAttachedFile = Boolean(selectedDocumentId);
  const availableModalities = useMemo(
    () =>
      hasAttachedFile
        ? MODALITY_OPTIONS.filter((option) =>
            (FILE_ANALYSIS_MODALITIES as readonly string[]).includes(option.value)
          )
        : MODALITY_OPTIONS,
    [hasAttachedFile]
  );

  const attachedDocument = documents.find((doc) => doc.id === selectedDocumentId);

  useEffect(() => {
    if (!sessionId) return;

    let cancelled = false;
    (async () => {
      const session = await getSession(sessionId);
      if (cancelled || !session) return;

      await fetchMessages(sessionId);

      try {
        const project = await getProject(session.project_id);
        if (!cancelled) {
          setCurrentProject(project);
        }
      } catch {
        // Project may be inaccessible; still load sessions by id
      }

      if (!cancelled) {
        await fetchSessions(session.project_id);
        fetchDocuments(session.project_id);
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isGenerating]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [messageInput]);

  // File uploads cannot use Devil's Advocate — keep header selector in sync
  useEffect(() => {
    if (hasAttachedFile && currentModality === 'devil_advocate') {
      setCurrentModality('socratic_auditor');
    }
  }, [hasAttachedFile, currentModality, setCurrentModality]);

  const handleSendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (isGenerating || !sessionId) return;

    const trimmed = messageInput.trim();
    if (!trimmed && !selectedDocumentId) return;

    const content =
      trimmed ||
      `Please analyze the attached document "${attachedDocument?.filename || 'file'}" using the selected Socratic method.`;

    setMessageInput('');
    const documentId = selectedDocumentId;
    setSelectedDocumentId(undefined);
    clearError();
    setActionError(null);

    try {
      await sendMessage(content, documentId);
    } catch (error) {
      setActionError(getApiErrorMessage(error, 'Failed to send message'));
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void handleSendMessage();
    }
  };

  const handlePickFileType = (option: FileTypeOption) => {
    setFileAccept(option.accept);
    // Defer so accept attribute updates before the OS dialog opens
    requestAnimationFrame(() => {
      fileInputRef.current?.click();
    });
  };

  const handleFileSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    const projectId = currentSession?.project_id || currentProject?.id;
    if (!projectId) {
      setActionError('Select a project before uploading a file.');
      return;
    }

    setActionError(null);
    try {
      const document = await uploadDocument(file, projectId);
      setSelectedDocumentId(document.id);
      setPendingMethodFile({ id: document.id, filename: document.filename });
      if (currentModality === 'devil_advocate') {
        setCurrentModality('socratic_auditor');
      }
    } catch (error) {
      setActionError(getApiErrorMessage(error, 'Failed to upload file'));
    }
  };

  const handleMethodChosen = (modality: SocraticModality) => {
    setCurrentModality(modality);
    setPendingMethodFile(null);
    textareaRef.current?.focus();
  };

  const handleMethodCancel = () => {
    setPendingMethodFile(null);
    setSelectedDocumentId(undefined);
  };

  const handleNewChat = async () => {
    const projectId = currentSession?.project_id || currentProject?.id;
    if (!projectId) {
      navigate('/dashboard');
      return;
    }
    setActionError(null);
    try {
      const session = await createSession(projectId, 'New chat');
      navigate(`/chat/${session.id}`);
      setSidebarOpen(false);
    } catch (error) {
      setActionError(getApiErrorMessage(error, 'Failed to create chat'));
    }
  };

  const handleDeleteSession = async (id: string) => {
    const projectId = currentSession?.project_id || currentProject?.id;
    try {
      await deleteSession(id);
      if (id === sessionId) {
        const next = useChatStore.getState().sessions[0];
        if (next) {
          navigate(`/chat/${next.id}`);
        } else if (projectId) {
          const session = await createSession(projectId, 'New chat');
          navigate(`/chat/${session.id}`);
        } else {
          navigate('/dashboard');
        }
      }
    } catch (error) {
      setActionError(getApiErrorMessage(error, 'Failed to delete chat'));
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const activeModality =
    availableModalities.find((m) => m.value === currentModality) || availableModalities[0];
  const displayError = actionError || chatError;
  const canSend = Boolean(messageInput.trim() || selectedDocumentId) && !isGenerating;

  return (
    <div className="flex h-screen bg-neutral-900 text-neutral-100">
      <ChatSidebar
        sessions={sessions}
        activeSessionId={sessionId}
        projectName={currentProject?.name}
        isLoading={isLoadingSessions}
        onNewChat={handleNewChat}
        onSelectSession={(id) => navigate(`/chat/${id}`)}
        onDeleteSession={handleDeleteSession}
        onOpenProjects={() => navigate('/dashboard')}
        userEmail={user?.email}
        onLogout={handleLogout}
        mobileOpen={sidebarOpen}
        onCloseMobile={() => setSidebarOpen(false)}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-3 border-b border-neutral-800 px-3 py-2.5 md:px-4">
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            className="rounded-lg p-2 text-neutral-400 hover:bg-neutral-800 hover:text-white md:hidden"
            aria-label="Open chats"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          <div className="min-w-0 flex-1">
            <h1 className="truncate text-sm font-semibold text-white md:text-base">
              {currentSession?.title || 'Chat'}
            </h1>
          </div>

          <label className="relative">
            <span className="sr-only">Mode</span>
            <select
              value={
                availableModalities.some((m) => m.value === currentModality)
                  ? currentModality
                  : availableModalities[0]?.value
              }
              onChange={(e) => setCurrentModality(e.target.value as SocraticModality)}
              title={activeModality?.description}
              className="appearance-none rounded-lg border border-neutral-700 bg-neutral-800 py-2 pl-3 pr-8 text-sm text-neutral-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              {availableModalities.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <svg
              className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </label>
        </header>

        <div className="flex-1 overflow-y-auto">
          {isLoadingMessages && messages.length === 0 ? (
            <div className="flex h-full items-center justify-center text-neutral-500">Loading…</div>
          ) : messages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center px-6 text-center">
              <h2 className="mb-2 text-2xl font-semibold text-white">How can I challenge your thinking?</h2>
              <p className="max-w-md text-sm text-neutral-400">
                Type a claim, or use + to upload a document for Bias Blueprint, Socratic Auditor, or
                Source Scrutiny analysis.
              </p>
              <div className="mt-8 grid w-full max-w-2xl gap-2 sm:grid-cols-2">
                {MODALITY_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setCurrentModality(option.value)}
                    className={`rounded-xl border px-4 py-3 text-left transition ${
                      currentModality === option.value
                        ? 'border-primary-500 bg-primary-500/10'
                        : 'border-neutral-700 bg-neutral-800/60 hover:border-neutral-500'
                    }`}
                  >
                    <div className="text-sm font-medium text-white">{option.label}</div>
                    <div className="mt-1 text-xs text-neutral-400">{option.description}</div>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="mx-auto w-full max-w-3xl px-4 py-6 md:px-6">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`mb-6 flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[92%] rounded-3xl px-4 py-3 text-[15px] leading-relaxed md:max-w-[85%] ${
                      message.role === 'user'
                        ? 'bg-neutral-700 text-white'
                        : 'bg-transparent text-neutral-100'
                    }`}
                  >
                    {message.role === 'assistant' && (
                      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-primary-400">
                        SocraticAI
                        {message.modality_type ? ` · ${message.modality_type.replace(/_/g, ' ')}` : ''}
                      </div>
                    )}
                    <div className="whitespace-pre-wrap">{message.content}</div>
                  </div>
                </div>
              ))}

              {isGenerating && (
                <div className="mb-6 flex justify-start">
                  <div className="flex items-center gap-2 text-sm text-neutral-400">
                    <span className="inline-flex gap-1">
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-neutral-400" />
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-neutral-400 [animation-delay:150ms]" />
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-neutral-400 [animation-delay:300ms]" />
                    </span>
                    Thinking…
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>
          )}
        </div>

        {displayError && (
          <div className="border-t border-error/30 bg-error/10 px-4 py-2 text-sm text-error">
            {displayError}
          </div>
        )}

        <div className="border-t border-neutral-800 bg-neutral-900 px-3 py-3 md:px-6 md:py-4">
          <form onSubmit={handleSendMessage} className="mx-auto w-full max-w-3xl">
            {attachedDocument && (
              <div className="mb-2 flex items-center gap-2">
                <div className="inline-flex max-w-full items-center gap-2 rounded-full border border-neutral-700 bg-neutral-800 px-3 py-1.5 text-xs text-neutral-200">
                  <svg className="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"
                    />
                  </svg>
                  <span className="truncate">{attachedDocument.filename}</span>
                  <button
                    type="button"
                    aria-label="Remove file"
                    onClick={() => setSelectedDocumentId(undefined)}
                    className="rounded-full p-0.5 text-neutral-400 hover:bg-neutral-700 hover:text-white"
                  >
                    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                {hasAttachedFile && (
                  <span className="text-[11px] text-neutral-500">
                    Devil&apos;s Advocate unavailable for file analysis
                  </span>
                )}
              </div>
            )}

            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept={fileAccept}
              onChange={handleFileSelected}
            />

            <div className="flex items-end gap-2 rounded-3xl border border-neutral-700 bg-neutral-800 px-3 py-2 shadow-lg focus-within:border-neutral-500">
              <ComposerAttachButton
                disabled={isGenerating}
                isUploading={isUploading}
                onPickType={handlePickFileType}
              />
              <textarea
                ref={textareaRef}
                value={messageInput}
                onChange={(e) => setMessageInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={hasAttachedFile ? 'Ask anything about this file…' : 'Ask anything'}
                disabled={isGenerating}
                rows={1}
                className="max-h-[200px] min-h-[44px] flex-1 resize-none bg-transparent py-2.5 text-[15px] text-white placeholder-neutral-500 outline-none disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={!canSend}
                className="mb-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-neutral-900 transition hover:bg-neutral-200 disabled:cursor-not-allowed disabled:bg-neutral-600 disabled:text-neutral-400"
                aria-label="Send message"
              >
                {isGenerating ? (
                  <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                ) : (
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                  </svg>
                )}
              </button>
            </div>
            <p className="mt-2 text-center text-[11px] text-neutral-500">
              Enter to send · Shift+Enter for a new line · Mode: {activeModality?.label}
            </p>
          </form>
        </div>
      </div>

      {pendingMethodFile && (
        <FileMethodPicker
          filename={pendingMethodFile.filename}
          onSelect={handleMethodChosen}
          onCancel={handleMethodCancel}
        />
      )}
    </div>
  );
}
