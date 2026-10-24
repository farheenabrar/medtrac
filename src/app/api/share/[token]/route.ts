import { NextRequest, NextResponse } from 'next/server';

function isSupabaseConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return Boolean(url && anon && !url.includes('your-project-id') && !anon.includes('your-anon-key'));
}

export async function GET(
  req: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    const { token } = params;
    if (!token) {
      return NextResponse.json({ error: 'Token is required' }, { status: 400 });
    }

    if (!isSupabaseConfigured()) {
      return NextResponse.json(
        { error: 'Supabase storage is not configured for public link resolution. Using browser cached session.' },
        { status: 404 }
      );
    }

    const { createAdminClient } = await import('@/lib/supabase/admin');
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from('shares')
      .select('*')
      .eq('token', token)
      .single();

    if (error || !data) {
      return NextResponse.json(
        { error: 'Share link not found or invalid' },
        { status: 404 }
      );
    }

    if (data.is_revoked) {
      return NextResponse.json(
        { error: 'This doctor share link has been revoked by the patient.' },
        { status: 410 }
      );
    }

    const now = new Date();
    const expiry = new Date(data.expires_at);
    if (now > expiry) {
      return NextResponse.json(
        { error: 'This doctor share link has expired (24h limit reached).' },
        { status: 410 }
      );
    }

    // Increment view count asynchronously
    await supabase
      .from('shares')
      .update({ view_count: (data.view_count || 0) + 1 })
      .eq('id', data.id);

    return NextResponse.json({
      success: true,
      brief: data.brief_content,
      expiresAt: data.expires_at,
      doctorType: data.doctor_type,
      viewCount: (data.view_count || 0) + 1,
    });
  } catch (err: any) {
    console.error('Error fetching share:', err);
    return NextResponse.json(
      { error: err.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
