import React, { useEffect, useState } from 'react';
import { Check, Loader2, Star, X } from 'lucide-react';
import { getTransactionRating, submitTransactionRating } from '../../services/postService';

type TransactionRatingPromptProps = {
  transaction: any;
  onClose: () => void;
  onSubmitted?: () => void;
};

const tags = [
  ['as_described', 'As described'],
  ['good_quality', 'Good quality'],
  ['fast_delivery', 'Fast delivery'],
];

export default function TransactionRatingPrompt({ transaction, onClose, onSubmitted }: TransactionRatingPromptProps) {
  const [stars, setStars] = useState(5);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [alreadyRated, setAlreadyRated] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    getTransactionRating(transaction.id)
      .then((response) => {
        if (!cancelled) setAlreadyRated(Boolean(response.rating));
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [transaction.id]);

  const submit = async () => {
    setSaving(true);
    setError('');
    try {
      await submitTransactionRating({ transactionId: transaction.id, stars, tags: selectedTags, comment });
      onSubmitted?.();
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Unable to save your rating.');
    } finally {
      setSaving(false);
    }
  };

  if (loading || alreadyRated) return null;

  return (
    <div className="fixed inset-0 z-[140] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md space-y-5 rounded-[2rem] border border-white/10 bg-[#101010] p-6 text-white shadow-2xl">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.25em] text-orange-400">Verified purchase</p>
            <h2 className="mt-1 text-2xl font-black">How was your order?</h2>
            <p className="mt-2 text-xs text-white/50">Your rating helps customers find reliable traders.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-xl p-2 text-white/50 hover:bg-white/10 hover:text-white"><X size={18} /></button>
        </div>
        <div className="flex justify-center gap-2">
          {[1, 2, 3, 4, 5].map((value) => (
            <button key={value} type="button" onClick={() => setStars(value)} aria-label={`${value} stars`} className="p-1 text-amber-400">
              <Star size={30} fill={value <= stars ? 'currentColor' : 'none'} />
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {tags.map(([value, label]) => {
            const selected = selectedTags.includes(value);
            return <button key={value} type="button" onClick={() => setSelectedTags((current) => selected ? current.filter((item) => item !== value) : [...current, value])} className={`rounded-full border px-3 py-2 text-[10px] font-black ${selected ? 'border-orange-500 bg-orange-600 text-black' : 'border-white/10 bg-white/5 text-white/60'}`}>{label}</button>;
          })}
        </div>
        <textarea value={comment} onChange={(event) => setComment(event.target.value)} rows={3} placeholder="Add an optional comment" className="w-full resize-none rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-sm outline-none placeholder:text-white/30" />
        {error && <p className="text-xs font-bold text-red-300">{error}</p>}
        <button type="button" onClick={() => void submit()} disabled={saving} className="flex w-full items-center justify-center gap-2 rounded-xl bg-orange-600 px-4 py-3 text-sm font-black text-black disabled:opacity-50">
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
          {saving ? 'Saving...' : 'Submit verified rating'}
        </button>
      </div>
    </div>
  );
}
