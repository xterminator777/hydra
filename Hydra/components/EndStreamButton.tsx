import { useRoomContext } from '@livekit/components-react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient'; // 👈 1. Import Supabase

export function EndStreamButton({ streamId }: { streamId: string }) {
  const room = useRoomContext();
  const router = useRouter();

  const handleEndStream = async () => {
    const confirmEnd = window.confirm("Are you sure you want to end the broadcast?");
    if (!confirmEnd) return;

    try {
      // 1. Update status in Supabase so directory reflects offline state
      await supabase
        .from('streams')
        .update({ is_live: false })
        .eq('id', streamId);

      // 2. Disconnect from LiveKit room
      if (room) {
        await room.disconnect();
      }

      // 3. Redirect host back home
      router.push('/');
    } catch (error) {
      console.error("Failed to end stream:", error);
    }
  };

  return (
    <button
      onClick={handleEndStream}
      className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-md hover:bg-red-700 transition-colors"
    >
      End Broadcast
    </button>
  );
}