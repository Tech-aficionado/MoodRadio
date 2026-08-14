import type { Metadata, Viewport } from 'next';
import { Space_Grotesk } from 'next/font/google';
import './globals.css';
import { MoodProvider } from '@/context/MoodContext';
import { PlayerProvider } from '@/context/PlayerContext';
import { AuthProvider } from '@/context/AuthContext';
import { ServiceWorkerRegistration } from '@/components/ServiceWorkerRegistration';

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-space-grotesk',
});

export const viewport: Viewport = {
  themeColor: '#1A1A1A',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
};

export const metadata: Metadata = {
  title: 'MoodRadio',
  description: 'Music that reads your mood',
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'https://moodradio-red.vercel.app'),
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'MoodRadio',
  },
  openGraph: {
    title: 'MoodRadio',
    description: 'Music that reads your mood',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'MoodRadio',
    description: 'Music that reads your mood',
  },
  // No `icons:` block on purpose.
  //
  // An explicit metadata.icons OVERRIDES Next's file conventions, so declaring
  // the PNGs here meant src/app/icon.svg and src/app/apple-icon.png were never
  // linked in the HTML at all — the SVG was served but no browser ever used it,
  // and every tab fell back to a rasterised PNG. It also emitted three
  // competing `rel="icon"` tags.
  //
  // Letting the conventions win gives one crisp vector favicon plus a proper
  // apple-touch-icon, and the 192/512 PWA icons stay where they belong: in
  // public/manifest.json, which does not need <link rel="icon"> duplicates.
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${spaceGrotesk.variable} h-full antialiased`}>
      {/* No `overflow-hidden` here. It was locking scroll for the WHOLE app,
          so /history and /insights — both long `min-h-screen` pages — could
          never be scrolled at all. The immersive home screen constrains itself
          with `h-[100dvh] overflow-hidden` on its own <main>, so it does not
          need a global lock to stay fixed. */}
      <body className="bg-[#1A1A1A] text-white min-h-screen font-sans">
        <ServiceWorkerRegistration />
        <AuthProvider>
          <MoodProvider>
            <PlayerProvider>
              {children}
            </PlayerProvider>
          </MoodProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
