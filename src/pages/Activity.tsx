import { useAuth } from '@/lib/auth';
import { Navigate, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useEffect, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { Sparkles, Loader2 } from 'lucide-react';
import BottomNav from '@/components/BottomNav';

type ActivityItem = {
  id: string;
  writer_id: string;
  writer_name: string;
  writer_avatar: string | null;
  request_title: string;
  request_id: string;
  status: string;
  created_at: string;
};

export default function Activity() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    if (!user) return;

    const fetchActivity = async () => {
      const { data: myRequests } = await supabase
        .from('requests')
        .select('id, title')
        .eq('user_id', user.id);

      if (!myRequests || myRequests.length === 0) {
        setItems([]);
        setFetching(false);
        return;
      }

      const requestIds = myRequests.map(r => r.id);
      const requestMap = Object.fromEntries(myRequests.map(r => [r.id, r.title]));

      const { data: interests } = await supabase
        .from('post_interests')
        .select('*')
        .in('request_id', requestIds)
        .order('created_at', { ascending: false });

      if (!interests || interests.length === 0) {
        setItems([]);
        setFetching(false);
        return;
      }

      const writerIds = [...new Set(interests.map(i => i.writer_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name, avatar_url')
        .in('user_id', writerIds);

      const profileMap = Object.fromEntries(
        (profiles || []).map(p => [p.user_id, p])
      );

      const activityItems: ActivityItem[] = interests.map(i => ({
        id: i.id,
        writer_id: i.writer_id,
        writer_name: profileMap[i.writer_id]?.full_name || 'Someone',
        writer_avatar: profileMap[i.writer_id]?.avatar_url || null,
        request_title: requestMap[i.request_id] || 'a post',
        request_id: i.request_id,
        status: i.status,
        created_at: i.created_at,
      }));

      setItems(activityItems);
      setFetching(false);
    };

    fetchActivity();

    const channel = supabase
      .channel('activity-feed')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'post_interests' }, () => fetchActivity())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;

  return (
    <div className="min-h-screen bg-background pb-24 animate-fade-in">
      <div className="sticky top-0 z-10 glass-strong px-4 py-3">
        <h1 className="text-lg font-bold text-foreground">Activity</h1>
      </div>

      {fetching ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-foreground/30" />
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
          <Sparkles className="w-10 h-10 text-foreground/15 mb-3" />
          <p className="text-sm text-foreground/40">No activity yet</p>
          <p className="text-xs text-foreground/25 mt-1">When writers show interest in your posts, it'll appear here</p>
        </div>
      ) : (
        <div className="px-4 py-2 space-y-2">
          {items.map(item => (
            <button
              key={item.id}
              onClick={() => navigate(`/writer/${item.writer_id}`)}
              className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl glass text-left active:scale-[0.98] transition-all"
            >
              {item.writer_avatar ? (
                <img src={item.writer_avatar} alt="" className="w-11 h-11 rounded-full object-cover ring-1 ring-foreground/10 shrink-0" />
              ) : (
                <div className="w-11 h-11 rounded-full glass flex items-center justify-center text-sm font-bold text-foreground shrink-0">
                  {item.writer_name[0]?.toUpperCase() || '?'}
                </div>
              )}

              <div className="flex-1 min-w-0">
                <p className="text-sm text-foreground leading-snug">
                  <span className="font-bold">{item.writer_name}</span>
                  {' '}is willing to write on{' '}
                  <span className="font-semibold text-foreground/80">"{item.request_title}"</span>
                </p>
                <p className="text-xs text-foreground/30 mt-0.5">
                  {formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}
                </p>
              </div>

              <span className={`shrink-0 text-[10px] font-bold px-2.5 py-1 rounded-full ${
                item.status === 'pending'
                  ? 'bg-foreground/10 text-foreground/60'
                  : item.status === 'approved'
                  ? 'bg-foreground/15 text-foreground/80'
                  : 'bg-destructive/15 text-destructive'
              }`}>
                {item.status === 'pending' ? 'New' : item.status === 'approved' ? 'Approved' : 'Declined'}
              </span>
            </button>
          ))}
        </div>
      )}

      <BottomNav />
    </div>
  );
}
