import React, { ErrorInfo, ReactNode } from 'react';
import {
  AlertTriangle,
  RefreshCw,
  Home,
  ChevronRight,
  Terminal,
  User,
  Shield,
  LogOut,
  Zap,
} from 'lucide-react';
import { auth } from '../firebase';
import { cn } from '../lib/utils';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  isExpanded: boolean;
}

class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      isExpanded: false,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null, isExpanded: false };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.group('🔴 Application Crash Caught by ErrorBoundary');
    console.error('Error:', error);
    console.error('Component Stack:', errorInfo.componentStack);
    console.groupEnd();

    this.setState({ error, errorInfo });
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null, isExpanded: false });
    window.location.assign(window.location.origin);
  };

  toggleExpanded = () => {
    this.setState((prev) => ({ isExpanded: !prev.isExpanded }));
  };

  render() {
    if (this.state.hasError) {
      let firestoreError = null;
      try {
        if (this.state.error?.message) {
          const parsed = JSON.parse(this.state.error.message);
          if (parsed && typeof parsed === 'object' && parsed.operationType) {
            firestoreError = parsed;
          }
        }
      } catch (e) {
        // Not a JSON error, ignore
      }

      const isQuota =
        this.state.error?.message.toLowerCase().includes('quota exceeded') ||
        (this.state.error as any)?.isQuota;

      return (
        <div className="min-h-screen flex items-center justify-center bg-neutral-50 dark:bg-neutral-950 p-4 font-sans transition-colors duration-300">
          <div className="max-w-2xl w-full bg-white dark:bg-neutral-900 rounded-[2.5rem] shadow-2xl border border-neutral-100 dark:border-neutral-800 p-8 md:p-12 text-center overflow-hidden">
            <div
              className={cn(
                'w-24 h-24 rounded-3xl flex items-center justify-center mx-auto mb-8 rotate-3 hover:rotate-0 transition-all duration-500',
                isQuota
                  ? 'bg-orange-50 dark:bg-orange-900/20 text-orange-600'
                  : 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400'
              )}
            >
              {isQuota ? <Zap size={48} className="animate-pulse" /> : <AlertTriangle size={48} />}
            </div>

            <h1 className="text-3xl md:text-4xl font-black text-neutral-900 dark:text-white mb-4 tracking-tight">
              {isQuota ? 'Network Limit Reached' : 'Something went wrong'}
            </h1>

            <p className="text-neutral-500 dark:text-neutral-400 mb-10 text-lg font-medium leading-relaxed">
              {isQuota
                ? 'Nexus has reached its regional data limit for today. Services will be restored shortly after midnight.'
                : "We encountered an unexpected error. Don't worry, your data is safe."}
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <button
                onClick={this.handleReset}
                className="py-4 bg-orange-600 text-white rounded-2xl font-bold text-lg hover:bg-orange-700 transition-all flex items-center justify-center gap-2 shadow-xl shadow-orange-200 dark:shadow-none active:scale-95"
              >
                <RefreshCw size={20} /> Reload App
              </button>
              <button
                onClick={() => {
                  auth.signOut().then(() => {
                    window.location.href = '/login';
                  });
                }}
                className="py-4 bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 rounded-2xl font-bold text-lg hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-all flex items-center justify-center gap-2 active:scale-95"
              >
                <LogOut size={20} /> Sign Out
              </button>
            </div>

            <a
              href="/"
              className="block w-full py-4 text-neutral-400 hover:text-neutral-600 dark:text-neutral-500 dark:hover:text-neutral-400 text-sm font-bold transition-all mb-10"
            >
              Back to Home Page
            </a>

            {this.state.error && (
              <div className="text-left">
                <button
                  onClick={this.toggleExpanded}
                  className="flex items-center gap-2 text-neutral-400 dark:text-neutral-500 hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors text-xs font-black uppercase tracking-widest mb-4"
                >
                  <ChevronRight
                    size={14}
                    className={
                      this.state.isExpanded
                        ? 'rotate-90 transition-transform'
                        : 'transition-transform'
                    }
                  />
                  {this.state.isExpanded ? 'Hide Technical Details' : 'Show Technical Details'}
                </button>

                {this.state.isExpanded && (
                  <div className="p-6 bg-neutral-900 dark:bg-black rounded-3xl border border-neutral-800 overflow-hidden animate-in fade-in slide-in-from-top-4 duration-300">
                    <div className="flex items-center gap-2 mb-4 text-red-400">
                      <Terminal size={16} />
                      <span className="text-[10px] font-black uppercase tracking-widest">
                        Error Console
                      </span>
                    </div>

                    <div className="space-y-4 max-h-96 overflow-auto custom-scrollbar">
                      {firestoreError ? (
                        <div className="space-y-4">
                          <div className="flex items-center gap-2 text-orange-400">
                            <Shield size={14} />
                            <p className="font-mono text-xs font-bold uppercase tracking-widest">
                              Firestore Exception
                            </p>
                          </div>

                          <div className="grid grid-cols-2 gap-4 text-[10px] font-mono">
                            <div className="space-y-1">
                              <p className="text-neutral-500 uppercase tracking-tighter">
                                Operation
                              </p>
                              <p className="text-neutral-300 font-bold">
                                {firestoreError.operationType}
                              </p>
                            </div>
                            <div className="space-y-1">
                              <p className="text-neutral-500 uppercase tracking-tighter">Path</p>
                              <p className="text-neutral-300 font-bold truncate">
                                {firestoreError.path || 'N/A'}
                              </p>
                            </div>
                          </div>

                          <div className="space-y-2">
                            <div className="flex items-center gap-2 text-neutral-500">
                              <User size={12} />
                              <p className="text-[10px] uppercase tracking-widest">Auth Context</p>
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-[9px] font-mono text-neutral-400 bg-white/5 p-3 rounded-xl">
                              <p>
                                UID:{' '}
                                <span className="text-neutral-300">
                                  {firestoreError.authInfo.userId}
                                </span>
                              </p>
                              <p>
                                Email:{' '}
                                <span className="text-neutral-300">
                                  {firestoreError.authInfo.email}
                                </span>
                              </p>
                              <p>
                                Verified:{' '}
                                <span className="text-neutral-300">
                                  {String(firestoreError.authInfo.emailVerified)}
                                </span>
                              </p>
                              <p>
                                Anon:{' '}
                                <span className="text-neutral-300">
                                  {String(firestoreError.authInfo.isAnonymous)}
                                </span>
                              </p>
                            </div>
                          </div>

                          <div className="space-y-1">
                            <p className="text-[10px] text-neutral-500 uppercase tracking-widest">
                              Error Message
                            </p>
                            <pre className="text-neutral-300 font-mono text-[10px] whitespace-pre-wrap bg-white/5 p-3 rounded-xl mt-1 border border-white/5">
                              {firestoreError.error}
                            </pre>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <p className="text-neutral-500 font-mono text-[10px] uppercase tracking-widest">
                            Stack Trace
                          </p>
                          <pre className="text-neutral-300 font-mono text-[10px] whitespace-pre-wrap bg-white/5 p-4 rounded-xl">
                            {this.state.error.stack || this.state.error.toString()}
                          </pre>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
