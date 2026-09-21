import { create } from 'zustand';
import { Session, Message, SocraticModality } from '../types/index';
import { getApiClient, getApiErrorMessage } from '../services/api.client';

function titleFromContent(content: string): string {
  const trimmed = content.trim().replace(/\s+/g, ' ');
  if (trimmed.length <= 64) return trimmed;
  return `${trimmed.slice(0, 64).trim()}…`;
}

function isDefaultSessionTitle(title: string): boolean {
  return /^Session\b/i.test(title) || title === 'New chat' || title === 'New Chat';
}

interface ChatStore {
  sessions: Session[];
  currentSession: Session | null;
  messages: Message[];
  isLoadingSessions: boolean;
  isLoadingMessages: boolean;
  isGenerating: boolean;
  error: string | null;
  currentModality: SocraticModality;

  fetchSessions: (projectId: string) => Promise<void>;
  createSession: (projectId: string, title?: string) => Promise<Session>;
  getSession: (sessionId: string) => Promise<Session | null>;
  updateSession: (sessionId: string, title: string) => Promise<Session>;
  deleteSession: (sessionId: string) => Promise<void>;
  setCurrentSession: (session: Session | null) => void;

  fetchMessages: (sessionId: string) => Promise<void>;
  sendMessage: (content: string, documentId?: string) => Promise<void>;
  setCurrentModality: (modality: SocraticModality) => void;

  clearError: () => void;
  reset: () => void;
}

export const useChatStore = create<ChatStore>((set, get) => ({
  sessions: [],
  currentSession: null,
  messages: [],
  isLoadingSessions: false,
  isLoadingMessages: false,
  isGenerating: false,
  error: null,
  currentModality: 'socratic_auditor',

  fetchSessions: async (projectId: string) => {
    set({ isLoadingSessions: true, error: null });
    try {
      const apiClient = getApiClient();
      const response = await apiClient.listSessions(projectId, 100, 0);
      set({ sessions: response.data, isLoadingSessions: false });
    } catch (error) {
      set({
        error: getApiErrorMessage(error, 'Failed to fetch sessions'),
        isLoadingSessions: false,
      });
    }
  },

  createSession: async (projectId: string, title = 'New chat') => {
    set({ isLoadingSessions: true, error: null });
    try {
      const apiClient = getApiClient();
      const session = await apiClient.createSession({
        project_id: projectId,
        title,
      });

      set((state) => ({
        sessions: [session, ...state.sessions.filter((s) => s.id !== session.id)],
        currentSession: session,
        messages: [],
        isLoadingSessions: false,
      }));

      return session;
    } catch (error) {
      set({
        error: getApiErrorMessage(error, 'Failed to create session'),
        isLoadingSessions: false,
      });
      throw error;
    }
  },

  getSession: async (sessionId: string) => {
    set({ isLoadingSessions: true, error: null });
    try {
      const apiClient = getApiClient();
      const session = await apiClient.getSession(sessionId);
      set((state) => ({
        currentSession: session,
        sessions: state.sessions.some((s) => s.id === session.id)
          ? state.sessions.map((s) => (s.id === session.id ? session : s))
          : [session, ...state.sessions],
        isLoadingSessions: false,
      }));
      return session;
    } catch (error) {
      set({
        error: getApiErrorMessage(error, 'Failed to fetch session'),
        isLoadingSessions: false,
      });
      return null;
    }
  },

  updateSession: async (sessionId: string, title: string) => {
    try {
      const apiClient = getApiClient();
      const session = await apiClient.updateSession(sessionId, title);

      set((state) => ({
        sessions: state.sessions.map((s) => (s.id === sessionId ? session : s)),
        currentSession: state.currentSession?.id === sessionId ? session : state.currentSession,
      }));

      return session;
    } catch (error) {
      set({ error: getApiErrorMessage(error, 'Failed to update session') });
      throw error;
    }
  },

  deleteSession: async (sessionId: string) => {
    set({ isLoadingSessions: true, error: null });
    try {
      const apiClient = getApiClient();
      await apiClient.deleteSession(sessionId);

      set((state) => ({
        sessions: state.sessions.filter((s) => s.id !== sessionId),
        currentSession: state.currentSession?.id === sessionId ? null : state.currentSession,
        messages: state.currentSession?.id === sessionId ? [] : state.messages,
        isLoadingSessions: false,
      }));
    } catch (error) {
      set({
        error: getApiErrorMessage(error, 'Failed to delete session'),
        isLoadingSessions: false,
      });
      throw error;
    }
  },

  setCurrentSession: (session: Session | null) => {
    set({ currentSession: session, messages: session ? get().messages : [] });
  },

  fetchMessages: async (sessionId: string) => {
    set({ isLoadingMessages: true, error: null });
    try {
      const apiClient = getApiClient();
      const response = await apiClient.listSessionMessages(sessionId, 100, 0);
      set({ messages: response.data, isLoadingMessages: false });
    } catch (error) {
      set({
        error: getApiErrorMessage(error, 'Failed to fetch messages'),
        isLoadingMessages: false,
      });
    }
  },

  sendMessage: async (content: string, documentId?: string) => {
    const state = get();

    if (!state.currentSession) {
      set({ error: 'No session selected' });
      return;
    }

    const sessionId = state.currentSession.id;
    const shouldRename = isDefaultSessionTitle(state.currentSession.title);
    const priorCount = state.messages.length;

    const userMessage: Message = {
      id: `temp-${Date.now()}`,
      session_id: sessionId,
      document_id: documentId || null,
      role: 'user',
      content,
      modality_type: state.currentModality,
      created_at: new Date().toISOString(),
    };

    set((s) => ({
      messages: [...s.messages, userMessage],
      isGenerating: true,
      error: null,
    }));

    try {
      const apiClient = getApiClient();
      const response = await apiClient.createMessage({
        session_id: sessionId,
        content,
        modality_type: state.currentModality,
        document_id: documentId,
      });

      if (shouldRename && priorCount === 0) {
        try {
          await get().updateSession(sessionId, titleFromContent(content));
        } catch {
          // Title update is best-effort; chat reply still succeeds
        }
      }

      // Refresh sidebar ordering after activity
      const projectId = get().currentSession?.project_id;
      if (projectId) {
        void get().fetchSessions(projectId);
      }

      if (!response.ai_response) {
        set((s) => {
          const filtered = s.messages.filter((m) => !m.id.startsWith('temp-'));
          return {
            messages: [...filtered, response.message],
            isGenerating: false,
            error:
              'AI did not return a response. Check that OPENAI_API_KEY is configured on the server.',
          };
        });
        return;
      }

      set((s) => {
        const filtered = s.messages.filter((m) => !m.id.startsWith('temp-'));
        return {
          messages: [...filtered, response.message, response.ai_response!],
          isGenerating: false,
          currentModality: response.modality || s.currentModality,
        };
      });
    } catch (error) {
      set((s) => ({
        messages: s.messages.filter((m) => !m.id.startsWith('temp-')),
        isGenerating: false,
        error: getApiErrorMessage(error, 'Failed to send message'),
      }));
      throw error;
    }
  },

  setCurrentModality: (modality: SocraticModality) => {
    set({ currentModality: modality });
  },

  clearError: () => {
    set({ error: null });
  },

  reset: () => {
    set({
      sessions: [],
      currentSession: null,
      messages: [],
      isLoadingSessions: false,
      isLoadingMessages: false,
      isGenerating: false,
      error: null,
      currentModality: 'socratic_auditor',
    });
  },
}));
