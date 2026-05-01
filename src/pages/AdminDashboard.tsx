import { useAuth } from '@/lib/auth';
import { Navigate, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useEffect, useState } from 'react';
import { Users, MessageSquare, FileText, Trash2, Eye, ChevronLeft, BookOpen, Plus, Save, Palette, ArrowUp, ArrowDown, EyeOff, Ban, CheckCircle, BarChart3, Layout as LayoutIcon, X } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import BottomNav from '@/components/BottomNav';
import type { LayoutItem } from '@/hooks/use-ui-layout';
import { toast } from 'sonner';
import { useAppSettings, updateAppSetting, type FaqItem } from '@/hooks/use-app-settings';
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from 'recharts';

type UserProfile = {
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
  mode: string | null;
  bio: string | null;
  created_at: string;
  banned: boolean;
};

type RequestItem = {
  id: string;
  user_id: string;
  title: string;
  subject: string;
  budget: number;
  pages: number | null;
  status: string;
  created_at: string;
  profiles?: { full_name: string | null } | null;
};

type ConversationItem = {
  id: string;
  buyer_id: string;
  seller_id: string;
  created_at: string;
  request_id: string;
  buyer_profile?: { full_name: string | null } | null;
  seller_profile?: { full_name: string | null } | null;
  last_message?: string;
  message_count?: number;
};

type Tab = 'users' | 'posts' | 'chats' | 'study' | 'design' | 'analytics' | 'homepage';

// Undo/redo history for design changes
type LayoutSnapshot = LayoutItem[];

export default function AdminDashboard() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [tab, setTab] = useState<Tab>('users');
  const { settings, reload: reloadSettings } = useAppSettings();

  // Analytics state
  const [liveCount, setLiveCount] = useState<number>(0);
  const [activityRange, setActivityRange] = useState<'3h' | '6h' | '1d' | '7d'>('1d');
  const [activityData, setActivityData] = useState<{ time: string; users: number }[]>([]);

  // Homepage editor draft
  const [heroDraft, setHeroDraft] = useState(settings.hero);
  const [announcementDraft, setAnnouncementDraft] = useState(settings.announcement);
  const [faqDraft, setFaqDraft] = useState<FaqItem[]>(settings.faq?.items ?? []);
  const [limitDraft, setLimitDraft] = useState<number>(settings.damu_daily_limit?.limit ?? 30);
  const [savingHomepage, setSavingHomepage] = useState(false);

  useEffect(() => {
    setHeroDraft(settings.hero);
    setAnnouncementDraft(settings.announcement);
    setFaqDraft(settings.faq?.items ?? []);
    setLimitDraft(settings.damu_daily_limit?.limit ?? 30);
  }, [settings]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [posts, setPosts] = useState<RequestItem[]>([]);
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [selectedChat, setSelectedChat] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<any[]>([]);

  // Study admin state
  const [studyConfig, setStudyConfig] = useState<any>(null);
  const [studySubjects, setStudySubjects] = useState<any[]>([]);
  const [semesterLabel, setSemesterLabel] = useState('');
  const [newSubject, setNewSubject] = useState({ name: '', notes_url: '', papers_url: '' });
  const [studySaving, setStudySaving] = useState(false);
  const [editingNotes, setEditingNotes] = useState<string | null>(null);
  const [notesText, setNotesText] = useState('');

  // Design state with undo/redo
  const [layoutItems, setLayoutItems] = useState<LayoutItem[]>([]);
  const [undoStack, setUndoStack] = useState<LayoutSnapshot[]>([]);
  const [redoStack, setRedoStack] = useState<LayoutSnapshot[]>([]);

  const pushUndo = (current: LayoutItem[]) => {
    setUndoStack(prev => [...prev.slice(-19), current.map(i => ({ ...i }))]);
    setRedoStack([]);
  };

  const undo = async () => {
    if (undoStack.length === 0) return;
    const prev = undoStack[undoStack.length - 1];
    setRedoStack(r => [...r, layoutItems.map(i => ({ ...i }))]);
    setUndoStack(u => u.slice(0, -1));
    setLayoutItems(prev);
    // Persist all items
    await Promise.all(prev.map(item =>
      supabase.from('ui_layout' as any).update({
        visible: item.visible,
        position: item.position,
        sort_order: item.sort_order,
      } as any).eq('id', item.id)
    ));
    toast('Undone');
  };

  const redo = async () => {
    if (redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    setUndoStack(u => [...u, layoutItems.map(i => ({ ...i }))]);
    setRedoStack(r => r.slice(0, -1));
    setLayoutItems(next);
    await Promise.all(next.map(item =>
      supabase.from('ui_layout' as any).update({
        visible: item.visible,
        position: item.position,
        sort_order: item.sort_order,
      } as any).eq('id', item.id)
    ));
    toast('Redone');
  };

  useEffect(() => {
    if (!user) return;
    const checkAdmin = async () => {
      const { data } = await supabase
        .from('user_roles' as any)
        .select('role')
        .eq('user_id', user.id)
        .eq('role', 'admin');
      setIsAdmin(Array.isArray(data) && data.length > 0);
    };
    checkAdmin();
  }, [user]);

  useEffect(() => {
    if (!isAdmin) return;

    if (tab === 'users') {
      supabase.from('profiles').select('*').order('created_at', { ascending: false })
        .then(({ data }) => { if (data) setUsers(data as any); });
    }

    if (tab === 'posts') {
      supabase.from('requests').select('*, profiles!requests_user_id_profiles_fkey(full_name)')
        .order('created_at', { ascending: false })
        .then(({ data }) => { if (data) setPosts(data as any); });
    }

    if (tab === 'chats') {
      const fetchChats = async () => {
        const { data: convos } = await supabase
          .from('conversations')
          .select('*')
          .order('created_at', { ascending: false });
        if (!convos) return;
        const enriched = await Promise.all(convos.map(async (c: any) => {
          const [buyerRes, sellerRes, msgRes] = await Promise.all([
            supabase.from('profiles').select('full_name').eq('user_id', c.buyer_id).single(),
            supabase.from('profiles').select('full_name').eq('user_id', c.seller_id).single(),
            supabase.from('messages').select('content', { count: 'exact' })
              .eq('conversation_id', c.id)
              .order('created_at', { ascending: false })
              .limit(1),
          ]);
          return {
            ...c,
            buyer_profile: buyerRes.data,
            seller_profile: sellerRes.data,
            last_message: msgRes.data?.[0]?.content || '',
            message_count: msgRes.count || 0,
          };
        }));
        setConversations(enriched);
      };
      fetchChats();
    }

    if (tab === 'study') {
      const fetchStudy = async () => {
        const { data: configs } = await supabase.from('study_config').select('*').limit(1);
        if (configs && configs.length > 0) {
          const cfg = configs[0] as any;
          setStudyConfig(cfg);
          setSemesterLabel(cfg.semester_label);
          const { data: subs } = await supabase
            .from('study_subjects')
            .select('*')
            .eq('config_id', cfg.id)
            .order('sort_order', { ascending: true });
          if (subs) setStudySubjects(subs as any);
        }
      };
      fetchStudy();
    }

    if (tab === 'design') {
      supabase.from('ui_layout' as any).select('*').order('sort_order', { ascending: true })
        .then(({ data }) => {
          if (data) {
            setLayoutItems(data as any);
            setUndoStack([]);
            setRedoStack([]);
          }
        });
    }

    if (tab === 'analytics') {
      const fetchAnalytics = async () => {
        // Live = active in last 5 minutes
        const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
        const { count } = await supabase
          .from('user_presence' as any)
          .select('user_id', { count: 'exact', head: true })
          .gte('last_seen', fiveMinAgo);
        setLiveCount(count ?? 0);

        const ranges = { '3h': 3, '6h': 6, '1d': 24, '7d': 24 * 7 };
        const hours = ranges[activityRange];
        const since = new Date(Date.now() - hours * 3_600_000).toISOString();
        const { data: presence } = await supabase
          .from('user_presence' as any)
          .select('user_id, last_seen')
          .gte('last_seen', since);

        // Bucket by hour (or by day for 7d)
        const useDayBucket = activityRange === '7d';
        const buckets: Record<string, Set<string>> = {};
        const now = Date.now();
        const bucketCount = useDayBucket ? 7 : hours;
        for (let i = bucketCount - 1; i >= 0; i--) {
          const t = new Date(now - i * (useDayBucket ? 86_400_000 : 3_600_000));
          const key = useDayBucket ? t.toISOString().slice(0, 10) : t.toISOString().slice(0, 13);
          buckets[key] = new Set();
        }
        (presence as any[] | null)?.forEach(p => {
          const t = new Date(p.last_seen);
          const key = useDayBucket ? t.toISOString().slice(0, 10) : t.toISOString().slice(0, 13);
          if (buckets[key]) buckets[key].add(p.user_id);
        });
        const labelFor = (k: string) => useDayBucket ? k.slice(5) : k.slice(11) + ':00';
        setActivityData(Object.entries(buckets).map(([k, set]) => ({ time: labelFor(k), users: set.size })));
      };
      fetchAnalytics();
      const interval = setInterval(fetchAnalytics, 30_000);
      return () => clearInterval(interval);
    }
  }, [isAdmin, tab, activityRange]);

  useEffect(() => {
    if (!selectedChat) return;
    supabase.from('messages').select('*')
      .eq('conversation_id', selectedChat)
      .order('created_at', { ascending: true })
      .then(async ({ data }) => {
        if (!data) return;
        const senderIds = [...new Set(data.map(m => m.sender_id))];
        const { data: profiles } = await supabase.from('profiles').select('user_id, full_name').in('user_id', senderIds);
        const nameMap: Record<string, string> = {};
        profiles?.forEach((p: any) => { nameMap[p.user_id] = p.full_name || 'Unknown'; });
        setChatMessages(data.map(m => ({ ...m, sender_name: nameMap[m.sender_id] || 'Unknown' })));
      });
  }, [selectedChat]);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="animate-spin w-8 h-8 border-2 border-border border-t-transparent rounded-full" />
    </div>
  );
  if (!user) return <Navigate to="/login" replace />;
  if (isAdmin === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin w-8 h-8 border-2 border-border border-t-transparent rounded-full" />
      </div>
    );
  }
  if (!isAdmin) return <Navigate to="/marketplace" replace />;

  const deletePost = async (id: string) => {
    await supabase.from('requests').delete().eq('id', id);
    setPosts(prev => prev.filter(p => p.id !== id));
  };

  const toggleBan = async (u: UserProfile) => {
    const newBanned = !u.banned;
    await supabase.from('profiles').update({ banned: newBanned } as any).eq('user_id', u.user_id);
    setUsers(prev => prev.map(p => p.user_id === u.user_id ? { ...p, banned: newBanned } : p));
    toast(newBanned ? `${u.full_name || 'User'} banned` : `${u.full_name || 'User'} unbanned`);
  };

  const saveStudyConfig = async () => {
    if (!studyConfig) return;
    setStudySaving(true);
    await supabase.from('study_config').update({
      semester_label: semesterLabel,
    } as any).eq('id', studyConfig.id);
    setStudySaving(false);
  };

  const addSubject = async () => {
    if (!studyConfig || !newSubject.name.trim()) return;
    const { data } = await supabase.from('study_subjects').insert({
      config_id: studyConfig.id,
      name: newSubject.name,
      notes_url: newSubject.notes_url,
      papers_url: newSubject.papers_url,
      sort_order: studySubjects.length,
    } as any).select();
    if (data) {
      setStudySubjects(prev => [...prev, ...(data as any)]);
      setNewSubject({ name: '', notes_url: '', papers_url: '' });
    }
  };

  const deleteSubject = async (id: string) => {
    await supabase.from('study_subjects').delete().eq('id', id);
    setStudySubjects(prev => prev.filter(s => s.id !== id));
  };

  const updateSubject = async (id: string, field: string, value: string) => {
    await supabase.from('study_subjects').update({ [field]: value } as any).eq('id', id);
    setStudySubjects(prev => prev.map(s => s.id === id ? { ...s, [field]: value } : s));
  };

  const saveNotes = async (id: string) => {
    await supabase.from('study_subjects').update({ notes_content: notesText } as any).eq('id', id);
    setStudySubjects(prev => prev.map(s => s.id === id ? { ...s, notes_content: notesText } : s));
    setEditingNotes(null);
    setNotesText('');
  };

  const toggleVisibility = async (item: LayoutItem) => {
    pushUndo(layoutItems);
    const newVal = !item.visible;
    await supabase.from('ui_layout' as any).update({ visible: newVal } as any).eq('id', item.id);
    setLayoutItems(prev => prev.map(i => i.id === item.id ? { ...i, visible: newVal } : i));
  };

  const swapPosition = async (item: LayoutItem) => {
    pushUndo(layoutItems);
    const newPos = item.position === 'bottom' ? 'header' : 'bottom';
    await supabase.from('ui_layout' as any).update({ position: newPos } as any).eq('id', item.id);
    setLayoutItems(prev => prev.map(i => i.id === item.id ? { ...i, position: newPos as any } : i));
  };

  const moveOrder = async (item: LayoutItem, direction: 'up' | 'down') => {
    pushUndo(layoutItems);
    const group = layoutItems.filter(i => i.position === item.position).sort((a, b) => a.sort_order - b.sort_order);
    const idx = group.findIndex(i => i.id === item.id);
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= group.length) return;
    const other = group[swapIdx];
    await Promise.all([
      supabase.from('ui_layout' as any).update({ sort_order: other.sort_order } as any).eq('id', item.id),
      supabase.from('ui_layout' as any).update({ sort_order: item.sort_order } as any).eq('id', other.id),
    ]);
    setLayoutItems(prev => prev.map(i => {
      if (i.id === item.id) return { ...i, sort_order: other.sort_order };
      if (i.id === other.id) return { ...i, sort_order: item.sort_order };
      return i;
    }));
  };

  const tabs: { key: Tab; label: string; icon: any }[] = [
    { key: 'users', label: 'Users', icon: Users },
    { key: 'posts', label: 'Posts', icon: FileText },
    { key: 'chats', label: 'Chats', icon: MessageSquare },
    { key: 'study', label: 'Study', icon: BookOpen },
    { key: 'design', label: 'Design', icon: Palette },
    { key: 'analytics', label: 'Analytics', icon: BarChart3 },
    { key: 'homepage', label: 'Homepage', icon: LayoutIcon },
  ];

  const saveHomepage = async () => {
    setSavingHomepage(true);
    const errs = await Promise.all([
      updateAppSetting('hero', heroDraft),
      updateAppSetting('announcement', announcementDraft),
      updateAppSetting('faq', { ...settings.faq, items: faqDraft }),
      updateAppSetting('damu_daily_limit', { limit: Math.max(1, limitDraft) }),
    ]);
    setSavingHomepage(false);
    if (errs.some(Boolean)) toast.error('Some changes failed to save');
    else toast.success('Homepage saved');
    reloadSettings();
  };

  const toggleFeature = async (key: keyof typeof settings.feature_toggles) => {
    const next = { ...settings.feature_toggles, [key]: !settings.feature_toggles[key] };
    await updateAppSetting('feature_toggles', next);
    reloadSettings();
  };

  return (
    <div className="min-h-[100dvh] bg-background pb-[calc(4rem+env(safe-area-inset-bottom))]">
      <div className="px-5 pt-[max(1.5rem,env(safe-area-inset-top))] pb-4">
        <h1 className="text-[28px] font-bold text-foreground tracking-tight mb-4">Admin</h1>
        <div className="flex gap-2 overflow-x-auto no-scrollbar">
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => { setTab(t.key); setSelectedChat(null); }}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold transition-all whitespace-nowrap ${
                tab === t.key ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground'
              }`}
            >
              <t.icon className="w-3.5 h-3.5" />
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="px-5 space-y-3 max-w-2xl mx-auto">
        {/* Users Tab */}
        {tab === 'users' && (
          <p className="text-sm text-muted-foreground">Total: {users.length} users</p>
        )}

        {tab === 'users' && users.map(u => (
          <div key={u.user_id} className={`p-4 rounded-2xl bg-card flex items-center gap-3 ${u.banned ? 'opacity-50' : ''}`}>
            {u.avatar_url ? (
              <img src={u.avatar_url} alt="" className="w-12 h-12 rounded-full object-cover shrink-0" />
            ) : (
              <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center text-sm font-bold text-secondary-foreground shrink-0">
                {u.full_name?.[0]?.toUpperCase() || '?'}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="font-bold text-[15px] text-foreground truncate">{u.full_name || 'No name'}</p>
                {u.banned && <span className="text-[10px] font-bold text-red-400 bg-red-400/10 px-2 py-0.5 rounded-full">Banned</span>}
              </div>
              <p className="text-xs text-muted-foreground">
                {u.mode && <span className="capitalize">{u.mode} • </span>}
                Joined {formatDistanceToNow(new Date(u.created_at), { addSuffix: true })}
              </p>
            </div>
            <button
              onClick={() => toggleBan(u)}
              className={`p-2 rounded-xl transition-all active:scale-95 ${
                u.banned ? 'bg-green-500/10 text-green-400' : 'bg-red-400/10 text-red-400'
              }`}
              title={u.banned ? 'Unban' : 'Ban'}
            >
              {u.banned ? <CheckCircle className="w-4 h-4" /> : <Ban className="w-4 h-4" />}
            </button>
          </div>
        ))}

        {/* Posts Tab */}
        {tab === 'posts' && posts.map(p => (
          <div key={p.id} className="p-4 rounded-2xl bg-card space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h3 className="font-bold text-[15px] text-foreground truncate">{p.title}</h3>
                <p className="text-xs text-muted-foreground">
                  {p.subject} • ₹{p.budget} • {p.pages || '—'} pages
                </p>
                <p className="text-xs text-muted-foreground">
                  By {p.profiles?.full_name || 'Unknown'} • {formatDistanceToNow(new Date(p.created_at), { addSuffix: true })}
                </p>
              </div>
              <button
                onClick={() => deletePost(p.id)}
                className="flex items-center gap-1 h-8 px-3 rounded-lg bg-red-400/10 text-red-400 text-xs font-bold active:scale-95 transition-transform shrink-0"
              >
                <Trash2 className="w-3 h-3" />
                Delete
              </button>
            </div>
          </div>
        ))}

        {/* Chats Tab */}
        {tab === 'chats' && !selectedChat && conversations.map(c => (
          <button
            key={c.id}
            onClick={() => setSelectedChat(c.id)}
            className="w-full text-left p-4 rounded-2xl bg-card space-y-1 active:scale-[0.98] transition-transform"
          >
            <div className="flex items-center justify-between">
              <p className="font-bold text-sm text-foreground">
                {c.buyer_profile?.full_name || 'Unknown'} ↔ {c.seller_profile?.full_name || 'Unknown'}
              </p>
              <span className="text-[10px] text-muted-foreground">{c.message_count} msgs</span>
            </div>
            {c.last_message && (
              <p className="text-xs text-muted-foreground truncate">{c.last_message}</p>
            )}
          </button>
        ))}

        {tab === 'chats' && selectedChat && (
          <div className="space-y-3">
            <button onClick={() => setSelectedChat(null)} className="flex items-center gap-1 text-sm text-secondary-foreground font-bold">
              <ChevronLeft className="w-4 h-4" /> Back to chats
            </button>
            <div className="space-y-2">
              {chatMessages.map(m => (
                <div key={m.id} className="p-3 rounded-2xl bg-card">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-xs font-bold text-foreground">{m.sender_name}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {formatDistanceToNow(new Date(m.created_at), { addSuffix: true })}
                    </p>
                  </div>
                  <p className="text-sm text-secondary-foreground">{m.content}</p>
                </div>
              ))}
              {chatMessages.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-8">No messages</p>
              )}
            </div>
          </div>
        )}

        {/* Study Tab */}
        {tab === 'study' && (
          <div className="space-y-4">
            <div className="p-4 rounded-2xl bg-card space-y-3">
              <h3 className="font-bold text-sm text-foreground">Semester Settings</h3>
              <input
                value={semesterLabel}
                onChange={e => setSemesterLabel(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-secondary text-sm text-foreground border-none outline-none"
                placeholder="e.g. S1, S2"
              />
              <button
                onClick={saveStudyConfig}
                disabled={studySaving}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold"
              >
                <Save className="w-3.5 h-3.5" />
                {studySaving ? 'Saving...' : 'Save Settings'}
              </button>
            </div>

            <div className="p-4 rounded-2xl bg-card space-y-3">
              <h3 className="font-bold text-sm text-foreground">Subjects</h3>
              {studySubjects.map(s => (
                <div key={s.id} className="p-3 rounded-xl bg-secondary space-y-2">
                  <div className="flex items-center justify-between">
                    <input
                      defaultValue={s.name}
                      onBlur={e => updateSubject(s.id, 'name', e.target.value)}
                      className="font-bold text-sm text-foreground bg-transparent border-none outline-none flex-1"
                    />
                    <button onClick={() => deleteSubject(s.id)} className="text-red-400 p-1">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <input
                    defaultValue={s.notes_url}
                    onBlur={e => updateSubject(s.id, 'notes_url', e.target.value)}
                    className="w-full px-2 py-1 rounded-lg bg-card text-xs text-foreground border-none outline-none"
                    placeholder="Notes URL (optional)"
                  />
                  <input
                    defaultValue={s.papers_url}
                    onBlur={e => updateSubject(s.id, 'papers_url', e.target.value)}
                    className="w-full px-2 py-1 rounded-lg bg-card text-xs text-foreground border-none outline-none"
                    placeholder="Papers URL"
                  />

                  {/* Notes Content Editor */}
                  <div className="space-y-1.5 pt-2 border-t border-border">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Written Notes (HTML)</label>
                      {editingNotes !== s.id ? (
                        <button
                          onClick={() => { setEditingNotes(s.id); setNotesText(s.notes_content || ''); }}
                          className="text-[10px] text-secondary-foreground font-bold px-2 py-0.5 rounded-lg bg-accent"
                        >
                          {s.notes_content ? 'Edit' : 'Write Notes'}
                        </button>
                      ) : (
                        <div className="flex gap-1">
                          <button
                            onClick={() => saveNotes(s.id)}
                            className="text-[10px] text-primary-foreground font-bold px-2 py-0.5 rounded-lg bg-primary"
                          >
                            Save
                          </button>
                          <button
                            onClick={() => { setEditingNotes(null); setNotesText(''); }}
                            className="text-[10px] text-secondary-foreground font-bold px-2 py-0.5 rounded-lg bg-accent"
                          >
                            Cancel
                          </button>
                        </div>
                      )}
                    </div>
                    {editingNotes === s.id ? (
                      <div className="space-y-1">
                        <textarea
                          value={notesText}
                          onChange={e => setNotesText(e.target.value)}
                          rows={12}
                          className="w-full px-3 py-2 rounded-xl bg-card text-sm text-foreground font-mono resize-y border-none outline-none"
                          placeholder={"Paste or write HTML content here.\n\nYou can use:\n<h1>Title</h1>\n<p>Paragraph text</p>\n<ul><li>List item</li></ul>\n<strong>Bold</strong>\n<em>Italic</em>\n\nOr use markdown-like syntax:\n# Heading\n**bold** *italic*\n- bullet points"}
                        />
                        <p className="text-[9px] text-muted-foreground">Supports HTML tags and markdown-like syntax</p>
                      </div>
                    ) : s.notes_content ? (
                      <p className="text-[10px] text-muted-foreground line-clamp-2">{s.notes_content.slice(0, 100)}...</p>
                    ) : null}
                  </div>
                </div>
              ))}

              {/* Add new */}
              <div className="p-3 rounded-xl border border-dashed border-border space-y-2">
                <input
                  value={newSubject.name}
                  onChange={e => setNewSubject(p => ({ ...p, name: e.target.value }))}
                  className="w-full px-2 py-1.5 rounded-xl bg-secondary text-sm text-foreground border-none outline-none"
                  placeholder="Subject name"
                />
                <input
                  value={newSubject.notes_url}
                  onChange={e => setNewSubject(p => ({ ...p, notes_url: e.target.value }))}
                  className="w-full px-2 py-1 rounded-xl bg-secondary text-xs text-foreground border-none outline-none"
                  placeholder="Notes URL (optional)"
                />
                <input
                  value={newSubject.papers_url}
                  onChange={e => setNewSubject(p => ({ ...p, papers_url: e.target.value }))}
                  className="w-full px-2 py-1 rounded-xl bg-secondary text-xs text-foreground border-none outline-none"
                  placeholder="Papers URL"
                />
                <button
                  onClick={addSubject}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary text-primary-foreground text-xs font-bold"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Subject
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Design Tab */}
        {tab === 'design' && (
          <div className="space-y-4">
            {/* Undo/Redo bar */}
            <div className="flex items-center gap-2">
              <button
                onClick={undo}
                disabled={undoStack.length === 0}
                className="px-3 py-1.5 rounded-xl bg-secondary text-secondary-foreground text-xs font-bold disabled:opacity-30"
              >
                ↩ Undo
              </button>
              <button
                onClick={redo}
                disabled={redoStack.length === 0}
                className="px-3 py-1.5 rounded-xl bg-secondary text-secondary-foreground text-xs font-bold disabled:opacity-30"
              >
                ↪ Redo
              </button>
            </div>

            {['bottom', 'header'].map(pos => {
              const group = layoutItems.filter(i => i.position === pos).sort((a, b) => a.sort_order - b.sort_order);
              return (
                <div key={pos} className="p-4 rounded-2xl bg-card space-y-3">
                  <h3 className="font-bold text-sm text-foreground capitalize">
                    {pos === 'bottom' ? 'Bottom Navigation' : 'Top-Right Header'}
                  </h3>
                  {group.map((item, idx) => (
                    <div key={item.id} className="flex items-center gap-2 p-3 rounded-xl bg-secondary">
                      <span className={`text-sm font-bold flex-1 ${item.visible ? 'text-foreground' : 'text-muted-foreground line-through'}`}>
                        {item.label}
                      </span>
                      <button onClick={() => moveOrder(item, 'up')} disabled={idx === 0}
                        className="p-1.5 rounded-lg bg-accent text-secondary-foreground disabled:opacity-30">
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => moveOrder(item, 'down')} disabled={idx === group.length - 1}
                        className="p-1.5 rounded-lg bg-accent text-secondary-foreground disabled:opacity-30">
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => swapPosition(item)}
                        className="px-2 py-1 rounded-lg bg-accent text-[10px] font-bold text-secondary-foreground">
                        → {pos === 'bottom' ? 'Header' : 'Bottom'}
                      </button>
                      <button onClick={() => toggleVisibility(item)}
                        className={`p-1.5 rounded-lg ${item.visible ? 'bg-primary text-primary-foreground' : 'bg-accent text-muted-foreground'}`}>
                        {item.visible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  ))}
                  {group.length === 0 && <p className="text-xs text-muted-foreground">No items here</p>}
                </div>
              );
            })}
          </div>
        )}

        {/* Analytics Tab */}
        {tab === 'analytics' && (
          <div className="space-y-4">
            <div className="p-5 rounded-2xl bg-card">
              <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Live now</p>
              <p className="text-4xl font-bold text-foreground mt-1 flex items-center gap-2">
                <span className="inline-block w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse" />
                {liveCount}
              </p>
              <p className="text-xs text-muted-foreground mt-1">Active in the last 5 minutes</p>
            </div>

            <div className="p-4 rounded-2xl bg-card space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-sm text-foreground">User activity</h3>
                <div className="flex gap-1">
                  {(['3h', '6h', '1d', '7d'] as const).map(r => (
                    <button
                      key={r}
                      onClick={() => setActivityRange(r)}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase ${activityRange === r ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground'}`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>
              <div className="h-56 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={activityData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="time" stroke="hsl(var(--muted-foreground))" fontSize={10} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={10} allowDecimals={false} />
                    <Tooltip
                      contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 12, fontSize: 12 }}
                      labelStyle={{ color: 'hsl(var(--foreground))' }}
                    />
                    <Line type="monotone" dataKey="users" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}

        {/* Homepage Tab */}
        {tab === 'homepage' && (
          <div className="space-y-4">
            {/* Feature toggles */}
            <div className="p-4 rounded-2xl bg-card space-y-3">
              <h3 className="font-bold text-sm text-foreground">Feature visibility</h3>
              {([
                ['chatbot', 'Damu Chatbot (floating)'],
                ['faq', 'FAQ on home page'],
                ['landing_faq', 'FAQ on login/landing page'],
                ['notes_upload', 'My Notes upload page'],
                ['announcement', 'Announcement banner'],
              ] as const).map(([k, lbl]) => (
                <label key={k} className="flex items-center justify-between gap-3 p-3 rounded-xl bg-secondary cursor-pointer">
                  <span className="text-sm text-foreground font-bold">{lbl}</span>
                  <input
                    type="checkbox"
                    checked={!!settings.feature_toggles?.[k]}
                    onChange={() => toggleFeature(k)}
                    className="w-5 h-5 accent-primary"
                  />
                </label>
              ))}
            </div>

            {/* Hero */}
            <div className="p-4 rounded-2xl bg-card space-y-3">
              <h3 className="font-bold text-sm text-foreground">Hero (login screen)</h3>
              <input
                value={heroDraft?.title ?? ''}
                onChange={e => setHeroDraft(prev => ({ ...prev, title: e.target.value }))}
                placeholder="Hero title"
                className="w-full px-3 py-2 rounded-xl bg-secondary text-sm text-foreground border-none outline-none"
              />
              <textarea
                value={heroDraft?.subtitle ?? ''}
                onChange={e => setHeroDraft(prev => ({ ...prev, subtitle: e.target.value }))}
                placeholder="Hero subtitle"
                rows={2}
                className="w-full px-3 py-2 rounded-xl bg-secondary text-sm text-foreground border-none outline-none resize-y"
              />
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                <input
                  type="checkbox"
                  checked={!!heroDraft?.enabled}
                  onChange={e => setHeroDraft(prev => ({ ...prev, enabled: e.target.checked }))}
                />
                Show on login screen
              </label>
            </div>

            {/* Announcement */}
            <div className="p-4 rounded-2xl bg-card space-y-3">
              <h3 className="font-bold text-sm text-foreground">Announcement banner</h3>
              <textarea
                value={announcementDraft?.text ?? ''}
                onChange={e => setAnnouncementDraft(prev => ({ ...prev, text: e.target.value }))}
                placeholder="Short announcement text"
                rows={2}
                className="w-full px-3 py-2 rounded-xl bg-secondary text-sm text-foreground border-none outline-none resize-y"
              />
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                <input
                  type="checkbox"
                  checked={!!announcementDraft?.enabled}
                  onChange={e => setAnnouncementDraft(prev => ({ ...prev, enabled: e.target.checked }))}
                />
                Enable announcement
              </label>
            </div>

            {/* FAQ */}
            <div className="p-4 rounded-2xl bg-card space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-sm text-foreground">FAQ items</h3>
                <button
                  onClick={() => setFaqDraft(prev => [...prev, { q: '', a: '' }])}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-primary text-primary-foreground text-xs font-bold"
                >
                  <Plus className="w-3.5 h-3.5" /> Add
                </button>
              </div>
              {faqDraft.map((item, i) => (
                <div key={i} className="p-3 rounded-xl bg-secondary space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest">Q{i + 1}</span>
                    <button
                      onClick={() => setFaqDraft(prev => prev.filter((_, j) => j !== i))}
                      className="ml-auto p-1 rounded-lg text-red-400"
                      aria-label="Remove"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <input
                    value={item.q}
                    onChange={e => setFaqDraft(prev => prev.map((x, j) => j === i ? { ...x, q: e.target.value } : x))}
                    placeholder="Question"
                    className="w-full px-3 py-2 rounded-xl bg-card text-sm text-foreground border-none outline-none"
                  />
                  <textarea
                    value={item.a}
                    onChange={e => setFaqDraft(prev => prev.map((x, j) => j === i ? { ...x, a: e.target.value } : x))}
                    placeholder="Answer"
                    rows={3}
                    className="w-full px-3 py-2 rounded-xl bg-card text-sm text-foreground border-none outline-none resize-y"
                  />
                </div>
              ))}
              {faqDraft.length === 0 && <p className="text-xs text-muted-foreground">No FAQ items yet</p>}
            </div>

            {/* Damu daily limit */}
            <div className="p-4 rounded-2xl bg-card space-y-3">
              <h3 className="font-bold text-sm text-foreground">Damu chatbot daily limit</h3>
              <p className="text-xs text-muted-foreground">Per user, per UTC day. Users see a cooldown timer when this is exceeded.</p>
              <input
                type="number"
                min={1}
                value={limitDraft}
                onChange={e => setLimitDraft(parseInt(e.target.value || '0', 10))}
                className="w-32 px-3 py-2 rounded-xl bg-secondary text-sm text-foreground border-none outline-none"
              />
            </div>

            <button
              onClick={saveHomepage}
              disabled={savingHomepage}
              className="w-full h-12 rounded-2xl bg-primary text-primary-foreground font-bold text-sm active:scale-[0.98] disabled:opacity-50 sticky bottom-[calc(4rem+env(safe-area-inset-bottom)+0.5rem)]"
            >
              {savingHomepage ? 'Saving…' : 'Save Homepage Settings'}
            </button>
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  );
}
