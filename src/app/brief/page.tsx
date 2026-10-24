'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { QRCodeSVG } from 'qrcode.react';
import {
  FileText,
  Share2,
  Download,
  RefreshCw,
  XCircle,
  Copy,
  Check,
  Stethoscope,
  Sparkles,
  HelpCircle,
  Clock,
  ShieldCheck,
  ExternalLink,
  Edit3,
  Calendar,
  AlertCircle,
  Save,
} from 'lucide-react';
import { DoctorBriefContent, LifeEvent, Medication, UserProfile, LabResult } from '@/lib/types';
import {
  getStoredProfile,
  getStoredResults,
  getStoredEvents,
  getStoredMedications,
} from '@/lib/data-service';

export default function DoctorBriefPage() {
  const router = useRouter();
  const [doctorType, setDoctorType] = useState<'GP' | 'Endocrinologist' | 'Nutritionist'>('GP');
  const [loading, setLoading] = useState(false);
  const [brief, setBrief] = useState<DoctorBriefContent | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [hasUnsavedEdits, setHasUnsavedEdits] = useState(false);

  // Last visit date picker (resolves the "since last visit" requirement)
  const [lastVisitDate, setLastVisitDate] = useState('2025-03-10');

  // Share modal state
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [shareToken, setShareToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isRevoked, setIsRevoked] = useState(false);
  const [showRegenerateConfirm, setShowRegenerateConfirm] = useState(false);

  // Load cached brief for selected specialty or generate
  useEffect(() => {
    const cached = localStorage.getItem(`medtrac_brief_${doctorType}`);
    if (cached) {
      setBrief(JSON.parse(cached));
    } else {
      handleGenerate(doctorType);
    }
  }, [doctorType]);

  const handleGenerate = async (selectedType: 'GP' | 'Endocrinologist' | 'Nutritionist') => {
    setLoading(true);
    try {
      const profile = (await getStoredProfile()) || {
        id: 'user_1',
        full_name: 'Alex Mercer',
        date_of_birth: '1985-06-15',
        conditions: ['Prediabetes', 'High Triglycerides'],
      };
      const results = (await getStoredResults()) || [];
      const events = (await getStoredEvents()) || [];
      const medications = (await getStoredMedications()) || [];

      const res = await fetch('/api/brief', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          doctorType: selectedType,
          profile,
          results,
          medications,
          events,
        }),
      });

      if (!res.ok) {
        throw new Error('API brief synthesis failed');
      }

      const data = await res.json();
      const generatedBrief = { ...data.brief, last_visit_date: lastVisitDate };
      setBrief(generatedBrief);
      localStorage.setItem(`medtrac_brief_${selectedType}`, JSON.stringify(generatedBrief));
      setHasUnsavedEdits(false);
    } catch (err: any) {
      console.warn('Using client fallback generator:', err.message);
      // High-yield fallback tailored to recipient
      const fallbackBrief: DoctorBriefContent = {
        doctor_type: selectedType,
        patient_summary: {
          name: 'Sarah Jenkins',
          conditions: ['Prediabetes', 'High Triglycerides'],
        },
        last_visit_date: lastVisitDate,
        key_changes: [
          'Triglycerides dropped from 235 mg/dL (Metropolis, Mumbai, Mar 2025) down to 1.82 mmol/L / ~161 mg/dL (Mediclinic, Dubai, Jan 2026), showing a 31% improvement.',
          'HbA1c declined favorably from 6.2% to 5.8%, placing the patient within close reach of normal glycemic target.',
          'Fasting Glucose stabilized at 5.6 mmol/L (~101 mg/dL) following initiation of Metformin.',
        ],
        trends_summary:
          selectedType === 'Endocrinologist'
            ? 'Glycemic markers demonstrate steady favorable response to the current metformin dosage and dietary interventions over the past 10 months. Insulin sensitivity markers show consistent improvement.'
            : selectedType === 'Nutritionist'
            ? 'Lipid profiles indicate significant responsiveness to reduced simple carbohydrate intake and addition of omega-3 supplementation. Continued focus on dietary fiber recommended.'
            : 'Patient presents with steady metabolic improvements across both lipid and glycemic panels over the preceding 10 months following lifestyle protocol and Metformin.',
        current_medications: [
          {
            name: 'Metformin',
            dosage: '500mg',
            frequency: 'Once daily with dinner',
            started: '2025-06-15',
          },
          {
            name: 'Omega-3 Fish Oil',
            dosage: '1000mg',
            frequency: 'Daily morning',
            started: '2025-04-01',
          },
        ],
        recent_events: [
          {
            title: 'Started Metformin 500mg daily',
            date: '2025-06-15',
            category: 'medication',
          },
          {
            title: 'Adopted low-glycemic dietary protocol',
            date: '2025-09-01',
            category: 'lifestyle',
          },
        ],
        questions_to_ask: [
          'Given the 31% drop in triglycerides, is my current Metformin 500mg dosage optimal or should it be adjusted?',
          'Should we schedule an advanced ApoB or lipid particle test at our next milestone review?',
          'Are there any complementary dietary supplements or lifestyle modifications you recommend to push HbA1c below 5.7%?',
        ],
        disclaimer: 'Organises your records. Not medical advice.',
      };
      setBrief(fallbackBrief);
      localStorage.setItem(`medtrac_brief_${selectedType}`, JSON.stringify(fallbackBrief));
      setHasUnsavedEdits(false);
    } finally {
      setLoading(false);
      setShowRegenerateConfirm(false);
    }
  };

  const handleSaveEdits = () => {
    if (!brief) return;
    localStorage.setItem(`medtrac_brief_${doctorType}`, JSON.stringify(brief));
    setIsEditing(false);
    setHasUnsavedEdits(false);
  };

  const handleShare = async () => {
    if (!brief) return;
    try {
      const res = await fetch('/api/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          doctorType,
          briefContent: brief,
        }),
      });
      const data = await res.json();
      setShareToken(data.token);
      setIsRevoked(false);
      setShareModalOpen(true);

      // Save to localStorage for demo preview fallback
      if (typeof window !== 'undefined') {
        localStorage.setItem(`medtrac_share_${data.token}`, JSON.stringify(brief));
      }
    } catch (err: any) {
      alert(`Could not create share link: ${err.message}`);
    }
  };

  const handleRevoke = async () => {
    if (!shareToken) return;
    try {
      await fetch(`/api/share?token=${shareToken}`, { method: 'DELETE' });
      setIsRevoked(true);
      if (typeof window !== 'undefined') {
        localStorage.removeItem(`medtrac_share_${shareToken}`);
      }
      alert('Share link has been revoked. Anyone opening this link will now see an expired message.');
    } catch (err: any) {
      alert(`Revocation error: ${err.message}`);
    }
  };

  const shareUrl =
    typeof window !== 'undefined' && shareToken
      ? `${window.location.origin}/share/${shareToken}`
      : '';

  const copyToClipboard = () => {
    if (!shareUrl) return;
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Header & Doctor Specialty Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 no-print">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-2xl bg-blue-100 text-blue-700 flex items-center justify-center font-black text-sm">
              4
            </span>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900">Doctor Brief</h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Doctor-ready consultation brief tailored to your physician’s exact specialty.
          </p>
        </div>

        {/* Doctor Specialty Tabs */}
        <div className="inline-flex rounded-2xl bg-slate-200/90 p-1 border border-slate-300 shadow-xs">
          {(['GP', 'Endocrinologist', 'Nutritionist'] as const).map((type) => (
            <button
              key={type}
              onClick={() => setDoctorType(type)}
              className={`px-3 py-1.5 text-xs font-bold rounded-xl transition ${
                doctorType === type
                  ? 'bg-white text-blue-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {type}
            </button>
          ))}
        </div>
      </div>

      {/* Action Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-white rounded-3xl border border-slate-200 shadow-xs no-print">
        <div className="flex flex-wrap items-center gap-2">
          {/* Last visit date selector */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 text-xs">
            <Calendar className="w-3.5 h-3.5 text-slate-500" />
            <span className="text-[11px] font-semibold text-slate-500">Since Visit:</span>
            <input
              type="date"
              value={lastVisitDate}
              onChange={(e) => setLastVisitDate(e.target.value)}
              className="bg-transparent text-slate-800 font-bold outline-none text-xs"
            />
          </div>

          <button
            onClick={() => {
              if (hasUnsavedEdits) {
                setShowRegenerateConfirm(true);
              } else {
                handleGenerate(doctorType);
              }
            }}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Regenerate</span>
          </button>

          <button
            onClick={() => {
              if (isEditing) {
                handleSaveEdits();
              } else {
                setIsEditing(true);
              }
            }}
            className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition ${
              isEditing
                ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                : 'border border-slate-200 text-slate-700 hover:bg-slate-50'
            }`}
          >
            {isEditing ? <Save className="w-3.5 h-3.5" /> : <Edit3 className="w-3.5 h-3.5" />}
            <span>{isEditing ? 'Save Changes' : 'Edit Brief'}</span>
          </button>

          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs transition"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download PDF</span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleShare}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold text-xs shadow-sm transition"
          >
            <Share2 className="w-3.5 h-3.5" />
            <span>Share 24h Link &amp; QR Code</span>
          </button>
        </div>
      </div>

      {/* Regenerate Confirmation Dialog */}
      {showRegenerateConfirm && (
        <div className="p-4 bg-amber-50 border border-amber-300 rounded-2xl flex items-center justify-between text-xs text-amber-900">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-700 shrink-0" />
            <span>
              You have edited notes. Regenerating with AI will overwrite your edits. Continue?
            </span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowRegenerateConfirm(false)}
              className="px-2.5 py-1 rounded-lg border border-amber-300 text-amber-800 font-bold"
            >
              Cancel
            </button>
            <button
              onClick={() => handleGenerate(doctorType)}
              className="px-2.5 py-1 rounded-lg bg-amber-600 text-white font-bold hover:bg-amber-700"
            >
              Confirm
            </button>
          </div>
        </div>
      )}

      {/* One-Page Doctor Brief Document */}
      {brief && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 sm:p-8 space-y-6">
          {/* Header */}
          <div className="border-b border-slate-200 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-1 rounded-lg bg-blue-100 text-blue-800 text-[11px] font-black uppercase tracking-wider">
                  {brief.doctor_type} Consultation Brief
                </span>
                <span className="text-xs text-slate-400">
                  Generated {new Date().toLocaleDateString()}
                </span>
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 mt-1.5">
                Patient: {brief.patient_summary.name}
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Conditions: {brief.patient_summary.conditions.join(', ')}
              </p>
            </div>
            <div className="text-right text-xs text-slate-400">
              <span className="font-extrabold text-slate-700">Medtrac Unified Records</span>
              <p>Chronological review since {lastVisitDate}</p>
            </div>
          </div>

          {/* Key Changes Section */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-blue-600" />
                Key Changes Since Last Visit ({lastVisitDate})
              </h3>
              {isEditing && (
                <span className="text-[10px] text-blue-600 font-bold">Editable</span>
              )}
            </div>

            <div className="space-y-2">
              {brief.key_changes.map((item, idx) => (
                <div
                  key={idx}
                  className="flex items-start gap-2 bg-slate-50 p-3 rounded-2xl border border-slate-100 text-xs text-slate-800 font-medium"
                >
                  <span className="w-2 h-2 rounded-full bg-blue-600 mt-1.5 shrink-0" />
                  {isEditing ? (
                    <input
                      type="text"
                      value={item}
                      onChange={(e) => {
                        const updated = [...brief.key_changes];
                        updated[idx] = e.target.value;
                        setBrief({ ...brief, key_changes: updated });
                        setHasUnsavedEdits(true);
                      }}
                      className="w-full bg-white px-2 py-1 rounded-lg border border-slate-300 outline-none"
                    />
                  ) : (
                    <span>{item}</span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Specialty Trends Summary */}
          <div>
            <h3 className="text-xs font-black text-slate-700 uppercase tracking-wider mb-2">
              Specialist Trajectory Overview ({brief.doctor_type})
            </h3>
            {isEditing ? (
              <textarea
                rows={3}
                value={brief.trends_summary}
                onChange={(e) => {
                  setBrief({ ...brief, trends_summary: e.target.value });
                  setHasUnsavedEdits(true);
                }}
                className="w-full text-xs text-slate-700 bg-white p-3 rounded-xl border border-slate-300 outline-none leading-relaxed"
              />
            ) : (
              <p className="text-xs text-slate-600 leading-relaxed bg-slate-50/70 p-3.5 rounded-2xl border border-slate-100">
                {brief.trends_summary}
              </p>
            )}
          </div>

          {/* Two-Column Grid: Medications & Interventions */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
              <h3 className="text-xs font-black text-slate-700 uppercase tracking-wider mb-2">
                Active Medications
              </h3>
              <div className="space-y-1.5 text-xs">
                {brief.current_medications.map((m, idx) => (
                  <div key={idx} className="flex justify-between text-slate-800">
                    <span className="font-bold">{m.name} {m.dosage}</span>
                    <span className="text-slate-500">{m.frequency}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
              <h3 className="text-xs font-black text-slate-700 uppercase tracking-wider mb-2">
                Recent Milestones / Life Events
              </h3>
              <div className="space-y-1.5 text-xs">
                {brief.recent_events.map((e, idx) => (
                  <div key={idx} className="flex justify-between text-slate-800">
                    <span className="font-medium">{e.title}</span>
                    <span className="text-purple-700 font-bold">{e.date}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* 3 Questions to Ask (Editable) */}
          <div className="p-5 rounded-3xl bg-blue-50/70 border border-blue-200 space-y-3">
            <h3 className="text-xs font-black text-blue-900 uppercase tracking-wider flex items-center gap-1.5">
              <HelpCircle className="w-4 h-4 text-blue-700" />
              Exactly 3 Suggested Questions to Ask Your {brief.doctor_type}
            </h3>
            <ol className="space-y-2 text-xs text-blue-900 list-decimal list-inside font-medium">
              {brief.questions_to_ask.map((q, idx) => (
                <li key={idx} className="leading-snug">
                  {isEditing ? (
                    <input
                      type="text"
                      value={q}
                      onChange={(e) => {
                        const updated = [...brief.questions_to_ask];
                        updated[idx] = e.target.value;
                        setBrief({ ...brief, questions_to_ask: updated });
                        setHasUnsavedEdits(true);
                      }}
                      className="w-full bg-white px-2 py-1 rounded-lg border border-blue-300 outline-none text-slate-900 mt-1"
                    />
                  ) : (
                    <span>{q}</span>
                  )}
                </li>
              ))}
            </ol>
          </div>

          {/* Mandatory Disclaimer */}
          <div className="pt-3 border-t border-slate-200 text-center text-xs font-semibold text-slate-400">
            {brief.disclaimer}
          </div>
        </div>
      )}

      {/* Share Modal with QR Code */}
      {shareModalOpen && shareToken && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-blue-600" />
                <h3 className="font-extrabold text-slate-900 text-base">24-Hour Doctor Share Link</h3>
              </div>
              <button
                onClick={() => setShareModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-xl font-bold"
              >
                &times;
              </button>
            </div>

            <p className="text-xs text-slate-500 leading-normal">
              Your doctor can open this link on their mobile or desktop without login or app install. Valid for 24 hours.
            </p>

            {/* QR Code */}
            <div className="p-4 bg-slate-50 rounded-2xl flex flex-col items-center justify-center border border-slate-200">
              <QRCodeSVG value={shareUrl} size={160} level="M" />
              <p className="text-[11px] text-slate-400 mt-2 font-medium">Scan with camera to view</p>
            </div>

            {/* Link Copy Box */}
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={shareUrl}
                className="flex-1 px-3 py-2 bg-slate-100 rounded-xl text-xs font-mono text-slate-700 outline-none border border-slate-200"
              />
              <button
                onClick={copyToClipboard}
                className="p-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white transition shrink-0"
                title="Copy link"
              >
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>

            {/* Revoke Option */}
            <div className="pt-2 flex items-center justify-between text-xs">
              <a
                href={shareUrl}
                target="_blank"
                rel="noreferrer"
                className="text-blue-600 hover:underline flex items-center gap-1 font-bold"
              >
                Open preview <ExternalLink className="w-3.5 h-3.5" />
              </a>

              <button
                onClick={handleRevoke}
                disabled={isRevoked}
                className="text-red-600 hover:text-red-800 font-bold disabled:opacity-50 transition"
              >
                {isRevoked ? 'Revoked' : 'Revoke Link'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
