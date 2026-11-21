import { NextRequest, NextResponse } from 'next/server';
import {
  DEMO_SEED_PROFILE,
  DEMO_SEED_RESULTS,
  DEMO_SEED_MEDICATIONS,
  DEMO_SEED_EVENTS,
  DEMO_SEED_BRIEF,
} from '@/lib/demo-seed';
import { getServerDemoCredentials } from '../demo/route';

interface AttemptRecord {
  count: number;
  lockedUntil: number;
  windowStart: number;
  requestCountInWindow: number;
}

const attemptStore = new Map<string, AttemptRecord>();

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 10 * 60 * 1000; // 10 minutes
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 12;

function isServerDemoModeEnabled(): boolean {
  const flag = process.env.DEMO_MODE_ENABLED ?? process.env.NEXT_PUBLIC_DEMO_MODE_ENABLED;
  if (flag !== undefined) {
    return flag !== 'false' && flag !== '0';
  }
  return true;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const rawEmail = typeof body.email === 'string' ? body.email : '';
    // Normalize email on server: trim and lowercase
    const normalizedEmail = rawEmail.trim().toLowerCase();

    // Never trim or modify the password
    const rawPassword = typeof body.password === 'string' ? body.password : '';

    // Client-side account snapshot (for local/browser-persisted real accounts)
    const clientAccount = body.clientAccount as
      | {
          email?: string;
          password?: string;
          isVerified?: boolean;
        }
      | undefined;

    if (!normalizedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      return NextResponse.json(
        {
          code: 'INVALID_EMAIL',
          message: "That email doesn't look right. Try a format like you@example.com.",
        },
        { status: 400 }
      );
    }

    const demoEnabled = isServerDemoModeEnabled();
    const { email: demoEmail, password: demoPassword } = getServerDemoCredentials();
    const isDemoAccount =
      demoEnabled &&
      (normalizedEmail === demoEmail ||
        normalizedEmail === 'medtrac@yopmail.com' ||
        normalizedEmail === 'demo@yopmail.com' ||
        normalizedEmail === 'medtrac.demo@yopmail.com');

    // -------------------------------------------------------------------------
    // DEMO ACCOUNT PATH: Exempt from email verification, OTP, MFA, & lockouts
    // -------------------------------------------------------------------------
    if (isDemoAccount) {
      if (rawPassword !== demoPassword) {
        // Server-side only structured log for debugging failed demo logins
        console.warn('[DEMO_LOGIN_FAILED]', {
          email: normalizedEmail,
          reason: !rawPassword ? 'EMPTY_PASSWORD' : 'PASSWORD_MISMATCH',
          receivedLength: rawPassword.length,
          expectedLength: demoPassword.length,
          hasSurroundingSpaces: rawPassword !== rawPassword.trim(),
          timestamp: new Date().toISOString(),
        });

        return NextResponse.json(
          {
            code: 'INVALID_PASSWORD',
            is_demo_attempt: true,
            message: "That password doesn't match. Try again or reset it.",
          },
          { status: 401 }
        );
      }

      console.info('[DEMO_LOGIN_SUCCESS]', {
        email: normalizedEmail,
        timestamp: new Date().toISOString(),
      });

      return NextResponse.json(
        {
          success: true,
          is_demo: true,
          profile: DEMO_SEED_PROFILE,
          results: DEMO_SEED_RESULTS,
          medications: DEMO_SEED_MEDICATIONS,
          events: DEMO_SEED_EVENTS,
          brief: DEMO_SEED_BRIEF,
        },
        { status: 200 }
      );
    }

    // -------------------------------------------------------------------------
    // REAL USER ACCOUNT PATH: Enforce rate limiting, lockout, and verification
    // -------------------------------------------------------------------------
    const now = Date.now();
    const record = attemptStore.get(normalizedEmail) || {
      count: 0,
      lockedUntil: 0,
      windowStart: now,
      requestCountInWindow: 0,
    };

    // Reset rate-limit window if 1 minute passed
    if (now - record.windowStart > RATE_LIMIT_WINDOW_MS) {
      record.windowStart = now;
      record.requestCountInWindow = 0;
    }
    record.requestCountInWindow += 1;
    attemptStore.set(normalizedEmail, record);

    // 429 Rate Limited
    if (record.requestCountInWindow > MAX_REQUESTS_PER_WINDOW) {
      return NextResponse.json(
        {
          code: 'RATE_LIMITED',
          message: 'Too many attempts. Try again in 10 minutes, or use the demo account.',
        },
        { status: 429 }
      );
    }

    // 423 Account Locked (after 5 failed attempts or explicit locked test address)
    if (
      (record.lockedUntil && now < record.lockedUntil) ||
      normalizedEmail.startsWith('locked@')
    ) {
      return NextResponse.json(
        {
          code: 'ACCOUNT_LOCKED',
          message: 'Too many attempts. Try again in 10 minutes, or use the demo account.',
        },
        { status: 423 }
      );
    }

    // 403 Unverified Email
    if (
      clientAccount?.isVerified === false ||
      normalizedEmail.startsWith('unverified@')
    ) {
      return NextResponse.json(
        {
          code: 'EMAIL_UNVERIFIED',
          message: 'Please verify your email. Resend link.',
        },
        { status: 403 }
      );
    }

    // Check if account exists
    if (!clientAccount || !clientAccount.email) {
      return NextResponse.json(
        {
          code: 'ACCOUNT_NOT_FOUND',
          message: "We couldn't find an account with that email. Create one?",
        },
        { status: 401 }
      );
    }

    // Check exact password (never trimmed)
    if (
      clientAccount.password &&
      clientAccount.password !== 'google_oauth_account' &&
      clientAccount.password !== rawPassword
    ) {
      record.count += 1;
      if (record.count >= MAX_FAILED_ATTEMPTS) {
        record.lockedUntil = now + LOCKOUT_DURATION_MS;
        attemptStore.set(normalizedEmail, record);
        return NextResponse.json(
          {
            code: 'ACCOUNT_LOCKED',
            message: 'Too many attempts. Try again in 10 minutes, or use the demo account.',
          },
          { status: 423 }
        );
      }
      attemptStore.set(normalizedEmail, record);

      return NextResponse.json(
        {
          code: 'INVALID_PASSWORD',
          remainingAttempts: MAX_FAILED_ATTEMPTS - record.count,
          message: "That password doesn't match. Try again or reset it.",
        },
        { status: 401 }
      );
    }

    // Successful real user login: clear failed attempt counter
    attemptStore.delete(normalizedEmail);

    return NextResponse.json(
      {
        success: true,
        is_demo: false,
      },
      { status: 200 }
    );
  } catch (err: any) {
    console.error('[AUTH_SIGNIN_ERROR]', err);
    return NextResponse.json(
      {
        code: 'SERVER_ERROR',
        message: 'Unable to complete sign-in right now. Please try again.',
      },
      { status: 500 }
    );
  }
}
