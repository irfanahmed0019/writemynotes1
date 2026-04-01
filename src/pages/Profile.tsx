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
    <div className="min-h-screen bg-background pb-24">
      <div className="px-4 py-8 space-y-4 max-w-lg mx-auto animate-fade-in">
        {/* Profile Header */}
        <div className="flex items-center gap-4 glass rounded-2xl p-5">
          {profile?.avatar_url ? (
            <img src={profile.avatar_url} alt="" className="w-16 h-16 rounded-full object-cover ring-2 ring-foreground/10" />
          ) : (
            <div className="w-16 h-16 rounded-full glass-strong flex items-center justify-center text-xl font-bold text-foreground">
              {profile?.full_name?.[0]?.toUpperCase() || '?'}
            </div>
          )}
          <div>
            <h1 className="text-xl font-bold text-foreground">{profile?.full_name || 'Student'}</h1>
            <p className="text-sm text-foreground/40">{user.email}</p>
            {profile?.mode && (
              <span className="inline-block mt-1 px-2.5 py-0.5 rounded-lg glass-subtle text-foreground/60 text-xs font-semibold capitalize">
                {profile.mode}
              </span>
            )}
          </div>
        </div>

        {/* Bio */}
        <div className="space-y-2 glass rounded-2xl p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold text-foreground/40 uppercase tracking-widest">Bio</h2>
            <button onClick={() => setEditingBio(!editingBio)} className="p-1.5 rounded-lg glass-button">
              <Pencil className="w-3.5 h-3.5 text-foreground/50" />
            </button>
          </div>
          {editingBio ? (
            <div className="space-y-2">
              <textarea
                value={bioText}
                onChange={(e) => setBioText(e.target.value)}
                rows={3}
                placeholder="Tell people about yourself..."
                className="w-full px-4 py-3 rounded-xl glass-input text-foreground placeholder:text-foreground/30 text-sm resize-none"
              />
              <button onClick={saveBio} className="h-9 px-4 rounded-xl bg-foreground text-background text-sm font-semibold active:scale-[0.97] transition-transform">
                Save
              </button>
            </div>
          ) : (
            <p className="text-sm text-foreground/50">{profile?.bio || 'No bio yet — tap the pencil to add one'}</p>
          )}
        </div>

        {/* Writing Samples */}
        <div className="space-y-3 glass rounded-2xl p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold text-foreground/40 uppercase tracking-widest">Handwriting Samples</h2>
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="flex items-center gap-1 h-8 px-3 rounded-xl glass-button text-foreground/60 text-xs font-semibold disabled:opacity-50"
            >
              {uploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
              Upload
            </button>
            <input ref={fileRef} type="file" accept="image/*" onChange={uploadSample} className="hidden" />
          </div>
          {samples.length === 0 ? (
            <p className="text-sm text-foreground/40 text-center py-4">No samples yet — upload your handwriting</p>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {samples.map(s => (
                <div key={s.id} className="relative group">
                  <img src={s.image_url} alt="Sample" className="w-full aspect-[3/4] rounded-xl object-cover border border-foreground/10 cursor-pointer" onClick={() => setPreviewUrl(s.image_url)} />
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
        <div className="space-y-3 glass rounded-2xl p-5">
          <h2 className="text-xs font-bold text-foreground/40 uppercase tracking-widest">My Requests</h2>
          {myRequests.length === 0 ? (
            <div className="text-center py-8 space-y-2">
              <Package className="w-8 h-8 text-foreground/15 mx-auto" />
              <p className="text-sm text-foreground/40">No requests yet</p>
            </div>
          ) : (
            myRequests.map(r => (
              <div key={r.id} className="p-3 rounded-xl glass-subtle flex items-center justify-between">
                <div>
                  <p className="font-semibold text-sm text-foreground">{r.title}</p>
                  <p className="text-xs text-foreground/40">{r.subject} • ₹{r.budget}</p>
                </div>
                <span className={`px-2 py-0.5 rounded-lg text-xs font-semibold ${
                  r.status === 'open' ? 'bg-foreground/10 text-foreground/70' : 'glass-subtle text-foreground/40'
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
          className="w-full flex items-center justify-center gap-2 h-12 rounded-2xl glass-button text-destructive font-semibold text-sm"
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
