const TOKEN_STORAGE_KEY = 'esoko_jwt_token';
const MEMORY_CACHE_TTL_MS = 60_000;
const DEFAULT_BACKEND_PORT = '5173';
const DEFAULT_BACKEND_BASE = `http://localhost:${DEFAULT_BACKEND_PORT}`;

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

const memoryCache = new Map<string, CacheEntry<unknown>>();

function getStorage(): Storage | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function isNativeWebWrapper(): boolean {
  if (typeof window === 'undefined') return false;
  const nav = window.navigator as any;
  const userAgent = typeof nav?.userAgent === 'string' ? nav.userAgent : '';

  const isNativeWrapper = /(?:Capacitor|Cordova|ReactNative|Electron|NexusApp|EsokoNexus|esoko-nexus)/i.test(
    userAgent
  );
  const hasCapacitorNative = Boolean((window as any).Capacitor?.isNative);
  return isNativeWrapper || hasCapacitorNative;
}

function getBackendServerUrl(): string {
  if (typeof window === 'undefined') return DEFAULT_BACKEND_BASE;

  const hostname = window.location.hostname;
  const protocol = window.location.protocol;
  const port = window.location.port || DEFAULT_BACKEND_PORT;

  const localhostHosts = new Set(['localhost', '127.0.0.1', '::1']);
  const defaultApiBase = import.meta.env.VITE_API_BASE_URL || DEFAULT_BACKEND_BASE;
  const networkApiBase = import.meta.env.VITE_NETWORK_API_URL || `http://172.20.26.58:${DEFAULT_BACKEND_PORT}`;

  if (localhostHosts.has(hostname)) {
    if (protocol === 'http:' || protocol === 'https:') {
      return `${protocol}//${hostname}:${port}`;
    }
    return DEFAULT_BACKEND_BASE;
  }

  if (isNativeWebWrapper()) {
    if (protocol === 'http:' || protocol === 'https:') {
      return `${protocol}//${hostname}:${port}`;
    }
    return DEFAULT_BACKEND_BASE;
  }

  const apiUrl = new URL(defaultApiBase, window.location.origin);
  const apiUrlIsLocalhost = localhostHosts.has(apiUrl.hostname);
  if (apiUrlIsLocalhost && !localhostHosts.has(hostname)) {
    return networkApiBase;
  }

  return defaultApiBase;
}

export const BACKEND_SERVER_URL = getBackendServerUrl();

export function setAuthToken(token: string | null): void {
  const storage = getStorage();
  if (!storage) {
    return;
  }

  if (token) {
    storage.setItem(TOKEN_STORAGE_KEY, token);
  } else {
    storage.removeItem(TOKEN_STORAGE_KEY);
  }
}

export function getAuthToken(): string | null {
  const storage = getStorage();
  if (!storage) {
    return null;
  }

  return storage.getItem(TOKEN_STORAGE_KEY);
}

export function clearAuthToken(): void {
  setAuthToken(null);
}

function buildHeaders(headers?: HeadersInit): Headers {
  const requestHeaders = new Headers();
  requestHeaders.set('Content-Type', 'application/json');

  if (headers instanceof Headers) {
    headers.forEach((value: string, key: string) => {
      requestHeaders.set(key, value);
    });
  } else if (Array.isArray(headers)) {
    headers.forEach((entry: [string, string]) => {
      requestHeaders.set(entry[0], entry[1]);
    });
  } else if (headers) {
    Object.entries(headers as Record<string, string>).forEach(([key, value]: [string, string]) => {
      requestHeaders.set(key, value);
    });
  }

  const token = getAuthToken();
  if (token) {
    requestHeaders.set('Authorization', `Bearer ${token}`);
  }

  return requestHeaders;
}

export async function fetchWithCache<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const cacheKey = `${options.method ?? 'GET'}:${endpoint}`;
  const cachedEntry = memoryCache.get(cacheKey) as CacheEntry<T> | undefined;

  if (cachedEntry && cachedEntry.expiresAt > Date.now()) {
    return cachedEntry.value;
  }

  const storage = getStorage();
  const serializedCache = storage?.getItem(cacheKey);

  if (serializedCache) {
    try {
      const parsed = JSON.parse(serializedCache) as CacheEntry<T>;
      if (parsed.expiresAt > Date.now()) {
        memoryCache.set(cacheKey, parsed);
        return parsed.value;
      }
    } catch {
      storage?.removeItem(cacheKey);
    }
  }

  try {
    const response = await fetch(`${BACKEND_SERVER_URL}${endpoint}`, {
      ...options,
      headers: buildHeaders(options.headers),
    });

    if (!response.ok) {
      throw new Error(`Request failed with status ${response.status}`);
    }

    const payload = (await response.json()) as T;

    const nextEntry: CacheEntry<T> = {
      value: payload,
      expiresAt: Date.now() + MEMORY_CACHE_TTL_MS,
    };

    memoryCache.set(cacheKey, nextEntry);
    storage?.setItem(cacheKey, JSON.stringify(nextEntry));

    return payload;
  } catch (error: unknown) {
    const fallback = memoryCache.get(cacheKey) as CacheEntry<T> | undefined;
    if (fallback) {
      return fallback.value;
    }

    throw error instanceof Error ? error : new Error('Unexpected fetch error');
  }
}
