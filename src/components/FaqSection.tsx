import { useState } from 'react';
import { ChevronDown, HelpCircle } from 'lucide-react';
import type { FaqItem } from '@/hooks/use-app-settings';

export default function FaqSection({ items, className = '' }: { items: FaqItem[]; className?: string }) {
  const [openIdx, setOpenIdx] = useState<number | null>(0);
  if (!items || items.length === 0) return null;
  return (
    <section className={`px-5 pt-6 pb-10 max-w-2xl mx-auto ${className}`} aria-labelledby="faq-heading">
      <div className="flex items-center gap-2 mb-4">
        <HelpCircle className="w-4 h-4 text-muted-foreground" />
        <h2 id="faq-heading" className="text-sm font-bold text-foreground uppercase tracking-widest">FAQ</h2>
      </div>
      <div className="space-y-2">
        {items.map((item, i) => {
          const open = openIdx === i;
          return (
            <div key={i} className="rounded-2xl bg-card border border-border overflow-hidden">
              <button
                onClick={() => setOpenIdx(open ? null : i)}
                className="w-full flex items-center justify-between gap-3 text-left px-4 py-3.5 active:bg-secondary/50 transition-colors"
                aria-expanded={open}
              >
                <span className="text-sm font-bold text-foreground">{item.q}</span>
                <ChevronDown className={`w-4 h-4 text-muted-foreground shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
              </button>
              {open && (
                <div className="px-4 pb-4 text-sm leading-relaxed text-secondary-foreground">
                  {item.a}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}