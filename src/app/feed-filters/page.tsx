'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Heart,
  Activity,
  Zap,
  ShieldAlert,
  Gauge,
  Sparkles,
  Check,
  Plus,
  X,
  ArrowRight,
} from 'lucide-react';
import { UserProfile } from '@/lib/types';
import { getStoredProfile, saveStoredProfile, isSupabaseConfigured } from '@/lib/data-service';
import {
  isSessionAuthenticated,
  setSessionAuthenticated,
  clearAllUserRecords,
  findAccountByEmail,
  saveRegisteredAccount,
  saveOwnCredentialEmail,
} from '@/lib/auth-storage';
import { createClient } from '@/lib/supabase/client';
import LiveHealthBanner from '@/components/LiveHealthBanner';

interface ClinicalProfileOption {
  name: string;
  icon: React.ComponentType<{ className?: string }>;
  iconColorClass: string;
}

const STANDARD_CLINICAL_PROFILES: ClinicalProfileOption[] = [
  {
    name: 'Triglycerides',
    icon: Heart,
    iconColorClass: 'text-rose-500',
  },
  {
    name: 'Insulin Resistance',
    icon: Activity,
    iconColorClass: 'text-amber-500',
  },
  {
    name: 'Prediabetes',
    icon: Zap,
    iconColorClass: 'text-blue-600',
  },
  {
    name: 'Kidney Stones',
    icon: ShieldAlert,
    iconColorClass: 'text-indigo-600',
  },
  {
    name: 'Hypertension',
    icon: Gauge,
    iconColorClass: 'text-blue-600',
  },
  {
    name: 'Cholesterol',
    icon: Sparkles,
    iconColorClass: 'text-blue-600',
  },
];

export default function FeedFiltersPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [selectedConditions, setSelectedConditions] = useState<string[]>([]);
  const [manualInput, setManualInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    router.prefetch('/upload');
    router.prefetch('/dashboard');
    router.prefetch('/brief');

    async function initFeedFilters() {
      // Check if returning from Google OAuth callback
      if (typeof window !== 'undefined') {
        const params = new URLSearchParams(window.location.search);
        if (params.get('oauth') === 'google' && isSupabaseConfigured()) {
          try {
            const supabase = createClient();
            const { data: { user } } = await supabase.auth.getUser();
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
              clearAllUserRecords();
              const googleProfile: UserProfile = {
                id: user.id,
                full_name: fullName,
                first_name: fName,
                last_name: lName,
                date_of_birth: user.user_metadata?.date_of_birth || '',
                email: user.email || '',
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
                profile: googleProfile,
                createdAt: new Date().toISOString(),
              });
              await saveStoredProfile(googleProfile);
              setSessionAuthenticated(true);
              setProfile(googleProfile);
              setSelectedConditions([]);
              setAuthorized(true);
              return;
            }
          } catch (e) {
            console.warn('OAuth session check error:', e);
          }
        }
      }

      if (!isSessionAuthenticated()) {
        router.replace('/');
        return;
      }

      const stored = await getStoredProfile();
      if (!stored) {
        router.replace('/');
        return;
      }

      setProfile(stored);
      setSelectedConditions(Array.isArray(stored.conditions) ? stored.conditions : []);
      setAuthorized(true);
    }

    initFeedFilters();
  }, [router]);

  const handleToggleCondition = async (conditionName: string) => {
    const updated = selectedConditions.includes(conditionName)
      ? selectedConditions.filter((c) => c !== conditionName)
      : [...selectedConditions, conditionName];

    setSelectedConditions(updated);

    if (profile) {
      const updatedProfile: UserProfile = {
        ...profile,
        conditions: updated,
      };
      setProfile(updatedProfile);
      await saveStoredProfile(updatedProfile);
    }
  };

  const handleAddManualCondition = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = manualInput.trim();
    if (!trimmed) return;

    if (!selectedConditions.includes(trimmed)) {
      const updated = [...selectedConditions, trimmed];
      setSelectedConditions(updated);

      if (profile) {
        const updatedProfile: UserProfile = {
          ...profile,
          conditions: updated,
        };
        setProfile(updatedProfile);
        await saveStoredProfile(updatedProfile);
      }
    }
    setManualInput('');
  };

  const handleRemoveCondition = async (conditionName: string) => {
    const updated = selectedConditions.filter((c) => c !== conditionName);
    setSelectedConditions(updated);

    if (profile) {
      const updatedProfile: UserProfile = {
        ...profile,
        conditions: updated,
      };
      setProfile(updatedProfile);
      await saveStoredProfile(updatedProfile);
    }
  };

  const handleSaveAndContinue = async () => {
    setSaving(true);
    if (profile) {
      const updatedProfile: UserProfile = {
        ...profile,
        conditions: selectedConditions,
      };
      await saveStoredProfile(updatedProfile);
    }
    router.push('/upload');
  };

  if (!authorized) {
    return null;
  }

  const userFirstName =
    profile?.first_name || (profile?.full_name ? profile.full_name.split(' ')[0] : 'User');
  const standardNames = STANDARD_CLINICAL_PROFILES.map((p) => p.name);
  const customConditions = selectedConditions.filter((c) => !standardNames.includes(c));

  return (
    <div className="max-w-4xl mx-auto py-4 sm:py-6 space-y-6 animate-in fade-in duration-150">
      {/* Live Health Intelligence Banner (displayed only on Health Feed screen) */}
      <LiveHealthBanner />

      {/* Page Title & Personalized Greeting */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            Hi {userFirstName}
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1 font-medium">
            Which medical conditions are you currently managing? Select below to personalize your records and doctor briefs.
          </p>
        </div>
      </div>

      {/* Main Clinical Profiles Card */}
      <div className="card-depth p-6 sm:p-8 bg-white rounded-[28px] space-y-6">
        <div className="space-y-4">
          <h2 className="text-xs sm:text-[13px] font-extrabold text-slate-500 uppercase tracking-wider">
            Standard Clinical Profiles (Click to Toggle)
          </h2>

          {/* 3x2 Grid of Standard Clinical Profiles */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {STANDARD_CLINICAL_PROFILES.map((item) => {
              const isSelected = selectedConditions.includes(item.name);
              const Icon = item.icon;
              return (
                <button
                  key={item.name}
                  type="button"
                  onClick={() => handleToggleCondition(item.name)}
                  className={`w-full rounded-[22px] px-5 py-4 flex items-center justify-between text-left transition-all tap-press ${
                    isSelected
                      ? 'border-[1.5px] border-[#3b82f6] bg-[#f4f8ff] shadow-[0_2px_10px_rgba(37,99,235,0.06)]'
                      : 'border border-slate-200/90 bg-white hover:border-slate-300 hover:bg-slate-50/40'
                  }`}
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div
                      className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 transition-colors ${
                        isSelected ? 'bg-[#e6effd]' : 'bg-[#eef4ff]'
                      }`}
                    >
                      <Icon className={`w-5 h-5 ${item.iconColorClass}`} />
                    </div>
                    <span className="font-extrabold text-slate-900 text-sm sm:text-base tracking-tight truncate">
                      {item.name}
                    </span>
                  </div>

                  {isSelected ? (
                    <span className="w-7 h-7 rounded-full bg-[#1d63ff] text-white flex items-center justify-center shrink-0 ml-2 shadow-2xs">
                      <Check className="w-4 h-4 stroke-[3]" />
                    </span>
                  ) : (
                    <span className="w-7 h-7 rounded-full border border-slate-300 bg-slate-50/60 shrink-0 ml-2" />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Manual Condition Addition Section */}
        <div className="rounded-[26px] bg-[#f8fafc] border border-slate-200/80 p-5 sm:p-6 space-y-3.5">
          <label className="block text-sm sm:text-[15px] font-bold text-slate-800">
            Add Any Other Chronic Condition or Diagnosis Manually:
          </label>

          <form
            onSubmit={handleAddManualCondition}
            className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3"
          >
            <input
              type="text"
              value={manualInput}
              onChange={(e) => setManualInput(e.target.value)}
              className="flex-1 px-4 py-3.5 rounded-2xl border border-slate-200/90 bg-white text-sm text-slate-800 font-medium outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition"
            />
            <button
              type="submit"
              className="px-6 py-3.5 rounded-2xl bg-[#1d63ff] hover:bg-blue-700 active:bg-blue-800 text-white font-bold text-sm flex items-center justify-center gap-2 transition shadow-sm tap-press shrink-0"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span>Add Condition</span>
            </button>
          </form>

          {/* Custom Added Conditions */}
          {customConditions.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-2">
              {customConditions.map((customCond) => (
                <span
                  key={customCond}
                  className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-[#e6effd] border border-[#3b82f6]/40 text-blue-950 text-xs font-extrabold"
                >
                  <span>{customCond}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveCondition(customCond)}
                    className="text-blue-700 hover:text-rose-600 transition"
                    title="Remove condition"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Save and Continue Footer Button */}
        <div className="pt-2 flex justify-end">
          <button
            type="button"
            onClick={handleSaveAndContinue}
            disabled={saving}
            className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-[#1d63ff] hover:bg-blue-700 active:bg-blue-800 text-white font-black text-sm sm:text-base transition-all shadow-md tap-press flex items-center justify-center gap-2.5"
          >
            <span>Save and Continue</span>
            <ArrowRight className="w-4 h-4 stroke-[2.5]" />
          </button>
        </div>
      </div>
    </div>
  );
}
