'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceArea,
  ReferenceLine,
} from 'recharts';
import {
  Activity,
  Plus,
  ArrowUpRight,
  ArrowDownRight,
  Calendar,
  Pill,
  Sparkles,
  ArrowRight,
  Upload,
  AlertCircle,
  FileCheck,
  CheckCircle,
  Info,
  ShieldAlert,
  Clock,
} from 'lucide-react';
import { CanonicalKey, LabResult, LifeEvent, Medication, UnitSystem, UserProfile } from '@/lib/types';
import { CANONICAL_TESTS, formatValueForSystem, isAbnormal } from '@/lib/units';
import {
  getStoredResults,
  getStoredEvents,
  getStoredMedications,
  saveStoredEvents,
  saveStoredMedications,
  getStoredProfile,
  saveStoredProfile,
} from '@/lib/data-service';

export default function DashboardPage() {
  const router = useRouter();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [results, setResults] = useState<LabResult[]>([]);
  const [events, setEvents] = useState<LifeEvent[]>([]);
  const [medications, setMedications] = useState<Medication[]>([]);
  const [selectedKey, setSelectedKey] = useState<CanonicalKey>('triglycerides');
  const [unitSystem, setUnitSystem] = useState<UnitSystem>('mg_dl');

  // Modals
  const [showEventModal, setShowEventModal] = useState(false);
  const [showMedModal, setShowMedModal] = useState(false);
  const [newEventTitle, setNewEventTitle] = useState('');
  const [newEventDate, setNewEventDate] = useState('');
  const [newEventCategory, setNewEventCategory] = useState<'medication' | 'lifestyle' | 'diagnosis' | 'other'>('lifestyle');

  const [newMedName, setNewMedName] = useState('');
  const [newMedDose, setNewMedDose] = useState('');
  const [newMedFreq, setNewMedFreq] = useState('');
  const [newMedStart, setNewMedStart] = useState('');
  const [autoAddEvent, setAutoAddEvent] = useState(true);

  // Load data on mount
  useEffect(() => {
    async function loadAll() {
      const p = await getStoredProfile();
      if (p) {
        setProfile(p);
        if (p.preferred_unit) setUnitSystem(p.preferred_unit);
      }

      const res = await getStoredResults();
      if (res && res.length > 0) {
        setResults(res);
      } else {
        router.push('/upload');
      }

      const evts = await getStoredEvents();
      if (evts) setEvents(evts);

      const meds = await getStoredMedications();
      if (meds) setMedications(meds);
    }
    loadAll();
  }, [router]);

  // Unit toggle handler (persists preference)
  const handleToggleUnit = async (newSystem: UnitSystem) => {
    setUnitSystem(newSystem);
    if (profile) {
      const updatedProfile = { ...profile, preferred_unit: newSystem };
      setProfile(updatedProfile);
      await saveStoredProfile(updatedProfile);
    }
  };

  // The 5 key metabolic tests
  const testKeys: CanonicalKey[] = ['triglycerides', 'hba1c', 'fasting_glucose', 'hdl', 'ldl'];

  // Metric card summary calculations
  const getMetricSummary = (key: CanonicalKey) => {
    const matching = results
      .filter((r) => r.canonical_key === key)
      .sort((a, b) => new Date(a.test_date).getTime() - new Date(b.test_date).getTime());

    if (matching.length === 0) {
      return {
        key,
        config: CANONICAL_TESTS[key],
        latest: null,
        previous: null,
        change: null,
        isAbnormal: false,
        rawDetails: '',
      };
    }

    const latest = matching[matching.length - 1];
    // Define "previous" strictly as the latest test strictly before the latest test date
    const previousCandidates = matching.filter(
      (r) => new Date(r.test_date).getTime() < new Date(latest.test_date).getTime()
    );
    const previous =
      previousCandidates.length > 0 ? previousCandidates[previousCandidates.length - 1] : null;

    const formattedLatest = formatValueForSystem(key, latest.raw_value, latest.raw_unit, unitSystem);
    const formattedPrevious = previous
      ? formatValueForSystem(key, previous.raw_value, previous.raw_unit, unitSystem)
      : null;

    // Absolute difference: subtraction (V_latest - V_prev), NOT percentage
    const diff = formattedPrevious ? formattedLatest.value - formattedPrevious.value : null;

    return {
      key,
      config: CANONICAL_TESTS[key],
      latest: formattedLatest,
      previous: formattedPrevious,
      change: diff !== null ? Math.round(diff * 100) / 100 : null,
      isAbnormal: isAbnormal(key, formattedLatest.value, unitSystem),
      rawDetails: `${latest.raw_value} ${latest.raw_unit} (${latest.lab_country || 'Lab'})`,
    };
  };

  const metricCards = testKeys.map(getMetricSummary);

  // Active chart data
  const matchingResults = results
    .filter((r) => r.canonical_key === selectedKey)
    .sort((a, b) => new Date(a.test_date).getTime() - new Date(b.test_date).getTime());

  const chartData = matchingResults.map((r) => {
    const formatted = formatValueForSystem(selectedKey, r.raw_value, r.raw_unit, unitSystem);
    return {
      date: r.test_date,
      value: formatted.value,
      unit: formatted.unit,
      rawLabel: `${r.raw_value} ${r.raw_unit}`,
      lab: `${r.lab_name || 'Lab'} (${r.lab_country || 'Default'})`,
    };
  });

  const activeConfig = CANONICAL_TESTS[selectedKey];
  const normalRange =
    unitSystem === 'mg_dl' ? activeConfig.normalRangeMg : activeConfig.normalRangeMmol;

  // Add Life Event
  const handleAddEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEventTitle || !newEventDate) return;

    const newEvent: LifeEvent = {
      id: `evt-${Date.now()}`,
      user_id: profile?.id || 'active_user',
      title: newEventTitle,
      category: newEventCategory,
      event_date: newEventDate,
    };

    const updated = [...events, newEvent].sort(
      (a, b) => new Date(a.event_date).getTime() - new Date(b.event_date).getTime()
    );
    setEvents(updated);
    await saveStoredEvents(updated);

    setNewEventTitle('');
    setNewEventDate('');
    setShowEventModal(false);
  };

  // Add Medication (with auto timeline event option)
  const handleAddMed = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMedName || !newMedDose) return;

    const startDate = newMedStart || new Date().toISOString().split('T')[0];
    const newMed: Medication = {
      id: `med-${Date.now()}`,
      user_id: profile?.id || 'active_user',
      name: newMedName,
      dosage: newMedDose,
      frequency: newMedFreq || 'Once daily',
      start_date: startDate,
      is_active: true,
    };

    const updatedMeds = [...medications, newMed];
    setMedications(updatedMeds);
    await saveStoredMedications(updatedMeds);

    // If autoAddEvent is checked, automatically create an event on the timeline!
    if (autoAddEvent) {
      const autoEvent: LifeEvent = {
        id: `evt-${Date.now()}`,
        user_id: profile?.id || 'active_user',
        title: `Started ${newMedName} ${newMedDose} (${newMedFreq || 'daily'})`,
        category: 'medication',
        event_date: startDate,
      };
      const updatedEvents = [...events, autoEvent].sort(
        (a, b) => new Date(a.event_date).getTime() - new Date(b.event_date).getTime()
      );
      setEvents(updatedEvents);
      await saveStoredEvents(updatedEvents);
    }

    setNewMedName('');
    setNewMedDose('');
    setNewMedFreq('');
    setNewMedStart('');
    setShowMedModal(false);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner / Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-2xl bg-blue-100 text-blue-700 flex items-center justify-center font-black text-sm">
              3
            </span>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900">
              Metabolic Health Dashboard
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Harmonized trends across your Mumbai, Dubai, and worldwide lab reports.
          </p>
        </div>

        {/* Global Controls & Unit Switcher */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          {/* Unit Toggle with smooth micro-interactions */}
          <div className="inline-flex rounded-2xl bg-slate-100 p-1 border border-slate-200 shadow-xs">
            <button
              onClick={() => handleToggleUnit('mg_dl')}
              className={`px-3 py-1.5 text-xs font-black rounded-xl transition-all tap-press ${
                unitSystem === 'mg_dl'
                  ? 'bg-white text-blue-600 shadow-[0_2px_8px_rgba(0,0,0,0.06)]'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              mg/dL (US/India)
            </button>
            <button
              onClick={() => handleToggleUnit('mmol_l')}
              className={`px-3 py-1.5 text-xs font-black rounded-xl transition-all tap-press ${
                unitSystem === 'mmol_l'
                  ? 'bg-white text-blue-600 shadow-[0_2px_8px_rgba(0,0,0,0.06)]'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              mmol/L (UK/UAE)
            </button>
          </div>

          <button
            onClick={() => router.push('/upload')}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-2xl border border-slate-200/80 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs transition-all shadow-[0_2px_12px_rgba(0,0,0,0.04)] tap-press"
          >
            <Upload className="w-3.5 h-3.5 text-blue-600" />
            <span>Upload More</span>
          </button>

          <button
            onClick={() => router.push('/brief')}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-2xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-black text-xs shadow-[0_4px_12px_rgba(37,99,235,0.25)] transition-all tap-press"
          >
            <span>Doctor Brief</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* The 5 Key Metabolic Metric Cards with Heavy Tabular Numbers & Depth */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {metricCards.map((metric) => {
          const isSelected = selectedKey === metric.key;
          return (
            <div
              key={metric.key}
              onClick={() => setSelectedKey(metric.key)}
              className={`p-4 rounded-3xl border cursor-pointer transition-all duration-200 relative tap-press ${
                isSelected
                  ? 'border-blue-600 bg-blue-50/40 shadow-[0_4px_16px_rgba(37,99,235,0.12)] ring-2 ring-blue-600'
                  : 'border-slate-200/80 bg-white shadow-[0_2px_12px_rgba(0,0,0,0.04)] hover:shadow-[0_8px_24px_rgba(0,0,0,0.06)] hover:border-slate-300'
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider truncate">
                  {metric.config.name}
                </span>
                {metric.latest && (
                  <span
                    className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-wide border ${
                      metric.isAbnormal
                        ? 'badge-attention'
                        : 'badge-optimal'
                    }`}
                  >
                    {metric.isAbnormal ? 'Flagged' : 'Normal'}
                  </span>
                )}
              </div>

              {metric.latest ? (
                <>
                  <div className="flex items-baseline gap-1 mt-1">
                    <span className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight tabular-nums">
                      {metric.latest.value}
                    </span>
                    <span className="text-xs font-semibold text-slate-500">
                      {metric.latest.unit}
                    </span>
                  </div>

                  <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100 text-[11px]">
                    {metric.change !== null ? (
                      <span
                        className={`flex items-center font-bold tabular-nums ${
                          metric.change <= 0 ? 'text-[#059669]' : 'text-[#d97706]'
                        }`}
                        title="Absolute difference from previous test"
                      >
                        {metric.change <= 0 ? (
                          <ArrowDownRight className="w-3.5 h-3.5" />
                        ) : (
                          <ArrowUpRight className="w-3.5 h-3.5" />
                        )}
                        <span>
                          {metric.change > 0 ? `+${metric.change}` : metric.change}{' '}
                          {metric.latest.unit}
                        </span>
                      </span>
                    ) : (
                      <span className="text-slate-400 text-[10px]">Baseline</span>
                    )}
                    <span className="text-slate-400 text-[9px] truncate max-w-[65px]">
                      {metric.rawDetails}
                    </span>
                  </div>
                </>
              ) : (
                <div className="py-3 text-slate-400 text-xs italic">No tests found</div>
              )}
            </div>
          );
        })}
      </div>

      {/* Main Interactive Trend Chart */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-[0_2px_12px_rgba(0,0,0,0.04)] p-4 sm:p-6 space-y-4">
        {/* Chart Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-2">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-black text-slate-900">
                {activeConfig.name} Trajectory
              </h2>
              <span className="text-xs font-black px-2.5 py-0.5 rounded-lg bg-blue-50 text-blue-700 border border-blue-200/60 tabular-nums">
                {unitSystem === 'mg_dl' ? activeConfig.defaultMgUnit : activeConfig.defaultMmolUnit}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5 font-medium">
              Target Range: <span className="tabular-nums font-bold text-slate-700">{normalRange.min} - {normalRange.max}</span>{' '}
              {unitSystem === 'mg_dl' ? activeConfig.defaultMgUnit : activeConfig.defaultMmolUnit}
            </p>
          </div>

          <div className="flex items-center gap-3 text-xs font-semibold">
            <span className="flex items-center gap-1.5 text-slate-600">
              <span className="w-3 h-3 rounded-md bg-[#ecfdf5] border border-[#a7f3d0] inline-block" />
              Target Band
            </span>
            <span className="flex items-center gap-1.5 text-slate-600">
              <span className="w-2.5 h-2.5 rounded-full bg-[#2563eb] shadow-[0_0_8px_rgba(37,99,235,0.4)] inline-block" />
              Lab Reading
            </span>
            <span className="flex items-center gap-1.5 text-slate-600">
              <span className="w-2.5 h-2.5 rounded-full bg-[#7c3aed] shadow-[0_0_8px_rgba(124,58,237,0.4)] inline-block" />
              Milestone Pin
            </span>
          </div>
        </div>

        {/* Chart Canvas */}
        {chartData.length > 0 ? (
          <div className="h-72 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 11 }} />
                <YAxis
                  domain={['dataMin - 15', 'dataMax + 20']}
                  tick={{ fill: '#64748b', fontSize: 11 }}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="bg-slate-900 text-white p-3 rounded-2xl shadow-xl text-xs space-y-1">
                          <p className="font-bold">{data.date}</p>
                          <p className="text-blue-300 font-extrabold text-sm">
                            {data.value} {data.unit}
                          </p>
                          <p className="text-slate-400 text-[10px]">
                            As reported: {data.rawLabel}
                          </p>
                          <p className="text-slate-400 text-[10px]">{data.lab}</p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                {/* Dynamically converted target reference area */}
                <ReferenceArea
                  y1={normalRange.min}
                  y2={normalRange.max}
                  fill="#10b981"
                  fillOpacity={0.12}
                />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke="#2563eb"
                  strokeWidth={3}
                  dot={{ r: 6, fill: '#2563eb', strokeWidth: 2, stroke: '#fff' }}
                  activeDot={{ r: 8 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="h-64 flex items-center justify-center text-slate-400 text-xs italic">
            No lab records found for this metric.
          </div>
        )}

        {/* The Aha Moment Milestone Marker - Royal Violet Palette */}
        <div className="p-4 rounded-3xl bg-[#f5f3ff] border border-[#ddd6fe] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-[#7c3aed] to-[#6d28d9] text-white flex items-center justify-center shrink-0 shadow-[0_4px_12px_rgba(124,58,237,0.3)]">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <span className="font-black text-[#581c87] text-xs sm:text-sm">
                Cross-Border Trajectory Unlocked:
              </span>
              <p className="text-[#6b21a8] text-[11px] mt-0.5 font-medium leading-relaxed">
                Metropolis Healthcare (Mumbai, Mar 2025 in <span className="font-bold tabular-nums">235 mg/dL</span>) and Mediclinic (Dubai, Jan 2026 in <span className="font-bold tabular-nums">1.82 mmol/L</span>)
                are harmonized on one continuous scale with your <span className="font-bold text-[#581c87]">Metformin 500mg</span> milestone pin between them.
              </p>
            </div>
          </div>
        </div>

        {/* Medical Boundary Notice */}
        <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-2xl flex items-start gap-2.5 text-[11px] text-slate-500">
          <Info className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
          <span className="leading-relaxed">
            <strong className="text-slate-700">Medical Boundary:</strong> Result movements occurring after medication or lifestyle events describe timing (“after” or “concurrent with”), rather than proving clinical treatment causation. Always discuss changes directly with your physician.
          </span>
        </div>
      </div>

      {/* Two Column Layout: Life Events & Medications */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Events Timeline */}
        <div className="card-depth p-5 space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-xl bg-[#f5f3ff] text-[#7c3aed] flex items-center justify-center font-bold">
                <Calendar className="w-4 h-4" />
              </div>
              <h3 className="font-black text-slate-900 text-xs sm:text-sm">
                Life Events &amp; Milestones
              </h3>
            </div>
            <button
              onClick={() => setShowEventModal(true)}
              className="inline-flex items-center gap-1 text-xs font-black text-[#7c3aed] hover:text-[#581c87] tap-press"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Event</span>
            </button>
          </div>

          <div className="space-y-2.5">
            {events.length > 0 ? (
              events.map((evt) => (
                <div
                  key={evt.id}
                  className="p-3.5 rounded-2xl bg-[#f5f3ff]/60 border border-[#ddd6fe]/60 flex items-start gap-3 transition-all hover:bg-[#f5f3ff] tap-press"
                >
                  <div className="w-2.5 h-2.5 rounded-full bg-[#7c3aed] shadow-[0_0_6px_rgba(124,58,237,0.5)] mt-1 shrink-0" />
                  <div className="flex-1">
                    <p className="text-xs font-bold text-slate-900">{evt.title}</p>
                    <p className="text-[10px] text-[#7c3aed] mt-0.5 font-bold uppercase tracking-wide tabular-nums">
                      {evt.event_date} • {evt.category}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-xs text-slate-400 italic py-2">No life events added yet.</p>
            )}
          </div>
        </div>

        {/* Medications List */}
        <div className="card-depth p-5 space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                <Pill className="w-4 h-4" />
              </div>
              <h3 className="font-black text-slate-900 text-xs sm:text-sm">
                Active Medications
              </h3>
            </div>
            <button
              onClick={() => setShowMedModal(true)}
              className="inline-flex items-center gap-1 text-xs font-black text-blue-600 hover:text-blue-800 tap-press"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Medicine</span>
            </button>
          </div>

          <div className="space-y-2.5">
            {medications.length > 0 ? (
              medications.map((med) => (
                <div
                  key={med.id}
                  className="p-3.5 rounded-2xl bg-blue-50/50 border border-blue-100/70 flex items-center justify-between transition-all hover:bg-blue-50/80 tap-press"
                >
                  <div>
                    <p className="text-xs font-black text-slate-900">
                      {med.name} <span className="font-bold text-slate-600 tabular-nums">({med.dosage})</span>
                    </p>
                    <p className="text-[10px] text-slate-500 mt-0.5 font-medium tabular-nums">
                      {med.frequency} • Started: {med.start_date}
                    </p>
                  </div>
                  <span className="badge-optimal text-[10px] px-2.5 py-0.5 rounded-full font-black uppercase tracking-wide">
                    Active
                  </span>
                </div>
              ))
            ) : (
              <p className="text-xs text-slate-400 italic py-2">No medications logged.</p>
            )}
          </div>
        </div>
      </div>

      {/* Add Event Modal */}
      {showEventModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="card-depth bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <h3 className="text-sm font-black text-slate-900 mb-3 tracking-tight">
              Add Timeline Event / Milestone
            </h3>
            <form onSubmit={handleAddEvent} className="space-y-3">
              <div>
                <label className="block text-[11px] font-black text-slate-700 uppercase mb-1">
                  Event Title
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Switched to Mediterranean diet"
                  value={newEventTitle}
                  onChange={(e) => setNewEventTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-black text-slate-700 uppercase mb-1">
                  Category
                </label>
                <select
                  value={newEventCategory}
                  onChange={(e: any) => setNewEventCategory(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
                >
                  <option value="lifestyle">Lifestyle &amp; Diet</option>
                  <option value="medication">Medication Change</option>
                  <option value="diagnosis">Diagnosis</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-black text-slate-700 uppercase mb-1">
                  Date
                </label>
                <input
                  type="date"
                  required
                  value={newEventDate}
                  onChange={(e) => setNewEventDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 tabular-nums"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowEventModal(false)}
                  className="px-3.5 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition tap-press"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-xl bg-purple-600 text-white text-xs font-bold hover:bg-purple-700 transition tap-press shadow-2xs"
                >
                  Save Event
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Medication Modal */}
      {showMedModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="card-depth bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <h3 className="text-sm font-black text-slate-900 mb-3 tracking-tight">Add Medication</h3>
            <form onSubmit={handleAddMed} className="space-y-3">
              <div>
                <label className="block text-[11px] font-black text-slate-700 uppercase mb-1">
                  Medicine Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Metformin"
                  value={newMedName}
                  onChange={(e) => setNewMedName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-black text-slate-700 uppercase mb-1">
                  Dosage
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 500mg"
                  value={newMedDose}
                  onChange={(e) => setNewMedDose(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-black text-slate-700 uppercase mb-1">
                  Frequency
                </label>
                <input
                  type="text"
                  placeholder="e.g. Once daily with dinner"
                  value={newMedFreq}
                  onChange={(e) => setNewMedFreq(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-black text-slate-700 uppercase mb-1">
                  Start Date
                </label>
                <input
                  type="date"
                  value={newMedStart}
                  onChange={(e) => setNewMedStart(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 tabular-nums"
                />
              </div>

              {/* Automatic Timeline Event Checkbox */}
              <div className="p-3 bg-purple-50/70 border border-purple-200/80 rounded-2xl">
                <label className="flex items-start gap-2 cursor-pointer text-xs font-semibold text-purple-900">
                  <input
                    type="checkbox"
                    checked={autoAddEvent}
                    onChange={(e) => setAutoAddEvent(e.target.checked)}
                    className="mt-0.5 rounded text-purple-600 focus:ring-purple-500"
                  />
                  <span>
                    Mark medication start as a life event on timeline (avoids entering twice)
                  </span>
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowMedModal(false)}
                  className="px-3.5 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition tap-press"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-xl bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 transition tap-press shadow-2xs"
                >
                  Save Medicine
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
