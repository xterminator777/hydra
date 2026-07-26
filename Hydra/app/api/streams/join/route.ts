import { NextResponse } from 'next/server';
import { AccessToken } from 'livekit-server-sdk';

export async function POST(request: Request) {
  try {
    const { roomName, identity } = await request.json();

    if (!roomName) {
      return NextResponse.json({ error: 'roomName is required' }, { status: 400 });
    }

    const apiKey = process.env.LIVEKIT_API_KEY;
    const apiSecret = process.env.LIVEKIT_API_SECRET;

    if (!apiKey || !apiSecret) {
      return NextResponse.json(
        { error: 'LiveKit server credentials missing' },
        { status: 500 }
      );
    }

    // Generate token with subscriber permissions (no publishing)
    const at = new AccessToken(apiKey, apiSecret, {
      identity: identity || `viewer_${Date.now()}`,
    });

    at.addGrant({
      room: roomName,
      roomJoin: true,
      canPublish: false,       // Viewers cannot transmit video/audio
      canPublishData: true,    // Viewers CAN send chat messages
      canSubscribe: true,      // Viewers CAN watch streams
    });

    const token = await at.toJwt();

    return NextResponse.json({ token });
  } catch (error: any) {
    console.error('Error generating viewer token:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}