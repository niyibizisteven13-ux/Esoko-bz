import React, { useCallback, useEffect, useState } from 'react';
import {
  Activity,
  BarChart3,
  CheckCircle2,
  Eye,
  LayoutDashboard,
  Loader2,
  Lock,
  Plus,
  ShieldAlert,
  Target,
  TrendingUp,
  UserPlus,
  Users,
  XCircle,
  Zap,
} from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  query,
  Timestamp,
  updateDoc,
  where,
} from '../../services/firestoreBridge';
import { getTraderTeam, inviteTeamMember } from '../../services/teamService';
const db = undefined;
import { useLanguage } from '../../context/LanguageContext';
import { cn } from '../../lib/utils';
import TraderPayroll from './TraderPayroll';

type TeamTab = 'command' | 'members' | 'tasks' | 'payroll' | 'growth' | 'onboarding';

export default function TraderTeamManagement({
  traderId,
  tier,
}: {
  traderId: string;
  tier: string;
}) {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState<TeamTab>('command');
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [invitations, setInvitations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const isPremium = tier === 'premium';
  const [hasUsedTrial, setHasUsedTrial] = useState(() => {
    return localStorage.getItem(`team_trial_used_${traderId}`) === 'true';
  });

  const loadTeam = useCallback(async () => {
    if (!traderId) return;
    try {
      const response = await getTraderTeam(traderId);
      setTeamMembers(response.members || []);
      setInvitations(response.invitations || []);
    } catch (err) {
      console.error('Trader team load error:', err);
    } finally {
      setLoading(false);
    }
  }, [traderId]);

  useEffect(() => {
    loadTeam();
  }, [loadTeam]);

  const handleUseTrial = () => {
    if (!isPremium && !hasUsedTrial) {
      setHasUsedTrial(true);
      localStorage.setItem(`team_trial_used_${traderId}`, 'true');
    }
  };

  if (!isPremium && hasUsedTrial) {
    return (
      <div className="bg-white p-12 rounded-[3rem] border-2 border-orange-100 shadow-xl shadow-orange-50 text-center max-w-2xl mx-auto">
        <div className="w-20 h-20 bg-orange-100 text-orange-600 rounded-3xl flex items-center justify-center mx-auto mb-8">
          <Lock size={40} />
        </div>
        <h3 className="text-3xl font-black text-neutral-900 mb-4">{t.team.upgradeToTeam}</h3>
        <p className="text-neutral-500 font-medium mb-8">
          Manage your growing team with professional tools, branch permissions, tasks, and payroll.
        </p>
        <button className="w-full py-5 bg-orange-600 text-white rounded-2xl font-black text-xl hover:bg-orange-700 transition-all shadow-lg shadow-orange-200 flex items-center justify-center gap-3">
          <Zap size={24} /> Upgrade to Premium
        </button>
      </div>
    );
  }

  const tabs: { id: TeamTab; label: string; icon: any }[] = [
    { id: 'command', label: t.team.commandCenter, icon: LayoutDashboard },
    { id: 'members', label: t.team.members, icon: Users },
    { id: 'tasks', label: t.team.tasks, icon: Target },
    { id: 'payroll', label: t.team.payroll, icon: Zap },
    { id: 'growth', label: t.team.growthTracking, icon: TrendingUp },
    { id: 'onboarding', label: t.team.onboarding, icon: UserPlus },
  ];

  return (
    <div className="space-y-8" onClick={handleUseTrial}>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-3xl font-black text-neutral-900 tracking-tight">{t.team.title}</h2>
          <p className="text-neutral-500 font-medium">Centralized oversight & team empowerment</p>
        </div>
        <div className="flex items-center gap-3 bg-white px-4 py-2 rounded-2xl border border-neutral-100 shadow-sm">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
          <span className="text-xs font-black text-neutral-600 uppercase tracking-widest">
            {teamMembers.length} Active Members
          </span>
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'flex items-center gap-2 px-6 py-3 rounded-2xl font-bold text-sm whitespace-nowrap transition-all border-2',
              activeTab === tab.id
                ? 'bg-orange-600 text-white border-orange-600 shadow-lg shadow-orange-200'
                : 'bg-white text-neutral-500 border-neutral-100 hover:border-neutral-200'
            )}
          >
            <tab.icon size={18} />
            {tab.label}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
          className="min-h-[600px]"
        >
          {activeTab === 'command' && <CommandCenter members={teamMembers} />}
          {activeTab === 'members' && (
            <MembersList members={teamMembers} invitations={invitations} loading={loading} />
          )}
          {activeTab === 'tasks' && <TasksManagement traderId={traderId} members={teamMembers} />}
          {activeTab === 'payroll' && <TraderPayroll traderId={traderId} />}
          {activeTab === 'growth' && <GrowthTracking members={teamMembers} />}
          {activeTab === 'onboarding' && (
            <OnboardingView traderId={traderId} onInvited={loadTeam} />
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

function CommandCenter({ members }: { members: any[] }) {
  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <StatCard label="Team Productivity" value="94%" trend="+5%" icon={Activity} color="text-blue-600 bg-blue-50" />
        <StatCard label="Active Trades" value="12" trend="Live" icon={TrendingUp} color="text-green-600 bg-green-50" />
        <StatCard label="Risk Level" value="Low" trend="Safe" icon={ShieldAlert} color="text-orange-600 bg-orange-50" />
        <StatCard label="Members" value={String(members.length)} trend="Active" icon={Users} color="text-purple-600 bg-purple-50" />
      </div>
      <div className="bg-white rounded-[3rem] border-2 border-neutral-100 shadow-xl shadow-neutral-100/50 overflow-hidden">
        <div className="p-8 border-b border-neutral-100 flex justify-between items-center bg-neutral-50/50">
          <h4 className="text-xl font-black text-neutral-900 flex items-center gap-3">
            <Eye size={24} className="text-orange-600" /> Team Access Drilldown
          </h4>
        </div>
        <div className="p-8 space-y-4">
          {members.map((member) => (
            <MemberRow key={member.id} member={member} />
          ))}
          {members.length === 0 && <EmptyTeam />}
        </div>
      </div>
    </div>
  );
}

function MembersList({
  members,
  invitations,
  loading,
}: {
  members: any[];
  invitations: any[];
  loading: boolean;
}) {
  const pending = invitations.filter((invite) => invite.status === 'pending');
  return (
    <div className="space-y-8">
      {loading && (
        <div className="bg-white p-6 rounded-3xl border border-neutral-100 flex items-center gap-3 text-neutral-500 font-bold">
          <Loader2 className="animate-spin text-orange-600" /> Loading team access...
        </div>
      )}
      {pending.length > 0 && (
        <div className="bg-white p-6 rounded-[2rem] border-2 border-orange-100">
          <h4 className="text-lg font-black text-neutral-900 mb-4">Pending Invitations</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {pending.map((invite) => (
              <div key={invite.id} className="p-4 rounded-2xl bg-orange-50 border border-orange-100">
                <p className="font-black text-neutral-900">{invite.name}</p>
                <p className="text-xs font-bold text-neutral-500">{invite.email}</p>
                <p className="text-[10px] font-black uppercase tracking-widest text-orange-600 mt-2">
                  {invite.role} - awaiting consent
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {members.map((member) => (
          <div
            key={member.id}
            className="bg-white p-8 rounded-[2.5rem] border-2 border-neutral-100 shadow-xl shadow-neutral-100/50"
          >
            <div className="w-16 h-16 rounded-2xl bg-orange-50 text-orange-600 flex items-center justify-center font-black text-2xl mb-6">
              {member.name?.[0] || 'M'}
            </div>
            <h5 className="text-xl font-black text-neutral-900 mb-1">{member.name}</h5>
            <p className="text-xs font-bold text-neutral-400 uppercase tracking-widest mb-4">
              {member.role || 'Shopkeeper'}
            </p>
            <div className="space-y-2 mb-6">
              <InfoLine label="Branch" value={member.branch?.name || 'Main shop'} />
              <InfoLine label="Status" value={member.status || 'active'} />
              <InfoLine label="Email" value={member.email} />
            </div>
            <div className="flex flex-wrap gap-2">
              {(member.permissions || []).map((permission: string) => (
                <span
                  key={permission}
                  className="px-2 py-1 bg-neutral-100 text-neutral-500 rounded-lg text-[10px] font-black uppercase tracking-widest"
                >
                  {permission}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
      {members.length === 0 && pending.length === 0 && <EmptyTeam />}
    </div>
  );
}

function TasksManagement({ traderId, members }: { traderId: string; members: any[] }) {
  const { t } = useLanguage();
  const [tasks, setTasks] = useState<any[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    assignedTo: '',
    dueDate: '',
    priority: 'medium',
  });

  useEffect(() => {
    const q = query(collection(db, 'tasks'), where('traderId', '==', traderId));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setTasks(snapshot.docs.map((item: any) => ({ id: item.id, ...item.data() })));
    });
    return () => unsubscribe();
  }, [traderId]);

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await addDoc(collection(db, 'tasks'), {
        traderId,
        ...formData,
        status: 'pending',
        createdAt: Timestamp.now(),
      });
      setShowAddForm(false);
      setFormData({ title: '', description: '', assignedTo: '', dueDate: '', priority: 'medium' });
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <h4 className="text-xl font-black text-neutral-900 flex items-center gap-3">
          <Target size={24} className="text-orange-600" /> {t.team.tasks}
        </h4>
        <button
          onClick={() => setShowAddForm(true)}
          className="px-6 py-3 bg-orange-600 text-white rounded-2xl font-black text-sm hover:bg-orange-700 transition-all shadow-lg shadow-orange-200 flex items-center gap-2"
        >
          <Plus size={20} /> {t.team.assignTask}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {tasks.map((task) => (
          <div key={task.id} className="bg-white p-6 rounded-3xl border-2 border-neutral-50 shadow-sm">
            <span className="px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest text-orange-600 bg-orange-50">
              {task.priority}
            </span>
            <h5 className="text-lg font-black text-neutral-900 mt-4 mb-2">{task.title}</h5>
            <p className="text-sm text-neutral-500 font-medium mb-6 line-clamp-2">
              {task.description}
            </p>
            <InfoLine
              label="Assigned"
              value={members.find((member) => member.id === task.assignedTo)?.name || 'Unknown'}
            />
            <InfoLine label="Due" value={task.dueDate || 'No deadline'} />
          </div>
        ))}
        {tasks.length === 0 && (
          <div className="col-span-full py-20 text-center bg-white rounded-[3rem] border-2 border-dashed border-neutral-100">
            <Target size={48} className="mx-auto text-neutral-200 mb-4" />
            <p className="text-neutral-400 font-bold">{t.team.noTasks}</p>
          </div>
        )}
      </div>

      <AnimatePresence>
        {showAddForm && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white w-full max-w-lg rounded-[2.5rem] p-8 shadow-2xl"
            >
              <div className="flex justify-between items-center mb-8">
                <h3 className="text-2xl font-black text-neutral-900">{t.team.assignTask}</h3>
                <button onClick={() => setShowAddForm(false)} className="p-2 text-neutral-400">
                  <XCircle size={24} />
                </button>
              </div>
              <form onSubmit={handleCreateTask} className="space-y-5">
                <FormInput label="Task Name" value={formData.title} onChange={(value) => setFormData({ ...formData, title: value })} required />
                <FormInput label="Description" value={formData.description} onChange={(value) => setFormData({ ...formData, description: value })} required />
                <select
                  required
                  value={formData.assignedTo}
                  onChange={(e) => setFormData({ ...formData, assignedTo: e.target.value })}
                  className="w-full px-6 py-4 bg-[#111] border border-white/10 rounded-2xl font-bold text-white"
                >
                  <option value="">Select Member</option>
                  {members.map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.name}
                    </option>
                  ))}
                </select>
                <FormInput label="Due Date" type="date" value={formData.dueDate} onChange={(value) => setFormData({ ...formData, dueDate: value })} required />
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-5 bg-orange-600 text-white rounded-2xl font-black text-lg flex items-center justify-center gap-3 disabled:opacity-50"
                >
                  {loading ? <Activity className="animate-spin" /> : <Plus size={24} />}
                  {loading ? 'Creating...' : t.team.createTask}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function GrowthTracking({ members }: { members: any[] }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
      <div className="bg-white p-8 rounded-[3rem] border-2 border-neutral-100 shadow-xl shadow-neutral-100/50">
        <h5 className="text-lg font-black text-neutral-900 mb-6 flex items-center gap-3">
          <BarChart3 size={20} className="text-orange-600" /> Revenue Growth
        </h5>
        <div className="h-64 bg-neutral-50 rounded-3xl border border-dashed border-neutral-200 flex items-center justify-center">
          <p className="text-neutral-400 font-bold">Growth Chart Placeholder</p>
        </div>
      </div>
      <div className="bg-white p-8 rounded-[3rem] border-2 border-neutral-100 shadow-xl shadow-neutral-100/50">
        <h5 className="text-lg font-black text-neutral-900 mb-6 flex items-center gap-3">
          <Target size={20} className="text-orange-600" /> Team Targets
        </h5>
        <div className="space-y-6">
          {[
            { label: 'Monthly Sales', current: 4200000, target: 5000000 },
            { label: 'New Customers', current: members.length * 20, target: 200 },
            { label: 'Trade Success Rate', current: 78, target: 85 },
          ].map((target) => (
            <div key={target.label} className="space-y-2">
              <div className="flex justify-between text-xs font-black uppercase tracking-widest">
                <span className="text-neutral-400">{target.label}</span>
                <span className="text-neutral-900">
                  {target.current} / {target.target}
                </span>
              </div>
              <div className="h-3 bg-neutral-100 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(100, (target.current / target.target) * 100)}%` }}
                  className="h-full bg-orange-600 rounded-full"
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function OnboardingView({ traderId, onInvited }: { traderId: string; onInvited: () => void }) {
  const { t } = useLanguage();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    role: 'Shopkeeper',
    branchName: '',
    branchLocation: '',
    permissions: ['sales', 'inventory', 'messages'],
  });
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const togglePermission = (permission: string) => {
    setFormData((current) => ({
      ...current,
      permissions: current.permissions.includes(permission)
        ? current.permissions.filter((item) => item !== permission)
        : [...current.permissions, permission],
    }));
  };

  const handleCreateMember = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccessMessage(null);
    setInviteLink(null);
    try {
      const response = await inviteTeamMember({ traderId, ...formData });
      setSuccessMessage(
        response.emailSent
          ? `Consent invitation sent to ${formData.email}`
          : `Invitation created. Email not sent: ${response.emailError || 'SMTP not configured'}`
      );
      setInviteLink(response.invitationUrl || null);
      setFormData({
        name: '',
        email: '',
        role: 'Shopkeeper',
        branchName: '',
        branchLocation: '',
        permissions: ['sales', 'inventory', 'messages'],
      });
      onInvited();
    } catch (err: any) {
      setError(err.message || 'Failed to create invitation');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto">
      <div className="bg-white p-10 rounded-[3rem] border-2 border-neutral-100 shadow-xl shadow-neutral-100/50">
        <div className="flex items-center gap-4 mb-8">
          <div className="w-14 h-14 bg-orange-100 text-orange-600 rounded-2xl flex items-center justify-center">
            <UserPlus size={28} />
          </div>
          <div>
            <h4 className="text-2xl font-black text-neutral-900">{t.team.onboarding}</h4>
            <p className="text-neutral-500 font-medium">
              Invite a team member by email and activate access only after consent.
            </p>
          </div>
        </div>

        <form onSubmit={handleCreateMember} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FormInput label="Full Name" value={formData.name} onChange={(value) => setFormData({ ...formData, name: value })} required />
            <label className="space-y-2 block">
              <span className="text-xs font-black text-neutral-400 uppercase tracking-widest ml-1">Role</span>
              <select
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                className="w-full px-6 py-4 bg-[#111] border border-white/10 rounded-2xl font-bold text-white"
              >
                <option value="Shopkeeper">Shopkeeper</option>
                <option value="Branch Manager">Branch Manager</option>
                <option value="Sales">Sales</option>
                <option value="Inventory">Inventory</option>
                <option value="Support">Support</option>
                <option value="Admin">Admin</option>
              </select>
            </label>
          </div>
          <FormInput label="Email Address" type="email" value={formData.email} onChange={(value) => setFormData({ ...formData, email: value })} required />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FormInput label="Branch Name" value={formData.branchName} onChange={(value) => setFormData({ ...formData, branchName: value })} placeholder="Main Branch" />
            <FormInput label="Branch Location" value={formData.branchLocation} onChange={(value) => setFormData({ ...formData, branchLocation: value })} placeholder="Kigali" />
          </div>
          <div>
            <p className="text-xs font-black text-neutral-400 uppercase tracking-widest ml-1 mb-3">
              Permissions
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {['sales', 'inventory', 'messages', 'reports', 'accounting', 'payroll', 'team', 'wallet_view'].map((permission) => (
                <button
                  type="button"
                  key={permission}
                  onClick={() => togglePermission(permission)}
                  className={cn(
                    'py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest border-2 transition-all',
                    formData.permissions.includes(permission)
                      ? 'bg-orange-600 text-white border-orange-600'
                      : 'bg-white text-neutral-500 border-neutral-100'
                  )}
                >
                  {permission.replace('_', ' ')}
                </button>
              ))}
            </div>
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full py-5 bg-orange-600 text-white rounded-2xl font-black text-lg hover:bg-orange-700 transition-all shadow-lg shadow-orange-200 flex items-center justify-center gap-3 disabled:opacity-50"
          >
            {loading ? <Loader2 className="animate-spin" /> : <Plus size={24} />}
            {loading ? 'Sending...' : 'Send Consent Invitation'}
          </button>
          {successMessage && (
            <div className="p-4 bg-green-50 text-green-700 rounded-2xl border border-green-100 font-bold text-sm space-y-2">
              <div className="flex items-center gap-3">
                <CheckCircle2 size={20} /> {successMessage}
              </div>
              {inviteLink && (
                <p className="break-all text-xs font-semibold text-green-800">{inviteLink}</p>
              )}
            </div>
          )}
          {error && (
            <div className="p-4 bg-red-50 text-red-600 rounded-2xl border border-red-100 font-bold text-sm">
              {error}
            </div>
          )}
        </form>
      </div>
    </div>
  );
}

function MemberRow({ member }: { member: any }) {
  return (
    <div className="flex items-center justify-between p-6 bg-neutral-50 rounded-3xl border border-neutral-100">
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-2xl bg-white border border-neutral-200 flex items-center justify-center font-black text-orange-600">
          {member.name?.[0] || 'M'}
        </div>
        <div>
          <p className="font-black text-neutral-900">{member.name}</p>
          <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">
            {member.role || 'Shopkeeper'} - {member.branch?.name || 'Main shop'}
          </p>
        </div>
      </div>
      <span className="text-[10px] font-black uppercase tracking-widest text-green-600 bg-green-50 px-3 py-1 rounded-lg">
        {member.status || 'active'}
      </span>
    </div>
  );
}

function EmptyTeam() {
  return (
    <div className="text-center py-12 bg-white rounded-[3rem] border-2 border-dashed border-neutral-100">
      <Users size={48} className="mx-auto text-neutral-200 mb-4" />
      <p className="text-neutral-400 font-bold">No team members yet. Send your first invite.</p>
    </div>
  );
}

function InfoLine({ label, value }: { label: string; value?: string }) {
  return (
    <div className="flex justify-between gap-4 text-xs font-bold">
      <span className="text-neutral-400 uppercase tracking-widest">{label}</span>
      <span className="text-neutral-900 text-right">{value || 'N/A'}</span>
    </div>
  );
}

function FormInput({
  label,
  value,
  onChange,
  required,
  type = 'text',
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  type?: string;
  placeholder?: string;
}) {
  return (
    <label className="space-y-2 block">
      <span className="text-xs font-black text-neutral-400 uppercase tracking-widest ml-1">
        {label}
      </span>
      <input
        type={type}
        required={required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-6 py-4 bg-[#111] border border-white/10 rounded-2xl focus:ring-2 focus:ring-orange-500 outline-none transition-all font-bold text-white placeholder:text-neutral-400"
      />
    </label>
  );
}

function StatCard({
  label,
  value,
  trend,
  icon: Icon,
  color,
}: {
  label: string;
  value: string;
  trend: string;
  icon: any;
  color: string;
}) {
  return (
    <div className="bg-white p-6 rounded-3xl border-2 border-neutral-50 shadow-sm">
      <div className={cn('w-12 h-12 rounded-2xl flex items-center justify-center mb-4', color)}>
        <Icon size={24} />
      </div>
      <p className="text-[10px] font-black text-neutral-400 uppercase tracking-widest mb-1">
        {label}
      </p>
      <div className="flex items-baseline justify-between">
        <h4 className="text-2xl font-black text-neutral-900">{value}</h4>
        <span className="text-[10px] font-black text-green-600 bg-green-50 px-2 py-1 rounded-lg">
          {trend}
        </span>
      </div>
    </div>
  );
}
