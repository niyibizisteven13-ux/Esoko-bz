import React, { useState } from 'react';
import { Loader2, Upload, X } from 'lucide-react';
import { uploadProductMedia } from '../../services/productService';
import { createMarketplacePost } from '../../services/postService';

type PostUploadModalProps = {
  traderId: string;
  products: any[];
  onClose: () => void;
  onCreated?: () => void;
};

export default function PostUploadModal({ traderId, products, onClose, onCreated }: PostUploadModalProps) {
  const [productId, setProductId] = useState(String(products[0]?.id || ''));
  const [caption, setCaption] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!file || !traderId) {
      setError('Choose an image or video before publishing.');
      return;
    }
    if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) {
      setError('Only image and video files are supported.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const selected = products.find((product) => String(product.id) === productId);
      const uploaded = await uploadProductMedia(file);
      await createMarketplacePost({
        traderId,
        productId: selected?.id,
        mediaType: file.type.startsWith('video/') ? 'video' : 'image',
        mediaUrl: uploaded.url,
        caption: caption.trim() || selected?.description || selected?.name,
        price: Number(selected?.price || 0),
        stock: Number(selected?.stock || 0),
        category: selected?.category,
      });
      onCreated?.();
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Unable to publish this post.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <form onSubmit={submit} className="w-full max-w-lg space-y-5 rounded-[2rem] border border-white/10 bg-[#101010] p-6 text-white shadow-2xl">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.25em] text-orange-400">Marketplace</p>
            <h2 className="mt-1 text-2xl font-black">Create a post</h2>
          </div>
          <button type="button" onClick={onClose} className="rounded-xl p-2 text-white/50 hover:bg-white/10 hover:text-white" aria-label="Close">
            <X size={20} />
          </button>
        </div>
        <label className="block space-y-2">
          <span className="text-[10px] font-black uppercase tracking-widest text-white/50">Product</span>
          <select value={productId} onChange={(event) => setProductId(event.target.value)} className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-sm outline-none">
            <option value="">General marketplace post</option>
            {products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}
          </select>
        </label>
        <label className="block space-y-2">
          <span className="text-[10px] font-black uppercase tracking-widest text-white/50">Photo or video</span>
          <span className="flex cursor-pointer items-center justify-center gap-3 rounded-2xl border border-dashed border-white/20 bg-white/5 px-4 py-8 text-sm font-bold text-white/70 hover:border-orange-500/60">
            <Upload size={20} className="text-orange-400" />
            {file ? file.name : 'Choose media'}
            <input type="file" accept="image/*,video/*" className="hidden" onChange={(event) => setFile(event.target.files?.[0] || null)} />
          </span>
        </label>
        <textarea value={caption} onChange={(event) => setCaption(event.target.value)} placeholder="Tell customers what makes this worth stopping for..." rows={4} className="w-full resize-none rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-sm outline-none placeholder:text-white/30" />
        {error && <p className="rounded-xl bg-red-500/10 px-3 py-2 text-xs font-bold text-red-300">{error}</p>}
        <button type="submit" disabled={saving} className="flex w-full items-center justify-center gap-2 rounded-xl bg-orange-600 px-4 py-3 text-sm font-black text-black transition hover:bg-orange-500 disabled:opacity-50">
          {saving && <Loader2 size={16} className="animate-spin" />}
          {saving ? 'Publishing...' : 'Publish to marketplace'}
        </button>
      </form>
    </div>
  );
}
