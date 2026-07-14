import { apiGet, apiPost, setAuthToken } from './apiClient';

const AUTH_USER_KEY = 'auth_user';
const AUTH_CHANNEL_NAME = 'esoko-auth-sync';
const authListeners = new Set<(user: any) => void>();
let authChannel: BroadcastChannel | null = null;
let crossTabSyncStarted = false;

function normalizeStoredUser(user: any) {
  if (!user || typeof user !== 'object') return null;
  const id = user?.id === 'undefined' ? undefined : user?.id;
  const uid = user?.uid === 'undefined' ? undefined : user?.uid;
  const normalizedId = id || uid;
  const normalizedUid = uid || id;
  const role = user?.role || '';

  if (!normalizedId || !role) {
    return null;
  }

  return {
    ...user,
    id: normalizedId,
    uid: normalizedUid,
    role,
  };
}

function readStoredUser() {
  const userData = localStorage.getItem(AUTH_USER_KEY);
  if (!userData) return null;
  try {
    const parsed = JSON.parse(userData);
    const normalized = normalizeStoredUser(parsed);
    if (!normalized) {
      localStorage.removeItem(AUTH_USER_KEY);
      return null;
    }
    return normalized;
  } catch {
    localStorage.removeItem(AUTH_USER_KEY);
    return null;
  }
}

export function hasStoredAuthUser() {
  if (typeof window === 'undefined') return false;
  return Boolean(localStorage.getItem(AUTH_USER_KEY));
}

function getAuthChannel() {
  if (typeof window === 'undefined' || !('BroadcastChannel' in window)) return null;
  if (!authChannel) authChannel = new BroadcastChannel(AUTH_CHANNEL_NAME);
  return authChannel;
}

function startAuthCrossTabSync() {
  if (crossTabSyncStarted || typeof window === 'undefined') return;
  crossTabSyncStarted = true;

  window.addEventListener('storage', (event) => {
    if (event.key === AUTH_USER_KEY) notifyAuthListeners();
  });

  const channel = getAuthChannel();
  if (channel) {
    channel.onmessage = (event) => {
      if (event.data?.type === 'auth-user-updated') notifyAuthListeners();
    };
  }
}

function writeStoredUser(user: any) {
  if (user) {
    const normalized = normalizeStoredUser(user);
    if (!normalized) {
      localStorage.removeItem(AUTH_USER_KEY);
      getAuthChannel()?.postMessage({ type: 'auth-user-updated', userId: null });
      notifyAuthListeners();
      return;
    }

    const safeUser = {
      id: normalized.id,
      uid: normalized.uid,
      email: normalized.email,
      name: normalized.name,
      role: normalized.role,
      activeRole: normalized.activeRole || normalized.role,
      activeAccountId: normalized.activeAccountId || normalized.activeAccount?.id || null,
      businessName: normalized.businessName || null,
      walletBalance: normalized.walletBalance,
      tier: normalized.tier,
      onboardingComplete: normalized.onboardingComplete,
      verificationStatus: normalized.verificationStatus,
      emailVerified: normalized.emailVerified,
      appNumber: normalized.appNumber,
      status: normalized.status,
      activeAccount: normalized.activeAccount || null,
      accountModes: normalized.accountModes || [],
      activeTeamContext: normalized.activeTeamContext || null,
      teamAccessOptions: normalized.teamAccessOptions || [],
    };

    localStorage.setItem(AUTH_USER_KEY, JSON.stringify(safeUser));
  } else {
    localStorage.removeItem(AUTH_USER_KEY);
  }
  getAuthChannel()?.postMessage({ type: 'auth-user-updated', userId: user?.id || null });
  notifyAuthListeners();
}

export function updateStoredAuthUser(user: any) {
  writeStoredUser(user);
}

function notifyAuthListeners() {
  const user = readStoredUser();
  authListeners.forEach((callback) => callback(user));
}

async function fetchUserFromServer() {
  try {
    const response = await apiGet<{ success: boolean; user: any }>('/api/me');
    if (response?.success && response.user) {
      writeStoredUser(response.user);
      return response.user;
    }
  } catch (err: any) {
    const message = String(err);
    if (message.includes('401')) {
      writeStoredUser(null);
      setAuthToken(null);
      return null;
    }
    if (
      message.includes('403') ||
      message.includes('Unauthorized') ||
      message.includes('suspended')
    ) {
      console.debug('Auth refresh rejected:', message);
      writeStoredUser(null);
      setAuthToken(null);
      return null;
    }
    console.debug('Auth refresh error:', message);
    return null;
  }

  return null;
}

export interface AuthResponse {
  success: boolean;
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
    onboardingComplete?: boolean;
    tier?: string;
    walletBalance?: number;
    activeAccount?: any;
    accountModes?: any[];
  };
  token: string;
  redirectTo?: string;
}

export async function loginWithEmail(email: string, password: string): Promise<AuthResponse> {
  const data = await apiPost<AuthResponse>('/api/auth/login', {
    email,
    password,
  });

  if (data.user) {
    writeStoredUser(data.user);
  } else {
    notifyAuthListeners();
  }

  if (data.token) setAuthToken(data.token);

  return data;
}

export async function registerWithEmail(
  email: string,
  name: string,
  password: string,
  role: string = 'customer'
): Promise<AuthResponse> {
  const data = await apiPost<AuthResponse>('/api/auth/register', {
    email,
    name,
    password,
    role,
  });

  if (data.user) {
    writeStoredUser(data.user);
  } else {
    notifyAuthListeners();
  }

  if (data.token) setAuthToken(data.token);

  return data;
}

export async function loginWithGoogle() {
  throw new Error(
    'Google login is not configured for the local backend. Use email/password login instead.'
  );
}

export async function sendSmsOtp(_phoneNumber: string) {
  throw new Error(
    'SMS OTP is not configured for the local backend. Use email/password login instead.'
  );
}

export async function verifySmsOtp(_confirmationResult: any, _otp: string) {
  throw new Error('SMS OTP verification is not configured.');
}

export async function logoutUser() {
  try {
    await apiPost('/api/auth/logout');
  } catch (e) {
    console.debug('Logout error:', e);
  }
  writeStoredUser(null);
  setAuthToken(null);
}

export function observeAuthState(callback: (user: any) => void) {
  startAuthCrossTabSync();
  authListeners.add(callback);
  const localUser = readStoredUser();
  callback(localUser);

  if (localUser) {
    fetchUserFromServer();
  }

  return () => {
    authListeners.delete(callback);
  };
}

export async function getCurrentUser() {
  return (await fetchUserFromServer()) || readStoredUser();
}

export async function getIdToken() {
  return null;
}

export function setupRecaptchaVerifier() {
  return null;
}
