import { apiGet, apiPost } from './apiClient';

const AUTH_USER_KEY = 'auth_user';
const authListeners = new Set<(user: any) => void>();

function readStoredUser() {
  const userData = localStorage.getItem(AUTH_USER_KEY);
  if (!userData) return null;
  try {
    const user = JSON.parse(userData);
    return { ...user, uid: user.uid || user.id };
  } catch {
    return null;
  }
}

export function hasStoredAuthUser() {
  if (typeof window === 'undefined') return false;
  return Boolean(localStorage.getItem(AUTH_USER_KEY));
}

function writeStoredUser(user: any) {
  if (user) {
    const safeUser = {
      id: user.id,
      uid: user.uid || user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      tier: user.tier,
      onboardingComplete: user.onboardingComplete,
      verificationStatus: user.verificationStatus,
      emailVerified: user.emailVerified,
      appNumber: user.appNumber,
      status: user.status,
      activeAccount: user.activeAccount || null,
      accountModes: user.accountModes || [],
      activeTeamContext: user.activeTeamContext || null,
      teamAccessOptions: user.teamAccessOptions || [],
    };
    localStorage.setItem(AUTH_USER_KEY, JSON.stringify(safeUser));
  } else {
    localStorage.removeItem(AUTH_USER_KEY);
  }
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
      return null;
    }
    if (
      message.includes('403') ||
      message.includes('Unauthorized') ||
      message.includes('suspended')
    ) {
      console.debug('Auth refresh rejected:', message);
      writeStoredUser(null);
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
}

export function observeAuthState(callback: (user: any) => void) {
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
  return fetchUserFromServer();
}

export async function getIdToken() {
  return null;
}

export function setupRecaptchaVerifier() {
  return null;
}
