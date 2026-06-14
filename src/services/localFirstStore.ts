type LocalStoreName = 'ledger' | 'prices';

export interface LocalRecord<T = any> {
  id: string;
  ownerId: string;
  data: T;
  updatedAt: string;
  dirty?: boolean;
}

const DB_NAME = 'esoko-local-first-v1';
const STORE_NAMES: LocalStoreName[] = ['ledger', 'prices'];

function openLocalFirstDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      for (const storeName of STORE_NAMES) {
        if (!db.objectStoreNames.contains(storeName)) {
          const store = db.createObjectStore(storeName, { keyPath: 'id' });
          store.createIndex('ownerId', 'ownerId', { unique: false });
          store.createIndex('updatedAt', 'updatedAt', { unique: false });
        }
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function withLocalStore<T>(
  storeName: LocalStoreName,
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T> | void
) {
  const db = await openLocalFirstDb();
  return new Promise<T | void>((resolve, reject) => {
    const tx = db.transaction(storeName, mode);
    const store = tx.objectStore(storeName);
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

export async function saveLocalRecords<T>(
  storeName: LocalStoreName,
  ownerId: string,
  records: Array<T & { id: string }>,
  dirty = false
) {
  const updatedAt = new Date().toISOString();
  await withLocalStore(storeName, 'readwrite', (store) => {
    records.forEach((record) => {
      store.put({ id: record.id, ownerId, data: record, updatedAt, dirty });
    });
  });
}

export async function getLocalRecords<T>(storeName: LocalStoreName, ownerId: string) {
  const rows =
    (await withLocalStore<LocalRecord<T>[]>(storeName, 'readonly', (store) =>
      store.index('ownerId').getAll(ownerId)
    )) || [];
  return rows
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .map((row) => row.data);
}

export async function saveLocalLedgerEntry(ownerId: string, entry: any) {
  await saveLocalRecords('ledger', ownerId, [{ ...entry, id: entry.id || `local-ledger-${Date.now()}` }], true);
}

export async function cachePriceList(ownerId: string, products: any[]) {
  await saveLocalRecords(
    'prices',
    ownerId,
    products.map((product) => ({
      id: product.id,
      name: product.name,
      price: product.price,
      category: product.category,
      stock: product.stock,
      updatedAt: product.updatedAt,
    }))
  );
}
