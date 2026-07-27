import { AccessToken } from 'livekit-server-sdk';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
    try {
        // 1. Extract parameters from the request body
        const body = await req.json();
        const { roomName, participantName, isHost, streamId } = body;

        // Default to viewer (false) if isHost isn't explicitly passed
        const hostStatus = Boolean(isHost);

        if (!roomName || !participantName) {
            return NextResponse.json(
                { error: 'Missing roomName or participantName' },
                { status: 400 }
            );
        }

        const apiKey = process.env.LIVEKIT_API_KEY;
        const apiSecret = process.env.LIVEKIT_API_SECRET;

        if (!apiKey || !apiSecret) {
            return NextResponse.json(
                { error: 'Server misconfigured: missing LiveKit credentials' },
                { status: 500 }
            );
        }

        // Prefix identity with 'host_' if isHost is true
        // This allows MultiSeatStage to identify Seat 0 without guessing
        // Strip any 'host_' prefix to guarantee viewers/guests aren't marked as host
        const viewerIdentity = participantName.replace(/^host_/, '');

        const at = new AccessToken(apiKey, apiSecret, {
            identity: viewerIdentity,
            ttl: '2h',
            metadata: JSON.stringify({
                role: 'viewer',
                streamId: streamId || roomName,
            }),
        });

        // 2. Grant permissions
        at.addGrant({
            room: roomName,
            roomJoin: true,
            canPublish: true,     // Allows camera/mic when promoted to stage
            canPublishData: true,      // Allows sending chat messages
            canSubscribe: true,        // Allows watching the broadcast
        });

        const token = await at.toJwt();
        return NextResponse.json({ token });
    } catch (error) {
        return NextResponse.json(
            { error: 'Failed to generate token' },
            { status: 500 }
        );
    }
}