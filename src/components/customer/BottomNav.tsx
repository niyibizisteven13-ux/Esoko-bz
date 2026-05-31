import { motion } from 'framer-motion';
import { LayoutDashboard, ShoppingBag, Wallet, History, MapPin } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { cn } from '../../lib/utils';

interface BottomNavProps {
  activeTab: string;
  onTabChange: (tab: any) => void;
  onNearbyClick: () => void;
}

export default function BottomNav({ activeTab, onTabChange, onNearbyClick }: BottomNavProps) {
  const { t } = useLanguage();

  const items = [
    { id: 'overview', icon: <LayoutDashboard size={20} />, label: t.common.activity },
    { id: 'marketplace', icon: <ShoppingBag size={20} />, label: t.common.marketplace },
    {
      id: 'nearby',
      icon: <MapPin size={20} />,
      label: t.common.nearBy || 'Nearby',
      action: onNearbyClick,
    },
    { id: 'wallet', icon: <Wallet size={20} />, label: t.common.wallet },
    { id: 'purchases', icon: <History size={20} />, label: t.common.history },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-[#050505]/90 backdrop-blur-xl border-t border-white/5 px-2 py-3 md:hidden z-50">
      <div className="flex items-center justify-around max-w-md mx-auto">
        {items.map((item) => (
          <button
            key={item.id}
            onClick={() => {
              if (item.action) {
                item.action();
              } else {
                onTabChange(item.id);
              }
            }}
            className="flex flex-col items-center gap-1 group relative"
          >
            <div
              className={cn(
                'p-2 rounded-xl transition-all',
                activeTab === item.id
                  ? 'text-orange-500 bg-orange-500/10'
                  : 'text-neutral-500 group-hover:text-neutral-300'
              )}
            >
              {item.icon}
            </div>
            <span
              className={cn(
                'text-[8px] font-black uppercase tracking-tighter',
                activeTab === item.id ? 'text-orange-500' : 'text-neutral-500'
              )}
            >
              {item.label}
            </span>
            {activeTab === item.id && (
              <motion.div
                layoutId="activeTabDot"
                className="absolute -top-1 w-1 h-1 bg-orange-500 rounded-full"
              />
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
