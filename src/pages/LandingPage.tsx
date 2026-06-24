import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ShoppingBag,
  Store,
  ShieldCheck,
  ArrowRight,
  Smartphone,
  Globe,
  Award,
  LogOut,
  LayoutDashboard,
  Zap,
  Heart,
  Gift,
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { observeAuthState } from '../services/sessionService';
import { getUser } from '../services/userService';
import { useEffect, useState } from 'react';
import HybridCarousel from '../components/HybridCarousel';
import Logo from '../components/Logo';

export default function LandingPage() {
  const { t } = useLanguage();
  const [user, setUser] = useState<any>(null);
  const [userData, setUserData] = useState<any>(null);

  useEffect(() => {
    const unsubscribe = observeAuthState(async (u: any) => {
      setUser(u);
      if (u?.id) {
        const response = await getUser(u.id);
        if (response?.user) {
          setUserData(response.user);
        }
      }
    });
    return () => unsubscribe();
  }, []);

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header with Logo */}
      <header className="px-6 py-6 border-b border-neutral-100 bg-white/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <Logo />
          <div className="flex items-center gap-4">
            {user ? (
              <Link
                to={`/${userData?.role || 'customer'}`}
                className="text-orange-600 font-bold hover:underline"
              >
                {t.common.dashboard}
              </Link>
            ) : (
              <Link to="/login" className="text-orange-600 font-bold hover:underline">
                {t.common.login}
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="flex-1 flex flex-col items-center justify-center px-4 py-20 bg-gradient-to-br from-orange-50 to-white">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center max-w-3xl"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-100 text-orange-700 text-sm font-medium mb-6">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-orange-500"></span>
            </span>
            Rwanda's Unified Digital Wallet
          </div>
          <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight text-neutral-900 mb-6">
            <span className="text-orange-600">ESOKO</span> Wallet
          </h1>
          <p className="text-xl text-neutral-600 mb-10 leading-relaxed">
            The all-in-one platform for digital payments, inventory management, and reporting in
            Rwanda. Inclusive for smartphones and feature phones.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            {user ? (
              <>
                <Link
                  to={`/${userData?.role || 'customer'}`}
                  className="px-8 py-4 bg-orange-600 text-white rounded-xl font-bold text-lg hover:bg-orange-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-orange-200"
                >
                  <LayoutDashboard size={20} /> {t.common.dashboard}
                </Link>
                <Link
                  to="/logout"
                  className="px-8 py-4 bg-white text-red-600 border border-red-100 rounded-xl font-bold text-lg hover:bg-red-50 transition-all flex items-center justify-center gap-2"
                >
                  <LogOut size={20} /> {t.common.logout}
                </Link>
              </>
            ) : (
              <>
                <Link
                  to="/register"
                  className="px-8 py-4 bg-orange-600 text-white rounded-xl font-bold text-lg hover:bg-orange-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-orange-200"
                >
                  {t.common.signup} <ArrowRight size={20} />
                </Link>
                <Link
                  to="/login"
                  className="px-8 py-4 bg-white text-neutral-900 border border-neutral-200 rounded-xl font-bold text-lg hover:bg-neutral-50 transition-all flex items-center justify-center gap-2"
                >
                  {t.common.login}
                </Link>
              </>
            )}
          </div>
        </motion.div>
      </section>

      <HybridCarousel />

      {/* Features Section */}
      <section className="py-24 bg-white px-4">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
            <motion.div
              whileHover={{ y: -5 }}
              className="p-8 rounded-3xl bg-neutral-50 border border-neutral-100"
            >
              <div className="w-14 h-14 bg-orange-100 text-orange-600 rounded-2xl flex items-center justify-center mb-6">
                <Store size={28} />
              </div>
              <h3 className="text-2xl font-bold mb-4">{t.common.trader}</h3>
              <p className="text-neutral-600 leading-relaxed">
                Manage inventory, generate QR codes, and automate sales reporting. Earn loyalty
                points for active usage.
              </p>
            </motion.div>

            <motion.div
              whileHover={{ y: -5 }}
              className="p-8 rounded-3xl bg-neutral-50 border border-neutral-100"
            >
              <div className="w-14 h-14 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center mb-6">
                <ShoppingBag size={28} />
              </div>
              <h3 className="text-2xl font-bold mb-4">{t.common.customer}</h3>
              <p className="text-neutral-600 leading-relaxed">
                Pay via QR or manual product codes. Track spending, download reports, and earn
                loyalty points.
              </p>
            </motion.div>

            <motion.div
              whileHover={{ y: -5 }}
              className="p-8 rounded-3xl bg-neutral-50 border border-neutral-100"
            >
              <div className="w-14 h-14 bg-green-100 text-green-600 rounded-2xl flex items-center justify-center mb-6">
                <Zap size={28} />
              </div>
              <h3 className="text-2xl font-bold mb-4">Fast & Secure</h3>
              <p className="text-neutral-600 leading-relaxed">
                Instant digital payments with bank-grade security. Your money is safe and
                transactions are lightning fast.
              </p>
            </motion.div>

            <motion.div
              whileHover={{ y: -5 }}
              className="p-8 rounded-3xl bg-neutral-50 border border-neutral-100"
            >
              <div className="w-14 h-14 bg-purple-100 text-purple-600 rounded-2xl flex items-center justify-center mb-6">
                <Heart size={28} />
              </div>
              <h3 className="text-2xl font-bold mb-4">Local Support</h3>
              <p className="text-neutral-600 leading-relaxed">
                Built specifically for the Rwandan market. Supporting local businesses and
                communities across the country.
              </p>
            </motion.div>

            <motion.div
              whileHover={{ y: -5 }}
              className="p-8 rounded-3xl bg-neutral-50 border border-neutral-100"
            >
              <div className="w-14 h-14 bg-yellow-100 text-yellow-600 rounded-2xl flex items-center justify-center mb-6">
                <Gift size={28} />
              </div>
              <h3 className="text-2xl font-bold mb-4">Rewards & Loyalty</h3>
              <p className="text-neutral-600 leading-relaxed">
                Earn points on every purchase. Redeem points for discounts, airtime, and special
                offers from our partners.
              </p>
            </motion.div>

            <motion.div
              whileHover={{ y: -5 }}
              className="p-8 rounded-3xl bg-neutral-50 border border-neutral-100"
            >
              <div className="w-14 h-14 bg-red-100 text-red-600 rounded-2xl flex items-center justify-center mb-6">
                <Smartphone size={28} />
              </div>
              <h3 className="text-2xl font-bold mb-4">Inclusivity</h3>
              <p className="text-neutral-600 leading-relaxed">
                Works on smartphones and feature phones via USSD. Manual product code entry ensures
                no one is left behind.
              </p>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 bg-neutral-900 text-white px-4">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-8">
          <Logo dark />
          <div className="flex flex-col md:flex-row items-center gap-4 text-sm">
            <Link to="/terms" className="hover:text-orange-400 transition-colors">
              Terms of Service
            </Link>
            <Link to="/privacy" className="hover:text-orange-400 transition-colors">
              Privacy Policy
            </Link>
            <Link to="/restrictions" className="hover:text-orange-400 transition-colors">
              Acceptable Use
            </Link>
          </div>
          <p className="text-neutral-400 text-sm">
            © 2026 ESOKO Wallet. Built for Rwanda's Digital Future.
          </p>
        </div>
      </footer>
    </div>
  );
}
