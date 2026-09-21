import { create } from 'zustand';
import { Project, CreateProjectRequest } from '../types/index';
import { getApiClient } from '../services/api.client';

interface ProjectsStore {
  projects: Project[];
  currentProject: Project | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  fetchProjects: () => Promise<void>;
  createProject: (data: CreateProjectRequest) => Promise<Project>;
  getProject: (id: string) => Promise<Project>;
  updateProject: (id: string, data: CreateProjectRequest) => Promise<Project>;
  deleteProject: (id: string) => Promise<void>;
  setCurrentProject: (project: Project | null) => void;
  clearError: () => void;
}

export const useProjectsStore = create<ProjectsStore>((set, get) => ({
  projects: [],
  currentProject: null,
  isLoading: false,
  error: null,

  fetchProjects: async () => {
    set({ isLoading: true, error: null });
    try {
      const apiClient = getApiClient();
      const response = await apiClient.listProjects(100, 0);
      set({ projects: response.data, isLoading: false });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch projects';
      set({ error: message, isLoading: false });
    }
  },

  createProject: async (data: CreateProjectRequest) => {
    set({ isLoading: true, error: null });
    try {
      const apiClient = getApiClient();
      const project = await apiClient.createProject(data);
      
      set((state) => ({
        projects: [...state.projects, project],
        isLoading: false,
      }));

      return project;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create project';
      set({ error: message, isLoading: false });
      throw error;
    }
  },

  getProject: async (id: string) => {
    set({ isLoading: true, error: null });
    try {
      const apiClient = getApiClient();
      const project = await apiClient.getProject(id);
      set({ currentProject: project, isLoading: false });
      return project;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch project';
      set({ error: message, isLoading: false });
      throw error;
    }
  },

  updateProject: async (id: string, data: CreateProjectRequest) => {
    set({ isLoading: true, error: null });
    try {
      const apiClient = getApiClient();
      const project = await apiClient.updateProject(id, data);

      set((state) => ({
        projects: state.projects.map((p) => (p.id === id ? project : p)),
        currentProject: state.currentProject?.id === id ? project : state.currentProject,
        isLoading: false,
      }));

      return project;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update project';
      set({ error: message, isLoading: false });
      throw error;
    }
  },

  deleteProject: async (id: string) => {
    set({ isLoading: true, error: null });
    try {
      const apiClient = getApiClient();
      await apiClient.deleteProject(id);

      set((state) => ({
        projects: state.projects.filter((p) => p.id !== id),
        currentProject: state.currentProject?.id === id ? null : state.currentProject,
        isLoading: false,
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to delete project';
      set({ error: message, isLoading: false });
      throw error;
    }
  },

  setCurrentProject: (project: Project | null) => {
    set({ currentProject: project });
  },

  clearError: () => {
    set({ error: null });
  },
}));
