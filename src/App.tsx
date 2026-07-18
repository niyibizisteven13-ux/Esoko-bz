import { useEffect, useState } from 'react';
import React, { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { getAuthToken as getApiAuthToken } from './services/apiClient';
import { getAuthToken as getLegacyAuthToken } from './mobileLogicCode';
import LandingPage from './pages/LandingPage';

const CustomerDashboard = lazy(() => import('./pages/CustomerDashboard'));
const TraderDashboard = lazy(() => import('./pages/TraderDashboard'));
const AdminPortal = lazy(() => import('./pages/AdminPortal'));
const AgentPortal = lazy(() => import('./pages/AgentPortal'));

const DashboardLoading = () => <div className="flex min-h-screen items-center justify-center bg-[#0B141A] text-sm text-white">Loading Makasi…</div>;

function getStoredRole(): string | null {
  if (typeof window === 'undefined') return null;

  try {
    const raw = window.localStorage.getItem('auth_user');
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.role || null;
  } catch {
    return null;
  }
}

function getEffectiveAuthToken(): string | null {
  return getApiAuthToken() || getLegacyAuthToken();
}

function getRoleRedirect(role: string | null): string {
  switch (role) {
    case 'admin':
      return '/admin';
    case 'trader':
      return '/trader';
    case 'agent':
      return '/agent';
    case 'customer':
      return '/customer?tab=marketplace';
    default:
      return '/login';
  }
}

export default function App() {
  const [authToken, setAuthTokenState] = useState<string | null>(() => getEffectiveAuthToken());
  const [role, setRole] = useState<string | null>(() => getStoredRole());

  useEffect(() => {
    const refreshAuthState = () => {
      setAuthTokenState(getEffectiveAuthToken());
      setRole(getStoredRole());
    };

    refreshAuthState();

    const handleStorage = (event: StorageEvent) => {
      if (event.key === 'auth_user' || event.key === 'nexus_auth_token' || event.key === 'esoko_jwt_token') {
        refreshAuthState();
      }
    };

    window.addEventListener('storage', handleStorage);
    window.addEventListener('auth:unauthorized', refreshAuthState);

    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('auth:unauthorized', refreshAuthState);
    };
  }, []);

  const redirectTo = getRoleRedirect(role);
  const marketplaceEntry = '/customer?tab=marketplace';
  const fallbackDestination = authToken ? redirectTo : marketplaceEntry;
  const showLanding = !Capacitor.isNativePlatform() && import.meta.env.VITE_ENABLE_PUBLIC_LANDING === 'true';

  return (
    <Suspense fallback={<DashboardLoading />}>
      <Routes>
        <Route path="/" element={<Navigate to={fallbackDestination} replace />} />
        <Route path="/login" element={<Navigate to={marketplaceEntry} replace />} />
        <Route path="/register" element={<Navigate to={marketplaceEntry} replace />} />
        <Route path="/customer/*" element={<CustomerDashboard />} />
        <Route path="/trader/*" element={authToken ? <TraderDashboard /> : <Navigate to={marketplaceEntry} replace />} />
        <Route path="/admin/*" element={authToken ? <AdminPortal /> : <Navigate to={marketplaceEntry} replace />} />
        <Route path="/agent/*" element={authToken ? <AgentPortal /> : <Navigate to={marketplaceEntry} replace />} />
        <Route path="/landing" element={showLanding ? <LandingPage /> : <Navigate to={marketplaceEntry} replace />} />
        <Route path="*" element={<Navigate to={fallbackDestination} replace />} />
      </Routes>
    </Suspense>
  );
}
