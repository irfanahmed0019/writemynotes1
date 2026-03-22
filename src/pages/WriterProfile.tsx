import { useAuth } from '@/lib/auth';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useEffect, useState } from 'react';
import { ArrowLeft, Loader2 } from 'lucide-react';

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

  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;

  if (fetching) return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Loader2 className="w-6 h-6 animate-spin text-primary" />
    </div>
  );

  return (
    <div className="min-h-screen bg-background pb-8">
      <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-xl border-b border-border px-4 py-3 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-1 active:scale-[0.95] transition-transform">
          <ArrowLeft className="w-5 h-5 text-foreground" />
        </button>
        <span className="font-semibold text-foreground">{profile?.full_name || 'Profile'}</span>
      </div>

      <div className="px-4 py-6 space-y-6 max-w-lg mx-auto">
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
          <div className="p-4 rounded-xl bg-card border border-border">
            <p className="text-sm text-muted-foreground leading-relaxed">{profile.bio}</p>
          </div>
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
                  className="w-full aspect-[3/4] rounded-xl object-cover border border-border"
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
