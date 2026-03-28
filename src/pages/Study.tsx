import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { BookOpen, FileText, Home, ExternalLink } from 'lucide-react';
import BottomNav from '@/components/BottomNav';

type StudyConfig = { id: string; semester_label: string; timetable_url: string };
type StudySubject = { id: string; name: string; notes_url: string; papers_url: string; sort_order: number };
type SubTab = 'home' | 'papers' | 'notes';

export default function Study() {
  const [config, setConfig] = useState<StudyConfig | null>(null);
  const [subjects, setSubjects] = useState<StudySubject[]>([]);
  const [subTab, setSubTab] = useState<SubTab>('home');

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

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="sticky top-0 z-10 glass-strong px-4 pt-5 pb-3">
        <div className="flex items-center gap-2.5 mb-4">
          <div className="w-8 h-8 rounded-xl bg-foreground/10 flex items-center justify-center">
            <BookOpen className="w-4 h-4 text-foreground" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-foreground tracking-tight">
              Poly Notes
            </h1>
            {config && (
              <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-widest">
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
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
                subTab === t.key
                  ? 'bg-foreground text-background'
                  : 'glass text-muted-foreground hover:text-foreground'
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
            <p className="text-sm text-muted-foreground mb-4">
              All your {config?.semester_label || ''} resources in one place ✦
            </p>
            {subjects.length === 0 ? (
              <div className="glass rounded-2xl p-8 text-center">
                <p className="text-sm text-muted-foreground">
                  No subjects yet. Admin will add them soon.
                </p>
              </div>
            ) : (
              subjects.map((s, i) => (
                <div key={s.id} className="glass rounded-2xl p-4 transition-all hover:scale-[1.01] active:scale-[0.99]">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-9 h-9 rounded-xl bg-foreground/10 flex items-center justify-center text-sm font-bold text-foreground">
                      {String(i + 1).padStart(2, '0')}
                    </div>
                    <h3 className="font-semibold text-sm text-foreground">{s.name}</h3>
                  </div>
                  <div className="flex gap-2">
                    {s.notes_url && (
                      <a
                        href={s.notes_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-foreground text-background text-xs font-semibold transition-all hover:opacity-90"
                      >
                        <BookOpen className="w-3 h-3" /> Notes <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                    {s.papers_url && (
                      <a
                        href={s.papers_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl glass text-foreground text-xs font-semibold transition-all hover:opacity-90"
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
            {subjects.filter(s => s.notes_url).length === 0 ? (
              <div className="glass rounded-2xl p-8 text-center">
                <p className="text-sm text-muted-foreground">No notes available yet.</p>
              </div>
            ) : (
              subjects.filter(s => s.notes_url).map((s, i) => (
                <a
                  key={s.id}
                  href={s.notes_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between p-4 rounded-2xl glass active:scale-[0.99] transition-all"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-foreground/10 flex items-center justify-center">
                      <BookOpen className="w-5 h-5 text-foreground" />
                    </div>
                    <span className="font-medium text-sm text-foreground">{s.name}</span>
                  </div>
                  <ExternalLink className="w-4 h-4 text-muted-foreground" />
                </a>
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
                <p className="text-sm text-muted-foreground">No papers available yet.</p>
              </div>
            ) : (
              subjects.filter(s => s.papers_url).map(s => (
                <a
                  key={s.id}
                  href={s.papers_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between p-4 rounded-2xl glass active:scale-[0.99] transition-all"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-foreground/10 flex items-center justify-center">
                      <FileText className="w-5 h-5 text-foreground" />
                    </div>
                    <span className="font-medium text-sm text-foreground">{s.name}</span>
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
