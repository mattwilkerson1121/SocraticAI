import { create } from 'zustand';
import { Document } from '../types/index';
import { getApiClient } from '../services/api.client';

interface DocumentsStore {
  documents: Document[];
  selectedDocument: Document | null;
  isLoading: boolean;
  isUploading: boolean;
  error: string | null;

  // Actions
  fetchDocuments: (projectId: string) => Promise<void>;
  uploadDocument: (file: File, projectId: string) => Promise<Document>;
  getDocument: (documentId: string) => Promise<Document>;
  deleteDocument: (documentId: string) => Promise<void>;
  setSelectedDocument: (document: Document | null) => void;
  clearError: () => void;
  reset: () => void;
}

export const useDocumentsStore = create<DocumentsStore>((set) => ({
  documents: [],
  selectedDocument: null,
  isLoading: false,
  isUploading: false,
  error: null,

  fetchDocuments: async (projectId: string) => {
    set({ isLoading: true, error: null });
    try {
      const apiClient = getApiClient();
      const response = await apiClient.listDocuments(projectId, 100, 0);
      set({ documents: response.data, isLoading: false });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch documents';
      set({ error: message, isLoading: false });
    }
  },

  uploadDocument: async (file: File, projectId: string) => {
    set({ isUploading: true, error: null });
    try {
      const apiClient = getApiClient();
      const document = await apiClient.uploadDocument(file, projectId);

      set((state) => ({
        documents: [...state.documents, document],
        selectedDocument: document,
        isUploading: false,
      }));

      return document;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to upload document';
      set({ error: message, isUploading: false });
      throw error;
    }
  },

  getDocument: async (documentId: string) => {
    set({ isLoading: true, error: null });
    try {
      const apiClient = getApiClient();
      const document = await apiClient.getDocument(documentId);
      set({ selectedDocument: document, isLoading: false });
      return document;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch document';
      set({ error: message, isLoading: false });
      throw error;
    }
  },

  deleteDocument: async (documentId: string) => {
    set({ isLoading: true, error: null });
    try {
      const apiClient = getApiClient();
      await apiClient.deleteDocument(documentId);

      set((state) => ({
        documents: state.documents.filter((d) => d.id !== documentId),
        selectedDocument: state.selectedDocument?.id === documentId ? null : state.selectedDocument,
        isLoading: false,
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to delete document';
      set({ error: message, isLoading: false });
      throw error;
    }
  },

  setSelectedDocument: (document: Document | null) => {
    set({ selectedDocument: document });
  },

  clearError: () => {
    set({ error: null });
  },

  reset: () => {
    set({
      documents: [],
      selectedDocument: null,
      isLoading: false,
      isUploading: false,
      error: null,
    });
  },
}));
