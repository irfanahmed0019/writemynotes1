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
    <div className="min-h-screen flex flex-col items-center justify-center bg-black px-6">
      <div className="w-full max-w-sm space-y-8 text-center">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-[#111]">
          <span className="text-4xl">📝</span>
        </div>

        <div className="space-y-3">
          <h1 className="text-2xl font-bold tracking-tight text-white" style={{ lineHeight: '1.1' }}>
            Install WriteMyNotes
          </h1>
          <p className="text-[#666] text-sm">
            Get the full app experience — faster loading, works offline, and sits right on your home screen.
          </p>
        </div>

        {installed ? (
          <div className="flex items-center justify-center gap-2 h-14 rounded-2xl bg-[#111] text-[#888] font-bold">
            <Check className="w-5 h-5" />
            App Installed!
          </div>
        ) : deferredPrompt ? (
          <button
            onClick={handleInstall}
            className="w-full flex items-center justify-center gap-3 h-14 rounded-2xl bg-white text-black font-bold text-base transition-all active:scale-[0.97]"
          >
            <Download className="w-5 h-5" />
            Install App
          </button>
        ) : isIOS ? (
          <div className="space-y-4 p-5 rounded-2xl bg-[#111] text-left">
            <p className="text-sm font-bold text-white">To install on iPhone:</p>
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="flex items-center justify-center w-7 h-7 rounded-xl bg-[#1a1a1a] text-white text-xs font-bold shrink-0">1</div>
                <p className="text-sm text-[#888]">
                  Tap the <Share className="inline w-4 h-4 text-white -mt-0.5" /> Share button in Safari
                </p>
              </div>
              <div className="flex items-start gap-3">
                <div className="flex items-center justify-center w-7 h-7 rounded-xl bg-[#1a1a1a] text-white text-xs font-bold shrink-0">2</div>
                <p className="text-sm text-[#888]">
                  Scroll down and tap <span className="text-white font-semibold">"Add to Home Screen"</span>
                </p>
              </div>
              <div className="flex items-start gap-3">
                <div className="flex items-center justify-center w-7 h-7 rounded-xl bg-[#1a1a1a] text-white text-xs font-bold shrink-0">3</div>
                <p className="text-sm text-[#888]">
                  Tap <span className="text-white font-semibold">"Add"</span> to confirm
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4 p-5 rounded-2xl bg-[#111] text-left">
            <p className="text-sm font-bold text-white">To install on Android:</p>
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="flex items-center justify-center w-7 h-7 rounded-xl bg-[#1a1a1a] text-white text-xs font-bold shrink-0">1</div>
                <p className="text-sm text-[#888]">
                  Tap <MoreVertical className="inline w-4 h-4 text-white -mt-0.5" /> menu in Chrome
                </p>
              </div>
              <div className="flex items-start gap-3">
                <div className="flex items-center justify-center w-7 h-7 rounded-xl bg-[#1a1a1a] text-white text-xs font-bold shrink-0">2</div>
                <p className="text-sm text-[#888]">
                  Tap <span className="text-white font-semibold">"Install app"</span> or <span className="text-white font-semibold">"Add to Home Screen"</span>
                </p>
              </div>
            </div>
          </div>
        )}

        <a href="/marketplace" className="block text-sm text-[#444] underline underline-offset-4">
          Continue in browser
        </a>
      </div>
    </div>
  );
}
