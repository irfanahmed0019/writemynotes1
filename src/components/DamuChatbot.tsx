import { useState, useRef, useEffect, useCallback } from 'react';
import { X, Send, Bot, ArrowUp } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { useUiLayout } from '@/hooks/use-ui-layout';

type Msg = { role: 'user' | 'assistant'; content: string };

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/damu-chat`;

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
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([
    { role: 'assistant', content: 'Hey! 👋 Njan Damu. Enthaa help veno? Ask me anything about the app!' },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, open, loading]);

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

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput('');

    // Reset textarea height
    if (inputRef.current) inputRef.current.style.height = '44px';

    const userMsg: Msg = { role: 'user', content: text };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);

    let assistantSoFar = '';
    const allMessages = [...messages, userMsg];

    try {
      const resp = await fetch(CHAT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ messages: allMessages }),
      });

      if (!resp.ok || !resp.body) throw new Error('Stream failed');

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
      setMessages(prev => [...prev, { role: 'assistant', content: 'Ayyo, something went wrong 😅 Try again!' }]);
    } finally {
      setLoading(false);
    }
  }, [input, loading, messages]);

  const handleTextareaInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    const el = e.target;
    el.style.height = '44px';
    el.style.height = Math.min(el.scrollHeight, 120) + 'px';
  };

  const chatbotItem = items.find(i => i.key === 'chatbot');
  if (!user || (chatbotItem && !chatbotItem.visible)) return null;

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
                    {m.content}
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
                  placeholder="Message Damu..."
                  rows={1}
                  className="flex-1 bg-transparent text-foreground text-sm placeholder:text-muted-foreground border-none outline-none resize-none py-1.5"
                  style={{ height: '44px', maxHeight: '120px' }}
                />
                <button
                  onClick={sendMessage}
                  disabled={loading || !input.trim()}
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
