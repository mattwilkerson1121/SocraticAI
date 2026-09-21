import { create } from 'zustand';
import { User, AuthState } from '../types/index';
import { getApiClient } from '../services/api.client';

/**
 * Auth Store - manages user authentication state
 */
interface AuthStore extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  fetchCurrentUser: () => Promise<void>;
  setUser: (user: User | null) => void;
  clearError: () => void;
}

export const useAuthStore = create<AuthStore>((set, get) => ({
  user: null,
  isAuthenticated: false,
  isLoading: false,
  accessToken: null,
  refreshToken: null,

  login: async (email: string, password: string) => {
    set({ isLoading: true });
    try {
      const apiClient = getApiClient();
      const response = await apiClient.login(email, password);

      set({
        user: {
          id: response.user.id,
          email: response.user.email,
          name: response.user.email.split('@')[0],
          tier: 'free', // Default tier
        },
        isAuthenticated: true,
        accessToken: response.session.access_token,
        refreshToken: response.session.refresh_token,
        isLoading: false,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Login failed';
      set({
        isLoading: false,
        user: null,
        isAuthenticated: false,
      });
      throw new Error(message);
    }
  },

  register: async (email: string, password: string) => {
    set({ isLoading: true });
    try {
      const apiClient = getApiClient();
      const response = await apiClient.register(email, password);

      set({
        user: {
          id: response.user.id,
          email: response.user.email,
          name: response.user.email.split('@')[0],
          tier: 'free',
        },
        isAuthenticated: true,
        accessToken: response.session.access_token,
        refreshToken: response.session.refresh_token,
        isLoading: false,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Registration failed';
      set({
        isLoading: false,
        user: null,
        isAuthenticated: false,
      });
      throw new Error(message);
    }
  },

  logout: async () => {
    try {
      const apiClient = getApiClient();
      await apiClient.logout();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      set({
        user: null,
        isAuthenticated: false,
        accessToken: null,
        refreshToken: null,
      });
    }
  },

  fetchCurrentUser: async () => {
    set({ isLoading: true });
    try {
      const apiClient = getApiClient();

      // Check if we have a token
      if (!apiClient.isAuthenticated()) {
        set({ isLoading: false, isAuthenticated: false });
        return;
      }

      const user = await apiClient.getCurrentUser();

      set({
        user,
        isAuthenticated: true,
        isLoading: false,
      });
    } catch (error) {
      console.error('Failed to fetch current user:', error);
      set({
        isLoading: false,
        isAuthenticated: false,
        user: null,
      });
    }
  },

  setUser: (user: User | null) => {
    set({
      user,
      isAuthenticated: !!user,
    });
  },

  clearError: () => {
    // Error handling done at component level for auth
  },
}));
