import { NextRequest, NextResponse } from 'next/server';
import {
  verifyConfiguredSpecialCredentials,
  getSeededAccountDataset,
  hashPasswordSha256,
} from '@/lib/server/account-seed';

interface AttemptRecord {
  count: number;
  lockedUntil: number;
}

interface IpRateRecord {
  windowStart: number;
  requestCount: number;
}

const accountAttemptStore = new Map<string, AttemptRecord>();
const ipRateStore = new Map<string, IpRateRecord>();

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 10 * 60 * 1000; // 10 minutes
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const MAX_IP_REQUESTS_PER_WINDOW = 20;

export async function POST(req: NextRequest) {
  try {
    const now = Date.now();
    const clientIp =
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      req.headers.get('x-real-ip') ||
      'local-ip';

    // IP-based rate limiting on the sign-in endpoint
    const ipRecord = ipRateStore.get(clientIp) || {
      windowStart: now,
      requestCount: 0,
    };
    if (now - ipRecord.windowStart > RATE_LIMIT_WINDOW_MS) {
      ipRecord.windowStart = now;
      ipRecord.requestCount = 0;
    }
    ipRecord.requestCount += 1;
    ipRateStore.set(clientIp, ipRecord);

    if (ipRecord.requestCount > MAX_IP_REQUESTS_PER_WINDOW) {
      return NextResponse.json(
        {
          code: 'RATE_LIMITED',
          message: 'Too many attempts. Please wait a few minutes before trying again.',
        },
        { status: 429 }
      );
    }

    const body = await req.json();
    const rawEmail = typeof body.email === 'string' ? body.email : '';
    const normalizedEmail = rawEmail.trim().toLowerCase();
    const rawPassword = typeof body.password === 'string' ? body.password : '';

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

    // Check server-configured special account (strictly via env vars & hash comparison)
    const specialCheck = verifyConfiguredSpecialCredentials(normalizedEmail, rawPassword);

    if (specialCheck.matchedEmail) {
      if (!specialCheck.validPassword) {
        // Server-side only log
        console.warn('[SERVER_AUTH_NOTICE] Special account sign-in failed: password hash mismatch', {
          email: normalizedEmail,
          ip: clientIp,
          timestamp: new Date(now).toISOString(),
        });

        // Return the exact same 401 response shape as any regular account
        return NextResponse.json(
          {
            code: 'INVALID_PASSWORD',
            message: "That password doesn't match. Try again or reset it.",
          },
          { status: 401 }
        );
      }

      // Server-side only log
      console.info('[SERVER_AUTH_NOTICE] Special account authenticated', {
        email: normalizedEmail,
        ip: clientIp,
        timestamp: new Date(now).toISOString(),
      });

      const dataset = getSeededAccountDataset(normalizedEmail);
      return NextResponse.json(
        {
          success: true,
          isolatedWorkspace: true,
          seedDate: dataset.seedDate,
          profile: dataset.profile,
          results: dataset.results,
          medications: dataset.medications,
          events: dataset.events,
          brief: dataset.brief,
        },
        { status: 200 }
      );
    }

    // Perform a dummy hash calculation so non-special accounts share identical CPU timing
    hashPasswordSha256(rawPassword);

    // Real account lockout check
    const record = accountAttemptStore.get(normalizedEmail) || {
      count: 0,
      lockedUntil: 0,
    };

    if (
      (record.lockedUntil && now < record.lockedUntil) ||
      normalizedEmail.startsWith('locked@')
    ) {
      return NextResponse.json(
        {
          code: 'ACCOUNT_LOCKED',
          message: 'Too many attempts. Please try again in 10 minutes.',
        },
        { status: 423 }
      );
    }

    // Real account email verification check
    if (
      clientAccount?.isVerified === false ||
      normalizedEmail.startsWith('unverified@')
    ) {
      return NextResponse.json(
        {
          code: 'EMAIL_UNVERIFIED',
          message: 'Please verify your email.',
        },
        { status: 403 }
      );
    }

    if (!clientAccount || !clientAccount.email) {
      return NextResponse.json(
        {
          code: 'ACCOUNT_NOT_FOUND',
          message: "We couldn't find an account with that email. Create one?",
        },
        { status: 401 }
      );
    }

    if (
      clientAccount.password &&
      clientAccount.password !== 'google_oauth_account' &&
      clientAccount.password !== rawPassword
    ) {
      record.count += 1;
      if (record.count >= MAX_FAILED_ATTEMPTS) {
        record.lockedUntil = now + LOCKOUT_DURATION_MS;
        accountAttemptStore.set(normalizedEmail, record);
        return NextResponse.json(
          {
            code: 'ACCOUNT_LOCKED',
            message: 'Too many attempts. Please try again in 10 minutes.',
          },
          { status: 423 }
        );
      }
      accountAttemptStore.set(normalizedEmail, record);

      return NextResponse.json(
        {
          code: 'INVALID_PASSWORD',
          message: "That password doesn't match. Try again or reset it.",
        },
        { status: 401 }
      );
    }

    accountAttemptStore.delete(normalizedEmail);

    return NextResponse.json(
      {
        success: true,
        isolatedWorkspace: false,
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
