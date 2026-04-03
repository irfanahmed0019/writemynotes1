import { useAuth } from '@/lib/auth';
import { Navigate, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useEffect, useState } from 'react';
import { Users, MessageSquare, FileText, Trash2, Eye, ChevronLeft, BookOpen, Plus, Save, Palette, ArrowUp, ArrowDown, EyeOff } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import BottomNav from '@/components/BottomNav';
import type { LayoutItem } from '@/hooks/use-ui-layout';

type UserProfile = {
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
  mode: string | null;
  bio: string | null;
  created_at: string;
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

type Tab = 'users' | 'posts' | 'chats' | 'study' | 'design';

export default function AdminDashboard() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [tab, setTab] = useState<Tab>('users');
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
  const [layoutItems, setLayoutItems] = useState<LayoutItem[]>([]);

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
        .then(({ data }) => { if (data) setLayoutItems(data as any); });
    }
  }, [isAdmin, tab]);

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
    <div className="min-h-screen flex items-center justify-center bg-black">
      <div className="animate-spin w-8 h-8 border-2 border-[#333] border-t-transparent rounded-full" />
    </div>
  );
  if (!user) return <Navigate to="/login" replace />;
  if (isAdmin === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="animate-spin w-8 h-8 border-2 border-[#333] border-t-transparent rounded-full" />
      </div>
    );
  }
  if (!isAdmin) return <Navigate to="/marketplace" replace />;

  const deletePost = async (id: string) => {
    await supabase.from('requests').delete().eq('id', id);
    setPosts(prev => prev.filter(p => p.id !== id));
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

  const tabs: { key: Tab; label: string; icon: any }[] = [
    { key: 'users', label: 'Users', icon: Users },
    { key: 'posts', label: 'Posts', icon: FileText },
    { key: 'chats', label: 'Chats', icon: MessageSquare },
    { key: 'study', label: 'Study', icon: BookOpen },
  ];

  return (
    <div className="min-h-screen bg-black pb-20">
      <div className="px-5 pt-6 pb-4">
        <h1 className="text-[28px] font-bold text-white tracking-tight mb-4">Admin Dashboard</h1>
        <div className="flex gap-2 overflow-x-auto no-scrollbar">
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => { setTab(t.key); setSelectedChat(null); }}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold transition-all whitespace-nowrap ${
                tab === t.key ? 'bg-white text-black' : 'bg-[#1a1a1a] text-[#888]'
              }`}
            >
              <t.icon className="w-3.5 h-3.5" />
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="px-5 space-y-3 max-w-2xl mx-auto">
        {/* Users count */}
        {tab === 'users' && (
          <p className="text-sm text-[#666]">Total: {users.length} users</p>
        )}

        {/* Users Tab */}
        {tab === 'users' && users.map(u => (
          <div key={u.user_id} className="p-4 rounded-2xl bg-[#111] flex items-center gap-3">
            {u.avatar_url ? (
              <img src={u.avatar_url} alt="" className="w-12 h-12 rounded-full object-cover shrink-0" />
            ) : (
              <div className="w-12 h-12 rounded-full bg-[#1a1a1a] flex items-center justify-center text-sm font-bold text-[#888] shrink-0">
                {u.full_name?.[0]?.toUpperCase() || '?'}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="font-bold text-[15px] text-white truncate">{u.full_name || 'No name'}</p>
              <p className="text-xs text-[#666]">
                {u.mode && <span className="capitalize">{u.mode} • </span>}
                Joined {formatDistanceToNow(new Date(u.created_at), { addSuffix: true })}
              </p>
            </div>
          </div>
        ))}

        {/* Posts Tab */}
        {tab === 'posts' && posts.map(p => (
          <div key={p.id} className="p-4 rounded-2xl bg-[#111] space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h3 className="font-bold text-[15px] text-white truncate">{p.title}</h3>
                <p className="text-xs text-[#666]">
                  {p.subject} • ₹{p.budget} • {p.pages || '—'} pages
                </p>
                <p className="text-xs text-[#555]">
                  By {p.profiles?.full_name || 'Unknown'} • {formatDistanceToNow(new Date(p.created_at), { addSuffix: true })}
                </p>
              </div>
              <button
                onClick={() => deletePost(p.id)}
                className="flex items-center gap-1 h-8 px-3 rounded-lg bg-[#1a1a1a] text-red-400 text-xs font-bold active:scale-95 transition-transform shrink-0"
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
            className="w-full text-left p-4 rounded-2xl bg-[#111] space-y-1 active:scale-[0.98] transition-transform"
          >
            <div className="flex items-center justify-between">
              <p className="font-bold text-sm text-white">
                {c.buyer_profile?.full_name || 'Unknown'} ↔ {c.seller_profile?.full_name || 'Unknown'}
              </p>
              <span className="text-[10px] text-[#555]">{c.message_count} msgs</span>
            </div>
            {c.last_message && (
              <p className="text-xs text-[#666] truncate">{c.last_message}</p>
            )}
          </button>
        ))}

        {tab === 'chats' && selectedChat && (
          <div className="space-y-3">
            <button onClick={() => setSelectedChat(null)} className="flex items-center gap-1 text-sm text-[#888] font-bold">
              <ChevronLeft className="w-4 h-4" /> Back to chats
            </button>
            <div className="space-y-2">
              {chatMessages.map(m => (
                <div key={m.id} className="p-3 rounded-2xl bg-[#111]">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-xs font-bold text-white">{m.sender_name}</p>
                    <p className="text-[10px] text-[#555]">
                      {formatDistanceToNow(new Date(m.created_at), { addSuffix: true })}
                    </p>
                  </div>
                  <p className="text-sm text-[#aaa]">{m.content}</p>
                </div>
              ))}
              {chatMessages.length === 0 && (
                <p className="text-sm text-[#555] text-center py-8">No messages</p>
              )}
            </div>
          </div>
        )}

        {/* Study Tab */}
        {tab === 'study' && (
          <div className="space-y-4">
            <div className="p-4 rounded-2xl bg-[#111] space-y-3">
              <h3 className="font-bold text-sm text-white">Semester Settings</h3>
              <input
                value={semesterLabel}
                onChange={e => setSemesterLabel(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-[#1a1a1a] text-sm text-white border-none outline-none"
                placeholder="e.g. S1, S2"
              />
              <button
                onClick={saveStudyConfig}
                disabled={studySaving}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white text-black text-xs font-bold"
              >
                <Save className="w-3.5 h-3.5" />
                {studySaving ? 'Saving...' : 'Save Settings'}
              </button>
            </div>

            <div className="p-4 rounded-2xl bg-[#111] space-y-3">
              <h3 className="font-bold text-sm text-white">Subjects</h3>
              {studySubjects.map(s => (
                <div key={s.id} className="p-3 rounded-xl bg-[#1a1a1a] space-y-2">
                  <div className="flex items-center justify-between">
                    <input
                      defaultValue={s.name}
                      onBlur={e => updateSubject(s.id, 'name', e.target.value)}
                      className="font-bold text-sm text-white bg-transparent border-none outline-none flex-1"
                    />
                    <button onClick={() => deleteSubject(s.id)} className="text-red-400 p-1">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <input
                    defaultValue={s.notes_url}
                    onBlur={e => updateSubject(s.id, 'notes_url', e.target.value)}
                    className="w-full px-2 py-1 rounded-lg bg-[#111] text-xs text-white border-none outline-none"
                    placeholder="Notes URL (optional)"
                  />
                  <input
                    defaultValue={s.papers_url}
                    onBlur={e => updateSubject(s.id, 'papers_url', e.target.value)}
                    className="w-full px-2 py-1 rounded-lg bg-[#111] text-xs text-white border-none outline-none"
                    placeholder="Papers URL"
                  />

                  {/* Notes Content Editor */}
                  <div className="space-y-1.5 pt-2 border-t border-[#222]">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] text-[#666] font-bold uppercase tracking-wider">Written Notes (HTML)</label>
                      {editingNotes !== s.id ? (
                        <button
                          onClick={() => { setEditingNotes(s.id); setNotesText(s.notes_content || ''); }}
                          className="text-[10px] text-[#888] font-bold px-2 py-0.5 rounded-lg bg-[#222]"
                        >
                          {s.notes_content ? 'Edit' : 'Write Notes'}
                        </button>
                      ) : (
                        <div className="flex gap-1">
                          <button
                            onClick={() => saveNotes(s.id)}
                            className="text-[10px] text-black font-bold px-2 py-0.5 rounded-lg bg-white"
                          >
                            Save
                          </button>
                          <button
                            onClick={() => { setEditingNotes(null); setNotesText(''); }}
                            className="text-[10px] text-[#888] font-bold px-2 py-0.5 rounded-lg bg-[#222]"
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
                          className="w-full px-3 py-2 rounded-xl bg-[#111] text-sm text-white font-mono resize-y border-none outline-none"
                          placeholder={"Paste or write HTML content here.\n\nYou can use:\n<h1>Title</h1>\n<p>Paragraph text</p>\n<ul><li>List item</li></ul>\n<strong>Bold</strong>\n<em>Italic</em>\n\nOr use markdown-like syntax:\n# Heading\n**bold** *italic*\n- bullet points"}
                        />
                        <p className="text-[9px] text-[#444]">Supports HTML tags and markdown-like syntax (# headers, **bold**, *italic*, - lists)</p>
                      </div>
                    ) : s.notes_content ? (
                      <p className="text-[10px] text-[#555] line-clamp-2">{s.notes_content.slice(0, 100)}...</p>
                    ) : null}
                  </div>
                </div>
              ))}

              {/* Add new */}
              <div className="p-3 rounded-xl border border-dashed border-[#333] space-y-2">
                <input
                  value={newSubject.name}
                  onChange={e => setNewSubject(p => ({ ...p, name: e.target.value }))}
                  className="w-full px-2 py-1.5 rounded-xl bg-[#1a1a1a] text-sm text-white border-none outline-none"
                  placeholder="Subject name"
                />
                <input
                  value={newSubject.notes_url}
                  onChange={e => setNewSubject(p => ({ ...p, notes_url: e.target.value }))}
                  className="w-full px-2 py-1 rounded-xl bg-[#1a1a1a] text-xs text-white border-none outline-none"
                  placeholder="Notes URL (optional)"
                />
                <input
                  value={newSubject.papers_url}
                  onChange={e => setNewSubject(p => ({ ...p, papers_url: e.target.value }))}
                  className="w-full px-2 py-1 rounded-xl bg-[#1a1a1a] text-xs text-white border-none outline-none"
                  placeholder="Papers URL"
                />
                <button
                  onClick={addSubject}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white text-black text-xs font-bold"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Subject
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  );
}
