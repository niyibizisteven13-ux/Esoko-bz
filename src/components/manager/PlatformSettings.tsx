import React, { useState } from 'react';
import {
  ShieldCheck,
  Save,
  Loader2,
  Percent,
  Lock,
  AlertTriangle,
  RefreshCw,
  Database,
  Megaphone,
  Send,
} from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { useNotifications } from '../../context/NotificationContext';
import { cn } from '../../lib/utils';
import { doc, updateDoc, collection, getDocs } from '../../services/firestoreBridge';
const db = undefined; // Used by firestoreBridge

interface PlatformSettingsProps {
  config: any;
}

export default function PlatformSettings({ config }: PlatformSettingsProps) {
  const { t } = useLanguage();
  const { sendNotification } = useNotifications();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [sendingBroadcast, setSendingBroadcast] = useState(false);
  const [broadcastType, setBroadcastType] = useState<'info' | 'warning' | 'success'>('info');

  const handleBroadcast = async () => {
    if (!broadcastMessage.trim()) return;
    setSendingBroadcast(true);
    try {
      const usersSnap = await getDocs(collection(db, 'users'));
      const batchSize = 50;
      const users = usersSnap.docs;

      for (let i = 0; i < users.length; i += batchSize) {
        const chunk = users.slice(i, i + batchSize);
        await Promise.all(
          chunk.map((userDoc: any) =>
            sendNotification(userDoc.id, broadcastMessage, broadcastType, 'promo')
          )
        );
      }

      setBroadcastMessage('');
      alert('Broadcast sent successfully to ' + users.length + ' users.');
    } catch (err) {
      console.error('Broadcast failed:', err);
      alert('Failed to send broadcast.');
    } finally {
      setSendingBroadcast(false);
    }
  };
  const [formData, setFormData] = useState({
    freeTierFee: config?.globalFees?.free || 0.6,
    premiumTierFee: config?.globalFees?.premium || 0.3,
    maintenanceMode: config?.maintenanceMode || false,
    autoRraReporting: config?.autoRraReporting || false,
    maxWithdrawalLimit: config?.limits?.maxWithdrawal || 1000000,
    minWithdrawalLimit: config?.limits?.minWithdrawal || 500,
  });

  const handleSave = async () => {
    setLoading(true);
    setSuccess(false);
    try {
      await updateDoc(doc(db, 'platform', 'config'), {
        globalFees: {
          free: Number(formData.freeTierFee),
          premium: Number(formData.premiumTierFee),
        },
        maintenanceMode: formData.maintenanceMode,
        autoRraReporting: formData.autoRraReporting,
        limits: {
          maxWithdrawal: Number(formData.maxWithdrawalLimit),
          minWithdrawal: Number(formData.minWithdrawalLimit),
        },
        updatedAt: new Date().toISOString(),
      });
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      console.error('Failed to update platform config:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-black text-neutral-900 uppercase tracking-tighter">
            Platform Configuration
          </h2>
          <p className="text-neutral-500 font-medium">
            Manage global settings, fees, and system behavior.
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={loading}
          className="flex items-center gap-2 px-8 py-3 bg-orange-600 text-white rounded-xl font-black text-xs uppercase tracking-widest hover:bg-orange-700 transition-all shadow-lg shadow-orange-600/20 disabled:opacity-50"
        >
          {loading ? (
            <Loader2 className="animate-spin" size={16} />
          ) : (
            <>
              <Save size={16} /> {success ? 'Settings Saved!' : 'Save Changes'}
            </>
          )}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Financial Settings */}
        <div className="bg-white p-8 rounded-[2.5rem] border border-neutral-100 shadow-sm space-y-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-orange-50 text-orange-600 rounded-xl flex items-center justify-center">
              <Percent size={20} />
            </div>
            <h3 className="text-lg font-bold text-neutral-900">Transaction Fees</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-neutral-400 uppercase tracking-widest ml-1">
                Free Tier Fee (%)
              </label>
              <input
                type="number"
                step="0.1"
                value={formData.freeTierFee}
                onChange={(e) => setFormData({ ...formData, freeTierFee: e.target.value })}
                className="w-full p-4 bg-neutral-50 border border-neutral-100 rounded-2xl outline-none focus:ring-2 focus:ring-orange-500 font-bold text-neutral-900"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-neutral-400 uppercase tracking-widest ml-1">
                Premium Tier Fee (%)
              </label>
              <input
                type="number"
                step="0.1"
                value={formData.premiumTierFee}
                onChange={(e) => setFormData({ ...formData, premiumTierFee: e.target.value })}
                className="w-full p-4 bg-neutral-50 border border-neutral-100 rounded-2xl outline-none focus:ring-2 focus:ring-orange-500 font-bold text-neutral-900"
              />
            </div>
          </div>

          <div className="pt-4 space-y-4">
            <h4 className="text-xs font-black text-neutral-400 uppercase tracking-widest">
              Withdrawal Limits (RWF)
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-neutral-400 uppercase tracking-widest ml-1">
                  Minimum
                </label>
                <input
                  type="number"
                  value={formData.minWithdrawalLimit}
                  onChange={(e) => setFormData({ ...formData, minWithdrawalLimit: e.target.value })}
                  className="w-full p-4 bg-neutral-50 border border-neutral-100 rounded-2xl outline-none focus:ring-2 focus:ring-orange-500 font-bold text-neutral-900"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-neutral-400 uppercase tracking-widest ml-1">
                  Maximum
                </label>
                <input
                  type="number"
                  value={formData.maxWithdrawalLimit}
                  onChange={(e) => setFormData({ ...formData, maxWithdrawalLimit: e.target.value })}
                  className="w-full p-4 bg-neutral-50 border border-neutral-100 rounded-2xl outline-none focus:ring-2 focus:ring-orange-500 font-bold text-neutral-900"
                />
              </div>
            </div>
          </div>
        </div>

        {/* System & Security */}
        <div className="bg-white p-8 rounded-[2.5rem] border border-neutral-100 shadow-sm space-y-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center">
              <Lock size={20} />
            </div>
            <h3 className="text-lg font-bold text-neutral-900">System Controls</h3>
          </div>

          <div className="space-y-4">
            <div
              className={cn(
                'p-6 rounded-3xl border transition-all',
                formData.maintenanceMode
                  ? 'bg-red-50 border-red-100'
                  : 'bg-neutral-50 border-neutral-100'
              )}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div
                    className={cn(
                      'w-10 h-10 rounded-xl flex items-center justify-center shadow-sm',
                      formData.maintenanceMode
                        ? 'bg-white text-red-600'
                        : 'bg-white text-neutral-400'
                    )}
                  >
                    <AlertTriangle size={20} />
                  </div>
                  <div>
                    <p className="font-bold text-neutral-900">Maintenance Mode</p>
                    <p className="text-xs text-neutral-500">
                      Disable all platform transactions and features.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() =>
                    setFormData({ ...formData, maintenanceMode: !formData.maintenanceMode })
                  }
                  className={cn(
                    'w-12 h-6 rounded-full relative transition-colors',
                    formData.maintenanceMode ? 'bg-red-600' : 'bg-neutral-300'
                  )}
                >
                  <div
                    className={cn(
                      'absolute top-1 w-4 h-4 bg-white rounded-full transition-all',
                      formData.maintenanceMode ? 'right-1' : 'left-1'
                    )}
                  ></div>
                </button>
              </div>
            </div>

            <div className="p-6 bg-neutral-50 rounded-3xl border border-neutral-100">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-orange-600 shadow-sm">
                    <RefreshCw size={20} />
                  </div>
                  <div>
                    <p className="font-bold text-neutral-900">Auto RRA Reporting</p>
                    <p className="text-xs text-neutral-500">
                      Sync transaction data with tax authorities.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() =>
                    setFormData({ ...formData, autoRraReporting: !formData.autoRraReporting })
                  }
                  className={cn(
                    'w-12 h-6 rounded-full relative transition-colors',
                    formData.autoRraReporting ? 'bg-orange-600' : 'bg-neutral-300'
                  )}
                >
                  <div
                    className={cn(
                      'absolute top-1 w-4 h-4 bg-white rounded-full transition-all',
                      formData.autoRraReporting ? 'right-1' : 'left-1'
                    )}
                  ></div>
                </button>
              </div>
            </div>

            <div className="p-6 bg-neutral-50 rounded-3xl border border-neutral-100">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-blue-600 shadow-sm">
                    <Database size={20} />
                  </div>
                  <div>
                    <p className="font-bold text-neutral-900">Automatic Backups</p>
                    <p className="text-xs text-neutral-500">
                      Daily snapshots of all platform data.
                    </p>
                  </div>
                </div>
                <div className="px-3 py-1 bg-blue-100 text-blue-600 rounded-full text-[10px] font-black uppercase tracking-widest">
                  Enabled
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* System Broadcast */}
      <div className="bg-white p-8 rounded-[2.5rem] border border-neutral-100 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-orange-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
        <div className="relative">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 bg-orange-600 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-orange-600/20">
              <Megaphone size={24} />
            </div>
            <div>
              <h3 className="text-xl font-black text-neutral-900 uppercase tracking-tighter">
                System Broadcast
              </h3>
              <p className="text-sm text-neutral-500 font-medium">
                Send a real-time notification to all users on the platform.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-4">
              <textarea
                value={broadcastMessage}
                onChange={(e) => setBroadcastMessage(e.target.value)}
                placeholder="Type your announcement here..."
                className="w-full h-32 p-6 bg-neutral-50 border border-neutral-100 rounded-[2rem] outline-none focus:ring-2 focus:ring-orange-500 font-medium text-neutral-900 resize-none transition-all"
              />
              <div className="flex flex-wrap gap-4">
                {(['info', 'warning', 'success'] as const).map((type) => (
                  <button
                    key={type}
                    onClick={() => setBroadcastType(type)}
                    className={cn(
                      'px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all',
                      broadcastType === type
                        ? 'bg-slate-900 text-white shadow-lg shadow-slate-900/20'
                        : 'bg-neutral-100 text-neutral-500 hover:bg-neutral-200'
                    )}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex flex-col justify-end gap-4">
              <div className="p-6 bg-orange-50 rounded-3xl border border-orange-100">
                <p className="text-[10px] font-black text-orange-600 uppercase tracking-[0.2em] mb-2 leading-none">
                  Security Note
                </p>
                <p className="text-xs text-orange-900/70 font-medium leading-relaxed">
                  Broadcasts are immutable and sent instantly. Please verify content before sending.
                </p>
              </div>
              <button
                onClick={handleBroadcast}
                disabled={sendingBroadcast || !broadcastMessage.trim()}
                className="w-full h-16 bg-orange-600 text-white rounded-[1.5rem] font-black text-sm uppercase tracking-[0.2em] flex items-center justify-center gap-3 hover:bg-orange-700 transition-all shadow-xl shadow-orange-600/20 disabled:opacity-50 group"
              >
                {sendingBroadcast ? (
                  <Loader2 className="animate-spin" size={20} />
                ) : (
                  <>
                    <Send
                      size={20}
                      className="group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform"
                    />
                    Send Broadcast
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Danger Zone */}
      <div className="bg-red-50 p-8 rounded-[2.5rem] border border-red-100">
        <h3 className="text-lg font-bold text-red-900 mb-4 flex items-center gap-2">
          <ShieldCheck size={20} /> Critical Platform Actions
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button className="p-4 bg-white border border-red-100 rounded-2xl text-xs font-black text-red-600 uppercase tracking-widest hover:bg-red-600 hover:text-white transition-all">
            Freeze All Wallets
          </button>
          <button className="p-4 bg-white border border-red-100 rounded-2xl text-xs font-black text-red-600 uppercase tracking-widest hover:bg-red-600 hover:text-white transition-all">
            Export Audit Logs
          </button>
          <button className="p-4 bg-white border border-red-100 rounded-2xl text-xs font-black text-red-600 uppercase tracking-widest hover:bg-red-600 hover:text-white transition-all">
            Reset API Keys
          </button>
        </div>
      </div>
    </div>
  );
}
