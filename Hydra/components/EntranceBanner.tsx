'use client';

import React, { useEffect, useState } from 'react';
import { useRoomContext } from '@livekit/components-react';
import { RoomEvent, Participant } from 'livekit-client';

export function EntranceBanner() {
  const room = useRoomContext();
  const [announcement, setAnnouncement] = useState<string | null>(null);

  useEffect(() => {
    if (!room) return;

    const handleParticipantConnected = (participant: Participant) => {
      // Get participant handle (fallback to identity stripped of host_ prefix)
      const name =
        participant.name ||
        participant.identity.replace(/^host_/, '') ||
        'A guest';

      // Set the entrance text
      setAnnouncement(`✨ @${name} is coming...`);

      // Auto-hide the banner after 4 seconds
      const timer = setTimeout(() => {
        setAnnouncement(null);
      }, 4000);

      return () => clearTimeout(timer);
    };

    room.on(RoomEvent.ParticipantConnected, handleParticipantConnected);

    return () => {
      room.off(RoomEvent.ParticipantConnected, handleParticipantConnected);
    };
  }, [room]);

  if (!announcement) return null;

  return (
    <div className="pointer-events-none fixed top-10 left-1/2 z-50 -translate-x-1/2 transform transition-all duration-500 ease-out animate-bounce">
      <div className="flex items-center gap-2 rounded-full border border-indigo-500/30 bg-indigo-950/80 px-6 py-2.5 text-sm font-extrabold text-white shadow-[0_0_25px_rgba(99,102,241,0.5)] backdrop-blur-md">
        <span className="w-2 h-2 rounded-full bg-indigo-400 animate-ping" />
        <span>{announcement}</span>
      </div>
    </div>
  );
}