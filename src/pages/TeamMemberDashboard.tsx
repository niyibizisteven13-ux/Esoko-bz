import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  TrendingUp,
  LogOut,
  Activity,
  Target,
  Zap,
  ShieldCheck,
  CheckCircle2,
  Clock,
  AlertCircle,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, useParams } from 'react-router-dom';
import { collection, query, where, onSnapshot, updateDoc, doc } from '../services/firestoreBridge';
const db = undefined; // Used by firestoreBridge
import { useLanguage } from '../context/LanguageContext';
import { cn } from '../lib/utils';
import Logo from '../components/Logo';

export default function TeamMemberDashboard() {
  const { t } = useLanguage();
  const { memberId } = useParams();
  const [activeTab, setActiveTab] = useState('workspace');
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    if (!memberId) return;
    const q = query(collection(db, 'tasks'), where('assignedTo', '==', memberId));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setTasks(snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    });
    return () => unsubscribe();
  }, [memberId]);

  const updateTaskStatus = async (taskId: string, status: string) => {
    try {
      await updateDoc(doc(db, 'tasks', taskId), { status });
    } catch (error) {
      console.error('Error updating task status:', error);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-50 flex flex-col md:flex-row">
      {/* Sidebar */}
      <aside className="w-full md:w-64 bg-slate-900 text-white p-6 flex flex-col">
        <Logo dark className="mb-10 scale-90 origin-left" />

        <nav className="flex-1 space-y-1">
          <SidebarItem
            active={activeTab === 'workspace'}
            onClick={() => setActiveTab('workspace')}
            icon={<LayoutDashboard size={20} />}
            label={t.team.workspace}
          />
          <SidebarItem
            active={activeTab === 'performance'}
            onClick={() => setActiveTab('performance')}
            icon={<TrendingUp size={20} />}
            label={t.team.performance}
          />
          <SidebarItem
            active={activeTab === 'tasks'}
            onClick={() => setActiveTab('tasks')}
            icon={<Target size={20} />}
            label={t.team.tasks}
          />
        </nav>

        <button
          onClick={() => navigate('/login')}
          className="mt-auto flex items-center gap-3 p-3 text-white/60 hover:text-white hover:bg-white/5 rounded-xl transition-all font-bold text-sm"
        >
          <LogOut size={20} /> {t.common.logout}
        </button>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-8 h-screen overflow-y-auto no-scrollbar">
        <div className="max-w-6xl mx-auto space-y-8">
          <header className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-black text-neutral-900 tracking-tight">
                {t.team.individualCockpit}
              </h1>
              <p className="text-neutral-500 font-medium">{t.team.isolatedEnv}</p>
            </div>
            <div className="flex items-center gap-3 bg-white px-4 py-2 rounded-2xl border border-neutral-100 shadow-sm">
              <ShieldCheck className="text-green-500" size={20} />
              <span className="text-xs font-black text-neutral-600 uppercase tracking-widest">
                {t.team.secureSession}
              </span>
            </div>
          </header>

          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="space-y-8"
            >
              {activeTab === 'workspace' && (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <StatCard
                      label={t.common.todaySales}
                      value="RWF 125,000"
                      trend="+12%"
                      icon={Zap}
                      color="text-orange-600 bg-orange-50"
                    />
                    <StatCard
                      label={t.team.tasksCompleted}
                      value={`${tasks.filter((t) => t.status === 'completed').length}/${tasks.length}`}
                      trend={t.team.onTrack}
                      icon={Target}
                      color="text-blue-600 bg-blue-50"
                    />
                    <StatCard
                      label={t.team.uptime}
                      value="100%"
                      trend={t.team.stable}
                      icon={Activity}
                      color="text-green-600 bg-green-50"
                    />
                  </div>

                  <div className="bg-white p-8 rounded-[3rem] border-2 border-neutral-100 shadow-xl shadow-neutral-100/50">
                    <h3 className="text-xl font-black text-neutral-900 mb-6 flex items-center gap-3">
                      <Activity size={24} className="text-orange-600" /> {t.team.isolatedExecution}
                    </h3>
                    <div className="space-y-6">
                      <p className="text-neutral-500 font-medium">{t.team.dedicatedWorkspace}</p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <button className="p-6 bg-neutral-50 rounded-3xl border border-neutral-100 hover:border-orange-600 transition-all text-left group">
                          <ShoppingCart
                            className="text-neutral-400 group-hover:text-orange-600 mb-4"
                            size={32}
                          />
                          <h4 className="font-black text-neutral-900">{t.team.processSale}</h4>
                          <p className="text-xs text-neutral-400 font-bold">
                            {t.team.recordTransaction}
                          </p>
                        </button>
                        <button className="p-6 bg-neutral-50 rounded-3xl border border-neutral-100 hover:border-orange-600 transition-all text-left group">
                          <Package
                            className="text-neutral-400 group-hover:text-orange-600 mb-4"
                            size={32}
                          />
                          <h4 className="font-black text-neutral-900">{t.team.checkStock}</h4>
                          <p className="text-xs text-neutral-400 font-bold">
                            {t.team.viewInventory}
                          </p>
                        </button>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {activeTab === 'tasks' && (
                <div className="space-y-6">
                  <div className="flex justify-between items-center">
                    <h3 className="text-2xl font-black text-neutral-900">{t.team.tasks}</h3>
                  </div>
                  <div className="grid grid-cols-1 gap-4">
                    {tasks.map((task) => (
                      <div
                        key={task.id}
                        className="bg-white p-6 rounded-3xl border-2 border-neutral-50 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4"
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h4 className="font-black text-neutral-900 text-lg">{task.title}</h4>
                            <span
                              className={cn(
                                'px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest',
                                task.priority === 'high'
                                  ? 'text-red-600 bg-red-50'
                                  : task.priority === 'medium'
                                    ? 'text-orange-600 bg-orange-50'
                                    : 'text-blue-600 bg-blue-50'
                              )}
                            >
                              {task.priority}
                            </span>
                          </div>
                          <p className="text-neutral-500 font-medium text-sm mb-4">
                            {task.description}
                          </p>
                          <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2 text-neutral-400">
                              <Clock size={14} />
                              <span className="text-xs font-bold">
                                {t.team.dueDate}:{' '}
                                <span className="text-red-600">{task.dueDate}</span>
                              </span>
                            </div>
                            <div className="flex items-center gap-2 text-neutral-400">
                              <AlertCircle size={14} />
                              <span className="text-xs font-bold uppercase tracking-widest">
                                {task.status}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-2 w-full md:w-auto">
                          {task.status !== 'completed' ? (
                            <button
                              onClick={() => updateTaskStatus(task.id, 'completed')}
                              className="flex-1 md:flex-none px-6 py-3 bg-green-600 text-white rounded-xl font-bold text-sm hover:bg-green-700 transition-all flex items-center justify-center gap-2"
                            >
                              <CheckCircle2 size={18} /> {t.common.done}
                            </button>
                          ) : (
                            <div className="flex items-center gap-2 text-green-600 font-bold text-sm px-6 py-3 bg-green-50 rounded-xl">
                              <CheckCircle2 size={18} /> {t.common.success}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                    {tasks.length === 0 && (
                      <div className="py-20 text-center bg-white rounded-[3rem] border-2 border-dashed border-neutral-100">
                        <Target size={48} className="mx-auto text-neutral-200 mb-4" />
                        <p className="text-neutral-400 font-bold">{t.team.noTasks}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {activeTab === 'performance' && (
                <div className="bg-white p-8 rounded-[3rem] border-2 border-neutral-100 shadow-xl shadow-neutral-100/50 text-center py-20">
                  <TrendingUp size={48} className="mx-auto text-neutral-200 mb-4" />
                  <h3 className="text-xl font-black text-neutral-900 mb-2">{t.team.performance}</h3>
                  <p className="text-neutral-500 font-medium">
                    Performance analytics will appear here as you complete tasks and process sales.
                  </p>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}

function SidebarItem({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-3 p-3 rounded-xl transition-all font-bold text-sm',
        active
          ? 'bg-orange-600 text-white shadow-lg shadow-orange-900/20'
          : 'text-white/60 hover:text-white hover:bg-white/5'
      )}
    >
      {icon}
      {label}
    </button>
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
