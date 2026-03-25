import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { toast } from 'sonner';

export default function MessagePopup() {
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('global-message-popup')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
      }, async (payload) => {
        const msg = payload.new as any;
        if (msg.sender_id === user.id) return;

        // Check user is part of this conversation
        const { data: convo } = await supabase
          .from('conversations')
          .select('id, buyer_id, seller_id')
          .eq('id', msg.conversation_id)
          .or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`)
          .maybeSingle();

        if (!convo) return;

        // Don't show popup if user is already on that chat
        if (window.location.pathname === `/chat/${convo.id}`) return;

        const otherId = convo.buyer_id === user.id ? convo.seller_id : convo.buyer_id;
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('user_id', otherId)
          .single();

        const senderName = profile?.full_name || 'Someone';
        const preview = msg.content.length > 50 ? msg.content.slice(0, 50) + '…' : msg.content;

        toast(
          `${senderName}: ${preview}`,
          {
            duration: 4000,
            action: {
              label: 'View',
              onClick: () => navigate(`/chat/${convo.id}`),
            },
          }
        );

        // Browser/PWA notification
        if ('Notification' in window && Notification.permission === 'granted') {
          const notif = new Notification(`${senderName}`, { body: preview, icon: '/pwa-192.png', tag: convo.id });
          notif.onclick = () => { window.focus(); navigate(`/chat/${convo.id}`); };
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, navigate]);

  return null;
}
