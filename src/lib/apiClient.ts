/**
 * Unified API Client for ScholarPath
 * Handles requests, Authorization headers, token management, and JSON error handling.
 */

const API_BASE = '/api/v1';

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
}

class ApiClient {
  private token: string | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      this.token = localStorage.getItem('scholarpath_auth_token');
    }
  }

  public setToken(token: string | null): void {
    this.token = token;
    if (typeof window !== 'undefined') {
      if (token) {
        localStorage.setItem('scholarpath_auth_token', token);
      } else {
        localStorage.removeItem('scholarpath_auth_token');
      }
    }
  }

  public getToken(): string | null {
    if (!this.token && typeof window !== 'undefined') {
      this.token = localStorage.getItem('scholarpath_auth_token');
    }
    return this.token;
  }

  private async request<T = any>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = endpoint.startsWith('http') ? endpoint : `${API_BASE}${endpoint}`;
    const headers: Record<string, string> = {
      ...(options.headers as Record<string, string> || {}),
    };

    // Auto-attach Bearer token if available
    const activeToken = this.getToken();
    if (activeToken && !headers['Authorization']) {
      headers['Authorization'] = `Bearer ${activeToken}`;
    }

    // Default to JSON Content-Type unless uploading FormData
    if (!(options.body instanceof FormData) && !headers['Content-Type']) {
      headers['Content-Type'] = 'application/json';
    }

    const res = await fetch(url, {
      ...options,
      headers,
      credentials: 'include', // Include HTTP-only cookies
    });

    let payload: any;
    try {
      payload = await res.json();
    } catch {
      payload = { success: res.ok, error: { message: res.statusText } };
    }

    if (!res.ok || payload.success === false) {
      const errorMsg = payload?.error?.message || `Request failed with status ${res.status}`;
      const err = new Error(errorMsg) as Error & { code?: string; details?: any; status: number };
      err.code = payload?.error?.code || 'API_ERROR';
      err.details = payload?.error?.details;
      err.status = res.status;

      // If token expired, clear local token
      if (res.status === 401) {
        this.setToken(null);
      }

      throw err;
    }

    return payload.data !== undefined ? payload.data : payload;
  }

  public get<T = any>(endpoint: string, options?: RequestInit): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'GET' });
  }

  public post<T = any>(endpoint: string, body?: any, options?: RequestInit): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'POST',
      body: body instanceof FormData ? body : JSON.stringify(body),
    });
  }

  public put<T = any>(endpoint: string, body?: any, options?: RequestInit): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'PUT',
      body: body instanceof FormData ? body : JSON.stringify(body),
    });
  }

  public patch<T = any>(endpoint: string, body?: any, options?: RequestInit): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'PATCH',
      body: body instanceof FormData ? body : JSON.stringify(body),
    });
  }

  public delete<T = any>(endpoint: string, options?: RequestInit): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'DELETE' });
  }
}

export const api = new ApiClient();
