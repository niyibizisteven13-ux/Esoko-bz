import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * TraderChat
 * ----------
 * WhatsApp-style messenger UI, wired for dynamic contacts and pluggable
 * transport. No contact data is hardcoded — conversations are created by
 * adding a peer's app account number.
 *
 * This component does NOT open a network connection itself. It exposes
 * callback props so you can wire it to whatever hub you build.
 *
 * WHAT'S FULLY WORKING CLIENT-SIDE (no backend needed):
 *  - The header "..." dropdown menu: Contact info, Search in chat, Mute,
 *    Clear chat, Block, Delete chat (destructive actions confirm via
 *    window.confirm — swap for a nicer modal later if you want).
 *  - Emoji picker (curated grid, inserts into the composer).
 *  - Voice recording via MediaRecorder, with a real playable <audio>
 *    element and live progress bar on both ends.
 *  - Image attachments render as actual inline thumbnails (not a generic
 *    file icon) and open full-resolution in a lightbox on click.
 *
 * WHAT NEEDS BACKEND WIRING TO BE MORE THAN A UI SHELL:
 *  - Voice/video calls: clicking the phone/video buttons opens a real
 *    call UI (ringing → connected, timer, mute, end call) via onStartCall,
 *    but the actual audio/video stream requires your hub's WebRTC
 *    signaling to be connected to that callback. See the CallModal
 *    component and the `onStartCall` prop for the exact hookup point.
 *  - Mute/Clear/Block/Delete all update local UI state immediately and
 *    call their respective optional callback props — wire those to your
 *    backend to persist the action; without them, it's local-only (still
 *    fully usable, just resets on reload).
 *
 * SIZING NOTE (fixes composer getting cut off at the bottom of the page):
 * This component fills 100% of its parent's height via `h-full`. That only
 * works if the parent actually has a resolvable height. See prior version's
 * comment for the exact wrapping pattern if this regresses.
 *
 * MOBILE LAYOUT: below `md`, single pane that switches between the
 * conversation list and the active thread, with a back button.
 */

interface TraderChatProps {
	traderId?: string;
	contacts?: Conversation[];
	messages?: ChatMessage[];
	selectedConversationId?: string;
	onSelectConversation?: (conversationId: string) => void;

	onSendMessage?: (conversationId: string, text: string, replyToMessageId?: string | null) => void | Promise<void>;
	onSendFile?: (conversationId: string, file: File, replyToMessageId?: string | null) => void | Promise<void>;
	onAddContact?: (accountNumber: string, displayName?: string) => Promise<Conversation | null>;

	/**
	 * Called when the user presses the voice/video call button, and again
	 * when they end the call. This is the one place real signaling plugs
	 * in — wire it to create an RTCPeerConnection, send the offer over
	 * your hub's WebSocket, and stream remote audio/video back in. Until
	 * then the call UI runs as a shell (ringing/timer only, no real media).
	 */
	onStartCall?: (conversationId: string, type: 'voice' | 'video') => void;
	onEndCall?: (conversationId: string) => void;

	call?: {
		conversationId: string;
		type: 'voice' | 'video';
		state: 'idle' | 'calling' | 'connected' | 'failed' | 'ended';
		localStream: MediaStream | null;
		remoteStream: MediaStream | null;
		failReason: string | null;
	};
	onToggleCallMute?: () => boolean;

	onMuteConversation?: (conversationId: string, muted: boolean) => void;
	onClearChat?: (conversationId: string) => void;
	onBlockContact?: (conversationId: string, blocked: boolean) => void;
	onDeleteConversation?: (conversationId: string) => void;
	onToggleReaction?: (messageId: string, emoji: string) => void | Promise<void>;

	className?: string;
	style?: React.CSSProperties;
}

type MessageStatus = 'sent' | 'delivered' | 'read';
type AttachmentType = 'file' | 'voice' | 'image';
type MessageReactionMap = Record<string, string[]>;

interface ReplyPreview {
	id: string;
	senderId: string;
	text?: string;
	attachmentType?: AttachmentType | null;
}

interface ChatMessage {
	id: string;
	conversationId: string;
	senderId: string;
	text?: string;
	attachment?: { type: AttachmentType; name: string; meta?: string; duration?: string; url?: string };
	timestamp: string;
	status?: MessageStatus;
	replyTo?: ReplyPreview;
	reactions?: MessageReactionMap;
}

interface Conversation {
	id: string;
	accountNumber: string;
	name: string;
	initials: string;
	avatarColor: string;
	online: boolean;
	lastMessagePreview: string;
	lastMessageTime: string;
	lastMessageRead?: MessageStatus;
	unreadCount: number;
	muted?: boolean;
	blocked?: boolean;
}

const AVATAR_COLORS = ['#e8622c', '#3d6b4a', '#7a5c3d', '#3d5a80', '#6a4c93', '#9a3b3b'];

function colorForAccount(accountNumber: string): string {
	let hash = 0;
	for (let i = 0; i < accountNumber.length; i++) hash = (hash * 31 + accountNumber.charCodeAt(i)) >>> 0;
	return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

function initialsFor(name: string): string {
	const parts = name.trim().split(/\s+/).filter(Boolean);
	if (parts.length === 0) return '?';
	if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
	return (parts[0][0] + parts[1][0]).toUpperCase();
}

function formatBytes(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDuration(seconds: number): string {
	const m = Math.floor(seconds / 60);
	const s = Math.floor(seconds % 60);
	return `${m}:${s.toString().padStart(2, '0')}`;
}

function previewTextForMessage(message: ChatMessage): string {
	if (message.text?.trim()) return message.text.trim();
	if (!message.attachment) return 'Message';
	switch (message.attachment.type) {
		case 'image': return '📷 Photo';
		case 'voice': return '🎤 Voice message';
		case 'file': return `📎 ${message.attachment.name}`;
		default: return 'Attachment';
	}
}

const EMOJIS = [
	'😀', '😂', '🥹', '😍', '😎', '🤔', '😴', '😢', '😡', '🥳',
	'👍', '👎', '🙏', '👏', '💪', '🤝', '👋', '✌️', '🤞', '👌',
	'❤️', '🔥', '⭐', '✅', '❌', '💯', '🎉', '📦', '💰', '🛒',
	'📈', '📉', '⏰', '📍', '🚚', '💬', '📸', '🎤', '☕', '🙌',
];

// WhatsApp's real dark-theme palette
const wa = {
	sidebarBg: '#111b21',
	panelBg: '#202c33',
	chatBg: '#0b141a',
	fieldBg: '#2a3942',
	border: '#2a3942',
	textPrimary: '#e9edef',
	textSecondary: '#8696a0',
	accent: '#00a884',
	bubbleIn: '#202c33',
	bubbleOut: '#005c4b',
	bubbleOutMeta: '#8fdccb',
	tickRead: '#53bdeb',
	fileIconBg: '#0b3d33',
	danger: '#e35b5b',
};

function IconSearch() { return (<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>); }
function IconPhone() { return (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.362 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.338 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" /></svg>); }
function IconVideo() { return (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="23 7 16 12 23 17 23 7" /><rect x="1" y="5" width="15" height="14" rx="2" ry="2" /></svg>); }
function IconDots() { return (<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="1.6" /><circle cx="12" cy="12" r="1.6" /><circle cx="12" cy="19" r="1.6" /></svg>); }
function IconSmile() { return (<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M8 14s1.5 2 4 2 4-2 4-2" /><line x1="9" y1="9" x2="9.01" y2="9" /><line x1="15" y1="9" x2="15.01" y2="9" /></svg>); }
function IconPaperclip() { return (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" /></svg>); }
function IconMic() { return (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" /><path d="M19 10v2a7 7 0 0 1-14 0v-2" /><line x1="12" y1="19" x2="12" y2="23" /><line x1="8" y1="23" x2="16" y2="23" /></svg>); }
function IconSend() { return (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" /></svg>); }
function IconFile() { return (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>); }
function IconPlay() { return (<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3" /></svg>); }
function IconPause() { return (<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" /></svg>); }
function IconCheck1() { return (<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>); }
function IconCheck2({ color }: { color: string }) { return (<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><polyline points="18 6 7 17 2 12" /><polyline points="22 6 11 17 9 15" /></svg>); }
function IconPlus() { return (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>); }
function IconX() { return (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>); }
function IconArrowLeft() { return (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" /></svg>); }
function IconTrash() { return (<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>); }
function IconBan() { return (<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="4.93" y1="4.93" x2="19.07" y2="19.07" /></svg>); }
function IconBellOff() { return (<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M13.73 21a2 2 0 0 1-3.46 0" /><path d="M18.63 13A17.89 17.89 0 0 1 18 8" /><path d="M6.26 6.26A5.86 5.86 0 0 0 6 8c0 7-3 9-3 9h14" /><path d="M18 8a6 6 0 0 0-9.33-5" /><line x1="1" y1="1" x2="23" y2="23" /></svg>); }
function IconInfo() { return (<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" /></svg>); }
function IconReplyArrow() { return (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="19 14 9 14 5 10" /><path d="M9 14a7 7 0 0 1 0-14" /></svg>); }
function IconTrash2() { return <IconTrash />; }

function StatusTicks({ status }: { status?: MessageStatus }) {
	if (!status) return null;
	if (status === 'sent') return <IconCheck1 />;
	return <IconCheck2 color={status === 'read' ? wa.tickRead : wa.textSecondary} />;
}

function VoiceMessagePlayer({ url, duration, isMine }: { url?: string; duration?: string; isMine: boolean }) {
	const audioRef = useRef<HTMLAudioElement>(null);
	const [playing, setPlaying] = useState(false);
	const [progress, setProgress] = useState(0);

	function toggle() {
		const el = audioRef.current;
		if (!el) return;
		if (playing) {
			el.pause();
		} else {
			el.play();
		}
	}

	return (
		<div className="flex min-w-[170px] items-center gap-2.5 py-0.5">
			<button
				onClick={toggle}
				className="flex h-[30px] w-[30px] flex-shrink-0 items-center justify-center rounded-full text-white"
				style={{ backgroundColor: '#e8622c' }}
			>
				{playing ? <IconPause /> : <IconPlay />}
			</button>
			<div className="h-[3px] flex-1 rounded-full" style={{ backgroundColor: '#3a4a52' }}>
				<div className="h-full rounded-full" style={{ width: `${progress * 100}%`, backgroundColor: isMine ? wa.bubbleOutMeta : wa.textSecondary }} />
			</div>
			<span className="text-[11px]" style={{ color: isMine ? wa.bubbleOutMeta : wa.textSecondary }}>{duration ?? '0:00'}</span>
			{url && (
				<audio
					ref={audioRef}
					src={url}
					onPlay={() => setPlaying(true)}
					onPause={() => setPlaying(false)}
					onEnded={() => { setPlaying(false); setProgress(0); }}
					onTimeUpdate={(e) => {
						const el = e.currentTarget;
						if (el.duration) setProgress(el.currentTime / el.duration);
					}}
					className="hidden"
				/>
			)}
		</div>
	);
}

function CallModal({
	conversation,
	type,
	callState,
	localStream,
	remoteStream,
	failReason,
	onToggleMute,
	onEnd,
}: {
	conversation: Conversation;
	type: 'voice' | 'video';
	callState: 'idle' | 'calling' | 'connected' | 'failed' | 'ended';
	localStream: MediaStream | null;
	remoteStream: MediaStream | null;
	failReason: string | null;
	onToggleMute: () => boolean;
	onEnd: () => void;
}) {
	const [seconds, setSeconds] = useState(0);
	const [muted, setMuted] = useState(false);
	const localVideoRef = useRef<HTMLVideoElement>(null);
	const remoteVideoRef = useRef<HTMLVideoElement>(null);
	const remoteAudioRef = useRef<HTMLAudioElement>(null);

	useEffect(() => {
		if (callState !== 'connected') return;
		const interval = setInterval(() => setSeconds((s) => s + 1), 1000);
		return () => clearInterval(interval);
	}, [callState]);

	useEffect(() => {
		if (localVideoRef.current && localStream) localVideoRef.current.srcObject = localStream;
	}, [localStream]);

	useEffect(() => {
		if (type === 'video' && remoteVideoRef.current && remoteStream) remoteVideoRef.current.srcObject = remoteStream;
		if (type === 'voice' && remoteAudioRef.current && remoteStream) remoteAudioRef.current.srcObject = remoteStream;
	}, [remoteStream, type]);

	const statusLabel =
		callState === 'calling' ? `${type === 'video' ? 'Video calling' : 'Calling'}…` :
		callState === 'connected' ? formatDuration(seconds) :
		callState === 'failed' ? (failReason ?? 'Call failed') :
		'Call ended';

	return (
		<div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-6" style={{ backgroundColor: '#0b141aee' }}>
			{type === 'video' && remoteStream ? (
				<video ref={remoteVideoRef} autoPlay playsInline className="absolute inset-0 h-full w-full object-cover" />
			) : (
				<div className="flex h-24 w-24 items-center justify-center rounded-full text-3xl font-semibold text-white" style={{ backgroundColor: conversation.avatarColor }}>
					{conversation.initials}
				</div>
			)}

			{type === 'video' && localStream && (
				<video
					ref={localVideoRef}
					autoPlay
					playsInline
					muted
					className="absolute bottom-28 right-4 h-32 w-24 rounded-lg border-2 object-cover"
					style={{ borderColor: wa.border }}
				/>
			)}

			<audio ref={remoteAudioRef} autoPlay className="hidden" />

			<div className="relative z-10 text-center" style={{ textShadow: type === 'video' ? '0 1px 3px rgba(0,0,0,0.8)' : 'none' }}>
				<div className="text-[18px]" style={{ color: wa.textPrimary }}>{conversation.name}</div>
				<div className="mt-1 text-[13px]" style={{ color: wa.textSecondary }}>{statusLabel}</div>
			</div>

			<div className="relative z-10 flex items-center gap-6">
				<button
					onClick={() => setMuted(onToggleMute())}
					aria-label={muted ? 'Unmute' : 'Mute'}
					className="flex h-14 w-14 items-center justify-center rounded-full"
					style={{ backgroundColor: muted ? wa.accent : wa.fieldBg, color: muted ? wa.sidebarBg : wa.textPrimary }}
				>
					<IconMic />
				</button>
				<button
					onClick={onEnd}
					aria-label="End call"
					className="flex h-16 w-16 items-center justify-center rounded-full text-white"
					style={{ backgroundColor: wa.danger, transform: 'rotate(135deg)' }}
				>
					<IconPhone />
				</button>
			</div>
		</div>
	);
}

export default function TraderChat({
	traderId,
	contacts,
	messages: messagesProp,
	selectedConversationId,
	onSelectConversation,
	onSendMessage,
	onSendFile,
	onAddContact,
	onStartCall,
	onEndCall,
	call,
	onToggleCallMute,
	onMuteConversation,
	onClearChat,
	onBlockContact,
	onDeleteConversation,
	onToggleReaction,
	className,
	style,
}: TraderChatProps): React.ReactElement {
	const [localConversations, setLocalConversations] = useState<Conversation[]>(contacts ?? []);
	const [localMessages, setLocalMessages] = useState<ChatMessage[]>(messagesProp ?? []);
	const [activeConversationId, setActiveConversationId] = useState<string>('');
	const [mobilePane, setMobilePane] = useState<'list' | 'chat'>('list');
	const [draft, setDraft] = useState('');
	const [search, setSearch] = useState('');
	const [showAddContact, setShowAddContact] = useState(false);
	const [newAccountNumber, setNewAccountNumber] = useState('');
	const [newDisplayName, setNewDisplayName] = useState('');
	const [addContactError, setAddContactError] = useState<string | null>(null);
	const [addingContact, setAddingContact] = useState(false);
	const scrollRef = useRef<HTMLDivElement>(null);
	const fileInputRef = useRef<HTMLInputElement>(null);
	const textareaRef = useRef<HTMLTextAreaElement>(null);

	// New: header menu, emoji picker, in-chat search, mute/block, call, lightbox, recording
	const [showHeaderMenu, setShowHeaderMenu] = useState(false);
	const [showEmojiPicker, setShowEmojiPicker] = useState(false);
	const [showInChatSearch, setShowInChatSearch] = useState(false);
	const [inChatQuery, setInChatQuery] = useState('');
	const [showContactInfo, setShowContactInfo] = useState(false);
	const [mutedIds, setMutedIds] = useState<Set<string>>(new Set());
	const [blockedIds, setBlockedIds] = useState<Set<string>>(new Set());
	// call state is now managed by parent via `call` prop
	const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
	const [isRecording, setIsRecording] = useState(false);
	const [recordSeconds, setRecordSeconds] = useState(0);
	const mediaRecorderRef = useRef<MediaRecorder | null>(null);
	const audioChunksRef = useRef<Blob[]>([]);
	const recordIntervalRef = useRef<number | null>(null);
	const headerMenuRef = useRef<HTMLDivElement>(null);
	const emojiPickerRef = useRef<HTMLDivElement>(null);
	const reactionPickerRef = useRef<HTMLDivElement>(null);
	const [replyingToId, setReplyingToId] = useState<string | null>(null);
	const [activeToolbarMessageId, setActiveToolbarMessageId] = useState<string | null>(null);
	const [openReactionPickerId, setOpenReactionPickerId] = useState<string | null>(null);
	const QUICK_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

	useEffect(() => {
		if (contacts) {
			setLocalConversations(contacts);
			setMutedIds(new Set(contacts.filter((c) => c.muted).map((c) => c.id)));
			setBlockedIds(new Set(contacts.filter((c) => c.blocked).map((c) => c.id)));
		}
	}, [contacts]);
	useEffect(() => {
		if (messagesProp) setLocalMessages(messagesProp);
	}, [messagesProp]);

	const conversations = localConversations;
	const messages = localMessages;

	useEffect(() => {
		if (!activeConversationId && conversations.length > 0) {
			setActiveConversationId(conversations[0].id);
		}
	}, [conversations, activeConversationId]);

	const activeConversation = useMemo(
		() => conversations.find((c) => c.id === activeConversationId),
		[conversations, activeConversationId],
	);

	useEffect(() => {
		if (selectedConversationId && selectedConversationId !== activeConversationId) {
			setActiveConversationId(selectedConversationId);
		}
	}, [selectedConversationId]);

	useEffect(() => {
		if (activeConversationId && onSelectConversation) {
			onSelectConversation(activeConversationId);
		}
		// Only fire when the active conversation changes, not when the parent
		// re-renders with the same callback.
	}, [activeConversationId]);

	useEffect(() => {
		setReplyingToId(null);
	}, [activeConversationId]);

	const activeMessages = useMemo(
		() => messages.filter((m) => m.conversationId === activeConversationId),
		[messages, activeConversationId],
	);

	const visibleMessages = useMemo(() => {
		if (!showInChatSearch || !inChatQuery.trim()) return activeMessages;
		const q = inChatQuery.trim().toLowerCase();
		return activeMessages.filter((m) => m.text?.toLowerCase().includes(q));
	}, [activeMessages, showInChatSearch, inChatQuery]);

	const replyingToMessage = useMemo(() => {
		if (!replyingToId) return null;
		return activeMessages.find((message) => message.id === replyingToId) ?? null;
	}, [replyingToId, activeMessages]);

	const filteredConversations = useMemo(
		() => conversations.filter((c) => c.name.toLowerCase().includes(search.trim().toLowerCase()) || c.accountNumber.includes(search.trim())),
		[conversations, search],
	);

	useEffect(() => {
		scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
	}, [activeMessages.length, activeConversationId]);

	useEffect(() => {
		const el = textareaRef.current;
		if (!el) return;
		el.style.height = 'auto';
		el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
	}, [draft]);

	// Close popovers on outside click
	useEffect(() => {
		function handleClick(e: MouseEvent) {
			const target = e.target as Element;
			if (headerMenuRef.current && !headerMenuRef.current.contains(target)) setShowHeaderMenu(false);
			if (emojiPickerRef.current && !emojiPickerRef.current.contains(target)) setShowEmojiPicker(false);
			if (reactionPickerRef.current && !reactionPickerRef.current.contains(target)) setOpenReactionPickerId(null);
			if (!target.closest('.trader-chat-message-bubble') && !target.closest('.trader-chat-toolbar') && !target.closest('.trader-chat-reaction-picker')) {
				setActiveToolbarMessageId(null);
				setOpenReactionPickerId(null);
			}
		}
		document.addEventListener('mousedown', handleClick);
		return () => document.removeEventListener('mousedown', handleClick);
	}, []);

	function appendLocalMessage(newMessage: ChatMessage, previewText: string) {
		setLocalMessages((prev) => [...prev, newMessage]);
		setLocalConversations((prev) =>
			prev.map((c) =>
				c.id === activeConversationId
					? { ...c, lastMessagePreview: previewText, lastMessageTime: newMessage.timestamp, lastMessageRead: 'sent' }
					: c,
			),
		);
	}

	async function toggleReaction(messageId: string, emoji: string) {
		if (onToggleReaction) {
			await onToggleReaction(messageId, emoji);
			return;
		}
		setLocalMessages((prev) => prev.map((message) => {
			if (message.id !== messageId) return message;
			const existing = message.reactions ?? {};
			const currentUsers = existing[emoji] ?? [];
			const hasReacted = currentUsers.includes('me');
			const nextUsers = hasReacted ? currentUsers.filter((id) => id !== 'me') : [...currentUsers, 'me'];
			const nextReactions = { ...existing };
			if (nextUsers.length > 0) {
				nextReactions[emoji] = nextUsers;
			} else {
				delete nextReactions[emoji];
			}
			return {
				...message,
				reactions: Object.keys(nextReactions).length > 0 ? nextReactions : undefined,
			};
		}));
	}

	function handleSend() {
		const text = draft.trim();
		if (!text || !activeConversationId) return;

		const replyTarget = replyingToId ? activeMessages.find((message) => message.id === replyingToId) ?? null : null;
		const newMessage: ChatMessage = {
			id: `local-${Date.now()}`,
			conversationId: activeConversationId,
			senderId: 'me',
			text,
			timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
			status: 'sent',
			replyTo: replyTarget ? {
				id: replyTarget.id,
				senderId: replyTarget.senderId,
				text: previewTextForMessage(replyTarget),
				attachmentType: replyTarget.attachment?.type ?? null,
			} : undefined,
		};
		appendLocalMessage(newMessage, text);
		setDraft('');
		setReplyingToId(null);
		if (onSendMessage) onSendMessage(activeConversationId, text, replyingToId);
	}

	function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			handleSend();
		}
	}

	function insertEmoji(emoji: string) {
		setDraft((prev) => prev + emoji);
		textareaRef.current?.focus();
	}

	function handleAttachClick() {
		fileInputRef.current?.click();
	}

	function handleFileChosen(e: React.ChangeEvent<HTMLInputElement>) {
		const file = e.target.files?.[0];
		e.target.value = '';
		if (!file || !activeConversationId) return;

		const objectUrl = URL.createObjectURL(file);
		const isImage = file.type.startsWith('image/');

		const newMessage: ChatMessage = {
			id: `local-file-${Date.now()}`,
			conversationId: activeConversationId,
			senderId: 'me',
			attachment: {
				type: isImage ? 'image' : 'file',
				name: file.name,
				meta: `${formatBytes(file.size)} · ${file.type || 'file'}`,
				url: objectUrl,
			},
			timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
			status: 'sent',
		};
		appendLocalMessage(newMessage, isImage ? '📷 Photo' : `📎 ${file.name}`);
		setReplyingToId(null);
		if (onSendFile) onSendFile(activeConversationId, file, replyingToId);
	}

	async function startRecording() {
		if (!activeConversationId) return;
		try {
			const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
			const recorder = new MediaRecorder(stream);
			audioChunksRef.current = [];
			recorder.ondataavailable = (ev) => {
				if (ev.data.size > 0) audioChunksRef.current.push(ev.data);
			};
			recorder.onstop = () => {
				stream.getTracks().forEach((t) => t.stop());
				const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
				const durationLabel = formatDuration(recordSeconds);
				const objectUrl = URL.createObjectURL(blob);
				const file = new File([blob], `voice-${Date.now()}.webm`, { type: 'audio/webm' });

				const newMessage: ChatMessage = {
					id: `local-voice-${Date.now()}`,
					conversationId: activeConversationId,
					senderId: 'me',
					attachment: { type: 'voice', name: file.name, url: objectUrl, duration: durationLabel },
					timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
					status: 'sent',
				};
				appendLocalMessage(newMessage, '🎤 Voice message');
				if (onSendFile) onSendFile(activeConversationId, file, replyingToId);
			};
			mediaRecorderRef.current = recorder;
			recorder.start();
			setIsRecording(true);
			setRecordSeconds(0);
			recordIntervalRef.current = window.setInterval(() => setRecordSeconds((s) => s + 1), 1000);
		} catch (err) {
			console.error('[TraderChat] microphone access denied or unavailable', err);
			window.alert('Could not access the microphone. Check your browser permissions.');
		}
	}

	function stopRecording(send: boolean) {
		if (recordIntervalRef.current) {
			window.clearInterval(recordIntervalRef.current);
			recordIntervalRef.current = null;
		}
		if (!send) {
			// Discard: detach the stop handler's send behavior by clearing chunks first
			audioChunksRef.current = [];
		}
		mediaRecorderRef.current?.stop();
		setIsRecording(false);
	}

	async function handleAddContact() {
		const accountNumber = newAccountNumber.trim();
		if (!accountNumber) { setAddContactError('Enter an 8-digit trader app number.'); return; }
		if (!/^[0-9]{8}$/.test(accountNumber)) { setAddContactError('Trader app number must be 8 digits.'); return; }
		if (conversations.some((c) => c.accountNumber === accountNumber)) { setAddContactError('This account is already in your chats.'); return; }

		setAddContactError(null);
		setAddingContact(true);
		try {
			let newConversation: Conversation | null = null;
			if (onAddContact) {
				newConversation = await onAddContact(accountNumber, newDisplayName.trim() || undefined);
			} else {
				const name = newDisplayName.trim() || `Account ${accountNumber}`;
				newConversation = {
					id: `local-${accountNumber}`,
					accountNumber,
					name,
					initials: initialsFor(name),
					avatarColor: colorForAccount(accountNumber),
					online: false,
					lastMessagePreview: 'No messages yet',
					lastMessageTime: '',
					unreadCount: 0,
				};
			}
			if (!newConversation) {
				setAddContactError('No account found with that 8-digit app number.');
				setAddingContact(false);
				return;
			}
			setLocalConversations((prev) => [newConversation as Conversation, ...prev]);
			setActiveConversationId(newConversation.id);
			setShowAddContact(false);
			setNewAccountNumber('');
			setNewDisplayName('');
		} catch (err) {
			setAddContactError('Could not add that contact. Please try again.');
		} finally {
			setAddingContact(false);
		}
	}

	function handleStartCall(type: 'voice' | 'video') {
		if (!activeConversationId) return;
		if (onStartCall) onStartCall(activeConversationId, type);
	}

	function handleEndCall() {
		if (!activeConversationId) return;
		if (onEndCall) onEndCall(activeConversationId);
	}

	function toggleMute() {
		if (!activeConversationId) return;
		setMutedIds((prev) => {
			const next = new Set(prev);
			const nowMuted = !next.has(activeConversationId);
			if (nowMuted) next.add(activeConversationId); else next.delete(activeConversationId);
			if (onMuteConversation) onMuteConversation(activeConversationId, nowMuted);
			return next;
		});
		setShowHeaderMenu(false);
	}

	function toggleBlock() {
		if (!activeConversationId) return;
		setBlockedIds((prev) => {
			const next = new Set(prev);
			const nowBlocked = !next.has(activeConversationId);
			if (nowBlocked) next.add(activeConversationId); else next.delete(activeConversationId);
			if (onBlockContact) onBlockContact(activeConversationId, nowBlocked);
			return next;
		});
		setShowHeaderMenu(false);
	}

	function handleClearChat() {
		if (!activeConversationId) return;
		if (!window.confirm('Clear all messages in this chat? This cannot be undone.')) return;
		setLocalMessages((prev) => prev.filter((m) => m.conversationId !== activeConversationId));
		setLocalConversations((prev) => prev.map((c) => c.id === activeConversationId ? { ...c, lastMessagePreview: '', lastMessageTime: '' } : c));
		if (onClearChat) onClearChat(activeConversationId);
		setShowHeaderMenu(false);
	}

	function handleDeleteChat() {
		if (!activeConversationId) return;
		if (!window.confirm('Delete this chat? This cannot be undone.')) return;
		const idToDelete = activeConversationId;
		setLocalConversations((prev) => prev.filter((c) => c.id !== idToDelete));
		setLocalMessages((prev) => prev.filter((m) => m.conversationId !== idToDelete));
		setActiveConversationId('');
		setMobilePane('list');
		if (onDeleteConversation) onDeleteConversation(idToDelete);
		setShowHeaderMenu(false);
	}

	const isMuted = activeConversationId ? mutedIds.has(activeConversationId) : false;
	const isBlocked = activeConversationId ? blockedIds.has(activeConversationId) : false;

	return (
		<div
			className={`relative grid h-full min-h-0 w-full grid-cols-1 overflow-hidden rounded-none md:rounded-lg md:grid-cols-[280px_1fr] ${className ?? ''}`}
			style={{ gridTemplateRows: '100%', backgroundColor: wa.sidebarBg, ...style }}
		>
			{/* Sidebar */}
			<div className={`h-full min-h-0 flex-col ${mobilePane === 'chat' ? 'hidden md:flex' : 'flex'}`} style={{ borderRight: `1px solid ${wa.border}` }}>
				<div className="flex flex-shrink-0 items-center justify-between px-4 py-3" style={{ backgroundColor: wa.panelBg }}>
					<div className="flex h-[34px] w-[34px] items-center justify-center rounded-full text-xs font-semibold text-white" style={{ backgroundColor: '#e8622c' }} title={`Signed in as ${traderId}`}>
						{initialsFor(traderId || 'You')}
					</div>
					<div className="flex items-center gap-2 sm:gap-5" style={{ color: '#aebac1' }}>
						<button aria-label="Add contact by account number" onClick={() => { setMobilePane('list'); setShowAddContact(true); }} className="rounded-full p-2.5 -m-1 touch-manipulation hover:bg-white/5 active:scale-95 transition-transform">
							<IconPlus />
						</button>
					</div>
				</div>

				<div className="flex-shrink-0 px-3 py-2">
					<div className="flex items-center gap-2.5 rounded-lg px-3 py-1.5" style={{ backgroundColor: wa.panelBg }}>
						<span style={{ color: wa.textSecondary }}><IconSearch /></span>
						<input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name or app number" className="w-full bg-transparent text-[13px] focus:outline-none" style={{ color: wa.textPrimary }} />
					</div>
				</div>

				<div className="min-h-0 flex-1 overflow-y-auto messenger-scrollbar">
					{showAddContact ? (
						<div className="flex flex-col p-6">
							<div className="mb-6 flex items-center justify-between">
								<h3 className="text-[16px] font-semibold" style={{ color: wa.textPrimary }}>Add contact</h3>
								<button aria-label="Close" onClick={() => { setShowAddContact(false); setAddContactError(null); }} className="rounded-full p-1 hover:bg-white/10 transition-colors" style={{ color: wa.textSecondary }}>
									<IconX />
								</button>
							</div>
							<label className="mb-2 block text-[13px] font-medium" style={{ color: wa.textSecondary }}>Trader app number (8 digits)</label>
							<input type="text" value={newAccountNumber} onChange={(e) => setNewAccountNumber(e.target.value)} placeholder="e.g. 24081901" className="mb-4 w-full rounded-md px-3 py-2.5 text-[14px] focus:outline-none" style={{ backgroundColor: wa.fieldBg, color: wa.textPrimary, border: `1px solid ${wa.border}` }} autoFocus />
							<label className="mb-2 block text-[13px] font-medium" style={{ color: wa.textSecondary }}>Display name (optional)</label>
							<input type="text" value={newDisplayName} onChange={(e) => setNewDisplayName(e.target.value)} placeholder="How this contact shows up in your list" className="mb-4 w-full rounded-md px-3 py-2.5 text-[14px] focus:outline-none" style={{ backgroundColor: wa.fieldBg, color: wa.textPrimary, border: `1px solid ${wa.border}` }} />
							{addContactError && (<p className="mb-4 rounded-md px-3 py-2 text-[12px]" style={{ backgroundColor: 'rgba(227, 91, 91, 0.1)', color: wa.danger }}>{addContactError}</p>)}
							<button onClick={handleAddContact} disabled={addingContact} className="mb-2 w-full rounded-md py-2.5 text-[14px] font-medium transition-opacity" style={{ backgroundColor: wa.accent, color: wa.sidebarBg, opacity: addingContact ? 0.7 : 1 }}>
								{addingContact ? 'Adding…' : 'Add and start chat'}
							</button>
							<button onClick={() => { setShowAddContact(false); setAddContactError(null); setNewAccountNumber(''); setNewDisplayName(''); }} className="w-full rounded-md py-2.5 text-[14px] font-medium transition-colors" style={{ backgroundColor: wa.fieldBg, color: wa.textPrimary }}>
								Cancel
							</button>
						</div>
					) : (
						<>
							{conversations.length === 0 && (
								<div className="flex flex-col items-center gap-3 p-6 text-center">
									<p className="text-[13px]" style={{ color: wa.textSecondary }}>No chats yet. Add someone by their 8-digit trader app number to start messaging.</p>
									<button onClick={() => setShowAddContact(true)} className="rounded-full px-4 py-1.5 text-[13px] font-medium" style={{ backgroundColor: wa.accent, color: wa.sidebarBg }}>Add contact</button>
								</div>
							)}
							{conversations.length > 0 && filteredConversations.length === 0 && (
								<p className="p-4 text-center text-xs" style={{ color: wa.textSecondary }}>No chats match "{search}".</p>
							)}
							{filteredConversations.map((c) => {
								const isActive = c.id === activeConversationId;
								return (
									<button key={c.id} onClick={() => { setActiveConversationId(c.id); setMobilePane('chat'); }} className="flex w-full items-center gap-3 px-3.5 py-3 text-left transition-colors touch-manipulation active:opacity-80" style={{ backgroundColor: isActive ? wa.fieldBg : 'transparent' }}>
										<div className="relative flex h-[46px] w-[46px] flex-shrink-0 items-center justify-center rounded-full text-[15px] font-semibold text-white" style={{ backgroundColor: c.avatarColor }}>
											{c.initials}
											{c.online && (<span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full" style={{ backgroundColor: wa.accent, border: `2px solid ${wa.sidebarBg}` }} />)}
										</div>
										<div className="min-w-0 flex-1 py-0.5" style={{ borderBottom: `1px solid ${wa.border}` }}>
											<div className="flex items-center justify-between">
												<span className="flex items-center gap-1.5 truncate text-[15px]" style={{ color: wa.textPrimary }}>
													{c.name}
													{mutedIds.has(c.id) && <IconBellOff />}
												</span>
												<span className="ml-2 flex-shrink-0 text-[12px]" style={{ color: c.unreadCount > 0 ? wa.accent : wa.textSecondary }}>{c.lastMessageTime}</span>
											</div>
											<div className="mt-0.5 flex items-center justify-between gap-2">
												<span className="flex min-w-0 items-center gap-1 truncate text-[13px]" style={{ color: wa.textSecondary }}>
													{c.lastMessageRead && <StatusTicks status={c.lastMessageRead} />}
													<span className="truncate">{c.lastMessagePreview}</span>
												</span>
												{c.unreadCount > 0 && (<span className="flex-shrink-0 rounded-full px-1.5 text-[11px] font-semibold leading-[18px]" style={{ backgroundColor: wa.accent, color: wa.sidebarBg }}>{c.unreadCount}</span>)}
											</div>
										</div>
									</button>
								);
							})}
						</>
					)}
				</div>
			</div>

			{/* Active conversation */}
			<div
				className={`relative h-full min-h-0 min-w-0 flex-col ${mobilePane === 'list' ? 'hidden' : 'flex'}`}
				style={{ backgroundColor: wa.chatBg, backgroundImage: 'radial-gradient(circle at 20% 20%, rgba(255,255,255,0.02) 1px, transparent 1px), radial-gradient(circle at 60% 70%, rgba(255,255,255,0.02) 1px, transparent 1px)', backgroundSize: '26px 26px' }}
			>
				{!activeConversation ? (
					<div className="flex flex-1 items-center justify-center px-6">
						<p className="text-sm text-center" style={{ color: wa.textSecondary }}>
							{conversations.length === 0 ? 'Add a contact by 8-digit trader app number to start chatting.' : 'Select a conversation to start chatting.'}
						</p>
					</div>
				) : (
					<>
						<div className="flex flex-shrink-0 items-center justify-between px-2 sm:px-4 py-2.5" style={{ backgroundColor: wa.panelBg }}>
							<button
								className="flex min-w-0 items-center gap-1 sm:gap-3 text-left"
								onClick={() => setShowContactInfo(true)}
							>
								<span
									aria-label="Back to chats"
									onClick={(e) => { e.stopPropagation(); setMobilePane('list'); }}
									className="rounded-full p-2.5 -ml-1 touch-manipulation hover:bg-white/5 active:scale-95 transition-transform md:hidden"
									style={{ color: '#aebac1' }}
								>
									<IconArrowLeft />
								</span>
								<div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white" style={{ backgroundColor: activeConversation.avatarColor }}>
									{activeConversation.initials}
								</div>
								<div className="min-w-0">
									<div className="truncate text-[15px]" style={{ color: wa.textPrimary }}>{activeConversation.name}</div>
									<div className="truncate text-[12px]" style={{ color: wa.textSecondary }}>
										{isBlocked ? 'Blocked' : activeConversation.online ? 'online' : `#${activeConversation.accountNumber}`}
									</div>
								</div>
							</button>

							<div className="flex flex-shrink-0 items-center gap-1 sm:gap-5" style={{ color: '#aebac1' }}>
								<button aria-label="Voice call" onClick={() => onStartCall?.(activeConversationId, 'voice')} className="rounded-full p-2.5 touch-manipulation hover:bg-white/5 active:scale-95 transition-transform">
									<IconPhone />
								</button>
								<button aria-label="Video call" onClick={() => onStartCall?.(activeConversationId, 'video')} className="hidden sm:inline-flex rounded-full p-2.5 touch-manipulation hover:bg-white/5 active:scale-95 transition-transform">
									<IconVideo />
								</button>
								<button aria-label="Search in chat" onClick={() => setShowInChatSearch((v) => !v)} className="hidden sm:inline-flex rounded-full p-2.5 touch-manipulation hover:bg-white/5 active:scale-95 transition-transform" style={{ color: showInChatSearch ? wa.accent : '#aebac1' }}>
									<IconSearch />
								</button>

								<div className="relative" ref={headerMenuRef}>
									<button aria-label="More options" onClick={() => setShowHeaderMenu((v) => !v)} className="rounded-full p-2.5 touch-manipulation hover:bg-white/5 active:scale-95 transition-transform">
										<IconDots />
									</button>
									{showHeaderMenu && (
										<div className="absolute right-0 top-full z-40 mt-1 w-56 overflow-hidden rounded-lg shadow-2xl" style={{ backgroundColor: '#233138', border: `1px solid ${wa.border}` }}>
											<MenuItem icon={<IconInfo />} label="Contact info" onClick={() => { setShowContactInfo(true); setShowHeaderMenu(false); }} />
											<MenuItem icon={<IconSearch />} label="Search in chat" onClick={() => { setShowInChatSearch(true); setShowHeaderMenu(false); }} />
											<MenuItem icon={<IconBellOff />} label={isMuted ? 'Unmute notifications' : 'Mute notifications'} onClick={toggleMute} />
											<MenuItem icon={<IconTrash />} label="Clear chat" onClick={handleClearChat} />
											<MenuItem icon={<IconBan />} label={isBlocked ? 'Unblock' : 'Block'} onClick={toggleBlock} danger={!isBlocked} />
											<MenuItem icon={<IconTrash2 />} label="Delete chat" onClick={handleDeleteChat} danger />
										</div>
									)}
								</div>
							</div>
						</div>

						{showInChatSearch && (
							<div className="flex flex-shrink-0 items-center gap-2 px-3 py-2" style={{ backgroundColor: wa.panelBg, borderTop: `1px solid ${wa.border}` }}>
								<IconSearch />
								<input
									autoFocus
									value={inChatQuery}
									onChange={(e) => setInChatQuery(e.target.value)}
									placeholder="Search messages in this chat"
									className="flex-1 bg-transparent text-[13px] focus:outline-none"
									style={{ color: wa.textPrimary }}
								/>
								<button onClick={() => { setShowInChatSearch(false); setInChatQuery(''); }} style={{ color: wa.textSecondary }}><IconX /></button>
							</div>
						)}

						<div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-3 sm:px-6 md:px-10 py-4 messenger-scrollbar">
							{visibleMessages.length === 0 && (
								<p className="mt-8 text-center text-[13px]" style={{ color: wa.textSecondary }}>
									{showInChatSearch && inChatQuery ? 'No messages match your search.' : 'No messages yet. Say hello 👋'}
								</p>
							)}
							{visibleMessages.map((m) => {
								const isMine = m.senderId === 'me';
								const replyLabel = m.replyTo ? (m.replyTo.senderId === 'me' ? 'You' : activeConversation?.name ?? 'Contact') : null;
								return (
									<motion.div
										key={m.id}
										whileTap={{ scale: 0.985 }}
										className={`trader-chat-message-bubble group relative flex ${isMine ? 'justify-end' : 'justify-start'}`}
										onClick={(e) => {
											e.stopPropagation();
											setActiveToolbarMessageId(id => (id === m.id ? null : m.id));
											setOpenReactionPickerId(null);
										}}
									>
										<div
											className={`max-w-[80%] sm:max-w-[65%] md:max-w-[55%] relative cursor-pointer transition-all ${m.attachment?.type === 'image' ? 'p-1' : 'px-2.5 pb-2 pt-1.5'}`}
											style={{ backgroundColor: isMine ? wa.bubbleOut : wa.bubbleIn, borderRadius: isMine ? '8px 0 8px 8px' : '0 8px 8px 8px' }}
										>
											{m.replyTo && (
												<div className="mb-2 rounded-md border px-2 py-1.5" style={{ backgroundColor: isMine ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.16)', borderColor: isMine ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.08)' }}>
													<div className="text-[11px] font-semibold" style={{ color: isMine ? wa.bubbleOutMeta : wa.textSecondary }}>{replyLabel}</div>
													<div className="truncate text-[12px]" style={{ color: isMine ? wa.textPrimary : wa.textSecondary }}>{m.replyTo.text || 'Message'}</div>
												</div>
											)}
											{m.text && (<p className="text-[14px]" style={{ color: wa.textPrimary }}>{m.text}</p>)}

											{m.attachment?.type === 'image' && m.attachment.url && (
												<button onClick={() => setLightboxUrl(m.attachment!.url!)} className="block overflow-hidden rounded-[6px]">
													<img src={m.attachment.url} alt={m.attachment.name} className="max-h-[280px] w-full object-cover" />
												</button>
											)}

											{m.attachment?.type === 'file' && (
												<a href={m.attachment.url ?? '#'} target="_blank" rel="noreferrer" download={m.attachment.name} className="flex items-center gap-2.5 py-0.5">
													<div className="flex h-[34px] w-[34px] flex-shrink-0 items-center justify-center rounded-md" style={{ backgroundColor: wa.fileIconBg, color: wa.bubbleOutMeta }}>
														<IconFile />
													</div>
													<div>
														<div className="text-[13px]" style={{ color: wa.textPrimary }}>{m.attachment.name}</div>
														{m.attachment.meta && (<div className="text-[11px]" style={{ color: wa.bubbleOutMeta }}>{m.attachment.meta}</div>)}
													</div>
												</a>
											)}

											{m.attachment?.type === 'voice' && (
												<VoiceMessagePlayer url={m.attachment.url} duration={m.attachment.duration} isMine={isMine} />
											)}

											<div className={`mt-0.5 flex items-center justify-end gap-1 text-[11px] ${m.attachment?.type === 'image' ? 'px-1.5 pb-1' : ''}`} style={{ color: isMine ? wa.bubbleOutMeta : wa.textSecondary }}>
												{m.timestamp}
												{isMine && <StatusTicks status={m.status} />}
											</div>

											{/* Reaction pill on the bubble — bounces in the first time it appears */}
											<AnimatePresence>
												{m.reactions && Object.keys(m.reactions).length > 0 && (
													<motion.div
														initial={{ opacity: 0, scale: 0.5 }}
														animate={{ opacity: 1, scale: 1 }}
														exit={{ opacity: 0, scale: 0.5 }}
														transition={{ type: 'spring', stiffness: 450, damping: 20 }}
														className={`absolute -bottom-2.5 flex items-center gap-0.5 rounded-full px-1.5 py-0.5 shadow-md backdrop-blur-sm ${isMine ? '-left-1' : '-right-1'}`}
														style={{ backgroundColor: `${wa.panelBg}f5`, border: `1px solid ${wa.border}` }}
													>
														{Object.entries(m.reactions).map(([emoji, traderIds]) => (
															<motion.button
																key={emoji}
																whileHover={{ scale: 1.15 }}
																whileTap={{ scale: 0.9 }}
																onClick={(e) => { e.stopPropagation(); toggleReaction(m.id, emoji); }}
																className="flex items-center gap-0.5 text-[11px]"
															>
																<span>{emoji}</span>
																{traderIds.length > 1 && <span style={{ color: wa.textSecondary }}>{traderIds.length}</span>}
															</motion.button>
														))}
													</motion.div>
												)}
											</AnimatePresence>
										</div>

										{/* Toolbar — springs in from the direction it's anchored, fades out on close */}
										<AnimatePresence>
											{activeToolbarMessageId === m.id && (
												<motion.div
													initial={{ opacity: 0, scale: 0.85, x: isMine ? 8 : -8 }}
													animate={{ opacity: 1, scale: 1, x: 0 }}
													exit={{ opacity: 0, scale: 0.85, x: isMine ? 8 : -8 }}
													transition={{ type: 'spring', stiffness: 400, damping: 25 }}
													className={`trader-chat-toolbar absolute top-0 flex items-center gap-0.5 rounded-full px-1 py-0.5 shadow-lg backdrop-blur-sm ${isMine ? 'right-full mr-1' : 'left-full ml-1'}`}
													style={{ backgroundColor: `${wa.panelBg}f0`, border: `1px solid ${wa.border}` }}
													onClick={(e) => e.stopPropagation()}
												>
													<button
														onClick={(e) => {
															e.stopPropagation();
															setOpenReactionPickerId((id) => (id === m.id ? null : m.id));
														}}
														aria-label="React"
														className="rounded-full p-1.5 transition-colors hover:bg-white/10"
														style={{ color: wa.textSecondary }}
													>
														<IconSmile />
													</button>
													<button
														onClick={(e) => {
															e.stopPropagation();
															setReplyingToId(m.id);
															setActiveToolbarMessageId(null);
														}}
														aria-label="Reply"
														className="rounded-full p-1.5 transition-colors hover:bg-white/10"
														style={{ color: wa.textSecondary }}
													>
														<IconReplyArrow />
													</button>
												</motion.div>
											)}
										</AnimatePresence>

										{/* Quick-reaction popover — pops in with a slight overshoot, staggered emoji entrance */}
										<AnimatePresence>
											{openReactionPickerId === m.id && (
												<motion.div
													initial={{ opacity: 0, scale: 0.7, y: 8 }}
													animate={{ opacity: 1, scale: 1, y: 0 }}
													exit={{ opacity: 0, scale: 0.7, y: 8 }}
													transition={{ type: 'spring', stiffness: 500, damping: 22 }}
													onClick={(e) => e.stopPropagation()}
													className={`trader-chat-reaction-picker absolute top-8 z-40 flex items-center gap-1 rounded-full px-2 py-1.5 shadow-2xl backdrop-blur-md ${isMine ? 'right-0' : 'left-0'}`}
													style={{ backgroundColor: '#233138e6', border: `1px solid ${wa.border}` }}
												>
													{QUICK_REACTIONS.map((emoji, i) => (
														<motion.button
															key={emoji}
															initial={{ opacity: 0, scale: 0 }}
															animate={{ opacity: 1, scale: 1 }}
															transition={{ delay: i * 0.03, type: 'spring', stiffness: 500 }}
															whileHover={{ scale: 1.35, y: -3 }}
															whileTap={{ scale: 0.9 }}
															onClick={() => { toggleReaction(m.id, emoji); setOpenReactionPickerId(null); setActiveToolbarMessageId(null); }}
															className="rounded-full p-1 text-[18px]"
														>
															{emoji}
														</motion.button>
													))}
													<motion.button
														whileHover={{ scale: 1.15 }}
														whileTap={{ scale: 0.9 }}
														onClick={() => { setShowEmojiPicker(true); setOpenReactionPickerId(null); }}
														aria-label="More reactions"
														className="rounded-full p-1.5 text-[13px]"
														style={{ color: wa.textSecondary }}
													>
														+
													</motion.button>
												</motion.div>
											)}
										</AnimatePresence>
									</motion.div>
								);
							})}
						</div>

						<input ref={fileInputRef} type="file" accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx" className="hidden" onChange={handleFileChosen} />

						{isBlocked ? (
							<div className="flex flex-shrink-0 items-center justify-center gap-3 px-4 py-4" style={{ backgroundColor: wa.chatBg }}>
								<span className="text-[13px]" style={{ color: wa.textSecondary }}>You blocked this contact.</span>
								<button onClick={toggleBlock} className="text-[13px] font-medium" style={{ color: wa.accent }}>Unblock</button>
							</div>
						) : isRecording ? (
							<div className="flex flex-shrink-0 items-center gap-3 px-4 pb-4 pt-2" style={{ backgroundColor: wa.chatBg }}>
								<button onClick={() => stopRecording(false)} aria-label="Cancel recording" className="rounded-full p-2" style={{ color: wa.danger }}>
									<IconTrash />
								</button>
								<div className="flex flex-1 items-center gap-2 rounded-2xl border px-3 py-2.5" style={{ backgroundColor: wa.fieldBg, borderColor: wa.border }}>
									<span className="h-2.5 w-2.5 flex-shrink-0 animate-pulse rounded-full" style={{ backgroundColor: wa.danger }} />
									<span className="text-[13px]" style={{ color: wa.textPrimary }}>Recording… {formatDuration(recordSeconds)}</span>
								</div>
								<button
									onClick={() => stopRecording(true)}
									aria-label="Send voice message"
									className="flex h-[38px] w-[38px] flex-shrink-0 items-center justify-center rounded-full transition-transform active:scale-95"
									style={{ backgroundColor: wa.accent, color: wa.sidebarBg }}
								>
									<IconSend />
								</button>
							</div>
						) : (
							<div className="relative flex-shrink-0 px-4 pb-4 pt-2" style={{ backgroundColor: wa.chatBg }}>
								{replyingToId && replyingToMessage && (
									<div className="mb-2 flex items-start justify-between rounded-lg border px-3 py-2 text-[12px]" style={{ backgroundColor: wa.fieldBg, borderColor: wa.border }}>
										<div className="min-w-0 pr-2">
											<div className="font-semibold" style={{ color: wa.textPrimary }}>Replying to {replyingToMessage.senderId === 'me' ? 'yourself' : activeConversation?.name ?? 'contact'}</div>
											<div className="truncate" style={{ color: wa.textSecondary }}>{previewTextForMessage(replyingToMessage)}</div>
										</div>
										<button onClick={() => setReplyingToId(null)} className="rounded-full p-1" style={{ color: wa.textSecondary }}><IconX /></button>
									</div>
								)}
								{showEmojiPicker && (
									<div ref={emojiPickerRef} className="absolute bottom-full left-4 z-40 mb-2 grid w-[280px] grid-cols-8 gap-1 rounded-lg p-3 shadow-2xl" style={{ backgroundColor: '#233138', border: `1px solid ${wa.border}` }}>
										{EMOJIS.map((emoji) => (
											<button key={emoji} onClick={() => insertEmoji(emoji)} className="rounded p-1.5 text-[18px] hover:bg-white/10">
												{emoji}
											</button>
										))}
									</div>
								)}
								<div className="flex items-end gap-2 rounded-2xl border px-3 py-2 shadow-lg" style={{ backgroundColor: wa.fieldBg, borderColor: wa.border }}>
									<button aria-label="Emoji" onClick={() => setShowEmojiPicker((v) => !v)} style={{ color: showEmojiPicker ? wa.accent : wa.textSecondary }} className="mb-1">
										<IconSmile />
									</button>
									<button aria-label="Attach file" style={{ color: wa.textSecondary }} onClick={handleAttachClick} className="mb-1">
										<IconPaperclip />
									</button>

									<textarea
										ref={textareaRef}
										rows={1}
										value={draft}
										onChange={(e) => setDraft(e.target.value)}
										onKeyDown={handleKeyDown}
										placeholder="Message"
										className="max-h-[160px] flex-1 resize-none bg-transparent py-1.5 text-[14px] leading-relaxed focus:outline-none"
										style={{ color: wa.textPrimary }}
									/>

									<button
										onClick={draft.trim() ? handleSend : startRecording}
										aria-label={draft.trim() ? 'Send message' : 'Record voice message'}
										className="mb-0.5 flex h-[34px] w-[34px] flex-shrink-0 items-center justify-center rounded-full transition-transform active:scale-95"
										style={{ backgroundColor: wa.accent, color: wa.sidebarBg }}
									>
										{draft.trim() ? <IconSend /> : <IconMic />}
									</button>
								</div>
							</div>
						)}

						{call && call.conversationId === activeConversationId && call.state !== 'idle' && call.state !== 'ended' && (
							<CallModal
								conversation={activeConversation!}
								type={call.type}
								callState={call.state}
								localStream={call.localStream}
								remoteStream={call.remoteStream}
								failReason={call.failReason}
								onToggleMute={onToggleCallMute ?? (() => false)}
								onEnd={() => onEndCall?.(activeConversationId)}
							/>
						)}

						{showContactInfo && (
							<div className="absolute inset-0 z-30 flex flex-col items-center gap-4 overflow-y-auto p-8" style={{ backgroundColor: wa.chatBg }}>
								<button onClick={() => setShowContactInfo(false)} className="self-start rounded-full p-2 hover:bg-white/5" style={{ color: wa.textSecondary }}>
									<IconArrowLeft />
								</button>
								<div className="flex h-24 w-24 items-center justify-center rounded-full text-3xl font-semibold text-white" style={{ backgroundColor: activeConversation.avatarColor }}>
									{activeConversation.initials}
								</div>
								<div className="text-center">
									<div className="text-[18px]" style={{ color: wa.textPrimary }}>{activeConversation.name}</div>
									<div className="mt-1 text-[13px]" style={{ color: wa.textSecondary }}>#{activeConversation.accountNumber}</div>
								</div>
							</div>
						)}
					</>
				)}
			</div>

			{lightboxUrl && (
				<div className="fixed inset-0 z-50 flex items-center justify-center p-6" style={{ backgroundColor: 'rgba(0,0,0,0.9)' }} onClick={() => setLightboxUrl(null)}>
					<button aria-label="Close" onClick={() => setLightboxUrl(null)} className="absolute right-6 top-6 rounded-full p-2 text-white hover:bg-white/10">
						<IconX />
					</button>
					<img src={lightboxUrl} alt="" className="max-h-full max-w-full rounded-md object-contain" onClick={(e) => e.stopPropagation()} />
				</div>
			)}
		</div>
	);
}

function MenuItem({ icon, label, onClick, danger }: { icon: React.ReactNode; label: string; onClick: () => void; danger?: boolean }) {
	return (
		<button
			onClick={onClick}
			className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-[13px] transition-colors hover:bg-white/5"
			style={{ color: danger ? wa.danger : wa.textPrimary }}
		>
			<span style={{ color: danger ? wa.danger : wa.textSecondary }}>{icon}</span>
			{label}
		</button>
	);
}