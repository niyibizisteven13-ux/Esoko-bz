import { apiGet, apiPost, apiPut, apiDelete, authHeaders } from './apiClient';

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

export async function getProducts(params?: ProductQueryParams) {
  return apiGet<{ products: ProductItem[] }>('/api/products', {
    params,
    headers: authHeaders(),
  });
}

export async function getProduct(productId: string) {
  return apiGet<{ product: ProductItem }>(`/api/products/${productId}`, {
    headers: authHeaders(),
  });
}

export async function createProduct(payload: Partial<ProductItem>) {
  return apiPost('/api/products', payload, {
    headers: authHeaders(),
  });
}

export async function uploadProductMedia(file: File) {
  const formData = new FormData();
  formData.append('file', file);
  return apiPost<{ url: string }>('/api/upload', formData, {
    headers: authHeaders(),
  });
}

export async function updateProduct(productId: string, payload: Partial<ProductItem>) {
  return apiPut(`/api/products/${productId}`, payload, {
    headers: authHeaders(),
  });
}

export async function deleteProduct(productId: string) {
  return apiDelete(`/api/products/${productId}`, {
    headers: authHeaders(),
  });
}
