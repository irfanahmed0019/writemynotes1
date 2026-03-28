import { useAuth } from '@/lib/auth';
import { Navigate, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useEffect, useState } from 'react';
import { Search, Plus, Trash2, Clock, IndianRupee, FileText } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import BottomNav from '@/components/BottomNav';

type Request = {
  id: string;
  user_id: string;
  title: string;
  subject: string;
  budget: number;
  pages: number;
  deadline: string;
  description: string | null;
  status: string;
  created_at: string;
  profiles?: { full_name: string | null; avatar_url: string | null } | null;
};

const SUBJECTS = ['All', 'Physics', 'Chemistry', 'Maths', 'Biology', 'English', 'CS', 'Other'];

export default function Marketplace() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [requests, setRequests] = useState<Request[]>([]);
  const [search, setSearch] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('All');

  useEffect(() => {
    if (!user) return;

    const fetchRequests = async () => {
      const { data } = await supabase
        .from('requests')
        .select('*, profiles!requests_user_id_profiles_fkey(full_name, avatar_url)')
        .eq('status', 'open')
        .order('created_at', { ascending: false });
      if (data) setRequests(data as any);
    };

    fetchRequests();

    const channel = supabase
      .channel('requests-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'requests' }, () => fetchRequests())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;

  const filtered = requests.filter(r => {
    const matchesSearch = r.title.toLowerCase().includes(search.toLowerCase()) ||
      r.subject.toLowerCase().includes(search.toLowerCase());
    const matchesSubject = selectedSubject === 'All' || r.subject === selectedSubject;
    return matchesSearch && matchesSubject;
  });

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    await supabase.from('requests').delete().eq('id', id);
    setRequests(prev => prev.filter(r => r.id !== id));
  };

  return (
    <div className="min-h-screen bg-background pb-24 animate-fade-in">
      {/* Header */}
      <div className="sticky top-0 z-10 glass-strong border-b border-border px-4 pt-4 pb-3">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-xl font-bold text-foreground">Marketplace</h1>
          <button
            onClick={() => navigate('/post')}
            className="flex items-center gap-1.5 h-9 px-4 rounded-lg bg-primary text-primary-foreground font-medium text-sm active:scale-[0.97] transition-transform"
          >
            <Plus className="w-4 h-4" />
            Post
          </button>
        </div>

        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search requests..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-10 pl-10 pr-4 rounded-lg bg-card border border-border text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
          {SUBJECTS.map(s => (
            <button
              key={s}
              onClick={() => setSelectedSubject(s)}
              className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                selectedSubject === s
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-secondary text-muted-foreground hover:text-foreground'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Requests List */}
      <div className="px-4 py-3 space-y-3">
        {filtered.length === 0 ? (
          <div className="text-center py-16 space-y-3">
            <p className="text-4xl">📭</p>
            <p className="text-muted-foreground text-sm">No requests yet. Be the first!</p>
            <button
              onClick={() => navigate('/post')}
              className="inline-flex items-center gap-1.5 h-10 px-5 rounded-lg bg-primary text-primary-foreground font-medium text-sm active:scale-[0.97] transition-transform"
            >
              <Plus className="w-4 h-4" />
              Post Request
            </button>
          </div>
        ) : (
          filtered.map(r => (
            <button
              key={r.id}
              onClick={() => navigate(`/post/${r.id}`)}
              className="w-full text-left p-4 rounded-xl glass space-y-3 active:scale-[0.99] transition-transform"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-1 min-w-0">
                  <h3 className="font-semibold text-foreground truncate">{r.title}</h3>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="px-2 py-0.5 rounded-md bg-secondary font-medium">{r.subject}</span>
                    <span className="flex items-center gap-0.5">
                      <Clock className="w-3 h-3" />
                      {formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1 text-primary font-bold text-lg shrink-0">
                  <IndianRupee className="w-4 h-4" />
                  {r.budget}
                </div>
              </div>

              {/* Pages + Deadline summary */}
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <FileText className="w-3 h-3" />
                  {r.pages || '—'} pages
                </span>
              </div>

              {r.description && (
                <p className="text-sm text-muted-foreground line-clamp-2">{r.description}</p>
              )}

              <div className="flex items-center justify-between pt-1">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-secondary flex items-center justify-center text-xs font-medium text-foreground">
                    {r.profiles?.full_name?.[0]?.toUpperCase() || '?'}
                  </div>
                  <span className="text-xs text-muted-foreground">{r.profiles?.full_name || 'Anonymous'}</span>
                </div>

                {r.user_id === user.id && (
                  <button
                    onClick={(e) => handleDelete(e, r.id)}
                    className="flex items-center gap-1 h-8 px-3 rounded-lg bg-destructive/10 text-destructive text-xs font-medium active:scale-[0.97] transition-transform"
                  >
                    <Trash2 className="w-3 h-3" />
                    Delete
                  </button>
                )}
              </div>
            </button>
          ))
        )}
      </div>

      <BottomNav />
    </div>
  );
}
