import { create } from 'zustand';
import { Session, Message, SocraticModality, CreateMessageRequest } from '../types/index';
import { getApiClient } from '../services/api.client';

interface ChatStore {
  sessions: Session[];
  currentSession: Session | null;
  messages: Message[];
  isLoadingSessions: boolean;
  isLoadingMessages: boolean;
  isGenerating: boolean;
  error: string | null;
  currentModality: SocraticModality;

  // Session actions
  fetchSessions: (projectId: string) => Promise<void>;
  createSession: (projectId: string, title: string) => Promise<Session>;
  getSession: (sessionId: string) => Promise<void>;
  updateSession: (sessionId: string, title: string) => Promise<Session>;
  deleteSession: (sessionId: string) => Promise<void>;
  setCurrentSession: (session: Session | null) => void;

  // Message actions
  fetchMessages: (sessionId: string) => Promise<void>;
  sendMessage: (content: string, documentId?: string) => Promise<void>;
  setCurrentModality: (modality: SocraticModality) => void;

  // UI actions
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

  // ==========================================
  // SESSION ACTIONS
  // ==========================================

  fetchSessions: async (projectId: string) => {
    set({ isLoadingSessions: true, error: null });
    try {
      const apiClient = getApiClient();
      const response = await apiClient.listSessions(projectId, 100, 0);
      set({ sessions: response.data, isLoadingSessions: false });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch sessions';
      set({ error: message, isLoadingSessions: false });
    }
  },

  createSession: async (projectId: string, title: string) => {
    set({ isLoadingSessions: true, error: null });
    try {
      const apiClient = getApiClient();
      const session = await apiClient.createSession({
        project_id: projectId,
        title,
      });

      set((state) => ({
        sessions: [...state.sessions, session],
        currentSession: session,
        messages: [],
        isLoadingSessions: false,
      }));

      return session;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create session';
      set({ error: message, isLoadingSessions: false });
      throw error;
    }
  },

  getSession: async (sessionId: string) => {
    set({ isLoadingSessions: true, error: null });
    try {
      const apiClient = getApiClient();
      const session = await apiClient.getSession(sessionId);
      set({ currentSession: session, isLoadingSessions: false });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch session';
      set({ error: message, isLoadingSessions: false });
    }
  },

  updateSession: async (sessionId: string, title: string) => {
    set({ isLoadingSessions: true, error: null });
    try {
      const apiClient = getApiClient();
      const session = await apiClient.updateSession(sessionId, title);

      set((state) => ({
        sessions: state.sessions.map((s) => (s.id === sessionId ? session : s)),
        currentSession: state.currentSession?.id === sessionId ? session : state.currentSession,
        isLoadingSessions: false,
      }));

      return session;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update session';
      set({ error: message, isLoadingSessions: false });
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
      const message = error instanceof Error ? error.message : 'Failed to delete session';
      set({ error: message, isLoadingSessions: false });
      throw error;
    }
  },

  setCurrentSession: (session: Session | null) => {
    set({ currentSession: session, messages: [] });
  },

  // ==========================================
  // MESSAGE ACTIONS
  // ==========================================

  fetchMessages: async (sessionId: string) => {
    set({ isLoadingMessages: true, error: null });
    try {
      const apiClient = getApiClient();
      const response = await apiClient.listSessionMessages(sessionId, 100, 0);
      set({ messages: response.data, isLoadingMessages: false });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch messages';
      set({ error: message, isLoadingMessages: false });
    }
  },

  sendMessage: async (content: string, documentId?: string) => {
    const state = get();
    
    if (!state.currentSession) {
      set({ error: 'No session selected' });
      return;
    }

    // Add user message optimistically
    const userMessage: Message = {
      id: `temp-${Date.now()}`,
      session_id: state.currentSession.id,
      document_id: documentId || null,
      role: 'user',
      content,
      modality_type: state.currentModality,
      created_at: new Date().toISOString(),
    };

    set((state) => ({
      messages: [...state.messages, userMessage],
      isGenerating: true,
      error: null,
    }));

    try {
      const apiClient = getApiClient();
      const response = await apiClient.createMessage({
        session_id: state.currentSession.id,
        content,
        modality_type: state.currentModality,
        document_id: documentId,
      });

      // Replace temp message and add AI response
      set((state) => {
        const filtered = state.messages.filter((m) => !m.id.startsWith('temp-'));
        const messages = [response.message];

        if (response.ai_response) {
          messages.push(response.ai_response);
        }

        return {
          messages: [...filtered, response.message, ...(response.ai_response ? [response.ai_response] : [])],
          isGenerating: false,
          currentModality: response.modality || state.currentModality,
        };
      });
    } catch (error) {
      // Remove optimistic message on error
      const message = error instanceof Error ? error.message : 'Failed to send message';
      set((state) => ({
        messages: state.messages.filter((m) => !m.id.startsWith('temp-')),
        isGenerating: false,
        error: message,
      }));
      throw error;
    }
  },

  setCurrentModality: (modality: SocraticModality) => {
    set({ currentModality: modality });
  },

  // ==========================================
  // UI ACTIONS
  // ==========================================

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
