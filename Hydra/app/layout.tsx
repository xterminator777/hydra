import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { Analytics } from '@vercel/analytics/next'; // 👈 1. IMPORT HERE
import '@livekit/components-styles'; // 👈 IMPORT LIVEKIT STYLES DIRECTLY HERE
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'OsirisCore Tech',
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
        <Analytics /> {/* 👈 2. RENDER COMPONENT HERE */}
      </body>
    </html>
  );
}
