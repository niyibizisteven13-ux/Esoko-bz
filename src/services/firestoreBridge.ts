/**
 * Firestore-to-Backend API Bridge
 * Intercepts Firestore-like calls and routes them to backend REST API
 * Allows gradual migration from Firebase to backend API without changing components
 */

import { apiGet, apiPost, apiPut, apiDelete, getAuthToken } from './apiClient';
import { subscribeToLiveUpdates } from './liveSyncService';

export interface QueryConstraint {
  type: string;
  field?: string;
  value?: any;
  operator?: string;
  direction?: 'asc' | 'desc';
}

export interface CollectionReference {
  _path: { segments: string[] };
  _query?: { constraints: QueryConstraint[] };
  _collectionName?: string;
}

export interface DocumentReference {
  _key: { path: { segments: string[] } };
  _collectionName?: string;
  _docId?: string;
}

export interface DocumentSnapshot {
  _key?: { path: { segments: string[] } };
  _document?: any;
  exists(): boolean;
  data(): any;
  get(path: string): any;
  id: string;
}

export interface QuerySnapshot {
  docs: DocumentSnapshot[];
  empty: boolean;
  size: number;
  forEach(callback: (doc: DocumentSnapshot) => void): void;
}

// Map collection names to API endpoints
const COLLECTION_ROUTES: Record<string, string> = {
  products: '/api/products',
  users: '/api/users',
  transactions: '/api/transactions',
  purchases: '/api/purchases',
  deliveries: '/api/deliveries',
  notifications: '/api/notifications',
  system_config: '/api/system_config',
  platform: '/api/platform',
  linked_accounts: '/api/linked_accounts',
  messages: '/api/messages',
  chats: '/api/chats',
  payroll: '/api/payroll',
  employees: '/api/employees',
  team_members: '/api/team_members',
  tasks: '/api/tasks',
  loans: '/api/loans',
  wallets: '/api/wallets',
  loyalty_points: '/api/loyalty_points',
  incentives: '/api/incentives',
  incentive_programs: '/api/incentive_programs',
  platform_revenue: '/api/platform_revenue',
  platform_settings: '/api/platform_settings',
  referrals: '/api/referrals',
  tickets: '/api/tickets',
  suppliers: '/api/suppliers',
  orders: '/api/orders',
  trader_financials: '/api/trader_financials',
};

function getApiPath(collectionName: string): string {
  return COLLECTION_ROUTES[collectionName] || `/api/${collectionName}`;
}

const COLLECTION_RESPONSE_KEYS: Record<string, string[]> = {
  users: ['users', 'user'],
  products: ['products', 'product'],
  transactions: ['transactions', 'transaction'],
  purchases: ['purchases', 'purchase'],
  deliveries: ['deliveries', 'delivery'],
  notifications: ['notifications', 'notification'],
  tickets: ['tickets', 'ticket'],
  system_config: ['system_config', 'config'],
  platform: ['config', 'platform'],
  linked_accounts: ['linked_accounts', 'accounts'],
  loans: ['loans', 'loan'],
  payroll: ['payroll', 'records'],
  employees: ['employees'],
  team_members: ['team_members', 'members'],
  messages: ['messages'],
  tasks: ['tasks'],
  incentive_programs: ['incentive_programs', 'programs'],
  platform_revenue: ['platform_revenue'],
  trader_financials: ['trader_financials', 'financials'],
};

function getResponseKeys(collectionName: string) {
  return [
    ...(COLLECTION_RESPONSE_KEYS[collectionName] || []),
    collectionName,
    'documents',
    'items',
    'data',
  ];
}

function extractCollectionData(response: any, collectionName: string): any[] {
  if (Array.isArray(response)) return response;
  if (!response || typeof response !== 'object') return [];

  for (const key of getResponseKeys(collectionName)) {
    if (Array.isArray(response[key])) return response[key];
  }

  for (const key of getResponseKeys(collectionName)) {
    if (response[key] && typeof response[key] === 'object') return [response[key]];
  }

  return [];
}

function extractDocumentData(response: any, collectionName: string): any | undefined {
  if (!response || typeof response !== 'object') return response;

  for (const key of ['document', ...getResponseKeys(collectionName)]) {
    const value = response[key];
    if (value && typeof value === 'object' && !Array.isArray(value)) return value;
  }

  if ('success' in response) return undefined;
  return response;
}

function documentId(data: any, fallback?: string) {
  return data?.id || data?.uid || fallback || `doc_${Math.random().toString(36).slice(2, 10)}`;
}

function createDocumentSnapshot(data: any, fallbackId?: string): DocumentSnapshot {
  const id = documentId(data, fallbackId);
  return {
    id,
    _key: { path: { segments: [id] } },
    _document: data,
    exists: () => data !== undefined && data !== null,
    data: () => data,
    get: (path: string) => data?.[path],
  };
}

function createQuerySnapshot(documents: any[]): QuerySnapshot {
  const docs = documents.map((data: any) => createDocumentSnapshot(data));
  return {
    docs,
    empty: docs.length === 0,
    size: docs.length,
    forEach: (callback: (doc: DocumentSnapshot) => void) => docs.forEach(callback),
  };
}

function isDocumentReference(ref: any) {
  return Boolean(ref?._docId || ref?._key?.path?.segments?.length >= 2);
}

function hasFieldTransforms(data: any) {
  return Object.values(data || {}).some(
    (value: any) =>
      value && typeof value === 'object' && !Array.isArray(value) && '__increment' in value
  );
}

async function resolveFieldTransforms(docRef: any, data: any) {
  if (!hasFieldTransforms(data)) return data;
  const currentSnap = await getDoc(docRef);
  const current = currentSnap.exists() ? currentSnap.data() : {};
  const resolved: any = {};

  for (const [key, value] of Object.entries(data || {})) {
    if (value && typeof value === 'object' && !Array.isArray(value) && '__increment' in value) {
      resolved[key] = Number(current?.[key] || 0) + Number((value as any).__increment || 0);
    } else {
      resolved[key] = value;
    }
  }

  return resolved;
}

/**
 * Create a mock collection reference (doesn't actually call API until query methods are used)
 */
export function collection(db: any, collectionName: string): any {
  return {
    _path: { segments: [collectionName] },
    _collectionName: collectionName,
  };
}

/**
 * Create a mock document reference
 */
export function doc(dbOrCollectionRef: any, collectionName?: string, docId?: string): any {
  if (collectionName && docId) {
    return {
      _key: { path: { segments: [collectionName, docId] } },
      _collectionName: collectionName,
      _docId: docId,
    };
  }

  if (dbOrCollectionRef && dbOrCollectionRef._collectionName) {
    const collectionRef = dbOrCollectionRef;
    const generatedId =
      docId || `auto_${Math.random().toString(36).substring(2, 10)}_${Date.now()}`;
    return {
      _key: { path: { segments: [collectionRef._collectionName, generatedId] } },
      _collectionName: collectionRef._collectionName,
      _docId: generatedId,
    };
  }

  throw new Error('Invalid arguments passed to doc()');
}

/**
 * Create a query constraint (where clause)
 */
export function where(field: string, operator: string, value: any): QueryConstraint {
  return {
    type: 'where',
    field,
    operator,
    value,
  };
}

/**
 * Create an ordering constraint
 */
export function orderBy(field: string, direction?: 'asc' | 'desc'): QueryConstraint {
  return {
    type: 'orderBy',
    field,
    direction: direction || 'asc',
  };
}

/**
 * Create a limit constraint
 */
export function limit(count: number): QueryConstraint {
  return {
    type: 'limit',
    value: count,
  };
}

/**
 * Create a query from collection and constraints
 */
export function query(collectionRef: any, ...constraints: QueryConstraint[]): any {
  return {
    ...collectionRef,
    _constraints: constraints,
  };
}

/**
 * Get documents matching a query
 */
export async function getDocs(q: any): Promise<QuerySnapshot> {
  const collectionName = q._collectionName || q._path?.segments?.[0];
  const apiPath = getApiPath(collectionName);

  try {
    let params: any = {};
    const constraints = q._constraints || [];

    // Process constraints to build query params
    for (const constraint of constraints) {
      if (constraint.type === 'where') {
        if (constraint.operator === '==') {
          params[constraint.field] = constraint.value;
        } else if (constraint.operator === '!=') {
          params[`${constraint.field}__ne`] = constraint.value;
        } else if (constraint.operator === '<') {
          params[`${constraint.field}__lt`] = constraint.value;
        } else if (constraint.operator === '<=') {
          params[`${constraint.field}__lte`] = constraint.value;
        } else if (constraint.operator === '>') {
          params[`${constraint.field}__gt`] = constraint.value;
        } else if (constraint.operator === '>=') {
          params[`${constraint.field}__gte`] = constraint.value;
        }
      } else if (constraint.type === 'orderBy') {
        params.orderBy = constraint.field;
        params.order = constraint.direction;
      } else if (constraint.type === 'limit') {
        params.limit = constraint.value;
      }
    }

    const response = await apiGet<any>(apiPath, { params });
    const docs = extractCollectionData(response, collectionName);

    return createQuerySnapshot(docs);
  } catch (err) {
    console.error(`Error fetching documents from ${collectionName}:`, err);
    return createQuerySnapshot([]);
  }
}

/**
 * Get a single document by ID
 */
export async function getDoc(docRef: any): Promise<DocumentSnapshot> {
  const collectionName = docRef._collectionName;
  const docId = docRef._docId;

  if (collectionName === 'system' && docId === 'connection_test') {
    return createDocumentSnapshot({ id: docId, status: 'ok' }, docId);
  }

  const apiPath = `${getApiPath(collectionName)}/${docId}`;

  try {
    const response = await apiGet<any>(apiPath);
    const data = extractDocumentData(response, collectionName);
    return createDocumentSnapshot(data, docId);
  } catch (err) {
    console.error(`Error fetching document ${docId}:`, err);
    return createDocumentSnapshot(undefined, docId);
  }
}

/**
 * Add a new document to collection
 */
export async function addDoc(collectionRef: any, data: any): Promise<any> {
  const collectionName = collectionRef._collectionName || collectionRef._path?.segments?.[0];
  const apiPath = getApiPath(collectionName);

  try {
    const response = await apiPost<any>(apiPath, data);
    const responseData = extractDocumentData(response, collectionName);
    const newId =
      response.id ||
      response.uid ||
      response.data?.id ||
      response.document?.id ||
      documentId(responseData);
    return {
      id: newId,
      _docId: newId,
      _collectionName: collectionName,
    };
  } catch (err) {
    console.error(`Error adding document to ${collectionName}:`, err);
    throw err;
  }
}

/**
 * Update a document
 */
export async function updateDoc(docRef: any, data: any): Promise<void> {
  const collectionName = docRef._collectionName;
  const docId = docRef._docId;
  const apiPath = `${getApiPath(collectionName)}/${docId}`;

  try {
    const resolvedData = await resolveFieldTransforms(docRef, data);
    await apiPut<any>(apiPath, resolvedData);
  } catch (err) {
    console.error(`Error updating document ${docId}:`, err);
    throw err;
  }
}

/**
 * Set a document (create or overwrite)
 */
export async function setDoc(docRef: any, data: any, options?: { merge?: boolean }): Promise<void> {
  const collectionName = docRef._collectionName;
  const docId = docRef._docId;
  const apiPath = `${getApiPath(collectionName)}/${docId}`;

  try {
    const resolvedData = await resolveFieldTransforms(docRef, data);
    if (options?.merge) {
      await apiPut<any>(apiPath, resolvedData);
    } else {
      await apiPost<any>(getApiPath(collectionName), { ...resolvedData, id: docId });
    }
  } catch (err) {
    console.error(`Error setting document ${docId}:`, err);
    throw err;
  }
}

/**
 * Delete a document
 */
export async function deleteDoc(docRef: any): Promise<void> {
  const collectionName = docRef._collectionName;
  const docId = docRef._docId;
  const apiPath = `${getApiPath(collectionName)}/${docId}`;

  try {
    await apiDelete<any>(apiPath);
  } catch (err) {
    console.error(`Error deleting document ${docId}:`, err);
    throw err;
  }
}

/**
 * Run a transaction (simplified - just sequential operations)
 */
export async function runTransaction(
  db: any,
  callback: (transaction: any) => Promise<any>
): Promise<any> {
  const transaction = {
    get: getDoc,
    set: setDoc,
    update: updateDoc,
    delete: deleteDoc,
  };
  return callback(transaction);
}

/**
 * Batch write operations
 */
export function writeBatch(db: any): any {
  const batch = {
    operations: [] as any[],
    set: function (docRef: any, data: any) {
      this.operations.push({ type: 'set', docRef, data });
      return this;
    },
    update: function (docRef: any, data: any) {
      this.operations.push({ type: 'update', docRef, data });
      return this;
    },
    delete: function (docRef: any) {
      this.operations.push({ type: 'delete', docRef });
      return this;
    },
    commit: async function () {
      for (const op of this.operations) {
        if (op.type === 'set') {
          await setDoc(op.docRef, op.data);
        } else if (op.type === 'update') {
          await updateDoc(op.docRef, op.data);
        } else if (op.type === 'delete') {
          await deleteDoc(op.docRef);
        }
      }
    },
  };
  return batch;
}

/**
 * Listen for real-time updates (simplified - polls instead of real subscriptions)
 */
export function onSnapshot(
  q: any,
  callback: (snapshot: any) => void,
  errorCallback?: (error: any) => void
): () => void {
  let unsubscribed = false;
  let pollTimeout: ReturnType<typeof setTimeout> | undefined;
  let refreshTimeout: ReturnType<typeof setTimeout> | undefined;
  const collectionName = q._collectionName || q._path?.segments?.[0];

  const refresh = async () => {
    if (unsubscribed) return;
    try {
      const snapshot = isDocumentReference(q) ? await getDoc(q) : await getDocs(q);
      if (!unsubscribed) {
        callback(snapshot);
      }
    } catch (err) {
      if (!unsubscribed && errorCallback) {
        errorCallback(err);
      } else {
        console.error('Error polling snapshot:', err);
      }
    }
  };

  const scheduleRefresh = () => {
    if (refreshTimeout) clearTimeout(refreshTimeout);
    refreshTimeout = setTimeout(refresh, 120);
  };

  const scheduleFallbackPoll = () => {
    if (unsubscribed) return;
    pollTimeout = setTimeout(async () => {
      await refresh();
      scheduleFallbackPoll();
    }, 30000);
  };

  refresh();
  scheduleFallbackPoll();

  const unsubscribeLiveUpdates = subscribeToLiveUpdates((event) => {
    if (event.type === 'mutation' || !event.collection || event.collection === collectionName) {
      scheduleRefresh();
    }
  });

  return () => {
    unsubscribed = true;
    if (pollTimeout) clearTimeout(pollTimeout);
    if (refreshTimeout) clearTimeout(refreshTimeout);
    unsubscribeLiveUpdates();
  };
}

/**
 * Increment a field value
 */
export function increment(value: number): any {
  return { __increment: value };
}

/**
 * Server timestamp (returns current date)
 */
export function serverTimestamp(): Date {
  return new Date();
}

/**
 * Timestamp constructor
 */
export function Timestamp(seconds: number, nanoseconds: number = 0): Date {
  return new Date(seconds * 1000 + nanoseconds / 1000000);
}

/**
 * Firestore.Timestamp methods
 */
Timestamp.now = () => new Date();
Timestamp.fromDate = (date: Date) => date;
Timestamp.fromMillis = (millis: number) => new Date(millis);

export default {
  collection,
  doc,
  where,
  orderBy,
  limit,
  query,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  setDoc,
  deleteDoc,
  runTransaction,
  writeBatch,
  onSnapshot,
  increment,
  serverTimestamp,
  Timestamp,
};
