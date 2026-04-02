import { useAuth } from '@/lib/auth';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useEffect, useState } from 'react';
import { ArrowLeft, Loader2, MessageCircle } from 'lucide-react';
import { toast } from 'sonner';
import ImagePreview from '@/components/ImagePreview';

type ProfileData = {
  full_name: string | null;
  avatar_url: string | null;
  bio: string;
  mode: string | null;
};

type Sample = {
  id: string;
  image_url: string;
  created_at: string;
};

export default function WriterProfile() {
  const { user, loading } = useAuth();
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [samples, setSamples] = useState<Sample[]>([]);
  const [fetching, setFetching] = useState(true);
  const [messaging, setMessaging] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;
    const fetch = async () => {
      const [profileRes, samplesRes] = await Promise.all([
        supabase.from('profiles').select('full_name, avatar_url, bio, mode').eq('user_id', userId).single(),
        supabase.from('writing_samples').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
      ]);
      if (profileRes.data) setProfile(profileRes.data as any);
      if (samplesRes.data) setSamples(samplesRes.data);
      setFetching(false);
    };
    fetch();
  }, [userId]);

  const handleMessage = async () => {
    if (!user || !userId || userId === user.id) return;
    setMessaging(true);
    try {
      const { data: existing } = await supabase
        .from('conversations')
        .select('id')
        .or(`and(buyer_id.eq.${user.id},seller_id.eq.${userId}),and(buyer_id.eq.${userId},seller_id.eq.${user.id})`)
        .maybeSingle();

      if (existing) { navigate(`/chat/${existing.id}`); return; }

      const { data: interest } = await supabase
        .from('post_interests')
        .select('id, request_id, status')
        .eq('writer_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      let requestId: string | null = null;

      if (interest) {
        if (interest.status === 'pending') {
          await supabase.from('post_interests').update({ status: 'approved' }).eq('id', interest.id);
        }
        requestId = interest.request_id;
      } else {
        const { data: reverseInterest } = await supabase
          .from('post_interests')
          .select('id, request_id, status')
          .eq('writer_id', user.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (reverseInterest) {
          if (reverseInterest.status === 'pending') {
            await supabase.from('post_interests').update({ status: 'approved' }).eq('id', reverseInterest.id);
          }
          requestId = reverseInterest.request_id;
        }
      }

      if (!requestId) {
        const { data: anyRequest } = await supabase
          .from('requests')
          .select('id')
          .or(`user_id.eq.${user.id},user_id.eq.${userId}`)
          .limit(1)
          .maybeSingle();

        if (!anyRequest) { toast.error('No linked request found'); setMessaging(false); return; }
        requestId = anyRequest.id;
      }

      const { data: convo, error } = await supabase
        .from('conversations')
        .insert({ seller_id: user.id, buyer_id: userId, request_id: requestId })
        .select('id')
        .single();

      if (error) throw error;
      navigate(`/chat/${convo.id}`);
    } catch {
      toast.error('Could not start conversation');
    } finally {
      setMessaging(false);
    }
  };

  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;

  if (fetching) return (
    <div className="min-h-screen flex items-center justify-center bg-black">
      <Loader2 className="w-6 h-6 animate-spin text-[#444]" />
    </div>
  );

  const isOwnProfile = userId === user.id;

  return (
    <div className="min-h-screen bg-black pb-8">
      <div className="sticky top-0 z-10 bg-black border-b border-[#1a1a1a] px-5 py-3 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-1.5 rounded-xl bg-[#111] active:scale-95">
          <ArrowLeft className="w-5 h-5 text-white" />
        </button>
        <span className="font-bold text-white">{profile?.full_name || 'Profile'}</span>
      </div>

      <div className="px-5 py-6 space-y-6 max-w-lg mx-auto">
        <div className="flex flex-col items-center text-center space-y-3">
          {profile?.avatar_url ? (
            <img src={profile.avatar_url} alt="" className="w-24 h-24 rounded-full object-cover" />
          ) : (
            <div className="w-24 h-24 rounded-full bg-[#111] flex items-center justify-center text-3xl font-bold text-[#888]">
              {profile?.full_name?.[0]?.toUpperCase() || '?'}
            </div>
          )}
          <div>
            <h1 className="text-xl font-bold text-white">{profile?.full_name || 'Unknown'}</h1>
            {profile?.mode && (
              <span className="inline-block mt-1 px-3 py-0.5 rounded-full bg-[#1a1a1a] text-[#888] text-xs font-bold capitalize">{profile.mode}</span>
            )}
          </div>
        </div>

        {profile?.bio && (
          <div className="p-5 rounded-2xl bg-[#111]">
            <p className="text-sm text-[#888] leading-relaxed">{profile.bio}</p>
          </div>
        )}

        {!isOwnProfile && (
          <button
            onClick={handleMessage}
            disabled={messaging}
            className="w-full flex items-center justify-center gap-2 h-12 rounded-2xl bg-white text-black font-bold text-sm active:scale-[0.97] transition-transform disabled:opacity-50"
          >
            {messaging ? <Loader2 className="w-4 h-4 animate-spin" /> : <MessageCircle className="w-4 h-4" />}
            Message
          </button>
        )}

        <div className="space-y-3">
          <h2 className="text-[11px] font-bold text-[#555] uppercase tracking-widest">
            Handwriting Samples ({samples.length})
          </h2>
          {samples.length === 0 ? (
            <p className="text-sm text-[#555] text-center py-6">No samples uploaded yet</p>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {samples.map(s => (
                <img
                  key={s.id}
                  src={s.image_url}
                  alt="Writing sample"
                  className="w-full aspect-[3/4] rounded-xl object-cover cursor-pointer"
                  onClick={() => setPreviewUrl(s.image_url)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
      {previewUrl && <ImagePreview src={previewUrl} onClose={() => setPreviewUrl(null)} />}
    </div>
  );
}
