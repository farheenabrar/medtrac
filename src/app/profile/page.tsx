'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  Camera,
  User,
  Sparkles,
  Scale,
  Ruler,
  HeartPulse,
  Plus,
  X,
  Check,
  LogOut,
  Save,
  RefreshCw,
  CheckCircle2,
  Trash2,
} from 'lucide-react';
import { UserProfile } from '@/lib/types';
import { getStoredProfile, saveStoredProfile } from '@/lib/data-service';
import { isSessionAuthenticated, setSessionAuthenticated } from '@/lib/auth-storage';

const STANDARD_CONDITIONS = [
  'Triglycerides',
  'Insulin Resistance',
  'Prediabetes',
  'Kidney Stones',
  'Hypertension',
  'Cholesterol',
];

const GENDER_OPTIONS = ['Female', 'Male', 'Non-Binary', 'Prefer not to say'];

interface BmiAiResult {
  bmi: number;
  category: string;
  badgeColor: string;
  aiNote: string;
  markerPercent: number;
}

function computeAiBmiAnalysis(
  weightVal: string | number | undefined,
  weightUnit: 'kg' | 'lbs',
  heightVal: string | number | undefined,
  heightUnit: 'cm' | 'ft',
  gender: string,
  conditions: string[]
): BmiAiResult | null {
  const rawW = typeof weightVal === 'string' ? parseFloat(weightVal) : Number(weightVal);
  const rawH = typeof heightVal === 'string' ? parseFloat(heightVal) : Number(heightVal);

  if (!rawW || !rawH || isNaN(rawW) || isNaN(rawH) || rawW <= 0 || rawH <= 0) {
    return null;
  }

  const weightKg = weightUnit === 'lbs' ? rawW * 0.45359237 : rawW;
  const heightCm = heightUnit === 'ft' ? rawH * 30.48 : rawH;
  const heightM = heightCm / 100;

  if (heightM <= 0.3 || heightM > 3.0) {
    return null;
  }

  const bmiRaw = weightKg / (heightM * heightM);
  const bmi = Math.round(bmiRaw * 10) / 10;

  let category = 'Normal Weight';
  let badgeColor = 'bg-emerald-50 text-emerald-700 border-emerald-200';

  if (bmi < 18.5) {
    category = 'Underweight';
    badgeColor = 'bg-amber-50 text-amber-700 border-amber-200';
  } else if (bmi < 25) {
    category = 'Healthy / Optimal Weight';
    badgeColor = 'bg-emerald-50 text-emerald-700 border-emerald-200';
  } else if (bmi < 30) {
    category = 'Overweight';
    badgeColor = 'bg-amber-50 text-amber-700 border-amber-200';
  } else if (bmi < 35) {
    category = 'Obesity (Class I)';
    badgeColor = 'bg-rose-50 text-rose-700 border-rose-200';
  } else {
    category = 'Obesity (Class II+)';
    badgeColor = 'bg-rose-50 text-rose-700 border-rose-200';
  }

  // Clamp marker between 5% and 95% across BMI 14 to 40
  const markerPercent = Math.min(95, Math.max(5, ((bmi - 14) / (40 - 14)) * 100));

  const condContext =
    conditions.length > 0
      ? `Given your tracked conditions (${conditions.join(', ')}), maintaining a metabolically supportive BMI helps optimize insulin sensitivity, lipid balance, and cardiovascular resilience.`
      : `Maintaining a balanced body composition supports long-term glycemic stability, lipid metabolism, and cardiovascular health.`;

  const genderContext =
    gender && gender !== 'Prefer not to say' ? ` (${gender} profile)` : '';

  let rangeGuidance = '';
  if (bmi < 18.5) {
    const targetMinKg = (18.5 * heightM * heightM).toFixed(1);
    rangeGuidance = `AI Calculation${genderContext}: Your BMI is ${bmi} kg/m² (${category}). A healthy target weight for your height (${heightCm.toFixed(0)} cm) starts around ${targetMinKg} kg.`;
  } else if (bmi < 25) {
    rangeGuidance = `AI Calculation${genderContext}: Your BMI is ${bmi} kg/m², which falls within the optimal clinical reference range (18.5–24.9 kg/m²).`;
  } else {
    const targetMaxKg = (24.9 * heightM * heightM).toFixed(1);
    rangeGuidance = `AI Calculation${genderContext}: Your BMI is ${bmi} kg/m² (${category}). Reaching an optimal reference weight near ${targetMaxKg} kg (or a 5–7% gradual reduction) can significantly improve metabolic markers.`;
  }

  return {
    bmi,
    category,
    badgeColor,
    aiNote: `${rangeGuidance} ${condContext}`,
    markerPercent,
  };
}

export default function ProfilePage() {
  const router = useRouter();
  const photoInputRef = useRef<HTMLInputElement>(null);

  const [authorized, setAuthorized] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);

  // Editable Profile State
  const [fullName, setFullName] = useState('');
  const [profilePhoto, setProfilePhoto] = useState<string>('');
  const [gender, setGender] = useState('');
  const [weight, setWeight] = useState<string>('');
  const [weightUnit, setWeightUnit] = useState<'kg' | 'lbs'>('kg');
  const [height, setHeight] = useState<string>('');
  const [heightUnit, setHeightUnit] = useState<'cm' | 'ft'>('cm');
  const [conditions, setConditions] = useState<string[]>([]);
  const [newConditionInput, setNewConditionInput] = useState('');

  // AI BMI State
  const [aiCalculating, setAiCalculating] = useState(false);
  const [bmiAnalysis, setBmiAnalysis] = useState<BmiAiResult | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    if (!isSessionAuthenticated()) {
      router.replace('/');
      return;
    }

    async function loadUserProfile() {
      const stored = await getStoredProfile();
      if (!stored) {
        router.replace('/');
        return;
      }

      setProfile(stored);
      const initialName =
        stored.full_name ||
        [stored.first_name, stored.last_name].filter(Boolean).join(' ') ||
        'User';
      setFullName(initialName);
      setProfilePhoto(stored.profile_photo || '');
      setGender(stored.gender || '');
      setWeight(stored.weight !== undefined && stored.weight !== null ? String(stored.weight) : '');
      setWeightUnit(stored.weight_unit || 'kg');
      setHeight(stored.height !== undefined && stored.height !== null ? String(stored.height) : '');
      setHeightUnit(stored.height_unit || 'cm');
      const userConds = Array.isArray(stored.conditions) ? stored.conditions : [];
      setConditions(userConds);

      // Compute initial BMI if weight & height exist
      const initialBmi = computeAiBmiAnalysis(
        stored.weight,
        stored.weight_unit || 'kg',
        stored.height,
        stored.height_unit || 'cm',
        stored.gender || '',
        userConds
      );
      setBmiAnalysis(initialBmi);
      setAuthorized(true);
    }

    loadUserProfile();
  }, [router]);

  // Automatically recalculate AI BMI when weight, height, units, gender, or conditions change
  useEffect(() => {
    if (!authorized) return;
    const analysis = computeAiBmiAnalysis(
      weight,
      weightUnit,
      height,
      heightUnit,
      gender,
      conditions
    );
    setBmiAnalysis(analysis);
  }, [weight, weightUnit, height, heightUnit, gender, conditions, authorized]);

  // Persist helper
  const persistProfileUpdates = async (overrides?: Partial<UserProfile>) => {
    if (!profile) return;
    const trimmedName = fullName.trim() || 'User';
    const nameParts = trimmedName.split(/\s+/);
    const firstName = nameParts[0] || 'User';
    const lastName = nameParts.slice(1).join(' ');

    const currentBmi = computeAiBmiAnalysis(
      weight,
      weightUnit,
      height,
      heightUnit,
      gender,
      conditions
    );

    const updatedProfile: UserProfile = {
      ...profile,
      full_name: trimmedName,
      first_name: firstName,
      last_name: lastName,
      profile_photo: profilePhoto || undefined,
      gender: gender || undefined,
      weight: weight ? Number(weight) : undefined,
      weight_unit: weightUnit,
      height: height ? Number(height) : undefined,
      height_unit: heightUnit,
      bmi: currentBmi?.bmi,
      bmi_category: currentBmi?.category,
      bmi_ai_note: currentBmi?.aiNote,
      conditions,
      ...overrides,
    };

    setProfile(updatedProfile);
    await saveStoredProfile(updatedProfile);
  };

  // Handle Photo Upload with client-side image compression for reliable storage
  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = async () => {
        const canvas = document.createElement('canvas');
        const maxDim = 320;
        let w = img.width;
        let h = img.height;

        if (w > h) {
          if (w > maxDim) {
            h = Math.round((h * maxDim) / w);
            w = maxDim;
          }
        } else {
          if (h > maxDim) {
            w = Math.round((w * maxDim) / h);
            h = maxDim;
          }
        }

        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, w, h);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
          setProfilePhoto(dataUrl);
          await persistProfileUpdates({ profile_photo: dataUrl });
        }
      };
      if (typeof event.target?.result === 'string') {
        img.src = event.target.result;
      }
    };
    reader.readAsDataURL(file);
  };

  const handleRemovePhoto = async () => {
    setProfilePhoto('');
    await persistProfileUpdates({ profile_photo: undefined });
  };

  const handleAiCalculateClick = async () => {
    setAiCalculating(true);
    setTimeout(async () => {
      const result = computeAiBmiAnalysis(
        weight,
        weightUnit,
        height,
        heightUnit,
        gender,
        conditions
      );
      setBmiAnalysis(result);
      await persistProfileUpdates({
        bmi: result?.bmi,
        bmi_category: result?.category,
        bmi_ai_note: result?.aiNote,
      });
      setAiCalculating(false);
    }, 350);
  };

  const handleToggleCondition = async (condName: string) => {
    const updated = conditions.includes(condName)
      ? conditions.filter((c) => c !== condName)
      : [...conditions, condName];
    setConditions(updated);
    await persistProfileUpdates({ conditions: updated });
  };

  const handleAddCondition = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newConditionInput.trim();
    if (!trimmed) return;
    if (!conditions.includes(trimmed)) {
      const updated = [...conditions, trimmed];
      setConditions(updated);
      await persistProfileUpdates({ conditions: updated });
    }
    setNewConditionInput('');
  };

  const handleRemoveCondition = async (condName: string) => {
    const updated = conditions.filter((c) => c !== condName);
    setConditions(updated);
    await persistProfileUpdates({ conditions: updated });
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    await persistProfileUpdates();
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2500);
  };

  const handleLogout = () => {
    setSessionAuthenticated(false);
    router.push('/?mode=signin');
  };

  if (!authorized) {
    return null;
  }

  const initials = (fullName || 'U')
    .split(/\s+/)
    .map((p) => p[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="max-w-4xl mx-auto py-4 sm:py-6 space-y-6 animate-in fade-in duration-150">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            Profile
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1 font-medium">
            Manage your personal details, AI-calculated BMI, and active health conditions.
          </p>
        </div>
      </div>

      <form onSubmit={handleSaveProfile} className="space-y-6">
        {/* Card 1: Profile Photo, Name & Gender */}
        <div className="card-depth p-6 sm:p-8 bg-white rounded-[28px] space-y-6">
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
            {/* Profile Photo with Camera Button */}
            <div className="flex flex-col items-center space-y-2.5 shrink-0">
              <div className="relative group">
                <div className="w-28 h-28 rounded-full overflow-hidden border-4 border-blue-50 shadow-[0_8px_24px_rgba(37,99,235,0.12)] bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-white text-3xl font-black">
                  {profilePhoto ? (
                    <img
                      src={profilePhoto}
                      alt={fullName}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span>{initials || <User className="w-12 h-12" />}</span>
                  )}
                </div>

                {/* Floating Camera Button Overlay */}
                <button
                  type="button"
                  onClick={() => photoInputRef.current?.click()}
                  className="absolute bottom-0 right-0 w-10 h-10 rounded-full bg-[#1d63ff] hover:bg-blue-700 text-white flex items-center justify-center shadow-lg border-2 border-white transition transform hover:scale-105 tap-press"
                  title="Add or change profile photo"
                >
                  <Camera className="w-4 h-4" />
                </button>

                <input
                  ref={photoInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handlePhotoSelect}
                />
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => photoInputRef.current?.click()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-xs transition tap-press"
                >
                  <Camera className="w-3.5 h-3.5" />
                  <span>{profilePhoto ? 'Change Photo' : 'Add Photo'}</span>
                </button>
                {profilePhoto && (
                  <button
                    type="button"
                    onClick={handleRemovePhoto}
                    className="p-1.5 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                    title="Remove photo"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Name & Gender Inputs */}
            <div className="flex-1 w-full space-y-4">
              <div>
                <label className="block text-xs font-extrabold text-slate-500 uppercase tracking-wider mb-1.5">
                  Full Name
                </label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  onBlur={() => persistProfileUpdates()}
                  placeholder="Enter your full name"
                  className="w-full px-4 py-3.5 rounded-2xl border border-slate-200/90 bg-slate-50/50 focus:bg-white text-sm sm:text-base font-bold text-slate-900 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-extrabold text-slate-500 uppercase tracking-wider mb-1.5">
                  Gender
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {GENDER_OPTIONS.map((option) => {
                    const isSelected = gender === option;
                    return (
                      <button
                        key={option}
                        type="button"
                        onClick={async () => {
                          setGender(option);
                          await persistProfileUpdates({ gender: option });
                        }}
                        className={`px-3.5 py-2.5 rounded-2xl text-xs sm:text-sm font-bold border transition-all tap-press ${
                          isSelected
                            ? 'border-[#1d63ff] bg-[#f4f8ff] text-[#1d63ff] shadow-2xs font-black'
                            : 'border-slate-200/90 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50/60'
                        }`}
                      >
                        {option}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Card 2: Weight, Height & AI BMI Calculator */}
        <div className="card-depth p-6 sm:p-8 bg-white rounded-[28px] space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="text-base sm:text-lg font-black text-slate-900 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-blue-600" />
                <span>Body Metrics & AI BMI Calculation</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Enter your weight and height below — AI automatically calculates and interprets your BMI.
              </p>
            </div>

            <button
              type="button"
              onClick={handleAiCalculateClick}
              disabled={!weight || !height || aiCalculating}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-50 hover:bg-blue-100 disabled:opacity-50 text-blue-700 font-extrabold text-xs transition tap-press self-start sm:self-auto"
            >
              {aiCalculating ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Sparkles className="w-3.5 h-3.5" />
              )}
              <span>Calculate BMI with AI</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Weight Field */}
            <div className="p-4 rounded-2xl bg-slate-50/70 border border-slate-200/80 space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-extrabold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
                  <Scale className="w-4 h-4 text-blue-600" />
                  <span>Weight</span>
                </label>
                <div className="inline-flex rounded-xl bg-slate-200/70 p-0.5 text-[11px] font-bold">
                  {(['kg', 'lbs'] as const).map((u) => (
                    <button
                      key={u}
                      type="button"
                      onClick={() => setWeightUnit(u)}
                      className={`px-2.5 py-1 rounded-lg transition ${
                        weightUnit === u
                          ? 'bg-white text-blue-600 shadow-2xs font-black'
                          : 'text-slate-600'
                      }`}
                    >
                      {u}
                    </button>
                  ))}
                </div>
              </div>
              <input
                type="number"
                step="0.1"
                min="1"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                onBlur={() => persistProfileUpdates()}
                placeholder={weightUnit === 'kg' ? 'e.g. 72.5' : 'e.g. 160'}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-base font-black text-slate-900 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition"
              />
            </div>

            {/* Height Field */}
            <div className="p-4 rounded-2xl bg-slate-50/70 border border-slate-200/80 space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-extrabold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
                  <Ruler className="w-4 h-4 text-indigo-600" />
                  <span>Height</span>
                </label>
                <div className="inline-flex rounded-xl bg-slate-200/70 p-0.5 text-[11px] font-bold">
                  {(['cm', 'ft'] as const).map((u) => (
                    <button
                      key={u}
                      type="button"
                      onClick={() => setHeightUnit(u)}
                      className={`px-2.5 py-1 rounded-lg transition ${
                        heightUnit === u
                          ? 'bg-white text-indigo-600 shadow-2xs font-black'
                          : 'text-slate-600'
                      }`}
                    >
                      {u}
                    </button>
                  ))}
                </div>
              </div>
              <input
                type="number"
                step="0.1"
                min="1"
                value={height}
                onChange={(e) => setHeight(e.target.value)}
                onBlur={() => persistProfileUpdates()}
                placeholder={heightUnit === 'cm' ? 'e.g. 170' : 'e.g. 5.6'}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-base font-black text-slate-900 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition"
              />
            </div>
          </div>

          {/* AI Calculated BMI Display Card */}
          <div className="rounded-3xl bg-gradient-to-br from-[#f4f8ff] to-[#eef4ff] border border-blue-200/80 p-5 sm:p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-[0_4px_12px_rgba(37,99,235,0.25)] shrink-0">
                  <Sparkles className="w-6 h-6" />
                </div>
                <div>
                  <span className="text-[11px] font-extrabold uppercase tracking-wider text-blue-700 block">
                    AI Calculated BMI
                  </span>
                  {bmiAnalysis ? (
                    <div className="flex items-baseline gap-2 mt-0.5">
                      <span className="text-2xl sm:text-3xl font-black text-slate-900 tabular-nums">
                        {bmiAnalysis.bmi}
                      </span>
                      <span className="text-xs font-bold text-slate-500">kg/m²</span>
                    </div>
                  ) : (
                    <p className="text-sm font-bold text-slate-600 mt-0.5">
                      Enter your Weight and Height above for AI to calculate your BMI
                    </p>
                  )}
                </div>
              </div>

              {bmiAnalysis && (
                <span
                  className={`inline-flex items-center px-3.5 py-1.5 rounded-full text-xs font-black border self-start sm:self-center ${bmiAnalysis.badgeColor}`}
                >
                  {bmiAnalysis.category}
                </span>
              )}
            </div>

            {bmiAnalysis && (
              <>
                {/* Visual BMI Spectrum Scale */}
                <div className="space-y-1.5 pt-1">
                  <div className="relative h-2.5 w-full rounded-full overflow-hidden flex">
                    <div className="w-[18%] bg-amber-300" title="Underweight (<18.5)" />
                    <div className="w-[32%] bg-emerald-400" title="Optimal (18.5-24.9)" />
                    <div className="w-[25%] bg-amber-400" title="Overweight (25-29.9)" />
                    <div className="w-[25%] bg-rose-400" title="Obese (30+)" />
                    <div
                      className="absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-slate-900 border-2 border-white shadow-md transition-all duration-300"
                      style={{ left: `calc(${bmiAnalysis.markerPercent}% - 8px)` }}
                    />
                  </div>
                  <div className="flex justify-between text-[10px] font-bold text-slate-400 px-0.5">
                    <span>&lt;18.5 Underweight</span>
                    <span>18.5–24.9 Optimal</span>
                    <span>25–29.9 Overweight</span>
                    <span>30+ Obesity</span>
                  </div>
                </div>

                {/* AI Clinical Interpretation */}
                <p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-medium bg-white/80 rounded-2xl p-3.5 border border-blue-100">
                  {bmiAnalysis.aiNote}
                </p>
              </>
            )}
          </div>
        </div>

        {/* Card 3: Health Conditions User is Experiencing */}
        <div className="card-depth p-6 sm:p-8 bg-white rounded-[28px] space-y-5">
          <div>
            <h2 className="text-base sm:text-lg font-black text-slate-900 flex items-center gap-2">
              <HeartPulse className="w-5 h-5 text-rose-500" />
              <span>Health Conditions You Are Experiencing</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Your saved health conditions personalize your dashboard metrics and doctor briefs.
            </p>
          </div>

          {/* Active Conditions Pills */}
          {conditions.length === 0 ? (
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 text-xs font-bold text-slate-500">
              No health conditions selected yet. Toggle from the list below or add one manually.
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {conditions.map((cond) => (
                <span
                  key={cond}
                  className="inline-flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-[#f4f8ff] border border-[#3b82f6]/40 text-blue-950 text-xs sm:text-sm font-extrabold shadow-2xs"
                >
                  <Check className="w-3.5 h-3.5 text-[#1d63ff] stroke-[3]" />
                  <span>{cond}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveCondition(cond)}
                    className="text-slate-400 hover:text-rose-600 transition ml-0.5"
                    title="Remove condition"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </span>
              ))}
            </div>
          )}

          {/* Quick Toggle Standard Conditions */}
          <div className="space-y-2.5 pt-1">
            <span className="block text-[11px] font-extrabold text-slate-400 uppercase tracking-wider">
              Quick Toggle Clinical Profiles
            </span>
            <div className="flex flex-wrap gap-2">
              {STANDARD_CONDITIONS.map((item) => {
                const active = conditions.includes(item);
                return (
                  <button
                    key={item}
                    type="button"
                    onClick={() => handleToggleCondition(item)}
                    className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition-all tap-press flex items-center gap-1.5 ${
                      active
                        ? 'border-[#1d63ff] bg-[#1d63ff] text-white shadow-2xs'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {active && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                    <span>{item}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Add Custom Health Condition */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 pt-2">
            <input
              type="text"
              value={newConditionInput}
              onChange={(e) => setNewConditionInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddCondition(e);
                }
              }}
              placeholder="Add another health condition..."
              className="flex-1 px-4 py-3 rounded-2xl border border-slate-200 bg-slate-50/50 focus:bg-white text-sm text-slate-800 font-medium outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition"
            />
            <button
              type="button"
              onClick={handleAddCondition}
              className="px-6 py-3.5 rounded-2xl bg-gradient-to-b from-[#1e90ff] to-[#1d63ff] hover:from-blue-600 hover:to-blue-700 text-white font-black text-xs sm:text-sm flex items-center justify-center gap-2 transition shadow-[0_4px_14px_rgba(29,99,255,0.25)] tap-press shrink-0"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span>Add Condition</span>
            </button>
          </div>
        </div>

        {/* Bottom Actions: Save Profile & Logout */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
          <button
            type="button"
            onClick={handleLogout}
            className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-gradient-to-b from-[#1e90ff] to-[#1d63ff] hover:from-blue-600 hover:to-blue-700 active:bg-blue-800 text-white font-black text-sm sm:text-base transition-all shadow-[0_4px_14px_rgba(29,99,255,0.28)] tap-press flex items-center justify-center gap-2"
          >
            <LogOut className="w-4 h-4 stroke-[2.5]" />
            <span>Log Out</span>
          </button>

          <div className="flex items-center gap-3">
            {saveSuccess && (
              <span className="inline-flex items-center gap-1.5 text-xs font-extrabold text-emerald-600 animate-in fade-in">
                <CheckCircle2 className="w-4 h-4" />
                <span>Profile saved!</span>
              </span>
            )}
            <button
              type="submit"
              className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-gradient-to-b from-[#1e90ff] to-[#1d63ff] hover:from-blue-600 hover:to-blue-700 active:bg-blue-800 text-white font-black text-sm sm:text-base transition-all shadow-[0_4px_14px_rgba(29,99,255,0.28)] tap-press flex items-center justify-center gap-2"
            >
              <Save className="w-4 h-4 stroke-[2.5]" />
              <span>Save Profile</span>
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
