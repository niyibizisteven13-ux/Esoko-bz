import React, { useState } from 'react';
import {
  Package,
  Upload,
  Download,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  FileText,
  QrCode,
  Loader2,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { collection, addDoc, writeBatch, doc } from '../../services/firestoreBridge';
const db = undefined; // Used by firestoreBridge
import { formatCurrency } from '../../lib/utils';

export default function TraderSupply({
  traderId,
  traderName,
  traderTin,
  products,
}: {
  traderId: string;
  traderName: string;
  traderTin: string;
  products: any[];
}) {
  const [isBulkMode, setIsBulkMode] = useState(false);
  const [bulkProducts, setBulkProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Simulate CSV parsing
    const reader = new FileReader();
    reader.onload = (event) => {
      // In a real app, we'd use a CSV parser like PapaParse
      // For now, we'll just mock some data
      const mockBulkData = [
        { name: 'Bulk Item 1', price: 1000, stock: 50, category: 'General' },
        { name: 'Bulk Item 2', price: 2500, stock: 30, category: 'Electronics' },
        { name: 'Bulk Item 3', price: 500, stock: 100, category: 'Food' },
      ];
      setBulkProducts(mockBulkData);
    };
    reader.readAsText(file);
  };

  const handleBulkAdd = async () => {
    setLoading(true);
    try {
      const batch = writeBatch(db);
      bulkProducts.forEach((product) => {
        const newDocRef = doc(collection(db, 'products'));
        batch.set(newDocRef, {
          ...product,
          traderId,
          traderName,
          traderTin,
          createdAt: new Date().toISOString(),
          qrCode: `esoko-prod-${newDocRef.id}`,
        });
      });
      await batch.commit();
      setSuccess(true);
      setBulkProducts([]);
      setTimeout(() => setSuccess(false), 3000);
    } catch (error) {
      console.error('Bulk add error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-neutral-900 flex items-center gap-2">
            <Package className="text-orange-600" size={28} /> Supply & Inventory
          </h2>
          <p className="text-neutral-500">Manage bulk uploads and batch operations</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white p-6 rounded-3xl border border-neutral-100 shadow-sm">
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
              <Upload className="text-blue-600" size={20} /> Bulk Upload
            </h3>
            <p className="text-sm text-neutral-500 mb-6">
              Upload a CSV file to add multiple products at once. Download our template to get
              started.
            </p>
            <div className="space-y-3">
              <button className="w-full py-3 bg-neutral-50 text-neutral-600 rounded-xl font-bold text-sm border border-neutral-200 hover:bg-neutral-100 transition-all flex items-center justify-center gap-2">
                <Download size={18} /> Download Template
              </button>
              <label className="w-full py-4 bg-orange-600 text-white rounded-xl font-bold text-sm hover:bg-orange-700 transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-orange-100">
                <Upload size={18} /> Choose CSV File
                <input type="file" accept=".csv" onChange={handleFileUpload} className="hidden" />
              </label>
            </div>
          </div>

          <div className="bg-white p-6 rounded-3xl border border-neutral-100 shadow-sm">
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
              <QrCode className="text-purple-600" size={20} /> Batch QR Generation
            </h3>
            <p className="text-sm text-neutral-500 mb-6">
              Generate and download QR codes for all your products in one click.
            </p>
            <button className="w-full py-4 bg-neutral-900 text-white rounded-xl font-bold text-sm hover:bg-black transition-all flex items-center justify-center gap-2">
              <QrCode size={18} /> Generate All QRs
            </button>
          </div>
        </div>

        <div className="lg:col-span-2">
          <div className="bg-white rounded-[2.5rem] border border-neutral-100 shadow-sm overflow-hidden">
            <div className="p-8 border-b border-neutral-100 flex justify-between items-center bg-neutral-50/50">
              <h3 className="text-xl font-bold text-neutral-900">Bulk Preview</h3>
              {bulkProducts.length > 0 && (
                <button
                  onClick={handleBulkAdd}
                  disabled={loading}
                  className="px-6 py-2 bg-green-600 text-white rounded-xl font-bold text-sm hover:bg-green-700 transition-all flex items-center gap-2"
                >
                  {loading ? (
                    <Loader2 className="animate-spin" size={18} />
                  ) : (
                    <>
                      <Plus size={18} /> Add {bulkProducts.length} Products
                    </>
                  )}
                </button>
              )}
            </div>

            <div className="p-8">
              {bulkProducts.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="text-left border-b border-neutral-100">
                        <th className="pb-4 text-xs font-black text-neutral-400 uppercase tracking-widest">
                          Product
                        </th>
                        <th className="pb-4 text-xs font-black text-neutral-400 uppercase tracking-widest">
                          Price
                        </th>
                        <th className="pb-4 text-xs font-black text-neutral-400 uppercase tracking-widest">
                          Stock
                        </th>
                        <th className="pb-4 text-xs font-black text-neutral-400 uppercase tracking-widest">
                          Category
                        </th>
                        <th className="pb-4 text-xs font-black text-neutral-400 uppercase tracking-widest">
                          Action
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-50">
                      {bulkProducts.map((p, i) => (
                        <tr key={i} className="group hover:bg-neutral-50/50 transition-colors">
                          <td className="py-4 font-bold text-neutral-900">{p.name}</td>
                          <td className="py-4 font-bold text-neutral-600">
                            RWF {formatCurrency(p.price)}
                          </td>
                          <td className="py-4 font-bold text-neutral-600">{p.stock}</td>
                          <td className="py-4">
                            <span className="px-3 py-1 bg-neutral-100 text-neutral-600 rounded-full text-[10px] font-black uppercase tracking-widest">
                              {p.category}
                            </span>
                          </td>
                          <td className="py-4">
                            <button
                              onClick={() =>
                                setBulkProducts((prev) => prev.filter((_, idx) => idx !== i))
                              }
                              className="p-2 text-neutral-300 hover:text-red-600 transition-colors"
                            >
                              <Trash2 size={18} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-20 space-y-4">
                  <div className="w-20 h-20 bg-neutral-50 rounded-full flex items-center justify-center mx-auto">
                    <FileText className="text-neutral-200" size={40} />
                  </div>
                  <p className="text-neutral-400 font-medium max-w-xs mx-auto">
                    No products to preview. Upload a CSV file to see your products here.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {success && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-8 right-8 bg-green-600 text-white px-8 py-4 rounded-2xl shadow-2xl flex items-center gap-3 z-50"
          >
            <CheckCircle2 size={24} />
            <span className="font-bold">Bulk products added successfully!</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
