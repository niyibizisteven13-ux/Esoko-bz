import React, { useState, useEffect } from 'react';
import {
  Gift,
  Plus,
  Star,
  TrendingUp,
  Users,
  Settings,
  Trash2,
  Edit2,
  CheckCircle2,
  XCircle,
  Loader2,
  ChevronRight,
  Info,
  Zap,
  Award,
  Percent,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  collection,
  query,
  where,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
} from '../../services/firestoreBridge';
const db = undefined; // Used by firestoreBridge
import { handleFirestoreError, OperationType } from '../../lib/firestoreErrorHandler';
import { cn, formatCurrency } from '../../lib/utils';
import { useLanguage } from '../../context/LanguageContext';

interface IncentiveProgram {
  id: string;
  traderId: string;
  name: string;
  description: string;
  type: 'points' | 'bulk_discount' | 'tiered_loyalty';
  config: any;
  active: boolean;
  createdAt: any;
}

export default function TraderIncentives({ traderId }: { traderId: string }) {
  const { t } = useLanguage();
  const [programs, setPrograms] = useState<IncentiveProgram[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [editingProgram, setEditingProgram] = useState<IncentiveProgram | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);

  const [formData, setFormData] = useState<{
    name: string;
    description: string;
    type: 'points' | 'bulk_discount' | 'tiered_loyalty';
    config: any;
  }>({
    name: '',
    description: '',
    type: 'points',
    config: {
      pointsPerRwf: 1,
      minBulkQuantity: 5,
      bulkDiscountPercent: 10,
      tiers: [
        { name: 'Bronze', minPoints: 0, discountPercent: 0 },
        { name: 'Silver', minPoints: 1000, discountPercent: 5 },
        { name: 'Gold', minPoints: 5000, discountPercent: 10 },
      ],
    },
  });

  useEffect(() => {
    if (!traderId) return;

    const q = query(collection(db, 'incentive_programs'), where('traderId', '==', traderId));

    const unsub = onSnapshot(
      q,
      (snapshot) => {
        setPrograms(
          snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }) as IncentiveProgram)
        );
        setLoading(false);
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'incentive_programs')
    );

    return () => unsub();
  }, [traderId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);

    try {
      if (editingProgram) {
        const updateData = {
          name: formData.name,
          description: formData.description,
          type: formData.type,
          config: formData.config,
          active: true,
        };
        await updateDoc(doc(db, 'incentive_programs', editingProgram.id), updateData);
      } else {
        const programData = {
          traderId,
          name: formData.name,
          description: formData.description,
          type: formData.type,
          config: formData.config,
          active: true,
          createdAt: serverTimestamp(),
        };
        await addDoc(collection(db, 'incentive_programs'), programData);
      }

      setIsAdding(false);
      setEditingProgram(null);
      resetForm();
    } catch (error) {
      console.error(error);
    } finally {
      setFormLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      type: 'points',
      config: {
        pointsPerRwf: 1,
        minBulkQuantity: 5,
        bulkDiscountPercent: 10,
        tiers: [
          { name: 'Bronze', minPoints: 0, discountPercent: 0 },
          { name: 'Silver', minPoints: 1000, discountPercent: 5 },
          { name: 'Gold', minPoints: 5000, discountPercent: 10 },
        ],
      },
    });
  };

  const toggleStatus = async (program: IncentiveProgram) => {
    try {
      await updateDoc(doc(db, 'incentive_programs', program.id), {
        active: !program.active,
      });
    } catch (error) {
      console.error(error);
    }
  };

  const deleteProgram = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'incentive_programs', id));
      setShowDeleteConfirm(null);
    } catch (error) {
      console.error(error);
    }
  };

  if (loading)
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <Loader2 className="w-10 h-10 text-orange-600 animate-spin" />
        <p className="text-neutral-400 font-medium">Loading incentive programs...</p>
      </div>
    );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-black text-slate-900 dark:text-neutral-100">
            Incentive Programs
          </h2>
          <p className="text-neutral-500 dark:text-neutral-500 text-sm font-medium">
            Reward your loyal customers and boost sales.
          </p>
        </div>
        <button
          onClick={() => {
            resetForm();
            setIsAdding(true);
          }}
          className="flex items-center gap-2 px-4 py-2.5 bg-orange-600 text-white rounded-xl font-bold text-sm hover:bg-orange-700 transition-all shadow-sm"
        >
          <Plus size={18} /> Create Program
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Quick Stats */}
        <div className="card p-6 bg-blue-50/50 dark:bg-blue-900/10 border-blue-100 dark:border-blue-900/30">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <Star size={20} />
            </div>
            <p className="text-xs font-black text-blue-900 dark:text-blue-400 uppercase tracking-widest">
              Active Programs
            </p>
          </div>
          <h3 className="text-3xl font-black text-blue-900 dark:text-neutral-100">
            {programs.filter((p) => p.active).length}
          </h3>
        </div>

        <div className="card p-6 bg-orange-50/50 dark:bg-orange-900/10 border-orange-100 dark:border-orange-900/30">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-orange-100 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400 flex items-center justify-center">
              <TrendingUp size={20} />
            </div>
            <p className="text-xs font-black text-orange-900 dark:text-orange-400 uppercase tracking-widest">
              Points Issued
            </p>
          </div>
          <h3 className="text-3xl font-black text-orange-900 dark:text-neutral-100">--</h3>
          <p className="mt-2 text-[10px] font-bold text-orange-700/70 dark:text-orange-300/70">
            Connect loyalty ledger
          </p>
        </div>

        <div className="card p-6 bg-purple-50/50 dark:bg-purple-900/10 border-purple-100 dark:border-purple-900/30">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 flex items-center justify-center">
              <Users size={20} />
            </div>
            <p className="text-xs font-black text-purple-900 dark:text-purple-400 uppercase tracking-widest">
              Customers Enrolled
            </p>
          </div>
          <h3 className="text-3xl font-black text-purple-900 dark:text-neutral-100">--</h3>
          <p className="mt-2 text-[10px] font-bold text-purple-700/70 dark:text-purple-300/70">
            Data needed
          </p>
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="text-xs font-black text-neutral-400 dark:text-neutral-500 uppercase tracking-widest">
          Your Programs
        </h3>
        {programs.length === 0 ? (
          <div className="card py-16 text-center bg-white dark:bg-neutral-900 border-neutral-100 dark:border-neutral-800">
            <Gift className="w-16 h-16 text-neutral-200 dark:text-neutral-700 mx-auto mb-4" />
            <h4 className="text-lg font-bold text-slate-900 dark:text-neutral-100 mb-1">
              No incentive programs yet
            </h4>
            <p className="text-neutral-500 dark:text-neutral-500 text-sm max-w-xs mx-auto">
              Create your first program to start rewarding your customers and growing your business.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {programs.map((program) => (
              <motion.div
                key={program.id}
                layout
                className={cn(
                  'card p-6 flex flex-col md:flex-row md:items-center justify-between gap-6 group transition-all bg-white dark:bg-neutral-900 border-neutral-100 dark:border-neutral-800',
                  !program.active && 'opacity-60 grayscale'
                )}
              >
                <div className="flex items-center gap-4">
                  <div
                    className={cn(
                      'w-14 h-14 rounded-2xl flex items-center justify-center shrink-0',
                      program.type === 'points'
                        ? 'bg-orange-100 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400'
                        : program.type === 'bulk_discount'
                          ? 'bg-blue-100 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                          : 'bg-purple-100 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400'
                    )}
                  >
                    {program.type === 'points' ? (
                      <Star size={28} />
                    ) : program.type === 'bulk_discount' ? (
                      <Percent size={28} />
                    ) : (
                      <Award size={28} />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-black text-slate-900 dark:text-neutral-100">
                        {program.name}
                      </h4>
                      <span
                        className={cn(
                          'text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full',
                          program.active
                            ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                            : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400'
                        )}
                      >
                        {program.active ? 'Active' : 'Paused'}
                      </span>
                    </div>
                    <p className="text-sm text-neutral-500 dark:text-neutral-500 font-medium line-clamp-1">
                      {program.description}
                    </p>
                    <div className="flex items-center gap-3 mt-2">
                      <span className="text-[10px] font-black text-slate-400 dark:text-neutral-500 uppercase tracking-widest flex items-center gap-1">
                        <Zap size={12} /> {program.type.replace('_', ' ')}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => toggleStatus(program)}
                    className={cn(
                      'p-3 rounded-xl transition-all',
                      program.active
                        ? 'text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20'
                        : 'text-neutral-400 dark:text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800'
                    )}
                    title={program.active ? 'Pause Program' : 'Activate Program'}
                  >
                    {program.active ? <CheckCircle2 size={20} /> : <XCircle size={20} />}
                  </button>
                  <button
                    onClick={() => {
                      setEditingProgram(program);
                      setFormData({
                        name: program.name,
                        description: program.description,
                        type: program.type,
                        config: program.config,
                      });
                      setIsAdding(true);
                    }}
                    className="p-3 text-neutral-400 dark:text-neutral-500 hover:text-orange-600 dark:hover:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-900/20 rounded-xl transition-all"
                  >
                    <Edit2 size={20} />
                  </button>
                  <button
                    onClick={() => setShowDeleteConfirm(program.id)}
                    className="p-3 text-neutral-400 dark:text-neutral-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-all"
                  >
                    <Trash2 size={20} />
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {showDeleteConfirm && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[70] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-neutral-900 w-full max-w-sm rounded-[2rem] p-8 shadow-2xl text-center border border-neutral-100 dark:border-neutral-800"
            >
              <div className="w-16 h-16 bg-red-100 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <Trash2 size={32} />
              </div>
              <h3 className="text-xl font-black text-slate-900 dark:text-neutral-100 mb-2">
                Delete Program?
              </h3>
              <p className="text-neutral-500 dark:text-neutral-500 text-sm font-medium mb-8">
                This action cannot be undone. Customers will no longer be able to earn rewards from
                this program.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowDeleteConfirm(null)}
                  className="flex-1 py-3 bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 rounded-xl font-bold hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={() => deleteProgram(showDeleteConfirm)}
                  className="flex-1 py-3 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition-all shadow-lg shadow-red-200 dark:shadow-none"
                >
                  Delete
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Add/Edit Modal */}
      <AnimatePresence>
        {isAdding && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white dark:bg-neutral-900 w-full max-w-2xl rounded-[2.5rem] p-8 shadow-2xl my-8 border border-neutral-100 dark:border-neutral-800"
            >
              <div className="flex justify-between items-center mb-8">
                <div>
                  <h3 className="text-2xl font-black text-slate-900 dark:text-neutral-100">
                    {editingProgram ? 'Edit Program' : 'New Incentive Program'}
                  </h3>
                  <p className="text-neutral-500 dark:text-neutral-500 text-sm font-medium">
                    Configure how you want to reward your customers.
                  </p>
                </div>
                <button
                  onClick={() => {
                    setIsAdding(false);
                    setEditingProgram(null);
                  }}
                  className="p-3 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-2xl transition-all"
                >
                  <XCircle size={24} className="text-neutral-400 dark:text-neutral-500" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-black text-neutral-400 dark:text-neutral-500 uppercase tracking-widest mb-2">
                        Program Name
                      </label>
                      <input
                        type="text"
                        required
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className="w-full px-4 py-3 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-2xl focus:ring-2 focus:ring-orange-500 outline-none transition-all font-bold text-slate-900 dark:text-neutral-100"
                        placeholder="e.g. Summer Loyalty Points"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-black text-neutral-400 dark:text-neutral-500 uppercase tracking-widest mb-2">
                        Description
                      </label>
                      <textarea
                        required
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        className="w-full px-4 py-3 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-2xl focus:ring-2 focus:ring-orange-500 outline-none transition-all font-medium text-slate-900 h-24 resize-none dark:text-neutral-100"
                        placeholder="Describe how this program works..."
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-black text-neutral-400 dark:text-neutral-500 uppercase tracking-widest mb-2">
                        Program Type
                      </label>
                      <div className="grid grid-cols-1 gap-2">
                        {[
                          { id: 'points', label: 'Points Rewards', icon: <Star size={16} /> },
                          {
                            id: 'bulk_discount',
                            label: 'Bulk Discount',
                            icon: <Percent size={16} />,
                          },
                          {
                            id: 'tiered_loyalty',
                            label: 'Tiered Loyalty',
                            icon: <Award size={16} />,
                          },
                        ].map((type) => (
                          <button
                            key={type.id}
                            type="button"
                            onClick={() => setFormData({ ...formData, type: type.id as any })}
                            className={cn(
                              'flex items-center gap-3 p-4 rounded-2xl border-2 transition-all text-left',
                              formData.type === type.id
                                ? 'border-orange-600 bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400'
                                : 'border-neutral-100 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800/50 text-neutral-500 dark:text-neutral-500 hover:border-neutral-200 dark:hover:border-neutral-700'
                            )}
                          >
                            <div
                              className={cn(
                                'w-8 h-8 rounded-lg flex items-center justify-center',
                                formData.type === type.id
                                  ? 'bg-orange-600 text-white'
                                  : 'bg-neutral-200 dark:bg-neutral-700 text-neutral-400 dark:text-neutral-500'
                              )}
                            >
                              {type.icon}
                            </div>
                            <span className="font-bold text-sm">{type.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="bg-neutral-50 dark:bg-neutral-800/50 p-6 rounded-[2rem] border border-neutral-100 dark:border-neutral-800">
                    <h4 className="text-xs font-black text-slate-900 dark:text-neutral-100 uppercase tracking-widest mb-6 flex items-center gap-2">
                      <Settings size={14} className="text-orange-600 dark:text-orange-400" />{' '}
                      Configuration
                    </h4>

                    {formData.type === 'points' && (
                      <div className="space-y-4">
                        <div className="p-4 bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-100 dark:border-neutral-800">
                          <label className="block text-[10px] font-black text-neutral-400 dark:text-neutral-500 uppercase tracking-widest mb-2">
                            Points per 1,000 RWF
                          </label>
                          <div className="flex items-center gap-3">
                            <input
                              type="number"
                              value={formData.config.pointsPerRwf}
                              onChange={(e) =>
                                setFormData({
                                  ...formData,
                                  config: {
                                    ...formData.config,
                                    pointsPerRwf: Number(e.target.value),
                                  },
                                })
                              }
                              className="w-full px-4 py-2 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl outline-none font-black text-slate-900 text-center dark:text-neutral-100"
                            />
                            <span className="text-sm font-bold text-neutral-500 dark:text-neutral-400">
                              Points
                            </span>
                          </div>
                        </div>
                        <div className="flex items-start gap-3 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-2xl">
                          <Info
                            size={16}
                            className="text-blue-600 dark:text-blue-400 shrink-0 mt-0.5"
                          />
                          <p className="text-[10px] font-bold text-blue-700 dark:text-blue-300 leading-relaxed">
                            Customers will automatically earn these points on every approved
                            purchase. Points can be used for future discounts.
                          </p>
                        </div>
                      </div>
                    )}

                    {formData.type === 'bulk_discount' && (
                      <div className="space-y-4">
                        <div className="p-4 bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-100 dark:border-neutral-800">
                          <label className="block text-[10px] font-black text-neutral-400 dark:text-neutral-500 uppercase tracking-widest mb-2">
                            Rule Application
                          </label>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              className="flex-1 py-2 bg-orange-600 text-white rounded-lg text-[10px] font-black uppercase tracking-widest"
                            >
                              Global (All Products)
                            </button>
                            <button
                              type="button"
                              className="flex-1 py-2 bg-neutral-100 dark:bg-neutral-800 text-neutral-500 rounded-lg text-[10px] font-black uppercase tracking-widest opacity-50"
                            >
                              Selective
                            </button>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="p-4 bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-100 dark:border-neutral-800">
                            <label className="block text-[10px] font-black text-neutral-400 dark:text-neutral-500 uppercase tracking-widest mb-2">
                              Min Quantity
                            </label>
                            <input
                              type="number"
                              value={formData.config.minBulkQuantity}
                              onChange={(e) =>
                                setFormData({
                                  ...formData,
                                  config: {
                                    ...formData.config,
                                    minBulkQuantity: Number(e.target.value),
                                  },
                                })
                              }
                              className="w-full px-4 py-2 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl outline-none font-black text-slate-900 dark:text-neutral-100"
                            />
                          </div>
                          <div className="p-4 bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-100 dark:border-neutral-800">
                            <label className="block text-[10px] font-black text-neutral-400 dark:text-neutral-500 uppercase tracking-widest mb-2">
                              Discount %
                            </label>
                            <input
                              type="number"
                              value={formData.config.bulkDiscountPercent}
                              onChange={(e) =>
                                setFormData({
                                  ...formData,
                                  config: {
                                    ...formData.config,
                                    bulkDiscountPercent: Number(e.target.value),
                                  },
                                })
                              }
                              className="w-full px-4 py-2 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl outline-none font-black text-slate-900 dark:text-neutral-100"
                            />
                          </div>
                        </div>
                        <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-2xl flex gap-3">
                          <Zap size={16} className="text-blue-600 dark:text-blue-400 shrink-0" />
                          <p className="text-[10px] font-bold text-blue-700 dark:text-blue-300">
                            This discount triggers automatically in the cart once the quantity
                            threshold is met.
                          </p>
                        </div>
                      </div>
                    )}

                    {formData.type === 'tiered_loyalty' && (
                      <div className="space-y-3">
                        {formData.config.tiers.map((tier: any, index: number) => (
                          <div
                            key={index}
                            className="p-3 bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-100 dark:border-neutral-800 space-y-2"
                          >
                            <div className="flex justify-between items-center">
                              <span className="text-[10px] font-black text-orange-600 dark:text-orange-400 uppercase tracking-widest">
                                {tier.name} Tier
                              </span>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className="block text-[8px] font-black text-neutral-400 dark:text-neutral-500 uppercase tracking-widest mb-1">
                                  Min Points
                                </label>
                                <input
                                  type="number"
                                  value={tier.minPoints}
                                  onChange={(e) => {
                                    const newTiers = [...formData.config.tiers];
                                    newTiers[index].minPoints = Number(e.target.value);
                                    setFormData({
                                      ...formData,
                                      config: { ...formData.config, tiers: newTiers },
                                    });
                                  }}
                                  className="w-full px-2 py-1.5 bg-neutral-50 dark:bg-neutral-800 border border-neutral-100 dark:border-neutral-700 rounded-lg text-xs font-bold text-slate-900 dark:text-neutral-100"
                                />
                              </div>
                              <div>
                                <label className="block text-[8px] font-black text-neutral-400 dark:text-neutral-500 uppercase tracking-widest mb-1">
                                  Discount %
                                </label>
                                <input
                                  type="number"
                                  value={tier.discountPercent}
                                  onChange={(e) => {
                                    const newTiers = [...formData.config.tiers];
                                    newTiers[index].discountPercent = Number(e.target.value);
                                    setFormData({
                                      ...formData,
                                      config: { ...formData.config, tiers: newTiers },
                                    });
                                  }}
                                  className="w-full px-2 py-1.5 bg-neutral-50 dark:bg-neutral-800 border border-neutral-100 dark:border-neutral-700 rounded-lg text-xs font-bold text-slate-900 dark:text-neutral-100"
                                />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex gap-4 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setIsAdding(false);
                      setEditingProgram(null);
                    }}
                    className="flex-1 py-4 bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 rounded-2xl font-bold hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={formLoading}
                    className="flex-1 py-4 bg-orange-600 text-white rounded-2xl font-bold hover:bg-orange-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-orange-200 dark:shadow-none"
                  >
                    {formLoading ? (
                      <Loader2 className="animate-spin" />
                    ) : editingProgram ? (
                      'Update Program'
                    ) : (
                      'Create Program'
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
