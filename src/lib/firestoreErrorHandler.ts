import { auth } from '../firebase';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  COUNT = 'count',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string;
    email: string;
    emailVerified: boolean;
    isAnonymous: boolean;
    tenantId: string;
    providerInfo: {
      providerId: string;
      displayName: string;
      email: string;
      photoUrl: string;
    }[];
  };
}

// Safe stringify helper with circular reference detection and property extraction
export const safeStringify = (obj: any): string => {
  const cache = new Set();

  // Extract essential properties if it's a common Error or Firestore error type
  const prepare = (val: any): any => {
    if (val === null || val === undefined) return val;

    // Handle standard Error objects as they don't stringify well by default
    if (val instanceof Error) {
      return {
        name: val.name,
        message: val.message,
        stack: val.stack,
      };
    }

    return val;
  };

  try {
    return JSON.stringify(prepare(obj), (key, value) => {
      if (typeof value === 'object' && value !== null) {
        if (cache.has(value)) {
          return '[Circular]';
        }
        cache.add(value);

        // Handle common internal class names (like Y2, Ka) by checking constructor name
        const constructorName = value.constructor?.name;
        if (
          constructorName &&
          constructorName.length <= 3 &&
          constructorName !== 'Object' &&
          constructorName !== 'Array'
        ) {
          return `[Internal ${constructorName}]`;
        }
      }
      return value;
    });
  } catch (e) {
    return '[Serialization Failed]';
  }
};

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
) {
  // If user is logged out, many listeners will fail with permission error.
  // We silence these to avoid console clutter and false alarms.
  const isPermissionError =
    String(error).toLowerCase().includes('permission-denied') ||
    String(error).toLowerCase().includes('insufficient permissions');

  const isLoggedOut = !auth.currentUser;

  if (isPermissionError && isLoggedOut) {
    // Silently ignore permission errors that happen during/after logout
    return;
  }

  // Use a safer way to get the error message
  let errorMessage = 'Unknown Error';
  try {
    if (error instanceof Error) {
      errorMessage = error.message;
    } else if (typeof error === 'string') {
      errorMessage = error;
    } else {
      errorMessage = String(error);
    }
  } catch (e) {
    errorMessage = 'Error could not be stringified';
  }

  const isQuotaError = errorMessage.toLowerCase().includes('quota exceeded');
  const isOfflineError =
    errorMessage.toLowerCase().includes('could not reach cloud firestore backend') ||
    errorMessage.toLowerCase().includes('failed to connect') ||
    errorMessage.toLowerCase().includes('the client is offline');

  // Log the raw error for internal debugging
  console.log(
    `%c[Firestore Error] ${operationType.toUpperCase()} at ${path || 'unknown'}`,
    'color: #ff4444; font-weight: bold;'
  );
  console.error(`[FirestoreError Details]:`, error);

  // Clean the path to be a primitive string
  const cleanPath = path ? String(path) : null;

  const errInfo: FirestoreErrorInfo = {
    error: isQuotaError
      ? 'Firebase Quota Exceeded. The free daily read/write limit has been reached. Please try again tomorrow or contact support.'
      : isOfflineError
        ? 'Network connection issue. Nexus is having trouble reaching the database.'
        : errorMessage,
    authInfo: {
      userId: String(auth.currentUser?.uid || 'anonymous'),
      email: String(auth.currentUser?.email || 'none'),
      emailVerified: Boolean(auth.currentUser?.emailVerified),
      isAnonymous: Boolean(auth.currentUser?.isAnonymous),
      tenantId: String((auth.currentUser as any)?.tenantId || 'none'),
      providerInfo: (auth.currentUser?.providerData || []).map(
        (provider: {
          providerId?: string;
          displayName?: string;
          email?: string;
          photoURL?: string;
        }) => ({
          providerId: String(provider.providerId || 'none'),
          displayName: String(provider.displayName || 'none'),
          email: String(provider.email || 'none'),
          photoUrl: String(provider.photoURL || 'none'),
        })
      ),
    },
    operationType,
    path: cleanPath,
  };

  let safeJson = '';
  try {
    safeJson = safeStringify(errInfo);
  } catch (e) {
    console.error('Critical: Failed to stringify FirestoreErrorInfo even with safety:', e);
    // Absolute fallback
    safeJson = '{"error":"Circular Error Info","operationType":"' + operationType + '"}';
  }

  const finalError = new Error(safeJson);
  if (isQuotaError) (finalError as any).isQuota = true;
  if (isOfflineError) (finalError as any).isOffline = true;

  console.error('[FirestoreError Safe]', finalError);
  return finalError;
}
