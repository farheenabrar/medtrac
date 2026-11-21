import { UserProfile } from './types';
import {
  DEMO_SEED_PROFILE,
  DEMO_SEED_RESULTS,
  DEMO_SEED_MEDICATIONS,
  DEMO_SEED_EVENTS,
  DEMO_SEED_BRIEF,
} from './demo-seed';

export interface RegisteredAccount {
  id: string;
  firstName: string;
  lastName: string;
  dob: string;
  email?: string;
  phone?: string;
  password: string;
  isVerified?: boolean;
  failedAttempts?: number;
  lockedUntil?: number;
  profile: UserProfile;
  createdAt: string;
}

export interface DemoSessionMeta {
  is_demo: true;
  created_at: number;
  expires_at: number;
  seed_date: string;
}

const STORAGE_KEY = 'medtrac_registered_accounts';
const SESSION_AUTH_KEY = 'medtrac_authenticated_session';
const OWN_EMAIL_KEY = 'medtrac_own_credential_email';
const DEMO_SESSION_KEY = 'medtrac_demo_session';

export const DEMO_STORAGE_KEYS = {
  PROFILE: 'medtrac_demo_profile',
  RESULTS: 'medtrac_demo_results',
  EVENTS: 'medtrac_demo_events',
  MEDICATIONS: 'medtrac_demo_medications',
  BRIEF_PREFIX: 'medtrac_demo_brief_',
};

const LEGACY_DUMMY_EMAILS = new Set([
  'sarah.jenkins@medtrac.org',
  'dummy.test@medtrac.org',
]);

function getUtcDateString(): string {
  return new Date().toISOString().split('T')[0];
}

/**
 * Seeds or resets the isolated demo workspace in browser storage.
 * Never touches real user storage keys (`medtrac_profile`, `medtrac_results_<id>`, etc.).
 */
export function seedIsolatedDemoWorkspace(): void {
  if (typeof window === 'undefined') return;
  try {
    const now = Date.now();
    const meta: DemoSessionMeta = {
      is_demo: true,
      created_at: now,
      expires_at: now + 24 * 60 * 60 * 1000, // 24-hour auto-delete
      seed_date: getUtcDateString(), // Nightly reset key
    };
    sessionStorage.setItem(DEMO_SESSION_KEY, JSON.stringify(meta));
    localStorage.setItem(DEMO_SESSION_KEY, JSON.stringify(meta));

    localStorage.setItem(DEMO_STORAGE_KEYS.PROFILE, JSON.stringify(DEMO_SEED_PROFILE));
    localStorage.setItem(DEMO_STORAGE_KEYS.RESULTS, JSON.stringify(DEMO_SEED_RESULTS));
    localStorage.setItem(DEMO_STORAGE_KEYS.MEDICATIONS, JSON.stringify(DEMO_SEED_MEDICATIONS));
    localStorage.setItem(DEMO_STORAGE_KEYS.EVENTS, JSON.stringify(DEMO_SEED_EVENTS));
    localStorage.setItem(
      `${DEMO_STORAGE_KEYS.BRIEF_PREFIX}Specialist`,
      JSON.stringify(DEMO_SEED_BRIEF)
    );
    localStorage.setItem('medtrac_share_demo-doctor-view', JSON.stringify(DEMO_SEED_BRIEF));

    sessionStorage.setItem(SESSION_AUTH_KEY, 'true');
    localStorage.setItem(SESSION_AUTH_KEY, 'true');
    window.dispatchEvent(new Event('medtrac-auth-changed'));
  } catch (e) {
    console.warn('Error seeding isolated demo workspace:', e);
  }
}

/**
 * Wipes the isolated demo workspace on logout or after 24 hours.
 */
export function clearIsolatedDemoWorkspace(): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.removeItem(DEMO_SESSION_KEY);
    localStorage.removeItem(DEMO_SESSION_KEY);
    localStorage.removeItem(DEMO_STORAGE_KEYS.PROFILE);
    localStorage.removeItem(DEMO_STORAGE_KEYS.RESULTS);
    localStorage.removeItem(DEMO_STORAGE_KEYS.EVENTS);
    localStorage.removeItem(DEMO_STORAGE_KEYS.MEDICATIONS);
    Object.keys(localStorage).forEach((k) => {
      if (k.startsWith(DEMO_STORAGE_KEYS.BRIEF_PREFIX)) {
        localStorage.removeItem(k);
      }
    });
  } catch (e) {
    console.warn('Error clearing isolated demo workspace:', e);
  }
}

/**
 * Checks whether the current session is an isolated demo session (`is_demo = true`).
 * Enforces the 24-hour expiration and nightly schedule reset automatically.
 */
export function isDemoSession(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const raw =
      sessionStorage.getItem(DEMO_SESSION_KEY) || localStorage.getItem(DEMO_SESSION_KEY);
    if (!raw) return false;
    const meta = JSON.parse(raw) as DemoSessionMeta;
    if (!meta || meta.is_demo !== true) return false;

    const now = Date.now();
    const todayUtc = getUtcDateString();

    // Auto-reset if 24 hours elapsed or if a new UTC day started (nightly reset)
    if (now > meta.expires_at || meta.seed_date !== todayUtc) {
      seedIsolatedDemoWorkspace();
    }
    return true;
  } catch {
    return false;
  }
}

export function setSessionAuthenticated(isAuthenticated: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    if (isAuthenticated) {
      sessionStorage.setItem(SESSION_AUTH_KEY, 'true');
      localStorage.setItem(SESSION_AUTH_KEY, 'true');
    } else {
      sessionStorage.removeItem(SESSION_AUTH_KEY);
      localStorage.removeItem(SESSION_AUTH_KEY);
      // If logging out of a demo session, auto-delete the temporary demo workspace
      clearIsolatedDemoWorkspace();
    }
    window.dispatchEvent(new Event('medtrac-auth-changed'));
  } catch (e) {
    console.warn('Error setting session auth state:', e);
  }
}

export function isSessionAuthenticated(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const hasSession =
      sessionStorage.getItem(SESSION_AUTH_KEY) === 'true' ||
      localStorage.getItem(SESSION_AUTH_KEY) === 'true';
    if (!hasSession) return false;
    if (isDemoSession()) {
      return Boolean(localStorage.getItem(DEMO_STORAGE_KEYS.PROFILE));
    }
    const hasProfile = Boolean(localStorage.getItem('medtrac_profile'));
    return hasProfile;
  } catch {
    return false;
  }
}

export function saveOwnCredentialEmail(email: string): void {
  if (typeof window === 'undefined' || !email) return;
  if (isDemoSession()) return; // Demo sessions never overwrite real user's saved email
  try {
    localStorage.setItem(OWN_EMAIL_KEY, email.trim().toLowerCase());
  } catch (e) {
    console.warn('Error saving own credential email:', e);
  }
}

export function getOwnCredentialEmail(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const val = localStorage.getItem(OWN_EMAIL_KEY);
    if (val && !LEGACY_DUMMY_EMAILS.has(val.toLowerCase())) {
      return val;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Clears any cached lab results, life events, medications, or doctor briefs
 * when a new user signs up so every screen starts completely empty by default.
 */
export function clearAllUserRecords(profileId?: string): void {
  if (typeof window === 'undefined') return;
  try {
    clearIsolatedDemoWorkspace();
    localStorage.removeItem('medtrac_results');
    localStorage.removeItem('medtrac_events');
    localStorage.removeItem('medtrac_medications');
    localStorage.removeItem('medtrac_brief_GP');
    localStorage.removeItem('medtrac_brief_Endocrinologist');
    localStorage.removeItem('medtrac_brief_Nutritionist');
    localStorage.removeItem('medtrac_brief_Specialist');
    if (profileId) {
      localStorage.removeItem(`medtrac_results_${profileId}`);
      localStorage.removeItem(`medtrac_events_${profileId}`);
      localStorage.removeItem(`medtrac_medications_${profileId}`);
    }
  } catch (e) {
    console.warn('Error clearing user records:', e);
  }
}

export function generateUUID(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function getRegisteredAccounts(): RegisteredAccount[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      const cleaned = parsed.filter(
        (acc) => !acc.email || !LEGACY_DUMMY_EMAILS.has(acc.email.toLowerCase())
      );
      if (cleaned.length !== parsed.length) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(cleaned));
      }
      return cleaned;
    }
    return [];
  } catch (e) {
    console.warn('Error reading registered accounts:', e);
    return [];
  }
}

export function saveRegisteredAccount(account: RegisteredAccount): void {
  if (typeof window === 'undefined') return;
  if (isDemoSession()) return; // Demo users cannot modify real registered accounts
  try {
    if (account.email) {
      saveOwnCredentialEmail(account.email);
    }
    const accounts = getRegisteredAccounts();
    const existingIndex = accounts.findIndex(
      (a) =>
        (account.email && a.email?.toLowerCase() === account.email.toLowerCase()) ||
        (account.phone && a.phone === account.phone) ||
        a.id === account.id
    );

    let updated: RegisteredAccount[];
    if (existingIndex >= 0) {
      updated = [...accounts];
      updated[existingIndex] = account;
    } else {
      updated = [account, ...accounts];
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch (e) {
    console.warn('Error saving registered account:', e);
  }
}

export function findAccountByEmail(email: string): RegisteredAccount | undefined {
  const accounts = getRegisteredAccounts();
  const cleanEmail = email.trim().toLowerCase();
  return accounts.find((a) => a.email?.toLowerCase() === cleanEmail);
}

export function findAccountByPhone(phone: string): RegisteredAccount | undefined {
  const accounts = getRegisteredAccounts();
  const cleanPhone = phone.replace(/\D/g, '');
  return accounts.find((a) => a.phone?.replace(/\D/g, '') === cleanPhone);
}
