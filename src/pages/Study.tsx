import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { BookOpen, FileText, Home, ExternalLink, ArrowLeft } from 'lucide-react';
import BottomNav from '@/components/BottomNav';
import { useAuth } from '@/lib/auth';
import { Navigate } from 'react-router-dom';

type StudyConfig = { id: string; semester_label: string; timetable_url: string };
type StudySubject = { id: string; name: string; notes_url: string; papers_url: string; notes_content: string; sort_order: number };
type SubTab = 'home' | 'papers' | 'notes';

export default function Study() {
  const { user, loading } = useAuth();
  const [config, setConfig] = useState<StudyConfig | null>(null);
  const [subjects, setSubjects] = useState<StudySubject[]>([]);
  const [subTab, setSubTab] = useState<SubTab>('home');
  const [readingSubject, setReadingSubject] = useState<StudySubject | null>(null);

  useEffect(() => {
    const fetch = async () => {
      const { data: configs } = await supabase.from('study_config').select('*').limit(1);
      if (configs && configs.length > 0) {
        const cfg = configs[0] as any;
        setConfig(cfg);
        const { data: subs } = await supabase
          .from('study_subjects')
          .select('*')
          .eq('config_id', cfg.id)
          .order('sort_order', { ascending: true });
        if (subs) setSubjects(subs as any);
      }
    };
    fetch();
  }, []);

  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;

  // Reading mode
  if (readingSubject) {
    const htmlContent = readingSubject.notes_content?.trim().startsWith('<')
      ? readingSubject.notes_content
      : formatNotesContent(readingSubject.notes_content || '');

    const iframeDoc = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    background: #000;
    color: rgba(255,255,255,0.82);
    padding: 20px;
    font-size: 16px;
    line-height: 1.85;
    letter-spacing: 0.01em;
  }
  h1, h2, h3 { color: rgba(255,255,255,0.96); font-weight: 700; margin-top: 1.5em; margin-bottom: 0.5em; line-height: 1.3; }
  h1 { font-size: 1.6rem; }
  h2 { font-size: 1.3rem; }
  h3 { font-size: 1.1rem; }
  p { margin-bottom: 1em; }
  ul, ol { padding-left: 1.5em; margin-bottom: 1em; }
  li { margin-bottom: 0.3em; }
  strong { color: rgba(255,255,255,0.96); font-weight: 600; }
  em { color: rgba(255,255,255,0.7); }
  code { background: rgba(255,255,255,0.06); padding: 0.15em 0.4em; border-radius: 4px; font-size: 0.9em; }
  blockquote { border-left: 3px solid rgba(255,255,255,0.2); padding-left: 1em; margin: 1em 0; color: rgba(255,255,255,0.6); font-style: italic; }
  table { width: 100%; border-collapse: collapse; margin: 1em 0; }
  th, td { border: 1px solid rgba(255,255,255,0.1); padding: 8px 12px; text-align: left; }
  th { background: rgba(255,255,255,0.05); font-weight: 600; }
  img { max-width: 100%; height: auto; border-radius: 8px; }
  a { color: rgba(255,255,255,0.8); text-decoration: underline; }
  @media (min-width: 768px) {
    body { font-size: 18px; line-height: 1.9; max-width: 700px; margin: 0 auto; padding: 40px 20px; }
    h1 { font-size: 2rem; }
    h2 { font-size: 1.5rem; }
  }
</style>
</head>
<body>${htmlContent}</body>
</html>`;

    return (
      <div className="min-h-[100dvh] bg-background pb-[calc(4rem+env(safe-area-inset-bottom))]">
        <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-xl border-b border-border px-5 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3 flex items-center gap-3">
          <button onClick={() => setReadingSubject(null)} className="p-1.5 rounded-xl bg-secondary active:scale-95">
            <ArrowLeft className="w-5 h-5 text-foreground" />
          </button>
          <div>
            <h1 className="text-base font-bold text-foreground">{readingSubject.name}</h1>
            <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">Notes</p>
          </div>
        </div>
        <div className="w-full">
          {readingSubject.notes_content ? (
            <iframe
              srcDoc={iframeDoc}
              sandbox="allow-same-origin"
              className="w-full border-none"
              style={{ minHeight: '80vh' }}
              onLoad={(e) => {
                const iframe = e.target as HTMLIFrameElement;
                if (iframe.contentDocument) {
                  iframe.style.height = iframe.contentDocument.body.scrollHeight + 40 + 'px';
                }
              }}
            />
          ) : (
            <div className="p-8 text-center">
              <p className="text-sm text-muted-foreground">Notes haven't been written yet.</p>
            </div>
          )}
        </div>
        <BottomNav />
      </div>
    );
  }

  const subTabs: { key: SubTab; label: string; icon: any }[] = [
    { key: 'home', label: 'Home', icon: Home },
    { key: 'papers', label: 'Papers', icon: FileText },
    { key: 'notes', label: 'Notes', icon: BookOpen },
  ];

  return (
    <div className="min-h-[100dvh] bg-background pb-[calc(4rem+env(safe-area-inset-bottom))]">
      {/* Header */}
      <div className="px-5 pt-[max(1.5rem,env(safe-area-inset-top))] pb-4">
        <div className="flex items-center justify-between mb-1">
          <h1 className="text-[28px] font-bold text-foreground tracking-tight">Study</h1>
        </div>
        <p className="text-sm text-muted-foreground">Notes and study materials</p>

        <div className="flex gap-2 mt-4">
          {subTabs.map(t => (
            <button
              key={t.key}
              onClick={() => setSubTab(t.key)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold transition-all ${
                subTab === t.key
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-secondary text-secondary-foreground'
              }`}
            >
              <t.icon className="w-3.5 h-3.5" />
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="px-5 py-2 max-w-2xl mx-auto space-y-3">
        {/* Home */}
        {subTab === 'home' && (
          <>
            {subjects.length === 0 ? (
              <div className="text-center py-16">
                <p className="text-sm text-muted-foreground">No subjects available yet</p>
              </div>
            ) : (
              subjects.map((s, i) => (
                <button
                  key={s.id}
                  onClick={() => {
                    if (s.notes_content) setReadingSubject(s);
                    else if (s.notes_url) window.open(s.notes_url, '_blank');
                  }}
                  className="w-full flex items-center gap-3 p-4 rounded-2xl bg-card active:scale-[0.97] transition-all text-left"
                >
                  <div className="w-9 h-9 rounded-xl bg-secondary flex items-center justify-center text-sm font-bold text-foreground shrink-0">
                    {String(i + 1).padStart(2, '0')}
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-bold text-[15px] text-foreground truncate">{s.name}</h3>
                    <p className="text-[10px] text-muted-foreground font-semibold mt-0.5">
                      {s.notes_content ? 'Tap to read notes' : s.notes_url ? 'External link' : 'No notes yet'}
                    </p>
                  </div>
                  <BookOpen className="w-4 h-4 text-muted-foreground ml-auto shrink-0" />
                </button>
              ))
            )}
          </>
        )}

        {/* Notes */}
        {subTab === 'notes' && (
          <>
            {subjects.filter(s => s.notes_content || s.notes_url).length === 0 ? (
              <div className="text-center py-16">
                <p className="text-sm text-muted-foreground">No notes available yet.</p>
              </div>
            ) : (
              subjects.filter(s => s.notes_content || s.notes_url).map(s => (
                <button
                  key={s.id}
                  onClick={() => {
                    if (s.notes_content) setReadingSubject(s);
                    else if (s.notes_url) window.open(s.notes_url, '_blank');
                  }}
                  className="w-full flex items-center justify-between p-4 rounded-2xl bg-card active:scale-[0.98] transition-all text-left"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center">
                      <BookOpen className="w-5 h-5 text-foreground" />
                    </div>
                    <div>
                      <span className="font-bold text-sm text-foreground">{s.name}</span>
                      <p className="text-[10px] text-muted-foreground font-semibold">
                        {s.notes_content ? 'Tap to read' : 'External link'}
                      </p>
                    </div>
                  </div>
                  {s.notes_content ? (
                    <BookOpen className="w-4 h-4 text-muted-foreground" />
                  ) : (
                    <ExternalLink className="w-4 h-4 text-muted-foreground" />
                  )}
                </button>
              ))
            )}
          </>
        )}

        {/* Papers */}
        {subTab === 'papers' && (
          <>
            {subjects.filter(s => s.papers_url).length === 0 ? (
              <div className="text-center py-16">
                <p className="text-sm text-muted-foreground">No papers available yet.</p>
              </div>
            ) : (
              subjects.filter(s => s.papers_url).map(s => (
                <a
                  key={s.id}
                  href={s.papers_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between p-4 rounded-2xl bg-card active:scale-[0.98] transition-all"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center">
                      <FileText className="w-5 h-5 text-foreground" />
                    </div>
                    <span className="font-bold text-sm text-foreground">{s.name}</span>
                  </div>
                  <ExternalLink className="w-4 h-4 text-muted-foreground" />
                </a>
              ))
            )}
          </>
        )}
      </div>

      <BottomNav />
    </div>
  );
}

/** Convert plain text with markdown-like formatting to simple HTML */
function formatNotesContent(text: string): string {
  return text
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code>$1</code>')
    .replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/((?:<li>.*<\/li>\n?)+)/g, '<ul>$1</ul>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n/g, '<br/>')
    .replace(/^/, '<p>')
    .replace(/$/, '</p>');
}
