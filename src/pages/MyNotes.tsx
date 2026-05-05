import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { Navigate, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { ArrowLeft, FileText, Plus, Trash2, Upload, Eye, Lock, Globe, Pencil, ArrowUp, Search, Trophy } from 'lucide-react';
import BottomNav from '@/components/BottomNav';
import { toast } from 'sonner';
import { useAppSettings } from '@/hooks/use-app-settings';
import ReactMarkdown from 'react-markdown';

type Note = {
  id: string;
  user_id: string;
  title: string;
  subject: string | null;
  description: string | null;
  content_type: 'text' | 'html' | 'markdown' | 'pdf' | 'image';
  content: string | null;
  file_url: string | null;
  is_public: boolean;
  created_at: string;
  vote_count?: number;
  voted_by_me?: boolean;
  author_name?: string;
};

const SUBJECTS = ['All', 'Math', 'Physics', 'Chemistry', 'Biology', 'CS', 'English', 'Other'];

export default function MyNotes() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { settings } = useAppSettings();
  const [notes, setNotes] = useState<Note[]>([]);
  const [view, setView] = useState<'list' | 'compose' | 'reading'>('list');
  const [readingNote, setReadingNote] = useState<Note | null>(null);
  const [leaderboard, setLeaderboard] = useState<{ user_id: string; name: string; points: number }[]>([]);

  // Filters
  const [search, setSearch] = useState('');
  const [subjectFilter, setSubjectFilter] = useState('All');
  const [sortBy, setSortBy] = useState<'top' | 'latest'>('top');

  // Compose state
  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState('Other');
  const [description, setDescription] = useState('');
  const [contentType, setContentType] = useState<'text' | 'markdown' | 'html' | 'pdf' | 'image'>('text');
  const [content, setContent] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [uploading, setUploading] = useState(false);

  const loadNotes = async () => {
    if (!user) return;
    const { data: rows } = await supabase
      .from('user_notes' as any)
      .select('*')
      .or(`is_public.eq.true,user_id.eq.${user.id}`)
      .order('created_at', { ascending: false })
      .limit(200);
    const list = (rows as any[]) || [];
    if (list.length === 0) { setNotes([]); return; }

    const ids = list.map(n => n.id);
    const authorIds = [...new Set(list.map(n => n.user_id))];
    const [{ data: votes }, { data: profs }] = await Promise.all([
      supabase.from('note_votes' as any).select('note_id, user_id').in('note_id', ids),
      supabase.from('profiles').select('user_id, full_name').in('user_id', authorIds),
    ]);
    const counts: Record<string, number> = {};
    const mine = new Set<string>();
    (votes as any[] | null)?.forEach(v => {
      counts[v.note_id] = (counts[v.note_id] || 0) + 1;
      if (v.user_id === user.id) mine.add(v.note_id);
    });
    const nameMap: Record<string, string> = {};
    (profs as any[] | null)?.forEach(p => { nameMap[p.user_id] = p.full_name || 'Anonymous'; });

    setNotes(list.map(n => ({
      ...n,
      vote_count: counts[n.id] || 0,
      voted_by_me: mine.has(n.id),
      author_name: nameMap[n.user_id] || 'Anonymous',
    })));
  };

  const loadLeaderboard = async () => {
    // Cheap: fetch all public notes + votes, compute client-side. +5 per note, +1 per upvote received.
    const [{ data: pubNotes }, { data: allVotes }] = await Promise.all([
      supabase.from('user_notes' as any).select('id, user_id').eq('is_public', true),
      supabase.from('note_votes' as any).select('note_id'),
    ]);
    const noteAuthor: Record<string, string> = {};
    const points: Record<string, number> = {};
    (pubNotes as any[] | null)?.forEach(n => {
      noteAuthor[n.id] = n.user_id;
      points[n.user_id] = (points[n.user_id] || 0) + 5;
    });
    (allVotes as any[] | null)?.forEach(v => {
      const author = noteAuthor[v.note_id];
      if (author) points[author] = (points[author] || 0) + 1;
    });
    const top = Object.entries(points).sort((a, b) => b[1] - a[1]).slice(0, 5);
    if (top.length === 0) { setLeaderboard([]); return; }
    const { data: profs } = await supabase.from('profiles').select('user_id, full_name').in('user_id', top.map(t => t[0]));
    const nameMap: Record<string, string> = {};
    (profs as any[] | null)?.forEach(p => { nameMap[p.user_id] = p.full_name || 'Anonymous'; });
    setLeaderboard(top.map(([uid, pts]) => ({ user_id: uid, name: nameMap[uid] || 'Anonymous', points: pts })));
  };

  useEffect(() => { loadNotes(); loadLeaderboard(); /* eslint-disable-next-line */ }, [user, view]);

  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (settings.feature_toggles?.notes_upload === false) {
    return <Navigate to="/marketplace" replace />;
  }

  const toggleVote = async (note: Note) => {
    if (note.voted_by_me) {
      await supabase.from('note_votes' as any).delete().eq('note_id', note.id).eq('user_id', user.id);
    } else {
      await supabase.from('note_votes' as any).insert({ note_id: note.id, user_id: user.id } as any);
    }
    setNotes(prev => prev.map(n => n.id === note.id ? {
      ...n,
      voted_by_me: !note.voted_by_me,
      vote_count: (n.vote_count || 0) + (note.voted_by_me ? -1 : 1),
    } : n));
  };

  const handleFileUpload = async (file: File) => {
    setUploading(true);
    try {
      const ext = file.name.split('.').pop()?.toLowerCase() || '';
      const path = `${user.id}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
      const { error: upErr } = await supabase.storage.from('notes').upload(path, file, { contentType: file.type, upsert: false });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from('notes').getPublicUrl(path);
      if (['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(ext)) {
        setContent(pub.publicUrl); setContentType('image');
      } else if (ext === 'txt') {
        const text = await file.text(); setContent(text); setContentType('text');
      } else if (ext === 'html' || ext === 'htm') {
        const text = await file.text(); setContent(text); setContentType('html');
      } else {
        setContent(pub.publicUrl); setContentType('pdf');
      }
      toast.success('File uploaded');
    } catch (e: any) {
      toast.error(e.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const saveNote = async () => {
    if (!title.trim()) { toast.error('Title required'); return; }
    const isFile = contentType === 'pdf' || contentType === 'image';
    if (!isFile && !content.trim()) { toast.error('Content required'); return; }
    const { error } = await supabase.from('user_notes' as any).insert({
      user_id: user.id,
      title: title.trim(),
      subject: subject || 'Other',
      description: description.trim() || null,
      content_type: contentType,
      content: isFile ? null : content,
      file_url: isFile ? content : null,
      is_public: isPublic,
    } as any);
    if (error) { toast.error(error.message); return; }
    toast.success('Note saved (+5 points)');
    setTitle(''); setSubject('Other'); setDescription(''); setContent(''); setContentType('text'); setIsPublic(true);
    setView('list');
  };

  const deleteNote = async (id: string) => {
    await supabase.from('user_notes' as any).delete().eq('id', id);
    setNotes(prev => prev.filter(n => n.id !== id));
    toast('Deleted');
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = notes.filter(n => {
      if (subjectFilter !== 'All' && (n.subject || 'Other') !== subjectFilter) return false;
      if (!q) return true;
      return (
        n.title.toLowerCase().includes(q) ||
        (n.description || '').toLowerCase().includes(q) ||
        (n.subject || '').toLowerCase().includes(q)
      );
    });
    list.sort((a, b) =>
      sortBy === 'top'
        ? (b.vote_count || 0) - (a.vote_count || 0) || +new Date(b.created_at) - +new Date(a.created_at)
        : +new Date(b.created_at) - +new Date(a.created_at)
    );
    return list;
  }, [notes, search, subjectFilter, sortBy]);

  // ===== Reading view =====
  if (view === 'reading' && readingNote) {
    const fileUrl = readingNote.file_url || readingNote.content || '';
    return (
      <div className="min-h-[100dvh] bg-background pb-[calc(4rem+env(safe-area-inset-bottom))]">
        <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-xl border-b border-border px-5 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3 flex items-center gap-3">
          <button onClick={() => { setView('list'); setReadingNote(null); }} className="p-1.5 rounded-xl bg-secondary active:scale-95">
            <ArrowLeft className="w-5 h-5 text-foreground" />
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="text-base font-bold text-foreground truncate">{readingNote.title}</h1>
            <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">
              {readingNote.subject || 'Other'} • {readingNote.content_type}
            </p>
          </div>
        </div>
        <div className="px-5 py-6 max-w-2xl mx-auto">
          {readingNote.description && (
            <p className="text-sm text-muted-foreground mb-4">{readingNote.description}</p>
          )}
          {readingNote.content_type === 'pdf' ? (
            <iframe src={fileUrl} className="w-full rounded-2xl border border-border" style={{ minHeight: '80vh' }} title={readingNote.title} />
          ) : readingNote.content_type === 'image' ? (
            <img src={fileUrl} alt={readingNote.title} className="w-full rounded-2xl border border-border" />
          ) : readingNote.content_type === 'html' ? (
            <div className="prose prose-sm prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: readingNote.content || '' }} />
          ) : readingNote.content_type === 'markdown' ? (
            <div className="prose prose-sm prose-invert max-w-none">
              <ReactMarkdown>{readingNote.content || ''}</ReactMarkdown>
            </div>
          ) : (
            <pre className="whitespace-pre-wrap text-sm text-foreground leading-relaxed font-sans">{readingNote.content}</pre>
          )}
        </div>
        <BottomNav />
      </div>
    );
  }

  // ===== Compose view =====
  if (view === 'compose') {
    return (
      <div className="min-h-[100dvh] bg-background pb-[calc(6rem+env(safe-area-inset-bottom))]">
        <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-xl border-b border-border px-5 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3 flex items-center gap-3">
          <button onClick={() => setView('list')} className="p-1.5 rounded-xl bg-secondary active:scale-95">
            <ArrowLeft className="w-5 h-5 text-foreground" />
          </button>
          <h1 className="text-base font-bold text-foreground">New Note</h1>
        </div>
        <div className="px-5 py-5 max-w-2xl mx-auto space-y-4">
          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Note title"
            className="w-full h-12 px-4 rounded-2xl bg-secondary text-foreground text-sm border-none outline-none"
          />

          <select
            value={subject}
            onChange={e => setSubject(e.target.value)}
            className="w-full h-12 px-4 rounded-2xl bg-secondary text-foreground text-sm border-none outline-none"
          >
            {SUBJECTS.filter(s => s !== 'All').map(s => <option key={s} value={s}>{s}</option>)}
          </select>

          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Short description (optional)"
            rows={2}
            className="w-full px-4 py-3 rounded-2xl bg-secondary text-foreground text-sm border-none outline-none resize-y"
          />

          <div className="flex flex-wrap gap-2">
            {(['text', 'markdown', 'html', 'pdf', 'image'] as const).map(t => (
              <button
                key={t}
                onClick={() => { setContentType(t); setContent(''); }}
                className={`px-3 py-1.5 rounded-full text-xs font-bold uppercase ${contentType === t ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground'}`}
              >
                {t}
              </button>
            ))}
          </div>

          {contentType === 'pdf' || contentType === 'image' ? (
            <label className="flex flex-col items-center justify-center gap-2 p-8 rounded-2xl border-2 border-dashed border-border bg-card cursor-pointer active:scale-[0.99] transition-transform">
              <Upload className="w-6 h-6 text-muted-foreground" />
              <p className="text-sm text-foreground font-bold">{uploading ? 'Uploading…' : `Upload ${contentType === 'pdf' ? 'PDF' : 'image'}`}</p>
              <p className="text-xs text-muted-foreground">{content ? content.split('/').pop() : 'Tap to choose a file'}</p>
              <input
                type="file"
                accept={contentType === 'pdf' ? 'application/pdf' : 'image/*'}
                className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) handleFileUpload(f); }}
              />
            </label>
          ) : (
            <textarea
              value={content}
              onChange={e => setContent(e.target.value)}
              placeholder={
                contentType === 'html' ? '<h1>Title</h1>\n<p>Your HTML…</p>' :
                contentType === 'markdown' ? '# Title\n\nYour **markdown** notes…' :
                'Type your notes here…'
              }
              rows={12}
              className="w-full px-4 py-3 rounded-2xl bg-secondary text-foreground text-sm font-mono resize-y border-none outline-none"
            />
          )}

          <label className="flex items-center gap-3 p-3 rounded-2xl bg-card cursor-pointer">
            <input type="checkbox" checked={isPublic} onChange={e => setIsPublic(e.target.checked)} className="w-4 h-4 accent-primary" />
            <div className="flex-1">
              <p className="text-sm font-bold text-foreground flex items-center gap-1.5">
                {isPublic ? <Globe className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
                {isPublic ? 'Public' : 'Private'}
              </p>
              <p className="text-xs text-muted-foreground">{isPublic ? 'Anyone can read & upvote' : 'Only you can read it'}</p>
            </div>
          </label>

          <button
            onClick={saveNote}
            disabled={uploading}
            className="w-full h-12 rounded-2xl bg-primary text-primary-foreground font-bold text-sm active:scale-[0.98] disabled:opacity-50"
          >
            Save Note (+5 pts)
          </button>
        </div>
        <BottomNav />
      </div>
    );
  }

  // ===== List view =====
  return (
    <div className="min-h-[100dvh] bg-background pb-[calc(4rem+env(safe-area-inset-bottom))]">
      <div className="px-5 pt-[max(1.5rem,env(safe-area-inset-top))] pb-4 flex items-center justify-between">
        <div>
          <h1 className="text-[28px] font-bold text-foreground tracking-tight">Notes</h1>
          <p className="text-sm text-muted-foreground">Read, share & upvote student notes</p>
        </div>
        <button
          onClick={() => setView('compose')}
          className="flex items-center gap-1.5 h-10 px-4 rounded-full bg-primary text-primary-foreground text-xs font-bold active:scale-95"
        >
          <Plus className="w-4 h-4" /> New
        </button>
      </div>

      <div className="px-5 max-w-2xl mx-auto space-y-3">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search notes…"
            className="w-full h-11 pl-10 pr-3 rounded-2xl bg-secondary text-foreground text-sm border-none outline-none"
          />
        </div>

        {/* Subject filter */}
        <div className="flex gap-2 overflow-x-auto -mx-1 px-1 pb-1">
          {SUBJECTS.map(s => (
            <button
              key={s}
              onClick={() => setSubjectFilter(s)}
              className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-bold ${subjectFilter === s ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground'}`}
            >
              {s}
            </button>
          ))}
        </div>

        {/* Sort */}
        <div className="flex gap-2">
          {(['top', 'latest'] as const).map(s => (
            <button
              key={s}
              onClick={() => setSortBy(s)}
              className={`px-3 py-1.5 rounded-full text-xs font-bold uppercase ${sortBy === s ? 'bg-foreground text-background' : 'bg-secondary text-secondary-foreground'}`}
            >
              {s}
            </button>
          ))}
        </div>

        {/* Leaderboard */}
        {leaderboard.length > 0 && (
          <div className="p-4 rounded-2xl bg-card">
            <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5 mb-3">
              <Trophy className="w-3.5 h-3.5" /> Top Contributors
            </h3>
            <div className="space-y-2">
              {leaderboard.map((u, i) => (
                <div key={u.user_id} className="flex items-center justify-between text-sm">
                  <span className="text-foreground"><span className="text-muted-foreground mr-2">#{i + 1}</span>{u.name}</span>
                  <span className="font-bold text-foreground">{u.points} pts</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Quick actions */}
        <div className="grid grid-cols-2 gap-3">
          <button onClick={() => navigate('/post')} className="p-4 rounded-2xl bg-card text-left active:scale-[0.98] border border-border">
            <Pencil className="w-5 h-5 text-foreground mb-2" />
            <p className="text-sm font-bold text-foreground">Request a writer</p>
            <p className="text-xs text-muted-foreground mt-0.5">Pay someone to write for you</p>
          </button>
          <button onClick={() => setView('compose')} className="p-4 rounded-2xl bg-card text-left active:scale-[0.98] border border-border">
            <Upload className="w-5 h-5 text-foreground mb-2" />
            <p className="text-sm font-bold text-foreground">Upload a note</p>
            <p className="text-xs text-muted-foreground mt-0.5">PDF, image, text, HTML, markdown</p>
          </button>
        </div>

        {filtered.length === 0 ? (
          <div className="text-center py-16">
            <FileText className="w-10 h-10 text-muted-foreground mx-auto mb-2 opacity-40" />
            <p className="text-sm text-muted-foreground">No notes match your filters.</p>
          </div>
        ) : (
          filtered.map(n => (
            <div key={n.id} className="p-4 rounded-2xl bg-card flex gap-3">
              <button
                onClick={() => toggleVote(n)}
                className={`flex flex-col items-center justify-center min-w-[44px] py-1 rounded-xl active:scale-95 ${n.voted_by_me ? 'bg-foreground text-background' : 'bg-secondary text-foreground'}`}
                aria-label="Upvote"
              >
                <ArrowUp className="w-4 h-4" />
                <span className="text-xs font-bold mt-0.5">{n.vote_count || 0}</span>
              </button>
              <button
                onClick={() => { setReadingNote(n); setView('reading'); }}
                className="flex-1 min-w-0 text-left"
              >
                <div className="flex items-center gap-2">
                  <p className="font-bold text-sm text-foreground truncate">{n.title}</p>
                  {n.is_public ? <Globe className="w-3 h-3 text-muted-foreground shrink-0" /> : <Lock className="w-3 h-3 text-muted-foreground shrink-0" />}
                </div>
                {n.description && <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{n.description}</p>}
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold mt-1">
                  {n.subject || 'Other'} • {n.content_type} • {n.author_name}
                </p>
              </button>
              <div className="flex flex-col gap-1.5">
                <button onClick={() => { setReadingNote(n); setView('reading'); }} className="p-2 rounded-xl bg-secondary active:scale-95" aria-label="Read">
                  <Eye className="w-4 h-4 text-foreground" />
                </button>
                {n.user_id === user.id && (
                  <button onClick={() => deleteNote(n.id)} className="p-2 rounded-xl bg-red-400/10 text-red-400 active:scale-95" aria-label="Delete">
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      <BottomNav />
    </div>
  );
}