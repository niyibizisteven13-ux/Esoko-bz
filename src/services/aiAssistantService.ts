import { buildLocalAssistantReply, type AssistantContext, type AssistantReply, type AssistantRole } from '../lib/aiAssistant';
import { apiPost, apiGet, apiDelete } from './apiClient';

export async function getAssistantReply(
  message: string,
  role: AssistantRole,
  context: AssistantContext = {},
  options: { conversationId?: string; history?: Array<{ role: string; content: string }> } = {}
): Promise<AssistantReply> {
  const localReply = buildLocalAssistantReply(message, role, context);

  if (typeof window !== 'undefined') {
    try {
      const payload = await apiPost<AssistantReply>('/api/ai/assistant', {
        message,
        role,
        context,
        conversationId: options.conversationId,
        history: options.history || [],
      });
      if (payload?.reply) {
        return {
          reply: payload.reply,
          suggestions: payload.suggestions || localReply.suggestions,
          mode: payload.mode === 'remote' ? 'remote' : 'local',
          actionType: payload.actionType || localReply.actionType,
          targetTab: payload.targetTab || localReply.targetTab,
          searchQuery: payload.searchQuery || localReply.searchQuery,
        };
      }
    } catch (error) {
      console.warn('Remote AI assistant unavailable, falling back to local guidance', error);
    }
  }

  return localReply;
}

export async function fetchAssistantSummary() {
  return apiGet<{ success: boolean; summary: any }>('/api/ai/assistant/summary');
}

export async function listAssistantConversations(options: { limit?: number; before?: string } = {}) {
  const params = new URLSearchParams();
  if (options.limit) params.append('limit', String(options.limit));
  if (options.before) params.append('before', options.before);
  return apiGet<{ success: boolean; conversations: any[] }>(`/api/ai/assistant/conversations?${params.toString()}`);
}

export async function getAssistantConversation(conversationKey: string) {
  return apiGet<{ success: boolean; conversation: any }>(`/api/ai/assistant/conversations/${encodeURIComponent(conversationKey)}`);
}

export async function deleteAssistantConversation(conversationKey: string) {
  return apiDelete<{ success: boolean }>(`/api/ai/assistant/conversations/${encodeURIComponent(conversationKey)}`);
}
