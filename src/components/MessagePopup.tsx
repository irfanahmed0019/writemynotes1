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

    // Request notification permission for PWA
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }

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

    // Activity notifications (interest on your posts)
    const activityChannel = supabase
      .channel('global-activity-popup')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'post_interests',
      }, async (payload) => {
        const interest = payload.new as any;
        // Check if this is on the current user's request
        const { data: req } = await supabase
          .from('requests')
          .select('title')
          .eq('id', interest.request_id)
          .eq('user_id', user.id)
          .maybeSingle();

        if (!req) return;

        const { data: writerProfile } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('user_id', interest.writer_id)
          .single();

        const writerName = writerProfile?.full_name || 'A writer';

        toast(`${writerName} is willing to write "${req.title}"`, {
          duration: 5000,
          action: {
            label: 'View',
            onClick: () => navigate(`/writer/${interest.writer_id}`),
          },
        });

        if ('Notification' in window && Notification.permission === 'granted') {
          const notif = new Notification('New Interest', { body: `${writerName} wants to write "${req.title}"`, icon: '/pwa-192.png' });
          notif.onclick = () => { window.focus(); navigate(`/writer/${interest.writer_id}`); };
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(activityChannel);
    };
  }, [user, navigate]);

  return null;
}
