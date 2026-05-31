const DEFAULT_API_BASE = import.meta.env.VITE_API_BASE_URL || '';

const API_BASE = (() => {
  if (typeof window === 'undefined') return DEFAULT_API_BASE;
  if (!DEFAULT_API_BASE) return '';

  try {
    const parsed = new URL(DEFAULT_API_BASE, window.location.origin);
    const isMixedContent = window.location.protocol === 'https:' && parsed.protocol === 'http:';
    if (isMixedContent) {
      return '';
    }
    return DEFAULT_API_BASE;
  } catch {
    return DEFAULT_API_BASE;
  }
})();

export interface ApiRequestOptions extends RequestInit {
  params?: Record<string, string | number | boolean | undefined>;
  token?: string | null;
}

const inFlightGetRequests = new Map<string, Promise<any>>();

function buildQueryString(params: Record<string, string | number | boolean | undefined> = {}) {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      searchParams.append(key, String(value));
    }
  });
  const queryString = searchParams.toString();
  return queryString ? `?${queryString}` : '';
}

export function getAuthToken(): string | null {
  // Auth tokens are stored in httpOnly cookies instead of localStorage.
  return null;
}

export function setAuthToken(_token: string | null) {
  // No client-side token persistence. Server auth uses secure cookies.
}

async function request<T>(
  path: string,
  method: string,
  body?: any,
  options: ApiRequestOptions = {}
): Promise<T> {
  const url = `${API_BASE}${path}${buildQueryString(options.params || {})}`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (options.headers) {
    Object.assign(headers, options.headers as Record<string, string>);
  }

  if (body instanceof FormData) {
    delete headers['Content-Type'];
  }

  // Add Authorization header only if explicitly provided
  const token = options.token;
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    method,
    headers,
    body: body instanceof FormData ? body : body !== undefined ? JSON.stringify(body) : undefined,
    credentials: 'include', // Include cookies
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`API request failed: ${response.status} ${response.statusText} - ${errorBody}`);
  }

  const contentType = response.headers.get('Content-Type') || '';
  if (contentType.includes('application/json')) {
    return response.json();
  }
  return response as unknown as T;
}

export async function apiGet<T>(path: string, options: ApiRequestOptions = {}) {
  const query = buildQueryString(options.params || {});
  const cacheKey = `${path}${query}`;
  const existing = inFlightGetRequests.get(cacheKey);
  if (existing) return existing as Promise<T>;

  const pending = request<T>(path, 'GET', undefined, options).finally(() => {
    inFlightGetRequests.delete(cacheKey);
  });
  inFlightGetRequests.set(cacheKey, pending);
  return pending;
}

export async function apiPost<T>(path: string, body?: any, options: ApiRequestOptions = {}) {
  return request<T>(path, 'POST', body, options);
}

export async function apiPut<T>(path: string, body?: any, options: ApiRequestOptions = {}) {
  return request<T>(path, 'PUT', body, options);
}

export async function apiDelete<T>(path: string, body?: any, options: ApiRequestOptions = {}) {
  return request<T>(path, 'DELETE', body, options);
}

export function authHeaders(token?: string): Record<string, string> {
  return token ? { Authorization: `Bearer ${token}` } : {};
}
