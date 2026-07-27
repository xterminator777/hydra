import { AccessToken } from 'livekit-server-sdk';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: NextRequest) {
    try {
        // 1. Extract parameters from the request body
        const body = await req.json();
        const { roomName, participantName, isHost, streamId, userId } = body;

        const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!;
        const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
        const supabase = createClient(supabaseUrl, supabaseKey);

        let customUsername = participantName;
        let avatarUrl = '';

        if (userId) {
            const { data: profile } = await supabase
                .from('profiles')
                .select('username, avatar_url')
                .eq('id', userId)
                .single();

            if (profile) {
                customUsername = profile.username;
                avatarUrl = profile.avatar_url || '';
            }
        }

        const rawName = customUsername || 'Viewer';
        const viewerIdentity = rawName.replace(/^host_/, '');



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