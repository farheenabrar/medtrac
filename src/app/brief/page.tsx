'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { QRCodeSVG } from 'qrcode.react';
import {
  Share2,
  Download,
  RefreshCw,
  Copy,
  Check,
  Sparkles,
  HelpCircle,
  Clock,
  ExternalLink,
  Edit3,
  Calendar,
  AlertCircle,
  Save,
  UploadCloud,
} from 'lucide-react';
import { DoctorBriefContent } from '@/lib/types';
import {
  getStoredProfile,
  getStoredResults,
  getStoredEvents,
  getStoredMedications,
} from '@/lib/data-service';
import { isSessionAuthenticated } from '@/lib/auth-storage';

export default function DoctorBriefPage() {
  const router = useRouter();
  const [authorized, setAuthorized] = useState(false);
  const [doctorType, setDoctorType] = useState<'GP' | 'Endocrinologist' | 'Nutritionist'>('GP');
  const [loading, setLoading] = useState(false);
  const [brief, setBrief] = useState<DoctorBriefContent | null>(null);
  const [hasRecords, setHasRecords] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [hasUnsavedEdits, setHasUnsavedEdits] = useState(false);

  // Last visit date picker (empty by default for first-time user)
  const [lastVisitDate, setLastVisitDate] = useState('');

  // Share modal state
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [shareToken, setShareToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isRevoked, setIsRevoked] = useState(false);
  const [showRegenerateConfirm, setShowRegenerateConfirm] = useState(false);

  useEffect(() => {
    if (!isSessionAuthenticated()) {
      router.replace('/');
      return;
    }
    setAuthorized(true);
    handleGenerate(doctorType);
  }, [doctorType, router]);

  const handleGenerate = async (selectedType: 'GP' | 'Endocrinologist' | 'Nutritionist') => {
    setLoading(true);
    const profile = (await getStoredProfile()) || {
      id: 'user_1',
      full_name: 'User',
      date_of_birth: '',
      conditions: [],
    };
    const results = (await getStoredResults()) || [];
    const events = (await getStoredEvents()) || [];
    const medications = (await getStoredMedications()) || [];

    const userHasData = results.length > 0 || events.length > 0 || medications.length > 0;
    setHasRecords(userHasData);

    // If first-time user has no uploaded reports, medications, or events, do not populate any dummy brief data
    if (!userHasData) {
      setBrief({
        doctor_type: selectedType,
        patient_summary: {
          name: profile.full_name || profile.first_name || 'User',
          conditions: Array.isArray(profile.conditions) ? profile.conditions : [],
        },
        last_visit_date: lastVisitDate,
        key_changes: [],
        trends_summary: '',
        current_medications: [],
        recent_events: [],
        questions_to_ask: [],
        disclaimer: 'Organises your records. Not medical advice.',
      });
      setLoading(false);
      setShowRegenerateConfirm(false);
      return;
    }

    try {
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
      console.warn('Using dynamic client summary:', err.message);
      const actualConditions = Array.isArray(profile.conditions) ? profile.conditions : [];
      const fallbackBrief: DoctorBriefContent = {
        doctor_type: selectedType,
        patient_summary: {
          name: profile.full_name || profile.first_name || 'User',
          conditions: actualConditions,
        },
        last_visit_date: lastVisitDate,
        key_changes: results.map(
          (r) =>
            `${r.raw_test_name}: ${r.raw_value} ${r.raw_unit} (${r.test_date}${
              r.lab_name ? `, ${r.lab_name}` : ''
            })`
        ),
        trends_summary:
          results.length > 0
            ? `Summary generated from ${results.length} uploaded laboratory test result(s) for ${
                profile.full_name || 'User'
              } tailored for ${selectedType} consultation.`
            : '',
        current_medications: medications.map((m) => ({
          name: m.name,
          dosage: m.dosage,
          frequency: m.frequency,
          started: m.start_date,
        })),
        recent_events: events.map((e) => ({
          title: e.title,
          date: e.event_date,
          category: e.category,
        })),
        questions_to_ask:
          results.length > 0 || actualConditions.length > 0
            ? [
                `Based on my current profile${
                  actualConditions.length > 0 ? ` (${actualConditions.join(', ')})` : ''
                }, what target ranges should we prioritize?`,
                `Which follow-up laboratory tests do you recommend before our next ${selectedType} review?`,
                `Are any adjustments needed to my current management plan based on these records?`,
              ]
            : [],
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

  if (!authorized) {
    return null;
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      {/* Header & Doctor Specialty Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 no-print">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">Doctor Brief</h1>
          <p className="text-xs text-slate-500 mt-1">
            Doctor-ready consultation brief tailored to your physician’s exact specialty.
          </p>
        </div>

        {/* Doctor Specialty Tabs */}
        {hasRecords && (
          <div className="inline-flex rounded-2xl bg-slate-100/90 p-1 border border-slate-200 shadow-2xs">
            {(['GP', 'Endocrinologist', 'Nutritionist'] as const).map((type) => (
              <button
                key={type}
                onClick={() => setDoctorType(type)}
                className={`px-3.5 py-1.5 text-xs font-bold rounded-xl transition-all tap-press ${
                  doctorType === type
                    ? 'bg-white text-blue-700 shadow-2xs ring-1 ring-slate-900/5'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {type}
              </button>
            ))}
          </div>
        )}
      </div>

      {!hasRecords ? (
        <div className="card-depth p-10 text-center space-y-4 bg-white rounded-3xl">
          <p className="text-sm sm:text-base font-bold text-slate-800">
            No Doctor Brief generated yet.
          </p>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Upload and confirm your laboratory reports in the Uploads screen to generate your consultation brief.
          </p>
          <div className="pt-2">
            <button
              type="button"
              onClick={() => router.push('/upload')}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-sm transition tap-press"
            >
              <UploadCloud className="w-4 h-4" />
              <span>Go to Uploads</span>
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Action Toolbar */}
      <div className="card-depth flex flex-wrap items-center justify-between gap-3 p-4 no-print">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200/80 bg-slate-50 text-xs">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-[11px] font-semibold text-slate-500">Since Visit:</span>
            <input
              type="date"
              value={lastVisitDate}
              onChange={(e) => setLastVisitDate(e.target.value)}
              className="bg-transparent text-slate-800 font-bold outline-none text-xs tabular-nums"
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
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200/80 hover:bg-slate-50 text-slate-700 font-bold text-xs transition tap-press shadow-2xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-blue-600' : 'text-slate-500'}`} />
            <span>Regenerate</span>
          </button>

          {hasRecords && (
            <button
              onClick={() => {
                if (isEditing) {
                  handleSaveEdits();
                } else {
                  setIsEditing(true);
                }
              }}
              className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition tap-press shadow-2xs ${
                isEditing
                  ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                  : 'border border-slate-200/80 text-slate-700 hover:bg-slate-50'
              }`}
            >
              {isEditing ? <Save className="w-3.5 h-3.5" /> : <Edit3 className="w-3.5 h-3.5 text-slate-500" />}
              <span>{isEditing ? 'Save Changes' : 'Edit Brief'}</span>
            </button>
          )}

          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200/80 hover:bg-slate-50 text-slate-700 font-bold text-xs transition tap-press shadow-2xs"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span>Download PDF</span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleShare}
            disabled={!hasRecords}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 text-white font-bold text-xs shadow-sm transition tap-press"
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
        <div className="card-depth p-6 sm:p-8 space-y-6">
          {/* Header */}
          <div className="border-b border-slate-200/80 pb-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-1 rounded-xl bg-blue-50 text-blue-700 ring-1 ring-blue-600/20 text-[11px] font-black uppercase tracking-wider">
                  {brief.doctor_type} Consultation Brief
                </span>
                <span className="text-xs text-slate-400 font-semibold tabular-nums">
                  Generated {new Date().toLocaleDateString()}
                </span>
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 mt-2 tracking-tight">
                Patient: {brief.patient_summary.name}
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Conditions:{' '}
                {brief.patient_summary.conditions.length > 0
                  ? brief.patient_summary.conditions.join(', ')
                  : 'None selected'}
              </p>
            </div>
            <div className="sm:text-right text-xs text-slate-400">
              <span className="font-extrabold text-slate-700">Medtrac Unified Records</span>
              {lastVisitDate && <p className="tabular-nums">Chronological review since {lastVisitDate}</p>}
            </div>
          </div>

          {!hasRecords ? (
            <div className="py-10 text-center space-y-3">
              <p className="text-sm font-bold text-slate-700">
                No lab reports or clinical records added yet.
              </p>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Upload your laboratory reports in the Uploads screen to generate your personalized Doctor Brief.
              </p>
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => router.push('/upload')}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-sm transition tap-press"
                >
                  <UploadCloud className="w-4 h-4" />
                  <span>Go to Uploads</span>
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Key Changes Section */}
              <div>
                <div className="flex items-center justify-between mb-2.5">
                  <h3 className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-blue-600" />
                    Key Lab Readings {lastVisitDate ? `Since Last Visit (${lastVisitDate})` : ''}
                  </h3>
                  {isEditing && (
                    <span className="text-[10px] text-blue-600 font-bold bg-blue-50 px-2 py-0.5 rounded-full ring-1 ring-blue-600/20">
                      Editable
                    </span>
                  )}
                </div>

                {brief.key_changes.length > 0 ? (
                  <div className="space-y-2">
                    {brief.key_changes.map((item, idx) => (
                      <div
                        key={idx}
                        className="flex items-start gap-2.5 bg-slate-50/80 p-3.5 rounded-2xl border border-slate-200/80 text-xs text-slate-800 font-medium leading-relaxed"
                      >
                        <span className="w-2 h-2 rounded-full bg-blue-600 mt-1.5 shrink-0 shadow-2xs" />
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
                            className="w-full bg-white px-3 py-1.5 rounded-xl border border-slate-300 outline-none text-xs"
                          />
                        ) : (
                          <span className="tabular-nums">{item}</span>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 italic">No lab readings recorded.</p>
                )}
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
                    className="w-full text-xs text-slate-700 bg-white p-3.5 rounded-2xl border border-slate-300 outline-none leading-relaxed"
                  />
                ) : (
                  <p className="text-xs text-slate-700 leading-relaxed bg-slate-50/80 p-4 rounded-2xl border border-slate-200/80">
                    {brief.trends_summary || 'No trajectory summary available yet.'}
                  </p>
                )}
              </div>

              {/* Two-Column Grid: Medications & Interventions */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                <div className="p-4 rounded-2xl bg-slate-50/80 border border-slate-200/80">
                  <h3 className="text-xs font-black text-slate-700 uppercase tracking-wider mb-2.5">
                    Active Medications
                  </h3>
                  {brief.current_medications.length > 0 ? (
                    <div className="space-y-2 text-xs">
                      {brief.current_medications.map((m, idx) => (
                        <div
                          key={idx}
                          className="flex justify-between items-center text-slate-800 bg-white/80 px-3 py-2 rounded-xl border border-slate-200/60 shadow-2xs"
                        >
                          <span className="font-bold text-slate-900">
                            {m.name} <span className="text-slate-500 font-semibold">{m.dosage}</span>
                          </span>
                          <span className="text-slate-500 text-[11px] font-medium">{m.frequency}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400 italic">No active medications logged.</p>
                  )}
                </div>

                <div className="p-4 rounded-2xl bg-purple-50/40 border border-purple-200/60">
                  <h3 className="text-xs font-black text-purple-900 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-purple-600 inline-block" />
                    Recent Milestones / Life Events
                  </h3>
                  {brief.recent_events.length > 0 ? (
                    <div className="space-y-2 text-xs">
                      {brief.recent_events.map((e, idx) => (
                        <div
                          key={idx}
                          className="flex justify-between items-center text-slate-800 bg-white/80 px-3 py-2 rounded-xl border border-purple-200/60 shadow-2xs"
                        >
                          <span className="font-medium text-slate-900">{e.title}</span>
                          <span className="badge-milestone text-[11px] tabular-nums font-bold">
                            {e.date}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400 italic">No life events logged.</p>
                  )}
                </div>
              </div>

              {/* Suggested Questions to Ask */}
              {brief.questions_to_ask.length > 0 && (
                <div className="p-5 rounded-3xl bg-blue-50/60 border border-blue-200/80 space-y-3 shadow-2xs">
                  <h3 className="text-xs font-black text-blue-950 uppercase tracking-wider flex items-center gap-2">
                    <HelpCircle className="w-4 h-4 text-blue-700" />
                    Suggested Questions to Ask Your {brief.doctor_type}
                  </h3>
                  <ol className="space-y-2 text-xs text-blue-950 list-decimal list-inside font-medium leading-relaxed">
                    {brief.questions_to_ask.map((q, idx) => (
                      <li
                        key={idx}
                        className="bg-white/90 p-2.5 rounded-xl border border-blue-200/60 shadow-2xs"
                      >
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
                          <span className="ml-1 text-slate-800">{q}</span>
                        )}
                      </li>
                    ))}
                  </ol>
                </div>
              )}
            </>
          )}

          {/* Mandatory Disclaimer */}
          <div className="pt-3 border-t border-slate-200/80 text-center text-xs font-semibold text-slate-400">
            {brief.disclaimer}
          </div>
        </div>
      )}
      </>
      )}

      {/* Share Modal with QR Code */}
      {shareModalOpen && shareToken && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="card-depth bg-white rounded-3xl p-6 sm:p-7 max-w-md w-full shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 ring-1 ring-blue-600/20 flex items-center justify-center">
                  <Clock className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-900 text-sm">24-Hour Doctor Share Link</h3>
                  <p className="text-[11px] text-slate-400">Zero-login temporary patient access</p>
                </div>
              </div>
              <button
                onClick={() => setShareModalOpen(false)}
                className="w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center text-sm font-bold transition tap-press"
              >
                &times;
              </button>
            </div>

            <p className="text-xs text-slate-500 leading-relaxed">
              Your doctor can open this link on their mobile or desktop without login or app install. Valid for 24 hours.
            </p>

            {/* QR Code */}
            <div className="p-5 bg-slate-50/90 rounded-2xl flex flex-col items-center justify-center border border-slate-200/80 shadow-2xs">
              <div className="bg-white p-3 rounded-2xl shadow-xs border border-slate-200/60">
                <QRCodeSVG value={shareUrl} size={150} level="M" />
              </div>
              <p className="text-[11px] text-slate-500 mt-2.5 font-medium">Scan with camera to view immediately</p>
            </div>

            {/* Link Copy Box */}
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={shareUrl}
                className="flex-1 px-3 py-2.5 bg-slate-100/90 rounded-xl text-xs font-mono text-slate-700 outline-none border border-slate-200/80"
              />
              <button
                onClick={copyToClipboard}
                className="p-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white transition tap-press shadow-2xs shrink-0"
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
                className="text-blue-600 hover:text-blue-700 flex items-center gap-1 font-bold tap-press"
              >
                Open preview <ExternalLink className="w-3.5 h-3.5" />
              </a>

              <button
                onClick={handleRevoke}
                disabled={isRevoked}
                className="badge-urgent hover:bg-rose-100 text-rose-700 font-bold disabled:opacity-50 transition tap-press"
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
