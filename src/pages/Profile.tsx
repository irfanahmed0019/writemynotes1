import { useAuth } from '@/lib/auth';
import { Navigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useEffect, useState, useRef } from 'react';
import { LogOut, Package, Pencil, Plus, Trash2, Loader2 } from 'lucide-react';
import BottomNav from '@/components/BottomNav';
import ImagePreview from '@/components/ImagePreview';
import { toast } from 'sonner';
import { compressImage } from '@/lib/compress';

type ProfileData = {
  full_name: string | null;
  avatar_url: string | null;
  mode: string | null;
  bio: string;
};

type Request = {
  id: string;
  title: string;
  subject: string;
  budget: number;
  status: string;
  created_at: string;
};

type Sample = {
  id: string;
  image_url: string;
  created_at: string;
};

export default function Profile() {
  const { user, loading, signOut } = useAuth();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [myRequests, setMyRequests] = useState<Request[]>([]);
  const [samples, setSamples] = useState<Sample[]>([]);
  const [editingBio, setEditingBio] = useState(false);
  const [bioText, setBioText] = useState('');
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user) return;

    const fetchAll = async () => {
      const [profileRes, requestsRes, samplesRes] = await Promise.all([
        supabase.from('profiles').select('full_name, avatar_url, mode, bio').eq('user_id', user.id).single(),
        supabase.from('requests').select('id, title, subject, budget, status, created_at').eq('user_id', user.id).order('created_at', { ascending: false }),
        supabase.from('writing_samples').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
      ]);
      if (profileRes.data) {
        setProfile(profileRes.data as any);
        setBioText((profileRes.data as any).bio || '');
      }
      if (requestsRes.data) setMyRequests(requestsRes.data);
      if (samplesRes.data) setSamples(samplesRes.data);
    };

    fetchAll();
  }, [user]);

  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;

  const saveBio = async () => {
    await supabase.from('profiles').update({ bio: bioText }).eq('user_id', user.id);
    setProfile(prev => prev ? { ...prev, bio: bioText } : prev);
    setEditingBio(false);
    toast.success('Bio updated');
  };

  const uploadSample = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);

    try {
      const compressed = await compressImage(file);
      const ext = file.name.split('.').pop();
      const path = `${user.id}/${Date.now()}.${ext}`;

      const { error: uploadErr } = await supabase.storage.from('writing-samples').upload(path, compressed);
    if (uploadErr) {
      toast.error('Upload failed');
      setUploading(false);
      return;
    }

    const { data: urlData } = supabase.storage.from('writing-samples').getPublicUrl(path);

    const { data: sample, error: insertErr } = await supabase
      .from('writing_samples')
      .insert({ user_id: user.id, image_url: urlData.publicUrl })
      .select()
      .single();

    if (insertErr) toast.error('Failed to save sample');
    else if (sample) setSamples(prev => [sample, ...prev]);
    } catch {
      toast.error('Compression failed');
    }

    setUploading(false);
    if (fileRef.current) fileRef.current.value = '';
  };

  const deleteSample = async (sample: Sample) => {
    // Extract path from URL
    const url = new URL(sample.image_url);
    const storagePath = url.pathname.split('/storage/v1/object/public/writing-samples/')[1];
    if (storagePath) {
      await supabase.storage.from('writing-samples').remove([storagePath]);
    }
    await supabase.from('writing_samples').delete().eq('id', sample.id);
    setSamples(prev => prev.filter(s => s.id !== sample.id));
    toast('Sample deleted');
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="px-4 py-8 space-y-6 max-w-lg mx-auto">
        {/* Profile Header */}
        <div className="flex items-center gap-4">
          {profile?.avatar_url ? (
            <img src={profile.avatar_url} alt="" className="w-16 h-16 rounded-full object-cover" />
          ) : (
            <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center text-xl font-bold text-foreground">
              {profile?.full_name?.[0]?.toUpperCase() || '?'}
            </div>
          )}
          <div>
            <h1 className="text-xl font-bold text-foreground">{profile?.full_name || 'Student'}</h1>
            <p className="text-sm text-muted-foreground">{user.email}</p>
            {profile?.mode && (
              <span className="inline-block mt-1 px-2 py-0.5 rounded-md bg-primary/10 text-primary text-xs font-medium capitalize">
                {profile.mode}
              </span>
            )}
          </div>
        </div>

        {/* Bio */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Bio</h2>
            <button onClick={() => setEditingBio(!editingBio)} className="p-1 active:scale-[0.95] transition-transform">
              <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
            </button>
          </div>
          {editingBio ? (
            <div className="space-y-2">
              <textarea
                value={bioText}
                onChange={(e) => setBioText(e.target.value)}
                rows={3}
                placeholder="Tell people about yourself, your writing style..."
                className="w-full px-4 py-3 rounded-xl bg-card border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring text-sm resize-none"
              />
              <button onClick={saveBio} className="h-9 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-medium active:scale-[0.97] transition-transform">
                Save
              </button>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">{profile?.bio || 'No bio yet — tap the pencil to add one'}</p>
          )}
        </div>

        {/* Writing Samples */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Handwriting Samples</h2>
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="flex items-center gap-1 h-8 px-3 rounded-lg bg-primary/10 text-primary text-xs font-medium active:scale-[0.97] transition-transform disabled:opacity-50"
            >
              {uploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
              Upload
            </button>
            <input ref={fileRef} type="file" accept="image/*" onChange={uploadSample} className="hidden" />
          </div>
          {samples.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No samples yet — upload your handwriting</p>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {samples.map(s => (
                <div key={s.id} className="relative group">
                  <img src={s.image_url} alt="Sample" className="w-full aspect-[3/4] rounded-xl object-cover border border-border cursor-pointer" onClick={() => setPreviewUrl(s.image_url)} />
                  <button
                    onClick={() => deleteSample(s)}
                    className="absolute top-2 right-2 w-7 h-7 rounded-lg bg-destructive/90 text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 active:opacity-100 transition-opacity active:scale-[0.95]"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* My Requests */}
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">My Requests</h2>
          {myRequests.length === 0 ? (
            <div className="text-center py-8 space-y-2">
              <Package className="w-8 h-8 text-muted-foreground mx-auto" />
              <p className="text-sm text-muted-foreground">No requests yet</p>
            </div>
          ) : (
            myRequests.map(r => (
              <div key={r.id} className="p-3 rounded-xl bg-card border border-border flex items-center justify-between">
                <div>
                  <p className="font-medium text-sm text-foreground">{r.title}</p>
                  <p className="text-xs text-muted-foreground">{r.subject} • ₹{r.budget}</p>
                </div>
                <span className={`px-2 py-0.5 rounded-md text-xs font-medium ${
                  r.status === 'open' ? 'bg-primary/10 text-primary' : 'bg-secondary text-muted-foreground'
                }`}>
                  {r.status}
                </span>
              </div>
            ))
          )}
        </div>

        {/* Sign Out */}
        <button
          onClick={signOut}
          className="w-full flex items-center justify-center gap-2 h-12 rounded-xl bg-destructive/10 text-destructive font-medium text-sm active:scale-[0.97] transition-transform"
        >
          <LogOut className="w-4 h-4" />
          Sign Out
        </button>
      </div>

      <BottomNav />
      {previewUrl && <ImagePreview src={previewUrl} onClose={() => setPreviewUrl(null)} />}
    </div>
  );
}
