import { useAuth } from '@/lib/auth';
import { Navigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useEffect, useState } from 'react';
import { LogOut, Package } from 'lucide-react';
import BottomNav from '@/components/BottomNav';

type ProfileData = {
  full_name: string | null;
  avatar_url: string | null;
  mode: string | null;
};

type Request = {
  id: string;
  title: string;
  subject: string;
  budget: number;
  status: string;
  created_at: string;
};

export default function Profile() {
  const { user, loading, signOut } = useAuth();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [myRequests, setMyRequests] = useState<Request[]>([]);

  useEffect(() => {
    if (!user) return;

    supabase
      .from('profiles')
      .select('full_name, avatar_url, mode')
      .eq('user_id', user.id)
      .single()
      .then(({ data }) => { if (data) setProfile(data); });

    supabase
      .from('requests')
      .select('id, title, subject, budget, status, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .then(({ data }) => { if (data) setMyRequests(data); });
  }, [user]);

  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="px-4 py-8 space-y-6">
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
    </div>
  );
}
