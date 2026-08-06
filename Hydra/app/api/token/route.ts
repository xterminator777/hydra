// app/api/token/route.ts
import { AccessToken } from 'livekit-server-sdk';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { roomName, participantName, userId, isHost } = body;

    // Initialize Supabase Client
    const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    let resolvedIdentity = participantName;

    // 🟢 Double-check Supabase profiles table for the true username
    if (userId) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('username')
        .eq('id', userId)
        .maybeSingle();

      if (profile?.username) {
        resolvedIdentity = profile.username;
      }
    }

    // Use provided values or intelligent fallbacks
    const room = roomName || 'main-room';
    const identity = resolvedIdentity || `Viewer_${Math.floor(1000 + Math.random() * 9000)}`;

    const apiKey = process.env.LIVEKIT_API_KEY;
    const apiSecret = process.env.LIVEKIT_API_SECRET;

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

    // Generate JWT token with resolved username identity
    const at = new AccessToken(apiKey, apiSecret, {
      identity,
      name: identity,
    });

    // GRANT PERMISSIONS:
    at.addGrant({
      room,
      roomJoin: true,
      canPublish: true,
      canPublishData: true,
      canSubscribe: true,
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