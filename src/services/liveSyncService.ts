import { hasStoredAuthUser } from './sessionService';

type LiveSyncPayload = {
  id?: string;
  type?: string;
  path?: string;
  method?: string;
  collection?: string;
  actorUserId?: string;
  timestamp?: string;
  [key: string]: any;
};

type LiveSyncHandler = (payload: LiveSyncPayload) => void;

let eventSource: EventSource | null = null;
const listeners = new Set<LiveSyncHandler>();

function notifyListeners(payload: LiveSyncPayload) {
  listeners.forEach((listener) => {
    try {
      listener(payload);
    } catch (error) {
      console.error('Live sync listener failed:', error);
    }
  });
}

function ensureEventSource() {
  if (typeof window === 'undefined' || eventSource) return;
  if (!hasStoredAuthUser()) return;

  eventSource = new EventSource('/api/events', { withCredentials: true });

  eventSource.addEventListener('sync', (event) => {
    try {
      notifyListeners(JSON.parse((event as MessageEvent).data));
    } catch (error) {
      console.error('Unable to parse live sync event:', error);
    }
  });

  eventSource.onerror = () => {
    eventSource?.close();
    eventSource = null;
    if (!hasStoredAuthUser()) return;
    window.setTimeout(() => {
      if (listeners.size > 0) ensureEventSource();
    }, 3000);
  };
}

export function subscribeToLiveUpdates(handler: LiveSyncHandler): () => void {
  listeners.add(handler);
  ensureEventSource();

  return () => {
    listeners.delete(handler);
    if (listeners.size === 0 && eventSource) {
      eventSource.close();
      eventSource = null;
    }
  };
}
