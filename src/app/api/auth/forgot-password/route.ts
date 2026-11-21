import { NextRequest, NextResponse } from 'next/server';
import { isConfiguredSpecialEmail } from '@/lib/server/account-seed';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const rawEmail = typeof body.email === 'string' ? body.email : '';
    const normalizedEmail = rawEmail.trim().toLowerCase();

    if (!normalizedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      return NextResponse.json(
        {
          error: "That email doesn't look right. Enter a valid email to reset your password.",
        },
        { status: 400 }
      );
    }

    // Security guardrail: special account cannot change its own password or trigger real emails
    if (isConfiguredSpecialEmail(normalizedEmail)) {
      console.info('[SERVER_AUTH_NOTICE] Password reset suppressed for protected account', {
        email: normalizedEmail,
        timestamp: new Date().toISOString(),
      });
      // Return identical response shape so the endpoint does not reveal the account is special
      return NextResponse.json({
        success: true,
        message: `If an account exists for ${normalizedEmail}, password reset instructions have been sent.`,
      });
    }

    return NextResponse.json({
      success: true,
      message: `If an account exists for ${normalizedEmail}, password reset instructions have been sent.`,
    });
  } catch (err: any) {
    console.error('[FORGOT_PASSWORD_ERROR]', err);
    return NextResponse.json(
      { error: 'Could not process password reset request.' },
      { status: 500 }
    );
  }
}
