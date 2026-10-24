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
          {/* Unit Toggle */}
          <div className="inline-flex rounded-2xl bg-slate-200/90 p-1 border border-slate-300 shadow-xs">
            <button
              onClick={() => handleToggleUnit('mg_dl')}
              className={`px-3 py-1.5 text-xs font-bold rounded-xl transition ${
                unitSystem === 'mg_dl'
                  ? 'bg-white text-blue-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              mg/dL (US/India)
            </button>
            <button
              onClick={() => handleToggleUnit('mmol_l')}
              className={`px-3 py-1.5 text-xs font-bold rounded-xl transition ${
                unitSystem === 'mmol_l'
                  ? 'bg-white text-blue-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              mmol/L (UK/UAE)
            </button>
          </div>

          <button
            onClick={() => router.push('/upload')}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs transition shadow-xs"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Upload More</span>
          </button>

          <button
            onClick={() => router.push('/brief')}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-sm transition"
          >
            <span>Doctor Brief</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* The 5 Key Metabolic Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {metricCards.map((metric) => {
          const isSelected = selectedKey === metric.key;
          return (
            <div
              key={metric.key}
              onClick={() => setSelectedKey(metric.key)}
              className={`p-4 rounded-3xl border cursor-pointer transition relative ${
                isSelected
                  ? 'border-blue-600 bg-blue-50/60 shadow-xs ring-2 ring-blue-600'
                  : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-xs'
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider truncate">
                  {metric.config.name}
                </span>
                {metric.latest && (
                  <span
                    className={`text-[9px] font-black px-1.5 py-0.5 rounded-full ${
                      metric.isAbnormal
                        ? 'bg-amber-100 text-amber-900'
                        : 'bg-emerald-100 text-emerald-900'
                    }`}
                  >
                    {metric.isAbnormal ? 'Flagged' : 'Normal'}
                  </span>
                )}
              </div>

              {metric.latest ? (
                <>
                  <div className="flex items-baseline gap-1 mt-1">
                    <span className="text-2xl font-black text-slate-900 tracking-tight">
                      {metric.latest.value}
                    </span>
                    <span className="text-xs font-semibold text-slate-500">
                      {metric.latest.unit}
                    </span>
                  </div>

                  <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100 text-[11px]">
                    {metric.change !== null ? (
                      <span
                        className={`flex items-center font-bold ${
                          metric.change <= 0 ? 'text-emerald-600' : 'text-amber-600'
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
                      <span className="text-slate-400 text-[10px]">Baseline test</span>
                    )}
                    <span className="text-slate-400 text-[9px] truncate max-w-[70px]">
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
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-4 sm:p-6 space-y-4">
        {/* Chart Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-2">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-black text-slate-900">
                {activeConfig.name} Trajectory
              </h2>
              <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-blue-50 text-blue-700">
                {unitSystem === 'mg_dl' ? activeConfig.defaultMgUnit : activeConfig.defaultMmolUnit}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Normal Reference Band: {normalRange.min} - {normalRange.max}{' '}
              {unitSystem === 'mg_dl' ? activeConfig.defaultMgUnit : activeConfig.defaultMmolUnit}
            </p>
          </div>

          <div className="flex items-center gap-3 text-xs font-semibold">
            <span className="flex items-center gap-1.5 text-slate-500">
              <span className="w-3 h-3 rounded-md bg-emerald-100 border border-emerald-400 inline-block" />
              Reference Range
            </span>
            <span className="flex items-center gap-1.5 text-slate-500">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-600 inline-block" />
              Lab Reading
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

        {/* The Aha Moment Milestone Marker */}
        <div className="p-4 rounded-2xl bg-purple-50/80 border border-purple-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-purple-600 text-white flex items-center justify-center shrink-0">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <span className="font-extrabold text-purple-950">
                Cross-Border Trajectory Unlocked:
              </span>
              <p className="text-purple-800 text-[11px] mt-0.5">
                Metropolis Healthcare (Mumbai, Mar 2025 in mg/dL) and Mediclinic (Dubai, Jan 2026 in mmol/L)
                are harmonized on one continuous scale with your Metformin start milestone in between.
              </p>
            </div>
          </div>
        </div>

        {/* Medical Boundary Notice */}
        <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl flex items-start gap-2.5 text-[11px] text-slate-500">
          <Info className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
          <span>
            <strong>Medical Boundary:</strong> Result movements occurring after medication or lifestyle events describe timing (“after” or “concurrent with”), rather than proving clinical treatment causation. Always discuss changes directly with your physician.
          </span>
        </div>
      </div>

      {/* Two Column Layout: Life Events & Medications */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Events Timeline */}
        <div className="bg-white rounded-3xl border border-slate-200 p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-purple-600" />
              <h3 className="font-extrabold text-slate-900 text-xs sm:text-sm">
                Life Events &amp; Milestones
              </h3>
            </div>
            <button
              onClick={() => setShowEventModal(true)}
              className="inline-flex items-center gap-1 text-xs font-bold text-purple-600 hover:text-purple-800"
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
                  className="p-3 rounded-2xl bg-purple-50/50 border border-purple-100 flex items-start gap-3"
                >
                  <div className="w-2.5 h-2.5 rounded-full bg-purple-600 mt-1 shrink-0" />
                  <div className="flex-1">
                    <p className="text-xs font-bold text-slate-900">{evt.title}</p>
                    <p className="text-[10px] text-purple-700 mt-0.5 font-semibold">
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
        <div className="bg-white rounded-3xl border border-slate-200 p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Pill className="w-4 h-4 text-blue-600" />
              <h3 className="font-extrabold text-slate-900 text-xs sm:text-sm">
                Active Medications
              </h3>
            </div>
            <button
              onClick={() => setShowMedModal(true)}
              className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 hover:text-blue-800"
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
                  className="p-3 rounded-2xl bg-blue-50/50 border border-blue-100 flex items-center justify-between"
                >
                  <div>
                    <p className="text-xs font-black text-slate-900">
                      {med.name} <span className="font-medium text-slate-600">({med.dosage})</span>
                    </p>
                    <p className="text-[10px] text-slate-500 mt-0.5">
                      {med.frequency} • Started: {med.start_date}
                    </p>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold">
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
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl">
            <h3 className="text-sm font-extrabold text-slate-900 mb-3">
              Add Timeline Event / Milestone
            </h3>
            <form onSubmit={handleAddEvent} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Event Title
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Switched to Mediterranean diet"
                  value={newEventTitle}
                  onChange={(e) => setNewEventTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs outline-none focus:ring-1 focus:ring-purple-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Category
                </label>
                <select
                  value={newEventCategory}
                  onChange={(e: any) => setNewEventCategory(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs outline-none"
                >
                  <option value="lifestyle">Lifestyle &amp; Diet</option>
                  <option value="medication">Medication Change</option>
                  <option value="diagnosis">Diagnosis</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Date
                </label>
                <input
                  type="date"
                  required
                  value={newEventDate}
                  onChange={(e) => setNewEventDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowEventModal(false)}
                  className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-xl bg-purple-600 text-white text-xs font-bold hover:bg-purple-700 transition"
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
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl">
            <h3 className="text-sm font-extrabold text-slate-900 mb-3">Add Medication</h3>
            <form onSubmit={handleAddMed} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Medicine Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Metformin"
                  value={newMedName}
                  onChange={(e) => setNewMedName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Dosage
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 500mg"
                  value={newMedDose}
                  onChange={(e) => setNewMedDose(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Frequency
                </label>
                <input
                  type="text"
                  placeholder="e.g. Once daily with dinner"
                  value={newMedFreq}
                  onChange={(e) => setNewMedFreq(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Start Date
                </label>
                <input
                  type="date"
                  value={newMedStart}
                  onChange={(e) => setNewMedStart(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs outline-none"
                />
              </div>

              {/* Automatic Timeline Event Checkbox */}
              <div className="p-3 bg-purple-50/70 border border-purple-200 rounded-xl">
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
                  className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-xl bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 transition"
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
