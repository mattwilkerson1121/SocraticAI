import axios, { AxiosError, AxiosInstance } from 'axios';
import {
  AuthResponse,
  User,
  Project,
  Session,
  Message,
  Document,
  CreateProjectRequest,
  CreateSessionRequest,
  CreateMessageRequest,
  MessageResponse,
  PaginatedResponse,
} from '../types/index';

/**
 * API Client for SocraticAI Backend
 * Handles all HTTP requests with automatic token management
 */
export class ApiClient {
  private client: AxiosInstance;
  private accessToken: string | null = null;
  private refreshToken: string | null = null;

  constructor(baseURL: string = 'http://localhost:5000') {
    this.client = axios.create({
      baseURL,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Load tokens from localStorage
    this.loadTokens();

    // Add request interceptor to attach token
    this.client.interceptors.request.use((config) => {
      if (this.accessToken) {
        config.headers.Authorization = `Bearer ${this.accessToken}`;
      }
      return config;
    });

    // Add response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      async (error: AxiosError) => {
        // Handle 401 Unauthorized
        if (error.response?.status === 401 && this.refreshToken) {
          try {
            const refreshed = await this.refreshAccessToken();
            this.setTokens(
              refreshed.session.access_token,
              refreshed.session.refresh_token
            );
            return this.client.request(error.config!);
          } catch {
            this.clearTokens();
            window.location.href = '/login';
          }
        }
        return Promise.reject(error);
      }
    );
  }

  /**
   * Set tokens (called after login/register)
   */
  setTokens(accessToken: string, refreshToken: string): void {
    this.accessToken = accessToken;
    this.refreshToken = refreshToken;
    localStorage.setItem('access_token', accessToken);
    localStorage.setItem('refresh_token', refreshToken);
  }

  /**
   * Load tokens from localStorage
   */
  private loadTokens(): void {
    this.accessToken = localStorage.getItem('access_token');
    this.refreshToken = localStorage.getItem('refresh_token');
  }

  /**
   * Clear tokens
   */
  clearTokens(): void {
    this.accessToken = null;
    this.refreshToken = null;
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
  }

  /**
   * Refresh access token
   */
  private async refreshAccessToken(): Promise<AuthResponse> {
    // TODO: Implement refresh token endpoint in backend
    throw new Error('Token refresh not yet implemented');
  }

  /**
   * Get current access token
   */
  getAccessToken(): string | null {
    return this.accessToken;
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    return !!this.accessToken;
  }

  // ==========================================
  // AUTH ENDPOINTS
  // ==========================================

  async register(email: string, password: string): Promise<AuthResponse> {
    const response = await this.client.post<AuthResponse>('/api/auth/register', {
      email,
      password,
    });
    this.setTokens(response.data.session.access_token, response.data.session.refresh_token);
    return response.data;
  }

  async login(email: string, password: string): Promise<AuthResponse> {
    const response = await this.client.post<AuthResponse>('/api/auth/login', {
      email,
      password,
    });
    this.setTokens(response.data.session.access_token, response.data.session.refresh_token);
    return response.data;
  }

  async logout(): Promise<void> {
    try {
      await this.client.post('/api/auth/logout');
    } finally {
      this.clearTokens();
    }
  }

  async getCurrentUser(): Promise<User> {
    const response = await this.client.get<User>('/api/auth/me');
    return response.data;
  }

  // ==========================================
  // PROJECT ENDPOINTS
  // ==========================================

  async listProjects(limit = 50, offset = 0): Promise<PaginatedResponse<Project>> {
    const response = await this.client.get<PaginatedResponse<Project>>('/api/projects', {
      params: { limit, offset },
    });
    return response.data;
  }

  async createProject(data: CreateProjectRequest): Promise<Project> {
    const response = await this.client.post<Project>('/api/projects', data);
    return response.data;
  }

  async getProject(projectId: string): Promise<Project> {
    const response = await this.client.get<Project>(`/api/projects/${projectId}`);
    return response.data;
  }

  async updateProject(projectId: string, data: CreateProjectRequest): Promise<Project> {
    const response = await this.client.put<Project>(`/api/projects/${projectId}`, data);
    return response.data;
  }

  async deleteProject(projectId: string): Promise<void> {
    await this.client.delete(`/api/projects/${projectId}`);
  }

  // ==========================================
  // SESSION ENDPOINTS
  // ==========================================

  async listSessions(projectId?: string, limit = 50, offset = 0): Promise<PaginatedResponse<Session>> {
    const response = await this.client.get<PaginatedResponse<Session>>('/api/sessions', {
      params: { project_id: projectId, limit, offset },
    });
    return response.data;
  }

  async createSession(data: CreateSessionRequest): Promise<Session> {
    const response = await this.client.post<Session>('/api/sessions', {
      ...data,
      project_id: data.project_id, // Normalize key
    });
    return response.data;
  }

  async getSession(sessionId: string): Promise<Session> {
    const response = await this.client.get<Session>(`/api/sessions/${sessionId}`);
    return response.data;
  }

  async updateSession(sessionId: string, title: string): Promise<Session> {
    const response = await this.client.put<Session>(`/api/sessions/${sessionId}`, { title });
    return response.data;
  }

  async deleteSession(sessionId: string): Promise<void> {
    await this.client.delete(`/api/sessions/${sessionId}`);
  }

  // ==========================================
  // MESSAGE ENDPOINTS
  // ==========================================

  async listSessionMessages(
    sessionId: string,
    limit = 100,
    offset = 0
  ): Promise<PaginatedResponse<Message>> {
    const response = await this.client.get<PaginatedResponse<Message>>(
      `/api/messages/session/${sessionId}`,
      {
        params: { limit, offset },
      }
    );
    return response.data;
  }

  async createMessage(data: CreateMessageRequest): Promise<MessageResponse> {
    const response = await this.client.post<MessageResponse>('/api/messages', {
      ...data,
      session_id: data.session_id, // Normalize
    });
    return response.data;
  }

  async streamMessage(data: CreateMessageRequest): Promise<ReadableStream<string>> {
    const params = new URLSearchParams({
      session_id: data.session_id,
      content: data.content,
      modality_type: data.modality_type || 'socratic_auditor',
    });

    return new ReadableStream<string>({
      start(controller) {
        const eventSource = new EventSource(
          `/api/messages/${Date.now()}/stream?${params}`
        );

        eventSource.onmessage = (event) => {
          try {
            const parsed = JSON.parse(event.data);
            if (parsed.done) {
              eventSource.close();
              controller.close();
              return;
            }
            if (parsed.content) {
              controller.enqueue(parsed.content);
            }
          } catch (e) {
            console.error('Failed to parse stream event', e);
          }
        };

        eventSource.onerror = (error) => {
          eventSource.close();
          controller.error(error);
        };
      },
    });
  }

  // ==========================================
  // DOCUMENT ENDPOINTS
  // ==========================================

  async uploadDocument(file: File, projectId: string): Promise<Document> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('project_id', projectId);

    const response = await this.client.post<any>('/api/documents/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });

    return response.data.document;
  }

  async listDocuments(projectId?: string, limit = 50, offset = 0): Promise<PaginatedResponse<Document>> {
    const response = await this.client.get<PaginatedResponse<Document>>('/api/documents', {
      params: { project_id: projectId, limit, offset },
    });
    return response.data;
  }

  async getDocument(documentId: string): Promise<Document> {
    const response = await this.client.get<Document>(`/api/documents/${documentId}`);
    return response.data;
  }

  async deleteDocument(documentId: string): Promise<void> {
    await this.client.delete(`/api/documents/${documentId}`);
  }

  // ==========================================
  // HEALTH CHECK
  // ==========================================

  async healthCheck(): Promise<boolean> {
    try {
      await this.client.get('/health');
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * Create and export singleton API client instance
 */
let apiClientInstance: ApiClient | null = null;

export function getApiClient(): ApiClient {
  if (!apiClientInstance) {
    const baseURL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
    apiClientInstance = new ApiClient(baseURL);
  }
  return apiClientInstance;
}

export default getApiClient;
