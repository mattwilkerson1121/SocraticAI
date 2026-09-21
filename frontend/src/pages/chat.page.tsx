import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useChatStore } from '../store/chat.store';
import { useDocumentsStore } from '../store/documents.store';
import { SocraticModality } from '../types/index';

/**
 * Chat Page Component
 * Main interface for Socratic conversations
 */
export function ChatPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();

  const {
    currentSession,
    messages,
    isGenerating,
    currentModality,
    error: chatError,
    fetchMessages,
    getSession,
    sendMessage,
    setCurrentModality,
  } = useChatStore();

  const { documents, fetchDocuments } = useDocumentsStore();

  const [messageInput, setMessageInput] = useState('');
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | undefined>();
  const [showDocuments, setShowDocuments] = useState(false);

  useEffect(() => {
    if (sessionId) {
      getSession(sessionId);
      fetchMessages(sessionId);
      if (currentSession?.project_id) {
        fetchDocuments(currentSession.project_id);
      }
    }
  }, [sessionId, getSession, fetchMessages, fetchDocuments, currentSession?.project_id]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!messageInput.trim() || !sessionId) {
      return;
    }

    try {
      await sendMessage(messageInput, selectedDocumentId);
      setMessageInput('');
      setSelectedDocumentId(undefined);
    } catch (error) {
      console.error('Failed to send message:', error);
    }
  };

  const modalityOptions: { value: SocraticModality; label: string; icon: string; description: string }[] = [
    {
      value: 'bias_blueprint',
      label: 'Bias Blueprint',
      icon: '🔍',
      description: 'Find hidden assumptions and biases',
    },
    {
      value: 'devil_advocate',
      label: "Devil's Advocate",
      icon: '⚡',
      description: 'Generate counter-arguments',
    },
    {
      value: 'socratic_auditor',
      label: 'Socratic Auditor',
      icon: '❓',
      description: 'Ask probing questions',
    },
    {
      value: 'source_scrutiny',
      label: 'Source Scrutiny',
      icon: '📊',
      description: 'Evaluate evidence quality',
    },
  ];

  return (
    <div className="h-screen bg-neutral-900 flex flex-col">
      {/* Header */}
      <header className="bg-neutral-800 border-b border-neutral-700 px-2xl py-lg flex items-center justify-between">
        <div className="flex items-center gap-lg">
          <button
            onClick={() => navigate('/dashboard')}
            className="text-neutral-400 hover:text-white transition"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <h1 className="text-white font-semibold">{currentSession?.title}</h1>
            <p className="text-neutral-400 text-sm">
              {currentSession && new Date(currentSession.created_at).toLocaleDateString()}
            </p>
          </div>
        </div>

        {/* Modality Selector */}
        <div className="flex gap-sm">
          {modalityOptions.map((option) => (
            <button
              key={option.value}
              onClick={() => setCurrentModality(option.value)}
              title={option.description}
              className={`px-md py-sm rounded-lg transition text-sm font-medium ${
                currentModality === option.value
                  ? 'bg-primary-500 text-white'
                  : 'bg-neutral-700 text-neutral-300 hover:bg-neutral-600'
              }`}
            >
              {option.icon} {option.label}
            </button>
          ))}
        </div>
      </header>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto px-2xl py-lg space-y-lg">
        {messages.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            <div className="text-center">
              <div className="text-4xl mb-lg">💭</div>
              <p className="text-neutral-400">
                Start your Socratic conversation by entering a belief, strategy, or question.
              </p>
            </div>
          </div>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-xl px-lg py-md rounded-lg ${
                  message.role === 'user'
                    ? 'bg-primary-500 text-white'
                    : 'bg-neutral-800 text-neutral-100 border border-neutral-700'
                }`}
              >
                <p className="text-sm mb-sm font-semibold opacity-75">
                  {message.role === 'user' ? 'You' : 'SocraticAI'}
                </p>
                <p className="whitespace-pre-wrap">{message.content}</p>
                <p className="text-xs opacity-50 mt-md">
                  {new Date(message.created_at).toLocaleTimeString()}
                </p>
              </div>
            </div>
          ))
        )}

        {/* Generating indicator */}
        {isGenerating && (
          <div className="flex justify-start">
            <div className="bg-neutral-800 text-neutral-100 border border-neutral-700 px-lg py-md rounded-lg">
              <div className="flex gap-md items-center">
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                <span className="text-sm">SocraticAI is thinking...</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Error Alert */}
      {chatError && (
        <div className="bg-error/10 border-t border-error/30 text-error px-2xl py-md text-sm">
          {chatError}
        </div>
      )}

      {/* Input Area */}
      <form onSubmit={handleSendMessage} className="bg-neutral-800 border-t border-neutral-700 p-lg">
        {/* Document selector */}
        {documents.length > 0 && (
          <div className="mb-md">
            <button
              type="button"
              onClick={() => setShowDocuments(!showDocuments)}
              className="text-sm text-primary-400 hover:text-primary-300 flex items-center gap-sm"
            >
              📎 Attach document {selectedDocumentId && '✓'}
            </button>

            {showDocuments && (
              <div className="mt-md bg-neutral-700 rounded-lg p-md max-h-40 overflow-y-auto space-y-sm">
                {documents.map((doc) => (
                  <button
                    key={doc.id}
                    type="button"
                    onClick={() => {
                      setSelectedDocumentId(doc.id);
                      setShowDocuments(false);
                    }}
                    className={`block w-full text-left px-md py-sm rounded transition ${
                      selectedDocumentId === doc.id
                        ? 'bg-primary-500 text-white'
                        : 'bg-neutral-600 text-neutral-100 hover:bg-neutral-500'
                    }`}
                  >
                    📄 {doc.filename}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Message input */}
        <div className="flex gap-md">
          <input
            type="text"
            value={messageInput}
            onChange={(e) => setMessageInput(e.target.value)}
            placeholder="Enter your thought, strategy, or question..."
            disabled={isGenerating}
            className="flex-1 px-lg py-md bg-neutral-700 border border-neutral-600 rounded-lg text-white placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={isGenerating || !messageInput.trim()}
            className="px-2xl py-md bg-primary-500 hover:bg-primary-600 disabled:bg-neutral-600 text-white rounded-lg font-semibold transition flex items-center gap-md"
          >
            {isGenerating ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                </svg>
              </>
            ) : (
              <>Send ↑</>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
