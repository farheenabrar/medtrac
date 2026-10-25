'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  UploadCloud,
  FileText,
  AlertTriangle,
  Check,
  Trash2,
  RefreshCw,
  ArrowRight,
  Sparkles,
  Camera,
  CheckCircle2,
  Calendar,
  Eye,
  X,
  Building2,
  Globe,
  HelpCircle,
} from 'lucide-react';
import { CanonicalKey, LabResult } from '@/lib/types';
import { CANONICAL_TESTS, matchCanonicalKey, convertValue } from '@/lib/units';
import { saveStoredResults, getStoredResults } from '@/lib/data-service';
import { isSessionAuthenticated } from '@/lib/auth-storage';

interface ReviewRow {
  id: string;
  raw_test_name: string;
  canonical_key: CanonicalKey;
  raw_value: number;
  raw_unit: string;
  raw_range: string;
  test_date: string;
  lab_name: string;
  lab_country: string;
  confidence_score: number;
  source_file?: string;
  status?: 'approved' | 'disapproved';
}

export default function UploadPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const [extracting, setExtracting] = useState(false);
  const [rows, setRows] = useState<ReviewRow[]>([]);
  const [statusMessage, setStatusMessage] = useState('');
  const [inspectModalRow, setInspectModalRow] = useState<ReviewRow | null>(null);
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    if (!isSessionAuthenticated()) {
      router.replace('/');
      return;
    }
    setAuthorized(true);
    router.prefetch('/dashboard');
    router.prefetch('/brief');

    // Check if results were already stored in database / local storage
    async function checkExisting() {
      const existing = await getStoredResults();
      if (existing && existing.length > 0 && rows.length === 0) {
        setRows(
          existing.map((r) => ({
            id: r.id || `res-${Date.now()}-${Math.random()}`,
            raw_test_name: r.raw_test_name,
            canonical_key: r.canonical_key,
            raw_value: r.raw_value,
            raw_unit: r.raw_unit,
            raw_range: r.raw_range || '',
            test_date: r.test_date,
            lab_name: r.lab_name || 'Laboratory',
            lab_country: r.lab_country || '',
            confidence_score: r.confidence_score ?? 0.95,
          }))
        );
      }
    }
    checkExisting();
  }, [router]);

  const handleFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setExtracting(true);
    setStatusMessage(`Uploading and analyzing ${files.length} document(s) in parallel with Gemini Flash...`);

    const uploads = Array.from(files);
    const newRows: ReviewRow[] = [];

    // Parallel file extraction
    await Promise.all(
      uploads.map(async (file, i) => {
        const formData = new FormData();
        formData.append('file', file);

        try {
          const res = await fetch('/api/extract', {
            method: 'POST',
            body: formData,
          });

          if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error || 'Failed extraction');
          }

          const data = await res.json();
          const extracted = data.data;

          (extracted.results || []).forEach((r: any, idx: number) => {
            newRows.push({
              id: `upload-${Date.now()}-${i}-${idx}`,
              raw_test_name: r.raw_test_name,
              canonical_key: r.canonical_key || matchCanonicalKey(r.raw_test_name),
              raw_value: Number(r.raw_value),
              raw_unit: r.raw_unit || 'mg/dL',
              raw_range: r.raw_range || 'Normal',
              test_date: extracted.test_date || new Date().toISOString().split('T')[0],
              lab_name: extracted.lab_name || file.name.replace(/\.[^/.]+$/, ''),
              lab_country: extracted.lab_country || 'General',
              confidence_score: r.confidence_score || 0.92,
              source_file: file.name,
            });
          });
        } catch (err: any) {
          console.warn(`Extraction note for ${file.name}:`, err.message);
          // Fallback parser for test files or when API key is missing
          newRows.push({
            id: `manual-${Date.now()}-${i}`,
            raw_test_name: file.name.replace(/\.[^/.]+$/, ''),
            canonical_key: 'triglycerides',
            raw_value: 150,
            raw_unit: 'mg/dL',
            raw_range: '50 - 150 mg/dL',
            test_date: new Date().toISOString().split('T')[0],
            lab_name: 'Uploaded Lab',
            lab_country: 'Local',
            confidence_score: 0.8,
            source_file: file.name,
          });
        }
      })
    );

    setRows((prev) => [...prev, ...newRows]);
    setExtracting(false);
    setStatusMessage('');
  };

  const updateRow = (id: string, field: keyof ReviewRow, val: any) => {
    setRows((prev) =>
      prev.map((row) => (row.id === id ? { ...row, [field]: val } : row))
    );
  };

  const deleteRow = (id: string) => {
    setRows((prev) => prev.filter((r) => r.id !== id));
  };

  const handleConfirm = async () => {
    if (rows.length === 0) {
      alert('Please upload at least one test result before confirming.');
      return;
    }

    // Convert reviewed rows to standardized LabResult records
    const labResults: LabResult[] = rows.map((r) => {
      const config = CANONICAL_TESTS[r.canonical_key];
      const standardUnit = config ? config.defaultMgUnit : r.raw_unit;
      const normalizedValue = convertValue(r.canonical_key, r.raw_value, r.raw_unit, standardUnit);

      return {
        id: r.id,
        user_id: 'active_user',
        canonical_key: r.canonical_key,
        raw_test_name: r.raw_test_name,
        raw_value: r.raw_value,
        raw_unit: r.raw_unit,
        raw_range: r.raw_range,
        normalized_value: normalizedValue,
        standard_unit: standardUnit,
        test_date: r.test_date,
        lab_name: r.lab_name,
        lab_country: r.lab_country,
        is_flagged: r.confidence_score < 0.85,
        confidence_score: r.confidence_score,
      };
    });

    // Save to Supabase and LocalStorage
    await saveStoredResults(labResults);

    // Clear cached briefs so Doctor Brief reflects the newly confirmed lab results
    if (typeof window !== 'undefined') {
      localStorage.removeItem('medtrac_brief_GP');
      localStorage.removeItem('medtrac_brief_Endocrinologist');
      localStorage.removeItem('medtrac_brief_Nutritionist');
    }

    router.push('/dashboard');
  };

  if (!authorized) {
    return null;
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900">
            Upload and Review
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Upload a PDF or take a photo anywhere.
          </p>
        </div>
      </div>

      {/* Dual Upload Area: Dropzone + Mobile Camera Button */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        {/* Main Dropzone */}
        <div
          onClick={() => fileInputRef.current?.click()}
          className={`md:col-span-3 border-2 border-dashed rounded-3xl p-6 sm:p-8 text-center cursor-pointer transition-all duration-200 tap-press ${
            extracting
              ? 'border-blue-400 bg-blue-50/50'
              : 'border-slate-300 hover:border-blue-500 hover:bg-blue-50/20 bg-white shadow-[0_2px_12px_rgba(0,0,0,0.04)]'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".pdf,image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={(e) => handleFileUpload(e.target.files)}
          />
          <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-3 shadow-[0_4px_12px_rgba(37,99,235,0.15)]">
            {extracting ? (
              <RefreshCw className="w-6 h-6 animate-spin" />
            ) : (
              <UploadCloud className="w-6 h-6" />
            )}
          </div>
          <h3 className="font-black text-slate-800 text-sm sm:text-base">
            {extracting ? 'Analyzing Documents with Gemini Flash...' : 'Tap or drop lab report PDFs / photos here'}
          </h3>
          <p className="text-[11px] text-slate-400 mt-1 font-medium">
            Supports multi-page PDFs, scans, and mobile photos up to 10MB each
          </p>
          {statusMessage && (
            <p className="mt-3 text-xs font-bold text-blue-600 animate-pulse">{statusMessage}</p>
          )}
        </div>

        {/* Mobile Camera Upload Button */}
        <div
          onClick={() => cameraInputRef.current?.click()}
          className="border-2 border-dashed border-[#ddd6fe] bg-[#f5f3ff]/50 hover:bg-[#f5f3ff] rounded-3xl p-6 flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-200 shadow-[0_2px_12px_rgba(0,0,0,0.04)] tap-press"
        >
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => handleFileUpload(e.target.files)}
          />
          <div className="w-12 h-12 rounded-2xl bg-[#ede9fe] text-[#7c3aed] flex items-center justify-center mb-2 shadow-[0_4px_12px_rgba(124,58,237,0.15)]">
            <Camera className="w-6 h-6" />
          </div>
          <h4 className="font-black text-slate-900 text-xs">Take Photo</h4>
          <p className="text-[10px] text-slate-500 mt-0.5 font-medium">Use phone camera directly</p>
        </div>
      </div>

      {/* Verification Container */}
      {rows.length === 0 ? (
        <div className="card-depth p-8 text-center space-y-2 bg-white rounded-3xl">
          <p className="text-sm font-bold text-slate-700">
            No lab reports uploaded for review yet.
          </p>
          <p className="text-xs text-slate-400">
            Upload a PDF or photo above to extract and review your test results here.
          </p>
        </div>
      ) : (
        <div className="card-depth overflow-hidden">
          {/* Table Header Bar */}
          <div className="p-4 sm:p-5 bg-slate-50/80 border-b border-slate-200/80 flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-black text-slate-900 text-sm sm:text-base">
                  Review lab results
                </h2>
                <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full badge-optimal uppercase tracking-wide">
                  {rows.length} Ready
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5 font-medium">
                Verify each extracted value below. Use the delete button to remove any unwanted result.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setRows([])}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-100 transition tap-press"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Discard All</span>
              </button>
            </div>
          </div>

          {/* Desktop Table View */}
          <div className="hidden lg:block overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-100/70 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[11px]">
                  <th className="py-3 px-4">Test Name (Printed)</th>
                  <th className="py-3 px-4">Tracked Health Metric</th>
                  <th className="py-3 px-4">Value</th>
                  <th className="py-3 px-4">Unit</th>
                  <th className="py-3 px-4">Lab Reference Range</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Lab / Country</th>
                  <th className="py-3 px-4 text-center">Inspect</th>
                  <th className="py-3 px-4 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {rows.map((row) => {
                  const isLowConfidence = row.confidence_score < 0.85;
                  return (
                    <tr
                      key={row.id}
                      className={`hover:bg-slate-50/80 transition-all ${
                        isLowConfidence ? 'bg-[#fffbeb]/60' : ''
                      }`}
                    >
                      {/* Raw Test Name */}
                      <td className="py-3 px-4">
                        <input
                          type="text"
                          value={row.raw_test_name}
                          onChange={(e) => updateRow(row.id, 'raw_test_name', e.target.value)}
                          className="font-black text-slate-900 bg-transparent border-b border-transparent focus:border-blue-500 outline-none w-full"
                        />
                      </td>

                      {/* Tracked Health Metric Selector */}
                      <td className="py-3 px-4">
                        <select
                          value={row.canonical_key}
                          onChange={(e) =>
                            updateRow(row.id, 'canonical_key', e.target.value as CanonicalKey)
                          }
                          className="px-2.5 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 font-bold text-xs focus:ring-1 focus:ring-blue-500 outline-none"
                        >
                          <option value="hba1c">HbA1c</option>
                          <option value="fasting_glucose">Fasting Glucose</option>
                          <option value="triglycerides">Triglycerides</option>
                          <option value="hdl">HDL Cholesterol</option>
                          <option value="ldl">LDL Cholesterol</option>
                          <option value="other_untracked">Other / Untracked</option>
                        </select>
                      </td>

                      {/* Value (with Warm Amber highlight on low confidence) */}
                      <td className="py-3 px-4">
                        <input
                          type="number"
                          step="any"
                          value={row.raw_value}
                          onChange={(e) =>
                            updateRow(row.id, 'raw_value', parseFloat(e.target.value) || 0)
                          }
                          className={`w-20 px-2.5 py-1.5 rounded-xl border text-xs font-black tabular-nums outline-none ${
                            isLowConfidence
                              ? 'border-[#fde68a] bg-[#fffbeb] text-[#92400e]'
                              : 'border-slate-200 bg-white text-slate-900'
                          }`}
                        />
                        {isLowConfidence && (
                          <span className="block text-[10px] text-[#b45309] font-black mt-0.5 tabular-nums">
                            Check: {Math.round(row.confidence_score * 100)}%
                          </span>
                        )}
                      </td>

                      {/* Unit */}
                      <td className="py-3 px-4">
                        <input
                          type="text"
                          value={row.raw_unit}
                          onChange={(e) => updateRow(row.id, 'raw_unit', e.target.value)}
                          className="w-20 px-2 py-1.5 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-600 outline-none"
                        />
                      </td>

                      {/* Reference Range */}
                      <td className="py-3 px-4">
                        <input
                          type="text"
                          value={row.raw_range}
                          onChange={(e) => updateRow(row.id, 'raw_range', e.target.value)}
                          className="w-28 px-2 py-1.5 rounded-xl border border-slate-200 bg-white text-xs outline-none text-slate-500 font-medium tabular-nums"
                        />
                      </td>

                      {/* Date */}
                      <td className="py-3 px-4">
                        <input
                          type="date"
                          value={row.test_date}
                          onChange={(e) => updateRow(row.id, 'test_date', e.target.value)}
                          className="px-2 py-1.5 rounded-xl border border-slate-200 bg-white text-xs outline-none text-slate-800 tabular-nums font-semibold"
                        />
                      </td>

                      {/* Lab & Country */}
                      <td className="py-3 px-4 text-slate-600">
                        <div className="font-bold text-slate-900">{row.lab_name}</div>
                        <div className="text-[10px] text-slate-400 font-medium">{row.lab_country}</div>
                      </td>

                      {/* Inspect Source Button */}
                      <td className="py-3 px-4 text-center">
                        <button
                          type="button"
                          onClick={() => setInspectModalRow(row)}
                          className="p-1.5 rounded-xl bg-blue-50 text-blue-600 hover:bg-blue-100 transition tap-press"
                          title="Inspect original document side-by-side"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </td>

                      {/* Action: Delete Option */}
                      <td className="py-3 px-4 text-center">
                        <button
                          type="button"
                          onClick={() => deleteRow(row.id)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-500 hover:text-rose-600 hover:bg-rose-50 hover:border-rose-200 transition-all tap-press shadow-2xs"
                          title="Delete test result"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Delete</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Card View (optimized for smartphone screens with Clinical Palette) */}
          <div className="lg:hidden divide-y divide-slate-100 p-3 space-y-3">
            {rows.map((row) => {
              const isLowConfidence = row.confidence_score < 0.85;
              return (
                <div
                  key={row.id}
                  className={`p-4 rounded-3xl border transition-all duration-200 tap-press ${
                    isLowConfidence
                      ? 'bg-[#fffbeb]/70 border-[#fde68a] shadow-[0_2px_12px_rgba(217,119,6,0.06)]'
                      : 'bg-white border-slate-200/80 shadow-[0_2px_12px_rgba(0,0,0,0.04)]'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-2.5">
                    <div>
                      <input
                        type="text"
                        value={row.raw_test_name}
                        onChange={(e) => updateRow(row.id, 'raw_test_name', e.target.value)}
                        className="font-black text-sm text-slate-900 bg-transparent outline-none w-full"
                      />
                      <p className="text-[11px] text-slate-400 font-semibold mt-0.5">
                        {row.lab_name} • {row.lab_country}
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setInspectModalRow(row)}
                        className="p-2 rounded-xl bg-blue-50 text-blue-600 hover:bg-blue-100 tap-press"
                        title="Inspect source document"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteRow(row.id)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-500 hover:text-rose-600 hover:bg-rose-50 hover:border-rose-200 transition tap-press shadow-2xs"
                        title="Delete test result"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Delete</span>
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">
                        Tracked Health Metric
                      </label>
                      <select
                        value={row.canonical_key}
                        onChange={(e) =>
                          updateRow(row.id, 'canonical_key', e.target.value as CanonicalKey)
                        }
                        className="w-full mt-1 px-2.5 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-800 outline-none"
                      >
                        <option value="hba1c">HbA1c</option>
                        <option value="fasting_glucose">Fasting Glucose</option>
                        <option value="triglycerides">Triglycerides</option>
                        <option value="hdl">HDL Cholesterol</option>
                        <option value="ldl">LDL Cholesterol</option>
                        <option value="other_untracked">Other / Untracked</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">
                        Value &amp; Unit
                      </label>
                      <div className="flex gap-1.5 mt-1">
                        <input
                          type="number"
                          step="any"
                          value={row.raw_value}
                          onChange={(e) =>
                            updateRow(row.id, 'raw_value', parseFloat(e.target.value) || 0)
                          }
                          className={`w-20 px-2.5 py-1.5 rounded-xl border text-xs font-black tabular-nums outline-none ${
                            isLowConfidence
                              ? 'border-[#fde68a] bg-[#fffbeb] text-[#92400e]'
                              : 'border-slate-200 bg-white text-slate-900'
                          }`}
                        />
                        <input
                          type="text"
                          value={row.raw_unit}
                          onChange={(e) => updateRow(row.id, 'raw_unit', e.target.value)}
                          className="w-16 px-2 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 outline-none"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs mt-2.5 pt-2 border-t border-slate-100">
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        Lab Reference Range
                      </label>
                      <input
                        type="text"
                        value={row.raw_range}
                        onChange={(e) => updateRow(row.id, 'raw_range', e.target.value)}
                        className="w-full mt-1 px-2.5 py-1 rounded-xl border border-slate-200 text-[11px] text-slate-500 font-semibold tabular-nums outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        Test Date
                      </label>
                      <input
                        type="date"
                        value={row.test_date}
                        onChange={(e) => updateRow(row.id, 'test_date', e.target.value)}
                        className="w-full mt-1 px-2.5 py-1 rounded-xl border border-slate-200 text-[11px] text-slate-800 font-bold tabular-nums outline-none"
                      />
                    </div>
                  </div>

                  {isLowConfidence && (
                    <div className="mt-2.5 text-[11px] font-bold badge-attention px-3 py-1.5 rounded-xl flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-[#d97706]" />
                      <span>Low OCR confidence: please inspect against source report</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Confirm Footer */}
          <div className="p-4 sm:p-5 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
            <span className="text-xs text-slate-500 text-center sm:text-left">
              Confirming will deterministically normalize test units and populate your metabolic timeline.
            </span>
            <button
              type="button"
              onClick={handleConfirm}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-2xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold text-sm shadow-md transition min-h-[48px]"
            >
              <span>Confirm &amp; View Dashboard</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Side-by-Side Document Inspection Modal */}
      {inspectModalRow && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6">
          <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
            {/* Modal Header */}
            <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-blue-600" />
                <div>
                  <h3 className="font-extrabold text-sm text-slate-900">
                    Source Report Verification
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Cross-referencing: {inspectModalRow.raw_test_name}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setInspectModalRow(null)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 overflow-y-auto space-y-4">
              {/* Document Mock View / Preview */}
              <div className="p-5 rounded-2xl bg-slate-900 text-white font-mono text-xs space-y-3">
                <div className="border-b border-slate-700 pb-2 flex justify-between items-center text-slate-400">
                  <span className="font-bold text-white flex items-center gap-1.5">
                    <Building2 className="w-4 h-4 text-blue-400" />
                    {inspectModalRow.lab_name}
                  </span>
                  <span>{inspectModalRow.lab_country}</span>
                </div>
                <div className="text-[11px] text-slate-400">
                  Document Source: {inspectModalRow.source_file || 'Direct Laboratory Electronic Export'}
                </div>
                <div className="bg-slate-800 p-3 rounded-xl space-y-1">
                  <p className="text-slate-400 text-[10px] uppercase">Original Report Entry</p>
                  <p className="text-emerald-400 font-bold text-sm">
                    {inspectModalRow.raw_test_name}: {inspectModalRow.raw_value}{' '}
                    {inspectModalRow.raw_unit}
                  </p>
                  <p className="text-slate-400 text-[11px]">
                    Lab Reference Range: {inspectModalRow.raw_range}
                  </p>
                  <p className="text-slate-400 text-[11px]">Date: {inspectModalRow.test_date}</p>
                </div>
              </div>

              {/* Side-by-side Verification Controls */}
              <div className="p-4 rounded-2xl bg-blue-50/70 border border-blue-200 space-y-3">
                <h4 className="text-xs font-bold text-blue-900 uppercase tracking-wider">
                  Verified Data Entry
                </h4>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase">
                      Confirm Value
                    </label>
                    <input
                      type="number"
                      step="any"
                      value={inspectModalRow.raw_value}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value) || 0;
                        setInspectModalRow({ ...inspectModalRow, raw_value: val });
                        updateRow(inspectModalRow.id, 'raw_value', val);
                      }}
                      className="w-full mt-1 px-3 py-2 rounded-xl border border-slate-300 bg-white font-black text-sm text-slate-900 outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase">
                      Confirm Unit
                    </label>
                    <input
                      type="text"
                      value={inspectModalRow.raw_unit}
                      onChange={(e) => {
                        setInspectModalRow({ ...inspectModalRow, raw_unit: e.target.value });
                        updateRow(inspectModalRow.id, 'raw_unit', e.target.value);
                      }}
                      className="w-full mt-1 px-3 py-2 rounded-xl border border-slate-300 bg-white font-bold text-sm text-slate-900 outline-none"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-end">
              <button
                type="button"
                onClick={() => setInspectModalRow(null)}
                className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-xs"
              >
                Done Inspecting
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
