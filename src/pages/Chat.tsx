import { useAuth } from '@/lib/auth';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useEffect, useState, useRef, useCallback } from 'react';
import { ArrowLeft, Send } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import TypingIndicator from '@/components/TypingIndicator';

type Message = {
  id: string;
  sender_id: string;
  content: string;
  created_at: string;
  read_at: string | null;
};

export default function Chat() {
  const { user, loading } = useAuth();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [otherName, setOtherName] = useState('');
  const [sending, setSending] = useState(false);
  const [otherTyping, setOtherTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

  const markAsRead = useCallback(async () => {
    if (!user || !id) return;
    await supabase
      .from('messages')
      .update({ read_at: new Date().toISOString() })
      .eq('conversation_id', id)
      .neq('sender_id', user.id)
      .is('read_at', null);
  }, [user, id]);

  useEffect(() => {
    if (!user || !id) return;

    const fetchMessages = async () => {
      const { data } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', id)
        .order('created_at', { ascending: true });
      if (data) setMessages(data);
      markAsRead();
    };

    const fetchConvo = async () => {
      const { data: convo } = await supabase
        .from('conversations')
        .select('buyer_id, seller_id')
        .eq('id', id)
        .single();
      if (convo) {
        const otherId = convo.buyer_id === user.id ? convo.seller_id : convo.buyer_id;
        const { data: profile } = await supabase.from('profiles').select('full_name').eq('user_id', otherId).single();
        setOtherName(profile?.full_name || 'Unknown');
      }
    };

    fetchMessages();
    fetchConvo();

    // Realtime messages
    const msgChannel = supabase
      .channel(`chat-${id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'messages',
        filter: `conversation_id=eq.${id}`,
      }, (payload) => {
        if (payload.eventType === 'INSERT') {
          const msg = payload.new as Message;
          setMessages(prev => [...prev, msg]);
          if (msg.sender_id !== user.id) markAsRead();
        } else if (payload.eventType === 'UPDATE') {
          setMessages(prev => prev.map(m => m.id === (payload.new as Message).id ? payload.new as Message : m));
        }
      })
      .subscribe();

    // Typing presence
    const presenceChannel = supabase.channel(`typing-${id}`, {
      config: { presence: { key: user.id } },
    });

    presenceChannel
      .on('presence', { event: 'sync' }, () => {
        const state = presenceChannel.presenceState();
        const others = Object.keys(state).filter(k => k !== user.id);
        setOtherTyping(others.some(k => {
          const presences = state[k] as any[];
          return presences?.some(p => p.typing);
        }));
      })
      .subscribe();

    return () => {
      supabase.removeChannel(msgChannel);
      supabase.removeChannel(presenceChannel);
    };
  }, [user, id, markAsRead]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, otherTyping]);

  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;

  const broadcastTyping = () => {
    const channel = supabase.channel(`typing-${id}`, {
      config: { presence: { key: user!.id } },
    });
    channel.track({ typing: true });
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      channel.track({ typing: false });
    }, 2000);
  };

  const handleSend = async () => {
    if (!newMessage.trim() || sending) return;
    setSending(true);
    const content = newMessage.trim();
    setNewMessage('');

    // Stop typing indicator
    const channel = supabase.channel(`typing-${id}`, {
      config: { presence: { key: user!.id } },
    });
    channel.track({ typing: false });

    await supabase.from('messages').insert({
      conversation_id: id!,
      sender_id: user!.id,
      content,
    });

    setSending(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Header */}
      <div className="shrink-0 bg-background/80 backdrop-blur-xl border-b border-border px-4 py-3 flex items-center gap-3">
        <button onClick={() => navigate('/chats')} className="p-1 active:scale-[0.95] transition-transform">
          <ArrowLeft className="w-5 h-5 text-foreground" />
        </button>
        <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-sm font-semibold text-foreground">
          {otherName[0]?.toUpperCase() || '?'}
        </div>
        <div>
          <span className="font-semibold text-foreground">{otherName}</span>
          {otherTyping && <p className="text-[10px] text-primary font-medium">typing...</p>}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.map(m => {
          const isMine = m.sender_id === user!.id;
          const isRead = !!m.read_at;
          return (
            <div key={m.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[80%] px-4 py-2.5 rounded-2xl text-sm ${
                  isMine
                    ? 'bg-primary text-primary-foreground rounded-br-md'
                    : 'bg-card border border-border text-foreground rounded-bl-md'
                }`}
              >
                <p className="break-words" style={{ overflowWrap: 'break-word' }}>{m.content}</p>
                <div className={`flex items-center gap-1.5 mt-1 ${isMine ? 'justify-end' : ''}`}>
                  <p className={`text-[10px] ${isMine ? 'text-primary-foreground/60' : 'text-muted-foreground'}`}>
                    {formatDistanceToNow(new Date(m.created_at), { addSuffix: true })}
                  </p>
                  {isMine && (
                    <span className={`text-[10px] font-medium ${isRead ? 'text-accent' : 'text-primary-foreground/40'}`}>
                      {isRead ? 'Seen' : 'Sent'}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        {otherTyping && <TypingIndicator name={otherName} />}
        <div ref={scrollRef} />
      </div>

      {/* Input — raised and larger */}
      <div className="shrink-0 border-t border-border bg-background px-4 pt-4 pb-12">
        <div className="flex items-center gap-2.5">
          <input
            value={newMessage}
            onChange={(e) => {
              setNewMessage(e.target.value);
              broadcastTyping();
            }}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            className="flex-1 h-14 px-4 rounded-xl bg-card border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring text-sm"
          />
          <button
            onClick={handleSend}
            disabled={!newMessage.trim() || sending}
            className="w-14 h-14 rounded-xl bg-primary text-primary-foreground flex items-center justify-center active:scale-[0.95] transition-transform disabled:opacity-50"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
