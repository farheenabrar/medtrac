import { UserProfile } from './types';

export interface RegisteredAccount {
  id: string;
  firstName: string;
  lastName: string;
  dob: string;
  email?: string;
  phone?: string;
  password: string;
  profile: UserProfile;
  createdAt: string;
}

const STORAGE_KEY = 'medtrac_registered_accounts';
const SESSION_AUTH_KEY = 'medtrac_authenticated_session';
const OWN_EMAIL_KEY = 'medtrac_own_credential_email';

const LEGACY_DUMMY_EMAILS = new Set([
  'sarah.jenkins@medtrac.org',
  'sarah.jenkins@gmail.com',
  'test@example.com',
  'dummy.test@medtrac.org',
]);

export function setSessionAuthenticated(isAuthenticated: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    if (isAuthenticated) {
      sessionStorage.setItem(SESSION_AUTH_KEY, 'true');
      localStorage.setItem(SESSION_AUTH_KEY, 'true');
    } else {
      sessionStorage.removeItem(SESSION_AUTH_KEY);
      localStorage.removeItem(SESSION_AUTH_KEY);
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
    const hasProfile = Boolean(localStorage.getItem('medtrac_profile'));
    return hasSession && hasProfile;
  } catch {
    return false;
  }
}

export function saveOwnCredentialEmail(email: string): void {
  if (typeof window === 'undefined' || !email) return;
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
    localStorage.removeItem('medtrac_results');
    localStorage.removeItem('medtrac_events');
    localStorage.removeItem('medtrac_medications');
    localStorage.removeItem('medtrac_brief_GP');
    localStorage.removeItem('medtrac_brief_Endocrinologist');
    localStorage.removeItem('medtrac_brief_Nutritionist');
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
