import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { Navigate, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { ArrowLeft, FileText, Plus, Trash2, Upload, Eye, Lock, Globe, Pencil } from 'lucide-react';
import BottomNav from '@/components/BottomNav';
import { toast } from 'sonner';
import { useAppSettings } from '@/hooks/use-app-settings';
import ReactMarkdown from 'react-markdown';

type Note = {
  id: string;
  user_id: string;
  title: string;
  content_type: 'text' | 'html' | 'markdown' | 'pdf';
  content: string | null;
  file_url: string | null;
  is_public: boolean;
  created_at: string;
};

export default function MyNotes() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { settings } = useAppSettings();
  const [notes, setNotes] = useState<Note[]>([]);
  const [view, setView] = useState<'list' | 'compose' | 'reading'>('list');
  const [readingNote, setReadingNote] = useState<Note | null>(null);

  // Compose state
  const [title, setTitle] = useState('');
  const [contentType, setContentType] = useState<'text' | 'html' | 'markdown' | 'pdf'>('text');
  const [content, setContent] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [mine, pub] = await Promise.all([
        supabase.from('user_notes' as any).select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
        supabase.from('user_notes' as any).select('*').eq('is_public', true).neq('user_id', user.id).order('created_at', { ascending: false }).limit(30),
      ]);
      const combined = [...((mine.data as any) || []), ...((pub.data as any) || [])];
      // dedupe by id
      const seen = new Set<string>();
      setNotes(combined.filter(n => !seen.has(n.id) && (seen.add(n.id), true)));
    })();
  }, [user, view]);

  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (settings.feature_toggles?.notes_upload === false) {
    return <Navigate to="/marketplace" replace />;
  }

  const handleFileUpload = async (file: File) => {
    setUploading(true);
    try {
      const ext = file.name.split('.').pop()?.toLowerCase() || 'pdf';
      const path = `${user.id}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
      const { error: upErr } = await supabase.storage.from('notes').upload(path, file, {
        contentType: file.type,
        upsert: false,
      });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from('notes').getPublicUrl(path);
      if (ext === 'txt') {
        const text = await file.text();
        setContent(text);
        setContentType('text');
      } else if (ext === 'html' || ext === 'htm') {
        const text = await file.text();
        setContent(text);
        setContentType('html');
      } else {
        setContent(pub.publicUrl);
        setContentType('pdf');
      }
      toast.success('File uploaded');
      return pub.publicUrl;
    } catch (e: any) {
      toast.error(e.message || 'Upload failed');
      return null;
    } finally {
      setUploading(false);
    }
  };

  const saveNote = async () => {
    if (!title.trim()) { toast.error('Title required'); return; }
    if (contentType !== 'pdf' && !content.trim()) { toast.error('Content required'); return; }
    const fileUrl = contentType === 'pdf' ? content : null;
    const { error } = await supabase.from('user_notes' as any).insert({
      user_id: user.id,
      title: title.trim(),
      content_type: contentType,
      content: contentType === 'pdf' ? null : content,
      file_url: fileUrl,
      is_public: isPublic,
    } as any);
    if (error) { toast.error(error.message); return; }
    toast.success('Note saved');
    setTitle(''); setContent(''); setContentType('text'); setIsPublic(true);
    setView('list');
  };

  const deleteNote = async (id: string) => {
    await supabase.from('user_notes' as any).delete().eq('id', id);
    setNotes(prev => prev.filter(n => n.id !== id));
    toast('Deleted');
  };

  // ===== Reading view =====
  if (view === 'reading' && readingNote) {
    return (
      <div className="min-h-[100dvh] bg-background pb-[calc(4rem+env(safe-area-inset-bottom))]">
        <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-xl border-b border-border px-5 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3 flex items-center gap-3">
          <button onClick={() => { setView('list'); setReadingNote(null); }} className="p-1.5 rounded-xl bg-secondary active:scale-95">
            <ArrowLeft className="w-5 h-5 text-foreground" />
          </button>
          <div className="min-w-0">
            <h1 className="text-base font-bold text-foreground truncate">{readingNote.title}</h1>
            <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">{readingNote.content_type}</p>
          </div>
        </div>
        <div className="px-5 py-6 max-w-2xl mx-auto">
          {readingNote.content_type === 'pdf' && readingNote.file_url ? (
            <iframe src={readingNote.file_url} className="w-full rounded-2xl border border-border" style={{ minHeight: '80vh' }} title={readingNote.title} />
          ) : readingNote.content_type === 'html' ? (
            <div
              className="prose prose-sm prose-invert max-w-none"
              // eslint-disable-next-line react/no-danger
              dangerouslySetInnerHTML={{ __html: readingNote.content || '' }}
            />
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

          <div className="flex flex-wrap gap-2">
            {(['text', 'markdown', 'html', 'pdf'] as const).map(t => (
              <button
                key={t}
                onClick={() => { setContentType(t); setContent(''); }}
                className={`px-3 py-1.5 rounded-full text-xs font-bold uppercase ${contentType === t ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground'}`}
              >
                {t}
              </button>
            ))}
          </div>

          {contentType === 'pdf' ? (
            <label className="flex flex-col items-center justify-center gap-2 p-8 rounded-2xl border-2 border-dashed border-border bg-card cursor-pointer active:scale-[0.99] transition-transform">
              <Upload className="w-6 h-6 text-muted-foreground" />
              <p className="text-sm text-foreground font-bold">{uploading ? 'Uploading…' : 'Upload PDF'}</p>
              <p className="text-xs text-muted-foreground">{content ? content.split('/').pop() : 'Tap to choose a file'}</p>
              <input
                type="file"
                accept="application/pdf"
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
              rows={14}
              className="w-full px-4 py-3 rounded-2xl bg-secondary text-foreground text-sm font-mono resize-y border-none outline-none"
            />
          )}

          <label className="flex items-center gap-3 p-3 rounded-2xl bg-card cursor-pointer">
            <input
              type="checkbox"
              checked={isPublic}
              onChange={e => setIsPublic(e.target.checked)}
              className="w-4 h-4 accent-primary"
            />
            <div className="flex-1">
              <p className="text-sm font-bold text-foreground flex items-center gap-1.5">
                {isPublic ? <Globe className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
                {isPublic ? 'Public' : 'Private'}
              </p>
              <p className="text-xs text-muted-foreground">{isPublic ? 'Anyone can read these notes' : 'Only you can read them'}</p>
            </div>
          </label>

          <button
            onClick={saveNote}
            disabled={uploading}
            className="w-full h-12 rounded-2xl bg-primary text-primary-foreground font-bold text-sm active:scale-[0.98] disabled:opacity-50"
          >
            Save Note
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
          <h1 className="text-[28px] font-bold text-foreground tracking-tight">My Notes</h1>
          <p className="text-sm text-muted-foreground">Upload or write your own notes</p>
        </div>
        <button
          onClick={() => setView('compose')}
          className="flex items-center gap-1.5 h-10 px-4 rounded-full bg-primary text-primary-foreground text-xs font-bold active:scale-95"
        >
          <Plus className="w-4 h-4" /> New
        </button>
      </div>

      <div className="px-5 max-w-2xl mx-auto space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => navigate('/post')}
            className="p-4 rounded-2xl bg-card text-left active:scale-[0.98] border border-border"
          >
            <Pencil className="w-5 h-5 text-primary mb-2" />
            <p className="text-sm font-bold text-foreground">Request a writer</p>
            <p className="text-xs text-muted-foreground mt-0.5">Pay someone to write for you</p>
          </button>
          <button
            onClick={() => setView('compose')}
            className="p-4 rounded-2xl bg-card text-left active:scale-[0.98] border border-border"
          >
            <Upload className="w-5 h-5 text-primary mb-2" />
            <p className="text-sm font-bold text-foreground">Upload your own</p>
            <p className="text-xs text-muted-foreground mt-0.5">PDF, text, HTML or write inline</p>
          </button>
        </div>

        {notes.length === 0 ? (
          <div className="text-center py-16">
            <FileText className="w-10 h-10 text-muted-foreground mx-auto mb-2 opacity-40" />
            <p className="text-sm text-muted-foreground">No notes yet — add your first one!</p>
          </div>
        ) : (
          notes.map(n => (
            <div key={n.id} className="p-4 rounded-2xl bg-card flex items-center gap-3">
              <button
                onClick={() => { setReadingNote(n); setView('reading'); }}
                className="flex-1 min-w-0 text-left"
              >
                <div className="flex items-center gap-2">
                  <p className="font-bold text-sm text-foreground truncate">{n.title}</p>
                  {n.is_public ? <Globe className="w-3 h-3 text-muted-foreground shrink-0" /> : <Lock className="w-3 h-3 text-muted-foreground shrink-0" />}
                </div>
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold mt-0.5">
                  {n.content_type}{n.user_id !== user.id ? ' • by another user' : ''}
                </p>
              </button>
              <button
                onClick={() => { setReadingNote(n); setView('reading'); }}
                className="p-2 rounded-xl bg-secondary active:scale-95"
                aria-label="Read"
              >
                <Eye className="w-4 h-4 text-foreground" />
              </button>
              {n.user_id === user.id && (
                <button
                  onClick={() => deleteNote(n.id)}
                  className="p-2 rounded-xl bg-red-400/10 text-red-400 active:scale-95"
                  aria-label="Delete"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          ))
        )}
      </div>

      <BottomNav />
    </div>
  );
}