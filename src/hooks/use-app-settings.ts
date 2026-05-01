import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type FaqItem = { q: string; a: string };
export type AppSettings = {
  damu_daily_limit: { limit: number };
  hero: { title: string; subtitle: string; enabled: boolean };
  announcement: { text: string; enabled: boolean };
  faq: { enabled: boolean; items: FaqItem[] };
  feature_toggles: {
    faq: boolean;
    notes_upload: boolean;
    landing_faq: boolean;
    announcement: boolean;
    chatbot: boolean;
  };
  featured_notes: { ids: string[] };
};

const DEFAULTS: AppSettings = {
  damu_daily_limit: { limit: 30 },
  hero: { title: 'WriteMyNotes', subtitle: 'Get your records done. Or make money writing them.', enabled: true },
  announcement: { text: '', enabled: false },
  faq: { enabled: true, items: [] },
  feature_toggles: { faq: true, notes_upload: true, landing_faq: true, announcement: false, chatbot: true },
  featured_notes: { ids: [] },
};

export function useAppSettings() {
  const [settings, setSettings] = useState<AppSettings>(DEFAULTS);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase.from('app_settings' as any).select('key, value');
    if (data) {
      const merged = { ...DEFAULTS } as AppSettings;
      (data as any[]).forEach(row => {
        (merged as any)[row.key] = row.value;
      });
      setSettings(merged);
    }
    setLoaded(true);
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const ch = supabase
      .channel('app-settings-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'app_settings' }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [load]);

  return { settings, loaded, reload: load };
}

export async function updateAppSetting<K extends keyof AppSettings>(key: K, value: AppSettings[K]) {
  const { error } = await supabase
    .from('app_settings' as any)
    .upsert({ key, value, updated_at: new Date().toISOString() } as any, { onConflict: 'key' });
  return error;
}