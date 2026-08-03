import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { SpeedInsights } from "@vercel/speed-insights/next"
import { Analytics } from '@vercel/analytics/next'; // 👈 1. IMPORT HERE
import '@livekit/components-styles'; // 👈 IMPORT LIVEKIT STYLES DIRECTLY HERE
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'NeoPulse.live',
  description: 'Multi-seat live streaming and interactive video broadcasts.',
  icons: {
    icon: '/favicon.ico',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        {children}
        <SpeedInsights /> {/* 👈 1. RENDER COMPONENT HERE */  }
        <Analytics /> {/* 👈 2. RENDER COMPONENT HERE */}
      </body>
    </html>
  );
}
