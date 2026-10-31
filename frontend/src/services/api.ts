/**
 * PharmacyGuard — Typed API Client
 * Built against verified FastAPI routes with Bearer token injection,
 * typed error handling, and automatic session cleanup on HTTP 401.
 */
import {
  LoginRequest,
  TokenResponse,
  UserProfileResponse,
  LogoutResponse,
  ApiErrorResponse,
  PrescriptionQueueItemResponse,
  PrescriptionDetailResponse,
  ReviewActionRequest,
  ReviewActionResponse,
  EscalationResolutionRequest,
  EscalationResolutionResponse,
  EscalationQueueItemResponse,
  InventorySummaryResponse,
  InventoryItemResponse,
  InventoryItemDetailResponse,
  InventoryTransactionRequest,
  InventoryTransactionResponse,
  ChiefOversightDashboardResponse,
  EducationalCaseListItem,
  EducationalCaseDetailResponse,
  StudentSubmissionRequest,
  StudentSubmissionResponse,
  StudentSubmissionListItem,
  HealthCheckResponse,
} from '../types/api';

const TOKEN_STORAGE_KEY = 'pharmacyguard_access_token';
const API_BASE_URL = '/api/v1';

export class ApiError extends Error {
  public status: number;
  public detail: string | unknown;

  constructor(status: number, message: string, detail?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.detail = detail || message;
  }
}

type UnauthorizedHandler = () => void;

class ApiClient {
  private token: string | null = null;
  private unauthorizedHandlers: Set<UnauthorizedHandler> = new Set();

  constructor() {
    // Restore token from localStorage on initialization
    if (typeof window !== 'undefined') {
      try {
        this.token = localStorage.getItem(TOKEN_STORAGE_KEY);
      } catch {
        this.token = null;
      }
    }
  }

  /**
   * Register a callback to be called when any request receives a 401 Unauthorized.
   */
  public onUnauthorized(handler: UnauthorizedHandler): () => void {
    this.unauthorizedHandlers.add(handler);
    return () => this.unauthorizedHandlers.delete(handler);
  }

  /**
   * Set or clear the current authentication token.
   */
  public setToken(token: string | null): void {
    this.token = token;
    if (typeof window !== 'undefined') {
      try {
        if (token) {
          localStorage.setItem(TOKEN_STORAGE_KEY, token);
        } else {
          localStorage.removeItem(TOKEN_STORAGE_KEY);
        }
      } catch {
        // Handle private browsing or restricted quota
      }
    }
  }

  /**
   * Get the current active token.
   */
  public getToken(): string | null {
    if (!this.token && typeof window !== 'undefined') {
      try {
        this.token = localStorage.getItem(TOKEN_STORAGE_KEY);
      } catch {
        this.token = null;
      }
    }
    return this.token;
  }

  /**
   * Low-level fetch wrapper with typed error extraction and bearer token injection.
   */
  public async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = endpoint.startsWith('http') ? endpoint : `${API_BASE_URL}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;
    const headers = new Headers(options.headers || {});

    // Inject Bearer token if present
    const currentToken = this.getToken();
    if (currentToken && !headers.has('Authorization')) {
      headers.set('Authorization', `Bearer ${currentToken}`);
    }

    if (!headers.has('Content-Type') && options.body && typeof options.body === 'string') {
      headers.set('Content-Type', 'application/json');
    }

    let response: Response;
    try {
      response = await fetch(url, {
        ...options,
        headers,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Network connection error';
      throw new ApiError(0, `Network failure: ${message}`);
    }

    // Handle 401 Unauthorized
    if (response.status === 401) {
      this.setToken(null);
      this.unauthorizedHandlers.forEach((handler) => {
        try {
          handler();
        } catch {
          // ignore handler failures
        }
      });
    }

    if (!response.ok) {
      let errorMessage = `HTTP Error ${response.status}: ${response.statusText}`;
      let errorDetail: unknown = null;

      try {
        const errorData: ApiErrorResponse = await response.json();
        if (errorData && errorData.detail) {
          if (typeof errorData.detail === 'string') {
            errorMessage = errorData.detail;
          } else if (Array.isArray(errorData.detail)) {
            errorMessage = errorData.detail.map((d) => d.msg || JSON.stringify(d)).join('; ');
          }
          errorDetail = errorData.detail;
        }
      } catch {
        // Non-JSON error body fallback
        try {
          const text = await response.text();
          if (text) errorMessage = text;
        } catch {
          // Ignore
        }
      }

      throw new ApiError(response.status, errorMessage, errorDetail);
    }

    // Return JSON or empty object for 204 No Content
    if (response.status === 204) {
      return {} as T;
    }

    return (await response.json()) as T;
  }

  // -------------------------------------------------------------------------
  // Auth Endpoints
  // -------------------------------------------------------------------------
  public auth = {
    login: async (credentials: LoginRequest): Promise<TokenResponse> => {
      const data = await this.request<TokenResponse>('/auth/login', {
        method: 'POST',
        body: JSON.stringify(credentials),
      });
      if (data && data.access_token) {
        this.setToken(data.access_token);
      }
      return data;
    },

    me: async (): Promise<UserProfileResponse> => {
      return this.request<UserProfileResponse>('/auth/me');
    },

    logout: async (): Promise<LogoutResponse> => {
      try {
        const res = await this.request<LogoutResponse>('/auth/logout', {
          method: 'POST',
        });
        return res;
      } finally {
        this.setToken(null);
      }
    },
  };

  // -------------------------------------------------------------------------
  // Health Endpoint
  // -------------------------------------------------------------------------
  public health = {
    check: async (): Promise<HealthCheckResponse> => {
      return this.request<HealthCheckResponse>('/health');
    },
  };

  // -------------------------------------------------------------------------
  // Prescriptions & Clinical Review Endpoints (Stage 2)
  // -------------------------------------------------------------------------
  public prescriptions = {
    listQueue: async (params?: {
      status?: string;
      has_high_severity?: boolean;
      scenario_key?: string;
      skip?: number;
      limit?: number;
    }): Promise<PrescriptionQueueItemResponse[]> => {
      const query = new URLSearchParams();
      if (params?.status) query.set('status', params.status);
      if (params?.has_high_severity !== undefined) query.set('has_high_severity', String(params.has_high_severity));
      if (params?.scenario_key) query.set('scenario_key', params.scenario_key);
      if (params?.skip !== undefined) query.set('skip', String(params.skip));
      if (params?.limit !== undefined) query.set('limit', String(params.limit));

      const qs = query.toString();
      return this.request<PrescriptionQueueItemResponse[]>(`/prescriptions${qs ? `?${qs}` : ''}`);
    },

    getDetail: async (id: string): Promise<PrescriptionDetailResponse> => {
      return this.request<PrescriptionDetailResponse>(`/prescriptions/${id}`);
    },

    submitReview: async (id: string, review: ReviewActionRequest): Promise<ReviewActionResponse> => {
      return this.request<ReviewActionResponse>(`/prescriptions/${id}/review`, {
        method: 'POST',
        body: JSON.stringify(review),
      });
    },

    resolveEscalation: async (
      id: string,
      resolution: EscalationResolutionRequest
    ): Promise<EscalationResolutionResponse> => {
      return this.request<EscalationResolutionResponse>(`/prescriptions/${id}/resolve-escalation`, {
        method: 'POST',
        body: JSON.stringify(resolution),
      });
    },
  };

  // -------------------------------------------------------------------------
  // Inventory Management & Chief Oversight Endpoints (Stage 3)
  // -------------------------------------------------------------------------
  public inventory = {
    list: async (params?: {
      skip?: number;
      limit?: number;
      status?: string;
      low_stock?: boolean;
      out_of_stock?: boolean;
      search?: string;
    }): Promise<InventoryItemResponse[]> => {
      const query = new URLSearchParams();
      if (params?.skip !== undefined) query.set('skip', String(params.skip));
      if (params?.limit !== undefined) query.set('limit', String(params.limit));
      if (params?.status) query.set('status', params.status);
      if (params?.low_stock !== undefined) query.set('low_stock', String(params.low_stock));
      if (params?.out_of_stock !== undefined) query.set('out_of_stock', String(params.out_of_stock));
      if (params?.search) query.set('search', params.search);
      const qs = query.toString();
      return this.request<InventoryItemResponse[]>(`/inventory${qs ? `?${qs}` : ''}`);
    },

    getItemDetail: async (medicationId: string): Promise<InventoryItemDetailResponse> => {
      return this.request<InventoryItemDetailResponse>(`/inventory/${medicationId}`);
    },

    recordTransaction: async (
      payload: InventoryTransactionRequest
    ): Promise<InventoryTransactionResponse> => {
      return this.request<InventoryTransactionResponse>('/inventory/transactions', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    },
  };

  public oversight = {
    getDashboard: async (): Promise<ChiefOversightDashboardResponse> => {
      return this.request<ChiefOversightDashboardResponse>('/oversight/dashboard');
    },

    getEscalations: async (): Promise<EscalationQueueItemResponse[]> => {
      return this.request<EscalationQueueItemResponse[]>('/oversight/escalations');
    },

    getInventorySummary: async (): Promise<InventorySummaryResponse> => {
      return this.request<InventorySummaryResponse>('/oversight/inventory-summary');
    },
  };

  // -------------------------------------------------------------------------
  // Educational Simulation Endpoints (Stage 4)
  // -------------------------------------------------------------------------
  public education = {
    listCases: async (params?: { difficulty_level?: string }): Promise<EducationalCaseListItem[]> => {
      const query = new URLSearchParams();
      if (params?.difficulty_level) query.set('difficulty_level', params.difficulty_level);
      const qs = query.toString();
      return this.request<EducationalCaseListItem[]>(`/education/cases${qs ? `?${qs}` : ''}`);
    },

    getCaseDetail: async (id: string): Promise<EducationalCaseDetailResponse> => {
      return this.request<EducationalCaseDetailResponse>(`/education/cases/${id}`);
    },

    submitAssessment: async (
      id: string,
      payload: StudentSubmissionRequest
    ): Promise<StudentSubmissionResponse> => {
      return this.request<StudentSubmissionResponse>(`/education/cases/${id}/submit`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    },

    getHistory: async (): Promise<StudentSubmissionListItem[]> => {
      return this.request<StudentSubmissionListItem[]>('/education/history');
    },
  };
}

export const api = new ApiClient();
