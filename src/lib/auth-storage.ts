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

/**
 * Default seeded test accounts so the user can test sign-in immediately
 * without even needing to sign up first.
 */
const DEFAULT_SEEDED_ACCOUNTS: RegisteredAccount[] = [
  {
    id: 'a0000000-0000-4000-8000-000000000001',
    firstName: 'Sarah',
    lastName: 'Jenkins',
    dob: '1982-04-12',
    email: 'sarah.jenkins@medtrac.org',
    phone: '+971501234567',
    password: 'password123',
    profile: {
      id: 'a0000000-0000-4000-8000-000000000001',
      full_name: 'Sarah Jenkins',
      first_name: 'Sarah',
      last_name: 'Jenkins',
      email: 'sarah.jenkins@medtrac.org',
      phone: '+971501234567',
      date_of_birth: '1982-04-12',
      conditions: ['Prediabetes', 'Cholesterol'],
      preferred_unit: 'mg_dl',
      created_at: '2026-01-01T00:00:00.000Z',
    },
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'a0000000-0000-4000-8000-000000000002',
    firstName: 'Test',
    lastName: 'User',
    dob: '1990-01-15',
    email: 'test@example.com',
    phone: '+15551234567',
    password: 'password123',
    profile: {
      id: 'a0000000-0000-4000-8000-000000000002',
      full_name: 'Test User',
      first_name: 'Test',
      last_name: 'User',
      email: 'test@example.com',
      phone: '+15551234567',
      date_of_birth: '1990-01-15',
      conditions: ['Hypertension', 'Diabetes'],
      preferred_unit: 'mg_dl',
      created_at: '2026-01-01T00:00:00.000Z',
    },
    createdAt: '2026-01-01T00:00:00.000Z',
  },
];

export function getRegisteredAccounts(): RegisteredAccount[] {
  if (typeof window === 'undefined') return DEFAULT_SEEDED_ACCOUNTS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      // Seed initial accounts
      localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_SEEDED_ACCOUNTS));
      return DEFAULT_SEEDED_ACCOUNTS;
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed;
    }
    return DEFAULT_SEEDED_ACCOUNTS;
  } catch (e) {
    console.warn('Error reading registered accounts:', e);
    return DEFAULT_SEEDED_ACCOUNTS;
  }
}

export function saveRegisteredAccount(account: RegisteredAccount): void {
  if (typeof window === 'undefined') return;
  try {
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
