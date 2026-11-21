import { UserProfile, LabResult, LifeEvent, Medication, DoctorBriefContent } from './types';

export interface RegisteredAccount {
  id: string;
  firstName: string;
  lastName: string;
  dob: string;
  email?: string;
  phone?: string;
  password: string;
  isVerified?: boolean;
  onboardingComplete?: boolean;
  profile: UserProfile;
  createdAt: string;
}

export interface IsolatedWorkspaceMeta {
  isolated: true;
  created_at: number;
  expires_at: number;
  seed_date: string;
}

const STORAGE_KEY = 'medtrac_registered_accounts';
const SESSION_AUTH_KEY = 'medtrac_authenticated_session';
const OWN_EMAIL_KEY = 'medtrac_own_credential_email';
const ISOLATED_SESSION_KEY = 'medtrac_isolated_session';

export const ISOLATED_STORAGE_KEYS = {
  PROFILE: 'medtrac_isolated_profile',
  RESULTS: 'medtrac_isolated_results',
  EVENTS: 'medtrac_isolated_events',
  MEDICATIONS: 'medtrac_isolated_medications',
  BRIEF_PREFIX: 'medtrac_isolated_brief_',
};

function getUtcDateString(): string {
  return new Date().toISOString().split('T')[0];
}

export function initializeIsolatedWorkspace(payload: {
  seedDate: string;
  profile: UserProfile;
  results?: LabResult[];
  medications?: Medication[];
  events?: LifeEvent[];
  brief?: DoctorBriefContent;
}): void {
  if (typeof window === 'undefined') return;
  try {
    const now = Date.now();
    const meta: IsolatedWorkspaceMeta = {
      isolated: true,
      created_at: now,
      expires_at: now + 24 * 60 * 60 * 1000,
      seed_date: payload.seedDate || getUtcDateString(),
    };
    sessionStorage.setItem(ISOLATED_SESSION_KEY, JSON.stringify(meta));
    localStorage.setItem(ISOLATED_SESSION_KEY, JSON.stringify(meta));

    localStorage.setItem(ISOLATED_STORAGE_KEYS.PROFILE, JSON.stringify(payload.profile));
    localStorage.setItem(ISOLATED_STORAGE_KEYS.RESULTS, JSON.stringify(payload.results || []));
    localStorage.setItem(
      ISOLATED_STORAGE_KEYS.MEDICATIONS,
      JSON.stringify(payload.medications || [])
    );
    localStorage.setItem(ISOLATED_STORAGE_KEYS.EVENTS, JSON.stringify(payload.events || []));

    Object.keys(localStorage).forEach((k) => {
      if (k.startsWith(ISOLATED_STORAGE_KEYS.BRIEF_PREFIX)) {
        localStorage.removeItem(k);
      }
    });
    if (payload.brief) {
      localStorage.setItem(
        `${ISOLATED_STORAGE_KEYS.BRIEF_PREFIX}Specialist`,
        JSON.stringify(payload.brief)
      );
    }

    sessionStorage.setItem(SESSION_AUTH_KEY, 'true');
    localStorage.setItem(SESSION_AUTH_KEY, 'true');
    window.dispatchEvent(new Event('medtrac-auth-changed'));
  } catch (e) {
    console.warn('Error initializing isolated workspace:', e);
  }
}

export function clearIsolatedWorkspace(): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.removeItem(ISOLATED_SESSION_KEY);
    localStorage.removeItem(ISOLATED_SESSION_KEY);
    localStorage.removeItem(ISOLATED_STORAGE_KEYS.PROFILE);
    localStorage.removeItem(ISOLATED_STORAGE_KEYS.RESULTS);
    localStorage.removeItem(ISOLATED_STORAGE_KEYS.EVENTS);
    localStorage.removeItem(ISOLATED_STORAGE_KEYS.MEDICATIONS);
    Object.keys(localStorage).forEach((k) => {
      if (k.startsWith(ISOLATED_STORAGE_KEYS.BRIEF_PREFIX)) {
        localStorage.removeItem(k);
      }
    });
  } catch (e) {
    console.warn('Error clearing isolated workspace:', e);
  }
}

export function isIsolatedSession(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const raw =
      sessionStorage.getItem(ISOLATED_SESSION_KEY) ||
      localStorage.getItem(ISOLATED_SESSION_KEY);
    if (!raw) return false;
    const meta = JSON.parse(raw) as IsolatedWorkspaceMeta;
    if (!meta || meta.isolated !== true) return false;

    const now = Date.now();
    const todayUtc = getUtcDateString();
    if (now > meta.expires_at || meta.seed_date !== todayUtc) {
      clearIsolatedWorkspace();
      return false;
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
      clearIsolatedWorkspace();
      fetch('/api/auth/me', { method: 'DELETE' }).catch(() => {});
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
    if (isIsolatedSession()) {
      return Boolean(localStorage.getItem(ISOLATED_STORAGE_KEYS.PROFILE));
    }
    const hasProfile = Boolean(localStorage.getItem('medtrac_profile'));
    return hasProfile;
  } catch {
    return false;
  }
}

export function saveOwnCredentialEmail(email: string): void {
  if (typeof window === 'undefined' || !email) return;
  if (isIsolatedSession()) return;
  try {
    localStorage.setItem(OWN_EMAIL_KEY, email.trim().toLowerCase());
  } catch (e) {
    console.warn('Error saving own credential email:', e);
  }
}

export function getOwnCredentialEmail(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem(OWN_EMAIL_KEY);
  } catch {
    return null;
  }
}

export function clearAllUserRecords(profileId?: string): void {
  if (typeof window === 'undefined') return;
  try {
    clearIsolatedWorkspace();
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
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.warn('Error reading registered accounts:', e);
    return [];
  }
}

export function saveRegisteredAccount(account: RegisteredAccount): void {
  if (typeof window === 'undefined') return;
  if (isIsolatedSession()) return;
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
