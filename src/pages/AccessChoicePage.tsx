import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, ShieldCheck, ShoppingBag, Store, User } from 'lucide-react';
import { getAccessOptions, selectAccess } from '../services/teamService';
import { updateStoredAuthUser } from '../services/sessionService';

export default function AccessChoicePage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState('');
  const [options, setOptions] = useState<any>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    getAccessOptions()
      .then((response) => setOptions(response))
      .catch((err) => setError(err.message || 'Could not load access options.'))
      .finally(() => setLoading(false));
  }, []);

  const choose = async (mode: 'own' | 'account' | 'team', id?: string) => {
    setSubmitting(mode === 'own' ? 'own' : id || mode);
    setError('');
    try {
      const response = await selectAccess(
        mode === 'team' ? { mode, membershipId: id } : { mode, accountId: id }
      );
      if (response.user) updateStoredAuthUser(response.user);
      navigate(response.redirectTo || '/', { replace: true });
    } catch (err: any) {
      setError(err.message || 'Could not select access.');
    } finally {
      setSubmitting('');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center text-white">
        <Loader2 className="animate-spin text-orange-600" size={34} />
      </div>
    );
  }

  const teamOptions = options?.teamAccessOptions || [];
  const accountModes = options?.accountModes || [];
  const own = options?.ownAccount;

  return (
    <div className="min-h-screen bg-[#050505] text-white flex items-center justify-center p-6">
      <div className="w-full max-w-4xl">
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-black tracking-tight">Choose Access</h1>
          <p className="text-neutral-500 font-medium">
            Choose the account mode you want to use for this session.
          </p>
        </div>

        {error && (
          <div className="mb-6 rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm font-bold text-red-400">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {accountModes.length > 0 ? (
            accountModes.map((account: any) => (
              <button
                key={account.id}
                onClick={() => choose('account', account.id)}
                disabled={Boolean(submitting)}
                className="rounded-[2rem] bg-white text-neutral-950 p-7 text-left border-2 border-white hover:border-orange-500 transition-all"
              >
                <div className="w-12 h-12 rounded-2xl bg-neutral-100 text-neutral-700 flex items-center justify-center mb-5">
                  {account.role === 'trader' ? <Store size={24} /> : <ShoppingBag size={24} />}
                </div>
                <h2 className="text-2xl font-black mb-2">
                  {account.role === 'trader' ? 'Trader Account' : 'Customer Account'}
                </h2>
                <p className="text-sm font-bold text-neutral-500 mb-6">
                  {account.role === 'trader'
                    ? account.businessName || 'Sell products and manage your shop.'
                    : `Shop and pay as ${own?.name || own?.email || 'your customer profile'}.`}
                </p>
                <span className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-widest text-orange-600">
                  {submitting === account.id ? (
                    <Loader2 className="animate-spin" size={16} />
                  ) : (
                    <ShieldCheck size={16} />
                  )}
                  Continue
                </span>
              </button>
            ))
          ) : (
            <button
              onClick={() => choose('own')}
              disabled={Boolean(submitting)}
              className="rounded-[2rem] bg-white text-neutral-950 p-7 text-left border-2 border-white hover:border-orange-500 transition-all"
            >
              <div className="w-12 h-12 rounded-2xl bg-neutral-100 text-neutral-700 flex items-center justify-center mb-5">
                <User size={24} />
              </div>
              <h2 className="text-2xl font-black mb-2">My Own Account</h2>
              <p className="text-sm font-bold text-neutral-500 mb-6">
                Continue as {own?.name || own?.email || 'your personal account'}.
              </p>
              <span className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-widest text-orange-600">
                {submitting === 'own' ? <Loader2 className="animate-spin" size={16} /> : <ShieldCheck size={16} />}
                Continue
              </span>
            </button>
          )}
          {teamOptions.map((team: any) => (
            <button
              key={team.id}
              onClick={() => choose('team', team.id)}
              disabled={Boolean(submitting)}
              className="rounded-[2rem] bg-white text-neutral-950 p-7 text-left border-2 border-white hover:border-orange-500 transition-all"
            >
              <div className="w-12 h-12 rounded-2xl bg-orange-100 text-orange-600 flex items-center justify-center mb-5">
                <Store size={24} />
              </div>
              <h2 className="text-2xl font-black mb-2">
                {team.trader?.businessName || team.trader?.name}
              </h2>
              <p className="text-sm font-bold text-neutral-500 mb-4">
                Work as {team.role} {team.branch?.name ? `at ${team.branch.name}` : ''}
              </p>
              <div className="flex flex-wrap gap-2 mb-6">
                {(team.permissions || []).slice(0, 4).map((permission: string) => (
                  <span
                    key={permission}
                    className="px-2 py-1 rounded-lg bg-neutral-100 text-[10px] font-black uppercase tracking-widest text-neutral-500"
                  >
                    {permission}
                  </span>
                ))}
              </div>
              <span className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-widest text-orange-600">
                {submitting === team.id ? <Loader2 className="animate-spin" size={16} /> : <ShieldCheck size={16} />}
                Open Shop Dashboard
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
