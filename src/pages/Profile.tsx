import { useAuth } from '@/lib/auth';
import { Navigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useEffect, useState, useRef } from 'react';
import { LogOut, Package, Pencil, Plus, Trash2, Loader2, Camera } from 'lucide-react';
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
    <div className="min-h-screen bg-black pb-20">
      <div className="px-5 pt-6 pb-4 max-w-lg mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-[28px] font-bold text-white tracking-tight">Profile</h1>
          <button onClick={() => setEditingBio(!editingBio)} className="p-2">
            <Pencil className="w-5 h-5 text-[#666]" />
          </button>
        </div>

        {/* Avatar + Name */}
        <div className="flex items-center gap-4">
          {profile?.avatar_url ? (
            <img src={profile.avatar_url} alt="" className="w-20 h-20 rounded-full object-cover" />
          ) : (
            <div className="w-20 h-20 rounded-full bg-[#111] flex items-center justify-center text-2xl font-bold text-[#888]">
              {profile?.full_name?.[0]?.toUpperCase() || '?'}
            </div>
          )}
          <div>
            <h2 className="text-xl font-bold text-white">{profile?.full_name || 'Student'}</h2>
            <p className="text-sm text-[#666]">{user.email}</p>
          </div>
        </div>

        {/* Bio */}
        <div className="space-y-2">
          <h3 className="text-[11px] font-bold text-[#555] uppercase tracking-widest">Bio</h3>
          {editingBio ? (
            <div className="space-y-2">
              <textarea
                value={bioText}
                onChange={(e) => setBioText(e.target.value)}
                rows={3}
                placeholder="Tell people about yourself..."
                className="w-full px-4 py-3 rounded-xl bg-[#111] text-white placeholder:text-[#444] text-sm resize-none border-none outline-none focus:ring-1 focus:ring-[#333]"
              />
              <button onClick={saveBio} className="h-9 px-4 rounded-xl bg-white text-black text-sm font-semibold active:scale-95 transition-transform">
                Save
              </button>
            </div>
          ) : (
            <p className="text-sm text-[#888]">{profile?.bio || 'No bio yet'}</p>
          )}
        </div>

        {/* Writing Samples */}
        <div className="space-y-3">
          <h3 className="text-[11px] font-bold text-[#555] uppercase tracking-widest">Handwriting Samples</h3>
          <div className="grid grid-cols-2 gap-3">
            {samples.map(s => (
              <div key={s.id} className="relative group">
                <img src={s.image_url} alt="Sample" className="w-full aspect-[3/4] rounded-xl object-cover cursor-pointer" onClick={() => setPreviewUrl(s.image_url)} />
                <button
                  onClick={() => deleteSample(s)}
                  className="absolute top-2 right-2 w-7 h-7 rounded-lg bg-black/70 text-red-400 flex items-center justify-center opacity-0 group-hover:opacity-100 active:opacity-100 transition-opacity"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="aspect-[3/4] rounded-xl bg-[#111] flex flex-col items-center justify-center gap-2 text-[#555] disabled:opacity-50"
            >
              {uploading ? <Loader2 className="w-6 h-6 animate-spin" /> : <Camera className="w-6 h-6" />}
              <span className="text-xs font-medium">Add Sample</span>
            </button>
            <input ref={fileRef} type="file" accept="image/*" onChange={uploadSample} className="hidden" />
          </div>
        </div>

        {/* My Requests */}
        <div className="space-y-3">
          <h3 className="text-[11px] font-bold text-[#555] uppercase tracking-widest">My Requests</h3>
          {myRequests.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-sm text-[#555]">No requests posted</p>
            </div>
          ) : (
            myRequests.map(r => (
              <div key={r.id} className="p-3 rounded-xl bg-[#111] flex items-center justify-between">
                <div>
                  <p className="font-semibold text-sm text-white">{r.title}</p>
                  <p className="text-xs text-[#666]">{r.subject} • ₹{r.budget}</p>
                </div>
                <span className="px-2 py-0.5 rounded-lg text-xs font-semibold bg-[#1a1a1a] text-[#888]">
                  {r.status}
                </span>
              </div>
            ))
          )}
        </div>

        {/* Sign Out */}
        <button
          onClick={signOut}
          className="w-full flex items-center justify-center gap-2 h-12 rounded-2xl bg-[#111] text-red-400 font-semibold text-sm active:scale-[0.98] transition-transform"
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
