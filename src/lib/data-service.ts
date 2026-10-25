import { createClient } from './supabase/client';
import { UserProfile, LabResult, LifeEvent, Medication } from './types';

export function isSupabaseConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return Boolean(url && anon && !url.includes('your-project-id') && !anon.includes('your-anon-key'));
}

function getActiveProfileId(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem('medtrac_profile');
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.id || null;
  } catch {
    return null;
  }
}

// -------------------------------------------------------------
// PROFILE PERSISTENCE
// -------------------------------------------------------------
export async function getStoredProfile(): Promise<UserProfile | null> {
  if (typeof window === 'undefined') return null;

  const local = localStorage.getItem('medtrac_profile');
  if (local) {
    try {
      return JSON.parse(local) as UserProfile;
    } catch {
      return null;
    }
  }

  return null;
}

export async function saveStoredProfile(profile: UserProfile): Promise<UserProfile> {
  if (typeof window !== 'undefined') {
    localStorage.setItem('medtrac_profile', JSON.stringify(profile));
    try {
      const rawAccounts = localStorage.getItem('medtrac_registered_accounts');
      if (rawAccounts) {
        const accounts = JSON.parse(rawAccounts);
        if (Array.isArray(accounts)) {
          const updatedAccounts = accounts.map((acc) =>
            acc.id === profile.id ||
            (profile.email && acc.email?.toLowerCase() === profile.email.toLowerCase())
              ? { ...acc, profile }
              : acc
          );
          localStorage.setItem('medtrac_registered_accounts', JSON.stringify(updatedAccounts));
        }
      }
    } catch {
      // Ignore sync warning
    }
  }

  if (isSupabaseConfigured()) {
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user && user.id === profile.id) {
        const payload = {
          ...profile,
          id: user.id,
          updated_at: new Date().toISOString(),
        };
        const { data, error } = await supabase
          .from('users_profile')
          .upsert(payload)
          .select()
          .single();

        if (data && !error) {
          localStorage.setItem('medtrac_profile', JSON.stringify(data));
          return data as UserProfile;
        }
      }
    } catch (e) {
      console.warn('Supabase profile save error, local storage updated:', e);
    }
  }

  return profile;
}

// -------------------------------------------------------------
// RESULTS PERSISTENCE (Scoped to active user profile)
// -------------------------------------------------------------
export async function getStoredResults(): Promise<LabResult[]> {
  if (typeof window === 'undefined') return [];

  const profileId = getActiveProfileId();
  if (!profileId) return [];

  const scopedKey = `medtrac_results_${profileId}`;
  const local = localStorage.getItem(scopedKey);
  return local ? JSON.parse(local) : [];
}

export async function saveStoredResults(results: LabResult[]): Promise<void> {
  if (typeof window === 'undefined') return;

  const profileId = getActiveProfileId();
  if (!profileId) return;

  const scopedKey = `medtrac_results_${profileId}`;
  localStorage.setItem(scopedKey, JSON.stringify(results));

  if (isSupabaseConfigured()) {
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user && user.id === profileId && results.length > 0) {
        const payload = results.map((r) => ({
          user_id: user.id,
          canonical_key: r.canonical_key,
          raw_test_name: r.raw_test_name,
          raw_value: r.raw_value,
          raw_unit: r.raw_unit,
          raw_range: r.raw_range,
          normalized_value: r.normalized_value || r.raw_value,
          standard_unit: r.standard_unit || r.raw_unit,
          test_date: r.test_date,
          is_flagged: r.is_flagged ?? false,
          confidence_score: r.confidence_score ?? 0.95,
        }));

        await supabase.from('results').upsert(payload);
      }
    } catch (e) {
      console.warn('Supabase results upsert error:', e);
    }
  }
}

// -------------------------------------------------------------
// LIFE EVENTS PERSISTENCE (Scoped to active user profile)
// -------------------------------------------------------------
export async function getStoredEvents(): Promise<LifeEvent[]> {
  if (typeof window === 'undefined') return [];

  const profileId = getActiveProfileId();
  if (!profileId) return [];

  const scopedKey = `medtrac_events_${profileId}`;
  const local = localStorage.getItem(scopedKey);
  return local ? JSON.parse(local) : [];
}

export async function saveStoredEvents(events: LifeEvent[]): Promise<void> {
  if (typeof window === 'undefined') return;

  const profileId = getActiveProfileId();
  if (!profileId) return;

  const scopedKey = `medtrac_events_${profileId}`;
  localStorage.setItem(scopedKey, JSON.stringify(events));

  if (isSupabaseConfigured()) {
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user && user.id === profileId && events.length > 0) {
        const payload = events.map((evt) => ({
          user_id: user.id,
          title: evt.title,
          description: evt.description || '',
          category: evt.category || 'lifestyle',
          event_date: evt.event_date,
        }));
        await supabase.from('events').upsert(payload);
      }
    } catch (e) {
      console.warn('Supabase events save error:', e);
    }
  }
}

// -------------------------------------------------------------
// MEDICATIONS PERSISTENCE (Scoped to active user profile)
// -------------------------------------------------------------
export async function getStoredMedications(): Promise<Medication[]> {
  if (typeof window === 'undefined') return [];

  const profileId = getActiveProfileId();
  if (!profileId) return [];

  const scopedKey = `medtrac_medications_${profileId}`;
  const local = localStorage.getItem(scopedKey);
  return local ? JSON.parse(local) : [];
}

export async function saveStoredMedications(meds: Medication[]): Promise<void> {
  if (typeof window === 'undefined') return;

  const profileId = getActiveProfileId();
  if (!profileId) return;

  const scopedKey = `medtrac_medications_${profileId}`;
  localStorage.setItem(scopedKey, JSON.stringify(meds));

  if (isSupabaseConfigured()) {
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user && user.id === profileId && meds.length > 0) {
        const payload = meds.map((m) => ({
          user_id: user.id,
          name: m.name,
          dosage: m.dosage,
          frequency: m.frequency,
          start_date: m.start_date,
          end_date: m.end_date || null,
          is_active: m.is_active ?? true,
        }));
        await supabase.from('medications').upsert(payload);
      }
    } catch (e) {
      console.warn('Supabase medications save error:', e);
    }
  }
}
