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
      // Check existing conversations in both directions
      const { data: existingList } = await supabase
        .from('conversations')
        .select('id')
        .or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`)
        .or(`buyer_id.eq.${userId},seller_id.eq.${userId}`);

      const existing = existingList?.find(c => true); // filtered by both .or() clauses
      
      // More reliable: query both directions separately
      const { data: conv1 } = await supabase
        .from('conversations')
        .select('id')
        .eq('buyer_id', user.id)
        .eq('seller_id', userId)
        .limit(1)
        .maybeSingle();

      if (conv1) { navigate(`/chat/${conv1.id}`); return; }

      const { data: conv2 } = await supabase
        .from('conversations')
        .select('id')
        .eq('buyer_id', userId)
        .eq('seller_id', user.id)
        .limit(1)
        .maybeSingle();

      if (conv2) { navigate(`/chat/${conv2.id}`); return; }

      // Find a request_id — check interests by both users, then any request
      let requestId: string | null = null;

      const { data: interest1 } = await supabase
        .from('post_interests')
        .select('request_id')
        .eq('writer_id', userId)
        .limit(1)
        .maybeSingle();

      if (interest1) {
        requestId = interest1.request_id;
      } else {
        const { data: interest2 } = await supabase
          .from('post_interests')
          .select('request_id')
          .eq('writer_id', user.id)
          .limit(1)
          .maybeSingle();

        if (interest2) {
          requestId = interest2.request_id;
        }
      }

      if (!requestId) {
        // Fallback: find any request by either user
        const { data: req1 } = await supabase.from('requests').select('id').eq('user_id', userId).limit(1).maybeSingle();
        if (req1) {
          requestId = req1.id;
        } else {
          const { data: req2 } = await supabase.from('requests').select('id').eq('user_id', user.id).limit(1).maybeSingle();
          if (req2) requestId = req2.id;
        }
      }

      if (!requestId) {
        toast.error('No linked request found');
        setMessaging(false);
        return;
      }

      // RLS requires auth.uid() = seller_id, so current user must be seller
      const { data: convo, error } = await supabase
        .from('conversations')
        .insert({ seller_id: user.id, buyer_id: userId, request_id: requestId })
        .select('id')
        .single();

      if (error) throw error;
      navigate(`/chat/${convo.id}`);
    } catch (err) {
      console.error('handleMessage error:', err);
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
