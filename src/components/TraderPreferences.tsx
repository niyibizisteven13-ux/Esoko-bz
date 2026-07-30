import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Settings,
  Bell,
  Mail,
  Receipt,
  BarChart3,
  Users,
  Shield,
  Zap,
  Save,
  X,
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { cn } from '../lib/utils';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { auth } from '../firebase';

interface TraderPreferences {
  // Notification preferences
  emailNotifications: boolean;
  pushNotifications: boolean;
  smsNotifications: boolean;

  // Real-time features
  autoReceipts: boolean;
  realTimeUpdates: boolean;
  instantSaleAlerts: boolean;

  // Privacy & Display
  showOnlineStatus: boolean;
  publicProfile: boolean;
  showInMarketplace: boolean;

  // Analytics & Reporting
  autoAccounting: boolean;
  weeklyReports: boolean;
  monthlyReports: boolean;

  // Advanced features
  betaFeatures: boolean;
  apiAccess: boolean;
}

interface TraderPreferencesProps {
  traderId: string;
  onClose: () => void;
  className?: string;
}

export const TraderPreferences: React.FC<TraderPreferencesProps> = ({
  traderId,
  onClose,
  className = '',
}) => {
  const { t } = useLanguage();
  const [preferences, setPreferences] = useState<TraderPreferences>({
    emailNotifications: true,
    pushNotifications: true,
    smsNotifications: false,
    autoReceipts: true,
    realTimeUpdates: true,
    instantSaleAlerts: true,
    showOnlineStatus: true,
    publicProfile: true,
    showInMarketplace: true,
    autoAccounting: true,
    weeklyReports: true,
    monthlyReports: true,
    betaFeatures: false,
    apiAccess: false,
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadPreferences();
  }, [traderId]);

  const loadPreferences = async () => {
    try {
      const docRef = doc(db, 'trader_preferences', traderId);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        setPreferences({ ...preferences, ...docSnap.data() });
      }
    } catch (error) {
      console.error('Failed to load preferences:', error);
    } finally {
      setLoading(false);
    }
  };

  const savePreferences = async () => {
    setSaving(true);
    try {
      const docRef = doc(db, 'trader_preferences', traderId);
      await setDoc(
        docRef,
        {
          ...preferences,
          updatedAt: new Date(),
        },
        { merge: true }
      );

      // Show success message
      console.log('Preferences saved successfully');
    } catch (error) {
      console.error('Failed to save preferences:', error);
    } finally {
      setSaving(false);
    }
  };

  const updatePreference = (key: keyof TraderPreferences, value: boolean) => {
    setPreferences((prev) => ({ ...prev, [key]: value }));
  };

  const PreferenceSection: React.FC<{
    title: string;
    icon: React.ReactNode;
    children: React.ReactNode;
  }> = ({ title, icon, children }) => (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 bg-orange-100 dark:bg-orange-900/20 rounded-lg flex items-center justify-center text-orange-600">
          {icon}
        </div>
        <h3 className="text-lg font-semibold text-neutral-900 dark:text-white">{title}</h3>
      </div>
      <div className="ml-11 space-y-3">{children}</div>
    </div>
  );

  const PreferenceToggle: React.FC<{
    label: string;
    description: string;
    value: boolean;
    onChange: (value: boolean) => void;
    disabled?: boolean;
  }> = ({ label, description, value, onChange, disabled = false }) => (
    <div
      className={cn(
        'flex items-center justify-between p-4 rounded-xl border transition-all',
        value
          ? 'bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800'
          : 'bg-neutral-50 dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700',
        disabled && 'opacity-50 cursor-not-allowed'
      )}
    >
      <div className="flex-1">
        <h4 className="font-medium text-neutral-900 dark:text-white">{label}</h4>
        <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-1">{description}</p>
      </div>
      <button
        onClick={() => !disabled && onChange(!value)}
        disabled={disabled}
        className={cn(
          'relative w-12 h-6 rounded-full transition-all duration-200',
          value ? 'bg-green-500' : 'bg-neutral-300 dark:bg-neutral-600'
        )}
      >
        <motion.div
          className="w-5 h-5 bg-white rounded-full shadow-md"
          animate={{ x: value ? 24 : 2 }}
          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
        />
      </button>
    </div>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600"></div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className={cn(
        'bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-700 shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden',
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-6 border-b border-neutral-200 dark:border-neutral-700">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-orange-100 dark:bg-orange-900/20 rounded-xl flex items-center justify-center">
            <Settings className="w-5 h-5 text-orange-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-neutral-900 dark:text-white">
              Trader Preferences
            </h2>
            <p className="text-sm text-neutral-600 dark:text-neutral-400">
              Customize your Bwenge experience
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="w-8 h-8 rounded-lg bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Content */}
      <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
        <div className="space-y-8">
          {/* Notifications */}
          <PreferenceSection title="Notifications" icon={<Bell className="w-4 h-4" />}>
            <PreferenceToggle
              label="Email Notifications"
              description="Receive purchase confirmations and important updates via email"
              value={preferences.emailNotifications}
              onChange={(value) => updatePreference('emailNotifications', value)}
            />
            <PreferenceToggle
              label="Push Notifications"
              description="Get instant alerts for new sales and customer interactions"
              value={preferences.pushNotifications}
              onChange={(value) => updatePreference('pushNotifications', value)}
            />
            <PreferenceToggle
              label="SMS Notifications"
              description="Receive critical alerts via SMS (additional charges may apply)"
              value={preferences.smsNotifications}
              onChange={(value) => updatePreference('smsNotifications', value)}
            />
          </PreferenceSection>

          {/* Real-time Features */}
          <PreferenceSection title="Real-time Features" icon={<Zap className="w-4 h-4" />}>
            <PreferenceToggle
              label="Auto Receipts"
              description="Automatically generate and email receipts when purchases are approved"
              value={preferences.autoReceipts}
              onChange={(value) => updatePreference('autoReceipts', value)}
            />
            <PreferenceToggle
              label="Real-time Updates"
              description="Live synchronization of sales data and customer interactions"
              value={preferences.realTimeUpdates}
              onChange={(value) => updatePreference('realTimeUpdates', value)}
            />
            <PreferenceToggle
              label="Instant Sale Alerts"
              description="Get immediate notifications for every new sale"
              value={preferences.instantSaleAlerts}
              onChange={(value) => updatePreference('instantSaleAlerts', value)}
            />
          </PreferenceSection>

          {/* Privacy & Display */}
          <PreferenceSection title="Privacy & Display" icon={<Shield className="w-4 h-4" />}>
            <PreferenceToggle
              label="Show Online Status"
              description="Let customers see when you're online in the marketplace"
              value={preferences.showOnlineStatus}
              onChange={(value) => updatePreference('showOnlineStatus', value)}
            />
            <PreferenceToggle
              label="Public Profile"
              description="Make your business profile visible to other traders and customers"
              value={preferences.publicProfile}
              onChange={(value) => updatePreference('publicProfile', value)}
            />
            <PreferenceToggle
              label="Show in Marketplace"
              description="Appear in marketplace searches and recommendations"
              value={preferences.showInMarketplace}
              onChange={(value) => updatePreference('showInMarketplace', value)}
            />
          </PreferenceSection>

          {/* Analytics & Reporting */}
          <PreferenceSection title="Analytics & Reporting" icon={<BarChart3 className="w-4 h-4" />}>
            <PreferenceToggle
              label="Auto Accounting"
              description="Automatically track expenses and generate financial reports"
              value={preferences.autoAccounting}
              onChange={(value) => updatePreference('autoAccounting', value)}
            />
            <PreferenceToggle
              label="Weekly Reports"
              description="Receive weekly sales and performance summaries"
              value={preferences.weeklyReports}
              onChange={(value) => updatePreference('weeklyReports', value)}
            />
            <PreferenceToggle
              label="Monthly Reports"
              description="Get detailed monthly business analytics and insights"
              value={preferences.monthlyReports}
              onChange={(value) => updatePreference('monthlyReports', value)}
            />
          </PreferenceSection>

          {/* Advanced Features */}
          <PreferenceSection title="Advanced Features" icon={<Users className="w-4 h-4" />}>
            <PreferenceToggle
              label="Beta Features"
              description="Access experimental features before they're released to everyone"
              value={preferences.betaFeatures}
              onChange={(value) => updatePreference('betaFeatures', value)}
            />
            <PreferenceToggle
              label="API Access"
              description="Enable API access for integrations (requires verification)"
              value={preferences.apiAccess}
              onChange={(value) => updatePreference('apiAccess', value)}
              disabled={!preferences.betaFeatures}
            />
          </PreferenceSection>
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between p-6 border-t border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/50">
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          Changes are saved automatically
        </p>
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-neutral-600 dark:text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-200 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={savePreferences}
            disabled={saving}
            className="px-6 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
          >
            {saving ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </motion.div>
  );
};
