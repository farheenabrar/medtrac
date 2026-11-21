import { NextRequest, NextResponse } from 'next/server';
import {
  SESSION_COOKIE_NAME,
  verifyServerSessionToken,
  setServerSamplesLoaded,
} from '@/lib/server/account-seed';

export async function GET(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = verifyServerSessionToken(token);

  if (!session) {
    return NextResponse.json(
      {
        authenticated: false,
        is_reviewer: false,
      },
      { status: 200 }
    );
  }

  return NextResponse.json(
    {
      authenticated: true,
      is_reviewer: Boolean(session.is_reviewer),
      seedDate: session.seedDate,
    },
    { status: 200 }
  );
}

export async function DELETE() {
  setServerSamplesLoaded(false);
  const res = NextResponse.json({ cleared: true }, { status: 200 });
  res.cookies.set(SESSION_COOKIE_NAME, '', {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
  return res;
}
