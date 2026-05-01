import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';

export function usePresenceHeartbeat() {
  const { user } = useAuth();
  useEffect(() => {
    if (!user) return;
    const ping = async () => {
      await supabase.from('user_presence' as any).upsert(
        { user_id: user.id, last_seen: new Date().toISOString() } as any,
        { onConflict: 'user_id' }
      );
    };
    ping();
    const interval = setInterval(ping, 60_000);
    const onVisibility = () => { if (document.visibilityState === 'visible') ping(); };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [user]);
}