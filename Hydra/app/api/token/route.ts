// app/api/token/route.ts
import { AccessToken } from 'livekit-server-sdk';
import { NextRequest, NextResponse } from 'next/server';

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

    at.addGrant({
      room,
      roomJoin: true,
      canPublish: hostStatus,    // Viewers (isHost: false) CANNOT publish video/audio
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