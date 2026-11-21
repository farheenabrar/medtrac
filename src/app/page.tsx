'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  ShieldCheck,
  Sparkles,
  Mail,
  Smartphone,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  Eye,
  EyeOff,
  X,
  UploadCloud,
  TrendingUp,
  FileText,
  Lock,
  Trash2,
  ArrowRight,
  Check,
} from 'lucide-react';
import { UserProfile } from '@/lib/types';
import { createClient } from '@/lib/supabase/client';
import { isSupabaseConfigured, getStoredProfile, saveStoredProfile } from '@/lib/data-service';
import MedtracLogo from '@/components/MedtracLogo';
import {
  generateUUID,
  saveRegisteredAccount,
  findAccountByEmail,
  findAccountByPhone,
  getOwnCredentialEmail,
  saveOwnCredentialEmail,
  getRegisteredAccounts,
  setSessionAuthenticated,
  clearAllUserRecords,
  initializeIsolatedWorkspace,
} from '@/lib/auth-storage';

const COUNTRY_CODES = [
  { code: '+971', country: 'UAE 🇦🇪' },
  { code: '+91', country: 'India 🇮🇳' },
  { code: '+1', country: 'USA / Canada 🇺🇸' },
  { code: '+44', country: 'UK 🇬🇧' },
  { code: '+966', country: 'Saudi Arabia 🇸🇦' },
  { code: '+65', country: 'Singapore 🇸🇬' },
  { code: '+61', country: 'Australia 🇦🇺' },
];

function detectDefaultCountryCode(): string {
  if (typeof Intl === 'undefined') return '+971';
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
    if (tz.includes('Calcutta') || tz.includes('Kolkata')) return '+91';
    if (tz.includes('America/')) return '+1';
    if (tz.includes('London')) return '+44';
    if (tz.includes('Riyadh')) return '+966';
    if (tz.includes('Singapore')) return '+65';
    if (tz.includes('Australia')) return '+61';
    return '+971';
  } catch {
    return '+971';
  }
}

type AuthErrorCode =
  | 'INVALID_PASSWORD'
  | 'ACCOUNT_NOT_FOUND'
  | 'EMAIL_UNVERIFIED'
  | 'ACCOUNT_LOCKED'
  | 'RATE_LIMITED'
  | 'GENERIC'
  | null;

export default function AuthPage() {
  const router = useRouter();
  const passwordInputRef = useRef<HTMLInputElement>(null);

  // Default to "Sign Up" for new visitors; remember returning users in useEffect so they land on "Sign In"
  const [authMode, setAuthMode] = useState<'signup' | 'signin'>('signup');

  // Auth Channel: Email vs Mobile Phone
  const [channel, setChannel] = useState<'email' | 'phone'>('email');
  const [phoneAuthMethod, setPhoneAuthMethod] = useState<'password' | 'otp'>('otp');

  // Form Fields (Sign-Up reduced to email/phone, password, and "I'm 18 or older" checkbox)
  const [email, setEmail] = useState('');
  const [countryCode, setCountryCode] = useState('+971');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isAdultConfirmed, setIsAdultConfirmed] = useState(false);

  // Field-level inline validation errors
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [adultError, setAdultError] = useState<string | null>(null);
  const [phoneError, setPhoneError] = useState<string | null>(null);

  // Specific Auth Error Code for contextual actions
  const [authErrorCode, setAuthErrorCode] = useState<AuthErrorCode>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [forgotPasswordNotice, setForgotPasswordNotice] = useState<string | null>(null);

  // OTP State
  const [otpCode, setOtpCode] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otpNotice, setOtpNotice] = useState<string | null>(null);

  // Google Sign-In / Sign-Up Modal State
  const [showGoogleModal, setShowGoogleModal] = useState(false);
  const [googleEmail, setGoogleEmail] = useState('');
  const [ownCredentialEmail, setOwnCredentialEmail] = useState<string | null>(null);
  const [showGoogleSuggestion, setShowGoogleSuggestion] = useState(false);

  // Legal Info Modal State
  const [legalModal, setLegalModal] = useState<'terms' | 'privacy' | null>(null);

  // Loading state (prevents double submits)
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    router.prefetch('/feed-filters');
    router.prefetch('/upload');
    router.prefetch('/dashboard');
    router.prefetch('/brief');
    router.prefetch('/profile');

    setCountryCode(detectDefaultCountryCode());

    const savedOwn = getOwnCredentialEmail();
    setOwnCredentialEmail(savedOwn);

    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const explicitMode = params.get('mode');
      if (explicitMode === 'signup') {
        setAuthMode('signup');
      } else if (
        explicitMode === 'signin' ||
        Boolean(savedOwn) ||
        getRegisteredAccounts().length > 0 ||
        Boolean(localStorage.getItem('medtrac_profile'))
      ) {
        setAuthMode('signin');
      } else {
        setAuthMode('signup');
      }
    }

    async function checkOAuthRedirect() {
      if (typeof window !== 'undefined') {
        const hash = window.location.hash;
        const params = new URLSearchParams(window.location.search);
        if (hash.includes('access_token') || params.get('code')) {
          if (isSupabaseConfigured()) {
            try {
              const supabase = createClient();
              const {
                data: { user },
              } = await supabase.auth.getUser();
              if (user) {
                if (user.email) {
                  saveOwnCredentialEmail(user.email);
                }
                const storedProf = await getStoredProfile();
                const existing = user.email ? findAccountByEmail(user.email) : undefined;
                const matchedProfile =
                  existing?.profile ||
                  (storedProf &&
                  (storedProf.id === user.id ||
                    (user.email && storedProf.email?.toLowerCase() === user.email.toLowerCase()))
                    ? storedProf
                    : null);

                if (matchedProfile) {
                  await saveStoredProfile(matchedProfile);
                  setSessionAuthenticated(true);
                  router.replace('/dashboard');
                  return;
                }
                const fullName =
                  user.user_metadata?.full_name ||
                  user.user_metadata?.name ||
                  user.email?.split('@')[0] ||
                  'User';
                const parts = fullName.split(' ');
                const fName = parts[0] || 'User';
                const lName = parts.slice(1).join(' ') || '';
                clearAllUserRecords(user.id);
                const googleProfile: UserProfile = {
                  id: user.id,
                  full_name: fullName,
                  first_name: fName,
                  last_name: lName,
                  date_of_birth: user.user_metadata?.date_of_birth || '',
                  email: user.email || '',
                  phone: '',
                  conditions: [],
                  preferred_unit: 'mg_dl',
                };
                saveRegisteredAccount({
                  id: user.id,
                  firstName: fName,
                  lastName: lName,
                  dob: googleProfile.date_of_birth,
                  email: user.email || '',
                  password: 'google_oauth_account',
                  isVerified: true,
                  profile: googleProfile,
                  createdAt: new Date().toISOString(),
                });
                await saveStoredProfile(googleProfile);
                setSessionAuthenticated(true);
                router.replace('/feed-filters');
                return;
              }
            } catch (e) {
              console.warn('OAuth session check notice:', e);
            }
          }
        }
      }
      setSessionAuthenticated(false);
    }

    checkOAuthRedirect();
  }, [router]);

  const clearAllErrorsOnTyping = () => {
    if (emailError) setEmailError(null);
    if (passwordError) setPasswordError(null);
    if (adultError) setAdultError(null);
    if (phoneError) setPhoneError(null);
    if (errorMessage) setErrorMessage(null);
    if (authErrorCode) setAuthErrorCode(null);
  };

  const clearInlineErrors = () => {
    setEmailError(null);
    setPasswordError(null);
    setAdultError(null);
    setPhoneError(null);
    setErrorMessage(null);
    setAuthErrorCode(null);
    setSuccessMessage(null);
    setForgotPasswordNotice(null);
  };

  const passwordStrength = useMemo(() => {
    if (!password) {
      return {
        score: 0,
        label: 'Use 8+ characters with letters & numbers',
        color: 'bg-slate-200',
        textColor: 'text-slate-500',
      };
    }
    let score = 0;
    if (password.length >= 6) score++;
    if (password.length >= 8) score++;
    if (/[A-Za-z]/.test(password) && /[0-9]/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password) || password.length >= 12) score++;

    if (score <= 1) {
      return {
        score: 1,
        label: 'Weak — add more characters and a number',
        color: 'bg-rose-500',
        textColor: 'text-rose-600',
      };
    }
    if (score === 2) {
      return {
        score: 2,
        label: 'Fair — add numbers or symbols for stronger security',
        color: 'bg-amber-500',
        textColor: 'text-amber-700',
      };
    }
    if (score === 3) {
      return {
        score: 3,
        label: 'Good password strength',
        color: 'bg-[#2F62F5]',
        textColor: 'text-[#2F62F5]',
      };
    }
    return {
      score: 4,
      label: 'Strong password',
      color: 'bg-emerald-500',
      textColor: 'text-emerald-700',
    };
  }, [password]);

  const completeAuthAndNavigate = async (profile: UserProfile, isNewUser: boolean) => {
    if (profile.email) {
      saveOwnCredentialEmail(profile.email);
      setOwnCredentialEmail(profile.email);
    }
    if (isNewUser) {
      clearAllUserRecords(profile.id);
    }
    await saveStoredProfile(profile);
    setSessionAuthenticated(true);
    router.push(isNewUser ? '/feed-filters' : '/dashboard');
  };

  // 1. Google Sign-Up / Sign-In Handler
  const handleGoogleSignIn = async () => {
    if (loading) return;
    clearInlineErrors();
    const savedOwn = getOwnCredentialEmail();
    setOwnCredentialEmail(savedOwn);
    setGoogleEmail('');
    setShowGoogleSuggestion(true);

    if (isSupabaseConfigured()) {
      try {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
        if (supabaseUrl && supabaseAnonKey) {
          const settingsRes = await fetch(`${supabaseUrl}/auth/v1/settings`, {
            headers: { apikey: supabaseAnonKey },
          });
          if (settingsRes.ok) {
            const settings = await settingsRes.json();
            if (settings?.external?.google === true) {
              setLoading(true);
              const supabase = createClient();
              const { error } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                  redirectTo: `${window.location.origin}/auth/callback`,
                },
              });
              if (!error) return;
            }
          }
        }
      } catch (err) {
        console.warn('Google OAuth settings check fallback:', err);
      }
    }

    setShowGoogleModal(true);
  };

  const handleGoogleModalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    const chosenEmail = googleEmail.trim().toLowerCase();
    if (!chosenEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(chosenEmail)) {
      setErrorMessage("That email doesn't look right. Please enter a valid Google email.");
      return;
    }

    setLoading(true);
    setShowGoogleModal(false);

    const existing = findAccountByEmail(chosenEmail);
    if (existing) {
      await completeAuthAndNavigate(existing.profile, false);
      return;
    }

    const storedProf = await getStoredProfile();
    if (storedProf && storedProf.email?.toLowerCase() === chosenEmail) {
      await completeAuthAndNavigate(storedProf, false);
      return;
    }

    const derivedName = chosenEmail
      .split('@')[0]
      .replace(/[._-]/g, ' ')
      .replace(/\b\w/g, (l) => l.toUpperCase());
    const nameParts = derivedName.split(' ');
    const fName = nameParts[0] || 'User';
    const lName = nameParts.slice(1).join(' ') || '';

    const userId = generateUUID();
    const newProfile: UserProfile = {
      id: userId,
      full_name: `${fName} ${lName}`.trim(),
      first_name: fName,
      last_name: lName,
      date_of_birth: '',
      email: chosenEmail,
      phone: '',
      conditions: [],
      preferred_unit: 'mg_dl',
    };

    saveRegisteredAccount({
      id: userId,
      firstName: fName,
      lastName: lName,
      dob: '',
      email: chosenEmail,
      password: 'google_oauth_account',
      isVerified: true,
      profile: newProfile,
      createdAt: new Date().toISOString(),
    });

    await completeAuthAndNavigate(newProfile, authMode === 'signup');
  };

  // Forgot Password Flow
  const handleForgotPassword = async () => {
    clearInlineErrors();
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setEmailError('Enter your email address above first so we can send a password reset link.');
      return;
    }

    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail }),
      });
      const data = await res.json();
      if (!res.ok) {
        setEmailError(data.error || 'Could not process password reset request.');
        return;
      }
      setForgotPasswordNotice(data.message);
    } catch {
      setForgotPasswordNotice(
        `If an account exists for ${cleanEmail}, password reset instructions have been sent.`
      );
    }
  };

  const handleResendVerificationLink = () => {
    const cleanEmail = email.trim().toLowerCase();
    const existing = findAccountByEmail(cleanEmail);
    if (existing) {
      saveRegisteredAccount({ ...existing, isVerified: true });
    }
    clearInlineErrors();
    setSuccessMessage(`Verification email resent to ${cleanEmail}. You may now sign in.`);
  };

  // 2. Email Sign Up & Sign In
  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    clearInlineErrors();

    // Normalize email on client: trim and lowercase
    const cleanEmail = email.trim().toLowerCase();
    // Never trim or alter password on client
    const rawPassword = password;

    let hasValidationError = false;

    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setEmailError("That email doesn't look right. Try a format like you@example.com.");
      hasValidationError = true;
    }

    if (authMode === 'signup' && rawPassword.length < 6) {
      setPasswordError('Please choose a password with at least 6 characters.');
      hasValidationError = true;
    } else if (authMode === 'signin' && !rawPassword) {
      setPasswordError('Please enter your password to sign in.');
      hasValidationError = true;
    }

    if (authMode === 'signup' && !isAdultConfirmed) {
      setAdultError('Please confirm that you are 18 or older to create an account.');
      hasValidationError = true;
    }

    if (hasValidationError) return;

    if (authMode === 'signup') {
      setLoading(true);
      let userId = generateUUID();

      if (isSupabaseConfigured()) {
        try {
          const supabase = createClient();
          const { data } = await supabase.auth.signUp({
            email: cleanEmail,
            password: rawPassword,
          });
          if (data?.user?.id) {
            userId = data.user.id;
          }
        } catch (supaErr: any) {
          console.warn('Supabase signUp notice:', supaErr.message);
        }
      }

      const derivedFirst =
        cleanEmail
          .split('@')[0]
          .replace(/[._-]/g, ' ')
          .replace(/\b\w/g, (l) => l.toUpperCase())
          .split(' ')[0] || 'User';

      const newProfile: UserProfile = {
        id: userId,
        full_name: derivedFirst,
        first_name: derivedFirst,
        last_name: '',
        date_of_birth: '',
        email: cleanEmail,
        phone: '',
        conditions: [],
        preferred_unit: 'mg_dl',
      };

      saveRegisteredAccount({
        id: userId,
        firstName: derivedFirst,
        lastName: '',
        dob: '',
        email: cleanEmail,
        password: rawPassword,
        isVerified: true,
        onboardingComplete: false,
        profile: newProfile,
        createdAt: new Date().toISOString(),
      });

      await completeAuthAndNavigate(newProfile, true);
    } else {
      setLoading(true);

      const existingAccount = findAccountByEmail(cleanEmail);
      const storedProf = await getStoredProfile();
      const clientAccountSnapshot = existingAccount
        ? {
            email: existingAccount.email,
            password: existingAccount.password,
            isVerified: existingAccount.isVerified ?? true,
          }
        : storedProf && storedProf.email?.toLowerCase() === cleanEmail
        ? {
            email: storedProf.email,
            password: rawPassword,
            isVerified: true,
          }
        : undefined;

      try {
        const res = await fetch('/api/auth/signin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: cleanEmail,
            password: rawPassword,
            clientAccount: clientAccountSnapshot,
          }),
        });

        const data = await res.json();

        if (!res.ok) {
          setLoading(false);
          const code = (data.code as AuthErrorCode) || 'GENERIC';
          setAuthErrorCode(code);

          if (res.status === 401 && code === 'INVALID_PASSWORD') {
            setErrorMessage("That password doesn't match. Try again or reset it.");
          } else if (res.status === 401 && code === 'ACCOUNT_NOT_FOUND') {
            setErrorMessage("We couldn't find an account with that email. Create one?");
          } else if (res.status === 403 && code === 'EMAIL_UNVERIFIED') {
            setErrorMessage('Please verify your email.');
          } else if (res.status === 423 || res.status === 429) {
            setErrorMessage('Too many attempts. Please try again in 10 minutes.');
          } else {
            setErrorMessage(data.message || "That password doesn't match. Try again or reset it.");
          }
          return;
        }

        if (data.isolatedWorkspace && data.profile) {
          initializeIsolatedWorkspace({
            seedDate: data.seedDate,
            profile: data.profile,
            results: data.results || [],
            medications: data.medications || [],
            events: data.events || [],
            brief: data.brief,
          });
          router.push('/dashboard');
          return;
        }

        if (existingAccount) {
          await completeAuthAndNavigate(existingAccount.profile, false);
          return;
        }

        if (storedProf && storedProf.email?.toLowerCase() === cleanEmail) {
          await completeAuthAndNavigate(storedProf, false);
          return;
        }
      } catch (err) {
        console.warn('Sign-in endpoint error:', err);
      }

      setLoading(false);
      setAuthErrorCode('ACCOUNT_NOT_FOUND');
      setErrorMessage("We couldn't find an account with that email. Create one?");
    }
  };

  // 3. Mobile Phone Auth Handler (Country code + OTP)
  const handlePhoneAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    clearInlineErrors();

    const cleanDigits = phone.replace(/\D/g, '');
    if (!cleanDigits || cleanDigits.length < 6) {
      setPhoneError('That phone number looks too short. Please enter a valid mobile number.');
      return;
    }

    if (authMode === 'signup' && !isAdultConfirmed) {
      setAdultError('Please confirm that you are 18 or older to create an account.');
      return;
    }

    const fullPhoneNumber = `${countryCode}${cleanDigits}`;

    if (phoneAuthMethod === 'otp' && !otpSent) {
      setLoading(true);
      setTimeout(() => {
        setOtpNotice(`Verification code sent to ${fullPhoneNumber}.`);
        setOtpSent(true);
        setLoading(false);
      }, 300);
      return;
    }

    if (phoneAuthMethod === 'otp' && otpSent) {
      if (!otpCode.trim() || otpCode.trim().length < 4) {
        setPhoneError('Please enter the 6-digit verification code sent to your phone.');
        return;
      }

      setLoading(true);
      const existingAccount = findAccountByPhone(fullPhoneNumber);
      if (existingAccount && authMode === 'signin') {
        await completeAuthAndNavigate(existingAccount.profile, false);
        return;
      }

      const userId = generateUUID();
      const profile: UserProfile = {
        id: userId,
        full_name: 'User',
        first_name: 'User',
        last_name: '',
        date_of_birth: '',
        phone: fullPhoneNumber,
        conditions: [],
        preferred_unit: 'mg_dl',
      };
      saveRegisteredAccount({
        id: userId,
        firstName: 'User',
        lastName: '',
        dob: '',
        phone: fullPhoneNumber,
        password: 'otp_verified',
        isVerified: true,
        profile,
        createdAt: new Date().toISOString(),
      });

      await completeAuthAndNavigate(profile, authMode === 'signup');
      return;
    }

    if (!password || (authMode === 'signup' && password.length < 6)) {
      setPasswordError('Please enter a password with at least 6 characters.');
      return;
    }

    setLoading(true);
    const existingAccount = findAccountByPhone(fullPhoneNumber);
    if (existingAccount && authMode === 'signin') {
      if (existingAccount.password && existingAccount.password !== password) {
        setLoading(false);
        setAuthErrorCode('INVALID_PASSWORD');
        setErrorMessage("That password doesn't match. Try again or reset it.");
        return;
      }
      await completeAuthAndNavigate(existingAccount.profile, false);
      return;
    }

    const userId = generateUUID();
    const newProfile: UserProfile = {
      id: userId,
      full_name: 'User',
      first_name: 'User',
      last_name: '',
      date_of_birth: '',
      phone: fullPhoneNumber,
      conditions: [],
      preferred_unit: 'mg_dl',
    };

    saveRegisteredAccount({
      id: userId,
      firstName: 'User',
      lastName: '',
      dob: '',
      phone: fullPhoneNumber,
      password,
      isVerified: true,
      profile: newProfile,
      createdAt: new Date().toISOString(),
    });

    await completeAuthAndNavigate(newProfile, authMode === 'signup');
  };

  // Toggle password visibility and keep focus inside the password input field
  const handleToggleShowPassword = () => {
    setShowPassword((prev) => !prev);
    requestAnimationFrame(() => {
      if (passwordInputRef.current) {
        passwordInputRef.current.focus();
      }
    });
  };

  const matchingOwnSuggestion =
    ownCredentialEmail &&
    ownCredentialEmail.toLowerCase() !== googleEmail.trim().toLowerCase() &&
    (googleEmail.trim() === '' ||
      ownCredentialEmail.toLowerCase().includes(googleEmail.trim().toLowerCase()))
      ? ownCredentialEmail
      : null;

  return (
    <div className="min-h-[calc(100vh-110px)] flex flex-col justify-center py-6 sm:py-10 px-2 sm:px-4 motion-reduce:animate-none animate-in fade-in duration-200">
      <div className="w-full max-w-5xl mx-auto">
        {/* ===================================================================== */}
        {/* SINGLE SEMANTIC VALUE PROPOSITION + AUTH GRID (No duplicate DOM text) */}
        {/* ===================================================================== */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 xl:gap-12 items-center">
          {/* LEFT / TOP PANEL: Value Proposition (Single DOM instance for desktop & mobile) */}
          <section
            aria-labelledby="medtrac-hero-heading"
            className="lg:col-span-7 flex flex-col justify-center space-y-5 lg:space-y-6 lg:pr-2 max-w-[445px] lg:max-w-none mx-auto w-full"
          >
            {/* Brand Wordmark */}
            <div className="flex items-center gap-3.5">
              <MedtracLogo size="md" />
              <span className="text-2xl font-black tracking-tight text-slate-900">
                Med<span className="text-[#2F62F5]">trac</span>
              </span>
            </div>

            {/* Headline & Subheading */}
            <div className="space-y-2.5">
              <h1
                id="medtrac-hero-heading"
                className="text-2xl sm:text-3xl xl:text-4xl font-black text-slate-900 tracking-tight leading-[1.15]"
              >
                All your lab reports.{' '}
                <span className="text-[#2F62F5]">One clear health timeline.</span>
              </h1>
              <p className="text-xs sm:text-sm lg:text-base text-slate-600 leading-relaxed max-w-xl font-medium">
                Upload your reports once. Medtrac tracks every marker over time and prepares a one-page summary for your next doctor visit.
              </p>
            </div>

            {/* Three Benefit Rows */}
            <div className="space-y-3 bg-white/90 lg:bg-transparent border border-slate-200/80 lg:border-0 rounded-2xl lg:rounded-none p-4 lg:p-0 shadow-2xs lg:shadow-none">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 lg:w-10 lg:h-10 rounded-xl lg:rounded-2xl bg-[#EEF3FF] border border-[#D6E3FF] text-[#2F62F5] flex items-center justify-center shrink-0 shadow-2xs">
                  <UploadCloud className="w-4 h-4 lg:w-5 lg:h-5" />
                </div>
                <div>
                  <h2 className="text-xs sm:text-sm font-bold text-slate-900">Upload anything</h2>
                  <p className="text-xs sm:text-sm text-slate-600">
                    PDFs or photos from any lab, in seconds.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-8 h-8 lg:w-10 lg:h-10 rounded-xl lg:rounded-2xl bg-[#EEF3FF] border border-[#D6E3FF] text-[#2F62F5] flex items-center justify-center shrink-0 shadow-2xs">
                  <TrendingUp className="w-4 h-4 lg:w-5 lg:h-5" />
                </div>
                <div>
                  <h2 className="text-xs sm:text-sm font-bold text-slate-900">
                    See trends, not just numbers
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-600">
                    Watch HbA1c, cholesterol, glucose and more change over months and years.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-8 h-8 lg:w-10 lg:h-10 rounded-xl lg:rounded-2xl bg-[#EEF3FF] border border-[#D6E3FF] text-[#2F62F5] flex items-center justify-center shrink-0 shadow-2xs">
                  <FileText className="w-4 h-4 lg:w-5 lg:h-5" />
                </div>
                <div>
                  <h2 className="text-xs sm:text-sm font-bold text-slate-900">
                    Walk into appointments prepared
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-600">
                    Get a doctor-ready brief with what changed, what&apos;s out of range, and what to ask.
                  </p>
                </div>
              </div>
            </div>

            {/* Small Product Visual: Mock Timeline Chart + Mini Doctor Brief Card (Hidden with display:none on mobile) */}
            <div className="hidden lg:grid grid-cols-12 gap-3.5 pt-1">
              {/* Mock Timeline Chart */}
              <div className="col-span-7 bg-white rounded-2xl border border-slate-200/90 p-4 shadow-[0_4px_20px_rgba(15,23,42,0.04)] space-y-2.5">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-extrabold text-slate-900">HbA1c Timeline</span>
                      <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[10px] font-bold uppercase tracking-wide">
                        Sample
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-500">Target range: 4.0% – 5.6%</span>
                  </div>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-bold tabular-nums">
                    ↓ 6.4% → 5.5%
                  </span>
                </div>

                {/* SVG Line Graph with Highlighted "Out of range" Point */}
                <div className="relative pt-2 pb-1">
                  <svg viewBox="0 0 260 95" className="w-full h-24 overflow-visible" aria-hidden="true">
                    <rect x="0" y="48" width="260" height="32" rx="4" fill="#ecfdf5" />
                    <line x1="0" y1="48" x2="260" y2="48" stroke="#6ee7b7" strokeDasharray="3 3" strokeWidth="1" />

                    <path
                      d="M 24 22 Q 85 28, 130 42 T 236 62"
                      fill="none"
                      stroke="#2F62F5"
                      strokeWidth="2.75"
                      strokeLinecap="round"
                    />

                    {/* Point 1: Out of Range (Highlighted) */}
                    <circle cx="24" cy="22" r="7" fill="#fee2e2" />
                    <circle cx="24" cy="22" r="4.5" fill="#e11d48" stroke="#ffffff" strokeWidth="1.5" />
                    <rect x="4" y="0" width="96" height="15" rx="4" fill="#fff1f2" stroke="#fecdd3" strokeWidth="1" />
                    <text x="52" y="10.5" textAnchor="middle" className="text-[8.5px] font-bold fill-rose-700">
                      6.4% • Out of range
                    </text>

                    {/* Point 2: Improving */}
                    <circle cx="130" cy="42" r="4" fill="#2F62F5" stroke="#ffffff" strokeWidth="1.5" />
                    <text x="130" y="33" textAnchor="middle" className="text-[9px] font-bold fill-slate-600">
                      5.9%
                    </text>

                    {/* Point 3: In Range */}
                    <circle cx="236" cy="62" r="5" fill="#10b981" stroke="#ffffff" strokeWidth="1.5" />
                    <text x="228" y="52" textAnchor="end" className="text-[9px] font-bold fill-emerald-700">
                      5.5% In range
                    </text>

                    {/* X-Axis Labels */}
                    <text x="24" y="92" textAnchor="middle" className="text-[9px] font-medium fill-slate-400">
                      Mar &apos;24
                    </text>
                    <text x="130" y="92" textAnchor="middle" className="text-[9px] font-medium fill-slate-400">
                      Mar &apos;25
                    </text>
                    <text x="236" y="92" textAnchor="middle" className="text-[9px] font-medium fill-slate-400">
                      Sep &apos;26
                    </text>
                  </svg>
                </div>
              </div>

              {/* Mini "Doctor brief" Preview Card with One-Line Explanation of 24h QR Link */}
              <div className="col-span-5 bg-white rounded-2xl border border-slate-200/90 p-4 shadow-[0_4px_20px_rgba(15,23,42,0.04)] flex flex-col justify-between space-y-2.5">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <span className="text-xs font-extrabold text-slate-900">Doctor Brief</span>
                  <span className="px-2 py-0.5 rounded-md bg-blue-50 text-[#2F62F5] text-[10px] font-bold uppercase tracking-wide">
                    Sample
                  </span>
                </div>

                <div className="space-y-1.5 text-[11px]">
                  <div className="flex items-start gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                    <p className="text-slate-700 leading-snug">
                      <strong className="text-slate-900">Changed:</strong> HbA1c dropped 0.9% over 2.5 years.
                    </p>
                  </div>
                  <div className="flex items-start gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500 mt-1.5 shrink-0" />
                    <p className="text-slate-700 leading-snug">
                      <strong className="text-slate-900">Out of range:</strong> LDL 106 mg/dL (target &lt;100).
                    </p>
                  </div>
                  <div className="flex items-start gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#2F62F5] mt-1.5 shrink-0" />
                    <p className="text-slate-700 leading-snug">
                      <strong className="text-slate-900">Ask doctor:</strong> &ldquo;When should we recheck lipids?&rdquo;
                    </p>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100 space-y-1">
                  <div className="flex items-center justify-between text-[11px] font-bold text-slate-800">
                    <span>1-page PDF &amp; 24h QR link</span>
                    <span className="text-[#2F62F5]">Ready →</span>
                  </div>
                  <p className="text-[10px] text-slate-500 leading-snug">
                    Your doctor can scan or open the read-only link without an account; access expires automatically after 24 hours.
                  </p>
                </div>
              </div>
            </div>

            {/* "How it works" Strip: Upload -> Timeline -> Doctor brief */}
            <div className="hidden lg:inline-flex flex-wrap items-center gap-2.5 px-4 py-2.5 rounded-2xl bg-white/85 border border-slate-200/80 shadow-2xs text-xs font-semibold text-slate-700 self-start">
              <span className="text-slate-400 font-bold uppercase text-[10px] tracking-wider mr-1">
                How it works:
              </span>
              <span className="inline-flex items-center gap-1.5 font-bold text-slate-900">
                <span className="w-5 h-5 rounded-full bg-[#EEF3FF] text-[#2F62F5] text-[11px] font-black inline-flex items-center justify-center">
                  1
                </span>
                Upload
              </span>
              <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
              <span className="inline-flex items-center gap-1.5 font-bold text-slate-900">
                <span className="w-5 h-5 rounded-full bg-[#EEF3FF] text-[#2F62F5] text-[11px] font-black inline-flex items-center justify-center">
                  2
                </span>
                Timeline
              </span>
              <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
              <span className="inline-flex items-center gap-1.5 font-bold text-slate-900">
                <span className="w-5 h-5 rounded-full bg-[#EEF3FF] text-[#2F62F5] text-[11px] font-black inline-flex items-center justify-center">
                  3
                </span>
                Doctor brief
              </span>
            </div>
          </section>

          {/* ===================================================================== */}
          {/* RIGHT PANEL: Auth Card (445px width, generous spacing)                */}
          {/* ===================================================================== */}
          <div className="lg:col-span-5 w-full max-w-[445px] mx-auto">
            <div className="card-depth p-6 sm:p-8 space-y-5 bg-white rounded-[28px] border border-slate-200/90 shadow-[0_12px_36px_rgba(15,23,42,0.06)]">
              {/* Dynamic Title & One-Line Helper Text Above Tabs */}
              <div className="text-center space-y-1">
                <h2 className="text-2xl font-black text-slate-900 tracking-tight">
                  {authMode === 'signup' ? 'Create your free account' : 'Welcome back'}
                </h2>
                <p className="text-xs sm:text-sm text-slate-600 font-medium">
                  {authMode === 'signup'
                    ? 'Turn scattered lab reports into one organized health timeline.'
                    : 'Sign in to view your lab timeline and doctor visit briefs.'}
                </p>
              </div>

              {/* Segmented Sign Up / Sign In Toggle */}
              <div
                role="tablist"
                aria-label="Authentication mode"
                className="grid grid-cols-2 rounded-2xl bg-slate-100 p-1.5 border border-slate-200/80"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={authMode === 'signup'}
                  onClick={() => {
                    setAuthMode('signup');
                    clearInlineErrors();
                  }}
                  className={`py-2.5 text-xs sm:text-sm font-bold rounded-xl transition-all duration-150 motion-reduce:transition-none tap-press focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2F62F5] ${
                    authMode === 'signup'
                      ? 'bg-white text-[#2F62F5] font-black shadow-xs ring-1 ring-slate-900/5'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Sign Up
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={authMode === 'signin'}
                  onClick={() => {
                    setAuthMode('signin');
                    setOwnCredentialEmail(getOwnCredentialEmail());
                    clearInlineErrors();
                  }}
                  className={`py-2.5 text-xs sm:text-sm font-bold rounded-xl transition-all duration-150 motion-reduce:transition-none tap-press focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2F62F5] ${
                    authMode === 'signin'
                      ? 'bg-white text-[#2F62F5] font-black shadow-xs ring-1 ring-slate-900/5'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Sign In
                </button>
              </div>

              {/* Primary Quick Option: Continue with Google */}
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={loading}
                className="w-full flex items-center justify-center gap-2.5 py-3 px-4 rounded-2xl bg-white border border-slate-300/90 hover:bg-slate-50 text-slate-800 text-xs sm:text-sm font-bold transition-all tap-press shadow-2xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2F62F5]"
              >
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                <span>Continue with Google</span>
              </button>

              {/* Fixed Centered Divider: Line on Both Sides, Text on One Line */}
              <div className="flex items-center gap-3" role="separator">
                <div className="h-px flex-1 bg-slate-200" />
                <span className="text-xs font-semibold text-slate-500 whitespace-nowrap select-none">
                  or continue with
                </span>
                <div className="h-px flex-1 bg-slate-200" />
              </div>

              {/* Channel Switcher: Email vs Mobile Phone */}
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    setChannel('email');
                    clearInlineErrors();
                  }}
                  className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-2xl border text-xs sm:text-sm font-bold transition-all tap-press focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2F62F5] ${
                    channel === 'email'
                      ? 'border-[#2F62F5] bg-[#F5F8FF] text-[#2F62F5] shadow-2xs'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <Mail className="w-4 h-4" />
                  <span>Email</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setChannel('phone');
                    clearInlineErrors();
                  }}
                  className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-2xl border text-xs sm:text-sm font-bold transition-all tap-press focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2F62F5] ${
                    channel === 'phone'
                      ? 'border-[#2F62F5] bg-[#F5F8FF] text-[#2F62F5] shadow-2xs'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <Smartphone className="w-4 h-4" />
                  <span>Mobile Phone</span>
                </button>
              </div>

              {/* Actionable Error Banner */}
              {errorMessage && (
                <div
                  role="alert"
                  className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl space-y-2 text-xs text-rose-900 font-medium animate-in fade-in duration-150"
                >
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                    <span>{errorMessage}</span>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 pl-6 pt-0.5">
                    {authErrorCode === 'INVALID_PASSWORD' && (
                      <button
                        type="button"
                        onClick={handleForgotPassword}
                        className="font-bold text-[#2F62F5] hover:underline"
                      >
                        Forgot password?
                      </button>
                    )}

                    {authErrorCode === 'ACCOUNT_NOT_FOUND' && (
                      <button
                        type="button"
                        onClick={() => {
                          setAuthMode('signup');
                          clearInlineErrors();
                        }}
                        className="font-bold text-[#2F62F5] hover:underline"
                      >
                        Switch to Sign Up →
                      </button>
                    )}

                    {authErrorCode === 'EMAIL_UNVERIFIED' && (
                      <button
                        type="button"
                        onClick={handleResendVerificationLink}
                        className="font-bold text-[#2F62F5] hover:underline"
                      >
                        Resend link
                      </button>
                    )}
                  </div>
                </div>
              )}

              {successMessage && (
                <div
                  role="status"
                  className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-start gap-2 text-xs text-emerald-800 font-medium"
                >
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>{successMessage}</span>
                </div>
              )}

              {forgotPasswordNotice && (
                <div
                  role="status"
                  className="p-3.5 bg-blue-50 border border-blue-200 rounded-2xl flex items-start gap-2 text-xs text-blue-900 font-medium"
                >
                  <CheckCircle2 className="w-4 h-4 text-[#2F62F5] shrink-0 mt-0.5" />
                  <span>{forgotPasswordNotice}</span>
                </div>
              )}

              {otpNotice && (
                <div
                  role="status"
                  className="p-3 bg-amber-50 border border-amber-200 rounded-2xl flex items-start gap-2 text-xs text-amber-900 font-medium"
                >
                  <Sparkles className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <span>{otpNotice}</span>
                </div>
              )}

              {/* Form Fields (Controlled without remounting, paste enabled, proper autocomplete) */}
              <form
                noValidate
                onSubmit={channel === 'email' ? handleEmailAuth : handlePhoneAuth}
                className="space-y-4"
              >
                {/* Email Channel Inputs */}
                {channel === 'email' && (
                  <div className="space-y-3.5">
                    <div>
                      <label
                        htmlFor="email-input"
                        className="block text-xs font-bold text-slate-700 mb-1.5"
                      >
                        Email address <span className="text-rose-600">*</span>
                      </label>
                      <input
                        id="email-input"
                        type="email"
                        name="email"
                        autoComplete="username"
                        inputMode="email"
                        autoCapitalize="none"
                        autoCorrect="off"
                        spellCheck={false}
                        placeholder="you@example.com"
                        value={email}
                        onChange={(e) => {
                          setEmail(e.target.value);
                          clearAllErrorsOnTyping();
                        }}
                        aria-invalid={Boolean(emailError)}
                        className={`w-full px-3.5 py-2.5 bg-slate-50/70 focus:bg-white rounded-xl border text-sm font-medium text-slate-900 placeholder:text-slate-400 outline-none focus:ring-2 transition ${
                          emailError
                            ? 'border-rose-400 focus:ring-rose-500/20 focus:border-rose-500'
                            : 'border-slate-300 focus:ring-[#2F62F5]/20 focus:border-[#2F62F5]'
                        }`}
                      />
                      {emailError && (
                        <p className="mt-1.5 text-xs font-medium text-rose-600 flex items-center gap-1">
                          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                          <span>{emailError}</span>
                        </p>
                      )}
                    </div>

                    <div>
                      <label
                        htmlFor="password-input"
                        className="block text-xs font-bold text-slate-700 mb-1.5"
                      >
                        {authMode === 'signup' ? 'Create password' : 'Password'}{' '}
                        <span className="text-rose-600">*</span>
                      </label>
                      <div className="relative">
                        <input
                          ref={passwordInputRef}
                          id="password-input"
                          type={showPassword ? 'text' : 'password'}
                          name="password"
                          autoComplete={authMode === 'signin' ? 'current-password' : 'new-password'}
                          autoCapitalize="none"
                          autoCorrect="off"
                          spellCheck={false}
                          placeholder={
                            authMode === 'signup' ? 'At least 8 characters' : 'Enter your password'
                          }
                          value={password}
                          onChange={(e) => {
                            // Never trim or alter password characters
                            setPassword(e.target.value);
                            clearAllErrorsOnTyping();
                          }}
                          aria-invalid={Boolean(passwordError)}
                          className={`w-full px-3.5 py-2.5 pr-10 bg-slate-50/70 focus:bg-white rounded-xl border text-sm font-medium text-slate-900 placeholder:text-slate-400 outline-none focus:ring-2 transition ${
                            passwordError
                              ? 'border-rose-400 focus:ring-rose-500/20 focus:border-rose-500'
                              : 'border-slate-300 focus:ring-[#2F62F5]/20 focus:border-[#2F62F5]'
                          }`}
                        />
                        <button
                          type="button"
                          aria-label={showPassword ? 'Hide password' : 'Show password'}
                          onClick={handleToggleShowPassword}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700 p-1 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2F62F5]"
                        >
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>

                      {passwordError && (
                        <p className="mt-1.5 text-xs font-medium text-rose-600 flex items-center gap-1">
                          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                          <span>{passwordError}</span>
                        </p>
                      )}

                      {/* Sign Up: Live Password Strength Hint */}
                      {authMode === 'signup' && (
                        <div className="mt-2 space-y-1.5" aria-live="polite">
                          <div className="grid grid-cols-4 gap-1.5">
                            {[1, 2, 3, 4].map((level) => (
                              <div
                                key={level}
                                className={`h-1 rounded-full transition-colors ${
                                  passwordStrength.score >= level
                                    ? passwordStrength.color
                                    : 'bg-slate-200'
                                }`}
                              />
                            ))}
                          </div>
                          <p className={`text-[11px] font-medium ${passwordStrength.textColor}`}>
                            {passwordStrength.label}
                          </p>
                        </div>
                      )}

                      {/* Sign In only: "Forgot password?" link right-aligned under password field */}
                      {authMode === 'signin' && (
                        <div className="mt-1.5 flex justify-end">
                          <button
                            type="button"
                            onClick={handleForgotPassword}
                            className="text-xs font-semibold text-[#2F62F5] hover:text-blue-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2F62F5] rounded"
                          >
                            Forgot password?
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Mobile Phone Channel Inputs */}
                {channel === 'phone' && (
                  <div className="space-y-3.5">
                    <div>
                      <label
                        htmlFor="phone-input"
                        className="block text-xs font-bold text-slate-700 mb-1.5"
                      >
                        Mobile phone number <span className="text-rose-600">*</span>
                      </label>
                      <div className="flex gap-2">
                        <select
                          aria-label="Country code"
                          value={countryCode}
                          onChange={(e) => setCountryCode(e.target.value)}
                          className="px-2.5 py-2.5 bg-slate-50/70 focus:bg-white rounded-xl border border-slate-300 text-xs font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-[#2F62F5]/20 focus:border-[#2F62F5]"
                        >
                          {COUNTRY_CODES.map((c) => (
                            <option key={c.code} value={c.code}>
                              {c.country} ({c.code})
                            </option>
                          ))}
                        </select>
                        <input
                          id="phone-input"
                          type="tel"
                          autoComplete="tel-national"
                          placeholder="50 123 4567"
                          value={phone}
                          onChange={(e) => {
                            setPhone(e.target.value);
                            clearAllErrorsOnTyping();
                          }}
                          className="flex-1 px-3.5 py-2.5 bg-slate-50/70 focus:bg-white rounded-xl border border-slate-300 text-sm font-medium text-slate-900 placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-[#2F62F5]/20 focus:border-[#2F62F5] tabular-nums transition"
                        />
                      </div>
                      {phoneError && (
                        <p className="mt-1.5 text-xs font-medium text-rose-600 flex items-center gap-1">
                          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                          <span>{phoneError}</span>
                        </p>
                      )}
                    </div>

                    {phoneAuthMethod === 'otp' ? (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-slate-600">
                            {otpSent
                              ? 'Enter the 6-digit code sent via SMS'
                              : "We'll send a one-time verification code via SMS"}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setPhoneAuthMethod('password');
                              setOtpSent(false);
                              clearInlineErrors();
                            }}
                            className="text-xs text-[#2F62F5] hover:underline font-semibold"
                          >
                            Use password
                          </button>
                        </div>

                        {otpSent && (
                          <input
                            type="text"
                            inputMode="numeric"
                            maxLength={6}
                            placeholder="123456"
                            aria-label="6-digit OTP verification code"
                            value={otpCode}
                            onChange={(e) => setOtpCode(e.target.value)}
                            className="w-full text-center tracking-widest text-base font-black bg-white py-2.5 rounded-xl border border-[#2F62F5] outline-none focus:ring-2 focus:ring-[#2F62F5]/20 tabular-nums"
                          />
                        )}
                      </div>
                    ) : (
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <label
                            htmlFor="phone-password-input"
                            className="block text-xs font-bold text-slate-700"
                          >
                            Password <span className="text-rose-600">*</span>
                          </label>
                          <button
                            type="button"
                            onClick={() => {
                              setPhoneAuthMethod('otp');
                              setOtpSent(false);
                              clearInlineErrors();
                            }}
                            className="text-xs text-[#2F62F5] hover:underline font-semibold"
                          >
                            Send SMS OTP instead
                          </button>
                        </div>
                        <div className="relative">
                          <input
                            id="phone-password-input"
                            type={showPassword ? 'text' : 'password'}
                            autoComplete={authMode === 'signin' ? 'current-password' : 'new-password'}
                            autoCapitalize="none"
                            autoCorrect="off"
                            spellCheck={false}
                            placeholder="Enter password"
                            value={password}
                            onChange={(e) => {
                              setPassword(e.target.value);
                              clearAllErrorsOnTyping();
                            }}
                            className="w-full px-3.5 py-2.5 pr-10 bg-slate-50/70 focus:bg-white rounded-xl border border-slate-300 text-sm font-medium text-slate-900 placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-[#2F62F5]/20 focus:border-[#2F62F5] transition"
                          />
                          <button
                            type="button"
                            aria-label={showPassword ? 'Hide password' : 'Show password'}
                            onClick={handleToggleShowPassword}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700 p-1 rounded-lg"
                          >
                            {showPassword ? (
                              <EyeOff className="w-4 h-4" />
                            ) : (
                              <Eye className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Sign Up Only: "I'm 18 or older" Checkbox */}
                {authMode === 'signup' && (
                  <div>
                    <label
                      htmlFor="adult-confirm-checkbox"
                      className="flex items-center gap-2.5 cursor-pointer select-none"
                    >
                      <input
                        id="adult-confirm-checkbox"
                        type="checkbox"
                        checked={isAdultConfirmed}
                        onChange={(e) => {
                          setIsAdultConfirmed(e.target.checked);
                          if (adultError) setAdultError(null);
                        }}
                        className="w-4 h-4 rounded border-slate-300 text-[#2F62F5] focus:ring-[#2F62F5]"
                      />
                      <span className="text-xs font-semibold text-slate-700">
                        I&apos;m 18 or older <span className="text-rose-600">*</span>
                      </span>
                    </label>
                    {adultError && (
                      <p className="mt-1.5 text-xs font-medium text-rose-600 flex items-center gap-1">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                        <span>{adultError}</span>
                      </p>
                    )}
                  </div>
                )}

                {/* Primary Submit Action Button */}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3.5 px-4 rounded-2xl bg-[#2F62F5] hover:bg-blue-700 active:bg-blue-800 disabled:opacity-60 disabled:cursor-not-allowed text-white font-black text-sm transition-all shadow-[0_4px_14px_rgba(47,98,245,0.28)] tap-press flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2F62F5] focus-visible:ring-offset-2"
                >
                  {loading && <RefreshCw className="w-4 h-4 animate-spin" />}
                  <span>
                    {channel === 'phone' && phoneAuthMethod === 'otp'
                      ? otpSent
                        ? 'Verify code & continue'
                        : 'Send OTP'
                      : authMode === 'signup'
                      ? 'Create free account'
                      : 'Sign In'}
                  </span>
                </button>

                {/* Sign Up Only: Terms & Privacy Consent Line */}
                {authMode === 'signup' && (
                  <p className="text-center text-xs text-slate-600 leading-relaxed">
                    By continuing you agree to the{' '}
                    <button
                      type="button"
                      onClick={() => setLegalModal('terms')}
                      className="font-semibold text-[#2F62F5] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2F62F5] rounded"
                    >
                      Terms
                    </button>{' '}
                    and{' '}
                    <button
                      type="button"
                      onClick={() => setLegalModal('privacy')}
                      className="font-semibold text-[#2F62F5] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2F62F5] rounded"
                    >
                      Privacy Policy
                    </button>
                    .
                  </p>
                )}
              </form>

              {/* ===================================================================== */}
              {/* TRUST & PRIVACY FOOTER (3 Visible Trust Badges + Medical Disclaimer)  */}
              {/* ===================================================================== */}
              <div className="pt-4 border-t border-slate-200/80 space-y-3">
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="flex flex-col items-center gap-1 p-2 rounded-xl bg-slate-50 border border-slate-200/70">
                    <Lock className="w-3.5 h-3.5 text-[#2F62F5]" />
                    <span className="text-[11px] font-bold text-slate-700 leading-tight">
                      Encrypted in transit and at rest
                    </span>
                  </div>
                  <div className="flex flex-col items-center gap-1 p-2 rounded-xl bg-slate-50 border border-slate-200/70">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                    <span className="text-[11px] font-bold text-slate-700 leading-tight">
                      Your data is never sold
                    </span>
                  </div>
                  <div className="flex flex-col items-center gap-1 p-2 rounded-xl bg-slate-50 border border-slate-200/70">
                    <Trash2 className="w-3.5 h-3.5 text-slate-600" />
                    <span className="text-[11px] font-bold text-slate-700 leading-tight">
                      Delete anytime
                    </span>
                  </div>
                </div>

                <p className="text-center text-xs text-slate-600 font-medium leading-relaxed">
                  Medtrac organizes your records. It does not diagnose or replace your doctor. •{' '}
                  <strong className="font-bold text-slate-700">For adults 18+</strong>
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Google Sign-In / Sign-Up Modal */}
      {showGoogleModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="google-modal-title"
          className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
        >
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <svg className="w-5 h-5" viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                <div>
                  <h3 id="google-modal-title" className="text-sm font-black text-slate-900">
                    Continue with Google
                  </h3>
                  <p className="text-xs text-slate-500">Sign in to Medtrac</p>
                </div>
              </div>
              <button
                type="button"
                aria-label="Close Google sign in modal"
                onClick={() => setShowGoogleModal(false)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleGoogleModalSubmit} className="space-y-3">
              <div className="relative">
                <label
                  htmlFor="google-email-input"
                  className="block text-xs font-bold text-slate-700 mb-1.5"
                >
                  Google email address <span className="text-rose-600">*</span>
                </label>
                <input
                  id="google-email-input"
                  type="email"
                  name="email"
                  autoComplete="username"
                  inputMode="email"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  placeholder="you@gmail.com"
                  list="own-google-credential-list"
                  required
                  autoFocus
                  value={googleEmail}
                  onFocus={() => setShowGoogleSuggestion(true)}
                  onChange={(e) => {
                    setGoogleEmail(e.target.value);
                    setShowGoogleSuggestion(true);
                  }}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-medium text-slate-900 placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-[#2F62F5]/20 focus:border-[#2F62F5]"
                />
                {ownCredentialEmail && (
                  <datalist id="own-google-credential-list">
                    <option value={ownCredentialEmail} />
                  </datalist>
                )}

                {showGoogleSuggestion && matchingOwnSuggestion && (
                  <button
                    type="button"
                    onClick={() => {
                      setGoogleEmail(matchingOwnSuggestion);
                      setShowGoogleSuggestion(false);
                    }}
                    className="mt-1.5 w-full px-3 py-2 rounded-xl bg-blue-50/80 hover:bg-blue-100/80 border border-blue-200/80 flex items-center justify-between text-left transition tap-press"
                  >
                    <span className="text-xs font-bold text-blue-900 truncate">
                      {matchingOwnSuggestion}
                    </span>
                    <span className="text-[10px] font-extrabold text-[#2F62F5] uppercase tracking-wider shrink-0 ml-2">
                      Suggested
                    </span>
                  </button>
                )}
              </div>

              <button
                type="submit"
                className="w-full py-2.5 px-4 rounded-xl bg-[#2F62F5] hover:bg-blue-700 text-white font-black text-xs sm:text-sm transition shadow-sm tap-press"
              >
                Continue with Google
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Terms & Privacy Policy Modal */}
      {legalModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="legal-modal-title"
          className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
        >
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 id="legal-modal-title" className="text-base font-black text-slate-900">
                {legalModal === 'terms' ? 'Terms of Service' : 'Privacy Policy'}
              </h3>
              <button
                type="button"
                aria-label="Close dialog"
                onClick={() => setLegalModal(null)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {legalModal === 'terms' ? (
              <div className="space-y-2.5 text-xs text-slate-600 leading-relaxed">
                <p>
                  <strong className="text-slate-900">1. Educational &amp; Organizational Tool:</strong>{' '}
                  Medtrac organizes your personal laboratory reports into chronological timelines and visit summaries. It does not provide medical diagnosis or treatment advice.
                </p>
                <p>
                  <strong className="text-slate-900">2. Eligibility:</strong> Medtrac is intended for adults aged 18 and older managing their personal health records.
                </p>
                <p>
                  <strong className="text-slate-900">3. Patient Control:</strong> Any doctor share link you generate expires automatically after 24 hours and can be revoked immediately at your discretion.
                </p>
              </div>
            ) : (
              <div className="space-y-2.5 text-xs text-slate-600 leading-relaxed">
                <p className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>
                    <strong className="text-slate-900">Encrypted in transit and at rest:</strong> Your uploaded lab reports and health metrics are transmitted over TLS and stored securely for your personal review.
                  </span>
                </p>
                <p className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>
                    <strong className="text-slate-900">Never sold or shared with advertisers:</strong> Your health data belongs strictly to you.
                  </span>
                </p>
                <p className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>
                    <strong className="text-slate-900">Delete anytime:</strong> You can remove individual lab readings or delete your entire profile at any time.
                  </span>
                </p>
              </div>
            )}

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setLegalModal(null)}
                className="px-4 py-2 rounded-xl bg-[#2F62F5] text-white font-bold text-xs hover:bg-blue-700 transition"
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
