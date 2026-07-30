import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Camera, Mic, MapPin, Globe, ShieldCheck, ChevronRight } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { Language } from '../lib/i18n';
import { cn } from '../lib/utils';
import Logo from './Logo';

export default function PermissionModal() {
  const { t, language, setLanguage } = useLanguage();
  const [isVisible, setIsVisible] = useState(false);
  const [permissions, setPermissions] = useState({
    camera: true,
    microphone: true,
    location: true,
  });

  useEffect(() => {
    const hasApplied = localStorage.getItem('esoko_permissions_applied');
    if (!hasApplied) {
      setIsVisible(true);
    }
  }, []);

  const handleApply = () => {
    localStorage.setItem('esoko_permissions_applied', 'true');
    setIsVisible(false);
  };

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="max-w-md w-full bg-white rounded-[2.5rem] shadow-2xl overflow-hidden border border-neutral-100"
      >
        <div className="p-8">
          <div className="flex justify-between items-start mb-8">
            <Logo className="scale-90 origin-left" />
            <div className="flex items-center gap-2 px-3 py-1.5 bg-orange-50 rounded-xl border border-orange-100">
              <Globe size={14} className="text-orange-600" />
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value as Language)}
                className="text-[10px] font-black uppercase tracking-widest bg-transparent border-none outline-none text-orange-700 cursor-pointer"
              >
                <option value="en">English</option>
                <option value="rw">Kinyarwanda</option>
                <option value="fr">FranÃ§ais</option>
              </select>
            </div>
          </div>

          <h2 className="text-2xl font-black text-slate-900 tracking-tight mb-2">
            {t.permissions.title}
          </h2>
          <p className="text-sm font-medium text-neutral-500 mb-8 leading-relaxed">
            {t.permissions.description}
          </p>

          <div className="space-y-3 mb-10">
            <PermissionToggle
              icon={<Camera size={20} />}
              label={t.permissions.camera}
              enabled={permissions.camera}
              onChange={() => setPermissions((prev) => ({ ...prev, camera: !prev.camera }))}
            />
            <PermissionToggle
              icon={<Mic size={20} />}
              label={t.permissions.microphone}
              enabled={permissions.microphone}
              onChange={() => setPermissions((prev) => ({ ...prev, microphone: !prev.microphone }))}
            />
            <PermissionToggle
              icon={<MapPin size={20} />}
              label={t.permissions.location}
              enabled={permissions.location}
              onChange={() => setPermissions((prev) => ({ ...prev, location: !prev.location }))}
            />
          </div>

          <button
            onClick={handleApply}
            className="w-full py-5 bg-orange-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-orange-200 flex items-center justify-center gap-2 group transition-all active:scale-95"
          >
            {t.permissions.apply}
            <ChevronRight size={18} className="group-hover:translate-x-1 transition-transform" />
          </button>
        </div>

        <div className="px-8 py-4 bg-neutral-50 border-t border-neutral-100 flex items-center gap-2">
          <ShieldCheck size={14} className="text-neutral-400" />
          <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">
            Secure & Private â€¢ Bwenge Trust
          </span>
        </div>
      </motion.div>
    </div>
  );
}

function PermissionToggle({
  icon,
  label,
  enabled,
  onChange,
}: {
  icon: React.ReactNode;
  label: string;
  enabled: boolean;
  onChange: () => void;
}) {
  return (
    <div className="flex items-center justify-between p-4 bg-neutral-50 rounded-2xl border border-neutral-100 hover:border-neutral-200 transition-all">
      <div className="flex items-center gap-4">
        <div
          className={cn(
            'w-10 h-10 rounded-xl flex items-center justify-center transition-colors',
            enabled ? 'bg-orange-100 text-orange-600' : 'bg-neutral-200 text-neutral-400'
          )}
        >
          {icon}
        </div>
        <span className="font-bold text-slate-900">{label}</span>
      </div>
      <button
        onClick={onChange}
        className={cn(
          'w-12 h-6 rounded-full relative transition-colors duration-200 ease-in-out',
          enabled ? 'bg-orange-500' : 'bg-neutral-300'
        )}
      >
        <motion.div
          animate={{ x: enabled ? 24 : 4 }}
          className="absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm"
        />
      </button>
    </div>
  );
}
