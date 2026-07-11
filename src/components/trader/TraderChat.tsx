import React, { useEffect, useMemo, useRef, useState } from 'react';

/**
 * TraderChat
 * ----------
 * WhatsApp-style messenger UI, wired for dynamic contacts and pluggable
 * transport. No contact data is hardcoded anymore — conversations are
 * created by adding a peer's app account number.
 *
 * This component does NOT open a network connection itself. It exposes
 * callback props (onSendMessage, onSendFile, onAddContact, onStartCall,
 * onLookupAccount) so you can wire it to whatever hub you build (see the
 * companion backend prompt). The chat uses each trader's 8-digit app number
 * as the contact identifier. Until those props are supplied, it falls
 * back to local-only behavior so the UI is still fully usable for demos.
 *
 * SIZING NOTE (fixes composer getting cut off at the bottom of the page):
 * This component fills 100% of its parent's height via `h-full`. That only
 * works if the parent actually has a resolvable height (e.g. the parent is
 * a flex/grid child with `flex-1 min-h-0`, or has an explicit height set).
 * If you render <TraderChat /> inside a container with `height: auto`, the
 * browser has nothing to constrain it to, so the whole card can render
 * taller than the visible viewport and the input bar at the bottom gets
 * pushed past the fold. Wrap it like:
 *
 *   <div className="flex h-screen overflow-hidden">
 *     <Sidebar />
 *     <div className="flex flex-1 flex-col min-h-0 overflow-hidden">
 *       <TopBar />
 *       <div className="flex-1 min-h-0 p-4">
 *         <TraderChat ... />
 *       </div>
 *     </div>
 *   </div>
 *
 * You can also pass `className`/`style` to override sizing per-use.
 *
 * COMPOSER STYLING: the message input is a floating, auto-growing textarea
 * (matching Claude.ai's composer) rather than a flush single-line input bar.
 * It grows up to ~6 lines as you type, then scrolls internally past that.
 * Enter sends; Shift+Enter inserts a newline. This composer sits as a plain
 * flex-shrink-0 sibling after the scrollable message list, so as long as
 * the sizing rule above is followed, it stays pinned at the bottom on its
 * own — no `sticky` positioning is needed or used.
 *
 * SCROLLBAR: the message list references a `messenger-scrollbar` class for
 * a thin styled scrollbar. Add this once to your global stylesheet:
 *
 *   .messenger-scrollbar { scrollbar-width: thin; scrollbar-color: #3a4a52 transparent; }
 *   .messenger-scrollbar::-webkit-scrollbar { width: 6px; }
 *   .messenger-scrollbar::-webkit-scrollbar-thumb { background-color: #3a4a52; border-radius: 999px; }
 *   .messenger-scrollbar::-webkit-scrollbar-track { background: transparent; }
 */

interface TraderChatProps {
	/** The current user's own account number / id on the hub. */
	traderId?: string;
	/** Conversations to render. Omit to manage entirely via internal state. */
	contacts?: Conversation[];
	/** Message history to render. Omit to manage entirely via internal state. */
	messages?: ChatMessage[];
	/** The currently selected conversation id, if the parent controls selection. */
	selectedConversationId?: string;
	/** Called when the user selects or switches conversations. */
	onSelectConversation?: (conversationId: string) => void;

	/** Called when the user sends a text message. Wire this to your WebSocket send. */
	onSendMessage?: (conversationId: string, text: string) => void | Promise<void>;
	/** Called when the user attaches a file. Wire this to your upload endpoint. */
	onSendFile?: (conversationId: string, file: File) => void | Promise<void>;
	/**
	 * Called when the user adds a contact by 8-digit trader app number.
	 * Should resolve the app number to a real profile (name, avatar, online status)
	 * via your backend, e.g. GET /accounts/:number. Return null if the account doesn't exist.
	 */
	onAddContact?: (accountNumber: string, displayName?: string) => Promise<Conversation | null>;
	/** Called when the user presses the voice/video call button. Wire this to your signaling client. */
	onStartCall?: (conversationId: string, type: 'voice' | 'video') => void;

	/** Optional className merged onto the root element, in case you need to override sizing. */
	className?: string;
	/** Optional inline style merged onto the root element (e.g. { height: 600 }). */
	style?: React.CSSProperties;
}

type MessageStatus = 'sent' | 'delivered' | 'read';

interface ChatMessage {
	id: string;
	conversationId: string;
	senderId: string; // 'me' for outgoing messages, otherwise the sender's account number
	text?: string;
	attachment?: { type: 'file' | 'voice'; name: string; meta?: string; duration?: string; url?: string };
	timestamp: string;
	status?: MessageStatus;
}

interface Conversation {
	id: string;
	accountNumber: string; // the peer's assigned account number on the hub — the source of truth for identity
	name: string;
	initials: string;
	avatarColor: string;
	online: boolean;
	lastMessagePreview: string;
	lastMessageTime: string;
	lastMessageRead?: MessageStatus;
	unreadCount: number;
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

function IconSearch() {
	return (
		<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
			<circle cx="11" cy="11" r="8" />
			<line x1="21" y1="21" x2="16.65" y2="16.65" />
		</svg>
	);
}
function IconPhone() {
	return (
		<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
			<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.362 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.338 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
		</svg>
	);
}
function IconVideo() {
	return (
		<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
			<polygon points="23 7 16 12 23 17 23 7" />
			<rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
		</svg>
	);
}
function IconDots() {
	return (
		<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
			<circle cx="12" cy="5" r="1.6" />
			<circle cx="12" cy="12" r="1.6" />
			<circle cx="12" cy="19" r="1.6" />
		</svg>
	);
}
function IconSmile() {
	return (
		<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
			<circle cx="12" cy="12" r="10" />
			<path d="M8 14s1.5 2 4 2 4-2 4-2" />
			<line x1="9" y1="9" x2="9.01" y2="9" />
			<line x1="15" y1="9" x2="15.01" y2="9" />
		</svg>
	);
}
function IconPaperclip() {
	return (
		<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
			<path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
		</svg>
	);
}
function IconMic() {
	return (
		<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
			<path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
			<path d="M19 10v2a7 7 0 0 1-14 0v-2" />
			<line x1="12" y1="19" x2="12" y2="23" />
			<line x1="8" y1="23" x2="16" y2="23" />
		</svg>
	);
}
function IconSend() {
	return (
		<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
			<line x1="22" y1="2" x2="11" y2="13" />
			<polygon points="22 2 15 22 11 13 2 9 22 2" />
		</svg>
	);
}
function IconFile() {
	return (
		<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
			<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
			<polyline points="14 2 14 8 20 8" />
		</svg>
	);
}
function IconPlay() {
	return (
		<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
			<polygon points="5 3 19 12 5 21 5 3" />
		</svg>
	);
}
function IconCheck1() {
	return (
		<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
			<polyline points="20 6 9 17 4 12" />
		</svg>
	);
}
function IconCheck2({ color }: { color: string }) {
	return (
		<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
			<polyline points="18 6 7 17 2 12" />
			<polyline points="22 6 11 17 9 15" />
		</svg>
	);
}
function IconPlus() {
	return (
		<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
			<line x1="12" y1="5" x2="12" y2="19" />
			<line x1="5" y1="12" x2="19" y2="12" />
		</svg>
	);
}
function IconX() {
	return (
		<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
			<line x1="18" y1="6" x2="6" y2="18" />
			<line x1="6" y1="6" x2="18" y2="18" />
		</svg>
	);
}

function StatusTicks({ status }: { status?: MessageStatus }) {
	if (!status) return null;
	if (status === 'sent') return <IconCheck1 />;
	return <IconCheck2 color={status === 'read' ? wa.tickRead : wa.textSecondary} />;
}

function formatBytes(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
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
	className,
	style,
}: TraderChatProps): React.ReactElement {
	const [localConversations, setLocalConversations] = useState<Conversation[]>(contacts ?? []);
	const [localMessages, setLocalMessages] = useState<ChatMessage[]>(messagesProp ?? []);
	const [activeConversationId, setActiveConversationId] = useState<string>('');
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

	// Keep internal state in sync if the parent passes controlled data (e.g. from your hub).
	useEffect(() => {
		if (contacts) setLocalConversations(contacts);
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
	}, [selectedConversationId, activeConversationId]);

	useEffect(() => {
		if (activeConversationId && onSelectConversation) {
			onSelectConversation(activeConversationId);
		}
	}, [activeConversationId, onSelectConversation]);

	const activeMessages = useMemo(
		() => messages.filter((m) => m.conversationId === activeConversationId),
		[messages, activeConversationId],
	);

	const filteredConversations = useMemo(
		() => conversations.filter((c) => c.name.toLowerCase().includes(search.trim().toLowerCase()) || c.accountNumber.includes(search.trim())),
		[conversations, search],
	);

	useEffect(() => {
		scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
	}, [activeMessages.length, activeConversationId]);

	// Auto-grow the composer textarea up to a capped height as the draft changes.
	useEffect(() => {
		const el = textareaRef.current;
		if (!el) return;
		el.style.height = 'auto';
		el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
	}, [draft]);

	function handleSend() {
		const text = draft.trim();
		if (!text || !activeConversationId) return;

		const newMessage: ChatMessage = {
			id: `local-${Date.now()}`,
			conversationId: activeConversationId,
			senderId: 'me',
			text,
			timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
			status: 'sent',
		};

		// Optimistic local append. Your hub should push a confirmed/echoed version back
		// (e.g. over the WebSocket) which you can reconcile by id, or just update status.
		setLocalMessages((prev) => [...prev, newMessage]);
		setLocalConversations((prev) =>
			prev.map((c) =>
				c.id === activeConversationId
					? { ...c, lastMessagePreview: text, lastMessageTime: newMessage.timestamp, lastMessageRead: 'sent' }
					: c,
			),
		);
		setDraft('');

		if (onSendMessage) {
			onSendMessage(activeConversationId, text);
		}
	}

	function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			handleSend();
		}
		// Shift+Enter falls through and inserts a newline, matching Claude.ai's composer
	}

	function handleAttachClick() {
		fileInputRef.current?.click();
	}

	function handleFileChosen(e: React.ChangeEvent<HTMLInputElement>) {
		const file = e.target.files?.[0];
		e.target.value = ''; // allow choosing the same file again
		if (!file || !activeConversationId) return;

		const objectUrl = URL.createObjectURL(file);
		const newMessage: ChatMessage = {
			id: `local-file-${Date.now()}`,
			conversationId: activeConversationId,
			senderId: 'me',
			attachment: {
				type: 'file',
				name: file.name,
				meta: `${formatBytes(file.size)} · ${file.type || 'file'}`,
				url: objectUrl,
			},
			timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
			status: 'sent',
		};

		// Shown immediately from the local object URL. Once your upload finishes,
		// swap `url`/`meta` for the hub's hosted URL by updating this message's id.
		setLocalMessages((prev) => [...prev, newMessage]);
		setLocalConversations((prev) =>
			prev.map((c) =>
				c.id === activeConversationId
					? { ...c, lastMessagePreview: `📎 ${file.name}`, lastMessageTime: newMessage.timestamp, lastMessageRead: 'sent' }
					: c,
			),
		);

		if (onSendFile) {
			onSendFile(activeConversationId, file);
		}
	}

	async function handleAddContact() {
		const accountNumber = newAccountNumber.trim();
		if (!accountNumber) {
			setAddContactError('Enter an 8-digit trader app number.');
			return;
		}
		if (!/^[0-9]{8}$/.test(accountNumber)) {
			setAddContactError('Trader app number must be 8 digits.');
			return;
		}
		if (conversations.some((c) => c.accountNumber === accountNumber)) {
			setAddContactError('This account is already in your chats.');
			return;
		}

		setAddContactError(null);
		setAddingContact(true);
		try {
			let newConversation: Conversation | null = null;

			if (onAddContact) {
				// Expected to resolve the account number against your backend
				// (e.g. GET /accounts/:number) and return a real profile, or null if not found.
				newConversation = await onAddContact(accountNumber, newDisplayName.trim() || undefined);
			} else {
				// No backend wired yet — create a local placeholder so the UI stays usable.
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
		if (onStartCall) {
			onStartCall(activeConversationId, type);
		} else {
			// No signaling wired yet — this is where you'd open your WebRTC call UI / connect to your signaling server.
			console.warn(`[TraderChat] onStartCall not wired — would start a ${type} call with ${activeConversation?.accountNumber}`);
		}
	}

	return (
		<div
			className={`grid h-full min-h-0 w-full overflow-hidden rounded-lg ${className ?? ''}`}
			style={{ gridTemplateColumns: '280px 1fr', gridTemplateRows: '100%', backgroundColor: wa.sidebarBg, ...style }}
		>
			{/* Sidebar: conversation list */}
			<div className="flex h-full min-h-0 flex-col" style={{ borderRight: `1px solid ${wa.border}` }}>
				<div
					className="flex flex-shrink-0 items-center justify-between px-4 py-3"
					style={{ backgroundColor: wa.panelBg }}
				>
					<div
						className="flex h-[34px] w-[34px] items-center justify-center rounded-full text-xs font-semibold text-white"
						style={{ backgroundColor: '#e8622c' }}
						title={`Signed in as ${traderId}`}
					>
						{initialsFor(traderId || 'You')}
					</div>
					<div className="flex items-center gap-5" style={{ color: '#aebac1' }}>
						<button aria-label="Add contact by account number" onClick={() => setShowAddContact(true)}>
							<IconPlus />
						</button>
						<button aria-label="Menu"><IconDots /></button>
					</div>
				</div>

				<div className="flex-shrink-0 px-3 py-2">
					<div
						className="flex items-center gap-2.5 rounded-lg px-3 py-1.5"
						style={{ backgroundColor: wa.panelBg }}
					>
						<span style={{ color: wa.textSecondary }}><IconSearch /></span>
						<input
							type="text"
							value={search}
							onChange={(e) => setSearch(e.target.value)}
							placeholder="Search name or app number"
							className="w-full bg-transparent text-[13px] focus:outline-none"
							style={{ color: wa.textPrimary }}
						/>
					</div>
				</div>

				<div className="min-h-0 flex-1 overflow-y-auto messenger-scrollbar">
					{conversations.length === 0 && (
						<div className="flex flex-col items-center gap-3 p-6 text-center">
							<p className="text-[13px]" style={{ color: wa.textSecondary }}>
						No chats yet. Add someone by their 8-digit trader app number to start messaging.
							</p>
							<button
								onClick={() => setShowAddContact(true)}
								className="rounded-full px-4 py-1.5 text-[13px] font-medium"
								style={{ backgroundColor: wa.accent, color: wa.sidebarBg }}
							>
								Add contact
							</button>
						</div>
					)}

					{conversations.length > 0 && filteredConversations.length === 0 && (
						<p className="p-4 text-center text-xs" style={{ color: wa.textSecondary }}>
							No chats match "{search}".
						</p>
					)}

					{filteredConversations.map((c) => {
						const isActive = c.id === activeConversationId;
						return (
							<button
								key={c.id}
								onClick={() => setActiveConversationId(c.id)}
								className="flex w-full items-center gap-3 px-3.5 py-2.5 text-left transition-colors"
								style={{ backgroundColor: isActive ? wa.fieldBg : 'transparent' }}
							>
								<div
									className="relative flex h-[46px] w-[46px] flex-shrink-0 items-center justify-center rounded-full text-[15px] font-semibold text-white"
									style={{ backgroundColor: c.avatarColor }}
								>
									{c.initials}
									{c.online && (
										<span
											className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full"
											style={{ backgroundColor: wa.accent, border: `2px solid ${wa.sidebarBg}` }}
										/>
									)}
								</div>
								<div
									className="min-w-0 flex-1 py-0.5"
									style={{ borderBottom: `1px solid ${wa.border}` }}
								>
									<div className="flex items-center justify-between">
										<span className="truncate text-[15px]" style={{ color: wa.textPrimary }}>{c.name}</span>
										<span className="ml-2 flex-shrink-0 text-[12px]" style={{ color: c.unreadCount > 0 ? wa.accent : wa.textSecondary }}>
											{c.lastMessageTime}
										</span>
									</div>
									<div className="mt-0.5 flex items-center justify-between gap-2">
										<span className="flex min-w-0 items-center gap-1 truncate text-[13px]" style={{ color: wa.textSecondary }}>
											{c.lastMessageRead && <StatusTicks status={c.lastMessageRead} />}
											<span className="truncate">{c.lastMessagePreview}</span>
										</span>
										{c.unreadCount > 0 && (
											<span
												className="flex-shrink-0 rounded-full px-1.5 text-[11px] font-semibold leading-[18px]"
												style={{ backgroundColor: wa.accent, color: wa.sidebarBg }}
											>
												{c.unreadCount}
											</span>
										)}
									</div>
								</div>
							</button>
						);
					})}
				</div>
			</div>

			{/* Active conversation */}
			<div
				className="relative flex h-full min-h-0 min-w-0 flex-col"
				style={{
					backgroundColor: wa.chatBg,
					backgroundImage:
						'radial-gradient(circle at 20% 20%, rgba(255,255,255,0.02) 1px, transparent 1px), radial-gradient(circle at 60% 70%, rgba(255,255,255,0.02) 1px, transparent 1px)',
					backgroundSize: '26px 26px',
				}}
			>
				{!activeConversation ? (
					<div className="flex flex-1 items-center justify-center">
						<p className="text-sm" style={{ color: wa.textSecondary }}>
							{conversations.length === 0 ? 'Add a contact by 8-digit trader app number to start chatting.' : 'Select a conversation to start chatting.'}
						</p>
					</div>
				) : (
					<>
						<div className="flex flex-shrink-0 items-center justify-between px-4 py-2.5" style={{ backgroundColor: wa.panelBg }}>
							<div className="flex items-center gap-3">
								<div
									className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold text-white"
									style={{ backgroundColor: activeConversation.avatarColor }}
								>
									{activeConversation.initials}
								</div>
								<div>
									<div className="text-[15px]" style={{ color: wa.textPrimary }}>{activeConversation.name}</div>
									<div className="text-[12px]" style={{ color: wa.textSecondary }}>
										{activeConversation.online ? 'online' : `#${activeConversation.accountNumber}`}
									</div>
								</div>
							</div>
							<div className="flex items-center gap-5" style={{ color: '#aebac1' }}>
								<button aria-label="Voice call" onClick={() => handleStartCall('voice')}><IconPhone /></button>
								<button aria-label="Video call" onClick={() => handleStartCall('video')}><IconVideo /></button>
								<button aria-label="Search in chat"><IconSearch /></button>
								<button aria-label="More options"><IconDots /></button>
							</div>
						</div>

						<div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-10 py-4 messenger-scrollbar">
							{activeMessages.length === 0 && (
								<p className="mt-8 text-center text-[13px]" style={{ color: wa.textSecondary }}>
									No messages yet. Say hello 👋
								</p>
							)}
							{activeMessages.map((m) => {
								const isMine = m.senderId === 'me';
								return (
									<div key={m.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
										<div
											className="max-w-[55%] px-2.5 pb-2 pt-1.5"
											style={{
												backgroundColor: isMine ? wa.bubbleOut : wa.bubbleIn,
												borderRadius: isMine ? '8px 0 8px 8px' : '0 8px 8px 8px',
											}}
										>
											{m.text && (
												<p className="text-[14px]" style={{ color: wa.textPrimary }}>{m.text}</p>
											)}

											{m.attachment?.type === 'file' && (
												<a
													href={m.attachment.url ?? '#'}
													target="_blank"
													rel="noreferrer"
													download={m.attachment.name}
													className="flex items-center gap-2.5 py-0.5"
												>
													<div
														className="flex h-[34px] w-[34px] flex-shrink-0 items-center justify-center rounded-md"
														style={{ backgroundColor: wa.fileIconBg, color: wa.bubbleOutMeta }}
													>
														<IconFile />
													</div>
													<div>
														<div className="text-[13px]" style={{ color: wa.textPrimary }}>{m.attachment.name}</div>
														{m.attachment.meta && (
															<div className="text-[11px]" style={{ color: wa.bubbleOutMeta }}>{m.attachment.meta}</div>
														)}
													</div>
												</a>
											)}

											{m.attachment?.type === 'voice' && (
												<div className="flex min-w-[150px] items-center gap-2.5 py-0.5">
													<div
														className="flex h-[30px] w-[30px] flex-shrink-0 items-center justify-center rounded-full text-white"
														style={{ backgroundColor: '#e8622c' }}
													>
														<IconPlay />
													</div>
													<div className="h-[3px] flex-1 rounded-full" style={{ backgroundColor: '#3a4a52' }} />
													<span className="text-[11px]" style={{ color: wa.textSecondary }}>{m.attachment.duration}</span>
												</div>
											)}

											<div
												className="mt-0.5 flex items-center justify-end gap-1 text-[11px]"
												style={{ color: isMine ? wa.bubbleOutMeta : wa.textSecondary }}
											>
												{m.timestamp}
												{isMine && <StatusTicks status={m.status} />}
											</div>
										</div>
									</div>
								);
							})}
						</div>

						<input ref={fileInputRef} type="file" className="hidden" onChange={handleFileChosen} />

						{/* Composer — floating rounded card, auto-growing textarea, Claude.ai style.
						    Plain flex-shrink-0 flow (no sticky needed) — stays pinned as long as
						    the ancestor height chain described in the top-of-file comment is followed. */}
						<div className="flex-shrink-0 px-4 pb-4 pt-2" style={{ backgroundColor: wa.chatBg }}>
							<div
								className="flex items-end gap-2 rounded-2xl border px-3 py-2 shadow-lg"
								style={{ backgroundColor: wa.fieldBg, borderColor: wa.border }}
							>
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
									onClick={draft.trim() ? handleSend : undefined}
									aria-label={draft.trim() ? 'Send message' : 'Record voice message'}
									className="mb-0.5 flex h-[34px] w-[34px] flex-shrink-0 items-center justify-center rounded-full transition-transform active:scale-95 disabled:opacity-40"
									disabled={!draft.trim()}
									style={{ backgroundColor: wa.accent, color: wa.sidebarBg }}
								>
									{draft.trim() ? <IconSend /> : <IconMic />}
								</button>
							</div>
						</div>
					</>
				)}

				{/* Add contact modal */}
				{showAddContact && (
					<div className="absolute inset-0 z-10 flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
						<div className="w-[320px] rounded-lg p-5" style={{ backgroundColor: wa.panelBg }}>
							<div className="mb-4 flex items-center justify-between">
								<h3 className="text-[16px]" style={{ color: wa.textPrimary }}>Add contact</h3>
								<button
									aria-label="Close"
									onClick={() => {
										setShowAddContact(false);
										setAddContactError(null);
									}}
									style={{ color: wa.textSecondary }}
								>
									<IconX />
								</button>
							</div>

							<label className="mb-1 block text-[12px]" style={{ color: wa.textSecondary }}>Trader app number (8 digits)</label>
							<input
								type="text"
								value={newAccountNumber}
								onChange={(e) => setNewAccountNumber(e.target.value)}
								placeholder="e.g. 24081901"
								className="mb-3 w-full rounded-md px-3 py-2 text-[14px] focus:outline-none"
								style={{ backgroundColor: wa.fieldBg, color: wa.textPrimary }}
							/>

							<label className="mb-1 block text-[12px]" style={{ color: wa.textSecondary }}>Display name (optional)</label>
							<input
								type="text"
								value={newDisplayName}
								onChange={(e) => setNewDisplayName(e.target.value)}
								placeholder="How this contact shows up in your list"
								className="mb-3 w-full rounded-md px-3 py-2 text-[14px] focus:outline-none"
								style={{ backgroundColor: wa.fieldBg, color: wa.textPrimary }}
							/>

							{addContactError && (
								<p className="mb-3 text-[12px]" style={{ color: wa.danger }}>{addContactError}</p>
							)}

							<button
								onClick={handleAddContact}
								disabled={addingContact}
								className="w-full rounded-md py-2 text-[14px] font-medium"
								style={{ backgroundColor: wa.accent, color: wa.sidebarBg, opacity: addingContact ? 0.7 : 1 }}
							>
								{addingContact ? 'Adding…' : 'Add and start chat'}
							</button>
						</div>
					</div>
				)}
			</div>
		</div>
	);
}