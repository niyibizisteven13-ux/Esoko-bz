import { useEffect, useState, lazy, Suspense } from 'react';
import type { ComponentType } from 'react';
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  Link,
  useNavigate,
} from 'react-router-dom';
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Bell,
  LogOut,
  ShieldCheck,
  Menu,
  X,
  User,
  Loader2,
  Zap,
  RefreshCw,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from './lib/utils';
import { isAccountVerified } from './lib/verification';
const RealTimeSyncProvider = lazy(async () => {
  const module = await import('./context/RealTimeSyncContext');
  return { default: module.RealTimeSyncProvider };
});
import { LanguageProvider, useLanguage } from './context/LanguageContext';
import { ThemeProvider } from './context/ThemeContext';
import { NotificationProvider, useNotifications } from './context/NotificationContext';
import ThemeToggle from './components/ThemeToggle';

// Local auth service
import { observeAuthState, logoutUser } from './services/sessionService';
import { getUser } from './services/userService';

// Pages (lazy-loaded for code splitting)
const LandingPage = lazy(() => import('./pages/LandingPage'));
const LoginPage = lazy(() => import('./pages/LoginPage'));
const RegisterPage = lazy(() => import('./pages/RegisterPage'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'));
const ResetPassword = lazy(() => import('./pages/ResetPassword'));
const CustomerDashboard = lazy(() => import('./pages/CustomerDashboard'));
const TraderDashboard = lazy(() => import('./pages/TraderDashboard'));
const TeamMemberDashboard = lazy(() => import('./pages/TeamMemberDashboard'));
const ManagerDashboard = lazy(() => import('./pages/ManagerDashboard'));
const AgentPortal = lazy(() => import('./pages/AgentPortal'));
const AdminPortal = lazy(() => import('./pages/AdminPortal'));
const OnboardingPage = lazy(() => import('./pages/OnboardingPage'));
const FeatureStore = lazy(() => import('./pages/FeatureStore'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const NotificationsPage = lazy(() => import('./pages/NotificationsPage'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));
const TermsOfService = lazy(() => import('./pages/TermsOfService'));
const PrivacyPolicy = lazy(() => import('./pages/PrivacyPolicy'));
const AcceptableUsePolicy = lazy(() => import('./pages/AcceptableUsePolicy'));
const VerifyEmail = lazy(() => import('./pages/VerifyEmail'));
const VerificationPage = lazy(() => import('./pages/VerificationPage'));
const TeamInvitePage = lazy(() => import('./pages/TeamInvitePage'));
const AccessChoicePage = lazy(() => import('./pages/AccessChoicePage'));

import Logo from './components/Logo';
import PermissionModal from './components/PermissionModal';
import ErrorBoundary from './components/ErrorBoundary';

function Logout() {
  useEffect(() => {
    logoutUser().then(() => {
      window.location.href = '/';
    });
  }, []);
  return (
    <div className="flex items-center justify-center min-h-screen bg-neutral-50">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-orange-600"></div>
    </div>
  );
}

function AppContent() {
  const [user, setUser] = useState<any>(null);
  const [userData, setUserData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showRetry, setShowRetry] = useState(false);
  const { notifications, unreadCount } = useNotifications();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { language, setLanguage, t } = useLanguage();
  const navigate = useNavigate();

  useEffect(() => {
    const unsub = observeAuthState(async (localUser) => {
      setUser(localUser);

      if (localUser) {
        // Immediately set userData from local storage so routing works immediately
        setUserData(localUser);

        // Then fetch fresh data from server
        try {
          const response = await getUser(localUser.id);
          const freshUser: any = {
            ...(response?.user || localUser),
            activeAccount: localUser.activeAccount || response?.user?.activeAccount,
            accountModes: response?.user?.accountModes || localUser.accountModes || [],
            activeTeamContext: localUser.activeTeamContext || response?.user?.activeTeamContext,
            teamAccessOptions: localUser.teamAccessOptions || response?.user?.teamAccessOptions || [],
          };
          if (freshUser.status === 'suspended') {
            await logoutUser();
            setLoading(false);
            window.location.href = '/login';
            return;
          }
          setUserData(freshUser);
        } catch (err: any) {
          console.error('Failed to fetch fresh user data:', err);
          if (String(err).includes('403') || String(err).includes('Account suspended')) {
            await logoutUser();
            setLoading(false);
            window.location.href = '/login';
            return;
          }
          // Keep the local user data if API call fails for a non-auth reason
        }
      } else {
        setUserData(null);
      }

      setLoading(false);
    });

    // Fallback timeout so loading never hangs forever
    const timeout = setTimeout(() => {
      setLoading(false);
      setShowRetry(true);
    }, 8000);

    return () => {
      unsub();
      clearTimeout(timeout);
    };
  }, []);

  const handleLogout = async () => {
    await logoutUser();
    window.location.href = '/';
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-[#050505] flex flex-col items-center justify-center z-[1000]">
        <div className="relative">
          <motion.div
            animate={{ scale: [1, 1.2, 1], opacity: [0.1, 0.2, 0.1] }}
            transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
            className="absolute inset-0 bg-orange-600 rounded-full blur-[60px] -z-10"
          />
          <div className="flex flex-col items-center gap-8 text-center p-8">
            <div className="relative">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 2.5, repeat: Infinity, ease: 'linear' }}
                className="w-24 h-24 border-2 border-white/5 border-t-orange-600 rounded-full"
              />
              <div className="absolute inset-0 flex items-center justify-center">
                <Logo dark className="scale-75 translate-x-1" />
              </div>
            </div>
            <div className="space-y-2">
              <h2 className="text-xl font-black text-white tracking-[0.2em] uppercase">
                Initializing Nexus
              </h2>
              <div className="flex items-center justify-center gap-1">
                {[0, 1, 2].map((i) => (
                  <motion.div
                    key={i}
                    animate={{ scale: [1, 1.5, 1], opacity: [0.3, 1, 0.3] }}
                    transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }}
                    className="w-1 h-1 bg-orange-600 rounded-full"
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (showRetry && !userData && user) {
    return (
      <div className="fixed inset-0 bg-[#050505] flex flex-col items-center justify-center z-[1000] p-6 text-center">
        <div className="max-w-md space-y-6">
          <div className="w-20 h-20 bg-orange-600/10 text-orange-600 rounded-[2rem] flex items-center justify-center mx-auto border border-orange-600/20">
            <ShieldCheck size={40} />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-black text-white tracking-tight uppercase">
              Connection Timeout
            </h1>
            <p className="text-neutral-500 text-sm font-medium">
              We're having trouble syncing your account data. This might be due to a slow connection
              or a temporary server issue.
            </p>
          </div>
          <div className="flex flex-col gap-3">
            <button
              onClick={() => window.location.reload()}
              className="w-full py-4 bg-orange-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] shadow-xl shadow-orange-900/20 active:scale-95 transition-all"
            >
              Retry Connection
            </button>
            <button
              onClick={handleLogout}
              className="w-full py-4 bg-white/5 text-neutral-400 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] hover:text-white transition-all"
            >
              Sign Out & Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  const userRole = userData?.role || user?.role;
  const activeTeamContext = userData?.activeTeamContext || user?.activeTeamContext;
  const hasTeamAccess = Boolean(activeTeamContext?.traderId);
  const onboardingComplete = userData?.onboardingComplete ?? user?.onboardingComplete;
  const isAdmin = userRole === 'admin';
  const isSuspended = userData?.status === 'suspended';
  const isDarkDashboard = ['trader', 'customer', 'agent'].includes(userRole) || hasTeamAccess;
  const accountVerified = isAccountVerified(userData);

  return (
    <div
      className={cn(
        'min-h-screen font-sans selection:bg-orange-100 selection:text-orange-900',
        isDarkDashboard ? 'bg-[#050505] text-white' : 'bg-neutral-50 text-slate-900'
      )}
    >
      <PermissionModal />

      {user &&
        userData &&
        !isSuspended &&
        !['trader', 'customer', 'agent', 'admin'].includes(userRole) &&
        !window.location.pathname.startsWith('/admin') &&
        !window.location.pathname.startsWith('/agent') && (
          <nav className="bg-white/80 backdrop-blur-xl border-b border-neutral-100 sticky top-0 z-50">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex justify-between h-16">
                <div className="flex items-center gap-6">
                  <Link to="/" className="hover:opacity-80 transition-opacity">
                    <Logo className="scale-90 origin-left" />
                  </Link>

                  <div className="hidden md:flex items-center gap-2">
                    {userRole === 'customer' && (
                      <>
                        <NavLink
                          to="/customer"
                          icon={<LayoutDashboard size={18} />}
                          label={t.common.dashboard}
                        />
                        <NavLink
                          to="/customer/purchases"
                          icon={<ShoppingCart size={18} />}
                          label={t.common.purchases}
                        />
                        <NavLink to="/profile" icon={<User size={18} />} label="Profile" />
                        <NavLink
                          to="/settings"
                          icon={<ShieldCheck size={18} />}
                          label={t.common.settings}
                        />
                      </>
                    )}
                    {userRole === 'manager' && (
                      <NavLink
                        to="/manager"
                        icon={<ShieldCheck size={18} />}
                        label="Manager Panel"
                      />
                    )}
                    {userRole === 'agent' && (
                      <NavLink to="/agent" icon={<ShieldCheck size={18} />} label="Agent Portal" />
                    )}
                    {isAdmin && (
                      <NavLink to="/admin" icon={<ShieldCheck size={18} />} label="Admin Portal" />
                    )}
                  </div>
                </div>

                <div className="hidden md:flex items-center gap-3">
                  <ThemeToggle />
                  <div className="flex items-center gap-2 mr-2">
                    <select
                      value={language}
                      onChange={(e) => setLanguage(e.target.value as any)}
                      className="text-[10px] font-black uppercase tracking-widest border-none rounded-lg px-2 py-1.5 bg-neutral-100 hover:bg-neutral-200 transition-colors focus:outline-none cursor-pointer"
                    >
                      <option value="en">EN</option>
                      <option value="rw">KN</option>
                      <option value="fr">FR</option>
                    </select>
                  </div>

                  <Link
                    to="/notifications"
                    className="p-2.5 text-neutral-500 hover:bg-neutral-100 rounded-xl relative transition-all"
                  >
                    <Bell size={20} />
                    {(unreadCount ?? 0) > 0 && (
                      <span className="absolute top-2 right-2 w-2 h-2 bg-orange-600 rounded-full border-2 border-white"></span>
                    )}
                  </Link>

                  {userData && (
                    <div className="flex items-center gap-3 pl-3 border-l border-neutral-100">
                      <div className="text-right hidden sm:block">
                        <div className="flex items-center justify-end gap-2">
                          <p className="text-xs font-bold text-slate-900 leading-none mb-1">
                            {userData.name || userData.phone || 'User'}
                          </p>
                          {accountVerified && (
                            <span
                              className={cn(
                                'inline-flex items-center justify-center w-4 h-4 rounded-full border border-white/80',
                                userData.role === 'customer'
                                  ? 'bg-gradient-to-r from-blue-500 to-orange-500'
                                  : 'bg-blue-600'
                              )}
                            >
                              <ShieldCheck size={10} className="text-white" />
                            </span>
                          )}
                        </div>
                        <p className="text-[9px] font-black text-orange-600 uppercase tracking-[0.15em] leading-none">
                          ID: {userData.appNumber || 'N/A'}
                        </p>
                      </div>
                      <div
                        className="w-9 h-9 bg-neutral-100 rounded-xl overflow-hidden border border-neutral-200 flex items-center justify-center cursor-pointer hover:border-orange-500 transition-all"
                        onClick={() => navigate('/profile')}
                      >
                        {userData.photoURL ? (
                          <img
                            src={userData.photoURL}
                            alt="avatar"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <User size={18} className="text-neutral-400" />
                        )}
                      </div>
                      <button
                        onClick={handleLogout}
                        className="p-2.5 text-neutral-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
                      >
                        <LogOut size={18} />
                      </button>
                    </div>
                  )}
                </div>

                {/* Mobile Menu Button */}
                <div className="flex md:hidden items-center gap-2">
                  <Link to="/notifications" className="p-2 text-neutral-600 relative">
                    <Bell size={20} />
                    {(unreadCount ?? 0) > 0 && (
                      <span className="absolute top-1 right-1 bg-orange-600 text-white text-[9px] font-bold px-1 rounded-full">
                        {unreadCount}
                      </span>
                    )}
                  </Link>
                  <button
                    onClick={() => setIsMenuOpen(!isMenuOpen)}
                    className="p-2 text-neutral-600"
                  >
                    {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
                  </button>
                </div>
              </div>
            </div>

            {/* Mobile Nav */}
            <AnimatePresence>
              {isMenuOpen && userData && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="md:hidden bg-white border-t border-neutral-100 overflow-hidden"
                >
                  <div className="px-4 pt-2 pb-6 space-y-1">
                    {userRole === 'customer' && (
                      <>
                        <MobileNavLink
                          to="/customer"
                          label="Dashboard"
                          onClick={() => setIsMenuOpen(false)}
                        />
                        <MobileNavLink
                          to="/customer/purchases"
                          label="My Purchases"
                          onClick={() => setIsMenuOpen(false)}
                        />
                        <MobileNavLink
                          to="/profile"
                          label="Profile"
                          onClick={() => setIsMenuOpen(false)}
                        />
                        <MobileNavLink
                          to="/settings"
                          label={t.common.settings}
                          onClick={() => setIsMenuOpen(false)}
                        />
                      </>
                    )}
                    {isAdmin && (
                      <MobileNavLink
                        to="/admin"
                        label="Admin Portal"
                        onClick={() => setIsMenuOpen(false)}
                      />
                    )}
                    <button
                      onClick={handleLogout}
                      className="w-full text-left block px-3 py-2 rounded-md text-base font-medium text-red-600 hover:bg-red-50"
                    >
                      Logout
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </nav>
        )}

      <main
        className={cn(
          user &&
            !['trader', 'customer', 'agent', 'admin'].includes(userRole) &&
            !window.location.pathname.startsWith('/admin') &&
            !window.location.pathname.startsWith('/agent')
            ? 'max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8'
            : 'min-h-screen overflow-hidden'
        )}
      >
        <Suspense
          fallback={
            <div className="flex items-center justify-center min-h-screen">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-orange-600"></div>
            </div>
          }
        >
          <Routes>
            <Route path="/" element={<LandingPage />} />

            <Route path="/login" element={<LoginPage />} />

            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />

            <Route path="/verify-email" element={<VerifyEmail />} />
            <Route
              path="/verify-account"
              element={user && !isSuspended ? <VerificationPage /> : <Navigate to="/login" />}
            />
            <Route path="/team-invite" element={<TeamInvitePage />} />
            <Route
              path="/access-choice"
              element={user && !isSuspended ? <AccessChoicePage /> : <Navigate to="/login" />}
            />

            <Route
              path="/register"
              element={
                !user ? (
                  <RegisterPage />
                ) : userData ? (
                  userRole === 'unregistered' ? (
                    <RegisterPage />
                  ) : !userData.onboardingComplete ? (
                    <Navigate to="/onboarding" />
                  ) : (
                    <Navigate to={`/${userRole}`} />
                  )
                ) : (
                  <Navigate to="/" />
                )
              }
            />

            <Route
              path="/onboarding"
              element={user && !isSuspended ? <OnboardingPage /> : <Navigate to="/login" />}
            />
            <Route
              path="/features"
              element={user && !isSuspended ? <FeatureStore /> : <Navigate to="/login" />}
            />

            <Route
              path="/customer/*"
              element={
                user && !isSuspended && (userRole === 'customer' || userRole === 'trader') ? (
                  onboardingComplete === false ? (
                    <Navigate to="/onboarding" />
                  ) : (
                    <CustomerDashboard />
                  )
                ) : userRole === 'unregistered' ? (
                  <Navigate to="/register" />
                ) : (
                  <Navigate to="/login" />
                )
              }
            />

            <Route
              path="/trader/*"
              element={
                user && !isSuspended && (userRole === 'trader' || hasTeamAccess) ? (
                  onboardingComplete === false ? (
                    <Navigate to="/onboarding" />
                  ) : (
                    <TraderDashboard />
                  )
                ) : userRole === 'unregistered' ? (
                  <Navigate to="/register" />
                ) : (
                  <Navigate to="/login" />
                )
              }
            />

            <Route
              path="/admin"
              element={user && !isSuspended && isAdmin ? <AdminPortal /> : <Navigate to="/login" />}
            />
            <Route
              path="/admin/*"
              element={user && !isSuspended && isAdmin ? <AdminPortal /> : <Navigate to="/login" />}
            />

            <Route
              path="/agent"
              element={
                user && !isSuspended && (userRole === 'agent' || isAdmin) ? (
                  <AgentPortal />
                ) : (
                  <Navigate to="/login" />
                )
              }
            />
            <Route
              path="/agent/*"
              element={
                user && !isSuspended && (userRole === 'agent' || isAdmin) ? (
                  <AgentPortal />
                ) : (
                  <Navigate to="/login" />
                )
              }
            />

            <Route path="/team-member/:memberId" element={<TeamMemberDashboard />} />

            <Route
              path="/manager/*"
              element={
                user && !isSuspended && userRole === 'manager' ? (
                  <ManagerDashboard />
                ) : userRole === 'unregistered' ? (
                  <Navigate to="/register" />
                ) : (
                  <Navigate to="/login" />
                )
              }
            />

            <Route
              path="/settings"
              element={user && !isSuspended ? <SettingsPage /> : <Navigate to="/login" />}
            />
            <Route
              path="/notifications"
              element={user && !isSuspended ? <NotificationsPage /> : <Navigate to="/login" />}
            />
            <Route
              path="/profile"
              element={user && !isSuspended ? <ProfilePage /> : <Navigate to="/login" />}
            />

            <Route path="/terms" element={<TermsOfService />} />
            <Route path="/privacy" element={<PrivacyPolicy />} />
            <Route path="/restrictions" element={<AcceptableUsePolicy />} />

            <Route path="/logout" element={<Logout />} />
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </Suspense>
      </main>
    </div>
  );
}

function NavLink({ to, icon, label }: { to: string; icon: React.ReactNode; label: string }) {
  return (
    <Link
      to={to}
      className="flex items-center gap-2 px-5 py-2.5 rounded-lg font-bold transition-all text-sm text-neutral-500 hover:text-orange-600 hover:bg-white hover:shadow-sm"
    >
      {icon} {label}
    </Link>
  );
}

function MobileNavLink({ to, label, onClick }: { to: string; label: string; onClick: () => void }) {
  return (
    <Link
      to={to}
      onClick={onClick}
      className="block px-3 py-2 rounded-md text-base font-medium text-neutral-700 hover:bg-neutral-50"
    >
      {label}
    </Link>
  );
}

export default function App() {
  return (
    <Router>
      <ErrorBoundary>
        <LanguageProvider>
          <ThemeProvider>
            <NotificationProvider>
              <Suspense fallback={null}>
                <RealTimeSyncProvider>
                  <AppContent />
                </RealTimeSyncProvider>
              </Suspense>
            </NotificationProvider>
          </ThemeProvider>
        </LanguageProvider>
      </ErrorBoundary>
    </Router>
  );
}
