'use client';

import { useEffect, useState, use } from 'react';
import { LiveKitRoom } from '@livekit/components-react';
import { MultiSeatStage } from '@/components/MultiSeatStage';
import { supabase } from '@/lib/supabaseClient'; // 👈 1. Import Supabase client

export default function WatchPage({ params }: { params: Promise<{ roomName: string }> }) {
  // 1. Unwrap the dynamic route params Promise (Next.js 15 style)
  const resolvedParams = use(params);
  const roomName = resolvedParams?.roomName;

  const [token, setToken] = useState<string>('');

  useEffect(() => {
    async function fetchViewerToken() {
      try {
        // 2. Fetch authenticated user from Supabase
        const { data: { user } } = await supabase.auth.getUser();

        let activeName = `Guest_${Math.floor(1000 + Math.random() * 9000)}`;
        let userId: string | undefined = undefined;

        if (user) {
          userId = user.id;

          // Query user profile handle
          const { data: profile } = await supabase
            .from('profiles')
            .select('username')
            .eq('id', user.id)
            .maybeSingle();

          if (profile?.username) {
            activeName = profile.username;
          }
        }

        // 3. Call stream join endpoint passing userId & profile handle
        const res = await fetch('/api/streams/join', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            roomName: roomName || 'main-room',
            participantName: activeName,
            userId: userId,
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