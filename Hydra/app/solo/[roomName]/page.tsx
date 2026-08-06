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

  const [token, setToken] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string>('guest_host');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function initSession() {
      try {
        // 1. Get current authenticated user session from Supabase
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user?.id) {
          setCurrentUserId(session.user.id);
        }

        // 2. Fetch LiveKit connection token
        const res = await fetch('/api/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            roomName,
            participantName: session?.user?.email?.split('@')[0] || hostName,
          }),
        });

        const data = await res.json();
        if (data.token) {
          setToken(data.token);
        }
      } catch (err) {
        console.error('Error initializing stream page:', err);
      } finally {
        setLoading(false);
      }
    }

    initSession();
  }, [roomName, hostName]);

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
      currentUserId={currentUserId} // 🟢 Passes authentic UUID
    />
  );
}