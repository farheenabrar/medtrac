import { createClient } from './supabase/client';
import { UserProfile, LabResult, LifeEvent, Medication, DoctorBriefContent, DoctorShare } from './types';

export function isSupabaseConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return Boolean(url && anon && !url.includes('your-project-id') && !anon.includes('your-anon-key'));
}

// -------------------------------------------------------------
// PROFILE PERSISTENCE
// -------------------------------------------------------------
export async function getStoredProfile(): Promise<UserProfile | null> {
  if (typeof window === 'undefined') return null;

  if (isSupabaseConfigured()) {
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data, error } = await supabase
          .from('users_profile')
          .select('*')
          .eq('id', user.id)
          .single();

        if (data && !error) {
          localStorage.setItem('medtrac_profile', JSON.stringify(data));
          return data as UserProfile;
        }
      }
    } catch (e) {
      console.warn('Supabase profile fetch error, using local storage:', e);
    }
  }

  const local = localStorage.getItem('medtrac_profile');
  return local ? JSON.parse(local) : null;
}

export async function saveStoredProfile(profile: UserProfile): Promise<UserProfile> {
  if (typeof window !== 'undefined') {
    localStorage.setItem('medtrac_profile', JSON.stringify(profile));
  }

  if (isSupabaseConfigured()) {
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
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
// RESULTS PERSISTENCE
// -------------------------------------------------------------
export async function getStoredResults(): Promise<LabResult[]> {
  if (typeof window === 'undefined') return [];

  if (isSupabaseConfigured()) {
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data, error } = await supabase
          .from('results')
          .select('*')
          .eq('user_id', user.id)
          .order('test_date', { ascending: true });

        if (data && !error && data.length > 0) {
          localStorage.setItem('medtrac_results', JSON.stringify(data));
          return data as LabResult[];
        }
      }
    } catch (e) {
      console.warn('Supabase results fetch error, using local storage:', e);
    }
  }

  const local = localStorage.getItem('medtrac_results');
  return local ? JSON.parse(local) : [];
}

export async function saveStoredResults(results: LabResult[]): Promise<void> {
  if (typeof window !== 'undefined') {
    localStorage.setItem('medtrac_results', JSON.stringify(results));
  }

  if (isSupabaseConfigured()) {
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user && results.length > 0) {
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
// LIFE EVENTS PERSISTENCE
// -------------------------------------------------------------
export async function getStoredEvents(): Promise<LifeEvent[]> {
  if (typeof window === 'undefined') return [];

  if (isSupabaseConfigured()) {
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data, error } = await supabase
          .from('events')
          .select('*')
          .eq('user_id', user.id)
          .order('event_date', { ascending: true });

        if (data && !error && data.length > 0) {
          localStorage.setItem('medtrac_events', JSON.stringify(data));
          return data as LifeEvent[];
        }
      }
    } catch (e) {
      console.warn('Supabase events fetch error:', e);
    }
  }

  const local = localStorage.getItem('medtrac_events');
  return local ? JSON.parse(local) : [];
}

export async function saveStoredEvents(events: LifeEvent[]): Promise<void> {
  if (typeof window !== 'undefined') {
    localStorage.setItem('medtrac_events', JSON.stringify(events));
  }

  if (isSupabaseConfigured()) {
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user && events.length > 0) {
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
// MEDICATIONS PERSISTENCE
// -------------------------------------------------------------
export async function getStoredMedications(): Promise<Medication[]> {
  if (typeof window === 'undefined') return [];

  if (isSupabaseConfigured()) {
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data, error } = await supabase
          .from('medications')
          .select('*')
          .eq('user_id', user.id)
          .order('start_date', { ascending: false });

        if (data && !error && data.length > 0) {
          localStorage.setItem('medtrac_medications', JSON.stringify(data));
          return data as Medication[];
        }
      }
    } catch (e) {
      console.warn('Supabase medications fetch error:', e);
    }
  }

  const local = localStorage.getItem('medtrac_medications');
  return local ? JSON.parse(local) : [];
}

export async function saveStoredMedications(meds: Medication[]): Promise<void> {
  if (typeof window !== 'undefined') {
    localStorage.setItem('medtrac_medications', JSON.stringify(meds));
  }

  if (isSupabaseConfigured()) {
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user && meds.length > 0) {
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
