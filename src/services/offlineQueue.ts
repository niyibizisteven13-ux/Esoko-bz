type OfflineActionStatus = 'pending' | 'syncing' | 'synced' | 'failed';

export interface OfflineAction {
  id: string;
  path: string;
  method: 'POST' | 'PUT' | 'DELETE';
  body: any;
  headers?: Record<string, string>;
  createdAt: string;
  updatedAt: string;
  status: OfflineActionStatus;
  attempts: number;
  lastError?: string;
}

const DB_NAME = 'esoko-offline-v1';
const STORE_NAME = 'actions';

function openOfflineDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function withStore<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T> | void
): Promise<T | void> {
  const db = await openOfflineDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, mode);
    const store = tx.objectStore(STORE_NAME);
    const request = run(store);
    tx.oncomplete = () => {
      db.close();
      resolve(request ? request.result : undefined);
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}

function createOfflineId(prefix: string) {
  const random = Math.random().toString(36).slice(2, 10);
  return `${prefix}-${Date.now()}-${random}`;
}

export function isLikelyNetworkError(error: any) {
  const message = String(error?.message || error || '').toLowerCase();
  return (
    !navigator.onLine ||
    error?.name === 'TypeError' ||
    message.includes('failed to fetch') ||
    message.includes('network') ||
    message.includes('load failed')
  );
}

export async function enqueueOfflineAction(
  action: Omit<OfflineAction, 'id' | 'createdAt' | 'updatedAt' | 'status' | 'attempts'>
) {
  const now = new Date().toISOString();
  const queued: OfflineAction = {
    ...action,
    id: createOfflineId('offline'),
    createdAt: now,
    updatedAt: now,
    status: 'pending',
    attempts: 0,
  };
  await withStore('readwrite', (store) => store.put(queued));
  window.dispatchEvent(new CustomEvent('offline-action-queued', { detail: queued }));
  return queued;
}

export async function getOfflineActions(): Promise<OfflineAction[]> {
  const actions = (await withStore<OfflineAction[]>('readonly', (store) => store.getAll())) || [];
  return actions.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

async function updateOfflineAction(action: OfflineAction) {
  await withStore('readwrite', (store) => store.put({ ...action, updatedAt: new Date().toISOString() }));
}

async function removeOfflineAction(id: string) {
  await withStore('readwrite', (store) => store.delete(id));
}

export async function syncOfflineActions() {
  if (!navigator.onLine) return { synced: 0, failed: 0, pending: 0 };

  const actions = (await getOfflineActions()).filter((action) => action.status !== 'synced');
  let synced = 0;
  let failed = 0;

  for (const action of actions) {
    const syncing: OfflineAction = {
      ...action,
      status: 'syncing',
      attempts: action.attempts + 1,
      updatedAt: new Date().toISOString(),
    };
    await updateOfflineAction(syncing);

    try {
      const response = await fetch(action.path, {
        method: action.method,
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...(action.headers || {}),
        },
        body: JSON.stringify(action.body),
      });

      if (response.ok) {
        await removeOfflineAction(action.id);
        synced += 1;
        continue;
      }

      const text = await response.text();
      if (response.status >= 400 && response.status < 500) {
        await updateOfflineAction({
          ...syncing,
          status: 'failed',
          lastError: text || response.statusText,
        });
        failed += 1;
      } else {
        await updateOfflineAction({
          ...syncing,
          status: 'pending',
          lastError: text || response.statusText,
        });
      }
    } catch (error: any) {
      await updateOfflineAction({
        ...syncing,
        status: 'pending',
        lastError: error?.message || 'Network unavailable',
      });
    }
  }

  window.dispatchEvent(new CustomEvent('offline-actions-synced', { detail: { synced, failed } }));
  const pending = (await getOfflineActions()).filter((action) => action.status === 'pending').length;
  return { synced, failed, pending };
}

export function registerOfflineSync() {
  window.addEventListener('online', () => {
    void syncOfflineActions();
  });
  void syncOfflineActions();
}
