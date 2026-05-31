import { logoutUser, observeAuthState } from './services/sessionService';

export interface LocalAuthUser {
  id: string;
  uid?: string;
  email?: string;
  name?: string;
  role?: string;
  tier?: string;
  walletBalance?: number;
  [key: string]: any;
}

const USER_KEY = 'auth_user';

function parseStoredUser(): LocalAuthUser | null {
  if (typeof window === 'undefined') return null;
  const raw = window.localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    const user = JSON.parse(raw) as LocalAuthUser;
    return { ...user, uid: user.uid || user.id };
  } catch {
    return null;
  }
}

function getStoredToken() {
  // JWT auth is stored in an httpOnly cookie. No client-side token should be read from localStorage.
  return null;
}

export const auth = {
  get currentUser() {
    return parseStoredUser();
  },
  onAuthStateChanged(callback: (user: LocalAuthUser | null) => void) {
    return observeAuthState(callback);
  },
  async signOut() {
    await logoutUser();
  },
  async getIdToken() {
    return null;
  },
};

export const db: any = null;
export const storage: any = null;
export const serverTimestamp = () => new Date();
export const googleProvider = { providerId: 'google' };
