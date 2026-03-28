import { useLocation, useNavigate } from 'react-router-dom';
import { Store, MessageCircle, User, Sparkles, Download, Shield, BookOpen } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { useEffect, useState } from 'react';

const baseTabs = [
  { path: '/marketplace', icon: Store, label: 'Market' },
  { path: '/study', icon: BookOpen, label: 'Study' },
  { path: '/activity', icon: Sparkles, label: 'Activity' },
  { path: '/chats', icon: MessageCircle, label: 'Chats' },
  { path: '/install', icon: Download, label: 'Install' },
  { path: '/profile', icon: User, label: 'Profile' },
];

export default function BottomNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [unreadTotal, setUnreadTotal] = useState(0);
  const [activityCount, setActivityCount] = useState(0);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase.from('user_roles' as any).select('role').eq('user_id', user.id).eq('role', 'admin')
      .then(({ data }) => { setIsAdmin(Array.isArray(data) && data.length > 0); });
  }, [user]);

  const tabs = isAdmin
    ? [...baseTabs.slice(0, 5), { path: '/admin', icon: Shield, label: 'Admin' }, baseTabs[5]]
    : baseTabs;

  useEffect(() => {
    if (!user) return;

    const fetchUnread = async () => {
      const { data: convos } = await supabase
        .from('conversations')
        .select('id')
        .or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`);

      if (!convos || convos.length === 0) { setUnreadTotal(0); return; }

      const ids = convos.map(c => c.id);
      const { count } = await supabase
        .from('messages')
        .select('id', { count: 'exact', head: true })
        .in('conversation_id', ids)
        .neq('sender_id', user.id)
        .is('read_at', null);

      setUnreadTotal(count || 0);
    };

    const fetchActivityCount = async () => {
      // Count pending interests on user's posts
      const { data: myRequests } = await supabase
        .from('requests')
        .select('id')
        .eq('user_id', user.id);

      if (!myRequests || myRequests.length === 0) { setActivityCount(0); return; }

      const { count } = await supabase
        .from('post_interests')
        .select('id', { count: 'exact', head: true })
        .in('request_id', myRequests.map(r => r.id))
        .eq('status', 'pending');

      setActivityCount(count || 0);
    };

    fetchUnread();
    fetchActivityCount();

    const channel = supabase
      .channel('unread-badge')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, () => fetchUnread())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'post_interests' }, () => fetchActivityCount())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 glass-strong rounded-t-2xl pb-1">
      <div className="flex items-center justify-around h-14 max-w-lg mx-auto -mt-1">
        {tabs.map(tab => {
          const active = location.pathname.startsWith(tab.path);
          const showBadge = (tab.path === '/chats' && unreadTotal > 0) || (tab.path === '/activity' && activityCount > 0);
          const badgeCount = tab.path === '/chats' ? unreadTotal : activityCount;
          return (
            <button
              key={tab.path}
              onClick={() => navigate(tab.path)}
              className={`relative flex flex-col items-center gap-0.5 py-1 px-4 transition-all active:scale-[0.9] ${
                active ? 'text-foreground' : 'text-muted-foreground'
              }`}
            >
              <div className="relative">
                <tab.icon className={`w-5 h-5 ${active ? 'drop-shadow-[0_0_8px_rgba(255,255,255,0.5)]' : ''}`} />
                {showBadge && (
                  <span className="absolute -top-1.5 -right-2.5 min-w-[16px] h-4 px-1 rounded-full bg-foreground text-background text-[9px] font-bold flex items-center justify-center">
                    {badgeCount > 99 ? '99+' : badgeCount}
                  </span>
                )}
              </div>
              <span className={`text-[10px] font-medium ${active ? 'text-foreground' : ''}`}>{tab.label}</span>
              {active && <div className="absolute -bottom-0.5 w-1 h-1 rounded-full bg-foreground" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}
