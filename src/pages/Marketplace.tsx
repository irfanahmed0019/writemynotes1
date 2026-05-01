import { useAuth } from '@/lib/auth';
import { Navigate, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useEffect, useState } from 'react';
import { Search, Plus, Trash2, Clock, IndianRupee, FileText, Sparkles, Download, Send } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import BottomNav from '@/components/BottomNav';
import { useUiLayout } from '@/hooks/use-ui-layout';
import { usePwaInstall } from '@/hooks/use-pwa-install';
import { useAppSettings } from '@/hooks/use-app-settings';
import FaqSection from '@/components/FaqSection';
import { Megaphone, NotebookPen } from 'lucide-react';

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

const HEADER_ICON_MAP: Record<string, any> = {
  Plus, Sparkles, Download, Send, NotebookPen,
};

const HEADER_ACTION_MAP: Record<string, string> = {
  post: '/post',
  activity: '/activity',
  install: '__install__',
  chat: '/chats',
  mynotes: '/my-notes',
};

export default function Marketplace() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [requests, setRequests] = useState<Request[]>([]);
  const [search, setSearch] = useState('');
  const { headerItems } = useUiLayout();
  const { canInstall, isInstalled, install } = usePwaInstall();
  const [showInstallGuide, setShowInstallGuide] = useState(false);
  const { settings } = useAppSettings();

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

  const filtered = requests.filter(r =>
    r.title.toLowerCase().includes(search.toLowerCase()) ||
    r.subject.toLowerCase().includes(search.toLowerCase())
  );

  const visibleHeaderItems = headerItems.filter(item =>
    Object.prototype.hasOwnProperty.call(HEADER_ACTION_MAP, item.key)
  );

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    await supabase.from('requests').delete().eq('id', id);
    setRequests(prev => prev.filter(r => r.id !== id));
  };

  const handleHeaderAction = async (key: string) => {
    if (key === 'install') {
      if (isInstalled) return;
      const result = await install();
      if (result === 'manual') setShowInstallGuide(true);
    } else {
      const path = HEADER_ACTION_MAP[key];
      if (path) navigate(path);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-[calc(4rem+env(safe-area-inset-bottom))]">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background px-5 pt-[max(1.5rem,env(safe-area-inset-top))] pb-4">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-[28px] font-bold text-foreground tracking-tight">Marketplace</h1>
          <div className="flex items-center gap-2">
            {visibleHeaderItems.map(item => {
              const Icon = HEADER_ICON_MAP[item.icon] || Plus;
              const isInstallBtn = item.key === 'install';
              if (isInstallBtn && isInstalled) return null;
              return (
                <button
                  key={item.key}
                  onClick={() => handleHeaderAction(item.key)}
                  className={`w-9 h-9 rounded-full flex items-center justify-center active:scale-95 transition-transform ${
                    item.key === 'post' ? 'bg-primary' : 'bg-secondary'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${item.key === 'post' ? 'text-primary-foreground' : 'text-foreground'}`} />
                </button>
              );
            })}
          </div>
        </div>

        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search requests..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-11 pl-11 pr-4 rounded-2xl bg-secondary text-foreground text-sm placeholder:text-muted-foreground border-none outline-none focus:ring-1 focus:ring-border"
          />
        </div>
      </div>

      {/* Install Guide Modal */}
      {showInstallGuide && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm" onClick={() => setShowInstallGuide(false)}>
          <div className="w-full max-w-lg glass-strong rounded-t-3xl p-6 space-y-4 animate-slide-up" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-foreground">Install WriteMyNotes</h2>
            <div className="space-y-3 text-sm text-secondary-foreground">
              <p><strong className="text-foreground">Chrome (Android):</strong> Tap the 3-dot menu → "Add to Home screen"</p>
              <p><strong className="text-foreground">Safari (iOS):</strong> Tap the Share button → "Add to Home Screen"</p>
              <p><strong className="text-foreground">Chrome (Desktop):</strong> Click the install icon in the address bar</p>
            </div>
            <button
              onClick={() => setShowInstallGuide(false)}
              className="w-full py-3 rounded-2xl bg-primary text-primary-foreground font-bold text-sm"
            >
              Got it
            </button>
          </div>
        </div>
      )}

      {/* Requests List */}
      <div className="px-5 py-2 space-y-3">
        {settings.feature_toggles?.announcement && settings.announcement?.enabled && settings.announcement.text && (
          <div className="flex items-start gap-2 px-4 py-3 rounded-2xl bg-primary/10 border border-primary/20">
            <Megaphone className="w-4 h-4 text-primary mt-0.5 shrink-0" />
            <p className="text-xs text-foreground leading-relaxed">{settings.announcement.text}</p>
          </div>
        )}
        {filtered.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-muted-foreground text-sm">No requests yet. Be the first to post!</p>
          </div>
        ) : (
          filtered.map(r => (
            <button
              key={r.id}
              onClick={() => navigate(`/post/${r.id}`)}
              className="w-full text-left p-4 rounded-2xl bg-card space-y-3 active:scale-[0.98] transition-transform"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-1.5 min-w-0">
                  <h3 className="font-bold text-foreground text-[15px] truncate">{r.title}</h3>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="px-2 py-0.5 rounded-lg bg-secondary font-semibold text-secondary-foreground">{r.subject}</span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-0.5 text-foreground font-bold text-lg shrink-0">
                  <IndianRupee className="w-4 h-4" />
                  {r.budget}
                </div>
              </div>

              {r.pages && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <FileText className="w-3 h-3" />
                  {r.pages} pages
                </div>
              )}

              <div className="flex items-center justify-between pt-1">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-secondary flex items-center justify-center text-[10px] font-bold text-secondary-foreground">
                    {r.profiles?.full_name?.[0]?.toUpperCase() || '?'}
                  </div>
                  <span className="text-xs text-muted-foreground">{r.profiles?.full_name || 'Anonymous'}</span>
                </div>

                {r.user_id === user.id && (
                  <button
                    onClick={(e) => handleDelete(e, r.id)}
                    className="flex items-center gap-1 h-7 px-3 rounded-lg bg-secondary text-red-400 text-xs font-semibold active:scale-95 transition-transform"
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
      {settings.feature_toggles?.faq && settings.faq?.enabled && (
        <FaqSection items={settings.faq.items} />
      )}
    </div>
  );
}
