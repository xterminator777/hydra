// app/api/end-room/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { RoomServiceClient } from 'livekit-server-sdk';

const livekitUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL!;
const apiKey = process.env.LIVEKIT_API_KEY!;
const apiSecret = process.env.LIVEKIT_API_SECRET!;

const roomService = new RoomServiceClient(livekitUrl, apiKey, apiSecret);

export async function POST(req: NextRequest) {
  try {
    const { roomName } = await req.json();

    if (!roomName) {
      return NextResponse.json({ error: 'Missing roomName' }, { status: 400 });
    }

    try {
      // Deletes the room on LiveKit server (forces client teardown)
      await roomService.deleteRoom(roomName);
    } catch (err: any) {
      // If the room was already destroyed or 404s, ignore and proceed
      if (err?.status === 404 || err?.code === 'not_found') {
        console.log(`Room "${roomName}" was already deleted or not found.`);
      } else {
        throw err;
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete room:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}