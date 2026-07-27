'use client';

import { useEffect, useState, use } from 'react';
import { LiveKitRoom } from '@livekit/components-react';
import { MultiSeatStage } from '@/components/MultiSeatStage';

export default function WatchPage({ params }: { params: Promise<{ roomName: string }> }) {
  // 1. Unwrap the dynamic route params Promise (Next.js 15 style)
  const resolvedParams = use(params);
  const roomName = resolvedParams?.roomName;

  const [token, setToken] = useState<string>('');

  useEffect(() => {
    // Generate a quick guest fallback name if none exists
    const guestName = `Guest_${Math.floor(1000 + Math.random() * 9000)}`;

    async function fetchViewerToken() {
      try {
        const res = await fetch('/api/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            roomName: roomName || 'main-room', // Fallback room name
            participantName: guestName,        // Fallback participant name
            isHost: false,
          }),
        });

        const data = await res.json();
        
        if (!res.ok) {
          console.error('Token API error response:', data);
          return;
        }

        setToken(data.token);
      } catch (err) {
        console.error('Failed to fetch viewer token:', err);
      }
    }

    if (roomName) {
      fetchViewerToken();
    }
  }, [roomName]);

  if (!token) {
    return (
      <div className="h-screen bg-slate-950 text-slate-400 flex items-center justify-center font-mono">
        Connecting to stream...
      </div>
    );
  }

  return (
    <div className="w-full h-screen bg-black flex items-center justify-center">
      <LiveKitRoom
        video={false}
        audio={false}
        token={token}
        serverUrl={process.env.NEXT_PUBLIC_LIVEKIT_URL}
        connect={true}
      >
        <MultiSeatStage />
      </LiveKitRoom>
    </div>
  );
}