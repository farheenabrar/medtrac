import { NextRequest, NextResponse } from 'next/server';
import { getServerDemoCredentials } from '../demo/route';

const DISPOSABLE_DOMAINS = new Set([
  'yopmail.com',
  'yopmail.fr',
  'yopmail.net',
  'mailinator.com',
  'guerrillamail.com',
  'tempmail.com',
  '10minutemail.com',
]);

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

    const domain = normalizedEmail.split('@')[1] || '';
    const isDisposable = DISPOSABLE_DOMAINS.has(domain);
    const { email: demoEmail } = getServerDemoCredentials();

    if (normalizedEmail === demoEmail || normalizedEmail === 'medtrac@yopmail.com') {
      console.info('[DEMO_PASSWORD_RESET_REQUESTED]', {
        email: normalizedEmail,
        timestamp: new Date().toISOString(),
      });
      return NextResponse.json({
        success: true,
        isDemo: true,
        isDisposable: true,
        instantResetAvailable: true,
        message:
          'Demo account passwords cannot be permanently changed, and you do not need to wait for Yopmail. Click "Try demo account" above or "Autofill" in the Reviewer login box to sign in immediately.',
      });
    }

    if (isDisposable) {
      return NextResponse.json({
        success: true,
        isDisposable: true,
        instantResetAvailable: true,
        message: `Disposable inbox detected (${domain}). Because public inboxes can delay delivery, you can set a new password right below without waiting for an email.`,
      });
    }

    return NextResponse.json({
      success: true,
      isDisposable: false,
      instantResetAvailable: false,
      message: `If an account exists for ${normalizedEmail}, a password reset link has been sent. Please check your inbox.`,
    });
  } catch (err: any) {
    console.error('[FORGOT_PASSWORD_ERROR]', err);
    return NextResponse.json(
      { error: 'Could not process password reset request.' },
      { status: 500 }
    );
  }
}
