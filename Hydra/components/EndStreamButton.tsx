// EndStreamButton.tsx
'use client';

import { useRouter } from 'next/navigation';
import { useRoomContext } from '@livekit/components-react';
import { supabase } from '@/lib/supabaseClient';

interface EndStreamButtonProps {
  streamId: string;
}

export function EndStreamButton({ streamId }: EndStreamButtonProps) {
  const room = useRoomContext(); // 👈 Pull room object
  const router = useRouter();

  const handleEndStream = async () => {
    if (!window.confirm("Are you sure you want to end the broadcast for everyone?")) return;

    // Get the exact active room name from the LiveKit room context
    const activeRoomName = room?.name || streamId;

    try {
      // 1. Mark stream as offline in Supabase first
      await supabase
        .from('streams')
        .update({ is_live: false })
        .eq('id', streamId);

      // 2. Call API route with the EXACT active room name
      const res = await fetch('/api/end-room', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomName: activeRoomName }),
      });

      if (!res.ok) {
        console.error("API failed to delete room:", await res.text());
      }

      // 3. Disconnect local host & redirect home
      if (room) {
        await room.disconnect();
      }
      router.push('/');
    } catch (error) {
      console.error("Failed to end stream:", error);
    }
  };

  return (
    <button
      onClick={handleEndStream}
      className="bg-red-600/80 hover:bg-red-600 text-white font-bold text-[10px] px-2.5 py-1 rounded-full border border-red-500/30 transition transform active:scale-95 shadow z-50"
    >
      End Live
    </button>
  );
}