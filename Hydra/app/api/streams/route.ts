import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { RoomServiceClient } from 'livekit-server-sdk';

const livekitUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL!;
const apiKey = process.env.LIVEKIT_API_KEY!;
const apiSecret = process.env.LIVEKIT_API_SECRET!;

const roomService = new RoomServiceClient(livekitUrl, apiKey, apiSecret);

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const categorySlug = searchParams.get('category');

  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // 1. Fetch active rooms directly from LiveKit's server
  let activeLiveKitRooms: string[] = [];
  try {
    const rooms = await roomService.listRooms();
    activeLiveKitRooms = rooms.map((r) => r.name);
  } catch (err) {
    console.error('Failed to fetch active rooms from LiveKit:', err);
  }
// 2. Fetch streams marked as live in Supabase
  let query = supabase
    .from('streams')
    .select(`
      id,
      title,
      livekit_room_name,
      created_at,
      categories!inner(name, slug)
    `)
    .eq('is_live', true)
    .order('created_at', { ascending: false });

  if (categorySlug) {
    query = query.eq('categories.slug', categorySlug);
  }

  const { data: streams, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const trulyLiveStreams = [];

  for (const stream of streams || []) {
    const isActuallyLive = activeLiveKitRooms.includes(stream.livekit_room_name);

    if (isActuallyLive) {
      trulyLiveStreams.push(stream);
    } else {
      // Clean up stale database record asynchronously
      supabase
        .from('streams')
        .update({ is_live: false })
        .eq('id', stream.id)
        .then();
    }
  }

  return NextResponse.json({ streams });
}