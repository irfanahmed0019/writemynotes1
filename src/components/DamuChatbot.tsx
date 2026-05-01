import { useState, useRef, useEffect, useCallback } from 'react';
import { X, Bot, ArrowUp } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { useUiLayout } from '@/hooks/use-ui-layout';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useAppSettings } from '@/hooks/use-app-settings';
import { supabase } from '@/integrations/supabase/client';
import ReactMarkdown from 'react-markdown';

type Msg = { role: 'user' | 'assistant'; content: string };
type QuickAction = { label: string; kind: 'navigate' | 'send'; value: string };

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/damu-chat`;

const DEFAULT_QUICK_ACTIONS: QuickAction[] = [
  { label: 'Open Notes', kind: 'navigate', value: '/study' },
  { label: 'Create Post', kind: 'navigate', value: '/post' },
  { label: 'Open Chats', kind: 'navigate', value: '/chats' },
];

function getQuickActions(messages: Msg[]): QuickAction[] {
  const lastUserMessage = [...messages].reverse().find(message => message.role === 'user')?.content.toLowerCase() ?? '';

  if (!lastUserMessage) return DEFAULT_QUICK_ACTIONS;

  if (/(note|notes|study|subject|paper|fee|evs)/.test(lastUserMessage)) {
    return [
      { label: 'Open Notes', kind: 'navigate', value: '/study' },
      { label: 'Notes tab', kind: 'send', value: 'Where is the notes option in the Study section?' },
      { label: 'Open Study', kind: 'navigate', value: '/study' },
    ];
  }

  if (/(post|request|upload|write|writer|sell)/.test(lastUserMessage)) {
    return [
      { label: 'Create Post', kind: 'navigate', value: '/post' },
      { label: 'How to post?', kind: 'send', value: 'How do I post a new request?' },
      { label: 'Open Home', kind: 'navigate', value: '/marketplace' },
    ];
  }

  if (/(chat|message|dm|talk)/.test(lastUserMessage)) {
    return [
      { label: 'Open Chats', kind: 'navigate', value: '/chats' },
      { label: 'Open Home', kind: 'navigate', value: '/marketplace' },
      { label: 'Ask again', kind: 'send', value: 'How do I start chatting with someone here?' },
    ];
  }

  if (/(profile|bio|sample|account)/.test(lastUserMessage)) {
    return [
      { label: 'Open Profile', kind: 'navigate', value: '/profile' },
      { label: 'Writing samples', kind: 'send', value: 'How do I add writing samples to my profile?' },
      { label: 'Open Home', kind: 'navigate', value: '/marketplace' },
    ];
  }

  return DEFAULT_QUICK_ACTIONS;
}

function ThinkingDots() {
  return (
    <div className="flex items-center gap-1.5 px-4 py-3">
      <div className="w-2 h-2 rounded-full bg-muted-foreground/60 animate-bounce" style={{ animationDelay: '0ms' }} />
      <div className="w-2 h-2 rounded-full bg-muted-foreground/60 animate-bounce" style={{ animationDelay: '150ms' }} />
      <div className="w-2 h-2 rounded-full bg-muted-foreground/60 animate-bounce" style={{ animationDelay: '300ms' }} />
    </div>
  );
}

export default function DamuChatbot() {
  const { user } = useAuth();
  const { items } = useUiLayout();
  const { settings } = useAppSettings();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([
    { role: 'assistant', content: 'Hey! 👋 Njan Damu. Enthaa help veno? Ask me anything about the app!' },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState<{ resetAt: number; limit: number } | null>(null);
  const [now, setNow] = useState(Date.now());
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const quickActions = !loading ? getQuickActions(messages) : [];

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, open, loading]);

  // Tick countdown
  useEffect(() => {
    if (!cooldown) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [cooldown]);

  // Auto-clear when expired
  useEffect(() => {
    if (cooldown && now >= cooldown.resetAt) setCooldown(null);
  }, [cooldown, now]);

  // Handle keyboard visibility via visualViewport
  useEffect(() => {
    if (!open) return;
    const vv = window.visualViewport;
    if (!vv) return;

    const onResize = () => {
      // When keyboard opens, visualViewport height shrinks
      const offset = window.innerHeight - vv.height;
      const container = document.getElementById('damu-chat-container');
      if (container) {
        container.style.height = `${vv.height}px`;
        container.style.top = `${vv.offsetTop}px`;
      }
      // Scroll to bottom when keyboard opens
      setTimeout(() => {
        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
      }, 50);
    };

    vv.addEventListener('resize', onResize);
    vv.addEventListener('scroll', onResize);
    onResize();

    return () => {
      vv.removeEventListener('resize', onResize);
      vv.removeEventListener('scroll', onResize);
    };
  }, [open]);

  const sendMessage = useCallback(async (presetText?: string) => {
    const text = (typeof presetText === 'string' ? presetText : input).trim();
    if (!text || loading) return;
    if (cooldown && Date.now() < cooldown.resetAt) return;
    setInput('');

    // Reset textarea height
    if (inputRef.current) inputRef.current.style.height = '44px';

    const userMsg: Msg = { role: 'user', content: text };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);

    let assistantSoFar = '';
    const allMessages = [...messages, userMsg];

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const resp = await fetch(CHAT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token ?? import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({ messages: allMessages }),
      });

      if (!resp.ok) {
        let errorMessage = 'Stream failed';
        let cooldownPayload: { resetAt: number; limit: number } | null = null;

        try {
          const errorPayload = await resp.json();
          errorMessage = errorPayload.error || errorMessage;
          if (errorPayload.code === 'RATE_LIMIT' && errorPayload.reset_at) {
            cooldownPayload = {
              resetAt: new Date(errorPayload.reset_at).getTime(),
              limit: errorPayload.limit ?? 0,
            };
          }
        } catch {
          errorMessage = resp.status === 429
            ? 'Too many messages right now. Try again soon.'
            : resp.status === 402
            ? 'AI credits are exhausted right now.'
            : errorMessage;
        }

        if (cooldownPayload) {
          setCooldown(cooldownPayload);
          // Replace last user message echo with the limit notice (do not show toast spam)
        } else {
          toast.error(errorMessage);
        }
        throw new Error(errorMessage);
      }

      if (!resp.body) throw new Error('Stream failed');

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = '';
      let streamDone = false;

      while (!streamDone) {
        const { done, value } = await reader.read();
        if (done) break;
        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf('\n')) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);
          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (line.startsWith(':') || line.trim() === '') continue;
          if (!line.startsWith('data: ')) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === '[DONE]') { streamDone = true; break; }
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) {
              assistantSoFar += content;
              const snapshot = assistantSoFar;
              setMessages(prev => {
                const last = prev[prev.length - 1];
                if (last?.role === 'assistant' && prev.length > 1 && prev[prev.length - 2]?.role === 'user') {
                  return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: snapshot } : m);
                }
                return [...prev, { role: 'assistant', content: snapshot }];
              });
            }
          } catch {
            textBuffer = line + '\n' + textBuffer;
            break;
          }
        }
      }
    } catch (e) {
      console.error('Damu chat error:', e);
      // Don't append a bot bubble for cooldown — the dedicated UI handles it
      if (!cooldown) {
        const fallbackMessage = e instanceof Error && e.message
          ? e.message
          : 'Ayyo, something went wrong 😅 Try again!';
        setMessages(prev => [...prev, { role: 'assistant', content: fallbackMessage }]);
      }
    } finally {
      setLoading(false);
    }
  }, [input, loading, messages, cooldown]);

  const handleQuickAction = useCallback(async (action: QuickAction) => {
    if (action.kind === 'navigate') {
      setOpen(false);
      navigate(action.value);
      return;
    }

    await sendMessage(action.value);
  }, [navigate, sendMessage]);

  const handleTextareaInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    const el = e.target;
    el.style.height = '44px';
    el.style.height = Math.min(el.scrollHeight, 120) + 'px';
  };

  const chatbotItem = items.find(i => i.key === 'chatbot');
  const chatbotEnabled = settings.feature_toggles?.chatbot !== false;
  if (!user || !chatbotEnabled || (chatbotItem && !chatbotItem.visible)) return null;

  const remainingMs = cooldown ? Math.max(0, cooldown.resetAt - now) : 0;
  const hh = Math.floor(remainingMs / 3_600_000);
  const mm = Math.floor((remainingMs % 3_600_000) / 60_000);
  const ss = Math.floor((remainingMs % 60_000) / 1000);
  const cooldownActive = !!cooldown && remainingMs > 0;

  return (
    <>
      {/* Floating Bubble */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed z-[60] right-5 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] w-14 h-14 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-lg shadow-primary/20 active:scale-90 transition-transform"
        >
          <Bot className="w-6 h-6" />
        </button>
      )}

      {/* Chat Panel - Full screen overlay above everything */}
      {open && (
        <div
          id="damu-chat-container"
          className="fixed inset-x-0 top-0 z-[100] flex flex-col bg-background"
          style={{ height: '100dvh' }}
        >
          {/* Header */}
          <div className="shrink-0 flex items-center gap-3 px-5 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3 border-b border-border/50 bg-background">
            <div className="w-9 h-9 rounded-full bg-primary flex items-center justify-center">
              <Bot className="w-5 h-5 text-primary-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-base font-bold text-foreground">Damu</h2>
              <p className="text-[10px] text-muted-foreground font-semibold">
                {loading ? '✨ Thinking...' : 'Your app assistant'}
              </p>
            </div>
            <button onClick={() => setOpen(false)} className="p-2 rounded-xl bg-secondary active:scale-95 transition-transform">
              <X className="w-5 h-5 text-foreground" />
            </button>
          </div>

          {/* Messages - ChatGPT style */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto overscroll-contain">
            <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
              {messages.map((m, i) => (
                <div key={i} className={`flex gap-3 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  {m.role === 'assistant' && (
                    <div className="shrink-0 w-7 h-7 rounded-full bg-primary flex items-center justify-center mt-0.5">
                      <Bot className="w-4 h-4 text-primary-foreground" />
                    </div>
                  )}
                  <div
                    className={`max-w-[85%] text-sm leading-relaxed ${
                      m.role === 'user'
                        ? 'bg-secondary text-foreground px-4 py-2.5 rounded-2xl rounded-br-md'
                        : 'text-foreground/90'
                    }`}
                  >
                    {m.role === 'assistant' ? (
                      <div className="prose prose-sm prose-invert max-w-none [&_p]:my-1 [&_ul]:my-1 [&_ol]:my-1">
                        <ReactMarkdown>{m.content}</ReactMarkdown>
                      </div>
                    ) : (
                      m.content
                    )}

                    {i === messages.length - 1 && m.role === 'assistant' && quickActions.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {quickActions.map(action => (
                          <button
                            key={`${action.kind}-${action.label}`}
                            onClick={() => handleQuickAction(action)}
                            className="rounded-full border border-border bg-secondary px-3 py-1.5 text-xs font-semibold text-secondary-foreground active:scale-95 transition-transform"
                          >
                            {action.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {/* Thinking animation */}
              {loading && messages[messages.length - 1]?.role === 'user' && (
                <div className="flex gap-3 justify-start">
                  <div className="shrink-0 w-7 h-7 rounded-full bg-primary flex items-center justify-center mt-0.5">
                    <Bot className="w-4 h-4 text-primary-foreground" />
                  </div>
                  <ThinkingDots />
                </div>
              )}

              {cooldownActive && (
                <div className="flex gap-3 justify-start">
                  <div className="shrink-0 w-7 h-7 rounded-full bg-primary flex items-center justify-center mt-0.5">
                    <Bot className="w-4 h-4 text-primary-foreground" />
                  </div>
                  <div className="max-w-[85%] rounded-2xl border border-border bg-card p-4 space-y-2">
                    <p className="text-sm font-bold text-foreground">You've reached today's chat limit</p>
                    <p className="text-xs text-muted-foreground">
                      Daily limit: {cooldown!.limit} messages. Come back when the timer resets.
                    </p>
                    <div className="font-mono text-2xl text-foreground tabular-nums tracking-tight">
                      {String(hh).padStart(2, '0')}:{String(mm).padStart(2, '0')}:{String(ss).padStart(2, '0')}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Input area - ChatGPT style */}
          <div className="shrink-0 border-t border-border/50 bg-background px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            <div className="max-w-2xl mx-auto">
              <div className="flex items-end gap-2 bg-secondary rounded-2xl px-4 py-2">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={handleTextareaInput}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      sendMessage();
                    }
                  }}
                  placeholder={cooldownActive ? 'Limit reached — see timer above' : 'Message Damu...'}
                  rows={1}
                  disabled={cooldownActive}
                  className="flex-1 bg-transparent text-foreground text-sm placeholder:text-muted-foreground border-none outline-none resize-none py-1.5"
                  style={{ height: '44px', maxHeight: '120px' }}
                />
                <button
                  onClick={() => sendMessage()}
                  disabled={loading || !input.trim() || cooldownActive}
                  className="shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center disabled:opacity-30 active:scale-90 transition-all mb-0.5"
                >
                  <ArrowUp className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
