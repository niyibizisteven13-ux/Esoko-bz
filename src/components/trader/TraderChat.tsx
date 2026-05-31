import React, { useState, useEffect, useRef } from 'react';
import {
  MessageSquare,
  Send,
  Search,
  Users,
  Hash,
  Circle,
  MoreVertical,
  Paperclip,
  Smile,
  Image as ImageIcon,
  Pin,
  ChevronRight,
  User,
  Menu,
  X,
  ChevronLeft,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { auth } from '../../firebase';
import {
  collection,
  query,
  where,
  onSnapshot,
  addDoc,
  Timestamp,
  orderBy,
  limit,
  serverTimestamp,
} from '../../services/firestoreBridge';
const db = undefined; // Used by firestoreBridge
import { useLanguage } from '../../context/LanguageContext';
import { cn } from '../../lib/utils';
import { format } from 'date-fns';
import { handleFirestoreError, OperationType } from '../../lib/firestoreErrorHandler';

export default function TraderChat({ traderId }: { traderId: string }) {
  const { t } = useLanguage();
  const [members, setMembers] = useState<any[]>([]);
  const [messages, setMessages] = useState<any[]>([]);
  const [activeChannel, setActiveChannel] = useState<'general' | string>('general');
  const [messageInput, setMessageInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [showSidebar, setShowSidebar] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Fetch team members
    const qMembers = query(collection(db, 'team_members'), where('traderId', '==', traderId));
    const unsubMembers = onSnapshot(
      qMembers,
      (snapshot) => {
        setMembers(snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() })));
      },
      (err) => {
        try {
          handleFirestoreError(err, OperationType.LIST, 'team_members');
        } catch (e) {
          // Log quietly as this can happen during fast navigation
          console.warn('TraderChat team members fetch error:', e);
        }
      }
    );

    // Fetch messages for active channel
    const qMessages = query(
      collection(db, 'messages'),
      where('traderId', '==', traderId),
      where('channel', '==', activeChannel),
      orderBy('timestamp', 'asc'),
      limit(100)
    );

    const unsubMessages = onSnapshot(
      qMessages,
      (snapshot) => {
        setMessages(snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() })));
        setLoading(false);
        setTimeout(() => {
          scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
        }, 100);
      },
      (err) => {
        try {
          handleFirestoreError(err, OperationType.LIST, 'messages');
        } catch (e) {
          console.warn('TraderChat messages fetch error:', e);
        }
      }
    );

    return () => {
      unsubMembers();
      unsubMessages();
    };
  }, [traderId, activeChannel]);

  const handleSendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!messageInput.trim()) return;

    const msg = messageInput.trim();
    setMessageInput('');

    try {
      await addDoc(collection(db, 'messages'), {
        traderId,
        channel: activeChannel,
        text: msg,
        senderId: auth.currentUser?.uid,
        senderName: auth.currentUser?.displayName || 'Merchant',
        timestamp: serverTimestamp(),
      });
    } catch (err) {
      console.error('Chat error:', err);
    }
  };

  return (
    <div className="h-[calc(100vh-150px)] flex bg-white dark:bg-neutral-900 rounded-[2.5rem] border-2 border-neutral-100 dark:border-neutral-800 overflow-hidden shadow-sm relative">
      {/* Sidebar - Controlled by showSidebar */}
      <AnimatePresence initial={false}>
        {showSidebar && (
          <motion.div
            initial={{ width: 0, x: -256 }}
            animate={{ width: 256, x: 0 }}
            exit={{ width: 0, x: -256 }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="border-r border-neutral-100 dark:border-neutral-800 flex flex-col bg-neutral-50/50 dark:bg-neutral-900/50 z-20 h-full overflow-hidden shrink-0"
          >
            <div className="p-4 border-b border-neutral-100 dark:border-neutral-800 flex justify-between items-center bg-white dark:bg-neutral-900">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-orange-600 rounded-lg flex items-center justify-center text-white shadow-lg shadow-orange-900/20">
                  <MessageSquare size={16} />
                </div>
                <h3 className="text-sm font-black text-neutral-900 dark:text-white uppercase tracking-tight">
                  Conversations
                </h3>
              </div>
              <button
                onClick={() => setShowSidebar(false)}
                className="p-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg text-neutral-400 sm:hidden"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-4 border-b border-neutral-100 dark:border-neutral-800">
              <div className="relative">
                <Search
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400"
                  size={14}
                />
                <input
                  type="text"
                  placeholder="Search Members..."
                  className="w-full pl-9 pr-3 py-1.5 bg-white dark:bg-neutral-800 border border-neutral-100 dark:border-neutral-800 rounded-lg text-[10px] font-bold text-neutral-900 dark:text-white outline-none focus:ring-2 focus:ring-orange-500 transition-all"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto no-scrollbar p-4 space-y-8">
              <div>
                <div className="flex justify-between items-center px-2 mb-3">
                  <p className="text-[10px] font-black text-neutral-400 uppercase tracking-widest">
                    Team Members
                  </p>
                  <button className="text-orange-600 hover:text-orange-700 transition-colors">
                    <Users size={14} />
                  </button>
                </div>
                <div className="space-y-1">
                  {members.map((member) => (
                    <MemberItem
                      key={member.id}
                      member={member}
                      active={activeChannel === member.id}
                      onClick={() => {
                        setActiveChannel(member.id);
                        if (window.innerWidth < 768) setShowSidebar(false);
                      }}
                    />
                  ))}
                  {members.length === 0 && (
                    <p className="px-2 text-[10px] text-neutral-400 font-medium italic">
                      No team members online
                    </p>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col bg-white dark:bg-neutral-950 relative">
        {/* Header */}
        <div className="px-4 py-3 border-b border-neutral-100 dark:border-neutral-800 bg-white dark:bg-neutral-900/50 flex flex-col gap-3 z-10 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowSidebar(!showSidebar)}
                className={cn(
                  'p-2 bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 rounded-xl hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-all',
                  showSidebar && 'text-orange-600 bg-orange-600/10'
                )}
                title={showSidebar ? 'Hide Sidebar' : 'Show Sidebar'}
              >
                {showSidebar ? <X size={20} /> : <Menu size={20} />}
              </button>

              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-neutral-100 dark:bg-neutral-800 rounded-xl flex items-center justify-center text-orange-600">
                  {['general', 'sales', 'inventory'].includes(activeChannel) ? (
                    <Hash size={20} />
                  ) : (
                    <User size={20} />
                  )}
                </div>
                <div className="min-w-0">
                  <h4 className="text-sm sm:text-base font-black text-neutral-900 dark:text-white leading-tight truncate">
                    {activeChannel === 'general'
                      ? 'General Channel'
                      : activeChannel === 'sales'
                        ? 'Sales Team Group'
                        : activeChannel === 'inventory'
                          ? 'Inventory Logistics'
                          : members.find((m) => m.id === activeChannel)?.name || 'Direct Message'}
                  </h4>
                  <p className="text-[9px] font-bold text-green-500 uppercase tracking-widest flex items-center gap-1">
                    <Circle size={6} className="fill-current animate-pulse" /> Active Now
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button className="p-2 bg-neutral-50 dark:bg-neutral-800 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 rounded-lg transition-all hidden sm:flex">
                <Pin size={16} />
              </button>
              <button className="p-2 bg-neutral-50 dark:bg-neutral-800 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 rounded-lg transition-all">
                <MoreVertical size={16} />
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pt-1">
            <ChannelTab
              label="General"
              active={activeChannel === 'general'}
              onClick={() => setActiveChannel('general')}
            />
            <ChannelTab
              label="Sales Team"
              active={activeChannel === 'sales'}
              onClick={() => setActiveChannel('sales')}
            />
            <ChannelTab
              label="Inventory"
              active={activeChannel === 'inventory'}
              onClick={() => setActiveChannel('inventory')}
            />
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
          {messages.map((msg, i) => {
            const isMe = msg.senderId === auth.currentUser?.uid;
            const showMetadata = i === 0 || messages[i - 1].senderId !== msg.senderId;

            return (
              <div
                key={msg.id}
                className={cn(
                  'flex flex-col max-w-[80%]',
                  isMe ? 'ml-auto items-end' : 'items-start'
                )}
              >
                {showMetadata && !isMe && (
                  <p className="text-[10px] font-black text-neutral-400 uppercase tracking-widest mb-1 ml-1">
                    {msg.senderName}
                  </p>
                )}
                <div
                  className={cn(
                    'p-4 rounded-3xl text-sm font-medium leading-relaxed shadow-sm',
                    isMe
                      ? 'bg-orange-600 text-white rounded-tr-none'
                      : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-200 rounded-tl-none'
                  )}
                >
                  {msg.text}
                </div>
                <p className="text-[8px] font-bold text-neutral-300 dark:text-neutral-600 uppercase mt-1 px-1">
                  {msg.timestamp?.toDate ? format(msg.timestamp.toDate(), 'HH:mm') : 'Just now'}
                </p>
              </div>
            );
          })}
          <div ref={scrollRef} />
        </div>

        {/* Input */}
        <div className="p-4 bg-white dark:bg-neutral-900/50 border-t border-neutral-100 dark:border-neutral-800">
          <form onSubmit={handleSendMessage} className="relative">
            <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
              <button
                type="button"
                className="p-1.5 text-neutral-400 hover:text-orange-600 transition-colors"
              >
                <Paperclip size={16} />
              </button>
              <button
                type="button"
                className="p-1.5 text-neutral-400 hover:text-orange-600 transition-colors hidden sm:block"
              >
                <ImageIcon size={16} />
              </button>
            </div>
            <input
              type="text"
              value={messageInput}
              onChange={(e) => setMessageInput(e.target.value)}
              placeholder="Type your message..."
              className="w-full pl-24 pr-14 py-3 bg-neutral-50 dark:bg-neutral-800 border border-neutral-100 dark:border-neutral-800 rounded-2xl text-xs font-bold text-neutral-900 dark:text-white outline-none focus:ring-2 focus:ring-orange-500 transition-all"
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
              <button
                type="button"
                className="p-1.5 text-neutral-400 hover:text-orange-600 transition-colors hidden sm:block"
              >
                <Smile size={16} />
              </button>
              <button
                disabled={!messageInput.trim()}
                className="w-10 h-10 bg-orange-600 text-white rounded-xl flex items-center justify-center hover:bg-orange-700 transition-all shadow-lg shadow-orange-900/20 disabled:opacity-50"
              >
                <Send size={16} />
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

function ChannelTab({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 border whitespace-nowrap',
        active
          ? 'bg-orange-600 text-white border-orange-500 shadow-lg shadow-orange-900/20'
          : 'bg-white/5 text-neutral-500 border-white/5 hover:bg-neutral-50 dark:hover:bg-neutral-800'
      )}
    >
      <Hash size={14} /> {label}
    </button>
  );
}

function MemberItem({
  member,
  active,
  onClick,
}: {
  member: any;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full flex items-center justify-between p-3 rounded-xl transition-all group',
        active
          ? 'bg-orange-50 dark:bg-orange-900/20 text-orange-600'
          : 'text-neutral-500 hover:bg-neutral-50 dark:hover:bg-neutral-800'
      )}
    >
      <div className="flex items-center gap-3">
        <div className="relative">
          <div className="w-8 h-8 bg-neutral-200 dark:bg-neutral-700 rounded-lg flex items-center justify-center font-black text-xs text-neutral-400">
            {member.name?.[0] || 'M'}
          </div>
          <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-green-500 border-2 border-white dark:border-neutral-900 rounded-full" />
        </div>
        <div className="text-left">
          <p className="text-xs font-bold leading-none mb-1">{member.name}</p>
          <p className="text-[8px] font-black text-neutral-400 uppercase tracking-widest">
            {member.role || 'Member'}
          </p>
        </div>
      </div>
      <ChevronRight
        size={14}
        className={cn(
          'transition-colors',
          active ? 'opacity-100' : 'opacity-0 group-hover:opacity-40'
        )}
      />
    </button>
  );
}
