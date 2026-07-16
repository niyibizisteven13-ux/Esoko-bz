import { useEffect, useMemo, useState } from 'react';
import {
  clearAuthToken,
  fetchWithCache,
  getAuthToken,
  setAuthToken,
} from './mobileLogicCode';

type DeviceEnvironment = 'LAPTOP' | 'PHONE' | 'WEB';
type AuthState = 'AUTHENTICATED' | 'ANONYMOUS';

interface CatalogItem {
  id: string;
  name: string;
  price: string;
  stock: string;
  category: string;
}

interface HealthResponse {
  status?: string;
  systemHealth?: {
    status?: string;
  };
}

const catalogItems: CatalogItem[] = [
  { id: '1', name: 'Rice Bulk Pack', price: 'RWF 14,500', stock: '42 units', category: 'Staples' },
  { id: '2', name: 'Cooking Oil', price: 'RWF 9,800', stock: '18 units', category: 'Groceries' },
  { id: '3', name: 'Soap Bundle', price: 'RWF 3,200', stock: '67 units', category: 'Household' },
  { id: '4', name: 'Mobile Top-Up', price: 'RWF 2,500', stock: '110 units', category: 'Digital' },
];

export default function App() {
  const [deviceMode, setDeviceMode] = useState<DeviceEnvironment>('WEB');
  const [authState, setAuthState] = useState<AuthState>('ANONYMOUS');
  const [statusMessage, setStatusMessage] = useState('Awaiting sync');
  const [selectedProduct, setSelectedProduct] = useState<CatalogItem | null>(catalogItems[0]);
  const [transactionState, setTransactionState] = useState('Ready for scan');

  const authToken = useMemo(() => getAuthToken(), [authState]);

  useEffect(() => {
    const bridgeWindow = window as any;
    const detectedMode: DeviceEnvironment = bridgeWindow.__TAURI_METADATA__
      ? 'LAPTOP'
      : /android|iphone|ipad|ipod/i.test(navigator.userAgent)
        ? 'PHONE'
        : 'WEB';

    setDeviceMode(detectedMode);
  }, []);

  useEffect(() => {
    const bridgeWindow = window as any;

    const registerPlatformBridge = async (): Promise<void> => {
      if (deviceMode === 'LAPTOP') {
        try {
          const tauriCore = await import('@tauri-apps/api/core');
          const invoke = tauriCore.invoke as
            | ((command: string, args?: Record<string, unknown>) => Promise<unknown>)
            | undefined;

          if (typeof invoke === 'function') {
            await invoke('execute_desktop_task', { task: 'boot' });
            setStatusMessage('Desktop bridge connected');
          }
        } catch {
          setStatusMessage('Desktop bridge unavailable, using browser fallback');
        }
      } else if (deviceMode === 'PHONE') {
        try {
          const mobileBridge = bridgeWindow.EsokoNativeBridge;
          if (mobileBridge?.register) {
            await mobileBridge.register();
            setStatusMessage('Mobile bridge connected');
          }
        } catch {
          setStatusMessage('Mobile bridge unavailable, using browser fallback');
        }
      } else {
        setStatusMessage('Browser mode active');
      }
    };

    void registerPlatformBridge();
  }, [deviceMode]);

  const handleSync = async (): Promise<void> => {
    try {
      const health = await fetchWithCache<HealthResponse>('/api/health');
      const backendStatus = health?.systemHealth?.status ?? health?.status ?? 'operational';
      setStatusMessage(`Synced with backend • ${backendStatus}`);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Sync failed';
      setStatusMessage(`Offline fallback • ${message}`);
    }
  };

  const handleLogin = (): void => {
    setAuthToken('demo-jwt-token');
    setAuthState('AUTHENTICATED');
    setStatusMessage('Authenticated locally');
  };

  const handleLogout = (): void => {
    clearAuthToken();
    setAuthState('ANONYMOUS');
    setStatusMessage('Signed out');
  };

  const handleCheckout = (): void => {
    if (selectedProduct) {
      setTransactionState(`Checkout ready for ${selectedProduct.name}`);
    }
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(249,115,22,0.18),_transparent_40%),#020617] text-slate-100">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 p-4 sm:p-6 lg:p-8">
        <header className="rounded-[28px] border border-white/10 bg-white/10 p-4 shadow-2xl shadow-black/30 backdrop-blur-xl">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="mb-2 inline-flex items-center rounded-full border border-orange-500/30 bg-orange-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.25em] text-orange-300">
                System status • {deviceMode}
              </div>
              <h1 className="text-2xl font-black tracking-tight sm:text-3xl">Esoko Nexus Client</h1>
              <p className="mt-1 text-sm text-slate-400">
                Cross-platform commerce experience for desktop, Android, and iOS.
              </p>
            </div>

            <button
              onClick={() => {
                void handleSync();
              }}
              className="rounded-2xl bg-orange-600 px-5 py-3 text-sm font-semibold text-white transition duration-200 hover:-translate-y-1 hover:bg-orange-500"
            >
              Sync Now
            </button>
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-slate-950/50 p-3">
            <div className="text-sm text-slate-300">
              Auth status:{' '}
              <span className="font-semibold text-white">
                {authState === 'AUTHENTICATED' ? 'Authenticated' : 'Anonymous'}
              </span>
            </div>
            <div className="text-sm text-slate-300">
              Sync state:{' '}
              <span className="font-semibold text-orange-300">{statusMessage}</span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleLogin}
                className="rounded-xl border border-orange-500/30 bg-orange-500/10 px-3 py-2 text-sm font-semibold text-orange-200"
              >
                Sign In
              </button>
              <button
                onClick={handleLogout}
                className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-semibold text-slate-300"
              >
                Sign Out
              </button>
            </div>
          </div>
        </header>

        <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-[28px] border border-white/10 bg-slate-900/70 p-4 shadow-2xl shadow-black/20">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.25em] text-slate-400">B2B catalog</p>
                <h2 className="text-xl font-bold text-white">Product grid</h2>
              </div>
              <div className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-300">
                Checkout ready
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {catalogItems.map((item: CatalogItem) => (
                <button
                  key={item.id}
                  onClick={() => setSelectedProduct(item)}
                  className={`rounded-2xl border p-4 text-left transition duration-200 ${
                    selectedProduct?.id === item.id
                      ? 'border-orange-500 bg-orange-500/10'
                      : 'border-white/10 bg-white/5 hover:border-orange-400/40'
                  }`}
                >
                  <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.25em] text-slate-400">
                    {item.category}
                  </div>
                  <div className="text-lg font-semibold text-white">{item.name}</div>
                  <div className="mt-2 text-sm text-orange-300">{item.price}</div>
                  <div className="mt-1 text-sm text-slate-400">{item.stock}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-[28px] border border-white/10 bg-slate-900/70 p-4 shadow-2xl shadow-black/20">
            <div className="mb-4">
              <p className="text-sm font-semibold uppercase tracking-[0.25em] text-slate-400">Transaction panel</p>
              <h2 className="text-xl font-bold text-white">Secure merchant payment</h2>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <div className="text-sm text-slate-400">Selected item</div>
              <div className="mt-1 text-lg font-semibold text-white">
                {selectedProduct?.name ?? 'No item selected'}
              </div>
              <div className="mt-2 text-sm text-orange-300">{selectedProduct?.price ?? 'RWF 0'}</div>
              <div className="mt-4 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-3 text-sm text-emerald-300">
                {transactionState}
              </div>
              <button
                onClick={handleCheckout}
                className="mt-4 w-full rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition duration-200 hover:bg-emerald-500"
              >
                Process checkout
              </button>
            </div>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-[28px] border border-white/10 bg-slate-900/70 p-4 shadow-2xl shadow-black/20">
            <div className="mb-4">
              <p className="text-sm font-semibold uppercase tracking-[0.25em] text-slate-400">Barcode / camera frame</p>
              <h2 className="text-xl font-bold text-white">Scanning simulation</h2>
            </div>

            <div className="flex h-64 items-center justify-center rounded-3xl border border-dashed border-orange-500/40 bg-gradient-to-br from-slate-950 via-slate-900 to-orange-950">
              <div className="flex flex-col items-center gap-3 text-center">
                <div className="h-24 w-24 rounded-2xl border-2 border-orange-500/50"></div>
                <p className="text-sm text-slate-400">Camera frame ready for barcode or QR scanning</p>
              </div>
            </div>
          </div>

          <div className="rounded-[28px] border border-white/10 bg-slate-900/70 p-4 shadow-2xl shadow-black/20">
            <div className="mb-4">
              <p className="text-sm font-semibold uppercase tracking-[0.25em] text-slate-400">Device bridge</p>
              <h2 className="text-xl font-bold text-white">Native hooks</h2>
            </div>

            <div className="space-y-3 text-sm text-slate-300">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                <div className="font-semibold text-white">Environment</div>
                <div className="mt-1 text-slate-400">{deviceMode}</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                <div className="font-semibold text-white">Token</div>
                <div className="mt-1 break-all text-slate-400">{authToken ? authToken : 'No token stored'}</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                <div className="font-semibold text-white">Runtime note</div>
                <div className="mt-1 text-slate-400">
                  Desktop uses Tauri bridge commands, mobile uses Capacitor hooks, browser falls back safely.
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
