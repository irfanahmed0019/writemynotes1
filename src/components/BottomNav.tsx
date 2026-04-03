import { useLocation, useNavigate } from 'react-router-dom';
import { Home, MessageCircle, BookOpen, User, Shield } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { useUiLayout } from '@/hooks/use-ui-layout';
import { supabase } from '@/integrations/supabase/client';
import { useEffect, useState } from 'react';

const ICON_MAP: Record<string, any> = {
  Home, MessageCircle, BookOpen, User, Shield,
};

const PATH_MAP: Record<string, string> = {
  home: '/marketplace',
  chat: '/chats',
  study: '/study',
  profile: '/profile',
  admin: '/admin',
};

export default function BottomNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { bottomItems } = useUiLayout();
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase.from('user_roles' as any).select('role').eq('user_id', user.id).eq('role', 'admin')
      .then(({ data }) => { setIsAdmin(Array.isArray(data) && data.length > 0); });
  }, [user]);

  const visibleTabs = bottomItems.filter(item => {
    if (item.key === 'admin' && !isAdmin) return false;
    return true;
  });

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-black border-t border-[#1a1a1a] pb-[env(safe-area-inset-bottom)]">
      <div className="flex items-center justify-around h-14 max-w-lg mx-auto">
        {visibleTabs.map(item => {
          const path = PATH_MAP[item.key] || `/${item.key}`;
          const active = location.pathname.startsWith(path);
          const Icon = ICON_MAP[item.icon] || Home;
          return (
            <button
              key={item.key}
              onClick={() => navigate(path)}
              className="flex flex-col items-center gap-0.5 py-1.5 px-3 transition-all active:scale-[0.9]"
            >
              <Icon className={`w-5 h-5 ${active ? 'text-white' : 'text-[#666]'}`} strokeWidth={active ? 2.5 : 1.5} />
              <span className={`text-[10px] ${active ? 'text-white font-bold' : 'text-[#666] font-medium'}`}>
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
