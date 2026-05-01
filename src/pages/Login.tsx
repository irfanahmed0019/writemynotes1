import { useAuth } from '@/lib/auth';
import { Navigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useAppSettings } from '@/hooks/use-app-settings';
import FaqSection from '@/components/FaqSection';

export default function Login() {
  const { user, loading } = useAuth();
  const [signingIn, setSigningIn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { settings } = useAppSettings();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <Loader2 className="h-8 w-8 animate-spin text-[#444]" />
      </div>
    );
  }

  if (user) return <Navigate to="/marketplace" replace />;

  const handleGoogleLogin = async () => {
    setSigningIn(true);
    setError(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin,
      },
    });
    if (error) {
      setError(error.message);
      setSigningIn(false);
    }
    // On success Supabase redirects the browser — no further action needed
  };

  return (
    <div className="min-h-screen bg-black px-6 flex flex-col items-center justify-center py-10">
      <div className="w-full max-w-sm space-y-10">
        <div className="text-center space-y-4">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-[#111]">
            <span className="text-4xl">📝</span>
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-white" style={{ lineHeight: '1.05' }}>
            {settings.hero?.enabled ? settings.hero.title : 'WriteMyNotes'}
          </h1>
          <p className="text-[#666] text-sm">
            {settings.hero?.enabled ? settings.hero.subtitle : 'Get your records done. Or make money writing them.'}
          </p>
        </div>

        {error && (
          <p className="text-center text-sm text-red-400">{error}</p>
        )}

        <button
          onClick={handleGoogleLogin}
          disabled={signingIn}
          className="w-full flex items-center justify-center gap-3 h-14 rounded-2xl bg-white text-black font-semibold text-base transition-all active:scale-[0.97] disabled:opacity-50"
        >
          {signingIn ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <>
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Continue with Google
            </>
          )}
        </button>

        <p className="text-center text-xs text-[#444]">
          By signing in, you agree to keep it real 🤙
        </p>
      </div>

      {settings.feature_toggles?.landing_faq && settings.faq?.enabled && settings.faq.items?.length > 0 && (
        <div className="w-full mt-12">
          <FaqSection items={settings.faq.items} />
        </div>
      )}
    </div>
  );
}
