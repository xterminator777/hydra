'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { SoloWatchRoom } from '@/components/SoloWatchRoom';

export default function SoloStreamPage() {
  const params = useParams();
  const searchParams = useSearchParams();

  const roomName = (params?.roomName as string) || 'solo_room';
  const urlHostParam = searchParams?.get('host') || 'Streamer';
  const explicitHostParam = searchParams?.get('isHost') === 'true';

  const [token, setToken] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string>('guest_viewer');
  const [hostName, setHostName] = useState<string>(urlHostParam);
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

        // 2. Fetch stream record + creator profile from Supabase
        const { data: streamRecord } = await supabase
          .from('streams')
          .select(`
            user_id,
            profiles (
              username
            )
          `)
          .eq('livekit_room_name', roomName)
          .maybeSingle();

        if (streamRecord) {
          // Verify if current user is true owner
          setIsHost(Boolean(activeUserId && streamRecord.user_id === activeUserId));

          // Set the true streamer's username from DB if available
          const dbUsername = (streamRecord.profiles as any)?.username;
          if (dbUsername) {
            setHostName(dbUsername);
          }
        } else {
          // If not in DB yet, fallback to URL params
          setIsHost(explicitHostParam);
          if (urlHostParam && urlHostParam !== 'Streamer') {
            setHostName(urlHostParam);
          }
        }

        // 3. Request LiveKit token
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
  }, [roomName, urlHostParam, explicitHostParam]);

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