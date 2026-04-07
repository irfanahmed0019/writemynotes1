import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type LayoutItem = {
  id: string;
  key: string;
  label: string;
  icon: string;
  visible: boolean;
  position: 'bottom' | 'header';
  sort_order: number;
};

const DEFAULT_ITEMS: LayoutItem[] = [
  { id: '1', key: 'home', label: 'Home', icon: 'Home', visible: true, position: 'bottom', sort_order: 0 },
  { id: '3', key: 'study', label: 'Study', icon: 'BookOpen', visible: true, position: 'bottom', sort_order: 1 },
  { id: '4', key: 'profile', label: 'Profile', icon: 'User', visible: true, position: 'bottom', sort_order: 2 },
  { id: '5', key: 'admin', label: 'Admin', icon: 'Shield', visible: true, position: 'bottom', sort_order: 3 },
  { id: '6', key: 'post', label: 'Post', icon: 'Plus', visible: true, position: 'header', sort_order: 0 },
  { id: '2', key: 'chat', label: 'Chat', icon: 'Send', visible: true, position: 'header', sort_order: 1 },
  { id: '7', key: 'activity', label: 'Activity', icon: 'Sparkles', visible: true, position: 'header', sort_order: 2 },
  { id: '8', key: 'install', label: 'Install', icon: 'Download', visible: true, position: 'header', sort_order: 3 },
  { id: '9', key: 'chatbot', label: 'Damu Bot', icon: 'Bot', visible: true, position: 'header', sort_order: 4 },
];

export function useUiLayout() {
  const [items, setItems] = useState<LayoutItem[]>(DEFAULT_ITEMS);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    supabase.from('ui_layout' as any).select('*').order('sort_order', { ascending: true })
      .then(({ data }) => {
        if (data && data.length > 0) setItems(data as any);
        setLoaded(true);
      });
  }, []);

  const bottomItems = items.filter(i => i.position === 'bottom' && i.visible).sort((a, b) => a.sort_order - b.sort_order);
  const headerItems = items.filter(i => i.position === 'header' && i.visible).sort((a, b) => a.sort_order - b.sort_order);

  return { items, bottomItems, headerItems, loaded, setItems };
}
