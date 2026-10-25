'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  ShieldCheck,
  ArrowRight,
  Sparkles,
  Mail,
  Smartphone,
  Calendar,
  AlertCircle,
  UserCheck,
  CheckCircle2,
  RefreshCw,
  Plus,
  X,
  Activity,
  UploadCloud,
  Check,
  Eye,
  EyeOff,
  Lock,
} from 'lucide-react';
import { UserProfile } from '@/lib/types';
import { createClient } from '@/lib/supabase/client';
import { isSupabaseConfigured, getStoredProfile, saveStoredProfile } from '@/lib/data-service';
import {
  generateUUID,
  saveRegisteredAccount,
  findAccountByEmail,
  findAccountByPhone,
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

const PRESET_CONDITIONS = [
  'Prediabetes',
  'Hypertension',
  'Thyroid issues',
  'Diabetes',
  'Cholesterol',
  'Arthritis',
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

  // Status & Feedback
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [existingUser, setExistingUser] = useState<UserProfile | null>(null);

  // Conditions State (for signed in / signed up user)
  const [selectedConditions, setSelectedConditions] = useState<string[]>([]);
  const [showOtherInput, setShowOtherInput] = useState(false);
  const [otherText, setOtherText] = useState('');

  // AI Condition Insight State
  const [aiInsight, setAiInsight] = useState<string>('');
  const [aiLoading, setAiLoading] = useState(false);

  // Check existing session or cached profile on mount
  useEffect(() => {
    async function checkExisting() {
      const profile = await getStoredProfile();
      if (profile) {
        setExistingUser(profile);
        if (profile.first_name) setFirstName(profile.first_name);
        if (profile.last_name) setLastName(profile.last_name);
        if (!profile.first_name && profile.full_name) {
          const parts = profile.full_name.split(' ');
          setFirstName(parts[0] || '');
          setLastName(parts.slice(1).join(' ') || '');
        }
        if (profile.date_of_birth) setDob(profile.date_of_birth);
        if (profile.email) setEmail(profile.email);
        if (profile.phone) setPhone(profile.phone);

        // Load existing conditions
        const initialConditions = profile.conditions && profile.conditions.length > 0
          ? profile.conditions
          : ['Prediabetes', 'Cholesterol'];
        setSelectedConditions(initialConditions);
        fetchAiInsight(initialConditions, profile.first_name || profile.full_name?.split(' ')[0]);
      }
    }
    checkExisting();
  }, []);

  // Fetch AI Health Conditions Insight
  const fetchAiInsight = async (conditionsList: string[], name?: string) => {
    setAiLoading(true);
    try {
      const res = await fetch('/api/condition-insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conditions: conditionsList,
          firstName: name || firstName || existingUser?.first_name || 'Patient',
          age: calculatedAge || 43,
        }),
      });
      const data = await res.json();
      if (data.insight) {
        setAiInsight(data.insight);
      }
    } catch (err: any) {
      console.warn('AI insight fetch error:', err.message);
      // Fallback text
      setAiInsight('Metabolic conditions interact closely with lipid and glucose clearance. Tracking international laboratory trends over time helps your physician fine-tune your personalized care plan.');
    } finally {
      setAiLoading(false);
    }
  };

  // Calculate age for adult validation
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
  const userFirstName = existingUser?.first_name || (existingUser?.full_name ? existingUser.full_name.split(' ')[0] : '');

  // Toggle Condition in "I'm managing now"
  const handleToggleCondition = async (condition: string) => {
    let updated: string[];
    if (selectedConditions.includes(condition)) {
      updated = selectedConditions.filter((c) => c !== condition);
    } else {
      updated = [...selectedConditions, condition];
    }
    setSelectedConditions(updated);

    // Save immediately to profile
    if (existingUser) {
      const updatedProfile: UserProfile = {
        ...existingUser,
        conditions: updated,
      };
      setExistingUser(updatedProfile);
      await saveStoredProfile(updatedProfile);
    }

    // Refresh AI insight with new condition context
    fetchAiInsight(updated, userFirstName);
  };

  // Add custom "Other" condition
  const handleAddOtherCondition = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otherText.trim()) return;

    const trimmed = otherText.trim();
    if (!selectedConditions.includes(trimmed)) {
      const updated = [...selectedConditions, trimmed];
      setSelectedConditions(updated);

      if (existingUser) {
        const updatedProfile: UserProfile = {
          ...existingUser,
          conditions: updated,
        };
        setExistingUser(updatedProfile);
        await saveStoredProfile(updatedProfile);
      }

      fetchAiInsight(updated, userFirstName);
    }
    setOtherText('');
    setShowOtherInput(false);
  };

  // Remove custom other condition
  const handleRemoveCondition = async (condToRemove: string) => {
    const updated = selectedConditions.filter((c) => c !== condToRemove);
    setSelectedConditions(updated);

    if (existingUser) {
      const updatedProfile: UserProfile = {
        ...existingUser,
        conditions: updated,
      };
      setExistingUser(updatedProfile);
      await saveStoredProfile(updatedProfile);
    }

    fetchAiInsight(updated, userFirstName);
  };

  // Sign out / Switch Account
  const handleSignOut = async () => {
    if (isSupabaseConfigured()) {
      try {
        const supabase = createClient();
        await supabase.auth.signOut();
      } catch (e) {
        console.warn('Sign out notice:', e);
      }
    }
    localStorage.removeItem('medtrac_profile');
    setExistingUser(null);
    setFirstName('');
    setLastName('');
    setDob('');
    setEmail('');
    setPhone('');
    setPassword('');
    setOtpCode('');
    setOtpSent(false);
    setTestOtpNotice(null);
    setSelectedConditions([]);
    setAiInsight('');
    setErrorMessage(null);
    setSuccessMessage(null);
  };

  // 1. Google OAuth Sign In
  const handleGoogleSignIn = async () => {
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!isSupabaseConfigured()) {
      setErrorMessage('Google OAuth is not configured in this environment. Please sign up or sign in using Email or Mobile Phone.');
      return;
    }

    try {
      setLoading(true);
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/`,
        },
      });
      if (error) throw error;
    } catch (err: any) {
      setErrorMessage(err.message || 'Google Sign-In failed');
      setLoading(false);
    }
  };

  // 2. Email Sign Up & Sign In Handler
  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setErrorMessage('Please enter a valid email address.');
      return;
    }

    if (!password || password.length < 6) {
      setErrorMessage('Password must be at least 6 characters.');
      return;
    }

    setLoading(true);

    if (authMode === 'signup') {
      // Validate Sign Up fields
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
      if (calculatedAge < 18) {
        setErrorMessage(
          `Medtrac is strictly for adults managing metabolic health. Age calculated: ${calculatedAge}. Must be at least 18.`
        );
        setLoading(false);
        return;
      }

      let userId = generateUUID();

      // Attempt Supabase SignUp if configured
      if (isSupabaseConfigured()) {
        try {
          const supabase = createClient();
          const { data, error } = await supabase.auth.signUp({
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
          console.warn('Supabase signUp notice (proceeding with registered account):', supaErr.message);
        }
      }

      const initialConditions = selectedConditions.length > 0 ? selectedConditions : ['Prediabetes', 'Cholesterol'];
      const newProfile: UserProfile = {
        id: userId,
        full_name: `${firstName.trim()} ${lastName.trim()}`,
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        date_of_birth: dob,
        email: cleanEmail,
        phone: '',
        conditions: initialConditions,
        preferred_unit: 'mg_dl',
      };

      // Save registered credentials so user can log back in anytime with dummy or real creds
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

      await saveStoredProfile(newProfile);
      setExistingUser(newProfile);
      setSelectedConditions(initialConditions);
      setLoading(false);
      setSuccessMessage('Account created successfully! Welcome to Medtrac.');
      fetchAiInsight(initialConditions, firstName.trim());
    } else {
      // Sign In Mode
      let signedInProfile: UserProfile | null = null;

      // 1. Try Supabase Auth
      if (isSupabaseConfigured()) {
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
            }
          }
        } catch (supaErr: any) {
          console.warn('Supabase signIn notice, checking local accounts:', supaErr.message);
        }
      }

      // 2. Check locally registered credentials
      if (!signedInProfile) {
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
      }

      if (signedInProfile) {
        await saveStoredProfile(signedInProfile);
        setExistingUser(signedInProfile);
        if (signedInProfile.first_name) setFirstName(signedInProfile.first_name);
        if (signedInProfile.last_name) setLastName(signedInProfile.last_name);
        if (signedInProfile.date_of_birth) setDob(signedInProfile.date_of_birth);
        const conds = signedInProfile.conditions && signedInProfile.conditions.length > 0
          ? signedInProfile.conditions
          : ['Prediabetes', 'Cholesterol'];
        setSelectedConditions(conds);
        setLoading(false);
        setSuccessMessage(`Welcome back, ${signedInProfile.first_name || 'User'}!`);
        fetchAiInsight(conds, signedInProfile.first_name || signedInProfile.full_name?.split(' ')[0]);
      } else {
        setLoading(false);
        setErrorMessage(`No account found for "${cleanEmail}". Please switch to Sign Up to create your account.`);
      }
    }
  };

  // 3. Mobile Phone Auth Handler (Password / Security PIN or Simulated OTP)
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

      // Accept test simulation code 123456 or try Supabase OTP
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

      let profile = findAccountByPhone(fullPhoneNumber)?.profile;
      if (!profile) {
        const userId = generateUUID();
        profile = {
          id: userId,
          full_name: `${firstName.trim()} ${lastName.trim()}`.trim() || 'Mobile User',
          first_name: firstName.trim() || 'Mobile',
          last_name: lastName.trim() || 'User',
          date_of_birth: dob || '1990-01-01',
          phone: fullPhoneNumber,
          conditions: ['Prediabetes', 'Cholesterol'],
          preferred_unit: 'mg_dl',
        };
        saveRegisteredAccount({
          id: userId,
          firstName: profile.first_name || 'Mobile',
          lastName: profile.last_name || 'User',
          dob: profile.date_of_birth,
          phone: fullPhoneNumber,
          password: 'otp_verified',
          profile,
          createdAt: new Date().toISOString(),
        });
      }

      await saveStoredProfile(profile);
      setExistingUser(profile);
      setSelectedConditions(profile.conditions || ['Prediabetes', 'Cholesterol']);
      setLoading(false);
      setSuccessMessage(`Welcome, ${profile.first_name || 'User'}!`);
      fetchAiInsight(profile.conditions || ['Prediabetes', 'Cholesterol'], profile.first_name);
      return;
    }

    // B. Request SMS OTP step
    if (phoneAuthMethod === 'otp' && !otpSent) {
      setLoading(true);
      if (isSupabaseConfigured()) {
        try {
          const supabase = createClient();
          const { error } = await supabase.auth.signInWithOtp({
            phone: fullPhoneNumber,
          });
          if (error) {
            console.warn('Supabase SMS provider unconfigured (enabling test simulation code):', error.message);
            setTestOtpNotice(`SMS Gateway in test mode. Verification code is 123456.`);
            setOtpSent(true);
            setLoading(false);
            return;
          }
          setOtpSent(true);
          setSuccessMessage(`Verification code sent to ${fullPhoneNumber}.`);
          setLoading(false);
          return;
        } catch (err: any) {
          console.warn('Supabase SMS error:', err.message);
        }
      }
      // Simulated OTP for dummy test credentials
      setTestOtpNotice(`SMS Gateway in test mode. Verification code is 123456.`);
      setOtpSent(true);
      setLoading(false);
      return;
    }

    // C. Password / PIN Based Phone Auth
    if (!password || password.length < 4) {
      setErrorMessage('Please enter a password or PIN (at least 4 characters).');
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
      if (calculatedAge < 18) {
        setErrorMessage(
          `Medtrac is strictly for adults managing metabolic health. Age calculated: ${calculatedAge}. Must be at least 18.`
        );
        setLoading(false);
        return;
      }

      const userId = generateUUID();
      const initialConditions = selectedConditions.length > 0 ? selectedConditions : ['Prediabetes', 'Cholesterol'];
      const newProfile: UserProfile = {
        id: userId,
        full_name: `${firstName.trim()} ${lastName.trim()}`,
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        date_of_birth: dob,
        phone: fullPhoneNumber,
        conditions: initialConditions,
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

      await saveStoredProfile(newProfile);
      setExistingUser(newProfile);
      setSelectedConditions(initialConditions);
      setLoading(false);
      setSuccessMessage('Account created successfully! Welcome to Medtrac.');
      fetchAiInsight(initialConditions, firstName.trim());
    } else {
      // Phone Sign In mode
      const existingAccount = findAccountByPhone(fullPhoneNumber);
      if (existingAccount) {
        if (existingAccount.password === password) {
          await saveStoredProfile(existingAccount.profile);
          setExistingUser(existingAccount.profile);
          if (existingAccount.profile.first_name) setFirstName(existingAccount.profile.first_name);
          if (existingAccount.profile.last_name) setLastName(existingAccount.profile.last_name);
          if (existingAccount.profile.date_of_birth) setDob(existingAccount.profile.date_of_birth);
          const conds = existingAccount.profile.conditions || ['Prediabetes', 'Cholesterol'];
          setSelectedConditions(conds);
          setLoading(false);
          setSuccessMessage(`Welcome back, ${existingAccount.profile.first_name || 'User'}!`);
          fetchAiInsight(conds, existingAccount.profile.first_name);
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
    <div className="max-w-md mx-auto py-4 sm:py-8 space-y-5">
      {/* ========================================================================= */}
      {/* VIEW 1: SIGNED-IN / SIGNED-UP USER (AI Banner + I'm Managing Now Buttons) */}
      {/* ========================================================================= */}
      {existingUser ? (
        <div className="space-y-5 animate-in fade-in zoom-in-95 duration-200">
          {/* Top Header: Welcome Back, [First Name] */}
          <div className="card-depth p-6 sm:p-7 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                  Welcome Back, {userFirstName || 'User'}
                </h1>
                <p className="text-xs text-slate-500 font-medium mt-0.5">
                  Your metabolic profile and condition management
                </p>
              </div>

              {/* Switch Account */}
              <button
                type="button"
                onClick={handleSignOut}
                className="text-[11px] text-slate-400 hover:text-slate-600 font-bold underline px-2 py-1 tap-press"
                title="Sign out of current account"
              >
                Switch
              </button>
            </div>

            {/* AI Health Information Banner */}
            <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-blue-50/90 via-indigo-50/80 to-blue-50/90 border border-blue-200/80 shadow-2xs space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-blue-600 text-white flex items-center justify-center shadow-2xs">
                    <Sparkles className="w-3.5 h-3.5" />
                  </div>
                  <span className="text-xs font-black uppercase tracking-wider text-blue-950">
                    AI Health Insight
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => fetchAiInsight(selectedConditions, userFirstName)}
                  disabled={aiLoading}
                  className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-700 hover:text-blue-900 tap-press"
                  title="Generate fresh AI health guidance"
                >
                  <RefreshCw className={`w-3 h-3 ${aiLoading ? 'animate-spin' : ''}`} />
                  <span>Refresh AI</span>
                </button>
              </div>

              {aiLoading ? (
                <div className="py-2 flex items-center gap-2 text-xs text-blue-800 font-medium">
                  <div className="w-3.5 h-3.5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                  <span>Synthesizing clinical health overview for your profile...</span>
                </div>
              ) : (
                <p className="text-xs text-slate-800 leading-relaxed font-medium">
                  {aiInsight || 'Insulin sensitivity and lipid particle metabolism frequently interact. Maintaining regular physical movement, complex dietary fiber, and monitoring ApoB or triglycerides alongside HbA1c provides a complete metabolic overview.'}
                </p>
              )}

              <div className="pt-1 border-t border-blue-200/50 flex items-center justify-between text-[10px] text-blue-700/80 font-semibold">
                <span>Educational guidance tailored to your conditions</span>
                <span>Not medical advice</span>
              </div>
            </div>

            {/* "I'm managing now" Section with Condition Buttons */}
            <div className="space-y-3 pt-1">
              <div>
                <h2 className="text-sm font-black text-slate-900 tracking-tight">
                  I&apos;m managing now
                </h2>
                <p className="text-[11px] text-slate-500 font-medium">
                  Select your current health conditions to customize your timeline &amp; doctor briefs
                </p>
              </div>

              {/* Condition Buttons Grid */}
              <div className="grid grid-cols-2 gap-2.5">
                {PRESET_CONDITIONS.map((cond) => {
                  const isSelected = selectedConditions.includes(cond);
                  return (
                    <button
                      key={cond}
                      type="button"
                      onClick={() => handleToggleCondition(cond)}
                      className={`py-2.5 px-3 rounded-2xl text-xs font-bold transition-all tap-press flex items-center justify-between text-left shadow-2xs ${
                        isSelected
                          ? 'bg-blue-600 text-white ring-2 ring-blue-600/25 shadow-sm'
                          : 'bg-slate-50/90 border border-slate-200/90 text-slate-700 hover:bg-slate-100 hover:border-slate-300'
                      }`}
                    >
                      <span>{cond}</span>
                      {isSelected ? (
                        <Check className="w-3.5 h-3.5 text-white shrink-0 ml-1" />
                      ) : (
                        <span className="w-3.5 h-3.5 rounded-full border border-slate-300 shrink-0 ml-1" />
                      )}
                    </button>
                  );
                })}

                {/* "+ Other" Button */}
                <button
                  type="button"
                  onClick={() => setShowOtherInput(!showOtherInput)}
                  className={`py-2.5 px-3 rounded-2xl text-xs font-bold transition-all tap-press flex items-center justify-between text-left shadow-2xs ${
                    showOtherInput
                      ? 'bg-indigo-600 text-white ring-2 ring-indigo-600/25'
                      : 'bg-slate-50/90 border border-slate-200/90 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <span>+ Other</span>
                  <Plus className="w-3.5 h-3.5 shrink-0 ml-1" />
                </button>
              </div>

              {/* Inline Custom "Other" Input */}
              {showOtherInput && (
                <form
                  onSubmit={handleAddOtherCondition}
                  className="p-3 bg-slate-50 rounded-2xl border border-slate-200 flex gap-2 animate-in fade-in zoom-in-95 duration-150"
                >
                  <input
                    type="text"
                    autoFocus
                    placeholder="e.g. NAFLD, Gout, PCOS, Celiac..."
                    value={otherText}
                    onChange={(e) => setOtherText(e.target.value)}
                    className="flex-1 px-3 py-1.5 bg-white rounded-xl border border-slate-300 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                  <button
                    type="submit"
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl tap-press shadow-2xs"
                  >
                    Add
                  </button>
                </form>
              )}

              {/* Custom Non-Preset Conditions List (with delete tags) */}
              {selectedConditions.filter((c) => !PRESET_CONDITIONS.includes(c)).length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {selectedConditions
                    .filter((c) => !PRESET_CONDITIONS.includes(c))
                    .map((customCond) => (
                      <span
                        key={customCond}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-blue-100 text-blue-900 text-[11px] font-bold"
                      >
                        <span>{customCond}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveCondition(customCond)}
                          className="hover:text-rose-600"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                </div>
              )}
            </div>

            {/* Navigation / Next Steps */}
            <div className="pt-2 space-y-2">
              <button
                type="button"
                onClick={() => router.push('/upload')}
                className="w-full py-3 px-4 rounded-2xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-black text-xs transition-all shadow-md tap-press flex items-center justify-center gap-2"
              >
                <UploadCloud className="w-4 h-4" />
                <span>Continue to Upload Reports</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>

              <button
                type="button"
                onClick={() => router.push('/dashboard')}
                className="w-full py-2.5 px-4 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-all tap-press flex items-center justify-center gap-2"
              >
                <Activity className="w-3.5 h-3.5 text-blue-600" />
                <span>Go to Metabolic Dashboard</span>
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* ========================================================================= */
        /* VIEW 2: NEW VISITOR (Clean Sign Up / Sign In Form with "Welcome")          */
        /* ========================================================================= */
        <div className="card-depth p-6 sm:p-8 space-y-6">
          {/* Top Header: Welcome */}
          <div className="text-center space-y-1 pb-1">
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              Welcome
            </h1>
            <p className="text-xs text-slate-500 font-medium">
              Cross-border metabolic records and doctor briefs
            </p>
          </div>

          {/* Auth Mode Toggle (Sign Up vs Sign In) */}
          <div className="inline-flex w-full rounded-2xl bg-slate-100 p-1 border border-slate-200/80 shadow-2xs">
            <button
              type="button"
              onClick={() => {
                setAuthMode('signup');
                setErrorMessage(null);
                setSuccessMessage(null);
              }}
              className={`flex-1 py-2 text-xs font-black rounded-xl transition-all tap-press ${
                authMode === 'signup'
                  ? 'bg-white text-blue-700 shadow-2xs ring-1 ring-slate-900/5'
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
              className={`flex-1 py-2 text-xs font-black rounded-xl transition-all tap-press ${
                authMode === 'signin'
                  ? 'bg-white text-blue-700 shadow-2xs ring-1 ring-slate-900/5'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Sign In
            </button>
          </div>

          {/* Google Sign In Button */}
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2.5 py-2.5 px-4 rounded-2xl bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-bold transition-all tap-press shadow-2xs"
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
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                setChannel('email');
                setErrorMessage(null);
                setSuccessMessage(null);
              }}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl border text-xs font-bold transition-all tap-press ${
                channel === 'email'
                  ? 'border-blue-600 bg-blue-50/70 text-blue-700 shadow-2xs ring-1 ring-blue-600/10'
                  : 'border-slate-200 bg-slate-50/50 text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Mail className="w-3.5 h-3.5" />
              <span>Email</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setChannel('phone');
                setErrorMessage(null);
                setSuccessMessage(null);
              }}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl border text-xs font-bold transition-all tap-press ${
                channel === 'phone'
                  ? 'border-blue-600 bg-blue-50/70 text-blue-700 shadow-2xs ring-1 ring-blue-600/10'
                  : 'border-slate-200 bg-slate-50/50 text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Smartphone className="w-3.5 h-3.5" />
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
              <div className="space-y-3.5 pt-1 animate-in fade-in duration-150">
                {/* First Name & Last Name Grid */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-black text-slate-700 uppercase mb-1">
                      First Name <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Sarah"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50/80 rounded-xl border border-slate-200/90 text-xs font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-black text-slate-700 uppercase mb-1">
                      Last Name <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Jenkins"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50/80 rounded-xl border border-slate-200/90 text-xs font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition"
                    />
                  </div>
                </div>

                {/* Date of Birth Field */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-[11px] font-black text-slate-700 uppercase">
                      Date of Birth (Adult 18+) <span className="text-rose-500">*</span>
                    </label>
                    {dob && (
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full tabular-nums ${
                          isAdult
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {isAdult
                          ? `Age: ${calculatedAge} • Adult Verified`
                          : `Age: ${calculatedAge} • Adult Required`}
                      </span>
                    )}
                  </div>
                  <div className="relative">
                    <input
                      type="date"
                      required
                      value={dob}
                      onChange={(e) => setDob(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50/80 rounded-xl border border-slate-200/90 text-xs font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 tabular-nums transition"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Email Channel Inputs */}
            {channel === 'email' && (
              <div className="space-y-3">
                <div>
                  <label className="block text-[11px] font-black text-slate-700 uppercase mb-1">
                    Email Address <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="email"
                      required
                      placeholder="name@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50/80 rounded-xl border border-slate-200/90 text-xs font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-black text-slate-700 uppercase mb-1">
                    {authMode === 'signup' ? 'Create Password' : 'Password'}{' '}
                    <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      minLength={6}
                      placeholder={authMode === 'signup' ? 'Min. 6 characters' : 'Enter your password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full px-3 py-2 pr-9 bg-slate-50/80 rounded-xl border border-slate-200/90 text-xs font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Mobile Phone Channel Inputs */}
            {channel === 'phone' && (
              <div className="space-y-3">
                <div>
                  <label className="block text-[11px] font-black text-slate-700 uppercase mb-1">
                    Mobile Phone Number <span className="text-rose-500">*</span>
                  </label>
                  <div className="flex gap-2">
                    <select
                      value={countryCode}
                      onChange={(e) => setCountryCode(e.target.value)}
                      className="px-2.5 py-2 bg-slate-50/80 rounded-xl border border-slate-200/90 text-xs font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
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
                      placeholder="50 123 4567"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="flex-1 px-3 py-2 bg-slate-50/80 rounded-xl border border-slate-200/90 text-xs font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 tabular-nums transition"
                    />
                  </div>
                </div>

                {phoneAuthMethod === 'password' ? (
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-[11px] font-black text-slate-700 uppercase">
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
                        minLength={4}
                        placeholder={authMode === 'signup' ? 'Min. 4 characters or digits' : 'Enter your password or PIN'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full px-3 py-2 pr-9 bg-slate-50/80 rounded-xl border border-slate-200/90 text-xs font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      >
                        {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                ) : (
                  /* OTP Channel Option */
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
                          placeholder="123456"
                          value={otpCode}
                          onChange={(e) => setOtpCode(e.target.value)}
                          className="w-full text-center tracking-widest text-lg font-black bg-white py-2 rounded-xl border border-blue-300 outline-none focus:ring-2 focus:ring-blue-500/20 tabular-nums"
                        />
                        <div className="flex justify-between items-center text-[11px] text-slate-500 pt-1">
                          <span>Didn&apos;t get code?</span>
                          <button
                            type="button"
                            onClick={handlePhoneAuth}
                            className="font-bold text-blue-600 hover:underline"
                          >
                            Resend SMS
                          </button>
                        </div>
                      </div>
                    ) : (
                      <p className="text-[11px] text-slate-500 font-medium">
                        Click below to receive a 6-digit verification code. (Test mode code is <span className="font-bold text-slate-800">123456</span>).
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
              className="w-full py-3 px-4 rounded-2xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-black text-xs transition-all shadow-md tap-press flex items-center justify-center gap-2"
            >
              {loading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
              <span>
                {channel === 'phone' && phoneAuthMethod === 'otp'
                  ? otpSent
                    ? 'Verify & Continue'
                    : 'Send Mobile OTP Code'
                  : authMode === 'signup'
                  ? 'Create Account & Continue'
                  : channel === 'email'
                  ? 'Sign In with Email'
                  : 'Sign In with Mobile'}
              </span>
              {!loading && <ArrowRight className="w-3.5 h-3.5" />}
            </button>
          </form>

          {/* Security & Medical Privacy Footnote */}
          <div className="pt-2 text-center text-slate-400 text-[11px] flex items-center justify-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-slate-400" />
            <span>Encrypted healthcare records • Adult 18+ metabolic review</span>
          </div>
        </div>
      )}
    </div>
  );
}
