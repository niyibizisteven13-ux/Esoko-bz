const DEFAULT_API_BASE = import.meta.env.VITE_API_BASE_URL || '';
let inMemoryToken: string | null = null;

const API_BASE = (() => {
  if (typeof window === 'undefined') return DEFAULT_API_BASE;
  if (!DEFAULT_API_BASE) return '';

  try {
    const parsed = new URL(DEFAULT_API_BASE, window.location.origin);
    const isLocalHost = ['localhost', '127.0.0.1'].includes(window.location.hostname);
    const isRemoteApi = !['localhost', '127.0.0.1'].includes(parsed.hostname);
    if (isLocalHost && isRemoteApi) {
      return '';
    }
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

function redirectToLogin(path: string) {
  if (typeof window === 'undefined') return;

  try {
    localStorage.removeItem('auth_token');
    sessionStorage.removeItem('nexus_auth_token');
  } catch {
    // ignore storage access errors
  }

  setAuthToken(null);

  const currentPath = window.location.pathname || '';
  if (!currentPath.includes('/login')) {
    if (typeof window.location.replace === 'function') {
      window.location.replace('/login');
    } else {
      window.location.href = '/login';
    }
  }

  window.dispatchEvent(new CustomEvent('auth:unauthorized', { detail: { path } }));
}

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
  if (inMemoryToken) return inMemoryToken;
  if (typeof window === 'undefined') return null;

  try {
    const tokenFromStorage = window.sessionStorage?.getItem('nexus_auth_token');
    inMemoryToken = tokenFromStorage;
    return inMemoryToken;
  } catch {
    return null;
  }
}

export function setAuthToken(token: string | null) {
  inMemoryToken = token;
  if (typeof window === 'undefined') return;

  try {
    if (token) {
      window.sessionStorage?.setItem('nexus_auth_token', token);
    } else {
      window.sessionStorage?.removeItem('nexus_auth_token');
    }
  } catch {
    // ignore
  }
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

  const token = options.token !== undefined ? options.token : getAuthToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    method,
    headers,
    body: body instanceof FormData ? body : body !== undefined ? JSON.stringify(body) : undefined,
    credentials: 'include', // Include cookies
  });

  // Handle 401 Unauthorized - clear token and redirect to login
  if (response.status === 401) {
    redirectToLogin(path);
    throw new Error('Unauthorized (401) - Session expired. Please log in again.');
  }

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
