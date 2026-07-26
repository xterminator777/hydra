import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const categorySlug = searchParams.get('category');

  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

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

  return NextResponse.json({ streams });
}