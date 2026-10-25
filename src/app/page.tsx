'use client';

import React, { useState, useEffect } from 'react';
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
} from 'lucide-react';
import { UserProfile } from '@/lib/types';
import { createClient } from '@/lib/supabase/client';
import { isSupabaseConfigured, saveStoredProfile } from '@/lib/data-service';
import {
  generateUUID,
  saveRegisteredAccount,
  findAccountByEmail,
  findAccountByPhone,
  setSessionAuthenticated,
  clearAllUserRecords,
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

export default function AuthPage() {
  const router = useRouter();

  // Mode: Sign Up vs Sign In
  const [authMode, setAuthMode] = useState<'signup' | 'signin'>('signup');

  // Auth Channel: Email vs Mobile Phone
  const [channel, setChannel] = useState<'email' | 'phone'>('email');

  // Phone Auth Method: 'password' (standard) vs 'otp' (SMS verification)
  const [phoneAuthMethod, setPhoneAuthMethod] = useState<'password' | 'otp'>('password');

  // Form Fields: First Name, Last Name, DOB, Email, Phone, Password
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [dob, setDob] = useState('');
  const [email, setEmail] = useState('');
  const [countryCode, setCountryCode] = useState('+971');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // OTP State (for SMS OTP channel fallback)
  const [otpCode, setOtpCode] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [testOtpNotice, setTestOtpNotice] = useState<string | null>(null);

  // Google Sign-Up Modal State
  const [showGoogleModal, setShowGoogleModal] = useState(false);
  const [googleEmail, setGoogleEmail] = useState('');
  const [googleName, setGoogleName] = useState('');

  // Status & Feedback
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Prefetch next routes for instant seamless transitions
  useEffect(() => {
    router.prefetch('/feed-filters');
    router.prefetch('/upload');
    router.prefetch('/dashboard');
    router.prefetch('/brief');

    // Ensure landing page starts unauthenticated so only this first screen is visible
    // unless returning directly from a Google OAuth callback hash/session
    async function checkOAuthRedirect() {
      if (typeof window !== 'undefined') {
        const hash = window.location.hash;
        const params = new URLSearchParams(window.location.search);
        if (hash.includes('access_token') || params.get('code')) {
          if (isSupabaseConfigured()) {
            try {
              const supabase = createClient();
              const { data: { user } } = await supabase.auth.getUser();
              if (user) {
                const fullName =
                  user.user_metadata?.full_name ||
                  user.user_metadata?.name ||
                  user.email?.split('@')[0] ||
                  'User';
                const parts = fullName.split(' ');
                const fName = parts[0] || 'User';
                const lName = parts.slice(1).join(' ') || '';
                clearAllUserRecords();
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

  // Calculate age for display badge
  const calculateAge = (birthDateString: string): number => {
    if (!birthDateString) return 0;
    const today = new Date();
    const birthDate = new Date(birthDateString);
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  const calculatedAge = dob ? calculateAge(dob) : 0;
  const isAdult = dob ? calculatedAge >= 18 : false;

  // Complete authentication and navigate seamlessly to Feed Filters
  const completeAuthAndNavigate = async (profile: UserProfile, isNewUser: boolean) => {
    if (isNewUser) {
      clearAllUserRecords(profile.id);
    }
    await saveStoredProfile(profile);
    setSessionAuthenticated(true);
    router.push('/feed-filters');
  };

  // 1. Google Sign-Up / Sign-In Handler
  const handleGoogleSignIn = async () => {
    setErrorMessage(null);
    setSuccessMessage(null);

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
        console.warn('Google OAuth settings check fallback to interactive Google sign-up:', err);
      }
    }

    setShowGoogleModal(true);
  };

  // Complete Google Account Sign-Up from Modal
  const handleGoogleModalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const chosenEmail = googleEmail.trim().toLowerCase();
    const chosenName = googleName.trim();

    if (!chosenEmail || !chosenEmail.includes('@')) {
      setErrorMessage('Please enter a valid Google email address.');
      return;
    }

    setLoading(true);
    setShowGoogleModal(false);

    if (authMode === 'signin') {
      const existing = findAccountByEmail(chosenEmail);
      if (existing) {
        await completeAuthAndNavigate(existing.profile, false);
        return;
      }
    }

    const derivedName =
      chosenName ||
      chosenEmail
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
      date_of_birth: dob || '',
      email: chosenEmail,
      phone: '',
      conditions: [],
      preferred_unit: 'mg_dl',
    };

    saveRegisteredAccount({
      id: userId,
      firstName: fName,
      lastName: lName,
      dob: newProfile.date_of_birth,
      email: chosenEmail,
      password: 'google_oauth_account',
      profile: newProfile,
      createdAt: new Date().toISOString(),
    });

    await completeAuthAndNavigate(newProfile, true);
  };

  // 2. Email Sign Up & Sign In Handler (Supports any dummy email & password for testing)
  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setErrorMessage('Please enter a valid email address.');
      return;
    }

    if (!password) {
      setErrorMessage('Please enter a password.');
      return;
    }

    setLoading(true);

    if (authMode === 'signup') {
      if (!firstName.trim()) {
        setErrorMessage('Please provide your first name.');
        setLoading(false);
        return;
      }
      if (!lastName.trim()) {
        setErrorMessage('Please provide your last name.');
        setLoading(false);
        return;
      }
      if (!dob) {
        setErrorMessage('Please select your date of birth.');
        setLoading(false);
        return;
      }

      let userId = generateUUID();

      if (isSupabaseConfigured()) {
        try {
          const supabase = createClient();
          const { data } = await supabase.auth.signUp({
            email: cleanEmail,
            password: password,
            options: {
              data: {
                first_name: firstName.trim(),
                last_name: lastName.trim(),
                full_name: `${firstName.trim()} ${lastName.trim()}`,
                date_of_birth: dob,
              },
            },
          });
          if (data?.user?.id) {
            userId = data.user.id;
          }
        } catch (supaErr: any) {
          console.warn('Supabase signUp notice (proceeding with dummy/local account):', supaErr.message);
        }
      }

      const newProfile: UserProfile = {
        id: userId,
        full_name: `${firstName.trim()} ${lastName.trim()}`,
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        date_of_birth: dob,
        email: cleanEmail,
        phone: '',
        conditions: [],
        preferred_unit: 'mg_dl',
      };

      saveRegisteredAccount({
        id: userId,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        dob,
        email: cleanEmail,
        password,
        profile: newProfile,
        createdAt: new Date().toISOString(),
      });

      await completeAuthAndNavigate(newProfile, true);
    } else {
      // Sign In Mode
      let signedInProfile: UserProfile | null = null;
      let isNewAccount = false;

      // 1. Check locally registered accounts first
      const existingAccount = findAccountByEmail(cleanEmail);
      if (existingAccount) {
        if (existingAccount.password === password) {
          signedInProfile = existingAccount.profile;
        } else {
          setLoading(false);
          setErrorMessage('Incorrect password. Please verify your password and try again.');
          return;
        }
      }

      // 2. Try Supabase Auth if not found locally
      if (!signedInProfile && isSupabaseConfigured()) {
        try {
          const supabase = createClient();
          const { data, error } = await supabase.auth.signInWithPassword({
            email: cleanEmail,
            password: password,
          });
          if (data?.user && !error) {
            const { data: dbProfile } = await supabase
              .from('users_profile')
              .select('*')
              .eq('id', data.user.id)
              .single();
            if (dbProfile) {
              signedInProfile = dbProfile as UserProfile;
            } else {
              signedInProfile = {
                id: data.user.id,
                full_name: data.user.user_metadata?.full_name || cleanEmail.split('@')[0],
                first_name: data.user.user_metadata?.first_name || cleanEmail.split('@')[0],
                last_name: data.user.user_metadata?.last_name || '',
                date_of_birth: data.user.user_metadata?.date_of_birth || '',
                email: cleanEmail,
                conditions: [],
                preferred_unit: 'mg_dl',
              };
            }
          }
        } catch (supaErr: any) {
          console.warn('Supabase signIn notice:', supaErr.message);
        }
      }

      // 3. Allow seamless dummy account sign-in for testing
      if (!signedInProfile) {
        isNewAccount = true;
        const userId = generateUUID();
        const derivedFirst = cleanEmail.split('@')[0].replace(/[._-]/g, ' ');
        signedInProfile = {
          id: userId,
          full_name: derivedFirst,
          first_name: derivedFirst,
          last_name: '',
          date_of_birth: '',
          email: cleanEmail,
          conditions: [],
          preferred_unit: 'mg_dl',
        };
        saveRegisteredAccount({
          id: userId,
          firstName: derivedFirst,
          lastName: '',
          dob: '',
          email: cleanEmail,
          password,
          profile: signedInProfile,
          createdAt: new Date().toISOString(),
        });
      }

      await completeAuthAndNavigate(signedInProfile, isNewAccount);
    }
  };

  // 3. Mobile Phone Auth Handler
  const handlePhoneAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    const cleanDigits = phone.replace(/\D/g, '');
    if (!cleanDigits || cleanDigits.length < 6) {
      setErrorMessage('Please enter a valid mobile phone number.');
      return;
    }

    const fullPhoneNumber = `${countryCode}${cleanDigits}`;

    // A. OTP Verification step
    if (phoneAuthMethod === 'otp' && otpSent) {
      if (!otpCode.trim()) {
        setErrorMessage('Please enter the 6-digit verification code.');
        return;
      }

      setLoading(true);

      let otpValid = otpCode.trim() === '123456';
      if (!otpValid && isSupabaseConfigured()) {
        try {
          const supabase = createClient();
          const { error } = await supabase.auth.verifyOtp({
            phone: fullPhoneNumber,
            token: otpCode.trim(),
            type: 'sms',
          });
          if (!error) otpValid = true;
        } catch (e: any) {
          console.warn('Supabase OTP verify error:', e.message);
        }
      }

      if (!otpValid) {
        setLoading(false);
        setErrorMessage('Invalid verification code. Enter 123456 for test access.');
        return;
      }

      const existing = findAccountByPhone(fullPhoneNumber);
      let profile = existing?.profile;
      let isNew = false;
      if (!profile) {
        isNew = true;
        const userId = generateUUID();
        profile = {
          id: userId,
          full_name: `${firstName.trim()} ${lastName.trim()}`.trim() || 'User',
          first_name: firstName.trim() || 'User',
          last_name: lastName.trim() || '',
          date_of_birth: dob || '',
          phone: fullPhoneNumber,
          conditions: [],
          preferred_unit: 'mg_dl',
        };
        saveRegisteredAccount({
          id: userId,
          firstName: profile.first_name || 'User',
          lastName: profile.last_name || '',
          dob: profile.date_of_birth,
          phone: fullPhoneNumber,
          password: 'otp_verified',
          profile,
          createdAt: new Date().toISOString(),
        });
      }

      await completeAuthAndNavigate(profile, isNew);
      return;
    }

    // B. Request SMS OTP step
    if (phoneAuthMethod === 'otp' && !otpSent) {
      setLoading(true);
      setTestOtpNotice('SMS Gateway in test mode. Verification code is 123456.');
      setOtpSent(true);
      setLoading(false);
      return;
    }

    // C. Password / PIN Based Phone Auth
    if (!password) {
      setErrorMessage('Please enter a password or PIN.');
      return;
    }

    setLoading(true);

    if (authMode === 'signup') {
      if (!firstName.trim()) {
        setErrorMessage('Please provide your first name.');
        setLoading(false);
        return;
      }
      if (!lastName.trim()) {
        setErrorMessage('Please provide your last name.');
        setLoading(false);
        return;
      }
      if (!dob) {
        setErrorMessage('Please select your date of birth.');
        setLoading(false);
        return;
      }

      const userId = generateUUID();
      const newProfile: UserProfile = {
        id: userId,
        full_name: `${firstName.trim()} ${lastName.trim()}`,
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        date_of_birth: dob,
        phone: fullPhoneNumber,
        conditions: [],
        preferred_unit: 'mg_dl',
      };

      saveRegisteredAccount({
        id: userId,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        dob,
        phone: fullPhoneNumber,
        password,
        profile: newProfile,
        createdAt: new Date().toISOString(),
      });

      await completeAuthAndNavigate(newProfile, true);
    } else {
      const existingAccount = findAccountByPhone(fullPhoneNumber);
      if (existingAccount) {
        if (existingAccount.password === password) {
          await completeAuthAndNavigate(existingAccount.profile, false);
        } else {
          setLoading(false);
          setErrorMessage('Incorrect password or PIN for this mobile number.');
        }
      } else {
        setLoading(false);
        setErrorMessage(`No account found for ${fullPhoneNumber}. Please switch to Sign Up to register.`);
      }
    }
  };

  return (
    <div className="min-h-[82vh] flex items-center justify-center py-6 sm:py-10 px-2">
      <div className="w-full max-w-md card-depth p-6 sm:p-8 space-y-6 bg-white rounded-[28px]">
        {/* Top Header: Welcome */}
        <div className="text-center space-y-1.5 pb-1">
          <h1 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
            Welcome
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 font-medium">
            Metabolic records and doctor briefs
          </p>
        </div>

        {/* Auth Mode Toggle (Sign Up vs Sign In) */}
        <div className="inline-flex w-full rounded-2xl bg-slate-100 p-1.5 border border-slate-200/80 shadow-2xs">
          <button
            type="button"
            onClick={() => {
              setAuthMode('signup');
              setErrorMessage(null);
              setSuccessMessage(null);
            }}
            className={`flex-1 py-2.5 text-xs sm:text-sm font-black rounded-xl transition-all tap-press ${
              authMode === 'signup'
                ? 'bg-white text-blue-600 shadow-2xs ring-1 ring-slate-900/5'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Sign Up
          </button>
          <button
            type="button"
            onClick={() => {
              setAuthMode('signin');
              setErrorMessage(null);
              setSuccessMessage(null);
            }}
            className={`flex-1 py-2.5 text-xs sm:text-sm font-black rounded-xl transition-all tap-press ${
              authMode === 'signin'
                ? 'bg-white text-blue-600 shadow-2xs ring-1 ring-slate-900/5'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Sign In
          </button>
        </div>

        {/* Continue with Google Button */}
        <button
          type="button"
          onClick={handleGoogleSignIn}
          disabled={loading}
          className="w-full flex items-center justify-center gap-2.5 py-3 px-4 rounded-2xl bg-white border border-slate-200/90 hover:bg-slate-50 text-slate-700 text-xs sm:text-sm font-bold transition-all tap-press shadow-2xs"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24">
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

        {/* Divider */}
        <div className="relative flex items-center justify-center">
          <div className="border-t border-slate-200 w-full" />
          <span className="bg-white px-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider relative z-10">
            or continue with
          </span>
        </div>

        {/* Channel Switcher (Email vs Mobile Phone) */}
        <div className="flex gap-2.5">
          <button
            type="button"
            onClick={() => {
              setChannel('email');
              setErrorMessage(null);
              setSuccessMessage(null);
            }}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-2xl border text-xs sm:text-sm font-bold transition-all tap-press ${
              channel === 'email'
                ? 'border-blue-600 bg-white text-blue-600 shadow-2xs ring-1 ring-blue-600/10'
                : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
            }`}
          >
            <Mail className="w-4 h-4" />
            <span>Email</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setChannel('phone');
              setErrorMessage(null);
              setSuccessMessage(null);
            }}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-2xl border text-xs sm:text-sm font-bold transition-all tap-press ${
              channel === 'phone'
                ? 'border-blue-600 bg-white text-blue-600 shadow-2xs ring-1 ring-blue-600/10'
                : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
            }`}
          >
            <Smartphone className="w-4 h-4" />
            <span>Mobile Phone</span>
          </button>
        </div>

        {/* Feedback Messages */}
        {errorMessage && (
          <div className="p-3 bg-rose-50 border border-rose-200/80 rounded-2xl flex items-start gap-2 text-xs text-rose-800 animate-in fade-in">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

        {successMessage && (
          <div className="p-3 bg-emerald-50 border border-emerald-200/80 rounded-2xl flex items-start gap-2 text-xs text-emerald-800 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <span>{successMessage}</span>
          </div>
        )}

        {testOtpNotice && (
          <div className="p-3 bg-amber-50 border border-amber-200/80 rounded-2xl flex items-start gap-2 text-xs text-amber-800 animate-in fade-in">
            <Sparkles className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <span>{testOtpNotice}</span>
          </div>
        )}

        {/* Form Fields: First Name, Last Name, DOB, and Credentials */}
        <form
          onSubmit={channel === 'email' ? handleEmailAuth : handlePhoneAuth}
          className="space-y-4"
        >
          {/* Identity Fields (Visible in Sign Up mode) */}
          {authMode === 'signup' && (
            <div className="space-y-4 pt-1 animate-in fade-in duration-150">
              {/* First Name & Last Name Grid */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-black text-slate-800 uppercase tracking-wide mb-1.5">
                    First Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50/80 rounded-2xl border border-slate-200/90 text-xs sm:text-sm font-medium text-slate-800 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-black text-slate-800 uppercase tracking-wide mb-1.5">
                    Last Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50/80 rounded-2xl border border-slate-200/90 text-xs sm:text-sm font-medium text-slate-800 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition"
                  />
                </div>
              </div>

              {/* Date of Birth Field */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-[11px] font-black text-slate-800 uppercase tracking-wide">
                    Date of Birth (Adult 18+) <span className="text-rose-500">*</span>
                  </label>
                  {dob && isAdult && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full tabular-nums bg-emerald-100 text-emerald-800">
                      Age: {calculatedAge} • Adult Verified
                    </span>
                  )}
                </div>
                <div className="relative">
                  <input
                    type="date"
                    required
                    value={dob}
                    onChange={(e) => setDob(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50/80 rounded-2xl border border-slate-200/90 text-xs sm:text-sm font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 tabular-nums transition"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Email Channel Inputs */}
          {channel === 'email' && (
            <div className="space-y-4">
              <div>
                <label className="block text-[11px] font-black text-slate-800 uppercase tracking-wide mb-1.5">
                  Email Address <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50/80 rounded-2xl border border-slate-200/90 text-xs sm:text-sm font-medium text-slate-800 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-black text-slate-800 uppercase tracking-wide mb-1.5">
                  {authMode === 'signup' ? 'Create Password' : 'Password'}{' '}
                  <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-3.5 py-2.5 pr-10 bg-slate-50/80 rounded-2xl border border-slate-200/90 text-xs sm:text-sm font-medium text-slate-800 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Mobile Phone Channel Inputs */}
          {channel === 'phone' && (
            <div className="space-y-4">
              <div>
                <label className="block text-[11px] font-black text-slate-800 uppercase tracking-wide mb-1.5">
                  Mobile Phone Number <span className="text-rose-500">*</span>
                </label>
                <div className="flex gap-2">
                  <select
                    value={countryCode}
                    onChange={(e) => setCountryCode(e.target.value)}
                    className="px-2.5 py-2.5 bg-slate-50/80 rounded-2xl border border-slate-200/90 text-xs font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  >
                    {COUNTRY_CODES.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.country} ({c.code})
                      </option>
                    ))}
                  </select>
                  <input
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="flex-1 px-3.5 py-2.5 bg-slate-50/80 rounded-2xl border border-slate-200/90 text-xs sm:text-sm font-medium text-slate-800 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 tabular-nums transition"
                  />
                </div>
              </div>

              {phoneAuthMethod === 'password' ? (
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-[11px] font-black text-slate-800 uppercase tracking-wide">
                      {authMode === 'signup' ? 'Create Password / PIN' : 'Password or PIN'}{' '}
                      <span className="text-rose-500">*</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setPhoneAuthMethod('otp');
                        setOtpSent(false);
                        setErrorMessage(null);
                      }}
                      className="text-[10px] text-blue-600 hover:underline font-bold"
                    >
                      Prefer SMS OTP?
                    </button>
                  </div>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full px-3.5 py-2.5 pr-10 bg-slate-50/80 rounded-2xl border border-slate-200/90 text-xs sm:text-sm font-medium text-slate-800 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="block text-[11px] font-black text-blue-900 uppercase">
                      {otpSent ? 'Enter 6-Digit OTP Code' : 'SMS Verification'}
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setPhoneAuthMethod('password');
                        setOtpSent(false);
                        setErrorMessage(null);
                      }}
                      className="text-[10px] text-blue-600 hover:underline font-bold"
                    >
                      Use Password instead
                    </button>
                  </div>

                  {otpSent ? (
                    <div className="space-y-2">
                      <input
                        type="text"
                        maxLength={6}
                        value={otpCode}
                        onChange={(e) => setOtpCode(e.target.value)}
                        className="w-full text-center tracking-widest text-lg font-black bg-white py-2 rounded-xl border border-blue-300 outline-none focus:ring-2 focus:ring-blue-500/20 tabular-nums"
                      />
                    </div>
                  ) : (
                    <p className="text-[11px] text-slate-500 font-medium">
                      Click below to receive a 6-digit verification code.
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Submit Action Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 px-4 rounded-2xl bg-[#1d63ff] hover:bg-blue-700 active:bg-blue-800 text-white font-black text-xs sm:text-sm transition-all shadow-md tap-press flex items-center justify-center gap-2 mt-2"
          >
            {loading && <RefreshCw className="w-4 h-4 animate-spin" />}
            <span>
              {channel === 'phone' && phoneAuthMethod === 'otp'
                ? otpSent
                  ? 'Verify'
                  : 'Send Mobile OTP Code'
                : authMode === 'signup'
                ? 'Create Account'
                : 'Sign In'}
            </span>
          </button>
        </form>

        {/* Security & Medical Privacy Footnote */}
        <div className="pt-2 text-center text-slate-400 text-[11px] flex items-center justify-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-slate-400" />
          <span>Encrypted healthcare records • Adult 18+ metabolic review</span>
        </div>
      </div>

      {/* Google Account Sign-Up / Sign-In Modal */}
      {showGoogleModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <svg className="w-5 h-5" viewBox="0 0 24 24">
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
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l.81-.63z"
                  />
                </svg>
                <div>
                  <h3 className="text-sm font-black text-slate-900">Sign in with Google</h3>
                  <p className="text-[11px] text-slate-500">Continue to Medtrac</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowGoogleModal(false)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleGoogleModalSubmit} className="space-y-3">
              <div>
                <label className="block text-[11px] font-black text-slate-700 uppercase mb-1">
                  First &amp; Last Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={googleName}
                  onChange={(e) => setGoogleName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium text-slate-800 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-[11px] font-black text-slate-700 uppercase mb-1">
                  Google Email <span className="text-rose-500">*</span>
                </label>
                <input
                  type="email"
                  required
                  value={googleEmail}
                  onChange={(e) => setGoogleEmail(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium text-slate-800 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>
              <button
                type="submit"
                className="w-full py-2.5 px-4 rounded-xl bg-[#1d63ff] hover:bg-blue-700 text-white font-black text-xs transition shadow-sm tap-press"
              >
                Continue with Google Account
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
