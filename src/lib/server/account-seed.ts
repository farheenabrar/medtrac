import crypto from 'crypto';
import { UserProfile, LabResult, LifeEvent, Medication, DoctorBriefContent } from '../types';

const ISOLATED_USER_ID = 'usr-seeded-clinical-timeline-01';

let lastResetUtcDate = new Date().toISOString().split('T')[0];

export function isSpecialAccessEnabled(): boolean {
  return process.env.REVIEWER_ACCESS_ENABLED === 'true';
}

export function hashPasswordSha256(plainPassword: string): string {
  return crypto.createHash('sha256').update(plainPassword, 'utf8').digest('hex');
}

export function verifyPasswordAgainstHash(plainPassword: string, expectedHexHash: string): boolean {
  try {
    const cleanExpected = expectedHexHash.trim().toLowerCase();
    const candidateHex = hashPasswordSha256(plainPassword).toLowerCase();
    const a = Buffer.from(candidateHex, 'utf8');
    const b = Buffer.from(cleanExpected, 'utf8');
    if (a.length !== b.length) {
      // Constant-time dummy comparison to avoid timing leak
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
  const configuredEmail = (process.env.REVIEWER_EMAIL || '').trim().toLowerCase();
  if (!configuredEmail) return false;
  return normalizedEmail === configuredEmail;
}

export function verifyConfiguredSpecialCredentials(
  normalizedEmail: string,
  rawPassword: string
): { matchedEmail: boolean; validPassword: boolean } {
  if (!isConfiguredSpecialEmail(normalizedEmail)) {
    return { matchedEmail: false, validPassword: false };
  }
  const configuredHash = (process.env.REVIEWER_PASSWORD_HASH || '').trim();
  if (!configuredHash) {
    return { matchedEmail: true, validPassword: false };
  }
  const valid = verifyPasswordAgainstHash(rawPassword, configuredHash);
  return { matchedEmail: true, validPassword: valid };
}

export function getSeededAccountDataset(emailOverride?: string): {
  seedDate: string;
  profile: UserProfile;
  results: LabResult[];
  medications: Medication[];
  events: LifeEvent[];
  brief: DoctorBriefContent;
} {
  const todayUtc = new Date().toISOString().split('T')[0];
  if (lastResetUtcDate !== todayUtc) {
    lastResetUtcDate = todayUtc;
  }

  const accountEmail =
    emailOverride || (process.env.REVIEWER_EMAIL || '').trim().toLowerCase() || 'patient@example.com';

  const profile: UserProfile = {
    id: ISOLATED_USER_ID,
    full_name: 'Jordan Mercer',
    first_name: 'Jordan',
    last_name: 'Mercer',
    email: accountEmail,
    date_of_birth: '1983-04-18',
    gender: 'Female',
    weight: 71.2,
    weight_unit: 'kg',
    height: 168,
    height_unit: 'cm',
    bmi: 25.2,
    bmi_category: 'Overweight (Improving)',
    bmi_ai_note:
      'BMI is 25.2 kg/m² (down from 27.4 kg/m² in 2024). Consistent post-meal walking and resistance training have supported steady improvements in HbA1c, triglycerides, and Vitamin D.',
    preferred_unit: 'mg_dl',
    conditions: ['Prediabetes', 'Triglycerides', 'Insulin Resistance', 'Cholesterol'],
  };

  // 10 Lab Reports over 2.5 years (2024 – 2026) covering HbA1c, glucose, lipids, vitamin D, TSH, creatinine
  const results: LabResult[] = [
    // Report 1: March 2024
    {
      id: 'seed-lab-01-hba1c',
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
      confidence_score: 0.99,
    },
    {
      id: 'seed-lab-01-glucose',
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
      confidence_score: 0.99,
    },
    {
      id: 'seed-lab-01-tg',
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
      confidence_score: 0.98,
    },

    // Report 2: June 2024
    {
      id: 'seed-lab-02-ldl',
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
      confidence_score: 0.98,
    },
    {
      id: 'seed-lab-02-hdl',
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
      confidence_score: 0.98,
    },
    {
      id: 'seed-lab-02-vitd',
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
      confidence_score: 0.97,
    },
    {
      id: 'seed-lab-02-tsh',
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
      confidence_score: 0.99,
    },
    {
      id: 'seed-lab-02-creat',
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
      confidence_score: 0.99,
    },

    // Report 3: September 2024
    {
      id: 'seed-lab-03-hba1c',
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
      confidence_score: 0.98,
    },
    {
      id: 'seed-lab-03-glucose',
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
      confidence_score: 0.98,
    },

    // Report 4: December 2024
    {
      id: 'seed-lab-04-tg',
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
      confidence_score: 0.97,
    },
    {
      id: 'seed-lab-04-ldl',
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
      confidence_score: 0.98,
    },
    {
      id: 'seed-lab-04-hdl',
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
      confidence_score: 0.98,
    },

    // Report 5: March 2025
    {
      id: 'seed-lab-05-hba1c',
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
      confidence_score: 0.99,
    },
    {
      id: 'seed-lab-05-glucose',
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
      confidence_score: 0.98,
    },
    {
      id: 'seed-lab-05-vitd',
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
      confidence_score: 0.97,
    },

    // Report 6: June 2025
    {
      id: 'seed-lab-06-tg',
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
      confidence_score: 0.98,
    },
    {
      id: 'seed-lab-06-tsh',
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
      confidence_score: 0.99,
    },
    {
      id: 'seed-lab-06-creat',
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
      confidence_score: 0.99,
    },

    // Report 7: October 2025
    {
      id: 'seed-lab-07-hba1c',
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
      confidence_score: 0.99,
    },
    {
      id: 'seed-lab-07-ldl',
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
      confidence_score: 0.98,
    },
    {
      id: 'seed-lab-07-hdl',
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
      confidence_score: 0.99,
    },

    // Report 8: January 2026
    {
      id: 'seed-lab-08-glucose',
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
      confidence_score: 0.99,
    },
    {
      id: 'seed-lab-08-tg',
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
      confidence_score: 0.98,
    },
    {
      id: 'seed-lab-08-vitd',
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
      confidence_score: 0.99,
    },

    // Report 9: May 2026
    {
      id: 'seed-lab-09-ldl',
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
      confidence_score: 0.98,
    },
    {
      id: 'seed-lab-09-tsh',
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
      confidence_score: 0.99,
    },
    {
      id: 'seed-lab-09-creat',
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
      confidence_score: 0.99,
    },

    // Report 10: September 2026
    {
      id: 'seed-lab-10-hba1c',
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
      confidence_score: 0.99,
    },
    {
      id: 'seed-lab-10-glucose',
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
      confidence_score: 0.99,
    },
    {
      id: 'seed-lab-10-tg',
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
      confidence_score: 0.99,
    },
    {
      id: 'seed-lab-10-hdl',
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
      confidence_score: 0.99,
    },
    {
      id: 'seed-lab-10-vitd',
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
      confidence_score: 0.99,
    },
  ];

  const medications: Medication[] = [
    {
      id: 'seed-med-1',
      user_id: ISOLATED_USER_ID,
      name: 'Metformin XR',
      dosage: '500 mg',
      frequency: 'Once daily with dinner',
      start_date: '2024-09-25',
      is_active: true,
    },
    {
      id: 'seed-med-2',
      user_id: ISOLATED_USER_ID,
      name: 'Vitamin D3 (Cholecalciferol)',
      dosage: '2000 IU',
      frequency: 'Once daily with breakfast',
      start_date: '2024-07-01',
      is_active: true,
    },
    {
      id: 'seed-med-3',
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
      id: 'seed-evt-1',
      user_id: ISOLATED_USER_ID,
      title: 'Started Vitamin D3 2000 IU daily after deficiency finding (18 ng/mL)',
      category: 'medication',
      event_date: '2024-07-01',
    },
    {
      id: 'seed-evt-2',
      user_id: ISOLATED_USER_ID,
      title: 'Started Metformin XR 500 mg & 15-minute post-dinner walks',
      category: 'medication',
      event_date: '2024-09-25',
    },
    {
      id: 'seed-evt-3',
      user_id: ISOLATED_USER_ID,
      title: 'Switched to high-fiber Mediterranean diet & cut refined sugars',
      category: 'lifestyle',
      event_date: '2025-04-01',
    },
    {
      id: 'seed-evt-4',
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
      'LDL Cholesterol improved from 148 mg/dL → 106 mg/dL (still slightly above <100 mg/dL target); HDL rose from 38 → 55 mg/dL.',
      'Vitamin D (25-OH) normalized from 18 ng/mL (Deficient) → 46 ng/mL; TSH normalized from 4.85 → 2.35 mIU/L; Creatinine stable at 0.86 mg/dL.',
    ],
    trends_summary:
      'Longitudinal synthesis across 10 laboratory reports over 2.5 years (2024–2026) demonstrates sustained glycemic, thyroid, and lipid recovery following initiation of Metformin XR 500 mg, Vitamin D3 2000 IU, Omega-3 1000 mg, and structured resistance training. HbA1c (5.5%), Fasting Glucose (94 mg/dL), Triglycerides (132 mg/dL), Vitamin D (46 ng/mL), and TSH (2.35 mIU/L) have all reached target reference ranges, while LDL Cholesterol (106 mg/dL) remains slightly above the <100 mg/dL threshold.',
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
    results,
    medications,
    events,
    brief,
  };
}
