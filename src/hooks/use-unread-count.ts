import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';

export function useUnreadCount() {
  const { user } = useAuth();
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!user) { setCount(0); return; }

    const fetchCount = async () => {
      const { data: convos } = await supabase
        .from('conversations')
        .select('id')
        .or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`);
      if (!convos || convos.length === 0) { setCount(0); return; }
      const ids = convos.map((c: any) => c.id);
      const { count: unread } = await supabase
        .from('messages')
        .select('id', { count: 'exact', head: true })
        .in('conversation_id', ids)
        .neq('sender_id', user.id)
        .is('read_at', null);
      setCount(unread ?? 0);
    };

    fetchCount();

    const channel = supabase
      .channel('unread-count-watch')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, () => fetchCount())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  return count;
}