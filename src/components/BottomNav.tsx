import { useLocation, useNavigate } from 'react-router-dom';
import { Home, Activity, BookOpen, User, Shield } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { useEffect, useState } from 'react';

const baseTabs = [
  { path: '/marketplace', icon: Home, label: 'Home' },
  { path: '/activity', icon: Activity, label: 'Activity' },
  { path: '/study', icon: BookOpen, label: 'Study' },
  { path: '/profile', icon: User, label: 'Profile' },
];

export default function BottomNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase.from('user_roles' as any).select('role').eq('user_id', user.id).eq('role', 'admin')
      .then(({ data }) => { setIsAdmin(Array.isArray(data) && data.length > 0); });
  }, [user]);

  const tabs = isAdmin
    ? [...baseTabs, { path: '/admin', icon: Shield, label: 'Admin' }]
    : baseTabs;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-background border-t border-[#1a1a1a]">
      <div className="flex items-center justify-around h-16 max-w-lg mx-auto">
        {tabs.map(tab => {
          const active = location.pathname.startsWith(tab.path);
          return (
            <button
              key={tab.path}
              onClick={() => navigate(tab.path)}
              className="flex flex-col items-center gap-1 py-2 px-3 transition-all active:scale-[0.9]"
            >
              <tab.icon className={`w-5 h-5 ${active ? 'text-white' : 'text-[#666]'}`} strokeWidth={active ? 2.5 : 1.5} />
              <span className={`text-[10px] ${active ? 'text-white font-bold' : 'text-[#666] font-medium'}`}>
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
