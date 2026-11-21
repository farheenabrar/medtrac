import { NextRequest, NextResponse } from 'next/server';
import {
  SESSION_COOKIE_NAME,
  verifyServerSessionToken,
  isSpecialAccessEnabled,
  getSampleReportsDataset,
  getInitialEmptyIsolatedProfile,
  getServerSamplesLoaded,
  setServerSamplesLoaded,
} from '@/lib/server/account-seed';

function verifyReviewerSession(req: NextRequest): boolean {
  if (!isSpecialAccessEnabled()) {
    return false;
  }
  const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = verifyServerSessionToken(token);
  return Boolean(session && session.is_reviewer === true);
}

export async function POST(req: NextRequest) {
  if (!verifyReviewerSession(req)) {
    return NextResponse.json(
      {
        error: 'Forbidden: sample report loading is not authorized for this account.',
      },
      { status: 403 }
    );
  }

  let clientAlreadyHasSamples = false;
  try {
    const body = await req.json();
    clientAlreadyHasSamples = Boolean(body?.alreadyHasSamples);
  } catch {
    // Empty body is valid
  }

  const alreadyLoaded = clientAlreadyHasSamples || getServerSamplesLoaded();
  setServerSamplesLoaded(true);

  const dataset = getSampleReportsDataset();

  console.info('[SERVER_SAMPLE_REPORTS] Loaded sample reports for authorized session', {
    alreadyLoaded,
    documentCount: dataset.documents.length,
    resultCount: dataset.results.length,
    timestamp: new Date().toISOString(),
  });

  return NextResponse.json(
    {
      success: true,
      alreadyLoaded,
      message: alreadyLoaded ? 'Sample reports already loaded' : 'Sample reports added',
      seedDate: dataset.seedDate,
      profile: dataset.profile,
      documents: dataset.documents,
      results: dataset.results,
      medications: dataset.medications,
      events: dataset.events,
      brief: dataset.brief,
    },
    { status: 200 }
  );
}

export async function DELETE(req: NextRequest) {
  if (!verifyReviewerSession(req)) {
    return NextResponse.json(
      {
        error: 'Forbidden: clearing sample reports is not authorized for this account.',
      },
      { status: 403 }
    );
  }

  setServerSamplesLoaded(false);
  const emptyProfile = getInitialEmptyIsolatedProfile();

  console.info('[SERVER_SAMPLE_REPORTS] Cleared sample reports for authorized session', {
    timestamp: new Date().toISOString(),
  });

  return NextResponse.json(
    {
      success: true,
      cleared: true,
      message: 'Sample reports cleared',
      profile: emptyProfile.profile,
    },
    { status: 200 }
  );
}
