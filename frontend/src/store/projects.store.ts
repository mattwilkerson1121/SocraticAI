import { create } from 'zustand';
import { Project, CreateProjectRequest } from '../types/index';
import { getApiClient, getApiErrorMessage } from '../services/api.client';

const PROJECT_STORAGE_KEY = 'socratic_current_project_id';

function persistProjectId(id: string | null) {
  if (id) {
    localStorage.setItem(PROJECT_STORAGE_KEY, id);
  } else {
    localStorage.removeItem(PROJECT_STORAGE_KEY);
  }
}

function readPersistedProjectId(): string | null {
  return localStorage.getItem(PROJECT_STORAGE_KEY);
}

interface ProjectsStore {
  projects: Project[];
  currentProject: Project | null;
  isLoading: boolean;
  error: string | null;

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
      const savedId = readPersistedProjectId();
      const restored =
        response.data.find((p) => p.id === savedId) ||
        get().currentProject ||
        response.data[0] ||
        null;

      if (restored) {
        persistProjectId(restored.id);
      }

      set({
        projects: response.data,
        currentProject: restored,
        isLoading: false,
      });
    } catch (error) {
      set({
        error: getApiErrorMessage(error, 'Failed to fetch projects'),
        isLoading: false,
      });
    }
  },

  createProject: async (data: CreateProjectRequest) => {
    set({ isLoading: true, error: null });
    try {
      const apiClient = getApiClient();
      const project = await apiClient.createProject(data);
      persistProjectId(project.id);

      set((state) => ({
        projects: [project, ...state.projects],
        currentProject: project,
        isLoading: false,
      }));

      return project;
    } catch (error) {
      set({
        error: getApiErrorMessage(error, 'Failed to create project'),
        isLoading: false,
      });
      throw error;
    }
  },

  getProject: async (id: string) => {
    set({ isLoading: true, error: null });
    try {
      const apiClient = getApiClient();
      const project = await apiClient.getProject(id);
      persistProjectId(project.id);
      set({ currentProject: project, isLoading: false });
      return project;
    } catch (error) {
      set({
        error: getApiErrorMessage(error, 'Failed to fetch project'),
        isLoading: false,
      });
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
      set({
        error: getApiErrorMessage(error, 'Failed to update project'),
        isLoading: false,
      });
      throw error;
    }
  },

  deleteProject: async (id: string) => {
    set({ isLoading: true, error: null });
    try {
      const apiClient = getApiClient();
      await apiClient.deleteProject(id);

      set((state) => {
        const projects = state.projects.filter((p) => p.id !== id);
        const currentProject =
          state.currentProject?.id === id ? projects[0] || null : state.currentProject;
        persistProjectId(currentProject?.id || null);
        return { projects, currentProject, isLoading: false };
      });
    } catch (error) {
      set({
        error: getApiErrorMessage(error, 'Failed to delete project'),
        isLoading: false,
      });
      throw error;
    }
  },

  setCurrentProject: (project: Project | null) => {
    persistProjectId(project?.id || null);
    set({ currentProject: project });
  },

  clearError: () => {
    set({ error: null });
  },
}));
