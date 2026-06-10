import { apiGet, apiPost, apiPut, apiDelete, authHeaders } from './apiClient';
import { enqueueOfflineAction, isLikelyNetworkError } from './offlineQueue';

export interface ProductItem {
  id: string;
  traderId: string;
  name: string;
  description?: string;
  price: number;
  stock: number;
  category?: string;
  imageUrl?: string;
  code?: string;
  status?: string;
  createdAt?: string;
  updatedAt?: string;
  [key: string]: any;
}

export interface ProductQueryParams {
  traderId?: string;
  category?: string;
  status?: string;
  limit?: number;
  offset?: number;
  [key: string]: string | number | boolean | undefined;
}

const PRODUCT_CACHE_DB = 'esoko-device-products-v1';
const PRODUCT_CACHE_STORE = 'productsByTrader';

function canUseIndexedDb() {
  return typeof window !== 'undefined' && 'indexedDB' in window;
}

function openProductCacheDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!canUseIndexedDb()) {
      reject(new Error('IndexedDB is not available'));
      return;
    }

    const request = indexedDB.open(PRODUCT_CACHE_DB, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(PRODUCT_CACHE_STORE)) {
        db.createObjectStore(PRODUCT_CACHE_STORE, { keyPath: 'traderId' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function withProductCache<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T> | void
): Promise<T | void> {
  const db = await openProductCacheDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PRODUCT_CACHE_STORE, mode);
    const store = tx.objectStore(PRODUCT_CACHE_STORE);
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

function productCacheKey(traderId?: string) {
  return traderId || 'all';
}

function sortProducts(products: ProductItem[]) {
  return [...products].sort((a, b) => {
    const left = new Date(a.updatedAt || a.createdAt || 0).getTime();
    const right = new Date(b.updatedAt || b.createdAt || 0).getTime();
    return right - left;
  });
}

async function readCachedProducts(traderId?: string): Promise<ProductItem[]> {
  if (!canUseIndexedDb()) return [];
  try {
    const cached = (await withProductCache<any>('readonly', (store) =>
      store.get(productCacheKey(traderId))
    )) as any;
    return Array.isArray(cached?.products) ? cached.products : [];
  } catch (error) {
    console.warn('Product cache read failed:', error);
    return [];
  }
}

export async function cacheTraderProducts(traderId: string | undefined, products: ProductItem[]) {
  if (!canUseIndexedDb()) return;
  try {
    await withProductCache('readwrite', (store) =>
      store.put({
        traderId: productCacheKey(traderId),
        products: sortProducts(products),
        updatedAt: new Date().toISOString(),
      })
    );
    window.dispatchEvent(
      new CustomEvent('esoko-products-cache-updated', {
        detail: { traderId: productCacheKey(traderId), products: sortProducts(products) },
      })
    );
  } catch (error) {
    console.warn('Product cache write failed:', error);
  }
}

export async function upsertCachedProduct(product: ProductItem) {
  const traderId = product.traderId;
  const cached = await readCachedProducts(traderId);
  const next = [product, ...cached.filter((item) => item.id !== product.id)];
  await cacheTraderProducts(traderId, next);
}

export async function removeCachedProduct(traderId: string | undefined, productId: string) {
  const cached = await readCachedProducts(traderId);
  await cacheTraderProducts(
    traderId,
    cached.filter((item) => item.id !== productId)
  );
}

export async function getProducts(params?: ProductQueryParams) {
  try {
    const response = await apiGet<{ products: ProductItem[] }>('/api/products', {
      params,
      headers: authHeaders(),
    });
    if (params?.traderId) {
      await cacheTraderProducts(params.traderId, response.products || []);
    }
    return response;
  } catch (error) {
    if (!params?.traderId || !isLikelyNetworkError(error)) throw error;
    return { products: await readCachedProducts(params.traderId), fromDeviceStorage: true } as any;
  }
}

export async function getProduct(productId: string) {
  return apiGet<{ product: ProductItem }>(`/api/products/${productId}`, {
    headers: authHeaders(),
  });
}

export async function createProduct(payload: Partial<ProductItem>) {
  const optimisticProduct: ProductItem = {
    id: String(payload.id || `local-product-${Date.now()}`),
    traderId: String(payload.traderId || ''),
    name: String(payload.name || 'Product'),
    description: payload.description,
    price: Number(payload.price || 0),
    stock: Number(payload.stock || 0),
    category: payload.category,
    imageUrl: payload.imageUrl,
    code: payload.code,
    status: payload.status || 'pending_sync',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    pendingSync: true,
    ...payload,
  } as ProductItem;

  try {
    const response = await apiPost<{ product: ProductItem; id?: string }>('/api/products', payload, {
      headers: authHeaders(),
    });
    if (response?.product) await upsertCachedProduct(response.product);
    return response;
  } catch (error) {
    if (!isLikelyNetworkError(error)) throw error;
    const queued = await enqueueOfflineAction({
      path: '/api/products',
      method: 'POST',
      body: payload,
      headers: authHeaders(),
    });
    const queuedProduct = { ...optimisticProduct, id: queued.id };
    await upsertCachedProduct(queuedProduct);
    return {
      success: true,
      pendingSync: true,
      id: queued.id,
      product: queuedProduct,
      message: 'Product saved on this device and will sync when internet returns.',
    };
  }
}

export async function uploadProductMedia(file: File) {
  const formData = new FormData();
  formData.append('file', file);
  return apiPost<{ url: string }>('/api/upload', formData, {
    headers: authHeaders(),
  });
}

export async function updateProduct(productId: string, payload: Partial<ProductItem>) {
  try {
    const response = await apiPut<{ product: ProductItem }>(`/api/products/${productId}`, payload, {
      headers: authHeaders(),
    });
    if (response?.product) await upsertCachedProduct(response.product);
    return response;
  } catch (error) {
    if (!isLikelyNetworkError(error)) throw error;
    await enqueueOfflineAction({
      path: `/api/products/${productId}`,
      method: 'PUT',
      body: payload,
      headers: authHeaders(),
    });
    const traderId = payload.traderId ? String(payload.traderId) : undefined;
    if (traderId) {
      const cached = await readCachedProducts(traderId);
      const existing = cached.find((item) => item.id === productId);
      if (existing) {
        await upsertCachedProduct({
          ...existing,
          ...payload,
          id: productId,
          traderId,
          updatedAt: new Date().toISOString(),
          pendingSync: true,
        } as ProductItem);
      }
    }
    return { success: true, pendingSync: true };
  }
}

export async function deleteProduct(productId: string) {
  return apiDelete(`/api/products/${productId}`, undefined, {
    headers: authHeaders(),
  });
}
