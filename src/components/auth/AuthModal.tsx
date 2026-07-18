import React, { FormEvent, useEffect, useState } from 'react';
import { Loader2, LogIn, UserPlus, X } from 'lucide-react';

export type AuthRole = 'customer' | 'trader';

type AuthModalProps = {
  isOpen: boolean;
  onClose: () => void;
  initialRole?: AuthRole;
  initialReason?: string;
  onSignIn: (email: string, password: string, role: AuthRole) => Promise<void>;
  onSignUp: (input: { email: string; password: string; name: string; role: AuthRole }) => Promise<void>;
};

export default function AuthModal({
  isOpen,
  onClose,
  initialRole = 'customer',
  initialReason,
  onSignIn,
  onSignUp,
}: AuthModalProps) {
  const [mode, setMode] = useState<'sign-in' | 'sign-up'>('sign-in');
  const [role, setRole] = useState<AuthRole>(initialRole);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setMode('sign-in');
    setRole(initialRole);
    setError('');
  }, [initialRole, isOpen]);

  if (!isOpen) return null;

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      if (mode === 'sign-in') {
        await onSignIn(email.trim(), password, role);
      } else {
        await onSignUp({ email: email.trim(), password, name: name.trim(), role });
      }
    } catch (submitError: any) {
      setError(submitError?.message || 'We could not complete that request. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[160] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Account access">
      <div className="w-full max-w-md rounded-[2rem] border border-white/10 bg-[#101010] p-6 text-white shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.25em] text-orange-400">Makasi account</p>
            <h2 className="mt-1 text-2xl font-black">{mode === 'sign-in' ? 'Continue to your account' : 'Create your account'}</h2>
            {initialReason && <p className="mt-2 text-sm text-white/55">{initialReason}</p>}
          </div>
          <button type="button" onClick={onClose} className="rounded-xl p-2 text-white/50 hover:bg-white/10 hover:text-white" aria-label="Close"><X size={18} /></button>
        </div>

        <form onSubmit={submit} className="mt-6 space-y-4">
          {mode === 'sign-up' && (
            <label className="block text-xs font-bold text-white/70">Name
              <input required value={name} onChange={(event) => setName(event.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-sm outline-none focus:border-orange-500" />
            </label>
          )}
          <label className="block text-xs font-bold text-white/70">Email
            <input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-sm outline-none focus:border-orange-500" />
          </label>
          <label className="block text-xs font-bold text-white/70">Password
            <input required minLength={6} type="password" value={password} onChange={(event) => setPassword(event.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-sm outline-none focus:border-orange-500" />
          </label>
          {mode === 'sign-up' && (
            <div className="grid grid-cols-2 gap-2">
              {(['customer', 'trader'] as AuthRole[]).map((option) => (
                <button key={option} type="button" onClick={() => setRole(option)} className={`rounded-xl border px-3 py-3 text-xs font-black capitalize ${role === option ? 'border-orange-500 bg-orange-600 text-black' : 'border-white/10 bg-white/5 text-white/60'}`}>
                  {option}
                </button>
              ))}
            </div>
          )}
          {error && <p className="text-sm font-semibold text-red-300">{error}</p>}
          <button disabled={submitting} className="flex w-full items-center justify-center gap-2 rounded-xl bg-orange-600 px-4 py-3 text-sm font-black text-black disabled:opacity-50">
            {submitting ? <Loader2 size={17} className="animate-spin" /> : mode === 'sign-in' ? <LogIn size={17} /> : <UserPlus size={17} />}
            {submitting ? 'Please wait...' : mode === 'sign-in' ? 'Sign in' : 'Create account'}
          </button>
        </form>
        <button type="button" onClick={() => setMode((current) => current === 'sign-in' ? 'sign-up' : 'sign-in')} className="mt-5 w-full text-center text-xs font-bold text-orange-400 hover:text-orange-300">
          {mode === 'sign-in' ? 'New to Makasi? Create an account' : 'Already have an account? Sign in'}
        </button>
      </div>
    </div>
  );
}
