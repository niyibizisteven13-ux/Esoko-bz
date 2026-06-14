import React, { useEffect, useState } from 'react';
import { Plus, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { createBulkRequest, getBulkRequests } from '../../services/bulkRequestService';
import { formatCurrency, cn } from '../../lib/utils';

export default function TraderBulkRequests({ traderId }: { traderId: string }) {
  const [bulkRequests, setBulkRequests] = useState<any[]>([]);
  const [itemName, setItemName] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [location, setLocation] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const loadBulkRequests = async () => {
    try {
      const response = await getBulkRequests(traderId);
      setBulkRequests(response.bulkRequests || []);
    } catch (error) {
      console.error('Failed to load bulk requests', error);
    }
  };

  useEffect(() => {
    loadBulkRequests();
  }, [traderId]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      const response = await createBulkRequest({
        itemName,
        quantity,
        location,
        notes,
      });
      setBulkRequests((prev) => [response.bulkRequest, ...prev]);
      setItemName('');
      setQuantity(1);
      setLocation('');
      setNotes('');
    } catch (error) {
      console.error('Failed to create bulk request', error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-[#0a0a0a] border border-white/5 rounded-3xl p-6">
        <div className="flex items-center justify-between gap-4 mb-5">
          <div>
            <p className="text-white/40 uppercase text-[10px] tracking-[0.24em] font-black mb-1">
              Cooperative Demand
            </p>
            <h3 className="text-xl font-black text-white">Bulk Stock Requests</h3>
          </div>
          <div className="text-orange-500 flex items-center gap-2">
            <Plus size={18} /> Pool orders and lower costs
          </div>
        </div>

        <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2">
          <label className="space-y-2 text-sm text-white/80">
            Item name
            <input
              value={itemName}
              onChange={(e) => setItemName(e.target.value)}
              className="w-full rounded-2xl border border-white/10 bg-[#050505] p-3 text-white"
              placeholder="e.g. sugar, rice, cooking oil"
              required
            />
          </label>
          <label className="space-y-2 text-sm text-white/80">
            Quantity
            <input
              type="number"
              value={quantity}
              min={1}
              onChange={(e) => setQuantity(Number(e.target.value))}
              className="w-full rounded-2xl border border-white/10 bg-[#050505] p-3 text-white"
              required
            />
          </label>
          <label className="space-y-2 text-sm text-white/80">
            Location
            <input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="w-full rounded-2xl border border-white/10 bg-[#050505] p-3 text-white"
              placeholder="Kigali, Musanze, etc."
              required
            />
          </label>
          <label className="space-y-2 text-sm text-white/80 md:col-span-2">
            Notes
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full rounded-2xl border border-white/10 bg-[#050505] p-3 text-white min-h-[96px]"
              placeholder="Optional details for suppliers"
            />
          </label>
          <button
            type="submit"
            disabled={saving}
            className="md:col-span-2 inline-flex items-center justify-center gap-2 rounded-2xl bg-orange-600 px-5 py-3 text-white font-black transition hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? <Loader2 className="animate-spin" size={18} /> : <Plus size={18} />}
            Submit request
          </button>
        </form>
      </div>

      <div className="grid gap-4">
        {bulkRequests.length ? (
          bulkRequests.map((request) => (
            <div key={request.id} className="bg-[#0a0a0a] border border-white/5 rounded-3xl p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.24em] text-white/40 mb-2">
                    Request status: {request.status}
                  </p>
                  <h4 className="text-lg font-black text-white">{request.itemName}</h4>
                  <p className="text-sm text-white/70 mt-1">Quantity: {request.quantity}</p>
                  <p className="text-sm text-white/70">Location: {request.location}</p>
                  <p className="text-sm text-white/70 mt-2">{request.notes || 'No additional notes'}</p>
                </div>
                <div className="rounded-2xl bg-white/5 px-3 py-2 text-[10px] uppercase tracking-[0.18em] font-black text-white/70">
                  {new Date(request.createdAt).toLocaleDateString()}
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="bg-[#0a0a0a] border border-dashed border-white/10 rounded-3xl p-8 text-center text-white/50">
            No bulk requests yet. Add one to start pooling demand.
          </div>
        )}
      </div>
    </div>
  );
}
