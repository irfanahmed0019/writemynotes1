import { useAuth } from '@/lib/auth';
import { Navigate, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useEffect, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { MessageCircle, ArrowLeft } from 'lucide-react';
import BottomNav from '@/components/BottomNav';

type Conversation = {
  id: string;
  request_id: string;
  buyer_id: string;
  seller_id: string;
  created_at: string;
  other_name: string;
  request_title: string;
  last_message?: string;
  last_message_at?: string;
  unread_count: number;
};

export default function ChatList() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [conversations, setConversations] = useState<Conversation[]>([]);

  useEffect(() => {
    if (!user) return;

    const fetchConversations = async () => {
      const { data: convos } = await supabase
        .from('conversations')
        .select('*')
        .or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`)
        .order('created_at', { ascending: false });

      if (!convos) return;

      const enriched: Conversation[] = await Promise.all(
        convos.map(async (c) => {
          const otherId = c.buyer_id === user.id ? c.seller_id : c.buyer_id;
          
          const [profileRes, requestRes, msgRes, unreadRes] = await Promise.all([
            supabase.from('profiles').select('full_name').eq('user_id', otherId).single(),
            supabase.from('requests').select('title').eq('id', c.request_id).single(),
            supabase.from('messages').select('content, created_at').eq('conversation_id', c.id).order('created_at', { ascending: false }).limit(1).maybeSingle(),
            supabase.from('messages').select('id', { count: 'exact', head: true }).eq('conversation_id', c.id).neq('sender_id', user.id).is('read_at', null),
          ]);

          return {
            ...c,
            other_name: profileRes.data?.full_name || 'Unknown',
            request_title: requestRes.data?.title || 'Request',
            last_message: msgRes.data?.content,
            last_message_at: msgRes.data?.created_at,
            unread_count: unreadRes.count || 0,
          };
        })
      );

      const deduped = Object.values(
        enriched.reduce((acc, c) => {
          const otherId = c.buyer_id === user.id ? c.seller_id : c.buyer_id;
          const existing = acc[otherId];
          if (!existing || (c.last_message_at && (!existing.last_message_at || c.last_message_at > existing.last_message_at))) {
            acc[otherId] = { ...c, unread_count: (existing?.unread_count || 0) + c.unread_count };
          } else if (existing) {
            existing.unread_count += c.unread_count;
          }
          return acc;
        }, {} as Record<string, Conversation>)
      );

      setConversations(deduped);
    };

    fetchConversations();

    const channel = supabase
      .channel('conversations-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conversations' }, () => fetchConversations())
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, () => fetchConversations())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;

  return (
    <div className="min-h-[100dvh] bg-background pb-[calc(4rem+env(safe-area-inset-bottom))]">
      <div className="px-5 pt-[max(1.5rem,env(safe-area-inset-top))] pb-2 flex items-center gap-3">
        <button onClick={() => navigate('/marketplace')} className="p-1.5 rounded-xl bg-secondary active:scale-95">
          <ArrowLeft className="w-5 h-5 text-foreground" />
        </button>
        <h1 className="text-[28px] font-bold text-foreground tracking-tight">Messages</h1>
      </div>

      <div className="px-5 py-2 space-y-2">
        {conversations.length === 0 ? (
          <div className="text-center py-16">
            <MessageCircle className="w-10 h-10 text-muted-foreground/50 mx-auto mb-3" />
            <p className="text-muted-foreground text-sm">No conversations yet</p>
          </div>
        ) : (
          conversations.map(c => {
            const isRead = c.unread_count === 0;
            return (
              <button
                key={c.id}
                onClick={() => navigate(`/chat/${c.id}`)}
                className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl bg-card transition-all text-left active:scale-[0.98] ${isRead ? 'opacity-50' : ''}`}
              >
                <div className="relative shrink-0">
                  <div className={`w-11 h-11 rounded-full flex items-center justify-center text-sm font-bold ${
                    isRead ? 'bg-secondary text-muted-foreground' : 'bg-secondary text-foreground'
                  }`}>
                    {c.other_name[0]?.toUpperCase() || '?'}
                  </div>
                  {c.unread_count > 0 && (
                    <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center">
                      {c.unread_count > 9 ? '9+' : c.unread_count}
                    </span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className={`text-sm truncate ${isRead ? 'font-normal text-muted-foreground' : 'font-bold text-foreground'}`}>{c.other_name}</p>
                    {c.last_message_at && (
                      <span className="text-[10px] text-muted-foreground shrink-0">
                        {formatDistanceToNow(new Date(c.last_message_at), { addSuffix: true })}
                      </span>
                    )}
                  </div>
                  <p className={`text-xs truncate ${isRead ? 'text-muted-foreground/60' : 'text-secondary-foreground'}`}>
                    {c.last_message || c.request_title}
                  </p>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
