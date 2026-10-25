'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import {
  Clock,
  FileText,
  AlertCircle,
  ExternalLink,
  ShieldCheck,
  Stethoscope,
  Sparkles,
  Download,
  Building2,
  X,
  Eye,
} from 'lucide-react';
import { DoctorBriefContent, UnitSystem } from '@/lib/types';

export default function DoctorViewPage() {
  const params = useParams();
  const token = params?.token as string;

  const [brief, setBrief] = useState<DoctorBriefContent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [unitSystem, setUnitSystem] = useState<UnitSystem>('mg_dl');
  const [inspectModalOpen, setInspectModalOpen] = useState(false);

  useEffect(() => {
    if (!token) return;

    // Check localStorage fallback first for instant preview
    if (typeof window !== 'undefined') {
      const cached = localStorage.getItem(`medtrac_share_${token}`);
      if (cached) {
        setBrief(JSON.parse(cached));
        setLoading(false);
        return;
      }

      // Check default brief cache
      const defaultBrief =
        localStorage.getItem('medtrac_brief_GP') ||
        localStorage.getItem('medtrac_brief_Endocrinologist') ||
        localStorage.getItem('medtrac_brief_Nutritionist');

      if (defaultBrief) {
        setBrief(JSON.parse(defaultBrief));
        setLoading(false);
        return;
      }
    }

    // Fetch from Supabase share endpoint
    fetch(`/api/share/${token}`)
      .then((res) => {
        if (!res.ok) throw new Error('Link has expired or was revoked by the patient.');
        return res.json();
      })
      .then((data) => {
        setBrief(data.brief);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message || 'Share link is invalid or expired.');
        setLoading(false);
      });
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center p-6 text-center">
        <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-sm font-bold text-slate-700">Loading Doctor Brief...</p>
      </div>
    );
  }

  if (error || !brief) {
    return (
      <div className="max-w-md mx-auto my-12 p-8 bg-white rounded-3xl border border-red-200 text-center shadow-sm">
        <div className="w-12 h-12 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center mx-auto mb-3">
          <AlertCircle className="w-6 h-6" />
        </div>
        <h2 className="text-lg font-black text-slate-900">Access Expired or Revoked</h2>
        <p className="text-xs text-slate-600 mt-2 leading-relaxed">
          {error || 'This link has expired (24-hour security limit) or was revoked by the patient.'}
        </p>
        <div className="mt-6 pt-4 border-t border-slate-100 text-[11px] text-slate-400">
          Medtrac Secure Healthcare Sharing • Bearer Token Revoked
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-5 py-4">
      {/* Expiry / Security Banner */}
      <div className="p-3.5 bg-amber-50/90 border border-amber-200/80 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-amber-900 shadow-2xs">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
          <Clock className="w-4 h-4 text-amber-700 shrink-0" />
          <span>
            <strong>Temporary Doctor Access:</strong> Valid for 24 hours. No account or password required.
          </span>
        </div>
        <span className="badge-attention text-[10px] tabular-nums self-start sm:self-auto font-bold">
          Expiring Bearer Token
        </span>
      </div>

      {/* Main Document */}
      <div className="card-depth p-6 sm:p-8 space-y-6">
        {/* Top Header */}
        <div className="border-b border-slate-200/80 pb-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 rounded-xl bg-blue-50 text-blue-700 ring-1 ring-blue-600/20 text-xs font-black uppercase tracking-wider">
                {brief.doctor_type} Clinical Brief
              </span>
              <span className="text-xs text-slate-400 font-semibold">60-Second Review</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 mt-2 tracking-tight">
              {brief.patient_summary.name}
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Conditions: {brief.patient_summary.conditions.join(', ')}
            </p>
          </div>

          {/* Unit Switcher for Physician Convenience */}
          <div className="flex flex-col sm:items-end gap-1.5">
            <span className="text-[10px] uppercase font-bold text-slate-400">
              Physician Preferred Units
            </span>
            <div className="inline-flex rounded-xl bg-slate-100/90 p-1 border border-slate-200 shadow-2xs">
              <button
                onClick={() => setUnitSystem('mg_dl')}
                className={`px-3 py-1 text-xs font-bold rounded-lg transition-all tap-press ${
                  unitSystem === 'mg_dl'
                    ? 'bg-white text-blue-700 shadow-2xs ring-1 ring-slate-900/5'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                mg/dL
              </button>
              <button
                onClick={() => setUnitSystem('mmol_l')}
                className={`px-3 py-1 text-xs font-bold rounded-lg transition-all tap-press ${
                  unitSystem === 'mmol_l'
                    ? 'bg-white text-blue-700 shadow-2xs ring-1 ring-slate-900/5'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                mmol/L
              </button>
            </div>
          </div>
        </div>

        {/* Changes since last visit */}
        <div>
          <h2 className="text-xs font-black text-slate-700 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-blue-600" />
            Key Trajectory Since Last Review
          </h2>
          <div className="space-y-2">
            {brief.key_changes.map((item, idx) => (
              <div
                key={idx}
                className="p-3.5 rounded-2xl bg-slate-50/80 border border-slate-200/80 text-xs text-slate-800 font-medium leading-relaxed tabular-nums"
              >
                {item}
              </div>
            ))}
          </div>
        </div>

        {/* Narrative */}
        <div>
          <h2 className="text-xs font-black text-slate-700 uppercase tracking-wider mb-2">
            Specialist Overview ({brief.doctor_type})
          </h2>
          <p className="text-xs text-slate-700 leading-relaxed bg-slate-50/80 p-4 rounded-2xl border border-slate-200/80">
            {brief.trends_summary}
          </p>
        </div>

        {/* Medications & Interventions Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="p-4 rounded-2xl bg-slate-50/80 border border-slate-200/80">
            <h3 className="text-xs font-black text-slate-700 uppercase tracking-wider mb-2.5">
              Active Medications
            </h3>
            <div className="space-y-2 text-xs">
              {brief.current_medications.map((m, idx) => (
                <div key={idx} className="flex justify-between items-center text-slate-800 bg-white/80 px-3 py-2 rounded-xl border border-slate-200/60 shadow-2xs">
                  <span className="font-bold text-slate-900">{m.name} <span className="text-slate-500 font-semibold">{m.dosage}</span></span>
                  <span className="text-slate-500 text-[11px] font-medium">{m.frequency}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-purple-50/40 border border-purple-200/60">
            <h3 className="text-xs font-black text-purple-900 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-purple-600 inline-block" />
              Recent Life Events / Interventions
            </h3>
            <div className="space-y-2 text-xs">
              {brief.recent_events.map((e, idx) => (
                <div key={idx} className="flex justify-between items-center text-slate-800 bg-white/80 px-3 py-2 rounded-xl border border-purple-200/60 shadow-2xs">
                  <span className="font-medium text-slate-900">{e.title}</span>
                  <span className="badge-milestone text-[11px] tabular-nums font-bold">{e.date}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Patient Clarifying Questions */}
        <div className="p-5 rounded-3xl bg-blue-50/60 border border-blue-200/80 space-y-3 shadow-2xs">
          <h3 className="text-xs font-black text-blue-950 uppercase tracking-wider mb-2 flex items-center gap-2">
            Patient Consultation Questions
          </h3>
          <ol className="space-y-2 text-xs text-blue-950 list-decimal list-inside font-medium leading-relaxed">
            {brief.questions_to_ask.map((q, idx) => (
              <li key={idx} className="bg-white/90 p-2.5 rounded-xl border border-blue-200/60 shadow-2xs">
                <span className="ml-1 text-slate-800">{q}</span>
              </li>
            ))}
          </ol>
        </div>

        {/* Original Report Files Verification */}
        <div className="p-4 rounded-2xl border border-slate-200/80 bg-slate-50/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
          <div>
            <h4 className="text-xs font-bold text-slate-900">Verify Source Lab Reports</h4>
            <p className="text-[11px] text-slate-500">
              Inspect original laboratory printouts from Mumbai (2025) and Dubai (2026).
            </p>
          </div>
          <button
            onClick={() => setInspectModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs shadow-2xs transition tap-press"
          >
            <FileText className="w-3.5 h-3.5 text-blue-600" />
            <span>Inspect Source Reports</span>
          </button>
        </div>

        {/* Disclaimer */}
        <div className="pt-4 border-t border-slate-200/80 text-center space-y-1 text-slate-400 text-[11px]">
          <p className="font-bold text-slate-600">
            Organises your records. Not medical advice.
          </p>
          <p>
            Patient-curated summary generated via Medtrac. Always cross-reference with primary clinical diagnostics.
          </p>
        </div>
      </div>

      {/* Source Reports Modal for Physician */}
      {inspectModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="card-depth bg-white rounded-3xl max-w-xl w-full p-6 sm:p-7 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 ring-1 ring-blue-600/20 flex items-center justify-center">
                  <Building2 className="w-4 h-4" />
                </div>
                <h3 className="font-extrabold text-slate-900 text-sm">
                  Source Laboratory Records
                </h3>
              </div>
              <button
                onClick={() => setInspectModalOpen(false)}
                className="w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center text-sm font-bold transition tap-press"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-4 rounded-2xl bg-slate-50/80 border border-slate-200/80 space-y-1 shadow-2xs">
                <span className="font-bold text-slate-900">
                  1. Metropolis Healthcare (Mumbai, India)
                </span>
                <p className="text-slate-500 text-[11px] tabular-nums font-medium">Date: March 10, 2025 • Conventional Units (mg/dL)</p>
                <p className="font-mono text-[11px] text-blue-700 bg-blue-50/80 p-2 rounded-xl border border-blue-200/60 font-semibold tabular-nums">
                  Triglycerides: 235 mg/dL | FBS: 114 mg/dL | HbA1c: 6.2%
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50/80 border border-slate-200/80 space-y-1 shadow-2xs">
                <span className="font-bold text-slate-900">
                  2. Mediclinic City Hospital (Dubai, UAE)
                </span>
                <p className="text-slate-500 text-[11px] tabular-nums font-medium">Date: January 20, 2026 • SI Units (mmol/L)</p>
                <p className="font-mono text-[11px] text-blue-700 bg-blue-50/80 p-2 rounded-xl border border-blue-200/60 font-semibold tabular-nums">
                  Triglycerides: 1.82 mmol/L | FPG: 5.6 mmol/L | HbA1c: 5.8%
                </p>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setInspectModalOpen(false)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-2xs transition tap-press"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
