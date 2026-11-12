import React, { useState, useEffect, useRef } from 'react';
import {
  UploadCloud,
  FileText,
  CheckCircle2,
  AlertTriangle,
  ZoomIn,
  ZoomOut,
  RotateCw,
  ShieldCheck,
  Lock,
} from 'lucide-react';
import { api } from '../../services/api';
import {
  CommunityPrescriptionScan,
  ItemConfirmPayload,
} from '../../types/community';
import { Button } from '../common/Button';

// Synthetic sample prescriptions for immediate testing
const SAMPLE_PRESCRIPTIONS = [
  {
    name: 'Ridge Hospital OPD Slip (Bacterial Infection)',
    rawText:
      'Ridge Regional Hospital — OPD Consultation Slip\n' +
      'Patient: PT-SYN-001 | Age: 34y | Gender: Female\n' +
      'Rx: Amoxicillin/Clavulanic Acid 625mg tabs\n' +
      'Sig: 1 tab orally BID for 7 days\n' +
      'Rx: Paracetamol 500mg tablets\n' +
      'Sig: 2 tabs TID for 3 days as needed for pain\n' +
      'Dr. K. Mensah, MBChB, FWACP',
  },
  {
    name: 'Korle Bu PolyClinic Slip (Syndromic GI/RTI)',
    rawText:
      'Korle Bu Teaching Hospital — PolyClinic OPD\n' +
      'Patient: PT-SYN-002 | Age: 42y | Gender: Male\n' +
      'Rx: Ciprofloxacin 500mg tablets\n' +
      'Sig: 1 tab po BID for 5 days\n' +
      'Rx: Metronidazole 400mg tablets\n' +
      'Sig: 1 tab TID for 5 days with meals\n' +
      'Dr. A. Osei-Tutu, MBChB',
  },
  {
    name: 'LEKMA Hospital (Uncomplicated Malaria)',
    rawText:
      'LEKMA Hospital OPD Slip\n' +
      'Patient: PT-SYN-003 | Age: 26y | Gender: Female | mRDT: Positive\n' +
      'Rx: Artemether/Lumefantrine 20/120mg tabs\n' +
      'Sig: 4 tabs BID for 3 days with milk\n' +
      'Rx: Oral Rehydration Salts 20.5g sachet\n' +
      'Sig: 1 sachet daily in 1L water for 2 days\n' +
      'Dr. E. Addo, MBChB',
  },
];

export const PrescriptionScannerStudio: React.FC = () => {
  const [scans, setScans] = useState<CommunityPrescriptionScan[]>([]);
  const [activeScan, setActiveScan] = useState<CommunityPrescriptionScan | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Image Viewer Transform State
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [rotation, setRotation] = useState<number>(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Editable 7-Field Confirmation Form State per item
  const [confirmedItems, setConfirmedItems] = useState<Record<string, ItemConfirmPayload>>({});
  const [pharmacistNotes, setPharmacistNotes] = useState<string>('');

  const loadScans = async () => {
    setIsLoading(true);
    try {
      const data = await api.community.listPrescriptions();
      setScans(data);
      if (data.length > 0 && !activeScan) {
        selectScan(data[0]);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to load prescription scans.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadScans();
  }, []);

  const selectScan = (scan: CommunityPrescriptionScan) => {
    setActiveScan(scan);
    setErrorMessage(null);
    setSuccessMessage(null);
    setPharmacistNotes(scan.pharmacist_review_notes || '');

    // Initialize 7-field confirmation state from OCR extractions
    const initialConfirmed: Record<string, ItemConfirmPayload> = {};
    scan.items.forEach((item) => {
      initialConfirmed[item.id] = {
        item_id: item.id,
        confirmed_drug_name: item.confirmed_drug_name || item.ocr_drug_name,
        confirmed_strength: item.confirmed_strength || item.ocr_strength || '500mg',
        confirmed_dosage_form: item.confirmed_dosage_form || item.ocr_dosage_form || 'Tablet',
        confirmed_dose_amount: item.confirmed_dose_amount || item.ocr_dose_amount || 1.0,
        confirmed_dose_unit: item.confirmed_dose_unit || item.ocr_dose_unit || 'mg',
        confirmed_route: item.confirmed_route || item.ocr_route || 'Oral',
        confirmed_frequency: item.confirmed_frequency || item.ocr_frequency || 'BID',
        confirmed_duration_days: item.confirmed_duration_days || item.ocr_duration_days || 5,
        confirmed_instructions: item.confirmed_instructions || '',
        legal_category: item.legal_category || 'POM',
      };
    });
    setConfirmedItems(initialConfirmed);
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    setErrorMessage(null);
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64Data = reader.result as string;
        const scan = await api.community.uploadPrescription({
          filename: file.name,
          content_type: file.type || 'image/jpeg',
          image_base64: base64Data,
          patient_identifier: 'PT-SCAN-' + Math.floor(1000 + Math.random() * 9000),
        });
        setScans((prev) => [scan, ...prev]);
        selectScan(scan);
        setSuccessMessage('Prescription uploaded and processed via OCR engine.');
      };
      reader.readAsDataURL(file);
    } catch (err: any) {
      setErrorMessage(err.message || 'Prescription upload failed.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSampleUpload = async (sampleIndex: number) => {
    const sample = SAMPLE_PRESCRIPTIONS[sampleIndex];
    setIsProcessing(true);
    setErrorMessage(null);
    try {
      const scan = await api.community.uploadPrescription({
        filename: `${sample.name.split(' ')[0].toLowerCase()}_slip.jpg`,
        content_type: 'image/jpeg',
        image_base64: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400"><rect width="600" height="400" fill="#0f172a"/><text x="20" y="40" fill="#38bdf8" font-size="16">GHANA HEALTH SERVICE PRESCRIPTION SLIP</text></svg>',
        patient_identifier: 'PT-SYN-' + Math.floor(1000 + Math.random() * 9000),
        raw_text_override: sample.rawText,
      });
      setScans((prev) => [scan, ...prev]);
      selectScan(scan);
      setSuccessMessage(`Sample "${sample.name}" parsed successfully.`);
    } catch (err: any) {
      setErrorMessage(err.message || 'Sample processing failed.');
    } finally {
      setIsProcessing(false);
    }
  };

  const updateField = (itemId: string, fieldName: keyof ItemConfirmPayload, value: any) => {
    setConfirmedItems((prev) => ({
      ...prev,
      [itemId]: {
        ...prev[itemId],
        [fieldName]: value,
      },
    }));
  };

  const handleConfirmHumanGate = async () => {
    if (!activeScan) return;
    setIsProcessing(true);
    setErrorMessage(null);
    try {
      const itemsPayload = Object.values(confirmedItems);
      const updatedScan = await api.community.confirmPrescriptionGate(activeScan.id, {
        items: itemsPayload,
        pharmacist_review_notes: pharmacistNotes,
      });
      setActiveScan(updatedScan);
      setScans((prev) => prev.map((s) => (s.id === updatedScan.id ? updatedScan : s)));
      setSuccessMessage('7-Field Human Confirmation Gate locked successfully. Prescription ready for dispensing.');
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to confirm prescription fields.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDispense = async () => {
    if (!activeScan) return;
    setIsProcessing(true);
    setErrorMessage(null);
    try {
      const updatedScan = await api.community.dispensePrescription(activeScan.id);
      setActiveScan(updatedScan);
      setScans((prev) => prev.map((s) => (s.id === updatedScan.id ? updatedScan : s)));
      setSuccessMessage('Prescription marked as DISPENSED. Encounter completed.');
    } catch (err: any) {
      setErrorMessage(err.message || 'Dispensing failed.');
    } finally {
      setIsProcessing(false);
    }
  };

  const renderConfidenceBadge = (confidence: number) => {
    const pct = Math.round(confidence * 100);
    if (confidence >= 0.85) {
      return (
        <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-950/80 text-emerald-300 border border-emerald-600/50 font-mono font-medium">
          {pct}% OCR
        </span>
      );
    }
    return (
      <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-950/80 text-amber-300 border border-amber-600/50 font-mono font-medium flex items-center gap-1">
        <AlertTriangle className="w-2.5 h-2.5 text-amber-400" />
        {pct}% Review Required
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Sub-Bar */}
      <div className="bg-slate-800/90 border border-slate-700/80 rounded-xl p-5 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded text-xs font-bold uppercase tracking-wider bg-sky-950 text-sky-400 border border-sky-800">
                Workflow B (Phase 3)
              </span>
              <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
                Prescription Scanner & 7-Field Human Confirmation Gate
              </h1>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Statutory verification of paper/digital prescription slips under Act 857.
              Mandatory pharmacist confirmation of all 7 core clinical fields before dispensing.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept="image/*,.pdf"
              className="hidden"
            />
            <Button
              variant="primary"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              icon={<UploadCloud className="w-4 h-4" />}
              disabled={isProcessing}
            >
              Upload Prescription Slip
            </Button>
          </div>
        </div>

        {/* Quick Sample Presets */}
        <div className="mt-4 pt-3 border-t border-slate-700/80 flex flex-wrap items-center gap-2">
          <span className="text-xs text-slate-400 font-medium">Quick Ghana Samples:</span>
          {SAMPLE_PRESCRIPTIONS.map((sample, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => handleSampleUpload(idx)}
              disabled={isProcessing}
              className="text-xs px-2.5 py-1 rounded bg-slate-900/90 text-sky-300 border border-slate-700 hover:border-sky-500 transition-colors"
            >
              + {sample.name.split(' (')[0]}
            </button>
          ))}
          {isLoading && (
            <span className="text-xs text-slate-400 italic ml-2">Loading scans...</span>
          )}
        </div>

        {/* Existing Scans Queue Selector */}
        {scans.length > 0 && (
          <div className="mt-3 pt-3 border-t border-slate-750 flex flex-wrap items-center gap-2">
            <span className="text-xs text-slate-400 font-medium">Loaded Slips ({scans.length}):</span>
            {scans.map((scan) => (
              <button
                key={scan.id}
                type="button"
                onClick={() => selectScan(scan)}
                className={`text-xs px-2 py-0.5 rounded border transition-colors ${
                  activeScan?.id === scan.id
                    ? 'bg-sky-950/80 text-sky-300 border-sky-600 font-medium'
                    : 'bg-slate-900/70 text-slate-400 border-slate-700 hover:text-slate-200'
                }`}
              >
                {scan.scan_number} ({scan.status})
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Notifications */}
      {errorMessage && (
        <div className="p-3.5 rounded-lg bg-rose-950/80 border border-rose-600 text-rose-200 text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}
      {successMessage && (
        <div className="p-3.5 rounded-lg bg-emerald-950/80 border border-emerald-600 text-emerald-200 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Main Split-Screen Workstation */}
      {activeScan ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Panel: Prescription Slip Image & OCR Text Viewer (5 cols) */}
          <div className="lg:col-span-5 space-y-4">
            <div className="bg-slate-800/80 border border-slate-700/80 rounded-xl p-4 shadow-sm flex flex-col h-full">
              <div className="border-b border-slate-700 pb-3 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <FileText className="w-4 h-4 text-sky-400" />
                    Prescription Slip Visual
                  </h3>
                  <span className="text-[11px] text-slate-400">{activeScan.original_filename}</span>
                </div>

                {/* Zoom & Rotation Controls */}
                <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-lg border border-slate-700">
                  <button
                    type="button"
                    onClick={() => setZoomLevel((z) => Math.min(z + 0.25, 2.5))}
                    title="Zoom In"
                    className="p-1 text-slate-400 hover:text-white"
                  >
                    <ZoomIn className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setZoomLevel((z) => Math.max(z - 0.25, 0.5))}
                    title="Zoom Out"
                    className="p-1 text-slate-400 hover:text-white"
                  >
                    <ZoomOut className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setZoomLevel(1);
                      setRotation(0);
                    }}
                    title="Reset"
                    className="p-1 text-slate-400 hover:text-white text-[10px] font-mono px-1"
                  >
                    1:1
                  </button>
                  <button
                    type="button"
                    onClick={() => setRotation((r) => (r + 90) % 360)}
                    title="Rotate 90deg"
                    className="p-1 text-slate-400 hover:text-white"
                  >
                    <RotateCw className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Visual Canvas */}
              <div className="flex-1 min-h-[320px] bg-slate-950 rounded-lg my-3 border border-slate-900 overflow-hidden relative flex items-center justify-center p-4">
                <div
                  style={{
                    transform: `scale(${zoomLevel}) rotate(${rotation}deg)`,
                    transition: 'transform 0.15s ease-out',
                  }}
                  className="max-w-full max-h-[380px] p-4 bg-slate-900 rounded border border-slate-800 shadow-xl font-mono text-xs text-slate-200 select-text"
                >
                  <div className="border-b border-slate-700 pb-2 mb-2 flex items-center justify-between text-[11px] text-sky-400 font-bold">
                    <span>GHANA HEALTH SERVICE PRESCRIPTION</span>
                    <span>{activeScan.scan_number}</span>
                  </div>
                  <pre className="whitespace-pre-wrap font-sans text-xs text-slate-300 leading-relaxed">
                    {activeScan.extracted_raw_text || 'No raw text extracted.'}
                  </pre>
                </div>
              </div>

              {/* Confidence Summary Banner */}
              <div className="p-3 rounded-lg bg-slate-900/90 border border-slate-700 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="text-slate-400">OCR Confidence:</span>
                  <span className="font-mono font-bold text-white">
                    {Math.round(activeScan.overall_confidence * 100)}%
                  </span>
                </div>
                {activeScan.low_confidence_flag ? (
                  <span className="text-amber-400 flex items-center gap-1 font-medium text-[11px]">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    Uncertainty Flag Active (&lt;85%)
                  </span>
                ) : (
                  <span className="text-emerald-400 flex items-center gap-1 font-medium text-[11px]">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    High Extraction Confidence
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Right Panel: Mandatory 7-Field Human Confirmation Gate (7 cols) */}
          <div className="lg:col-span-7 space-y-4">
            <div className="bg-slate-800/80 border border-slate-700/80 rounded-xl p-5 shadow-sm space-y-5">
              <div className="border-b border-slate-700 pb-3 flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-bold uppercase tracking-wider text-white flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    Mandatory 7-Field Human Confirmation Gate
                  </h2>
                  <span className="text-xs text-slate-400">
                    Reviewing Pharmacist must explicitly confirm all 7 core fields for each item
                  </span>
                </div>

                <span
                  className={`text-xs font-mono px-2.5 py-1 rounded font-bold uppercase border ${
                    activeScan.status === 'HUMAN_CONFIRMED'
                      ? 'bg-emerald-950 text-emerald-300 border-emerald-600'
                      : activeScan.status === 'DISPENSED'
                      ? 'bg-blue-950 text-blue-300 border-blue-600'
                      : 'bg-amber-950 text-amber-300 border-amber-600'
                  }`}
                >
                  {activeScan.status}
                </span>
              </div>

              {/* Items List */}
              <div className="space-y-4">
                {activeScan.items.map((item, idx) => {
                  const form = confirmedItems[item.id] || {
                    item_id: item.id,
                    confirmed_drug_name: item.ocr_drug_name,
                    confirmed_strength: item.ocr_strength || '500mg',
                    confirmed_dosage_form: item.ocr_dosage_form || 'Tablet',
                    confirmed_dose_amount: item.ocr_dose_amount || 1.0,
                    confirmed_dose_unit: item.ocr_dose_unit || 'mg',
                    confirmed_route: item.ocr_route || 'Oral',
                    confirmed_frequency: item.ocr_frequency || 'BID',
                    confirmed_duration_days: item.ocr_duration_days || 5,
                    legal_category: item.legal_category || 'POM',
                  };

                  return (
                    <div
                      key={item.id}
                      className="bg-slate-900/90 border border-slate-700 rounded-xl p-4 space-y-3"
                    >
                      <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                        <span className="text-xs font-bold text-sky-400">
                          Medication Item #{idx + 1}
                        </span>
                        <div className="flex items-center gap-2">
                          {renderConfidenceBadge(item.confidence_drug_name)}
                          <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700 font-mono">
                            Act 857: {form.legal_category}
                          </span>
                        </div>
                      </div>

                      {/* The 7 Core Clinical Fields Form */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                        {/* 1. Drug Name */}
                        <div className="sm:col-span-2 space-y-1">
                          <label className="text-[11px] font-semibold text-slate-300 flex items-center justify-between">
                            <span>1. Drug Name *</span>
                            {renderConfidenceBadge(item.confidence_drug_name)}
                          </label>
                          <input
                            type="text"
                            value={form.confirmed_drug_name}
                            onChange={(e) => updateField(item.id, 'confirmed_drug_name', e.target.value)}
                            disabled={activeScan.status === 'DISPENSED'}
                            className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded text-white font-medium focus:border-sky-500"
                          />
                        </div>

                        {/* 2. Strength */}
                        <div className="space-y-1">
                          <label className="text-[11px] font-semibold text-slate-300 flex items-center justify-between">
                            <span>2. Strength *</span>
                            {renderConfidenceBadge(item.confidence_strength)}
                          </label>
                          <input
                            type="text"
                            value={form.confirmed_strength}
                            onChange={(e) => updateField(item.id, 'confirmed_strength', e.target.value)}
                            disabled={activeScan.status === 'DISPENSED'}
                            className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded text-white font-medium focus:border-sky-500"
                          />
                        </div>

                        {/* 3. Formulation */}
                        <div className="space-y-1">
                          <label className="text-[11px] font-semibold text-slate-300 flex items-center justify-between">
                            <span>3. Formulation *</span>
                            {renderConfidenceBadge(item.confidence_dosage_form)}
                          </label>
                          <select
                            value={form.confirmed_dosage_form}
                            onChange={(e) => updateField(item.id, 'confirmed_dosage_form', e.target.value)}
                            disabled={activeScan.status === 'DISPENSED'}
                            className="w-full px-2 py-1.5 bg-slate-950 border border-slate-700 rounded text-white font-medium focus:border-sky-500"
                          >
                            <option value="Tablet">Tablet</option>
                            <option value="Capsule">Capsule</option>
                            <option value="Syrup">Syrup</option>
                            <option value="Suspension">Suspension</option>
                            <option value="Sachet">Sachet</option>
                            <option value="Injection">Injection</option>
                            <option value="Ointment">Ointment</option>
                          </select>
                        </div>

                        {/* 4. Dose Amount */}
                        <div className="space-y-1">
                          <label className="text-[11px] font-semibold text-slate-300 flex items-center justify-between">
                            <span>4. Dose *</span>
                            {renderConfidenceBadge(item.confidence_dose)}
                          </label>
                          <input
                            type="number"
                            step="0.5"
                            value={form.confirmed_dose_amount}
                            onChange={(e) => updateField(item.id, 'confirmed_dose_amount', parseFloat(e.target.value) || 1)}
                            disabled={activeScan.status === 'DISPENSED'}
                            className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded text-white font-medium focus:border-sky-500"
                          />
                        </div>

                        {/* 5. Route */}
                        <div className="space-y-1">
                          <label className="text-[11px] font-semibold text-slate-300 flex items-center justify-between">
                            <span>5. Route *</span>
                            {renderConfidenceBadge(item.confidence_route)}
                          </label>
                          <select
                            value={form.confirmed_route}
                            onChange={(e) => updateField(item.id, 'confirmed_route', e.target.value)}
                            disabled={activeScan.status === 'DISPENSED'}
                            className="w-full px-2 py-1.5 bg-slate-950 border border-slate-700 rounded text-white font-medium focus:border-sky-500"
                          >
                            <option value="Oral">Oral</option>
                            <option value="Injection">Injection</option>
                            <option value="Topical">Topical</option>
                            <option value="Rectal">Rectal</option>
                            <option value="Inhalation">Inhalation</option>
                          </select>
                        </div>

                        {/* 6. Frequency */}
                        <div className="space-y-1">
                          <label className="text-[11px] font-semibold text-slate-300 flex items-center justify-between">
                            <span>6. Frequency *</span>
                            {renderConfidenceBadge(item.confidence_frequency)}
                          </label>
                          <select
                            value={form.confirmed_frequency}
                            onChange={(e) => updateField(item.id, 'confirmed_frequency', e.target.value)}
                            disabled={activeScan.status === 'DISPENSED'}
                            className="w-full px-2 py-1.5 bg-slate-950 border border-slate-700 rounded text-white font-medium focus:border-sky-500"
                          >
                            <option value="Daily">Daily (Once daily)</option>
                            <option value="BID">BID (Twice daily)</option>
                            <option value="TID">TID (Three times daily)</option>
                            <option value="QID">QID (Four times daily)</option>
                            <option value="PRN">PRN (As needed)</option>
                          </select>
                        </div>

                        {/* 7. Duration */}
                        <div className="space-y-1">
                          <label className="text-[11px] font-semibold text-slate-300 flex items-center justify-between">
                            <span>7. Duration (Days) *</span>
                            {renderConfidenceBadge(item.confidence_duration)}
                          </label>
                          <input
                            type="number"
                            min="1"
                            value={form.confirmed_duration_days}
                            onChange={(e) => updateField(item.id, 'confirmed_duration_days', parseInt(e.target.value) || 1)}
                            disabled={activeScan.status === 'DISPENSED'}
                            className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded text-white font-medium focus:border-sky-500"
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Pharmacist Review Notes & Legal Sign-Off */}
              <div className="space-y-2 pt-2 border-t border-slate-700">
                <label className="block text-xs font-semibold text-slate-300">
                  Pharmacist Verification & Clinical Sign-Off Notes:
                </label>
                <textarea
                  rows={2}
                  value={pharmacistNotes}
                  onChange={(e) => setPharmacistNotes(e.target.value)}
                  placeholder="Document visual cross-check against physical prescription slip..."
                  disabled={activeScan.status === 'DISPENSED'}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-md text-xs text-white"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-slate-700">
                <div className="text-xs text-slate-400">
                  {activeScan.status === 'PENDING_REVIEW' && (
                    <span className="text-amber-400 font-medium flex items-center gap-1">
                      <Lock className="w-3.5 h-3.5" />
                      Dispensing blocked pending 7-Field confirmation
                    </span>
                  )}
                  {activeScan.status === 'HUMAN_CONFIRMED' && (
                    <span className="text-emerald-400 font-medium flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Confirmed by {activeScan.pharmacist_confirmed_by || 'Pharmacist'}
                    </span>
                  )}
                  {activeScan.status === 'DISPENSED' && (
                    <span className="text-blue-400 font-medium flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Prescription Dispensed
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  {activeScan.status === 'PENDING_REVIEW' && (
                    <Button
                      variant="primary"
                      onClick={handleConfirmHumanGate}
                      disabled={isProcessing}
                      icon={<ShieldCheck className="w-4 h-4" />}
                    >
                      Confirm & Lock 7-Field Gate
                    </Button>
                  )}

                  {activeScan.status === 'HUMAN_CONFIRMED' && (
                    <Button
                      variant="primary"
                      onClick={handleDispense}
                      disabled={isProcessing}
                      icon={<CheckCircle2 className="w-4 h-4" />}
                    >
                      Record Dispensing & Complete
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-slate-800/80 border border-slate-700/80 rounded-xl p-12 text-center space-y-4">
          <FileText className="w-12 h-12 text-slate-500 mx-auto" />
          <h3 className="text-base font-bold text-white">No Prescription Scans Selected</h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            Upload a prescription image or select a Ghana sample preset above to activate the OCR extraction
            and 7-Field Human Confirmation Gate.
          </p>
        </div>
      )}
    </div>
  );
};

