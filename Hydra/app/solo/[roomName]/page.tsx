'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { SoloWatchRoom } from '@/components/SoloWatchRoom';

export default function SoloStreamPage() {
  const params = useParams();
  const searchParams = useSearchParams();

  const roomName = (params?.roomName as string) || 'solo_room';
  const hostName = searchParams?.get('host') || 'Host';
  
  // 🟢 Explicit check: ONLY the "Start Solo Mobile Stream" banner link includes ?isHost=true
  const explicitHostParam = searchParams?.get('isHost') === 'true';

  const [token, setToken] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string>('guest_viewer');
  const [isHost, setIsHost] = useState<boolean>(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function initSession() {
      try {
        // 1. Fetch current logged-in user session
        const {
          data: { session },
        } = await supabase.auth.getSession();
        const activeUserId = session?.user?.id || null;

        if (activeUserId) {
          setCurrentUserId(activeUserId);
        }

        // 2. Fetch the stream record from Supabase
        const { data: streamRecord } = await supabase
          .from('streams')
          .select('user_id')
          .eq('livekit_room_name', roomName)
          .maybeSingle();

        if (streamRecord) {
          // 🔒 STREAM EXISTS IN DB:
          // You are ONLY the host if your active Supabase auth UUID matches streamRecord.user_id
          setIsHost(Boolean(activeUserId && streamRecord.user_id === activeUserId));
        } else {
          // 🔒 STREAM NOT IN DB YET:
          // You are ONLY the host if you clicked "Go Solo" (?isHost=true in URL)
          setIsHost(explicitHostParam);
        }

        // 3. Fetch LiveKit connection token for LiveKit WebRTC engine
        const participantName =
          session?.user?.email?.split('@')[0] ||
          `viewer_${Math.floor(Math.random() * 1000)}`;

        const res = await fetch('/api/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            roomName,
            participantName,
          }),
        });

        const data = await res.json();
        if (data.token) {
          setToken(data.token);
        }
      } catch (err) {
        console.error('Error initializing stream session:', err);
      } finally {
        setLoading(false);
      }
    }

    initSession();
  }, [roomName, hostName, explicitHostParam]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-black text-slate-400 font-mono text-xs">
        Loading stream session...
      </div>
    );
  }

  if (!token) {
    return (
      <div className="flex items-center justify-center h-screen bg-black text-red-400 font-mono text-xs">
        Failed to get stream token.
      </div>
    );
  }

  return (
    <SoloWatchRoom
      roomName={roomName}
      token={token}
      hostName={hostName}
      currentUserId={currentUserId}
      isHost={isHost}
    />
  );
}