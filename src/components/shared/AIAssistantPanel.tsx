import React, { useMemo, useState } from 'react';
import { Bot, Send, Sparkles } from 'lucide-react';
import { getAssistantReply } from '../../services/aiAssistantService';
import type { AssistantReply, AssistantRole } from '../../lib/aiAssistant';

interface AIAssistantPanelProps {
  role: AssistantRole;
  title?: string;
  subtitle?: string;
  context?: Record<string, unknown>;
  compact?: boolean;
}

const DEFAULT_PROMPTS: Record<AssistantRole, string[]> = {
  customer: [
    'Find good products for my family',
    'Show me better offers today',
    'Help me compare trusted sellers',
  ],
  trader: [
    'Help me restock fast sellers',
    'Improve my sales this week',
    'Give me a smart inventory tip',
  ],
  admin: [
    'Summarize the biggest business risks',
    'Help me spot suspicious activity',
    'Recommend a follow-up for this account',
  ],
};

export default function AIAssistantPanel({
  role,
  title = 'AI Copilot',
  subtitle = 'Ask for action-oriented help in plain language.',
  context = {},
  compact = false,
}: AIAssistantPanelProps) {
  const [message, setMessage] = useState('');
  const [reply, setReply] = useState<AssistantReply | null>(null);
  const [loading, setLoading] = useState(false);

  const prompts = useMemo(() => DEFAULT_PROMPTS[role] || DEFAULT_PROMPTS.customer, [role]);

  const handleSubmit = async (value?: string) => {
    const prompt = (value ?? message).trim();
    if (!prompt) return;

    setLoading(true);
    setMessage('');
    try {
      const response = await getAssistantReply(prompt, role, context);
      setReply(response);
    } catch (error) {
      console.error('AI assistant error', error);
      setReply({
        reply: 'I hit a temporary issue, but I can still guide you with practical next steps.',
        suggestions: ['Try a shorter request', 'Ask about sales or inventory', 'Check your recent activity'],
        mode: 'local',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`rounded-[2rem] border border-white/10 bg-[#0a0a0a] p-4 md:p-5 ${compact ? 'md:p-4' : ''}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-orange-400">
            <Bot size={16} />
            <p className="text-[10px] font-black uppercase tracking-[0.2em]">{title}</p>
          </div>
          <h3 className="mt-2 text-xl font-black text-white">{subtitle}</h3>
        </div>
        <div className="rounded-2xl border border-orange-500/20 bg-orange-600/10 p-2 text-orange-400">
          <Sparkles size={18} />
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {prompts.map((prompt) => (
          <button
            key={prompt}
            type="button"
            onClick={() => void handleSubmit(prompt)}
            className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-[11px] font-semibold text-white/70 transition hover:bg-white/10"
          >
            {prompt}
          </button>
        ))}
      </div>

      <form
        className="mt-4 flex flex-col gap-3 rounded-[1.5rem] border border-white/10 bg-black/20 p-3"
        onSubmit={(event) => {
          event.preventDefault();
          void handleSubmit();
        }}
      >
        <textarea
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          rows={3}
          placeholder={role === 'trader' ? 'How can I grow my store today?' : 'What should I search for or compare today?'}
          className="w-full resize-none rounded-2xl border border-white/10 bg-white/5 px-3 py-3 text-sm text-white outline-none ring-0 placeholder:text-white/30"
        />
        <div className="flex items-center justify-between gap-3">
          <p className="text-[11px] text-white/40">Works with local guidance first and can connect to an AI provider if configured.</p>
          <button
            type="submit"
            disabled={loading}
            className="flex items-center gap-2 rounded-2xl bg-orange-600 px-4 py-2 text-[11px] font-black uppercase tracking-[0.2em] text-black transition hover:bg-orange-500 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {loading ? 'Thinking...' : 'Ask'}
            <Send size={14} />
          </button>
        </div>
      </form>

      {reply && (
        <div className="mt-4 rounded-[1.5rem] border border-orange-500/20 bg-orange-600/10 p-4">
          <p className="text-sm font-semibold text-white">{reply.reply}</p>
          {reply.suggestions?.length ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {reply.suggestions.map((suggestion) => (
                <span key={suggestion} className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-[11px] text-white/70">
                  {suggestion}
                </span>
              ))}
            </div>
          ) : null}
          <p className="mt-3 text-[10px] uppercase tracking-[0.2em] text-orange-300">
            Mode: {reply.mode === 'remote' ? 'AI provider' : 'local guidance'}
          </p>
        </div>
      )}
    </div>
  );
}
