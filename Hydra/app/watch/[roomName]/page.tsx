'use client';

import { useEffect, useState, use } from 'react';
import { LiveKitRoom } from '@livekit/components-react';
import { MultiSeatStage } from '@/components/MultiSeatStage';
import { supabase } from '@/lib/supabaseClient'; // 👈 1. Import Supabase client
import { EntranceBanner } from '@/components/EntranceBanner';
import { useRouter, useParams } from 'next/navigation';

export default function WatchPage({ params }: { params: Promise<{ roomName: string }> }) {
  // 1. Unwrap the dynamic route params Promise (Next.js 15 style)
  const resolvedParams = use(params);
  const roomName = resolvedParams?.roomName;
  const router = useRouter();
  const [banMessage, setBanMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
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

        // 🟢 3. HANDLE PERSISTENT BAN (403 Forbidden)
        if (res.status === 403 || data.error?.toLowerCase().includes('banned')) {
          setBanMessage(data.error || 'You have been banned from this room by the host.');

          // Redirect to homepage after 3 seconds
          setTimeout(() => {
            router.push('/');
          }, 3000);
          return;
        }

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


// 🟢 1. Banned User Redirect View
  if (banMessage) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-slate-950 text-white px-4 text-center">
        <div className="bg-red-950/80 border border-red-500/50 rounded-2xl p-8 max-w-md shadow-2xl animate-fadeIn">
          <div className="text-4xl mb-3">🚫</div>
          <h1 className="text-lg font-bold text-red-400 mb-2">Access Denied</h1>
          <p className="text-sm text-slate-300 font-medium mb-4">{banMessage}</p>
          <div className="flex items-center justify-center gap-2 text-xs text-slate-500 font-mono">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
            Redirecting to home page...
          </div>
        </div>
      </div>
    );
  }

  // 2. General Error View
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-slate-950 text-white px-4 text-center">
        <p className="text-red-400 text-sm font-semibold mb-4">{error}</p>
        <button
          onClick={() => router.push('/')}
          className="bg-slate-800 hover:bg-slate-700 text-xs px-4 py-2 rounded-xl transition"
        >
          Return Home
        </button>
      </div>
    );
  }

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
        <EntranceBanner />
        <MultiSeatStage />
      </LiveKitRoom>
    </div>
  );
}