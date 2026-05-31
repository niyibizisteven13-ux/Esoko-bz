import React, { useState, useEffect } from 'react';
import { auth } from '../firebase';
import { doc, getDoc, updateDoc } from '../services/firestoreBridge';
const db = undefined; // Used by firestoreBridge
import { motion } from 'framer-motion';
import {
  Zap,
  TrendingUp,
  Package,
  ShieldCheck,
  Smartphone,
  Truck,
  BarChart3,
  Users,
  Check,
  Plus,
  ArrowLeft,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';

interface Feature {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  category: 'sales' | 'inventory' | 'management' | 'tax_health';
}

const ALL_FEATURES: Feature[] = [
  {
    id: 'mobile_pos',
    name: 'Mobile POS',
    description: 'Process sales directly from your phone.',
    icon: <Smartphone />,
    category: 'sales',
  },
  {
    id: 'analytics_pro',
    name: 'Advanced Analytics',
    description: 'Deep insights into your sales trends.',
    icon: <BarChart3 />,
    category: 'sales',
  },
  {
    id: 'inventory_advanced',
    name: 'Smart Inventory',
    description: 'Auto-stock alerts and predictive ordering.',
    icon: <Package />,
    category: 'inventory',
  },
  {
    id: 'supply_chain',
    name: 'Supply Chain Tracker',
    description: 'Track goods from supplier to shop.',
    icon: <Truck />,
    category: 'inventory',
  },
  {
    id: 'team_management',
    name: 'Team Workspace',
    description: 'Manage employees and permissions.',
    icon: <Users />,
    category: 'management',
  },
  {
    id: 'tax_compliance',
    name: 'Tax Integrity',
    description: 'Ensure your business stays in good standing.',
    icon: <ShieldCheck />,
    category: 'tax_health',
  },
  {
    id: 'loyalty_engine',
    name: 'Loyalty Program',
    description: 'Reward your repeat customers.',
    icon: <TrendingUp />,
    category: 'sales',
  },
];

export default function FeatureStore() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [userFeatures, setUserFeatures] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!auth.currentUser) return;
    const fetchUser = async () => {
      const userDoc = await getDoc(doc(db, 'users', auth.currentUser!.uid));
      if (userDoc.exists()) {
        setUserFeatures(userDoc.data().features || []);
      }
      setLoading(false);
    };
    fetchUser();
  }, []);

  const toggleFeature = async (featureId: string) => {
    const newFeatures = userFeatures.includes(featureId)
      ? userFeatures.filter((id) => id !== featureId)
      : [...userFeatures, featureId];

    setUserFeatures(newFeatures);

    if (!auth.currentUser) return;
    setSaving(true);
    try {
      await updateDoc(doc(db, 'users', auth.currentUser.uid), {
        features: newFeatures,
      });
    } catch (err) {
      console.error('Error saving features:', err);
    } finally {
      setSaving(false);
    }
  };

  if (loading)
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-orange-600"></div>
      </div>
    );

  return (
    <div className="max-w-4xl mx-auto p-6 pb-24">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate(-1)}
            className="p-2 hover:bg-neutral-100 rounded-xl transition-all"
          >
            <ArrowLeft size={24} />
          </button>
          <div>
            <h1 className="text-3xl font-black text-neutral-900 tracking-tight">Feature Store</h1>
            <p className="text-neutral-500">Customize your dashboard with the tools you need.</p>
          </div>
        </div>
        {saving && (
          <div className="flex items-center gap-2 text-orange-600 font-bold text-xs animate-pulse">
            <Zap size={14} /> Saving changes...
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {ALL_FEATURES.map((feature) => {
          const isActive = userFeatures.includes(feature.id);
          return (
            <motion.div
              key={feature.id}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => toggleFeature(feature.id)}
              className={`p-6 rounded-[2rem] border-2 cursor-pointer transition-all flex items-start gap-5 ${isActive ? 'border-orange-600 bg-orange-50 shadow-lg shadow-orange-100' : 'border-neutral-100 bg-white hover:border-orange-200'}`}
            >
              <div
                className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 ${isActive ? 'bg-orange-600 text-white' : 'bg-neutral-50 text-neutral-400'}`}
              >
                {feature.icon}
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <h3
                    className={`font-black tracking-tight ${isActive ? 'text-orange-900' : 'text-neutral-900'}`}
                  >
                    {feature.name}
                  </h3>
                  {isActive ? (
                    <div className="w-6 h-6 bg-green-500 text-white rounded-full flex items-center justify-center">
                      <Check size={14} />
                    </div>
                  ) : (
                    <div className="w-6 h-6 bg-neutral-100 text-neutral-400 rounded-full flex items-center justify-center">
                      <Plus size={14} />
                    </div>
                  )}
                </div>
                <p className="text-sm text-neutral-500 leading-relaxed">{feature.description}</p>
                <div className="mt-4 flex items-center gap-2">
                  <span className="text-[10px] font-black uppercase tracking-widest px-2 py-1 bg-neutral-100 text-neutral-400 rounded-lg">
                    {feature.category}
                  </span>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      <div className="mt-12 p-8 bg-slate-900 rounded-[2.5rem] text-white relative overflow-hidden">
        <div className="relative z-10">
          <h3 className="text-2xl font-black mb-2">Need a custom feature?</h3>
          <p className="text-slate-400 mb-6">
            Our AI can build custom modules tailored to your specific business needs.
          </p>
          <button className="px-8 py-4 bg-orange-600 text-white rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-orange-700 transition-all">
            Talk to AI Assistant
          </button>
        </div>
        <div className="absolute -right-20 -bottom-20 w-64 h-64 bg-orange-600/20 rounded-full blur-3xl"></div>
      </div>
    </div>
  );
}
