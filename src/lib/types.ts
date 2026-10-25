export type CanonicalKey =
  | 'hba1c'
  | 'fasting_glucose'
  | 'triglycerides'
  | 'hdl'
  | 'ldl'
  | 'other_untracked';

export type UnitSystem = 'mg_dl' | 'mmol_l';

export interface UserProfile {
  id: string;
  full_name: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
  date_of_birth: string;
  profile_photo?: string;
  gender?: string;
  weight?: number | string;
  weight_unit?: 'kg' | 'lbs';
  height?: number | string;
  height_unit?: 'cm' | 'ft';
  bmi?: number;
  bmi_category?: string;
  bmi_ai_note?: string;
  preferred_unit?: UnitSystem;
  conditions: string[];
  created_at?: string;
  updated_at?: string;
}

export interface LabDocument {
  id: string;
  user_id: string;
  storage_path: string;
  file_name: string;
  mime_type: string;
  file_size_bytes: number;
  lab_name?: string;
  lab_country?: string;
  test_date?: string;
  status: 'uploaded' | 'processing' | 'reviewed' | 'failed';
  created_at?: string;
}

export interface LabResult {
  id: string;
  document_id?: string;
  user_id: string;
  canonical_key: CanonicalKey;
  raw_test_name: string;
  raw_value: number;
  raw_unit: string;
  raw_range?: string;
  normalized_value: number;
  standard_unit: string;
  test_date: string;
  lab_name?: string;
  lab_country?: string;
  is_flagged: boolean;
  confidence_score?: number;
  created_at?: string;
}

export interface LifeEvent {
  id: string;
  user_id: string;
  title: string;
  description?: string;
  category: 'medication' | 'lifestyle' | 'diagnosis' | 'other';
  event_date: string;
  created_at?: string;
}

export interface Medication {
  id: string;
  user_id: string;
  name: string;
  dosage: string;
  frequency: string;
  start_date: string;
  end_date?: string;
  is_active: boolean;
  created_at?: string;
}

export interface DoctorShare {
  id: string;
  user_id?: string;
  token: string;
  doctor_type: string;
  brief_content: DoctorBriefContent;
  view_count: number;
  expires_at: string;
  is_revoked: boolean;
  created_at?: string;
}

export interface DoctorBriefContent {
  doctor_type: string;
  patient_summary: {
    name: string;
    age?: number;
    conditions: string[];
  };
  last_visit_date?: string;
  key_changes: string[];
  trends_summary: string;
  current_medications: {
    name: string;
    dosage: string;
    frequency: string;
    started: string;
  }[];
  recent_events: {
    title: string;
    date: string;
    category: string;
  }[];
  questions_to_ask: string[];
  disclaimer: string;
}
