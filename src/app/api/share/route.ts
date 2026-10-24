import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

function isSupabaseConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return Boolean(url && anon && !url.includes('your-project-id') && !anon.includes('your-anon-key'));
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { doctorType, briefContent } = body;

    const token = crypto.randomBytes(16).toString('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // 24 hours

    if (!isSupabaseConfigured()) {
      // In local/preview mode, return token for browser persistence
      return NextResponse.json({
        success: true,
        token,
        expiresAt,
        fallbackLocal: true,
      });
    }

    try {
      const { createClient } = await import('@/lib/supabase/server');
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      const { data, error } = await supabase
        .from('shares')
        .insert({
          user_id: user?.id || null,
          token,
          doctor_type: doctorType,
          brief_content: briefContent,
          expires_at: expiresAt,
          is_revoked: false,
          view_count: 0,
        })
        .select()
        .single();

      if (error) {
        console.warn('Supabase share insert failed, returning token for local storage mode:', error.message);
        return NextResponse.json({
          success: true,
          token,
          expiresAt,
          fallbackLocal: true,
        });
      }

      return NextResponse.json({
        success: true,
        token,
        expiresAt: data.expires_at,
      });
    } catch (dbErr: any) {
      console.warn('Supabase share client error, fallback active:', dbErr.message);
      return NextResponse.json({
        success: true,
        token,
        expiresAt,
        fallbackLocal: true,
      });
    }
  } catch (error: any) {
    console.error('Share generation error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create share link' },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const token = searchParams.get('token');

    if (!token) {
      return NextResponse.json({ error: 'Token is required' }, { status: 400 });
    }

    if (isSupabaseConfigured()) {
      try {
        const { createClient } = await import('@/lib/supabase/server');
        const supabase = createClient();
        await supabase
          .from('shares')
          .update({ is_revoked: true })
          .eq('token', token);
      } catch (err: any) {
        console.warn('Supabase revoke warning:', err.message);
      }
    }

    return NextResponse.json({ success: true, revoked: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
