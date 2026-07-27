export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { AccessToken } from 'livekit-server-sdk';
import { createClient } from '@supabase/supabase-js';

export async function POST(request) {
  try {
    const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json(
        { error: 'Missing Supabase credentials in .env.local' },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await request.json();
    const { categorySlug, title, userId, participantName } = body;

    // 1. Guard against missing or unauthenticated userId
    if (!userId || userId === 'guest_user' || userId.startsWith('guest_')) {
      return NextResponse.json(
        { error: 'You must be logged in to start a broadcast stream.' },
        { status: 401 }
      );
    }


    if (!categorySlug || !title || !userId) {
      return NextResponse.json(
        { error: 'Missing required fields: categorySlug, title, or userId' },
        { status: 400 }
      );
    }

    // 1. Verify Category
    const { data: category, error: categoryError } = await supabase
      .from('categories')
      .select('id')
      .eq('slug', categorySlug)
      .single();

    if (categoryError || !category) {
      return NextResponse.json(
        { error: `Category '${categorySlug}' not found in Supabase` },
        { status: 404 }
      );
    }

    // 2. Generate Room Name
    const roomName = `room_${categorySlug}_${Date.now()}`;

    // 3. Insert Active Stream Row
    const { data: stream, error: streamError } = await supabase
      .from('streams')
      .insert({
        category_id: category.id,
        host_id: userId,
        livekit_room_name: roomName,
        title: title,
        is_live: true
      })
      .select()
      .single();

    if (streamError) {
      return NextResponse.json(
        { error: `Supabase Insert Error: ${streamError.message}` },
        { status: 500 }
      );
    }


    // 1. Fetch user profile if userId was passed
    let hostUsername = participantName;

    if (userId) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('username, avatar_url')
        .eq('id', userId)
        .maybeSingle();

      if (profile?.username) {
        hostUsername = profile.username;
      }
    }
    // 4. Issue LiveKit JWT Token
    const apiKey = process.env.LIVEKIT_API_KEY?.trim();
    const apiSecret = process.env.LIVEKIT_API_SECRET?.trim();

    if (!apiKey || !apiSecret) {
      return NextResponse.json(
        { error: 'Missing LiveKit credentials in .env.local' },
        { status: 500 }
      );
    }

    // Fall back to userId or body.username if participantName is missing from request
    const rawName = participantName || body.hostName || body.username || userId || 'Host';

    // Always format as host in the create route
    const formattedIdentity = `host_${rawName.replace(/^host_/, '')}`;

    const at = new AccessToken(apiKey, apiSecret, {
      identity: formattedIdentity,
      ttl: '2h',
      metadata: JSON.stringify({
        role: 'host',
        category: categorySlug,
        streamId: stream.id
      })
    });

    at.addGrant({
      room: roomName,
      roomJoin: true,
      canPublish: true,
      canPublishData: true,
      canSubscribe: true,
      roomAdmin: true
    });

    const token = await at.toJwt();

    return NextResponse.json({
      success: true,
      token,
      roomName,
      streamId: stream.id
    });

  } catch (err) {
    console.error('🔥 Stream Endpoint Exception:', err);
    return NextResponse.json(
      {
        error: 'Unhandled Endpoint Error',
        message: err.message,
        stack: err.stack
      },
      { status: 500 }
    );
  }
}