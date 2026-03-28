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
      // Check if a conversation already exists between these two users
      const { data: existing } = await supabase
        .from('conversations')
        .select('id')
        .or(`and(buyer_id.eq.${user.id},seller_id.eq.${userId}),and(buyer_id.eq.${userId},seller_id.eq.${user.id})`)
        .maybeSingle();

      if (existing) {
        navigate(`/chat/${existing.id}`);
        return;
      }

      // Find any interest between this writer and current user's requests (approved or pending)
      // First check: userId is the writer on current user's posts
      const { data: interest } = await supabase
        .from('post_interests')
        .select('id, request_id, status')
        .eq('writer_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      let requestId: string | null = null;

      if (interest) {
        // Auto-approve if still pending (poster is initiating chat = approval)
        if (interest.status === 'pending') {
          await supabase
            .from('post_interests')
            .update({ status: 'approved' })
            .eq('id', interest.id);
        }
        requestId = interest.request_id;
      } else {
        // Reverse: current user is the writer
        const { data: reverseInterest } = await supabase
          .from('post_interests')
          .select('id, request_id, status')
          .eq('writer_id', user.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (reverseInterest) {
          if (reverseInterest.status === 'pending') {
            await supabase
              .from('post_interests')
              .update({ status: 'approved' })
              .eq('id', reverseInterest.id);
          }
          requestId = reverseInterest.request_id;
        }
      }

      if (!requestId) {
        // Fallback: pick any request by either user to link conversation
        const { data: anyRequest } = await supabase
          .from('requests')
          .select('id')
          .or(`user_id.eq.${user.id},user_id.eq.${userId}`)
          .limit(1)
          .maybeSingle();

        if (!anyRequest) {
          toast.error('No linked request found');
          setMessaging(false);
          return;
        }
        requestId = anyRequest.id;
      }

      // Create conversation — current user is always seller_id (RLS requires auth.uid() = seller_id)
      const { data: convo, error } = await supabase
        .from('conversations')
        .insert({ seller_id: user.id, buyer_id: userId, request_id: requestId })
        .select('id')
        .single();

      if (error) throw error;
      navigate(`/chat/${convo.id}`);
    } catch (err: any) {
      toast.error('Could not start conversation');
    } finally {
      setMessaging(false);
    }
  };

  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;

  if (fetching) return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Loader2 className="w-6 h-6 animate-spin text-primary" />
    </div>
  );

  const isOwnProfile = userId === user.id;

  return (
    <div className="min-h-screen bg-background pb-8">
      <div className="sticky top-0 z-10 glass-strong border-b border-border px-4 py-3 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-1 active:scale-[0.95] transition-transform">
          <ArrowLeft className="w-5 h-5 text-foreground" />
        </button>
        <span className="font-semibold text-foreground">{profile?.full_name || 'Profile'}</span>
      </div>

      <div className="px-4 py-6 space-y-6 max-w-lg mx-auto animate-fade-in">
        {/* Avatar + Info */}
        <div className="flex flex-col items-center text-center space-y-3">
          {profile?.avatar_url ? (
            <img src={profile.avatar_url} alt="" className="w-24 h-24 rounded-full object-cover ring-2 ring-primary/30" />
          ) : (
            <div className="w-24 h-24 rounded-full bg-secondary flex items-center justify-center text-3xl font-bold text-foreground">
              {profile?.full_name?.[0]?.toUpperCase() || '?'}
            </div>
          )}
          <div>
            <h1 className="text-xl font-bold text-foreground">{profile?.full_name || 'Unknown'}</h1>
            {profile?.mode && (
              <span className="inline-block mt-1 px-3 py-0.5 rounded-lg bg-primary/10 text-primary text-xs font-medium capitalize">{profile.mode}</span>
            )}
          </div>
        </div>

        {/* Bio */}
        {profile?.bio && (
          <div className="p-4 rounded-xl glass">
            <p className="text-sm text-muted-foreground leading-relaxed">{profile.bio}</p>
          </div>
        )}

        {/* Message Button */}
        {!isOwnProfile && (
          <button
            onClick={handleMessage}
            disabled={messaging}
            className="w-full flex items-center justify-center gap-2 h-11 rounded-xl bg-primary text-primary-foreground font-medium text-sm active:scale-[0.97] transition-transform disabled:opacity-50"
          >
            {messaging ? <Loader2 className="w-4 h-4 animate-spin" /> : <MessageCircle className="w-4 h-4" />}
            Message
          </button>
        )}

        {/* Writing Samples */}
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            Handwriting Samples ({samples.length})
          </h2>
          {samples.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No samples uploaded yet</p>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {samples.map(s => (
                <img
                  key={s.id}
                  src={s.image_url}
                  alt="Writing sample"
                  className="w-full aspect-[3/4] rounded-xl object-cover border border-border cursor-pointer"
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
