import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiGet, getAuthToken, setAuthToken } from './apiClient';

describe('apiClient 401 handling', () => {
  beforeEach(() => {
    vi.restoreAllMocks();

    const storage = new Map<string, string>();
    const localStorageMock = {
      getItem: vi.fn((key: string) => storage.get(key) ?? null),
      setItem: vi.fn((key: string, value: string) => {
        storage.set(key, value);
      }),
      removeItem: vi.fn((key: string) => {
        storage.delete(key);
      }),
      clear: vi.fn(() => storage.clear()),
    };
    const sessionStorageMock = {
      getItem: vi.fn((key: string) => storage.get(key) ?? null),
      setItem: vi.fn((key: string, value: string) => {
        storage.set(key, value);
      }),
      removeItem: vi.fn((key: string) => {
        storage.delete(key);
      }),
      clear: vi.fn(() => storage.clear()),
    };

    const location = { href: '/', replace: vi.fn() };
    const listeners = new Map<string, Set<EventListenerOrEventListenerObject>>();
    const dispatchEvent = vi.fn((event: Event) => {
      const handlers = listeners.get(event.type) || new Set();
      handlers.forEach((handler) => {
        if (typeof handler === 'function') {
          handler(event);
        } else {
          handler.handleEvent(event);
        }
      });
      return true;
    });
    const addEventListener = vi.fn((type: string, listener: EventListenerOrEventListenerObject) => {
      const handlers = listeners.get(type) || new Set();
      handlers.add(listener);
      listeners.set(type, handlers);
    });
    const removeEventListener = vi.fn((type: string, listener: EventListenerOrEventListenerObject) => {
      const handlers = listeners.get(type);
      if (!handlers) return;
      handlers.delete(listener);
      if (handlers.size === 0) {
        listeners.delete(type);
      }
    });

    globalThis.localStorage = localStorageMock as Storage;
    globalThis.sessionStorage = sessionStorageMock as Storage;
    globalThis.window = {
      location,
      dispatchEvent,
      addEventListener,
      removeEventListener,
      sessionStorage: sessionStorageMock,
    } as unknown as Window & typeof globalThis;

    globalThis.CustomEvent = class CustomEvent<T> extends Event {
      detail: T;
      constructor(type: string, eventInitDict?: CustomEventInit<T>) {
        super(type, eventInitDict);
        this.detail = eventInitDict?.detail as T;
      }
    } as typeof CustomEvent;

    setAuthToken(null);
  });

  it('reads and writes bearer tokens from sessionStorage', async () => {
    setAuthToken('mobile-token');

    expect(getAuthToken()).toBe('mobile-token');
    expect(globalThis.sessionStorage.getItem('nexus_auth_token')).toBe('mobile-token');

    setAuthToken(null);
    expect(getAuthToken()).toBeNull();
    expect(globalThis.sessionStorage.getItem('nexus_auth_token')).toBeNull();
  });

  it('clears the stored token and redirects to login on 401 responses', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response('', {
        status: 401,
        statusText: 'Unauthorized',
      })
    );
    vi.stubGlobal('fetch', fetchMock);

    const eventListener = vi.fn();
    window.addEventListener('auth:unauthorized', eventListener as EventListener);

    setAuthToken('stale-token');

    await expect(apiGet('/api/test')).rejects.toThrow(/Session expired/);

    expect(getAuthToken()).toBeNull();
    expect(eventListener).toHaveBeenCalled();
    expect(window.location.replace).toHaveBeenCalledWith('/login');
  });
});
