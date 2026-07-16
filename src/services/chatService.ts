import { apiGet, apiPost, apiPut, apiDelete } from './apiClient';

export type ChatMessageStatus = 'sent' | 'delivered' | 'read';

export interface ChatConversationSummary {
  id: string;
  accountNumber: string;
  name: string;
  initials: string;
  avatarColor: string;
  online: boolean;
  lastMessagePreview: string;
  lastMessageTime: string;
  lastMessageRead?: ChatMessageStatus;
  unreadCount: number;
  profilePhoto?: string | null;
  lastSeen?: string | null;
  muted?: boolean;
  blocked?: boolean;
}

export interface ChatMessageShape {
  id: string;
  conversationId: string;
  senderId: string;
  text?: string;
  attachment?: {
    type: 'file' | 'voice';
    name: string;
    meta?: string;
    duration?: string;
    url?: string;
  };
  timestamp: string;
  status?: ChatMessageStatus;
  replyToMessageId?: string | null;
  reactions?: Record<string, string[]>;
}

function formatTimestamp(timestamp?: string) {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return timestamp;
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function normalizeChatMessage(payload: any, currentAccountNumber: string): ChatMessageShape {
  const senderAccountNumber = payload.senderAccountNumber || payload.from || payload.senderId || '';
  const senderId = senderAccountNumber === currentAccountNumber ? 'me' : senderAccountNumber;
  return {
    id: payload.id,
    conversationId: payload.conversationId,
    senderId,
    text: payload.text || undefined,
    attachment: payload.attachment
      ? {
          type: payload.attachment.type || 'file',
          name: payload.attachment.name || 'Attachment',
          meta: payload.attachment.meta || payload.attachment.mimeType || undefined,
          url: payload.attachment.url || undefined,
        }
      : payload.attachmentType
        ? {
            type: payload.attachmentType,
            name: payload.attachmentName || 'Attachment',
            meta: payload.attachmentMimeType || undefined,
            url: payload.attachmentUrl || undefined,
          }
        : undefined,
    timestamp: formatTimestamp(payload.timestamp || payload.createdAt),
    status: payload.status || 'sent',
    replyToMessageId: payload.replyToMessageId || null,
    reactions: payload.reactions || undefined,
  };
}

export function normalizeConversationSummary(payload: any, _currentAccountNumber: string): ChatConversationSummary {
  return {
    id: payload.id,
    accountNumber: payload.accountNumber,
    name: payload.name || payload.accountNumber,
    initials: payload.initials || '?',
    avatarColor: payload.avatarColor || '#e8622c',
    online: Boolean(payload.online),
    lastMessagePreview: payload.lastMessagePreview || 'No messages yet',
    lastMessageTime: payload.lastMessageTime || '',
    lastMessageRead: payload.lastMessageRead,
    unreadCount: Number(payload.unreadCount || 0),
    profilePhoto: payload.profilePhoto || null,
    lastSeen: payload.lastSeen || null,
    muted: Boolean(payload.muted),
    blocked: Boolean(payload.blocked),
  };
}

export async function fetchConversations(currentAccountNumber: string) {
  const data = await apiGet<{ conversations: any[] }>('/api/conversations');
  return data.conversations.map((conversation) => normalizeConversationSummary(conversation, currentAccountNumber));
}

export async function fetchConversationMessages(conversationId: string, currentAccountNumber: string) {
  const data = await apiGet<{ messages: any[] }>(`/api/conversations/${conversationId}/messages`);
  return data.messages.map((message) => normalizeChatMessage(message, currentAccountNumber));
}

export async function createConversation(accountNumber: string, displayName: string | undefined, currentAccountNumber: string) {
  const data = await apiPost<{ conversation: any }>('/api/conversations', { accountNumber, displayName });
  return normalizeConversationSummary(data.conversation, currentAccountNumber);
}

export async function sendChatMessage(
  conversationId: string,
  text: string,
  currentAccountNumber: string,
  replyToMessageId?: string | null,
) {
  const data = await apiPost<{ message: any }>(`/api/conversations/${conversationId}/messages`, {
    text,
    replyToMessageId: replyToMessageId || null,
  });
  return normalizeChatMessage(data.message, currentAccountNumber);
}

export async function toggleReaction(messageId: string, emoji: string, currentAccountNumber: string) {
  const data = await apiPost<{ message: any }>(`/api/messages/${messageId}/reactions`, { emoji });
  return normalizeChatMessage(data.message, currentAccountNumber);
}

export async function sendChatAttachment(conversationId: string, file: File, currentAccountNumber: string, replyToMessageId?: string | null) {
  const formData = new FormData();
  formData.append('file', file);
  if (replyToMessageId) {
    formData.append('replyToMessageId', replyToMessageId);
  }
  const data = await apiPost<{ message: any; attachment: any }>(`/api/conversations/${conversationId}/attachments`, formData);
  return {
    message: normalizeChatMessage(data.message, currentAccountNumber),
    attachment: data.attachment,
  };
}

export async function lookupChatAccount(accountNumber: string) {
  return apiGet<any>(`/api/accounts/${accountNumber}`);
}

export async function muteConversation(conversationId: string, muted: boolean, currentAccountNumber: string) {
  return apiPut<{ success: boolean }>(`/api/conversations/${conversationId}/mute`, { muted });
}

export async function clearChat(conversationId: string, currentAccountNumber: string) {
  return apiPost<{ success: boolean }>(`/api/conversations/${conversationId}/clear`);
}

export async function blockContact(conversationId: string, blocked: boolean, currentAccountNumber: string) {
  return apiPut<{ success: boolean }>(`/api/conversations/${conversationId}/block`, { blocked });
}

export async function deleteConversation(conversationId: string, currentAccountNumber: string) {
  return apiDelete<{ success: boolean }>(`/api/conversations/${conversationId}`);
}

export async function uploadVoiceNote(
  conversationId: string,
  audioBlob: Blob,
  duration: number,
  recipientAccountNumber: string
) {
  const formData = new FormData();
  formData.append('audio', audioBlob, `voice-${Date.now()}.mp3`);
  formData.append('duration', duration.toString());
  formData.append('recipientAccountNumber', recipientAccountNumber);
  
  return apiPost<{ messageId: string; message: any }>(
    `/api/conversations/${conversationId}/voice-notes`,
    formData
  );
}

export async function uploadVideoNote(
  conversationId: string,
  videoBlob: Blob,
  duration: number,
  recipientAccountNumber: string,
  thumbnail?: string
) {
  const formData = new FormData();
  formData.append('video', videoBlob, `video-${Date.now()}.mp4`);
  formData.append('duration', duration.toString());
  formData.append('recipientAccountNumber', recipientAccountNumber);
  if (thumbnail) {
    formData.append('thumbnailUrl', thumbnail);
  }
  
  return apiPost<{ messageId: string; message: any }>(
    `/api/conversations/${conversationId}/video-notes`,
    formData
  );
}

export async function getCallHistory(conversationId: string) {
  return apiGet<{ calls: any[] }>(`/api/conversations/${conversationId}/calls`);
}
