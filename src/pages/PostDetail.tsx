import { useAuth } from '@/lib/auth';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useEffect, useState } from 'react';
import { ArrowLeft, Calendar, FileText, IndianRupee, Clock, Loader2, Check, X } from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { toast } from 'sonner';

type RequestDetail = {
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

type Interest = {
  id: string;
  writer_id: string;
  status: string;
  created_at: string;
  writer_name?: string;
  writer_avatar?: string | null;
};

export default function PostDetail() {
  const { user, loading } = useAuth();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [request, setRequest] = useState<RequestDetail | null>(null);
  const [interests, setInterests] = useState<Interest[]>([]);
  const [myInterest, setMyInterest] = useState<Interest | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!user || !id) return;

    const fetchData = async () => {
      const { data: req } = await supabase
        .from('requests')
        .select('*, profiles!requests_user_id_profiles_fkey(full_name, avatar_url)')
        .eq('id', id)
        .single();
      if (req) setRequest(req as any);

      const { data: ints } = await supabase
        .from('post_interests')
        .select('*')
        .eq('request_id', id);

      if (ints) {
        const enriched = await Promise.all(
          ints.map(async (i: any) => {
            const { data: p } = await supabase.from('profiles').select('full_name, avatar_url').eq('user_id', i.writer_id).single();
            return { ...i, writer_name: p?.full_name || 'Unknown', writer_avatar: p?.avatar_url };
          })
        );
        setInterests(enriched);
        setMyInterest(enriched.find(i => i.writer_id === user.id) || null);
      }
    };

    fetchData();

    const channel = supabase
      .channel(`post-interest-${id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'post_interests', filter: `request_id=eq.${id}` }, () => fetchData())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, id]);

  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (!request) return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Loader2 className="w-6 h-6 animate-spin text-primary" />
    </div>
  );

  const isOwner = request.user_id === user.id;

  const handleInterest = async () => {
    setSubmitting(true);
    const { error } = await supabase.from('post_interests').insert({
      request_id: request.id,
      writer_id: user.id,
    });
    if (error) toast.error('Failed to express interest');
    else toast.success("Interest sent! The poster will review.");
    setSubmitting(false);
  };

  const handleApprove = async (interest: Interest) => {
    // Update interest status
    await supabase.from('post_interests').update({ status: 'approved' }).eq('id', interest.id);

    // Create conversation
    const { data: existing } = await supabase
      .from('conversations')
      .select('id')
      .eq('request_id', request.id)
      .eq('seller_id', interest.writer_id)
      .maybeSingle();

    if (!existing) {
      await supabase.from('conversations').insert({
        request_id: request.id,
        buyer_id: request.user_id,
        seller_id: interest.writer_id,
      });
    }

    toast.success(`Approved! Chat created with ${interest.writer_name}`);
  };

  const handleReject = async (interest: Interest) => {
    await supabase.from('post_interests').update({ status: 'rejected' }).eq('id', interest.id);
    toast('Interest rejected');
  };

  return (
    <div className="min-h-screen bg-background pb-8">
      {/* Header */}
      <div className="sticky top-0 z-10 glass-strong border-b border-border px-4 py-3 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-1 active:scale-[0.95] transition-transform">
          <ArrowLeft className="w-5 h-5 text-foreground" />
        </button>
        <h1 className="text-lg font-bold text-foreground truncate">Request Details</h1>
      </div>

      <div className="px-4 py-6 space-y-6 max-w-lg mx-auto">
        {/* Request Info */}
        <div className="space-y-4">
          <div>
            <h2 className="text-xl font-bold text-foreground">{request.title}</h2>
            <div className="flex items-center gap-2 mt-2">
              <span className="px-2.5 py-1 rounded-lg bg-primary/15 text-primary text-xs font-semibold">{request.subject}</span>
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {formatDistanceToNow(new Date(request.created_at), { addSuffix: true })}
              </span>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-3 gap-3">
            <div className="p-3 rounded-xl bg-card border border-border text-center space-y-1">
              <IndianRupee className="w-4 h-4 mx-auto text-primary" />
              <p className="text-lg font-bold text-foreground">₹{request.budget}</p>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Budget</p>
            </div>
            <div className="p-3 rounded-xl bg-card border border-border text-center space-y-1">
              <FileText className="w-4 h-4 mx-auto text-primary" />
              <p className="text-lg font-bold text-foreground">{request.pages || '—'}</p>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Pages</p>
            </div>
            <div className="p-3 rounded-xl bg-card border border-border text-center space-y-1">
              <Calendar className="w-4 h-4 mx-auto text-primary" />
              <p className="text-sm font-bold text-foreground">{format(new Date(request.deadline), 'MMM d')}</p>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Deadline</p>
            </div>
          </div>

          {request.description && (
            <div className="p-4 rounded-xl bg-card border border-border">
              <p className="text-sm text-muted-foreground leading-relaxed">{request.description}</p>
            </div>
          )}

          {/* Posted by */}
          <button
            onClick={() => navigate(`/writer/${request.user_id}`)}
            className="flex items-center gap-3 p-3 rounded-xl bg-card border border-border w-full active:scale-[0.98] transition-transform"
          >
            {request.profiles?.avatar_url ? (
              <img src={request.profiles.avatar_url} className="w-10 h-10 rounded-full object-cover" alt="" />
            ) : (
              <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center text-sm font-semibold text-foreground">
                {request.profiles?.full_name?.[0]?.toUpperCase() || '?'}
              </div>
            )}
            <div className="text-left">
              <p className="text-sm font-semibold text-foreground">{request.profiles?.full_name || 'Anonymous'}</p>
              <p className="text-xs text-muted-foreground">Posted by</p>
            </div>
          </button>
        </div>

        {/* Action for writers */}
        {!isOwner && (
          <div>
            {myInterest ? (
              <div className={`w-full h-14 rounded-xl flex items-center justify-center text-sm font-semibold ${
                myInterest.status === 'approved' ? 'bg-primary/15 text-primary' :
                myInterest.status === 'rejected' ? 'bg-destructive/15 text-destructive' :
                'bg-accent/15 text-accent-foreground'
              }`}>
                {myInterest.status === 'approved' ? '✅ Approved — Check your chats!' :
                 myInterest.status === 'rejected' ? '❌ Interest was declined' :
                 '⏳ Interest sent — Waiting for approval'}
              </div>
            ) : (
              <button
                onClick={handleInterest}
                disabled={submitting}
                className="w-full h-14 rounded-xl bg-primary text-primary-foreground font-semibold text-base active:scale-[0.97] transition-transform disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : '✍️ I am willing to write'}
              </button>
            )}
          </div>
        )}

        {/* Interest requests (visible to poster only) */}
        {isOwner && interests.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Writer Interests ({interests.length})</h3>
            {interests.map(i => (
              <div key={i.id} className="p-3 rounded-xl bg-card border border-border flex items-center justify-between gap-3">
                <button
                  onClick={() => navigate(`/writer/${i.writer_id}`)}
                  className="flex items-center gap-2 min-w-0 active:scale-[0.98] transition-transform"
                >
                  {i.writer_avatar ? (
                    <img src={i.writer_avatar} className="w-9 h-9 rounded-full object-cover shrink-0" alt="" />
                  ) : (
                    <div className="w-9 h-9 rounded-full bg-secondary flex items-center justify-center text-xs font-semibold text-foreground shrink-0">
                      {i.writer_name?.[0]?.toUpperCase() || '?'}
                    </div>
                  )}
                  <div className="text-left min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{i.writer_name}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {formatDistanceToNow(new Date(i.created_at), { addSuffix: true })}
                    </p>
                  </div>
                </button>
                {i.status === 'pending' ? (
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => handleApprove(i)}
                      className="w-8 h-8 rounded-lg bg-primary/15 text-primary flex items-center justify-center active:scale-[0.95] transition-transform"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleReject(i)}
                      className="w-8 h-8 rounded-lg bg-destructive/15 text-destructive flex items-center justify-center active:scale-[0.95] transition-transform"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <span className={`text-xs font-medium px-2 py-1 rounded-lg ${
                    i.status === 'approved' ? 'bg-primary/10 text-primary' : 'bg-destructive/10 text-destructive'
                  }`}>
                    {i.status}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
