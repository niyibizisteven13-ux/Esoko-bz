import { describe, it, expect } from 'vitest';
import { buildConversationKey, normalizeConversationMessage } from '../lib/chatHub.ts';

describe('chat conversation helpers', () => {
  it('creates a deterministic conversation key for a peer pair', () => {
    expect(buildConversationKey('acct001', 'acct002')).toBe('acct001:acct002');
    expect(buildConversationKey('acct002', 'acct001')).toBe('acct001:acct002');
  });

  it('normalizes attachment payloads into a serializable structure', () => {
    const normalized = normalizeConversationMessage({
      id: 'msg-1',
      conversationId: 'acct001:acct002',
      senderAccountNumber: 'acct001',
      text: null,
      attachmentType: 'file',
      attachmentName: 'report.pdf',
      attachmentUrl: '/uploads/report.pdf',
      attachmentMimeType: 'application/pdf',
      attachmentSize: 1234,
      status: 'sent',
      createdAt: '2026-01-01T00:00:00.000Z',
    });

    expect(normalized.attachment).toEqual({
      type: 'file',
      name: 'report.pdf',
      mimeType: 'application/pdf',
      size: 1234,
      url: '/uploads/report.pdf',
    });
    expect(normalized.text).toBeUndefined();
  });
});
