import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  MessageSquare,
  Send,
  Search,
  Hash,
  Circle,
  MoreVertical,
  Paperclip,
  Image as ImageIcon,
  Pin,
  Activity,
  BellOff,
  Users,
  ChevronRight,
  User,
  Menu,
  X,
  MessageCircle,
  FileText,
  Play,
  Mic,
  Trash2,
  Star,
  Forward,
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
import {
  saveAttachmentRecord,
  getAttachmentRecords,
  AttachmentRecord,
} from '../../services/attachmentStorage';

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatChatTime(timestamp: any) {
  return format(timestamp?.toDate?.() || new Date(), 'hh:mm a');
}

interface MessageItem {
  id: string;
  traderId: string;
  channel: string;
  text: string;
  senderId: string;
  senderName: string;
  timestamp: any;
  type?: 'text' | 'image' | 'document' | 'voice';
  attachmentId?: string;
  attachmentType?: 'image' | 'document';
  fileSize?: string;
  duration?: string;
  isStarred?: boolean;
  mediaUrl?: string;
}

interface MemberItem {
  id: string;
  traderId: string;
  name?: string;
  role?: string;
}

const CHANNELS = [
  { id: 'general', label: 'General' },
  { id: 'sales_team', label: 'Sales Team' },
  { id: 'inventory', label: 'Inventory' },
];

export default function TraderChat({ traderId }: { traderId: string }) {
  const { t } = useLanguage();
  const [members, setMembers] = useState<MemberItem[]>([]);
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [pendingLocalMessages, setPendingLocalMessages] = useState<MessageItem[]>([]);
  const pendingLocalMessagesRef = useRef<MessageItem[]>(pendingLocalMessages);
  const [activeChannel, setActiveChannel] = useState<'general' | string>('general');
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [messageInput, setMessageInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [showSidebar, setShowSidebar] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [replyingTo, setReplyingTo] = useState<MessageItem | null>(null);
  const [activeDropdownId, setActiveDropdownId] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordTime, setRecordTime] = useState(0);
  const [isTypingSimulated, setIsTypingSimulated] = useState(false);

  const messageEndRef = useRef<HTMLDivElement>(null);
  const recordingInterval = useRef<NodeJS.Timeout | null>(null);

  const filteredMembers = useMemo(() => {
    if (!searchQuery.trim()) return members;
    const queryStr = searchQuery.toLowerCase();
    return members.filter(
      (m: MemberItem) =>
        (m.name && m.name.toLowerCase().includes(queryStr)) ||
        (m.role && m.role.toLowerCase().includes(queryStr))
    );
  }, [members, searchQuery]);

  useEffect(() => {
    pendingLocalMessagesRef.current = pendingLocalMessages;
  }, [pendingLocalMessages]);

  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTypingSimulated]);

  useEffect(() => {
    if (isRecording) {
      recordingInterval.current = setInterval(() => {
        setRecordTime((prev) => prev + 1);
      }, 1000);
    } else {
      if (recordingInterval.current) {
        clearInterval(recordingInterval.current);
      }
    }
    return () => {
      if (recordingInterval.current) {
        clearInterval(recordingInterval.current);
      }
    };
  }, [isRecording]);

  useEffect(() => {
    setLoading(true);

    const qMembers = query(collection(db, 'team_members'), where('traderId', '==', traderId));
    const unsubMembers = onSnapshot(
      qMembers,
      (snapshot: any) => {
        setMembers(snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() })));
      },
      (err: any) => {
        try {
          handleFirestoreError(err, OperationType.LIST, 'team_members');
        } catch (e) {
          console.warn('TraderChat team members fetch error:', e);
        }
      }
    );

    const qMessages = query(
      collection(db, 'messages'),
      where('traderId', '==', traderId),
      where('channel', '==', activeChannel),
      orderBy('timestamp', 'asc'),
      limit(100)
    );

    const unsubMessages = onSnapshot(
      qMessages,
      async (snapshot: any) => {
        const items = snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));

        const storedAttachments = await getAttachmentRecords(auth.currentUser?.uid || 'local', activeChannel);
        const byId = Object.fromEntries(storedAttachments.map((attachment) => [attachment.id, attachment]));

        const hydrated = items.map((item: MessageItem) => {
          if (!item.attachmentId) return item;
          const attachment = byId[item.attachmentId];
          if (!attachment) return item;
          return {
            ...item,
            mediaUrl: URL.createObjectURL(attachment.blob),
          };
        });

        const serverAttachmentIds = new Set(
          hydrated.filter((item: MessageItem) => item.attachmentId).map((item: MessageItem) => item.attachmentId)
        );

        setPendingLocalMessages((current: MessageItem[]) =>
          current.filter((msg: MessageItem) => !msg.attachmentId || !serverAttachmentIds.has(msg.attachmentId))
        );

        const pending = pendingLocalMessagesRef.current.filter(
          (msg: MessageItem) => !msg.attachmentId || !serverAttachmentIds.has(msg.attachmentId)
        );

        const merged = [...hydrated, ...pending].sort((a: MessageItem, b: MessageItem) => {
          const aTime = a.timestamp?.toDate?.()?.getTime?.() ?? new Date(a.timestamp).getTime();
          const bTime = b.timestamp?.toDate?.()?.getTime?.() ?? new Date(b.timestamp).getTime();
          return aTime - bTime;
        });

        setMessages(merged);
        setLoading(false);
      },
      (err: any) => {
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

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setMessageInput(e.target.value);
    if (e.target.value.length > 0 && !isTypingSimulated) {
      setIsTypingSimulated(true);
      setTimeout(() => setIsTypingSimulated(false), 2400);
    }
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const trimmed = messageInput.trim();
    if (!trimmed) return;

    setMessageInput('');
    setReplyingTo(null);

    try {
      await addDoc(collection(db, 'messages'), {
        traderId,
        channel: activeChannel,
        text: trimmed,
        senderId: auth.currentUser?.uid,
        senderName: auth.currentUser?.displayName || 'MERCHANT',
        timestamp: serverTimestamp(),
        type: 'text',
      });
    } catch (err) {
      console.error('Chat error:', err);
    }
  };

  const handleSendVoiceNote = async () => {
    if (!recordTime) return;
    setIsRecording(false);
    setRecordTime(0);

    try {
      await addDoc(collection(db, 'messages'), {
        traderId,
        channel: activeChannel,
        text: `Voice note (${recordTime}s)`,
        senderId: auth.currentUser?.uid,
        senderName: auth.currentUser?.displayName || 'MERCHANT',
        timestamp: serverTimestamp(),
        type: 'voice',
        duration: `0:${recordTime.toString().padStart(2, '0')}`,
      });
    } catch (err) {
      console.error('Voice note send error:', err);
    }
  };

  const getChannelDisplayName = (channelId: string) => {
    const channel = CHANNELS.find((c) => c.id === channelId);
    if (channel) return `# ${channel.label}`;
    const member = members.find((m) => m.id === channelId);
    return member ? `@ ${member.name}` : 'Direct Message';
  };

  const isChannelView = CHANNELS.some((c) => c.id === activeChannel);

  const isConsecutive = (current: MessageItem, previous: MessageItem | undefined): boolean => {
    if (!previous) return false;
    if (current.senderId !== previous.senderId) return false;
    const currentTime = current.timestamp?.toDate?.()?.getTime?.();
    const previousTime = previous.timestamp?.toDate?.()?.getTime?.();
    if (!currentTime || !previousTime) return false;
    return currentTime - previousTime < 5 * 60 * 1000;
  };

  const toggleStarMessage = (id: string): void => {
    setMessages((prev: MessageItem[]) =>
      prev.map((msg: MessageItem) => (msg.id === id ? { ...msg, isStarred: !msg.isStarred } : msg))
    );
    setActiveDropdownId(null);
  };

  const activeMember = members.find((m) => m.id === activeChannel);

  // File/image upload refs and handler for local previews
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);

  const handleFileUploadTrigger = async (e: React.ChangeEvent<HTMLInputElement>, category: 'image' | 'all') => {
    const file = e.target?.files?.[0];
    if (!file) return;

    const attachmentId = `attachment_${Date.now()}`;
    const msgType = category === 'image' ? 'image' : 'document';
    const localUrl = URL.createObjectURL(file);

    const attachmentRecord: AttachmentRecord = {
      id: attachmentId,
      ownerId: auth.currentUser?.uid || 'local',
      channel: activeChannel,
      fileName: file.name,
      fileSize: formatFileSize(file.size),
      type: msgType,
      blob: file,
      createdAt: new Date().toISOString(),
    };

    try {
      await saveAttachmentRecord(attachmentRecord);
    } catch (err) {
      console.error('Attachment save error:', err);
    }

    const mediaMsg: MessageItem = {
      id: `file_${Date.now()}`,
      traderId,
      channel: activeChannel,
      text: file.name,
      senderId: auth.currentUser?.uid || 'local',
      senderName: auth.currentUser?.displayName || 'You',
      timestamp: { toDate: () => new Date() },
      type: msgType as any,
      attachmentId,
      attachmentType: msgType,
      fileSize: formatFileSize(file.size),
      mediaUrl: localUrl,
    };

    setPendingLocalMessages((prev) => [...prev, mediaMsg]);
    setMessages((prev) => [...prev, mediaMsg]);
    e.target.value = '';

    try {
      await addDoc(collection(db, 'messages'), {
        traderId,
        channel: activeChannel,
        text: file.name,
        senderId: auth.currentUser?.uid,
        senderName: auth.currentUser?.displayName || 'Merchant',
        timestamp: serverTimestamp(),
        type: msgType,
        attachmentId,
        attachmentType: msgType,
        fileName: file.name,
        fileSize: formatFileSize(file.size),
      });
    } catch (err) {
      console.error('Attachment message send error:', err);
    }
  };

  const triggerFileSelect = (kind: 'image' | 'all') => {
    if (kind === 'image') {
      imageInputRef.current?.click();
    } else {
      fileInputRef.current?.click();
    }
  };

  const getMaskedChannelKey = (channelId: string) => {
    if (channelId.startsWith('local_')) return 'Draft';
    return channelId.length > 12 ? `${channelId.slice(0, 6)}•••${channelId.slice(-4)}` : channelId;
  };

  const hudTitle = isChannelView ? 'Channel Listeners' : 'Direct Interaction Profile';
  const hudSubtitle = isChannelView
    ? `${members.length} active listeners in this room`
    : `${activeMember?.name || 'Direct thread'} • ${activeMember?.role || 'Support Access'} `;

  const hudDetailRows = isChannelView
    ? [
        { label: 'Total logs', value: `${messages.length}` },
        { label: 'Room objective', value: 'Drive sales velocity' },
        { label: 'Engagement', value: `${members.length * 3} mentions` },
      ]
    : [
        { label: 'Security clearance', value: 'Monitored' },
        { label: 'Common shares', value: '4 attachments' },
        { label: 'Support role', value: activeMember?.role || 'Collaborator' },
      ];

  return (
    <div className="h-full w-full flex bg-gradient-to-tr from-[#030303] via-[#09090b] to-[#121217] rounded-3xl border border-white/10 overflow-hidden shadow-2xl relative text-white min-h-0">
      <AnimatePresence initial={false}>
        {showSidebar && (
          <motion.div
            initial={{ x: -280, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -280, opacity: 0 }}
            transition={{ type: 'spring', damping: 26, stiffness: 220 }}
            className="w-72 border-r border-white/10 flex flex-col bg-zinc-900/60 backdrop-blur-md z-20 h-full overflow-hidden shrink-0"
          >
            <div className="p-4 border-b border-white/10 flex justify-between items-center bg-zinc-900/80">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-2xl bg-orange-600 flex items-center justify-center shadow-lg shadow-orange-900/20">
                  <MessageSquare size={16} className="text-white" />
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-[0.35em] text-white/40 font-semibold">
                    Team Messenger
                  </p>
                  <p className="text-sm font-black text-white tracking-tight">Operations</p>
                </div>
              </div>
              <button
                onClick={() => setShowSidebar(false)}
                className="p-2 rounded-xl text-white/60 hover:bg-white/10 transition-colors sm:hidden"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-4 border-b border-white/10">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" size={14} />
                <input
                  type="text"
                  placeholder="Search people..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-2xl py-2 pl-10 pr-3 text-xs font-semibold text-white placeholder:text-white/30 outline-none focus:border-orange-500/40 focus:ring-2 focus:ring-orange-500/10 transition-all"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-5 no-scrollbar min-h-0">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-[10px] uppercase tracking-[0.4em] font-black text-white/30">
                    Workspace Channels
                  </p>
                </div>
                <div className="space-y-2">
                  {CHANNELS.map((channel) => (
                    <button
                      key={channel.id}
                      onClick={() => {
                        setActiveChannel(channel.id);
                        setIsEditingProfile(false);
                        setReplyingTo(null);
                      }}
                      className={cn(
                        'w-full flex items-center gap-3 px-3 py-2 rounded-2xl text-xs font-semibold transition-all text-left',
                        activeChannel === channel.id
                          ? 'bg-orange-500/10 text-orange-500'
                          : 'text-white/60 hover:bg-white/5 hover:text-white'
                      )}
                    >
                      <Hash
                        size={14}
                        className={activeChannel === channel.id ? 'text-orange-500' : 'text-white/30'}
                      />
                      <span>{channel.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-[10px] uppercase tracking-[0.4em] font-black text-white/30">
                    Direct Messages
                  </p>
                  <div className="flex items-center gap-1 text-white/40 text-[10px]">
                    <User size={12} />
                    <span>{filteredMembers.length}</span>
                  </div>
                </div>

                <div className="space-y-2">
                  {filteredMembers.map((member) => (
                    <button
                      key={member.id}
                      onClick={() => {
                        setActiveChannel(member.id);
                        setIsEditingProfile(true);
                        setReplyingTo(null);
                      }}
                      className={cn(
                        'w-full flex items-center justify-between gap-3 px-3 py-2 rounded-2xl text-xs font-semibold transition-all',
                        activeChannel === member.id
                          ? 'bg-orange-500/10 text-orange-500'
                          : 'text-white/60 hover:bg-white/5 hover:text-white'
                      )}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 bg-zinc-900 rounded-2xl border border-white/10 flex items-center justify-center text-[10px] text-white">
                          {member.name?.charAt(0) || <User size={12} />}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate">{member.name || 'Team Member'}</p>
                          <p className="text-[10px] text-white/40 truncate">{member.role || 'Collaborator'}</p>
                        </div>
                      </div>
                      <Circle size={8} className="text-emerald-500 fill-emerald-500" />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex-1 flex flex-col min-w-0">
        <div className="h-16 flex items-center justify-between px-6 border-b border-white/10 bg-zinc-900/70 backdrop-blur-md">
          <div className="flex items-center gap-3">
            {!showSidebar && (
              <button
                onClick={() => setShowSidebar(true)}
                className="p-2 rounded-xl bg-white/5 text-white/70 hover:bg-white/10 transition-colors"
              >
                <Menu size={18} />
              </button>
            )}
            <div className="flex flex-col">
              <span className="text-sm font-black text-white">{getChannelDisplayName(activeChannel)}</span>
              <span className="text-[11px] text-white/40">
                {isChannelView ? 'Workspace channel' : 'Direct message'}
              </span>
            </div>
          </div>
          <button className="flex items-center gap-2 px-3 py-2 bg-white/5 border border-white/10 rounded-2xl text-xs text-white/70 hover:bg-white/10 transition-all">
            <MoreVertical size={14} />
            <span>Options</span>
          </button>
        </div>

        {isEditingProfile ? (
          <div className="flex-1 min-h-0 overflow-y-auto bg-zinc-950 p-8">
            <div className="max-w-3xl mx-auto">
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => setIsEditingProfile(false)}
                  className="p-3 rounded-2xl bg-white/5 text-white/70 hover:bg-white/10 transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="mt-6 grid gap-6">
                <div className="flex items-center gap-5">
                  <div className="w-24 h-24 rounded-full bg-zinc-900 border border-white/10 flex items-center justify-center text-4xl font-black text-white shadow-xl">
                    {activeMember?.name?.charAt(0) || 'T'}
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.35em] text-white/40 font-black mb-2">
                      Profile details
                    </p>
                    <h2 className="text-2xl font-black text-white">{activeMember?.name || 'Team Member'}</h2>
                    <p className="text-xs text-white/40">{activeMember?.role || 'Assigned position'}</p>
                  </div>
                </div>

                <div className="grid gap-4 bg-zinc-900/70 border border-white/10 rounded-3xl p-6">
                  <div>
                    <label className="block text-[10px] uppercase tracking-[0.35em] text-white/40 mb-2">
                      Full name
                    </label>
                    <input
                      type="text"
                      value={activeMember?.name || ''}
                      readOnly
                      className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase tracking-[0.35em] text-white/40 mb-2">
                      Operational role
                    </label>
                    <input
                      type="text"
                      value={activeMember?.role || ''}
                      readOnly
                      className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none"
                    />
                  </div>
                  <div className="flex items-center justify-between gap-4 border-t border-white/10 pt-4">
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.35em] text-white/40">Security clearance</p>
                      <p className="text-xs text-white/60">Operational access verified</p>
                    </div>
                    <span className="text-[10px] uppercase tracking-[0.3em] text-emerald-400 font-black">
                      ACTIVE
                    </span>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    className="w-full rounded-2xl border border-red-500/20 bg-red-500/10 py-3 text-xs font-black uppercase tracking-[0.2em] text-red-300 hover:bg-red-500/20 transition-all"
                  >
                    Clear conversation
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsEditingProfile(false)}
                    className="w-full rounded-2xl bg-orange-600 py-3 text-xs font-black uppercase tracking-[0.2em] text-white hover:bg-orange-500 transition-all"
                  >
                    Save profile changes
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col min-w-0 min-h-0">
            <div className="flex-1 min-h-0 overflow-y-scroll overflow-x-hidden p-4 pb-6 space-y-3 bg-zinc-950/40 border-b border-white/10 messenger-scrollbar">
              {loading ? (
                <div className="h-full flex items-center justify-center text-white/30 text-sm font-semibold">
                  Syncing operational data stream...
                </div>
              ) : messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center gap-4 p-6">
                  <div className="w-16 h-16 rounded-3xl bg-white/5 border border-white/10 flex items-center justify-center text-white/40">
                    <MessageCircle size={26} />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-white">Beginning of communication</h3>
                    <p className="text-sm text-white/40 max-w-sm">
                      Your team conversation starts here. Messages appear instantly once the channel is active.
                    </p>
                  </div>
                </div>
              ) : (
                messages.map((msg, index) => {
                  const matchesSelf = msg.senderId === auth.currentUser?.uid || msg.senderName === 'MERCHANT';
                  const consecutive = isConsecutive(msg, messages[index - 1]);

                  return (
                    <div
                      key={msg.id}
                      className={cn(
                        "w-full flex gap-2 group relative mb-3",
                        matchesSelf ? "flex-row-reverse" : "flex-row"
                      )}
                    >
                      {!matchesSelf && !consecutive && (
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center text-xs font-black text-white mt-1 shrink-0">
                          {msg.senderName?.charAt(0) || 'U'}
                        </div>
                      )}
                      {!matchesSelf && consecutive && (
                        <div className="w-8 shrink-0" />
                      )}
                      <div className="flex flex-col">
                        <div className={cn("flex items-center gap-2 mb-1 px-1 text-[9px] uppercase tracking-[0.35em] text-white/40", matchesSelf ? "justify-end" : "justify-start")}> 
                          {!consecutive && (
                            <span className="font-black">{matchesSelf ? 'You' : msg.senderName}</span>
                          )}
                          <span>{formatChatTime(msg.timestamp)}</span>
                        </div>

                        <div
                          className={cn(
                            "relative px-4 py-3 rounded-3xl text-sm shadow-lg shadow-black/20 break-words w-full max-w-[72%] transition-all duration-200",
                            matchesSelf
                              ? "bg-[#25d366] text-white rounded-br-none ml-auto text-right border border-white/10"
                              : "bg-zinc-900 text-zinc-200 border border-white/10 rounded-bl-none mr-auto text-left"
                          )}
                        >
                          <div className="space-y-2">
                            {msg.type === 'image' && msg.mediaUrl ? (
                              <div className="grid gap-3">
                                <div className="overflow-hidden rounded-3xl border border-white/10 bg-white/5 shadow-lg shadow-black/20">
                                  <img
                                    src={msg.mediaUrl}
                                    alt={msg.text}
                                    className="block h-auto w-full object-cover"
                                  />
                                </div>
                                <div className="rounded-3xl border border-white/10 bg-zinc-950/60 p-3">
                                  <p className="text-sm font-semibold text-white truncate">{msg.text}</p>
                                  <p className="text-[10px] text-white/40">{msg.fileSize || 'Image preview'}</p>
                                </div>
                              </div>
                            ) : msg.type === 'document' ? (
                              <div className="rounded-3xl border border-white/10 bg-white/5 p-3 shadow-sm">
                                <div className="flex items-center gap-3">
                                  <div className="flex h-12 w-12 items-center justify-center rounded-3xl bg-orange-500/10 text-orange-300">
                                    <FileText size={18} />
                                  </div>
                                  <div className="min-w-0">
                                    <p className="text-sm font-semibold text-white truncate">{msg.text}</p>
                                    <p className="text-[10px] text-white/40">{msg.fileSize || 'Unknown size'}</p>
                                  </div>
                                </div>
                                <div className="mt-3 rounded-3xl border border-white/10 bg-black/10 p-3 text-[10px] text-white/60">
                                  Document attached for review. Tap to open when available.
                                </div>
                              </div>
                            ) : msg.type === 'voice' ? (
                              <div className="flex items-center gap-3">
                                <button
                                  type="button"
                                  className="p-2 rounded-2xl bg-white/5 text-white/80 hover:bg-white/10 transition-colors"
                                >
                                  <Play size={14} />
                                </button>
                                <div className="min-w-0">
                                  <p className="text-sm font-semibold text-white">Voice clip</p>
                                  <p className="text-[10px] text-white/40">{msg.duration || '0:00'}</p>
                                </div>
                              </div>
                            ) : (
                              <p className="text-sm leading-7">{msg.text}</p>
                            )}
                          </div>

                          <button
                            type="button"
                            onClick={() =>
                              setActiveDropdownId(activeDropdownId === msg.id ? null : msg.id)
                            }
                            className="absolute top-3 right-3 p-2 rounded-full text-white/40 hover:bg-white/10 hover:text-white transition-colors"
                          >
                            <MoreVertical size={16} />
                          </button>

                          {activeDropdownId === msg.id && (
                            <motion.div
                              initial={{ opacity: 0, y: -4 }}
                              animate={{ opacity: 1, y: 0 }}
                              className="absolute right-0 top-full mt-2 w-56 rounded-3xl border border-white/10 bg-zinc-950 p-2 shadow-2xl"
                            >
                              <button
                                type="button"
                                onClick={() => {
                                  setReplyingTo(msg);
                                  setActiveDropdownId(null);
                                }}
                                className="w-full flex items-center gap-2 px-3 py-2 text-left text-xs text-white/80 hover:bg-white/5 rounded-2xl"
                              >
                                <Forward size={14} />
                                Reply
                              </button>
                              <button
                                type="button"
                                onClick={() => toggleStarMessage(msg.id)}
                                className="w-full flex items-center gap-2 px-3 py-2 text-left text-xs text-white/80 hover:bg-white/5 rounded-2xl"
                              >
                                <Star size={14} />
                                {msg.isStarred ? 'Unstar' : 'Star'}
                              </button>
                              <button
                                type="button"
                                onClick={() => setMessages((prev) => prev.filter((item) => item.id !== msg.id))}
                                className="w-full flex items-center gap-2 px-3 py-2 text-left text-xs text-red-400 hover:bg-red-500/10 rounded-2xl"
                              >
                                <Trash2 size={14} />
                                Delete
                              </button>
                            </motion.div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}

              {isTypingSimulated && (
                <div className="px-4 pb-2 text-xs text-white/40">
                  ✍️ Typing...
                </div>
              )}

              <div ref={messageEndRef} />
            </div>

            <div className="flex-none bg-zinc-950/95 backdrop-blur-xl border-t border-white/10">

              {replyingTo && (
                <div className="mx-6 mt-3 rounded-3xl border border-orange-500/20 bg-orange-500/5 p-3 text-sm text-orange-200">
                  Replying to <span className="font-black">{replyingTo.senderName}</span>:
                  <div className="mt-1 truncate text-white/80">"{replyingTo.text}"</div>
                  <button
                    type="button"
                    onClick={() => setReplyingTo(null)}
                    className="mt-2 inline-flex items-center gap-2 rounded-full bg-white/5 px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-white/70 hover:bg-white/10 transition-all"
                  >
                    <X size={12} />
                    Cancel reply
                  </button>
                </div>
              )}

              <motion.div
                layout
                transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                className="flex-none w-full grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 p-4 bg-zinc-900/10 border-t border-white/5 backdrop-blur-sm"
              >
                <div className="rounded-3xl border border-white/10 bg-zinc-950/80 p-4 transition-all duration-300 transform hover:-translate-y-0.5 hover:border-orange-500/20 hover:bg-orange-500/[0.01]">
                  <div className="flex items-center gap-2 text-white/80 mb-3">
                    <div className="w-8 h-8 rounded-2xl bg-white/5 flex items-center justify-center text-white">
                      <Users size={16} />
                    </div>
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.25em] text-white/40 font-black">
                        {hudTitle}
                      </p>
                      <p className="text-[10px] text-white/50 uppercase tracking-[0.2em] mt-1">
                        {hudSubtitle}
                      </p>
                    </div>
                  </div>
                  <div className="flex -space-x-2 mb-3">
                    {members.slice(0, 5).map((member) => (
                      <span
                        key={member.id}
                        className="w-8 h-8 rounded-full border border-white/10 bg-zinc-900 flex items-center justify-center text-[10px] text-white"
                      >
                        {member.name?.charAt(0) || 'T'}
                      </span>
                    ))}
                  </div>
                  <p className="text-[11px] text-white/50 leading-5 truncate">
                    {isChannelView
                      ? members.map((member) => member.name).filter(Boolean).join(', ') || 'No active members yet.'
                      : `Shared attachments, direct notes, and support access details for ${activeMember?.name || 'this thread'}.`}
                  </p>
                </div>

                <div className="rounded-3xl border border-white/10 bg-zinc-950/80 p-4 transition-all duration-300 transform hover:-translate-y-0.5 hover:border-orange-500/20 hover:bg-orange-500/[0.01]">
                  <div className="flex items-center gap-2 text-white/80 mb-3">
                    <div className="w-8 h-8 rounded-2xl bg-white/5 flex items-center justify-center text-white">
                      <Activity size={16} />
                    </div>
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.25em] text-white/40 font-black">
                        Channel Parameters
                      </p>
                    </div>
                  </div>
                  <p className="text-[11px] text-white/50 leading-5 mb-2">
                    Active Channel:{' '}
                    <code className="font-mono font-bold bg-white/5 px-1.5 py-0.5 rounded border border-white/5 text-orange-400 text-[10px] whitespace-nowrap truncate">
                      {getMaskedChannelKey(activeChannel)}
                    </code>
                  </p>
                  {hudDetailRows.map((row) => (
                    <p key={row.label} className="text-[11px] text-white/50 leading-5">
                      {row.label}: <span className="text-white">{row.value}</span>
                    </p>
                  ))}
                </div>

                <div className={cn(
                  'rounded-3xl border bg-zinc-950/80 p-4 transition-all duration-300 transform hover:-translate-y-0.5 hover:border-orange-500/20 hover:bg-orange-500/[0.01]',
                  isChannelView ? 'border-white/10' : 'border-orange-500/30'
                )}>
                  <div className="flex items-center gap-2 text-white/80 mb-3">
                    <div className="w-8 h-8 rounded-2xl bg-white/5 flex items-center justify-center text-white">
                      <Pin size={16} />
                    </div>
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.25em] text-white/40 font-black">
                        Workspace Macros
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-col gap-2">
                    <button
                      type="button"
                      className={cn(
                        'flex items-center gap-1.5 px-2 py-1 rounded-lg text-[10px] font-bold w-full justify-start transition-all',
                        isChannelView
                          ? 'bg-white/5 border border-white/5 text-white/70 hover:bg-white/10'
                          : 'bg-orange-500/10 border border-orange-500/20 text-orange-300 hover:bg-orange-500/15'
                      )}
                    >
                      <Pin size={12} className={isChannelView ? 'text-white/40' : 'text-orange-300'} />
                      {isChannelView ? 'Pin This Workspace Channel' : 'Direct Support Access'}
                    </button>
                    <button
                      type="button"
                      className={cn(
                        'flex items-center gap-1.5 px-2 py-1 rounded-lg text-[10px] font-bold w-full justify-start transition-all',
                        isChannelView
                          ? 'bg-white/5 border border-white/5 text-white/70 hover:bg-white/10'
                          : 'bg-orange-500/10 border border-orange-500/20 text-orange-300 hover:bg-orange-500/15'
                      )}
                    >
                      <BellOff size={12} className={isChannelView ? 'text-white/40' : 'text-orange-300'} />
                      {isChannelView ? 'Mute Notification Stream' : 'Shared Attachments History'}
                    </button>
                  </div>
                </div>
              </motion.div>
            </div>

            <div className="flex-none border-t border-white/10 bg-zinc-900/70 p-4 flex flex-col sticky bottom-0 z-20">
              {isRecording ? (
                <div className="flex flex-col gap-3 rounded-3xl border border-white/10 bg-white/5 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-3xl bg-red-500/15 flex items-center justify-center">
                        <Mic size={18} className="text-red-400" />
                      </div>
                      <div>
                        <p className="text-sm font-black text-white">Recording audio</p>
                        <p className="text-xs text-white/40">Tap send once finished</p>
                      </div>
                    </div>
                    <span className="text-xs text-white/40">
                      0:{recordTime.toString().padStart(2, '0')}
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setIsRecording(false)}
                      className="flex-1 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-xs font-bold text-white/80 hover:bg-white/10 transition-all"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleSendVoiceNote}
                      className="flex-1 rounded-2xl bg-orange-600 px-4 py-3 text-xs font-black uppercase tracking-[0.15em] text-white hover:bg-orange-500 transition-all"
                    >
                      Send voice note
                    </button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleSendMessage} className="flex items-center gap-3">
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    onChange={(e) => handleFileUploadTrigger(e, 'all')}
                  />
                  <input
                    ref={imageInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => handleFileUploadTrigger(e, 'image')}
                  />

                  <button
                    type="button"
                    onClick={() => triggerFileSelect('all')}
                    className="p-3 rounded-3xl bg-white/5 border border-white/10 text-white/60 hover:bg-white/10 transition-colors"
                  >
                    <Paperclip size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => triggerFileSelect('image')}
                    className="p-3 rounded-3xl bg-white/5 border border-white/10 text-white/60 hover:bg-white/10 transition-colors"
                  >
                    <ImageIcon size={16} />
                  </button>
                  <div className="flex-1 rounded-3xl border border-white/10 bg-white/5 pr-3">
                    <input
                      type="text"
                      placeholder={`Message ${getChannelDisplayName(activeChannel)}...`}
                      value={messageInput}
                      onChange={handleInputChange}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSendMessage();
                      }}
                      className="w-full bg-transparent px-4 py-3 text-xs font-semibold text-white placeholder:text-white/30 outline-none"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsRecording(true)}
                    className="p-3 rounded-3xl bg-white/5 border border-white/10 text-white/60 hover:bg-white/10 transition-colors"
                  >
                    <Mic size={16} />
                  </button>
                  <button
                    type="submit"
                    className="p-3 rounded-3xl bg-orange-600 text-white hover:bg-orange-500 transition-colors"
                  >
                    <Send size={16} />
                  </button>
                </form>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}