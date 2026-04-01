import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { BookOpen, FileText, Home, ExternalLink, ArrowLeft } from 'lucide-react';
import BottomNav from '@/components/BottomNav';

type StudyConfig = { id: string; semester_label: string; timetable_url: string };
type StudySubject = { id: string; name: string; notes_url: string; papers_url: string; notes_content: string; sort_order: number };
type SubTab = 'home' | 'papers' | 'notes';

export default function Study() {
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

  const subTabs: { key: SubTab; label: string; icon: any }[] = [
    { key: 'home', label: 'Home', icon: Home },
    { key: 'papers', label: 'Papers', icon: FileText },
    { key: 'notes', label: 'Notes', icon: BookOpen },
  ];

  // Reading mode for a specific subject's notes
  if (readingSubject) {
    return (
      <div className="min-h-screen bg-background pb-24 animate-fade-in">
        <div className="sticky top-0 z-10 glass-strong px-4 py-3 flex items-center gap-3">
          <button onClick={() => setReadingSubject(null)} className="p-1.5 rounded-xl glass-button active:scale-[0.95]">
            <ArrowLeft className="w-5 h-5 text-foreground" />
          </button>
          <div>
            <h1 className="text-base font-bold text-foreground">{readingSubject.name}</h1>
            <p className="text-[10px] text-foreground/30 font-bold uppercase tracking-widest">Notes</p>
          </div>
        </div>
        <div className="px-5 py-6 max-w-3xl mx-auto">
          {readingSubject.notes_content ? (
            <div className="prose-notes" dangerouslySetInnerHTML={{ __html: formatNotesContent(readingSubject.notes_content) }} />
          ) : (
            <div className="glass rounded-2xl p-8 text-center">
              <BookOpen className="w-8 h-8 text-foreground/15 mx-auto mb-3" />
              <p className="text-sm text-foreground/40">Notes haven't been written yet. Check back later!</p>
            </div>
          )}
        </div>
        <BottomNav />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24 animate-fade-in">
      {/* Header */}
      <div className="sticky top-0 z-10 glass-strong px-4 pt-5 pb-3">
        <div className="flex items-center gap-2.5 mb-4">
          <div className="w-9 h-9 rounded-xl glass flex items-center justify-center">
            <BookOpen className="w-4 h-4 text-foreground" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-foreground tracking-tight">
              Poly Notes
            </h1>
            {config && (
              <p className="text-[10px] text-foreground/30 font-bold uppercase tracking-widest">
                {config.semester_label}
              </p>
            )}
          </div>
        </div>
        <div className="flex gap-1.5">
          {subTabs.map(t => (
            <button
              key={t.key}
              onClick={() => setSubTab(t.key)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                subTab === t.key
                  ? 'bg-foreground text-background'
                  : 'glass-button text-foreground/40'
              }`}
            >
              <t.icon className="w-3.5 h-3.5" />
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 py-5 max-w-2xl mx-auto space-y-3">
        {/* Home */}
        {subTab === 'home' && (
          <>
            <p className="text-sm text-foreground/40 mb-4">
              All your {config?.semester_label || ''} resources in one place ✦
            </p>
            {subjects.length === 0 ? (
              <div className="glass rounded-2xl p-8 text-center">
                <p className="text-sm text-foreground/40">
                  No subjects yet. Admin will add them soon.
                </p>
              </div>
            ) : (
              subjects.map((s, i) => (
                <div key={s.id} className="glass rounded-2xl p-4 transition-all active:scale-[0.99]">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-9 h-9 rounded-xl glass-strong flex items-center justify-center text-sm font-bold text-foreground">
                      {String(i + 1).padStart(2, '0')}
                    </div>
                    <h3 className="font-bold text-sm text-foreground">{s.name}</h3>
                  </div>
                  <div className="flex gap-2">
                    {(s.notes_content || s.notes_url) && (
                      <button
                        onClick={() => {
                          if (s.notes_content) {
                            setReadingSubject(s);
                          } else if (s.notes_url) {
                            window.open(s.notes_url, '_blank');
                          }
                        }}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-foreground text-background text-xs font-bold transition-all active:scale-[0.97]"
                      >
                        <BookOpen className="w-3 h-3" /> Notes
                      </button>
                    )}
                    {s.papers_url && (
                      <a
                        href={s.papers_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl glass-button text-foreground/60 text-xs font-bold"
                      >
                        <FileText className="w-3 h-3" /> Papers <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                </div>
              ))
            )}
          </>
        )}

        {/* Notes */}
        {subTab === 'notes' && (
          <>
            <h2 className="text-lg font-bold text-foreground">Notes</h2>
            {subjects.filter(s => s.notes_content || s.notes_url).length === 0 ? (
              <div className="glass rounded-2xl p-8 text-center">
                <p className="text-sm text-foreground/40">No notes available yet.</p>
              </div>
            ) : (
              subjects.filter(s => s.notes_content || s.notes_url).map(s => (
                <button
                  key={s.id}
                  onClick={() => {
                    if (s.notes_content) {
                      setReadingSubject(s);
                    } else if (s.notes_url) {
                      window.open(s.notes_url, '_blank');
                    }
                  }}
                  className="w-full flex items-center justify-between p-4 rounded-2xl glass active:scale-[0.98] transition-all text-left"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl glass-strong flex items-center justify-center">
                      <BookOpen className="w-5 h-5 text-foreground" />
                    </div>
                    <div>
                      <span className="font-bold text-sm text-foreground">{s.name}</span>
                      <p className="text-[10px] text-foreground/30 font-semibold">
                        {s.notes_content ? 'Tap to read' : 'External link'}
                      </p>
                    </div>
                  </div>
                  {s.notes_content ? (
                    <BookOpen className="w-4 h-4 text-foreground/30" />
                  ) : (
                    <ExternalLink className="w-4 h-4 text-foreground/30" />
                  )}
                </button>
              ))
            )}
          </>
        )}

        {/* Papers */}
        {subTab === 'papers' && (
          <>
            <h2 className="text-lg font-bold text-foreground">Previous Papers</h2>
            {subjects.filter(s => s.papers_url).length === 0 ? (
              <div className="glass rounded-2xl p-8 text-center">
                <p className="text-sm text-foreground/40">No papers available yet.</p>
              </div>
            ) : (
              subjects.filter(s => s.papers_url).map(s => (
                <a
                  key={s.id}
                  href={s.papers_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between p-4 rounded-2xl glass active:scale-[0.98] transition-all"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl glass-strong flex items-center justify-center">
                      <FileText className="w-5 h-5 text-foreground" />
                    </div>
                    <span className="font-bold text-sm text-foreground">{s.name}</span>
                  </div>
                  <ExternalLink className="w-4 h-4 text-foreground/30" />
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
    // Headers
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    // Bold
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    // Italic
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    // Inline code
    .replace(/`(.+?)`/g, '<code>$1</code>')
    // Blockquote
    .replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>')
    // Unordered list items
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    // Wrap consecutive <li> in <ul>
    .replace(/((?:<li>.*<\/li>\n?)+)/g, '<ul>$1</ul>')
    // Line breaks for paragraphs
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n/g, '<br/>')
    // Wrap in paragraph
    .replace(/^/, '<p>')
    .replace(/$/, '</p>');
}
