import { NextResponse } from 'next/server';
import { RoomServiceClient } from 'livekit-server-sdk';
import { supabase } from '@/lib/supabaseClient';

const livekitHost = process.env.NEXT_PUBLIC_LIVEKIT_URL || '';
const apiKey = process.env.LIVEKIT_API_KEY || '';
const apiSecret = process.env.LIVEKIT_API_SECRET || '';

const roomService = new RoomServiceClient(
  livekitHost.replace(/^ws/, 'http'),
  apiKey,
  apiSecret
);

export async function POST(request: Request) {
  try {
    const { roomName, identity, action, hostUserId } = await request.json();

    if (!roomName || !identity) {
      return NextResponse.json(
        { error: 'Missing roomName or identity' },
        { status: 400 }
      );
    }

    // 1. Verify that the requester is actually the host of the stream
    const { data: stream } = await supabase
      .from('streams')
      .select('host_id')
      .eq('livekit_room_name', roomName)
      .maybeSingle();

    if (!stream || stream.host_id !== hostUserId) {
      return NextResponse.json(
        { error: 'Unauthorized: Only the host can kick or ban users.' },
        { status: 403 }
      );
    }

    // 2. Disconnect participant from LiveKit Room
    await roomService.removeParticipant(roomName, identity);

    // 3. If action is 'ban', save to a banned_users table (or track in DB)
    if (action === 'ban') {
      await supabase.from('banned_users').insert({
        livekit_room_name: roomName,
        identity: identity,
        banned_by: hostUserId,
      });
    }

    return NextResponse.json({ success: true, action, identity });
  } catch (err: any) {
    console.error('Error executing kick/ban:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to remove participant' },
      { status: 500 }
    );
  }
}