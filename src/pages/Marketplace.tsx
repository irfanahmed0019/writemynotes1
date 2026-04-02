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
    <div className="min-h-screen bg-black pb-20">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-black px-5 pt-6 pb-4">
        <div className="flex items-center justify-between mb-5">
          <h1 className="text-[28px] font-bold text-white tracking-tight">Marketplace</h1>
          <button
            onClick={() => navigate('/post')}
            className="w-10 h-10 rounded-full bg-white flex items-center justify-center active:scale-95 transition-transform"
          >
            <Plus className="w-5 h-5 text-black" />
          </button>
        </div>

        <div className="relative mb-4">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#666]" />
          <input
            type="text"
            placeholder="Search requests..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-11 pl-11 pr-4 rounded-2xl bg-[#111] text-white text-sm placeholder:text-[#555] border-none outline-none focus:ring-1 focus:ring-[#333]"
          />
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
          {SUBJECTS.map(s => (
            <button
              key={s}
              onClick={() => setSelectedSubject(s)}
              className={`shrink-0 px-4 py-2 rounded-full text-xs font-semibold transition-all ${
                selectedSubject === s
                  ? 'bg-white text-black'
                  : 'bg-[#1a1a1a] text-[#888]'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Requests List */}
      <div className="px-5 py-2 space-y-3">
        {filtered.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-[#555] text-sm">No requests yet. Be the first to post!</p>
          </div>
        ) : (
          filtered.map(r => (
            <button
              key={r.id}
              onClick={() => navigate(`/post/${r.id}`)}
              className="w-full text-left p-4 rounded-2xl bg-[#111] space-y-3 active:scale-[0.98] transition-transform"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-1.5 min-w-0">
                  <h3 className="font-bold text-white text-[15px] truncate">{r.title}</h3>
                  <div className="flex items-center gap-2 text-xs text-[#666]">
                    <span className="px-2 py-0.5 rounded-lg bg-[#1a1a1a] font-semibold text-[#888]">{r.subject}</span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-0.5 text-white font-bold text-lg shrink-0">
                  <IndianRupee className="w-4 h-4" />
                  {r.budget}
                </div>
              </div>

              {r.pages && (
                <div className="flex items-center gap-1 text-xs text-[#555]">
                  <FileText className="w-3 h-3" />
                  {r.pages} pages
                </div>
              )}

              <div className="flex items-center justify-between pt-1">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-[#1a1a1a] flex items-center justify-center text-[10px] font-bold text-[#888]">
                    {r.profiles?.full_name?.[0]?.toUpperCase() || '?'}
                  </div>
                  <span className="text-xs text-[#555]">{r.profiles?.full_name || 'Anonymous'}</span>
                </div>

                {r.user_id === user.id && (
                  <button
                    onClick={(e) => handleDelete(e, r.id)}
                    className="flex items-center gap-1 h-7 px-3 rounded-lg bg-[#1a1a1a] text-red-400 text-xs font-semibold active:scale-95 transition-transform"
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
