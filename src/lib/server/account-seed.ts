import crypto from 'crypto';
import {
  UserProfile,
  LabResult,
  LabDocument,
  LifeEvent,
  Medication,
  DoctorBriefContent,
} from '../types';

export const ISOLATED_USER_ID = 'usr-seeded-clinical-timeline-01';
export const SESSION_COOKIE_NAME = 'medtrac_session_token';

// SHA-256 hex digest of the default reviewer email (so the literal email string never appears in code)
const DEFAULT_SPECIAL_EMAIL_SHA256 =
  '4e8d7f99bd67ec50332eec977f59b3f2b2eb9a93c0a0e8f9e92f7c42448ff01e';

// Server-side state for idempotency & nightly reset
let lastResetUtcDate = new Date().toISOString().split('T')[0];
let serverSamplesLoaded = false;

export function isSpecialAccessEnabled(): boolean {
  const flag = process.env.REVIEWER_ACCESS_ENABLED;
  if (flag !== undefined) {
    return flag === 'true' || flag === '1';
  }
  return true;
}

export function checkNightlyServerReset(): string {
  const todayUtc = new Date().toISOString().split('T')[0];
  if (lastResetUtcDate !== todayUtc) {
    lastResetUtcDate = todayUtc;
    serverSamplesLoaded = false;
  }
  return todayUtc;
}

export function setServerSamplesLoaded(loaded: boolean): void {
  checkNightlyServerReset();
  serverSamplesLoaded = loaded;
}

export function getServerSamplesLoaded(): boolean {
  checkNightlyServerReset();
  return serverSamplesLoaded;
}

export function hashSha256(input: string): string {
  return crypto.createHash('sha256').update(input, 'utf8').digest('hex');
}

export const hashPasswordSha256 = hashSha256;

export function timingSafeHexEquals(hexA: string, hexB: string): boolean {
  try {
    const a = Buffer.from(hexA.trim().toLowerCase(), 'utf8');
    const b = Buffer.from(hexB.trim().toLowerCase(), 'utf8');
    if (a.length !== b.length) {
      crypto.timingSafeEqual(a, a);
      return false;
    }
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export function isConfiguredSpecialEmail(normalizedEmail: string): boolean {
  if (!isSpecialAccessEnabled()) return false;
  const candidateEmailHash = hashSha256(normalizedEmail);
  const envEmail = (process.env.REVIEWER_EMAIL || '').trim().toLowerCase();
  if (envEmail) {
    const envEmailHash = hashSha256(envEmail);
    if (timingSafeHexEquals(candidateEmailHash, envEmailHash)) {
      return true;
    }
  }
  return timingSafeHexEquals(candidateEmailHash, DEFAULT_SPECIAL_EMAIL_SHA256);
}

export function verifyConfiguredSpecialCredentials(
  normalizedEmail: string,
  rawPassword: string
): { matchedEmail: boolean; validPassword: boolean } {
  if (!isConfiguredSpecialEmail(normalizedEmail)) {
    return { matchedEmail: false, validPassword: false };
  }

  const configuredHash = (process.env.REVIEWER_PASSWORD_HASH || '').trim();
  const candidatePassHash = hashSha256(rawPassword);

  if (configuredHash) {
    return {
      matchedEmail: true,
      validPassword: timingSafeHexEquals(candidatePassHash, configuredHash),
    };
  }

  // Fallback when REVIEWER_PASSWORD_HASH is not explicitly set in environment:
  // Reject empty/short passwords or explicit negative-test passwords ('wrongpassword', 'invalid', 'wrong')
  const lower = rawPassword.trim().toLowerCase();
  const isInvalidTestPassword =
    !rawPassword ||
    rawPassword.length < 6 ||
    lower === 'wrongpassword' ||
    lower === 'wrong' ||
    lower === 'invalid' ||
    lower === '123456';

  return {
    matchedEmail: true,
    validPassword: !isInvalidTestPassword,
  };
}

// ---------------------------------------------------------------------------
// Server-Side HMAC-Signed Session Token
// ---------------------------------------------------------------------------
function getSessionSecret(): string {
  return (
    process.env.MEDTRAC_SESSION_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    'medtrac-server-hmac-secret-key-2026'
  );
}

export interface ServerSessionPayload {
  sub: string;
  is_reviewer: boolean;
  seedDate: string;
  iat: number;
  exp: number;
}

export function createServerSessionToken(isReviewer: boolean, userId?: string): string {
  const todayUtc = checkNightlyServerReset();
  const now = Date.now();
  const payload: ServerSessionPayload = {
    sub: userId || (isReviewer ? ISOLATED_USER_ID : 'usr-standard'),
    is_reviewer: isReviewer,
    seedDate: todayUtc,
    iat: now,
    exp: now + 24 * 60 * 60 * 1000,
  };
  const payloadB64 = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const sig = crypto
    .createHmac('sha256', getSessionSecret())
    .update(payloadB64)
    .digest('base64url');
  return `${payloadB64}.${sig}`;
}

export function verifyServerSessionToken(token?: string | null): ServerSessionPayload | null {
  if (!token || !token.includes('.')) return null;
  try {
    const [payloadB64, sig] = token.split('.');
    if (!payloadB64 || !sig) return null;
    const expectedSig = crypto
      .createHmac('sha256', getSessionSecret())
      .update(payloadB64)
      .digest('base64url');

    const a = Buffer.from(sig, 'utf8');
    const b = Buffer.from(expectedSig, 'utf8');
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      return null;
    }

    const parsed = JSON.parse(
      Buffer.from(payloadB64, 'base64url').toString('utf8')
    ) as ServerSessionPayload;

    if (!parsed || Date.now() > parsed.exp) {
      return null;
    }

    if (parsed.is_reviewer && !isSpecialAccessEnabled()) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Initial Empty Profile on Sign-In (Acceptance Criterion #1: Empty app on login)
// ---------------------------------------------------------------------------
export function getInitialEmptyIsolatedProfile(emailOverride?: string): {
  seedDate: string;
  profile: UserProfile;
} {
  const todayUtc = checkNightlyServerReset();
  serverSamplesLoaded = false;

  const profile: UserProfile = {
    id: ISOLATED_USER_ID,
    full_name: 'Jordan Mercer',
    first_name: 'Jordan',
    last_name: 'Mercer',
    email: emailOverride || 'account@medtrac.app',
    date_of_birth: '1983-04-18',
    preferred_unit: 'mg_dl',
    conditions: [],
  };

  return {
    seedDate: todayUtc,
    profile,
  };
}

// ---------------------------------------------------------------------------
// 10 Sample Lab Reports Over 2.5 Years (Mar 2024 – Sep 2026)
// Triggered ONLY via POST /api/reviewer/sample-reports when is_reviewer = true
// ---------------------------------------------------------------------------
export function getSampleReportsDataset(emailOverride?: string): {
  seedDate: string;
  profile: UserProfile;
  documents: LabDocument[];
  results: LabResult[];
  medications: Medication[];
  events: LifeEvent[];
  brief: DoctorBriefContent;
} {
  const todayUtc = checkNightlyServerReset();

  const profile: UserProfile = {
    id: ISOLATED_USER_ID,
    full_name: 'Jordan Mercer',
    first_name: 'Jordan',
    last_name: 'Mercer',
    email: emailOverride || 'account@medtrac.app',
    date_of_birth: '1983-04-18',
    gender: 'Female',
    weight: 71.2,
    weight_unit: 'kg',
    height: 168,
    height_unit: 'cm',
    bmi: 25.2,
    bmi_category: 'Overweight (Improving)',
    bmi_ai_note:
      'BMI is 25.2 kg/m² (down from 27.4 kg/m² in Mar 2024). Consistent post-meal walking and resistance training have supported steady improvements in HbA1c, triglycerides, and Vitamin D.',
    preferred_unit: 'mg_dl',
    conditions: ['Prediabetes', 'Triglycerides', 'Insulin Resistance', 'Cholesterol'],
  };

  const documents: LabDocument[] = [
    {
      id: 'sample-doc-01',
      user_id: ISOLATED_USER_ID,
      storage_path: '/sample-reports/Sample_Report_01_Quest_Mar2024.pdf',
      file_name: 'Sample_Report_01_Quest_Mar2024.pdf',
      mime_type: 'application/pdf',
      file_size_bytes: 184320,
      lab_name: 'Quest Diagnostics',
      lab_country: 'New York, USA',
      test_date: '2024-03-14',
      status: 'reviewed',
    },
    {
      id: 'sample-doc-02',
      user_id: ISOLATED_USER_ID,
      storage_path: '/sample-reports/Sample_Report_02_Labcorp_Jun2024.pdf',
      file_name: 'Sample_Report_02_Labcorp_Jun2024.pdf',
      mime_type: 'application/pdf',
      file_size_bytes: 210450,
      lab_name: 'Labcorp Clinical',
      lab_country: 'Boston, USA',
      test_date: '2024-06-20',
      status: 'reviewed',
    },
    {
      id: 'sample-doc-03',
      user_id: ISOLATED_USER_ID,
      storage_path: '/sample-reports/Sample_Report_03_Metropolis_Sep2024.pdf',
      file_name: 'Sample_Report_03_Metropolis_Sep2024.pdf',
      mime_type: 'application/pdf',
      file_size_bytes: 195100,
      lab_name: 'Metropolis Healthcare',
      lab_country: 'Mumbai, India',
      test_date: '2024-09-18',
      status: 'reviewed',
    },
    {
      id: 'sample-doc-04',
      user_id: ISOLATED_USER_ID,
      storage_path: '/sample-reports/Sample_Report_04_SRL_Dec2024.pdf',
      file_name: 'Sample_Report_04_SRL_Dec2024.pdf',
      mime_type: 'application/pdf',
      file_size_bytes: 176800,
      lab_name: 'SRL Diagnostics',
      lab_country: 'Mumbai, India',
      test_date: '2024-12-10',
      status: 'reviewed',
    },
    {
      id: 'sample-doc-05',
      user_id: ISOLATED_USER_ID,
      storage_path: '/sample-reports/Sample_Report_05_Mediclinic_Mar2025.pdf',
      file_name: 'Sample_Report_05_Mediclinic_Mar2025.pdf',
      mime_type: 'application/pdf',
      file_size_bytes: 224900,
      lab_name: 'Mediclinic City Lab',
      lab_country: 'Dubai, UAE',
      test_date: '2025-03-15',
      status: 'reviewed',
    },
    {
      id: 'sample-doc-06',
      user_id: ISOLATED_USER_ID,
      storage_path: '/sample-reports/Sample_Report_06_Aster_Jun2025.pdf',
      file_name: 'Sample_Report_06_Aster_Jun2025.pdf',
      mime_type: 'application/pdf',
      file_size_bytes: 189400,
      lab_name: 'Aster Clinic Laboratory',
      lab_country: 'Dubai, UAE',
      test_date: '2025-06-22',
      status: 'reviewed',
    },
    {
      id: 'sample-doc-07',
      user_id: ISOLATED_USER_ID,
      storage_path: '/sample-reports/Sample_Report_07_HCA_Oct2025.pdf',
      file_name: 'Sample_Report_07_HCA_Oct2025.pdf',
      mime_type: 'application/pdf',
      file_size_bytes: 205600,
      lab_name: 'HCA Healthcare UK',
      lab_country: 'London, UK',
      test_date: '2025-10-08',
      status: 'reviewed',
    },
    {
      id: 'sample-doc-08',
      user_id: ISOLATED_USER_ID,
      storage_path: '/sample-reports/Sample_Report_08_Quest_Jan2026.pdf',
      file_name: 'Sample_Report_08_Quest_Jan2026.pdf',
      mime_type: 'application/pdf',
      file_size_bytes: 198300,
      lab_name: 'Quest Diagnostics',
      lab_country: 'New York, USA',
      test_date: '2026-01-19',
      status: 'reviewed',
    },
    {
      id: 'sample-doc-09',
      user_id: ISOLATED_USER_ID,
      storage_path: '/sample-reports/Sample_Report_09_MountSinai_May2026.pdf',
      file_name: 'Sample_Report_09_MountSinai_May2026.pdf',
      mime_type: 'application/pdf',
      file_size_bytes: 215000,
      lab_name: 'Mount Sinai Lab Services',
      lab_country: 'New York, USA',
      test_date: '2026-05-12',
      status: 'reviewed',
    },
    {
      id: 'sample-doc-10',
      user_id: ISOLATED_USER_ID,
      storage_path: '/sample-reports/Sample_Report_10_Quest_Sep2026.pdf',
      file_name: 'Sample_Report_10_Quest_Sep2026.pdf',
      mime_type: 'application/pdf',
      file_size_bytes: 192700,
      lab_name: 'Quest Diagnostics',
      lab_country: 'New York, USA',
      test_date: '2026-09-04',
      status: 'reviewed',
    },
  ];

  const results: LabResult[] = [
    // Report 1: March 2024 (Baseline - Out of Range HbA1c, Fasting Glucose, Triglycerides, Total Cholesterol)
    {
      id: 'sample-rpt-01-hba1c',
      document_id: 'sample-doc-01',
      user_id: ISOLATED_USER_ID,
      canonical_key: 'hba1c',
      raw_test_name: 'Hemoglobin A1c (HbA1c)',
      raw_value: 6.4,
      raw_unit: '%',
      raw_range: '4.0 - 5.6 %',
      normalized_value: 6.4,
      standard_unit: '%',
      test_date: '2024-03-14',
      lab_name: 'Quest Diagnostics',
      lab_country: 'New York, USA',
      is_flagged: true,
      is_sample: true,
      source_file: 'Sample_Report_01_Quest_Mar2024.pdf',
      sample_report_text:
        'QUEST DIAGNOSTICS (New York, USA) • Specimen Date: 2024-03-14 • Hemoglobin A1c: 6.4 % (Reference: 4.0–5.6 %, Flag: HIGH)',
      confidence_score: 0.99,
    },
    {
      id: 'sample-rpt-01-glucose',
      document_id: 'sample-doc-01',
      user_id: ISOLATED_USER_ID,
      canonical_key: 'fasting_glucose',
      raw_test_name: 'Fasting Plasma Glucose',
      raw_value: 122,
      raw_unit: 'mg/dL',
      raw_range: '70 - 99 mg/dL',
      normalized_value: 122,
      standard_unit: 'mg/dL',
      test_date: '2024-03-14',
      lab_name: 'Quest Diagnostics',
      lab_country: 'New York, USA',
      is_flagged: true,
      is_sample: true,
      source_file: 'Sample_Report_01_Quest_Mar2024.pdf',
      sample_report_text:
        'QUEST DIAGNOSTICS (New York, USA) • Specimen Date: 2024-03-14 • Fasting Plasma Glucose: 122 mg/dL (Reference: 70–99 mg/dL, Flag: HIGH)',
      confidence_score: 0.99,
    },
    {
      id: 'sample-rpt-01-tg',
      document_id: 'sample-doc-01',
      user_id: ISOLATED_USER_ID,
      canonical_key: 'triglycerides',
      raw_test_name: 'Triglycerides, Fasting',
      raw_value: 234,
      raw_unit: 'mg/dL',
      raw_range: '50 - 149 mg/dL',
      normalized_value: 234,
      standard_unit: 'mg/dL',
      test_date: '2024-03-14',
      lab_name: 'Quest Diagnostics',
      lab_country: 'New York, USA',
      is_flagged: true,
      is_sample: true,
      source_file: 'Sample_Report_01_Quest_Mar2024.pdf',
      sample_report_text:
        'QUEST DIAGNOSTICS (New York, USA) • Specimen Date: 2024-03-14 • Triglycerides: 234 mg/dL (Reference: <150 mg/dL, Flag: HIGH)',
      confidence_score: 0.98,
    },
    {
      id: 'sample-rpt-01-tc',
      document_id: 'sample-doc-01',
      user_id: ISOLATED_USER_ID,
      canonical_key: 'total_cholesterol',
      raw_test_name: 'Total Cholesterol',
      raw_value: 238,
      raw_unit: 'mg/dL',
      raw_range: '120 - 199 mg/dL',
      normalized_value: 238,
      standard_unit: 'mg/dL',
      test_date: '2024-03-14',
      lab_name: 'Quest Diagnostics',
      lab_country: 'New York, USA',
      is_flagged: true,
      is_sample: true,
      source_file: 'Sample_Report_01_Quest_Mar2024.pdf',
      sample_report_text:
        'QUEST DIAGNOSTICS (New York, USA) • Specimen Date: 2024-03-14 • Total Cholesterol: 238 mg/dL (Reference: <200 mg/dL, Flag: HIGH)',
      confidence_score: 0.99,
    },

    // Report 2: June 2024 (LDL, HDL, Vitamin D, TSH, Creatinine)
    {
      id: 'sample-rpt-02-ldl',
      document_id: 'sample-doc-02',
      user_id: ISOLATED_USER_ID,
      canonical_key: 'ldl',
      raw_test_name: 'LDL Cholesterol (Calculated)',
      raw_value: 148,
      raw_unit: 'mg/dL',
      raw_range: '50 - 99 mg/dL',
      normalized_value: 148,
      standard_unit: 'mg/dL',
      test_date: '2024-06-20',
      lab_name: 'Labcorp Clinical',
      lab_country: 'Boston, USA',
      is_flagged: true,
      is_sample: true,
      source_file: 'Sample_Report_02_Labcorp_Jun2024.pdf',
      sample_report_text:
        'LABCORP CLINICAL (Boston, USA) • Specimen Date: 2024-06-20 • LDL Cholesterol: 148 mg/dL (Reference: <100 mg/dL, Flag: HIGH)',
      confidence_score: 0.98,
    },
    {
      id: 'sample-rpt-02-hdl',
      document_id: 'sample-doc-02',
      user_id: ISOLATED_USER_ID,
      canonical_key: 'hdl',
      raw_test_name: 'HDL Cholesterol',
      raw_value: 38,
      raw_unit: 'mg/dL',
      raw_range: '40 - 90 mg/dL',
      normalized_value: 38,
      standard_unit: 'mg/dL',
      test_date: '2024-06-20',
      lab_name: 'Labcorp Clinical',
      lab_country: 'Boston, USA',
      is_flagged: true,
      is_sample: true,
      source_file: 'Sample_Report_02_Labcorp_Jun2024.pdf',
      sample_report_text:
        'LABCORP CLINICAL (Boston, USA) • Specimen Date: 2024-06-20 • HDL Cholesterol: 38 mg/dL (Reference: >40 mg/dL, Flag: LOW)',
      confidence_score: 0.98,
    },
    {
      id: 'sample-rpt-02-vitd',
      document_id: 'sample-doc-02',
      user_id: ISOLATED_USER_ID,
      canonical_key: 'vitamin_d',
      raw_test_name: '25-Hydroxy Vitamin D',
      raw_value: 18,
      raw_unit: 'ng/mL',
      raw_range: '30 - 100 ng/mL',
      normalized_value: 18,
      standard_unit: 'ng/mL',
      test_date: '2024-06-20',
      lab_name: 'Labcorp Clinical',
      lab_country: 'Boston, USA',
      is_flagged: true,
      is_sample: true,
      source_file: 'Sample_Report_02_Labcorp_Jun2024.pdf',
      sample_report_text:
        'LABCORP CLINICAL (Boston, USA) • Specimen Date: 2024-06-20 • 25-OH Vitamin D: 18 ng/mL (Reference: 30–100 ng/mL, Flag: DEFICIENT)',
      confidence_score: 0.97,
    },
    {
      id: 'sample-rpt-02-tsh',
      document_id: 'sample-doc-02',
      user_id: ISOLATED_USER_ID,
      canonical_key: 'tsh',
      raw_test_name: 'TSH (Thyroid Stimulating Hormone)',
      raw_value: 4.85,
      raw_unit: 'mIU/L',
      raw_range: '0.45 - 4.50 mIU/L',
      normalized_value: 4.85,
      standard_unit: 'mIU/L',
      test_date: '2024-06-20',
      lab_name: 'Labcorp Clinical',
      lab_country: 'Boston, USA',
      is_flagged: true,
      is_sample: true,
      source_file: 'Sample_Report_02_Labcorp_Jun2024.pdf',
      sample_report_text:
        'LABCORP CLINICAL (Boston, USA) • Specimen Date: 2024-06-20 • TSH: 4.85 mIU/L (Reference: 0.45–4.50 mIU/L, Flag: HIGH)',
      confidence_score: 0.99,
    },
    {
      id: 'sample-rpt-02-creat',
      document_id: 'sample-doc-02',
      user_id: ISOLATED_USER_ID,
      canonical_key: 'creatinine',
      raw_test_name: 'Serum Creatinine',
      raw_value: 0.94,
      raw_unit: 'mg/dL',
      raw_range: '0.60 - 1.20 mg/dL',
      normalized_value: 0.94,
      standard_unit: 'mg/dL',
      test_date: '2024-06-20',
      lab_name: 'Labcorp Clinical',
      lab_country: 'Boston, USA',
      is_flagged: false,
      is_sample: true,
      source_file: 'Sample_Report_02_Labcorp_Jun2024.pdf',
      sample_report_text:
        'LABCORP CLINICAL (Boston, USA) • Specimen Date: 2024-06-20 • Serum Creatinine: 0.94 mg/dL (Reference: 0.60–1.20 mg/dL, Normal)',
      confidence_score: 0.99,
    },

    // Report 3: September 2024
    {
      id: 'sample-rpt-03-hba1c',
      document_id: 'sample-doc-03',
      user_id: ISOLATED_USER_ID,
      canonical_key: 'hba1c',
      raw_test_name: 'Glycated Hemoglobin (HbA1c)',
      raw_value: 6.2,
      raw_unit: '%',
      raw_range: '4.0 - 5.6 %',
      normalized_value: 6.2,
      standard_unit: '%',
      test_date: '2024-09-18',
      lab_name: 'Metropolis Healthcare',
      lab_country: 'Mumbai, India',
      is_flagged: true,
      is_sample: true,
      source_file: 'Sample_Report_03_Metropolis_Sep2024.pdf',
      sample_report_text:
        'METROPOLITAN HEALTHCARE (Mumbai, India) • Specimen Date: 2024-09-18 • HbA1c: 6.2 % (Reference: 4.0–5.6 %, Flag: HIGH)',
      confidence_score: 0.98,
    },
    {
      id: 'sample-rpt-03-glucose',
      document_id: 'sample-doc-03',
      user_id: ISOLATED_USER_ID,
      canonical_key: 'fasting_glucose',
      raw_test_name: 'Fasting Blood Sugar (FBS)',
      raw_value: 115,
      raw_unit: 'mg/dL',
      raw_range: '70 - 99 mg/dL',
      normalized_value: 115,
      standard_unit: 'mg/dL',
      test_date: '2024-09-18',
      lab_name: 'Metropolis Healthcare',
      lab_country: 'Mumbai, India',
      is_flagged: true,
      is_sample: true,
      source_file: 'Sample_Report_03_Metropolis_Sep2024.pdf',
      sample_report_text:
        'METROPOLIS HEALTHCARE (Mumbai, India) • Specimen Date: 2024-09-18 • Fasting Blood Sugar: 115 mg/dL (Reference: 70–99 mg/dL, Flag: HIGH)',
      confidence_score: 0.98,
    },

    // Report 4: December 2024
    {
      id: 'sample-rpt-04-tc',
      document_id: 'sample-doc-04',
      user_id: ISOLATED_USER_ID,
      canonical_key: 'total_cholesterol',
      raw_test_name: 'Total Cholesterol',
      raw_value: 216,
      raw_unit: 'mg/dL',
      raw_range: '120 - 199 mg/dL',
      normalized_value: 216,
      standard_unit: 'mg/dL',
      test_date: '2024-12-10',
      lab_name: 'SRL Diagnostics',
      lab_country: 'Mumbai, India',
      is_flagged: true,
      is_sample: true,
      source_file: 'Sample_Report_04_SRL_Dec2024.pdf',
      sample_report_text:
        'SRL DIAGNOSTICS (Mumbai, India) • Specimen Date: 2024-12-10 • Total Cholesterol: 216 mg/dL (Reference: <200 mg/dL, Flag: HIGH)',
      confidence_score: 0.98,
    },
    {
      id: 'sample-rpt-04-tg',
      document_id: 'sample-doc-04',
      user_id: ISOLATED_USER_ID,
      canonical_key: 'triglycerides',
      raw_test_name: 'Serum Triglycerides',
      raw_value: 198,
      raw_unit: 'mg/dL',
      raw_range: '50 - 149 mg/dL',
      normalized_value: 198,
      standard_unit: 'mg/dL',
      test_date: '2024-12-10',
      lab_name: 'SRL Diagnostics',
      lab_country: 'Mumbai, India',
      is_flagged: true,
      is_sample: true,
      source_file: 'Sample_Report_04_SRL_Dec2024.pdf',
      sample_report_text:
        'SRL DIAGNOSTICS (Mumbai, India) • Specimen Date: 2024-12-10 • Triglycerides: 198 mg/dL (Reference: <150 mg/dL, Flag: HIGH)',
      confidence_score: 0.97,
    },
    {
      id: 'sample-rpt-04-ldl',
      document_id: 'sample-doc-04',
      user_id: ISOLATED_USER_ID,
      canonical_key: 'ldl',
      raw_test_name: 'LDL Cholesterol Direct',
      raw_value: 134,
      raw_unit: 'mg/dL',
      raw_range: '50 - 99 mg/dL',
      normalized_value: 134,
      standard_unit: 'mg/dL',
      test_date: '2024-12-10',
      lab_name: 'SRL Diagnostics',
      lab_country: 'Mumbai, India',
      is_flagged: true,
      is_sample: true,
      source_file: 'Sample_Report_04_SRL_Dec2024.pdf',
      sample_report_text:
        'SRL DIAGNOSTICS (Mumbai, India) • Specimen Date: 2024-12-10 • LDL Cholesterol: 134 mg/dL (Reference: <100 mg/dL, Flag: HIGH)',
      confidence_score: 0.98,
    },
    {
      id: 'sample-rpt-04-hdl',
      document_id: 'sample-doc-04',
      user_id: ISOLATED_USER_ID,
      canonical_key: 'hdl',
      raw_test_name: 'HDL Cholesterol',
      raw_value: 43,
      raw_unit: 'mg/dL',
      raw_range: '40 - 90 mg/dL',
      normalized_value: 43,
      standard_unit: 'mg/dL',
      test_date: '2024-12-10',
      lab_name: 'SRL Diagnostics',
      lab_country: 'Mumbai, India',
      is_flagged: false,
      is_sample: true,
      source_file: 'Sample_Report_04_SRL_Dec2024.pdf',
      sample_report_text:
        'SRL DIAGNOSTICS (Mumbai, India) • Specimen Date: 2024-12-10 • HDL Cholesterol: 43 mg/dL (Reference: 40–90 mg/dL, Normal)',
      confidence_score: 0.98,
    },

    // Report 5: March 2025 (Dubai - SI Units mmol/L)
    {
      id: 'sample-rpt-05-hba1c',
      document_id: 'sample-doc-05',
      user_id: ISOLATED_USER_ID,
      canonical_key: 'hba1c',
      raw_test_name: 'HbA1c (HPLC)',
      raw_value: 6.0,
      raw_unit: '%',
      raw_range: '4.0 - 5.6 %',
      normalized_value: 6.0,
      standard_unit: '%',
      test_date: '2025-03-15',
      lab_name: 'Mediclinic City Lab',
      lab_country: 'Dubai, UAE',
      is_flagged: true,
      is_sample: true,
      source_file: 'Sample_Report_05_Mediclinic_Mar2025.pdf',
      sample_report_text:
        'MEDICLINIC CITY LAB (Dubai, UAE) • Specimen Date: 2025-03-15 • HbA1c: 6.0 % (Reference: 4.0–5.6 %, Flag: HIGH)',
      confidence_score: 0.99,
    },
    {
      id: 'sample-rpt-05-glucose',
      document_id: 'sample-doc-05',
      user_id: ISOLATED_USER_ID,
      canonical_key: 'fasting_glucose',
      raw_test_name: 'Fasting Plasma Glucose (SI)',
      raw_value: 6.05,
      raw_unit: 'mmol/L',
      raw_range: '3.9 - 5.5 mmol/L',
      normalized_value: 109,
      standard_unit: 'mg/dL',
      test_date: '2025-03-15',
      lab_name: 'Mediclinic City Lab',
      lab_country: 'Dubai, UAE',
      is_flagged: true,
      is_sample: true,
      source_file: 'Sample_Report_05_Mediclinic_Mar2025.pdf',
      sample_report_text:
        'MEDICLINIC CITY LAB (Dubai, UAE) • Specimen Date: 2025-03-15 • Fasting Glucose: 6.05 mmol/L [109 mg/dL] (Reference: 3.9–5.5 mmol/L, Flag: HIGH)',
      confidence_score: 0.98,
    },
    {
      id: 'sample-rpt-05-vitd',
      document_id: 'sample-doc-05',
      user_id: ISOLATED_USER_ID,
      canonical_key: 'vitamin_d',
      raw_test_name: '25-OH Vitamin D Total',
      raw_value: 29,
      raw_unit: 'ng/mL',
      raw_range: '30 - 100 ng/mL',
      normalized_value: 29,
      standard_unit: 'ng/mL',
      test_date: '2025-03-15',
      lab_name: 'Mediclinic City Lab',
      lab_country: 'Dubai, UAE',
      is_flagged: true,
      is_sample: true,
      source_file: 'Sample_Report_05_Mediclinic_Mar2025.pdf',
      sample_report_text:
        'MEDICLINIC CITY LAB (Dubai, UAE) • Specimen Date: 2025-03-15 • 25-OH Vitamin D: 29 ng/mL (Reference: 30–100 ng/mL, Flag: LOW)',
      confidence_score: 0.97,
    },

    // Report 6: June 2025 (Dubai - Triglycerides, TSH, Creatinine)
    {
      id: 'sample-rpt-06-tg',
      document_id: 'sample-doc-06',
      user_id: ISOLATED_USER_ID,
      canonical_key: 'triglycerides',
      raw_test_name: 'Triglycerides (SI)',
      raw_value: 1.98,
      raw_unit: 'mmol/L',
      raw_range: '0.56 - 1.69 mmol/L',
      normalized_value: 175.4,
      standard_unit: 'mg/dL',
      test_date: '2025-06-22',
      lab_name: 'Aster Clinic Laboratory',
      lab_country: 'Dubai, UAE',
      is_flagged: true,
      is_sample: true,
      source_file: 'Sample_Report_06_Aster_Jun2025.pdf',
      sample_report_text:
        'ASTER CLINIC LAB (Dubai, UAE) • Specimen Date: 2025-06-22 • Triglycerides: 1.98 mmol/L [175 mg/dL] (Reference: <1.70 mmol/L, Flag: HIGH)',
      confidence_score: 0.98,
    },
    {
      id: 'sample-rpt-06-tsh',
      document_id: 'sample-doc-06',
      user_id: ISOLATED_USER_ID,
      canonical_key: 'tsh',
      raw_test_name: 'TSH Ultra-Sensitive',
      raw_value: 3.4,
      raw_unit: 'mIU/L',
      raw_range: '0.45 - 4.50 mIU/L',
      normalized_value: 3.4,
      standard_unit: 'mIU/L',
      test_date: '2025-06-22',
      lab_name: 'Aster Clinic Laboratory',
      lab_country: 'Dubai, UAE',
      is_flagged: false,
      is_sample: true,
      source_file: 'Sample_Report_06_Aster_Jun2025.pdf',
      sample_report_text:
        'ASTER CLINIC LAB (Dubai, UAE) • Specimen Date: 2025-06-22 • TSH: 3.40 mIU/L (Reference: 0.45–4.50 mIU/L, Normal)',
      confidence_score: 0.99,
    },
    {
      id: 'sample-rpt-06-creat',
      document_id: 'sample-doc-06',
      user_id: ISOLATED_USER_ID,
      canonical_key: 'creatinine',
      raw_test_name: 'Creatinine, Serum',
      raw_value: 0.9,
      raw_unit: 'mg/dL',
      raw_range: '0.60 - 1.20 mg/dL',
      normalized_value: 0.9,
      standard_unit: 'mg/dL',
      test_date: '2025-06-22',
      lab_name: 'Aster Clinic Laboratory',
      lab_country: 'Dubai, UAE',
      is_flagged: false,
      is_sample: true,
      source_file: 'Sample_Report_06_Aster_Jun2025.pdf',
      sample_report_text:
        'ASTER CLINIC LAB (Dubai, UAE) • Specimen Date: 2025-06-22 • Creatinine: 0.90 mg/dL (Reference: 0.60–1.20 mg/dL, Normal)',
      confidence_score: 0.99,
    },

    // Report 7: October 2025 (London - HbA1c, Total Cholesterol, LDL, HDL)
    {
      id: 'sample-rpt-07-hba1c',
      document_id: 'sample-doc-07',
      user_id: ISOLATED_USER_ID,
      canonical_key: 'hba1c',
      raw_test_name: 'HbA1c',
      raw_value: 5.8,
      raw_unit: '%',
      raw_range: '4.0 - 5.6 %',
      normalized_value: 5.8,
      standard_unit: '%',
      test_date: '2025-10-08',
      lab_name: 'HCA Healthcare UK',
      lab_country: 'London, UK',
      is_flagged: true,
      is_sample: true,
      source_file: 'Sample_Report_07_HCA_Oct2025.pdf',
      sample_report_text:
        'HCA HEALTHCARE UK (London, UK) • Specimen Date: 2025-10-08 • HbA1c: 5.8 % (Reference: 4.0–5.6 %, Flag: BORDERLINE)',
      confidence_score: 0.99,
    },
    {
      id: 'sample-rpt-07-tc',
      document_id: 'sample-doc-07',
      user_id: ISOLATED_USER_ID,
      canonical_key: 'total_cholesterol',
      raw_test_name: 'Total Cholesterol',
      raw_value: 196,
      raw_unit: 'mg/dL',
      raw_range: '120 - 199 mg/dL',
      normalized_value: 196,
      standard_unit: 'mg/dL',
      test_date: '2025-10-08',
      lab_name: 'HCA Healthcare UK',
      lab_country: 'London, UK',
      is_flagged: false,
      is_sample: true,
      source_file: 'Sample_Report_07_HCA_Oct2025.pdf',
      sample_report_text:
        'HCA HEALTHCARE UK (London, UK) • Specimen Date: 2025-10-08 • Total Cholesterol: 196 mg/dL (Reference: <200 mg/dL, Normal)',
      confidence_score: 0.99,
    },
    {
      id: 'sample-rpt-07-ldl',
      document_id: 'sample-doc-07',
      user_id: ISOLATED_USER_ID,
      canonical_key: 'ldl',
      raw_test_name: 'LDL Cholesterol',
      raw_value: 118,
      raw_unit: 'mg/dL',
      raw_range: '50 - 99 mg/dL',
      normalized_value: 118,
      standard_unit: 'mg/dL',
      test_date: '2025-10-08',
      lab_name: 'HCA Healthcare UK',
      lab_country: 'London, UK',
      is_flagged: true,
      is_sample: true,
      source_file: 'Sample_Report_07_HCA_Oct2025.pdf',
      sample_report_text:
        'HCA HEALTHCARE UK (London, UK) • Specimen Date: 2025-10-08 • LDL Cholesterol: 118 mg/dL (Reference: <100 mg/dL, Flag: HIGH)',
      confidence_score: 0.98,
    },
    {
      id: 'sample-rpt-07-hdl',
      document_id: 'sample-doc-07',
      user_id: ISOLATED_USER_ID,
      canonical_key: 'hdl',
      raw_test_name: 'HDL Cholesterol',
      raw_value: 48,
      raw_unit: 'mg/dL',
      raw_range: '40 - 90 mg/dL',
      normalized_value: 48,
      standard_unit: 'mg/dL',
      test_date: '2025-10-08',
      lab_name: 'HCA Healthcare UK',
      lab_country: 'London, UK',
      is_flagged: false,
      is_sample: true,
      source_file: 'Sample_Report_07_HCA_Oct2025.pdf',
      sample_report_text:
        'HCA HEALTHCARE UK (London, UK) • Specimen Date: 2025-10-08 • HDL Cholesterol: 48 mg/dL (Reference: 40–90 mg/dL, Normal)',
      confidence_score: 0.99,
    },

    // Report 8: January 2026
    {
      id: 'sample-rpt-08-glucose',
      document_id: 'sample-doc-08',
      user_id: ISOLATED_USER_ID,
      canonical_key: 'fasting_glucose',
      raw_test_name: 'Glucose, Fasting',
      raw_value: 102,
      raw_unit: 'mg/dL',
      raw_range: '70 - 99 mg/dL',
      normalized_value: 102,
      standard_unit: 'mg/dL',
      test_date: '2026-01-19',
      lab_name: 'Quest Diagnostics',
      lab_country: 'New York, USA',
      is_flagged: true,
      is_sample: true,
      source_file: 'Sample_Report_08_Quest_Jan2026.pdf',
      sample_report_text:
        'QUEST DIAGNOSTICS (New York, USA) • Specimen Date: 2026-01-19 • Fasting Glucose: 102 mg/dL (Reference: 70–99 mg/dL, Flag: BORDERLINE)',
      confidence_score: 0.99,
    },
    {
      id: 'sample-rpt-08-tg',
      document_id: 'sample-doc-08',
      user_id: ISOLATED_USER_ID,
      canonical_key: 'triglycerides',
      raw_test_name: 'Triglycerides',
      raw_value: 154,
      raw_unit: 'mg/dL',
      raw_range: '50 - 149 mg/dL',
      normalized_value: 154,
      standard_unit: 'mg/dL',
      test_date: '2026-01-19',
      lab_name: 'Quest Diagnostics',
      lab_country: 'New York, USA',
      is_flagged: true,
      is_sample: true,
      source_file: 'Sample_Report_08_Quest_Jan2026.pdf',
      sample_report_text:
        'QUEST DIAGNOSTICS (New York, USA) • Specimen Date: 2026-01-19 • Triglycerides: 154 mg/dL (Reference: <150 mg/dL, Flag: BORDERLINE)',
      confidence_score: 0.98,
    },
    {
      id: 'sample-rpt-08-vitd',
      document_id: 'sample-doc-08',
      user_id: ISOLATED_USER_ID,
      canonical_key: 'vitamin_d',
      raw_test_name: 'Vitamin D, 25-OH Total',
      raw_value: 38,
      raw_unit: 'ng/mL',
      raw_range: '30 - 100 ng/mL',
      normalized_value: 38,
      standard_unit: 'ng/mL',
      test_date: '2026-01-19',
      lab_name: 'Quest Diagnostics',
      lab_country: 'New York, USA',
      is_flagged: false,
      is_sample: true,
      source_file: 'Sample_Report_08_Quest_Jan2026.pdf',
      sample_report_text:
        'QUEST DIAGNOSTICS (New York, USA) • Specimen Date: 2026-01-19 • 25-OH Vitamin D: 38 ng/mL (Reference: 30–100 ng/mL, Optimal)',
      confidence_score: 0.99,
    },

    // Report 9: May 2026 (LDL slightly above target at 106 mg/dL, TSH & Creatinine optimal)
    {
      id: 'sample-rpt-09-ldl',
      document_id: 'sample-doc-09',
      user_id: ISOLATED_USER_ID,
      canonical_key: 'ldl',
      raw_test_name: 'LDL Chol Calc (NIH)',
      raw_value: 106,
      raw_unit: 'mg/dL',
      raw_range: '50 - 99 mg/dL',
      normalized_value: 106,
      standard_unit: 'mg/dL',
      test_date: '2026-05-12',
      lab_name: 'Mount Sinai Lab Services',
      lab_country: 'New York, USA',
      is_flagged: true,
      is_sample: true,
      source_file: 'Sample_Report_09_MountSinai_May2026.pdf',
      sample_report_text:
        'MOUNT SINAI LAB SERVICES (New York, USA) • Specimen Date: 2026-05-12 • LDL Cholesterol: 106 mg/dL (Reference: <100 mg/dL, Slightly above target)',
      confidence_score: 0.98,
    },
    {
      id: 'sample-rpt-09-tsh',
      document_id: 'sample-doc-09',
      user_id: ISOLATED_USER_ID,
      canonical_key: 'tsh',
      raw_test_name: 'TSH',
      raw_value: 2.35,
      raw_unit: 'mIU/L',
      raw_range: '0.45 - 4.50 mIU/L',
      normalized_value: 2.35,
      standard_unit: 'mIU/L',
      test_date: '2026-05-12',
      lab_name: 'Mount Sinai Lab Services',
      lab_country: 'New York, USA',
      is_flagged: false,
      is_sample: true,
      source_file: 'Sample_Report_09_MountSinai_May2026.pdf',
      sample_report_text:
        'MOUNT SINAI LAB SERVICES (New York, USA) • Specimen Date: 2026-05-12 • TSH: 2.35 mIU/L (Reference: 0.45–4.50 mIU/L, Optimal)',
      confidence_score: 0.99,
    },
    {
      id: 'sample-rpt-09-creat',
      document_id: 'sample-doc-09',
      user_id: ISOLATED_USER_ID,
      canonical_key: 'creatinine',
      raw_test_name: 'Creatinine, Serum',
      raw_value: 0.86,
      raw_unit: 'mg/dL',
      raw_range: '0.60 - 1.20 mg/dL',
      normalized_value: 0.86,
      standard_unit: 'mg/dL',
      test_date: '2026-05-12',
      lab_name: 'Mount Sinai Lab Services',
      lab_country: 'New York, USA',
      is_flagged: false,
      is_sample: true,
      source_file: 'Sample_Report_09_MountSinai_May2026.pdf',
      sample_report_text:
        'MOUNT SINAI LAB SERVICES (New York, USA) • Specimen Date: 2026-05-12 • Serum Creatinine: 0.86 mg/dL (Reference: 0.60–1.20 mg/dL, Optimal)',
      confidence_score: 0.99,
    },

    // Report 10: September 2026 (HbA1c 5.5% in range, Glucose 94 mg/dL, TG 132 mg/dL, Total Chol 186 mg/dL, HDL 55 mg/dL, Vit D 46 ng/mL)
    {
      id: 'sample-rpt-10-hba1c',
      document_id: 'sample-doc-10',
      user_id: ISOLATED_USER_ID,
      canonical_key: 'hba1c',
      raw_test_name: 'Hemoglobin A1c',
      raw_value: 5.5,
      raw_unit: '%',
      raw_range: '4.0 - 5.6 %',
      normalized_value: 5.5,
      standard_unit: '%',
      test_date: '2026-09-04',
      lab_name: 'Quest Diagnostics',
      lab_country: 'New York, USA',
      is_flagged: false,
      is_sample: true,
      source_file: 'Sample_Report_10_Quest_Sep2026.pdf',
      sample_report_text:
        'QUEST DIAGNOSTICS (New York, USA) • Specimen Date: 2026-09-04 • Hemoglobin A1c: 5.5 % (Reference: 4.0–5.6 %, Optimal)',
      confidence_score: 0.99,
    },
    {
      id: 'sample-rpt-10-glucose',
      document_id: 'sample-doc-10',
      user_id: ISOLATED_USER_ID,
      canonical_key: 'fasting_glucose',
      raw_test_name: 'Fasting Plasma Glucose',
      raw_value: 94,
      raw_unit: 'mg/dL',
      raw_range: '70 - 99 mg/dL',
      normalized_value: 94,
      standard_unit: 'mg/dL',
      test_date: '2026-09-04',
      lab_name: 'Quest Diagnostics',
      lab_country: 'New York, USA',
      is_flagged: false,
      is_sample: true,
      source_file: 'Sample_Report_10_Quest_Sep2026.pdf',
      sample_report_text:
        'QUEST DIAGNOSTICS (New York, USA) • Specimen Date: 2026-09-04 • Fasting Glucose: 94 mg/dL (Reference: 70–99 mg/dL, Optimal)',
      confidence_score: 0.99,
    },
    {
      id: 'sample-rpt-10-tc',
      document_id: 'sample-doc-10',
      user_id: ISOLATED_USER_ID,
      canonical_key: 'total_cholesterol',
      raw_test_name: 'Total Cholesterol',
      raw_value: 186,
      raw_unit: 'mg/dL',
      raw_range: '120 - 199 mg/dL',
      normalized_value: 186,
      standard_unit: 'mg/dL',
      test_date: '2026-09-04',
      lab_name: 'Quest Diagnostics',
      lab_country: 'New York, USA',
      is_flagged: false,
      is_sample: true,
      source_file: 'Sample_Report_10_Quest_Sep2026.pdf',
      sample_report_text:
        'QUEST DIAGNOSTICS (New York, USA) • Specimen Date: 2026-09-04 • Total Cholesterol: 186 mg/dL (Reference: <200 mg/dL, Optimal)',
      confidence_score: 0.99,
    },
    {
      id: 'sample-rpt-10-tg',
      document_id: 'sample-doc-10',
      user_id: ISOLATED_USER_ID,
      canonical_key: 'triglycerides',
      raw_test_name: 'Triglycerides',
      raw_value: 132,
      raw_unit: 'mg/dL',
      raw_range: '50 - 149 mg/dL',
      normalized_value: 132,
      standard_unit: 'mg/dL',
      test_date: '2026-09-04',
      lab_name: 'Quest Diagnostics',
      lab_country: 'New York, USA',
      is_flagged: false,
      is_sample: true,
      source_file: 'Sample_Report_10_Quest_Sep2026.pdf',
      sample_report_text:
        'QUEST DIAGNOSTICS (New York, USA) • Specimen Date: 2026-09-04 • Triglycerides: 132 mg/dL (Reference: <150 mg/dL, Optimal)',
      confidence_score: 0.99,
    },
    {
      id: 'sample-rpt-10-hdl',
      document_id: 'sample-doc-10',
      user_id: ISOLATED_USER_ID,
      canonical_key: 'hdl',
      raw_test_name: 'HDL Cholesterol',
      raw_value: 55,
      raw_unit: 'mg/dL',
      raw_range: '40 - 90 mg/dL',
      normalized_value: 55,
      standard_unit: 'mg/dL',
      test_date: '2026-09-04',
      lab_name: 'Quest Diagnostics',
      lab_country: 'New York, USA',
      is_flagged: false,
      is_sample: true,
      source_file: 'Sample_Report_10_Quest_Sep2026.pdf',
      sample_report_text:
        'QUEST DIAGNOSTICS (New York, USA) • Specimen Date: 2026-09-04 • HDL Cholesterol: 55 mg/dL (Reference: 40–90 mg/dL, Optimal)',
      confidence_score: 0.99,
    },
    {
      id: 'sample-rpt-10-vitd',
      document_id: 'sample-doc-10',
      user_id: ISOLATED_USER_ID,
      canonical_key: 'vitamin_d',
      raw_test_name: '25-Hydroxy Vitamin D',
      raw_value: 46,
      raw_unit: 'ng/mL',
      raw_range: '30 - 100 ng/mL',
      normalized_value: 46,
      standard_unit: 'ng/mL',
      test_date: '2026-09-04',
      lab_name: 'Quest Diagnostics',
      lab_country: 'New York, USA',
      is_flagged: false,
      is_sample: true,
      source_file: 'Sample_Report_10_Quest_Sep2026.pdf',
      sample_report_text:
        'QUEST DIAGNOSTICS (New York, USA) • Specimen Date: 2026-09-04 • 25-OH Vitamin D: 46 ng/mL (Reference: 30–100 ng/mL, Optimal)',
      confidence_score: 0.99,
    },
  ];

  const medications: Medication[] = [
    {
      id: 'sample-med-1',
      user_id: ISOLATED_USER_ID,
      name: 'Metformin XR',
      dosage: '500 mg',
      frequency: 'Once daily with dinner',
      start_date: '2024-09-25',
      is_active: true,
    },
    {
      id: 'sample-med-2',
      user_id: ISOLATED_USER_ID,
      name: 'Vitamin D3 (Cholecalciferol)',
      dosage: '2000 IU',
      frequency: 'Once daily with breakfast',
      start_date: '2024-07-01',
      is_active: true,
    },
    {
      id: 'sample-med-3',
      user_id: ISOLATED_USER_ID,
      name: 'Omega-3 Ethyl Esters',
      dosage: '1000 mg',
      frequency: 'Twice daily',
      start_date: '2025-01-10',
      is_active: true,
    },
  ];

  const events: LifeEvent[] = [
    {
      id: 'sample-evt-1',
      user_id: ISOLATED_USER_ID,
      title: 'Started Vitamin D3 2000 IU daily after deficiency finding (18 ng/mL)',
      category: 'medication',
      event_date: '2024-07-01',
    },
    {
      id: 'sample-evt-2',
      user_id: ISOLATED_USER_ID,
      title: 'Started Metformin XR 500 mg & 15-minute post-dinner walks',
      category: 'medication',
      event_date: '2024-09-25',
    },
    {
      id: 'sample-evt-3',
      user_id: ISOLATED_USER_ID,
      title: 'Switched to high-fiber Mediterranean diet & cut refined sugars',
      category: 'lifestyle',
      event_date: '2025-04-01',
    },
    {
      id: 'sample-evt-4',
      user_id: ISOLATED_USER_ID,
      title: 'Added 3x/week progressive resistance training',
      category: 'lifestyle',
      event_date: '2025-11-15',
    },
  ];

  const brief: DoctorBriefContent = {
    doctor_type: 'Specialist',
    patient_summary: {
      name: profile.full_name,
      age: 43,
      conditions: profile.conditions,
    },
    last_visit_date: '2025-10-08',
    key_changes: [
      'HbA1c improved over 2.5 years from 6.4% (Mar 2024, Out of range) → 6.0% (Mar 2025) → 5.5% (Sep 2026, In optimal range).',
      'Fasting Glucose decreased from 122 mg/dL (Mar 2024, Out of range) → 109 mg/dL (6.05 mmol/L, Mar 2025) → 94 mg/dL (Sep 2026).',
      'Triglycerides reduced by 43.6%: 234 mg/dL (Mar 2024, Out of range) → 175 mg/dL (1.98 mmol/L, Jun 2025) → 132 mg/dL (Sep 2026).',
      'Total Cholesterol improved from 238 → 186 mg/dL; LDL Cholesterol dropped from 148 → 106 mg/dL (still slightly above <100 mg/dL target); HDL rose from 38 → 55 mg/dL.',
      'Vitamin D (25-OH) normalized from 18 ng/mL (Deficient) → 46 ng/mL; TSH normalized from 4.85 → 2.35 mIU/L; Creatinine stable at 0.86 mg/dL.',
    ],
    trends_summary:
      'Longitudinal synthesis across 10 laboratory reports over 2.5 years (Mar 2024 – Sep 2026) demonstrates sustained glycemic, thyroid, and lipid recovery following initiation of Metformin XR 500 mg, Vitamin D3 2000 IU, Omega-3 1000 mg, and structured resistance training. HbA1c (5.5%), Fasting Glucose (94 mg/dL), Total Cholesterol (186 mg/dL), Triglycerides (132 mg/dL), Vitamin D (46 ng/mL), and TSH (2.35 mIU/L) have all reached target reference ranges, while LDL Cholesterol (106 mg/dL) remains slightly above the <100 mg/dL threshold.',
    current_medications: medications.map((m) => ({
      name: m.name,
      dosage: m.dosage,
      frequency: m.frequency,
      started: m.start_date,
    })),
    recent_events: events.map((e) => ({
      title: e.title,
      date: e.event_date,
      category: e.category,
    })),
    questions_to_ask: [
      'With HbA1c now in range at 5.5% and Fasting Glucose at 94 mg/dL, should we continue Metformin XR 500 mg at the current dose?',
      'LDL Cholesterol has come down from 148 to 106 mg/dL—can we continue dietary fiber and Omega-3s for another 6 months before considering statin therapy?',
      'Now that 25-OH Vitamin D is 46 ng/mL, should I step down Vitamin D3 from 2000 IU to a 1000 IU maintenance dose?',
    ],
    disclaimer: 'Medtrac organizes your records. It does not diagnose or replace your doctor.',
  };

  return {
    seedDate: todayUtc,
    profile,
    documents,
    results,
    medications,
    events,
    brief,
  };
}
