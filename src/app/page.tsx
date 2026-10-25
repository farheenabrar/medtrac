'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  ShieldCheck,
  ArrowRight,
  Sparkles,
  CheckCircle2,
  Mail,
  Lock,
  Calendar,
  AlertCircle,
  HelpCircle,
  UserCheck,
  RefreshCw,
} from 'lucide-react';
import { UnitSystem, UserProfile } from '@/lib/types';
import { createClient } from '@/lib/supabase/client';
import { isSupabaseConfigured, getStoredProfile, saveStoredProfile } from '@/lib/data-service';

const COMMON_CONDITIONS = [
  'Prediabetes',
  'High Triglycerides',
  'Dyslipidemia / High Cholesterol',
  'Metabolic Syndrome',
  'Fatty Liver (NAFLD)',
  'None / General Metabolic Prevention',
];

export default function SetupPage() {
  const router = useRouter();

  // Form State
  const [fullName, setFullName] = useState('');
  const [dob, setDob] = useState('');
  const [preferredUnit, setPreferredUnit] = useState<UnitSystem>('mg_dl');
  const [selectedConditions, setSelectedConditions] = useState<string[]>([
    'Prediabetes',
    'High Triglycerides',
  ]);
  const [customCondition, setCustomCondition] = useState('');

  // Auth & UI State
  const [authMethod, setAuthMethod] = useState<'demo' | 'magic_link' | 'google'>('demo');
  const [email, setEmail] = useState('');
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [existingUser, setExistingUser] = useState<UserProfile | null>(null);

  // Check if existing user is already signed in or profile cached
  useEffect(() => {
    async function checkExisting() {
      const profile = await getStoredProfile();
      if (profile) {
        setExistingUser(profile);
        setFullName(profile.full_name || '');
        setDob(profile.date_of_birth || '');
        if (profile.preferred_unit) setPreferredUnit(profile.preferred_unit);
        if (profile.conditions && profile.conditions.length > 0) {
          setSelectedConditions(profile.conditions);
        }
      }
    }
    checkExisting();
  }, []);

  // Age validation helper (adult-only requirement)
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

  const toggleCondition = (condition: string) => {
    if (condition === 'None / General Metabolic Prevention') {
      if (selectedConditions.includes(condition)) {
        setSelectedConditions([]);
      } else {
        setSelectedConditions(['None / General Metabolic Prevention']);
      }
      return;
    }

    const withoutNone = selectedConditions.filter(
      (c) => c !== 'None / General Metabolic Prevention'
    );
    if (withoutNone.includes(condition)) {
      setSelectedConditions(withoutNone.filter((c) => c !== condition));
    } else {
      setSelectedConditions([...withoutNone, condition]);
    }
  };

  const handleAddCustomCondition = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && customCondition.trim()) {
      e.preventDefault();
      if (!selectedConditions.includes(customCondition.trim())) {
        setSelectedConditions([...selectedConditions, customCondition.trim()]);
      }
      setCustomCondition('');
    }
  };

  // Google OAuth Handler
  const handleGoogleSignIn = async () => {
    if (!isSupabaseConfigured()) {
      alert('Supabase is not configured yet. Using Instant Demo Mode to test all features.');
      return;
    }
    try {
      const supabase = createClient();
      await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/upload`,
        },
      });
    } catch (err: any) {
      setErrorMessage(err.message || 'Google OAuth failed');
    }
  };

  // Magic Link Handler
  const handleSendMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setLoading(true);
    setErrorMessage(null);

    if (!isSupabaseConfigured()) {
      // Simulate magic link for testing
      setTimeout(() => {
        setMagicLinkSent(true);
        setLoading(false);
      }, 800);
      return;
    }

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/upload`,
        },
      });

      if (error) throw error;
      setMagicLinkSent(true);
    } catch (err: any) {
      setErrorMessage(err.message || 'Could not send Magic Link');
    } finally {
      setLoading(false);
    }
  };

  // Main Continue Handler
  const handleContinue = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    // 1. Validate full name
    if (!fullName.trim()) {
      setErrorMessage('Please enter your full name.');
      return;
    }

    // 2. Validate adult-only requirement
    if (!dob) {
      setErrorMessage('Please provide your date of birth.');
      return;
    }

    const age = calculateAge(dob);
    if (age < 18) {
      setErrorMessage(
        `Medtrac is designed strictly for adults managing metabolic health. Age calculated: ${age} years. Must be at least 18.`
      );
      return;
    }

    setLoading(true);

    const profileData: UserProfile = {
      id: existingUser?.id || `user-${Date.now()}`,
      full_name: fullName.trim(),
      date_of_birth: dob,
      preferred_unit: preferredUnit,
      conditions: selectedConditions.length > 0 ? selectedConditions : ['General Metabolic Health'],
    };

    // Save profile to Supabase & localStorage
    await saveStoredProfile(profileData);

    router.push('/upload');
  };

  const loadDemoProfile = () => {
    setFullName('Sarah Jenkins');
    setDob('1982-04-12');
    setPreferredUnit('mg_dl');
    setSelectedConditions(['Prediabetes', 'High Triglycerides', 'Dyslipidemia / High Cholesterol']);
    setErrorMessage(null);
  };

  return (
    <div className="max-w-xl mx-auto py-3 sm:py-6 space-y-6">
      {/* Return User Banner */}
      {existingUser && (
        <div className="p-4 rounded-3xl bg-blue-50/80 border border-blue-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-[0_2px_12px_rgba(37,99,235,0.06)] tap-press">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center font-bold shadow-sm">
              <UserCheck className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-black text-blue-950">
                Welcome back, {existingUser.full_name}!
              </p>
              <p className="text-[11px] text-blue-700 font-medium">
                You have active metabolic records stored in Medtrac.
              </p>
            </div>
          </div>
          <button
            onClick={() => router.push('/dashboard')}
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-black transition-all shadow-[0_4px_12px_rgba(37,99,235,0.25)] tap-press"
          >
            <span>Go to Dashboard</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Main Setup Card with card-depth and soft shadows */}
      <div className="card-depth p-5 sm:p-8">
        {/* Header */}
        <div className="flex items-center justify-between pb-5 border-b border-slate-100 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center font-black text-sm shadow-[0_2px_8px_rgba(37,99,235,0.12)]">
              1
            </div>
            <div>
              <h1 className="text-lg font-black text-slate-900 tracking-tight">Sign Up &amp; Setup</h1>
              <p className="text-xs text-slate-500 font-medium">Step 1 of 5 • Profile &amp; Conditions</p>
            </div>
          </div>
          <button
            type="button"
            onClick={loadDemoProfile}
            className="text-xs font-black text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-3.5 py-1.5 rounded-xl transition-all tap-press border border-blue-200/50"
          >
            Demo Patient
          </button>
        </div>

        {/* Authentication Choice Tabs */}
        <div className="mb-6 space-y-3">
          <label className="block text-xs font-black text-slate-700 uppercase tracking-wider">
            Authentication Method
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setAuthMethod('demo')}
              className={`p-2.5 rounded-xl border text-xs font-bold transition-all tap-press text-center ${
                authMethod === 'demo'
                  ? 'border-blue-600 bg-blue-50 text-blue-900 ring-1 ring-blue-600 shadow-xs'
                  : 'border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              Instant Demo Access
            </button>
            <button
              type="button"
              onClick={() => setAuthMethod('magic_link')}
              className={`p-2.5 rounded-xl border text-xs font-bold transition-all tap-press text-center ${
                authMethod === 'magic_link'
                  ? 'border-blue-600 bg-blue-50 text-blue-900 ring-1 ring-blue-600 shadow-xs'
                  : 'border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              Email Magic Link
            </button>
          </div>

          {authMethod === 'magic_link' && (
            <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
              <div className="flex gap-2">
                <input
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="flex-1 px-3 py-2 text-xs rounded-xl border border-slate-300 outline-none focus:ring-1 focus:ring-blue-500"
                />
                <button
                  type="button"
                  onClick={handleSendMagicLink}
                  disabled={loading}
                  className="px-3 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 transition tap-press"
                >
                  {loading ? 'Sending...' : 'Send Link'}
                </button>
              </div>
              {magicLinkSent && (
                <p className="text-[11px] text-emerald-600 font-bold">
                  Magic link sent! Check your inbox to complete verification.
                </p>
              )}
            </div>
          )}
        </div>

        {/* Profile Form */}
        <form onSubmit={handleContinue} className="space-y-5">
          {/* Full Name */}
          <div>
            <label className="block text-xs font-black text-slate-700 uppercase tracking-wider mb-1.5">
              Full Name *
            </label>
            <input
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="e.g. Sarah Jenkins"
              className="w-full px-4 py-3 rounded-2xl border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm text-slate-900 font-medium transition"
            />
          </div>

          {/* Date of Birth & Adult Qualification */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-black text-slate-700 uppercase tracking-wider">
                Date of Birth (Adult 18+) *
              </label>
              {dob && (
                <span className="text-[11px] font-black px-2.5 py-0.5 rounded-full badge-optimal tabular-nums">
                  Age: {calculateAge(dob)} yrs (Adult Verified)
                </span>
              )}
            </div>
            <input
              type="date"
              required
              value={dob}
              onChange={(e) => setDob(e.target.value)}
              className="w-full px-4 py-3 rounded-2xl border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm text-slate-900 font-semibold tabular-nums transition"
            />
            <p className="text-[11px] text-slate-400 mt-1.5 flex items-center gap-1 font-medium">
              <ShieldCheck className="w-3.5 h-3.5 text-[#059669]" />
              Privacy protected. Full birth date is required for adult eligibility and clinical risk scoring.
            </p>
          </div>

          {/* Preferred Units */}
          <div>
            <label className="block text-xs font-black text-slate-700 uppercase tracking-wider mb-1.5">
              Preferred Display Unit
            </label>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setPreferredUnit('mg_dl')}
                className={`p-3.5 rounded-2xl border text-xs font-black transition-all tap-press text-left ${
                  preferredUnit === 'mg_dl'
                    ? 'border-blue-600 bg-blue-50/70 text-blue-900 ring-2 ring-blue-600 shadow-xs'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <div>mg/dL &amp; %</div>
                <div className="text-[10px] font-medium text-slate-500 mt-0.5">
                  Conventional (US / India)
                </div>
              </button>

              <button
                type="button"
                onClick={() => setPreferredUnit('mmol_l')}
                className={`p-3.5 rounded-2xl border text-xs font-black transition-all tap-press text-left ${
                  preferredUnit === 'mmol_l'
                    ? 'border-blue-600 bg-blue-50/70 text-blue-900 ring-2 ring-blue-600 shadow-xs'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <div>mmol/L &amp; mmol/mol</div>
                <div className="text-[10px] font-medium text-slate-500 mt-0.5">
                  SI System (UK / UAE / Europe)
                </div>
              </button>
            </div>
          </div>

          {/* Conditions Managing Checklist */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-black text-slate-700 uppercase tracking-wider">
                Conditions You Are Managing
              </label>
              <span className="text-[10px] text-slate-400 font-semibold">Select all that apply</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {COMMON_CONDITIONS.map((cond) => {
                const isSelected = selectedConditions.includes(cond);
                return (
                  <button
                    type="button"
                    key={cond}
                    onClick={() => toggleCondition(cond)}
                    className={`flex items-center justify-between p-3 rounded-2xl border text-xs font-semibold transition-all tap-press text-left ${
                      isSelected
                        ? 'border-blue-600 bg-blue-50/70 text-blue-900 font-black shadow-xs ring-1 ring-blue-600'
                        : 'border-slate-200 text-slate-700 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <span>{cond}</span>
                    {isSelected && <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />}
                  </button>
                );
              })}
            </div>

            {/* Custom Condition Entry */}
            <div className="mt-2.5">
              <input
                type="text"
                placeholder="+ Add custom condition (press Enter)"
                value={customCondition}
                onChange={(e) => setCustomCondition(e.target.value)}
                onKeyDown={handleAddCustomCondition}
                className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-dashed border-slate-300 focus:border-blue-500 outline-none text-slate-800 font-medium"
              />
            </div>
          </div>

          {/* Error Message */}
          {errorMessage && (
            <div className="p-3.5 rounded-2xl badge-urgent flex items-start gap-2.5 text-xs font-semibold">
              <AlertCircle className="w-4 h-4 text-[#e11d48] shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Submit Continue Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 py-3.5 px-6 rounded-2xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-black text-sm shadow-[0_4px_16px_rgba(37,99,235,0.3)] transition-all tap-press disabled:opacity-70 min-h-[48px]"
          >
            <span>{loading ? 'Saving Profile...' : 'Continue to Upload Reports'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
