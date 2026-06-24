export type AttachmentType = 'image' | 'document';

export interface AttachmentRecord {
  id: string;
  ownerId: string;
  channel: string;
  fileName: string;
  fileSize: string;
  type: AttachmentType;
  blob: Blob;
  createdAt: string;
}

const DB_NAME = 'esoko-attachments-v1';
const STORE_NAME = 'attachments';

function openAttachmentDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('ownerId', 'ownerId', { unique: false });
        store.createIndex('channel', 'channel', { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function withAttachmentStore<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T> | void
) {
  const db = await openAttachmentDb();
  return new Promise<T | void>((resolve, reject) => {
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

export async function saveAttachmentRecord(record: AttachmentRecord) {
  await withAttachmentStore('readwrite', (store) => store.put(record));
}

export async function getAttachmentRecords(ownerId: string, channel: string) {
  return (
    (await withAttachmentStore<AttachmentRecord[]>('readonly', (store) =>
      store.index('ownerId').getAll(ownerId)
    )) || []
  )
    .filter((record) => record.channel === channel)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function deleteAttachmentRecord(id: string) {
  await withAttachmentStore('readwrite', (store) => store.delete(id));
}
