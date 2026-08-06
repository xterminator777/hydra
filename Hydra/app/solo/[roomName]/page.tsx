import React from 'react';
import { SoloWatchRoom } from '@/components/SoloWatchRoom';

interface SoloPageProps {
  params: {
    roomName: string;
  };
  searchParams: {
    host?: string;
  };
}

export default async function SoloStreamPage({ params, searchParams }: SoloPageProps) {
  const roomName = params.roomName;
  const hostName = searchParams.host || 'Host';

  // Fetch LiveKit join token for solo stream
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/token`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        roomName,
        participantName: `viewer_${Math.floor(Math.random() * 1000)}`,
      }),
      cache: 'no-store',
    }
  );

  const data = await res.json();

  if (!data.token) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-950 text-white font-mono text-xs">
        Failed to connect to Solo Stream session.
      </div>
    );
  }

  return (
    <SoloWatchRoom
      roomName={roomName}
      token={data.token}
      hostName={hostName}
    />
  );
}