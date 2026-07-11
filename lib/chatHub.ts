export const CHAT_ATTACHMENT_MAX_BYTES = 10 * 1024 * 1024;
export const CHAT_ALLOWED_ATTACHMENT_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
  'video/mp4',
  'video/webm',
  'video/ogg',
]);

export function buildConversationKey(accountA: string, accountB: string) {
  const left = String(accountA || '').trim();
  const right = String(accountB || '').trim();
  if (!left || !right) {
    return `${left}:${right}`;
  }
  return [left, right].sort().join(':');
}

export function parseConversationId(conversationId: string) {
  const [left, right] = String(conversationId || '').split(':');
  return { left: left || '', right: right || '' };
}

export function getPeerAccountNumber(conversationId: string, currentAccountNumber: string) {
  const { left, right } = parseConversationId(conversationId);
  if (left && right) {
    return left === currentAccountNumber ? right : left;
  }
  return '';
}

export function normalizeConversationMessage(row: Record<string, any>) {
  const message: Record<string, any> = {
    id: row.id,
    conversationId: row.conversationId,
    senderId: row.senderAccountNumber === row.currentAccountNumber ? 'me' : row.senderAccountNumber,
    text: row.text || undefined,
    timestamp: row.createdAt || new Date().toISOString(),
    status: row.status || 'sent',
  };

  if (row.attachmentType) {
    message.attachment = {
      type: row.attachmentType,
      name: row.attachmentName || row.attachmentType,
      mimeType: row.attachmentMimeType || undefined,
      size: row.attachmentSize || undefined,
      url: row.attachmentUrl || undefined,
    };
  }

  return message;
}
