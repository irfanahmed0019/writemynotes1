import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { BookOpen, FileText, Clock, Home, ExternalLink } from 'lucide-react';
import BottomNav from '@/components/BottomNav';

type StudyConfig = { id: string; semester_label: string; timetable_url: string };
type StudySubject = { id: string; name: string; notes_url: string; papers_url: string; sort_order: number };
type SubTab = 'home' | 'papers' | 'notes' | 'timetable';

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
    { key: 'timetable', label: 'Timetable', icon: Clock },
  ];

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-xl border-b border-border px-4 pt-4 pb-3">
        <div className="flex items-center gap-2 mb-3">
          <BookOpen className="w-5 h-5 text-primary" />
          <h1 className="text-xl font-bold text-foreground">
            Polytechnic Notes {config ? `(${config.semester_label})` : ''}
          </h1>
        </div>
        <div className="flex gap-2">
          {subTabs.map(t => (
            <button
              key={t.key}
              onClick={() => setSubTab(t.key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                subTab === t.key ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground'
              }`}
            >
              <t.icon className="w-3.5 h-3.5" />
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 py-4 max-w-2xl mx-auto space-y-3">
        {/* Home */}
        {subTab === 'home' && (
          <>
            <p className="text-sm text-muted-foreground mb-4">
              Access all your semester {config?.semester_label || ''} resources — notes, previous papers, and timetable.
            </p>
            {subjects.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-12">
                No subjects added yet. Admin can add them from the dashboard.
              </p>
            ) : (
              subjects.map(s => (
                <div key={s.id} className="p-4 rounded-xl bg-card border border-border">
                  <h3 className="font-semibold text-sm text-foreground mb-2">{s.name}</h3>
                  <div className="flex gap-2">
                    {s.notes_url && (
                      <a
                        href={s.notes_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-xs font-medium"
                      >
                        <BookOpen className="w-3 h-3" /> Notes <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                    {s.papers_url && (
                      <a
                        href={s.papers_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-secondary text-foreground text-xs font-medium"
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
              <p className="text-sm text-muted-foreground text-center py-12">No notes available yet.</p>
            ) : (
              subjects.filter(s => s.notes_url).map(s => (
                <a
                  key={s.id}
                  href={s.notes_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between p-4 rounded-xl bg-card border border-border active:scale-[0.99] transition-transform"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <BookOpen className="w-5 h-5 text-primary" />
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
              <p className="text-sm text-muted-foreground text-center py-12">No papers available yet.</p>
            ) : (
              subjects.filter(s => s.papers_url).map(s => (
                <a
                  key={s.id}
                  href={s.papers_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between p-4 rounded-xl bg-card border border-border active:scale-[0.99] transition-transform"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center">
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

        {/* Timetable */}
        {subTab === 'timetable' && (
          <>
            <h2 className="text-lg font-bold text-foreground">Timetable</h2>
            {config?.timetable_url ? (
              <a
                href={config.timetable_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between p-4 rounded-xl bg-card border border-border active:scale-[0.99] transition-transform"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Clock className="w-5 h-5 text-primary" />
                  </div>
                  <span className="font-medium text-sm text-foreground">
                    View {config.semester_label} Timetable
                  </span>
                </div>
                <ExternalLink className="w-4 h-4 text-muted-foreground" />
              </a>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-12">No timetable link set yet.</p>
            )}
          </>
        )}
      </div>

      <BottomNav />
    </div>
  );
}
