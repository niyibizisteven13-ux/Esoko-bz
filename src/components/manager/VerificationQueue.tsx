import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertCircle,
  Building2,
  CheckCircle2,
  FileText,
  Loader2,
  Mail,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import { apiGet, apiPost } from '../../services/apiClient';

export function VerificationQueue() {
  const [requests, setRequests] = useState<any[]>([]);
  const [documentsByRequest, setDocumentsByRequest] = useState<Record<string, any[]>>({});
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const loadQueue = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await apiGet<any>('/api/admin/verification-requests', {
        params: { limit: 50 },
      });
      const items = (response.requests || []).filter((item: any) =>
        ['submitted', 'pending', 'needs_review', 'rejected'].includes(
          String(item.status || '').toLowerCase()
        )
      );
      setRequests(items);

      const detailPairs = await Promise.all(
        items.map(async (item: any) => {
          try {
            const details = await apiGet<any>(`/api/admin/verification-requests/${item.id}`);
            return [item.id, details.documents || []] as const;
          } catch {
            return [item.id, []] as const;
          }
        })
      );
      setDocumentsByRequest(Object.fromEntries(detailPairs));
    } catch (err: any) {
      setError(err.message || 'Could not load verification queue.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadQueue();
  }, []);

  const decide = async (requestId: string, decision: 'approve' | 'reject') => {
    setProcessingId(requestId);
    setError('');
    try {
      const reason =
        decision === 'reject'
          ? window.prompt('Reason for rejection or more information request?') || ''
          : '';
      if (decision === 'reject' && !reason) return;
      await apiPost(`/api/admin/verification-requests/${requestId}/${decision}`, {
        reason,
      });
      await loadQueue();
    } catch (err: any) {
      setError(err.message || 'Could not update verification.');
    } finally {
      setProcessingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="animate-spin text-orange-600" size={34} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-black text-neutral-900 dark:text-white">
            Verification Queue
          </h2>
          <p className="text-neutral-500 font-medium">
            {requests.length} account proofs awaiting admin action
          </p>
        </div>
      </div>

      {error && (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm font-bold text-red-500 flex items-center gap-2">
          <AlertCircle size={18} /> {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4">
        <AnimatePresence mode="popLayout">
          {requests.map((request) => {
            const documents = documentsByRequest[request.id] || [];
            const primaryDoc = documents[0];
            const isTrader = request.role === 'trader' || request.role === 'organization';
            return (
              <motion.div
                key={request.id}
                layout
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white dark:bg-neutral-900 border border-neutral-100 dark:border-neutral-800 rounded-[2rem] p-6 shadow-sm hover:shadow-md transition-all"
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                  <div className="space-y-3 min-w-0">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-orange-50 dark:bg-orange-900/20 rounded-2xl flex items-center justify-center text-orange-600 shrink-0">
                        {isTrader ? <Building2 size={24} /> : <Mail size={24} />}
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-lg font-black text-neutral-900 dark:text-white truncate">
                          {request.businessName || request.name || 'Verification request'}
                        </h3>
                        <p className="text-xs font-bold text-neutral-400 truncate">
                          {request.email} - {request.role}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <span className="rounded-full bg-neutral-100 dark:bg-neutral-800 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-neutral-500">
                        {String(request.status || 'pending').replace(/_/g, ' ')}
                      </span>
                      <span className="rounded-full bg-orange-50 dark:bg-orange-900/20 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-orange-600">
                        Score {Math.round(Number(request.autoScore || 0))}/100
                      </span>
                    </div>
                  </div>

                  <div className="flex-1 lg:max-w-md">
                    {primaryDoc ? (
                      <a
                        href={primaryDoc.fileUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center justify-between gap-3 rounded-2xl border border-neutral-100 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800/50 p-4 hover:border-orange-500/40 transition-all"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <FileText size={20} className="text-orange-600 shrink-0" />
                          <div className="min-w-0">
                            <p className="truncate text-sm font-black text-neutral-900 dark:text-white">
                              {primaryDoc.licenseTypeId || primaryDoc.type || 'Business proof'}
                            </p>
                            <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">
                              Open uploaded document
                            </p>
                          </div>
                        </div>
                        <span className="text-xs font-black text-orange-600">Open</span>
                      </a>
                    ) : (
                      <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4 text-sm font-bold text-amber-600">
                        No document uploaded yet.
                      </div>
                    )}
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={() => decide(request.id, 'reject')}
                      disabled={processingId === request.id}
                      className="flex-1 lg:flex-none px-6 py-3 bg-red-50 text-red-600 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-red-100 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {processingId === request.id ? <Loader2 className="animate-spin" size={16} /> : <><XCircle size={16} /> Reject</>}
                    </button>
                    <button
                      onClick={() => decide(request.id, 'approve')}
                      disabled={processingId === request.id || documents.length === 0}
                      className="flex-1 lg:flex-none px-6 py-3 bg-orange-600 text-white rounded-xl font-black text-xs uppercase tracking-widest hover:bg-orange-700 transition-all shadow-lg shadow-orange-600/20 flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {processingId === request.id ? <Loader2 className="animate-spin" size={16} /> : <><ShieldCheck size={16} /> Approve</>}
                    </button>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>

        {requests.length === 0 && (
          <div className="text-center py-24 bg-white dark:bg-neutral-900 rounded-[3rem] border border-neutral-100 dark:border-neutral-800">
            <div className="w-20 h-20 bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 rounded-[2rem] flex items-center justify-center mx-auto mb-6">
              <CheckCircle2 size={40} />
            </div>
            <h3 className="text-xl font-black text-neutral-900 dark:text-white mb-2">
              No Pending Verifications
            </h3>
            <p className="text-neutral-500 font-medium">All submitted account proofs have been processed.</p>
          </div>
        )}
      </div>
    </div>
  );
}
