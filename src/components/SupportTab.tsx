import React, { useState, useEffect } from 'react';
import { apiGet, apiPost } from '../services/apiClient';
import { MessageSquare, Plus, Send, Clock, CheckCircle2, History, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../lib/utils';

interface Ticket {
  id: string;
  userId: string;
  title?: string;
  description?: string;
  subject?: string;
  message?: string;
  status: 'open' | 'closed';
  priority: 'low' | 'medium' | 'high';
  createdAt: any;
  userEmail?: string;
  role: 'customer' | 'trader';
}

interface SupportTabProps {
  userId: string;
  role: 'customer' | 'trader';
}

export default function SupportTab({ userId, role }: SupportTabProps) {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadTickets = async () => {
      try {
        const response = await apiGet<{ tickets: Ticket[] }>('/api/tickets', {
          params: { userId, limit: 50 },
        });
        setTickets(response.tickets || []);
      } catch (error) {
        console.error('Failed to load tickets:', error);
      }
    };
    loadTickets();
  }, [userId]);

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!subject.trim() || !message.trim()) {
      setError('Please fill in both subject and description.');
      return;
    }

    setLoading(true);
    try {
      await apiPost('/api/tickets', {
        userId,
        role,
        title: subject,
        description: message,
        status: 'open',
        priority,
      });
      setSubject('');
      setMessage('');
      setShowCreate(false);
      // Reload tickets
      const response = await apiGet<{ tickets: Ticket[] }>('/api/tickets', {
        params: { userId, limit: 50 },
      });
      setTickets(response.tickets || []);
    } catch (err) {
      console.error('Failed to create ticket:', err);
      setError(err instanceof Error ? err.message : 'Failed to create ticket. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-black text-white uppercase tracking-tight">Support Center</h3>
          <p className="text-xs text-neutral-500 font-bold uppercase tracking-widest mt-1">
            Found a bug or need help? Talk to us.
          </p>
        </div>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="flex items-center gap-2 px-6 py-3 bg-orange-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-orange-700 transition-all shadow-lg shadow-orange-900/20"
        >
          {showCreate ? <History size={16} /> : <Plus size={16} />}
          {showCreate ? 'View Tickets' : 'New Ticket'}
        </button>
      </div>

      <AnimatePresence mode="wait">
        {showCreate ? (
          <motion.form
            key="create"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            onSubmit={handleCreateTicket}
            className="card p-8 bg-[#0a0a0a] border-white/5 space-y-6"
          >
            {error && (
              <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-start gap-3">
                <AlertCircle size={20} className="text-red-500 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-500 font-medium">{error}</p>
              </div>
            )}

            <div>
              <label className="block text-[10px] font-black text-neutral-500 uppercase tracking-widest mb-2">
                Subject
              </label>
              <input
                type="text"
                required
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="What can we help you with?"
                className="w-full px-6 py-4 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-white/10 rounded-2xl text-neutral-900 dark:text-white placeholder:text-neutral-500 outline-none focus:ring-2 focus:ring-orange-500 focus:bg-white dark:focus:bg-neutral-800 transition-all font-bold"
              />
            </div>

            <div>
              <label className="block text-[10px] font-black text-neutral-500 uppercase tracking-widest mb-2">
                Details
              </label>
              <textarea
                required
                rows={4}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Briefly explain the issue..."
                className="w-full px-6 py-4 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-white/10 rounded-2xl text-neutral-900 dark:text-white placeholder:text-neutral-500 outline-none focus:ring-2 focus:ring-orange-500 focus:bg-white dark:focus:bg-neutral-800 transition-all font-bold resize-none"
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              {(['low', 'medium', 'high'] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPriority(p)}
                  className={cn(
                    'py-3 rounded-xl border text-[10px] font-black uppercase tracking-widest transition-all',
                    priority === p
                      ? 'bg-orange-600 border-orange-600 text-white'
                      : 'bg-white/5 border-white/10 text-neutral-500'
                  )}
                >
                  {p}
                </button>
              ))}
            </div>

            <button
              disabled={loading}
              className="w-full py-4 bg-white text-black rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-neutral-200 transition-all flex items-center justify-center gap-2 shadow-xl"
            >
              {loading ? 'Submitting...' : 'Submit Ticket'}
              <Send size={16} />
            </button>
          </motion.form>
        ) : (
          <motion.div
            key="list"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-4"
          >
            {tickets.length > 0 ? (
              tickets.map((ticket) => (
                <div
                  key={ticket.id}
                  className="card p-6 bg-[#0a0a0a] border-white/5 flex items-center justify-between group hover:border-orange-500/20 transition-all shadow-sm"
                >
                  <div className="flex items-center gap-4">
                    <div
                      className={cn(
                        'w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg transition-transform group-hover:scale-110',
                        ticket.status === 'open'
                          ? 'bg-blue-600/10 text-blue-500'
                          : 'bg-green-600/10 text-green-500'
                      )}
                    >
                      {ticket.status === 'open' ? <Clock size={24} /> : <CheckCircle2 size={24} />}
                    </div>
                    <div>
                      <h4 className="font-black text-white text-sm tracking-tight">
                        {ticket.title || ticket.subject}
                      </h4>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-[10px] text-neutral-500 font-bold uppercase tracking-widest">
                          {new Date(
                            ticket.createdAt?.toDate?.() || ticket.createdAt
                          ).toLocaleDateString()}
                        </span>
                        <span
                          className={cn(
                            'px-2 py-0.5 rounded-lg text-[8px] font-black uppercase tracking-widest border',
                            ticket.priority === 'high'
                              ? 'bg-red-500/10 text-red-500 border-red-500/20'
                              : ticket.priority === 'medium'
                                ? 'bg-orange-500/10 text-orange-500 border-orange-500/20'
                                : 'bg-blue-500/10 text-blue-500 border-blue-500/20'
                          )}
                        >
                          {ticket.priority} priority
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span
                      className={cn(
                        'px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border transition-all',
                        ticket.status === 'open'
                          ? 'bg-blue-600/10 text-blue-500 border-blue-600/20'
                          : 'bg-green-600/10 text-green-500 border-green-600/20'
                      )}
                    >
                      {ticket.status}
                    </span>
                    <p className="text-[9px] text-neutral-600 font-medium">
                      #{ticket.id.substring(0, 8)}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <div className="py-20 text-center space-y-4 bg-white/5 border border-dashed border-white/10 rounded-[2.5rem]">
                <div className="w-16 h-16 bg-white/5 text-neutral-600 rounded-[2rem] flex items-center justify-center mx-auto mb-4 border border-white/10">
                  <MessageSquare size={32} />
                </div>
                <h4 className="text-white font-black uppercase tracking-tight">
                  No Active Tickets
                </h4>
                <p className="text-xs text-neutral-500 max-w-xs mx-auto font-medium">
                  Have an issue? Create a support ticket and our Nexus Agents will help you shortly.
                </p>
                <button
                  onClick={() => setShowCreate(true)}
                  className="text-orange-500 text-[10px] font-black uppercase tracking-[0.2em] hover:underline"
                >
                  Create your first ticket
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
