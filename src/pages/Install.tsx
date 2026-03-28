import { useEffect, useState } from 'react';
import { Download, Check, Share, MoreVertical } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export default function Install() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    const ua = navigator.userAgent;
    setIsIOS(/iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream);

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', handler);
    window.addEventListener('appinstalled', () => setInstalled(true));

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') setInstalled(true);
    setDeferredPrompt(null);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-6">
      <div className="w-full max-w-sm space-y-8 text-center animate-fade-in">
        {/* Icon */}
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl glass">
          <span className="text-4xl">📝</span>
        </div>

        <div className="space-y-3">
          <h1 className="text-2xl font-bold tracking-tight text-foreground" style={{ lineHeight: '1.1' }}>
            Install WriteMyNotes
          </h1>
          <p className="text-muted-foreground text-sm">
            Get the full app experience — faster loading, works offline, and sits right on your home screen.
          </p>
        </div>

        {installed ? (
          <div className="flex items-center justify-center gap-2 h-14 rounded-xl bg-primary/15 text-primary font-semibold">
            <Check className="w-5 h-5" />
            App Installed!
          </div>
        ) : deferredPrompt ? (
          <button
            onClick={handleInstall}
            className="w-full flex items-center justify-center gap-3 h-14 rounded-xl bg-primary text-primary-foreground font-semibold text-base transition-all active:scale-[0.97] hover:shadow-lg"
          >
            <Download className="w-5 h-5" />
            Install App
          </button>
        ) : isIOS ? (
          <div className="space-y-4 p-5 rounded-2xl bg-card border border-border text-left">
            <p className="text-sm font-medium text-foreground">To install on iPhone:</p>
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-secondary text-foreground text-xs font-bold shrink-0">1</div>
                <p className="text-sm text-muted-foreground">
                  Tap the <Share className="inline w-4 h-4 text-foreground -mt-0.5" /> Share button in Safari
                </p>
              </div>
              <div className="flex items-start gap-3">
                <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-secondary text-foreground text-xs font-bold shrink-0">2</div>
                <p className="text-sm text-muted-foreground">
                  Scroll down and tap <span className="text-foreground font-medium">"Add to Home Screen"</span>
                </p>
              </div>
              <div className="flex items-start gap-3">
                <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-secondary text-foreground text-xs font-bold shrink-0">3</div>
                <p className="text-sm text-muted-foreground">
                  Tap <span className="text-foreground font-medium">"Add"</span> to confirm
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4 p-5 rounded-2xl bg-card border border-border text-left">
            <p className="text-sm font-medium text-foreground">To install on Android:</p>
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-secondary text-foreground text-xs font-bold shrink-0">1</div>
                <p className="text-sm text-muted-foreground">
                  Tap <MoreVertical className="inline w-4 h-4 text-foreground -mt-0.5" /> menu in Chrome
                </p>
              </div>
              <div className="flex items-start gap-3">
                <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-secondary text-foreground text-xs font-bold shrink-0">2</div>
                <p className="text-sm text-muted-foreground">
                  Tap <span className="text-foreground font-medium">"Install app"</span> or <span className="text-foreground font-medium">"Add to Home Screen"</span>
                </p>
              </div>
            </div>
          </div>
        )}

        <a href="/marketplace" className="block text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground transition-colors">
          Continue in browser
        </a>
      </div>
    </div>
  );
}
