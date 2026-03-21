import { useAuth } from '@/lib/auth';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useEffect, useState, useRef } from 'react';
import { ArrowLeft, Send } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

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
  const scrollRef = useRef<HTMLDivElement>(null);

  // Mark messages as read
  const markAsRead = async () => {
    if (!user || !id) return;
    await supabase
      .from('messages')
      .update({ read_at: new Date().toISOString() })
      .eq('conversation_id', id)
      .neq('sender_id', user.id)
      .is('read_at', null);
  };

  useEffect(() => {
    if (!user || !id) return;

    const fetchMessages = async () => {
      const { data } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', id)
        .order('created_at', { ascending: true });
      if (data) setMessages(data);
      // Mark unread messages as read when opening chat
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

    const channel = supabase
      .channel(`chat-${id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `conversation_id=eq.${id}`,
      }, (payload) => {
        const msg = payload.new as Message;
        setMessages(prev => [...prev, msg]);
        // If message is from the other user, mark it as read immediately
        if (msg.sender_id !== user.id) {
          markAsRead();
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, id]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;

  const handleSend = async () => {
    if (!newMessage.trim() || sending) return;
    setSending(true);
    const content = newMessage.trim();
    setNewMessage('');

    await supabase.from('messages').insert({
      conversation_id: id!,
      sender_id: user.id,
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
        <span className="font-semibold text-foreground">{otherName}</span>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.map(m => {
          const isMine = m.sender_id === user.id;
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
        <div ref={scrollRef} />
      </div>

      {/* Input — raised and larger */}
      <div className="shrink-0 border-t border-border bg-background px-4 pt-3 pb-6">
        <div className="flex items-center gap-2.5">
          <input
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            className="flex-1 h-12 px-4 rounded-xl bg-card border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring text-sm"
          />
          <button
            onClick={handleSend}
            disabled={!newMessage.trim() || sending}
            className="w-12 h-12 rounded-xl bg-primary text-primary-foreground flex items-center justify-center active:scale-[0.95] transition-transform disabled:opacity-50"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
