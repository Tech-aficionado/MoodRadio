import Link from 'next/link';
import type { ReactNode } from 'react';

/**
 * Shared shell for the legal pages.
 *
 * Matches the Brutalist Monochrome surface (#1A1A1A, hard #333 borders, Space
 * Grotesk) without pulling in the mood atmosphere — these pages have no
 * emotion, so a colour wash would be meaningless here.
 *
 * Body copy sits at white/70 (~9:1 on #1A1A1A) and meta at white/55 (~6:1).
 * The greys used elsewhere in this app (#555, #666) measured 2.3:1 and 3.0:1
 * and failed WCAG AA, so they are deliberately not reused.
 */
export function PolicyPage({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: ReactNode;
}) {
  return (
    <main className="min-h-screen bg-[#1A1A1A] text-white">
      <div className="absolute left-0 right-0 top-0 h-[3px] bg-[#333]" />

      <div className="mx-auto max-w-2xl px-6 py-16 sm:px-10 sm:py-24">
        <Link
          href="/"
          className="mb-12 inline-block text-[10px] font-bold uppercase tracking-[0.3em] text-white/55 transition-colors hover:text-white"
        >
          &larr; MoodRadio
        </Link>

        <h1 className="display-text mb-3 text-[clamp(36px,10vw,64px)] uppercase leading-[0.9]">
          {title}
        </h1>
        <p className="mb-14 text-[10px] font-bold uppercase tracking-[0.25em] text-white/55">
          Last updated {updated}
        </p>

        <div className="policy-body space-y-10">{children}</div>

        <div className="mt-20 flex flex-wrap gap-x-8 gap-y-3 border-t border-[#333] pt-8 text-[10px] font-bold uppercase tracking-[0.25em]">
          <Link href="/privacy" className="text-white/55 transition-colors hover:text-white">
            Privacy
          </Link>
          <Link href="/terms" className="text-white/55 transition-colors hover:text-white">
            Terms
          </Link>
          <Link href="/" className="text-white/55 transition-colors hover:text-white">
            Home
          </Link>
        </div>
      </div>
    </main>
  );
}

/** A titled section with a hard left rule, echoing the mood readout. */
export function Section({
  heading,
  children,
}: {
  heading: string;
  children: ReactNode;
}) {
  return (
    <section className="border-l-2 border-[#333] pl-5">
      <h2 className="mb-3 text-[11px] font-bold uppercase tracking-[0.25em] text-white">
        {heading}
      </h2>
      <div className="space-y-3 text-sm leading-relaxed text-white/70">
        {children}
      </div>
    </section>
  );
}
