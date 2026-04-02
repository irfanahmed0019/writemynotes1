import { useAuth } from '@/lib/auth';
import { Navigate, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { BookOpen, Banknote } from 'lucide-react';

export default function ModeSelect() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;

  const selectMode = async (mode: 'buyer' | 'seller') => {
    await supabase
      .from('profiles')
      .update({ mode })
      .eq('user_id', user.id);
    navigate('/marketplace');
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-black px-6">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold text-white" style={{ lineHeight: '1.1' }}>What brings you here?</h1>
          <p className="text-[#666] text-sm">You can always switch later</p>
        </div>

        <div className="space-y-3">
          <button
            onClick={() => selectMode('buyer')}
            className="w-full flex items-center gap-4 p-5 rounded-2xl bg-[#111] transition-all active:scale-[0.97]"
          >
            <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-[#1a1a1a]">
              <BookOpen className="w-6 h-6 text-white" />
            </div>
            <div className="text-left">
              <p className="font-bold text-white">I need notes</p>
              <p className="text-sm text-[#666]">Post a request, get it done</p>
            </div>
          </button>

          <button
            onClick={() => selectMode('seller')}
            className="w-full flex items-center gap-4 p-5 rounded-2xl bg-[#111] transition-all active:scale-[0.97]"
          >
            <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-[#1a1a1a]">
              <Banknote className="w-6 h-6 text-white" />
            </div>
            <div className="text-left">
              <p className="font-bold text-white">I want to earn</p>
              <p className="text-sm text-[#666]">Write notes, get paid</p>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
