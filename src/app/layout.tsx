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
  icons: {
    icon: [
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [
      { url: '/icons/icon-192.png', sizes: '192x192' },
    ],
  },
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
