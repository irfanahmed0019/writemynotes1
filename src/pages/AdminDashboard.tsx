import { useAuth } from '@/lib/auth';
import { Navigate, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useEffect, useState } from 'react';
import { Users, MessageSquare, FileText, Trash2, Eye, ChevronLeft, Shield } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

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

type Tab = 'users' | 'posts' | 'chats';

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

  // Check admin role
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

  // Fetch data based on tab
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
  }, [isAdmin, tab]);

  // View chat messages
  useEffect(() => {
    if (!selectedChat) return;
    supabase.from('messages').select('*')
      .eq('conversation_id', selectedChat)
      .order('created_at', { ascending: true })
      .then(async ({ data }) => {
        if (!data) return;
        // Enrich with sender names
        const senderIds = [...new Set(data.map(m => m.sender_id))];
        const { data: profiles } = await supabase.from('profiles').select('user_id, full_name').in('user_id', senderIds);
        const nameMap: Record<string, string> = {};
        profiles?.forEach((p: any) => { nameMap[p.user_id] = p.full_name || 'Unknown'; });
        setChatMessages(data.map(m => ({ ...m, sender_name: nameMap[m.sender_id] || 'Unknown' })));
      });
  }, [selectedChat]);

  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (isAdmin === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }
  if (!isAdmin) return <Navigate to="/marketplace" replace />;

  const deletePost = async (id: string) => {
    await supabase.from('requests').delete().eq('id', id);
    setPosts(prev => prev.filter(p => p.id !== id));
  };

  const tabs: { key: Tab; label: string; icon: any; count: number }[] = [
    { key: 'users', label: 'Users', icon: Users, count: users.length },
    { key: 'posts', label: 'Posts', icon: FileText, count: posts.length },
    { key: 'chats', label: 'Chats', icon: MessageSquare, count: conversations.length },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-xl border-b border-border px-4 pt-4 pb-3">
        <div className="flex items-center gap-3 mb-3">
          <button onClick={() => navigate('/marketplace')} className="p-1">
            <ChevronLeft className="w-5 h-5 text-foreground" />
          </button>
          <Shield className="w-5 h-5 text-primary" />
          <h1 className="text-xl font-bold text-foreground">Admin Dashboard</h1>
        </div>

        <div className="flex gap-2">
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => { setTab(t.key); setSelectedChat(null); }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                tab === t.key ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground'
              }`}
            >
              <t.icon className="w-3.5 h-3.5" />
              {t.label}
              {t.count > 0 && (
                <span className={`ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                  tab === t.key ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-muted text-muted-foreground'
                }`}>
                  {t.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 py-3 space-y-3 max-w-2xl mx-auto">
        {/* Users Tab */}
        {tab === 'users' && users.map(u => (
          <div key={u.user_id} className="p-4 rounded-xl bg-card border border-border space-y-2">
            <div className="flex items-center gap-3">
              {u.avatar_url ? (
                <img src={u.avatar_url} alt="" className="w-10 h-10 rounded-full object-cover" />
              ) : (
                <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center text-sm font-bold text-foreground">
                  {u.full_name?.[0]?.toUpperCase() || '?'}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm text-foreground truncate">{u.full_name || 'No name'}</p>
                <p className="text-xs text-muted-foreground">
                  {u.mode && <span className="capitalize">{u.mode} • </span>}
                  Joined {formatDistanceToNow(new Date(u.created_at), { addSuffix: true })}
                </p>
              </div>
              <button
                onClick={() => navigate(`/writer/${u.user_id}`)}
                className="flex items-center gap-1 h-8 px-3 rounded-lg bg-secondary text-foreground text-xs font-medium"
              >
                <Eye className="w-3 h-3" />
                View
              </button>
            </div>
            {u.bio && <p className="text-xs text-muted-foreground line-clamp-2">{u.bio}</p>}
          </div>
        ))}

        {/* Posts Tab */}
        {tab === 'posts' && posts.map(p => (
          <div key={p.id} className="p-4 rounded-xl bg-card border border-border space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h3 className="font-semibold text-sm text-foreground truncate">{p.title}</h3>
                <p className="text-xs text-muted-foreground">
                  {p.subject} • ₹{p.budget} • {p.pages || '—'} pages
                </p>
                <p className="text-xs text-muted-foreground">
                  By {p.profiles?.full_name || 'Unknown'} • {formatDistanceToNow(new Date(p.created_at), { addSuffix: true })}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className={`px-2 py-0.5 rounded-md text-xs font-medium ${
                  p.status === 'open' ? 'bg-primary/10 text-primary' : 'bg-secondary text-muted-foreground'
                }`}>
                  {p.status}
                </span>
                <button
                  onClick={() => deletePost(p.id)}
                  className="flex items-center gap-1 h-8 px-3 rounded-lg bg-destructive/10 text-destructive text-xs font-medium active:scale-[0.97] transition-transform"
                >
                  <Trash2 className="w-3 h-3" />
                  Delete
                </button>
              </div>
            </div>
          </div>
        ))}

        {/* Chats Tab */}
        {tab === 'chats' && !selectedChat && conversations.map(c => (
          <button
            key={c.id}
            onClick={() => setSelectedChat(c.id)}
            className="w-full text-left p-4 rounded-xl bg-card border border-border space-y-1 active:scale-[0.99] transition-transform"
          >
            <div className="flex items-center justify-between">
              <p className="font-semibold text-sm text-foreground">
                {c.buyer_profile?.full_name || 'Unknown'} ↔ {c.seller_profile?.full_name || 'Unknown'}
              </p>
              <span className="text-[10px] text-muted-foreground">
                {c.message_count} msgs
              </span>
            </div>
            {c.last_message && (
              <p className="text-xs text-muted-foreground truncate">{c.last_message}</p>
            )}
            <p className="text-[10px] text-muted-foreground">
              {formatDistanceToNow(new Date(c.created_at), { addSuffix: true })}
            </p>
          </button>
        ))}

        {/* Chat Messages View */}
        {tab === 'chats' && selectedChat && (
          <div className="space-y-3">
            <button
              onClick={() => setSelectedChat(null)}
              className="flex items-center gap-1 text-sm text-primary font-medium"
            >
              <ChevronLeft className="w-4 h-4" />
              Back to chats
            </button>
            <div className="space-y-2">
              {chatMessages.map(m => (
                <div key={m.id} className="p-3 rounded-xl bg-card border border-border">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-xs font-semibold text-foreground">{m.sender_name}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {formatDistanceToNow(new Date(m.created_at), { addSuffix: true })}
                    </p>
                  </div>
                  <p className="text-sm text-foreground">{m.content}</p>
                  {m.read_at && (
                    <p className="text-[10px] text-muted-foreground mt-1">
                      Read {formatDistanceToNow(new Date(m.read_at), { addSuffix: true })}
                    </p>
                  )}
                </div>
              ))}
              {chatMessages.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-8">No messages in this conversation</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
