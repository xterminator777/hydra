// app/api/token/route.ts
import { AccessToken } from 'livekit-server-sdk';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { roomName, participantName, isHost } = body;

    // Use provided values or intelligent fallbacks
    const room = roomName || 'main-room';
    const identity = participantName || `Viewer_${Math.floor(1000 + Math.random() * 9000)}`;
    const hostStatus = Boolean(isHost);

    const apiKey = process.env.LIVEKIT_API_KEY;
    const apiSecret = process.env.LIVEKIT_API_SECRET;

    // Initialize Supabase Client
    const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 🟢 PERSISTENT BAN CHECK: Reject banned participants
    const { data: isBanned, error: banError } = await supabase
      .from('banned_users')
      .select('id')
      .ilike('livekit_room_name', room)
      .or(`identity.eq.${identity},identity.eq.host_${identity}`)
      .maybeSingle();

    if (banError) {
      console.error('Error checking ban status:', banError.message);
    }

    if (isBanned) {
      return NextResponse.json(
        { error: 'You have been banned from this room by the host.' },
        { status: 403 }
      );
    }

    if (!apiKey || !apiSecret) {
      return NextResponse.json(
        { error: 'Server configuration error: missing LiveKit API credentials in .env.local' },
        { status: 500 }
      );
    }

    // Generate JWT token
    const at = new AccessToken(apiKey, apiSecret, {
      identity,
    });
// GRANT PERMISSIONS:
    // We allow publishing on the token level, but the viewer connects with video/audio OFF.
    // They only publish when explicitly calling setCameraEnabled(true) on "+ Join"!
    at.addGrant({
      room,
      roomJoin: true,
      canPublish: true,    // <-- Set to true so guests can publish when they tap Join
      canPublishData: true,     // Viewers CAN publish chat messages
      canSubscribe: true,       // Viewers CAN watch host video/audio
    });

    const token = await at.toJwt();
    return NextResponse.json({ token });
  } catch (error) {
    console.error('Token generation error:', error);
    return NextResponse.json(
      { error: 'Failed to generate token' },
      { status: 500 }
    );
  }
}