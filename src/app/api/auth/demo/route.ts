import { NextResponse } from 'next/server';
import {
  DEMO_SEED_PROFILE,
  DEMO_SEED_RESULTS,
  DEMO_SEED_MEDICATIONS,
  DEMO_SEED_EVENTS,
  DEMO_SEED_BRIEF,
  DEMO_ACCOUNT_EMAIL_DEFAULT,
} from '@/lib/demo-seed';

let lastServerResetDate = new Date().toISOString().split('T')[0];

function isServerDemoModeEnabled(): boolean {
  const flag = process.env.DEMO_MODE_ENABLED ?? process.env.NEXT_PUBLIC_DEMO_MODE_ENABLED;
  if (flag !== undefined) {
    return flag !== 'false' && flag !== '0';
  }
  return true;
}

export function getServerDemoCredentials() {
  const email = (process.env.DEMO_ACCOUNT_EMAIL || DEMO_ACCOUNT_EMAIL_DEFAULT).trim().toLowerCase();
  const password = process.env.DEMO_ACCOUNT_PASSWORD || 'MedtracDemo!2026';
  return { email, password };
}

function checkNightlyReset(): string {
  const todayUtc = new Date().toISOString().split('T')[0];
  if (lastServerResetDate !== todayUtc) {
    console.info(`[DEMO_NIGHTLY_RESET] Resetting demo account state for ${todayUtc}`);
    lastServerResetDate = todayUtc;
  }
  return todayUtc;
}

export async function GET() {
  const enabled = isServerDemoModeEnabled();
  if (!enabled) {
    return NextResponse.json({ enabled: false });
  }

  const todayUtc = checkNightlyReset();
  const { email, password } = getServerDemoCredentials();

  return NextResponse.json({
    enabled: true,
    email,
    password,
    seedDate: todayUtc,
  });
}

export async function POST() {
  const enabled = isServerDemoModeEnabled();
  if (!enabled) {
    return NextResponse.json(
      { error: 'Demo mode is currently disabled.' },
      { status: 403 }
    );
  }

  const todayUtc = checkNightlyReset();
  const now = Date.now();

  console.info('[DEMO_AUTH] One-tap isolated demo session initialized', {
    seedDate: todayUtc,
    timestamp: new Date(now).toISOString(),
  });

  return NextResponse.json({
    success: true,
    is_demo: true,
    created_at: now,
    expires_at: now + 24 * 60 * 60 * 1000,
    seed_date: todayUtc,
    profile: DEMO_SEED_PROFILE,
    results: DEMO_SEED_RESULTS,
    medications: DEMO_SEED_MEDICATIONS,
    events: DEMO_SEED_EVENTS,
    brief: DEMO_SEED_BRIEF,
  });
}
