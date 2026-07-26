'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { LiveKitRoom, VideoConference } from '@livekit/components-react';
import '@livekit/components-styles';

export default function WatchPage() {
  const params = useParams();
  const router = useRouter();
  const roomName = params.roomName as string;

  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!roomName) return;

    const fetchViewerToken = async () => {
      setLoading(true);
      setError(null);

      try {
        // Request a viewer token for this specific room
        const response = await fetch(`/api/streams/join`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            roomName,
            identity: `viewer_${Math.floor(Math.random() * 10000)}`,
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Failed to join stream session');
        }

        setToken(data.token);
      } catch (err: any) {
        console.error('Error fetching viewer token:', err);
        setError(err.message || 'Unable to connect to live stream');
      } finally {
        setLoading(false);
      }
    };

    fetchViewerToken();
  }, [roomName]);

  const livekitUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL;

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex flex-col items-center justify-center p-4">
        <div className="w-8 h-8 border-2 border-red-500 border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-sm text-gray-400">Joining stage: <span className="font-mono text-gray-200">{roomName}</span>...</p>
      </div>
    );
  }

  if (error || !token || !livekitUrl) {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex flex-col items-center justify-center p-4">
        <div className="max-w-md bg-gray-900 border border-gray-800 p-6 rounded-xl text-center space-y-4">
          <h2 className="text-xl font-bold text-red-400">Unable to Watch Stream</h2>
          <p className="text-xs text-gray-400">{error || 'Missing LiveKit connection URL'}</p>
          <button
            onClick={() => router.push('/')}
            className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-xs font-semibold rounded-lg text-white transition"
          >
            Back to Directory
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col">
      {/* Header Bar */}
      <header className="px-6 py-4 bg-gray-900 border-b border-gray-800 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/')}
            className="text-xs text-gray-400 hover:text-white underline"
          >
            ← Back to Directory
          </button>
          <span className="text-gray-700">|</span>
          <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
          <h1 className="font-bold text-sm">Room: {roomName}</h1>
        </div>
      </header>

      {/* LiveKit Player Area */}
      <main className="flex-1 relative">
        <LiveKitRoom
          video={false} // Viewers don't publish video
          audio={false} // Viewers don't publish audio
          token={token}
          serverUrl={livekitUrl}
          data-lk-theme="default"
          style={{ height: 'calc(100vh - 65px)' }}
          onDisconnected={() => router.push('/')}
        >
          <VideoConference />
        </LiveKitRoom>
      </main>
    </div>
  );
}