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
  const explicitHostParam = searchParams?.get('isHost') === 'true';

  const [token, setToken] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string>('guest_viewer');
  const [isHost, setIsHost] = useState<boolean>(false);
  const [loading, setLoading] = useState(true);




  useEffect(() => {
    async function initSession() {
      try {

        
        // 1. Get logged-in user session
        const {
          data: { session },
        } = await supabase.auth.getSession();
        const activeUserId = session?.user?.id || null;

        if (activeUserId) {
          setCurrentUserId(activeUserId);
        }

        // 2. Fetch stream record from Supabase to check the TRUE stream owner
        const { data: streamRecord } = await supabase
          .from('streams')
          .select('user_id')
          .eq('livekit_room_name', roomName)
          .maybeSingle();

        if (streamRecord && activeUserId) {
          // Stream exists in DB: You are ONLY the host if your auth ID matches stream.user_id
          setIsHost(streamRecord.user_id === activeUserId);
        } else {
          // If no stream in DB yet, strictly check if user navigated from "Go Solo" button
          setIsHost(explicitHostParam);
        }

        // 3. Fetch LiveKit connection token as participant
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