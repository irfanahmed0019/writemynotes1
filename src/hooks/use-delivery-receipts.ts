import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';

// Marks every incoming message as `delivered_at = now()` while the user is in the app.
// This powers the WhatsApp-style double-tick (delivered) vs single-tick (sent) state.
export function useDeliveryReceipts() {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;

    const markAllUndelivered = async () => {
      // Find conversations the user is in, then mark undelivered incoming msgs as delivered.
      const { data: convos } = await supabase
        .from('conversations')
        .select('id')
        .or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`);
      if (!convos?.length) return;
      const ids = convos.map((c: any) => c.id);
      await supabase
        .from('messages')
        .update({ delivered_at: new Date().toISOString() })
        .in('conversation_id', ids)
        .neq('sender_id', user.id)
        .is('delivered_at', null);
    };

    markAllUndelivered();

    const channel = supabase
      .channel('delivery-receipts')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, async (payload) => {
        const m: any = payload.new;
        if (m.sender_id === user.id) return;
        if (m.delivered_at) return;
        await supabase
          .from('messages')
          .update({ delivered_at: new Date().toISOString() })
          .eq('id', m.id)
          .is('delivered_at', null);
      })
      .subscribe();

    const onVisible = () => { if (document.visibilityState === 'visible') markAllUndelivered(); };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      supabase.removeChannel(channel);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [user]);
}
