'use client';

import Link from 'next/link';

export default function OfflinePage() {
  return (
    <div className="min-h-screen bg-[#1A1A1A] text-white flex items-center justify-center px-6">
      <div className="text-center max-w-md">
        <h1 className="display-text text-[clamp(40px,10vw,72px)] text-white leading-none mb-6">
          OFFLINE
        </h1>
        <p className="text-[#666] text-sm tracking-wide mb-8">
          NO CONNECTION. YOUR MOOD HISTORY IS SAVED LOCALLY.
        </p>
        <Link href="/" className="brutal-btn inline-block">
          TRY AGAIN
        </Link>
      </div>
    </div>
  );
}
