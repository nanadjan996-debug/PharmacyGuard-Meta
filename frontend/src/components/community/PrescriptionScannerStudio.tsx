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
  User,
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
    name: 'Hospital OPD Slip (Bacterial Infection)',
    rawText:
      'Regional Hospital — OPD Consultation Slip\n' +
      'Patient: PT-SYN-001 | Age: 34y | Gender: Female\n' +
      'Rx: Amoxicillin/Clavulanic Acid 625mg tabs\n' +
      'Sig: 1 tab orally BID for 7 days\n' +
      'Rx: Paracetamol 500mg tablets\n' +
      'Sig: 2 tabs TID for 3 days as needed for pain\n' +
      'Dr. K. Mensah, Prescriber',
  },
  {
    name: 'PolyClinic Slip (Syndromic GI/RTI)',
    rawText:
      'Community PolyClinic — Outpatient Department\n' +
      'Patient: PT-SYN-002 | Age: 42y | Gender: Male\n' +
      'Rx: Ciprofloxacin 500mg tablets\n' +
      'Sig: 1 tab po BID for 5 days\n' +
      'Rx: Metronidazole 400mg tablets\n' +
      'Sig: 1 tab TID for 5 days with meals\n' +
      'Dr. A. Osei-Tutu, Prescriber',
  },
  {
    name: 'District Clinic Slip (Uncomplicated Malaria)',
    rawText:
      'District Clinic Outpatient Slip\n' +
      'Patient: PT-SYN-003 | Age: 26y | Gender: Female | mRDT: Positive\n' +
      'Rx: Artemether/Lumefantrine 20/120mg tabs\n' +
      'Sig: 4 tabs BID for 3 days with milk\n' +
      'Rx: Oral Rehydration Salts 20.5g sachet\n' +
      'Sig: 1 sachet daily in 1L water for 2 days\n' +
      'Dr. E. Addo, Prescriber',
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

  // Manual Slip Text Intake Modal State for Clinical Trials
  const [showTextInputModal, setShowTextInputModal] = useState<boolean>(false);
  const [manualPrescriptionText, setManualPrescriptionText] = useState<string>('');
  const [manualPatientId, setManualPatientId] = useState<string>('');

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

    // Initialize 7-field confirmation state from OCR extractions:
    // Safety Invariant: Low-confidence (<0.85) or missing OCR values do NOT count as confirmed.
    // Missing dose or duration are NOT inferred; pharmacist must manually enter them.
    // Explicit Confirmation Invariant: Even high-confidence OCR extractions start with confirm_* = false;
    // every field requires explicit affirmative pharmacist confirmation before the gate can be locked.
    const initialConfirmed: Record<string, any> = {};
    scan.items.forEach((item) => {
      if (item.is_pharmacist_confirmed) {
        initialConfirmed[item.id] = {
          item_id: item.id,
          confirmed_drug_name: item.confirmed_drug_name || '',
          confirm_drug_name: item.is_drug_name_confirmed ?? true,
          confirmed_strength: item.confirmed_strength || '',
          confirm_strength: item.is_strength_confirmed ?? true,
          confirmed_dosage_form: item.confirmed_dosage_form || 'Tablet',
          confirm_dosage_form: item.is_dosage_form_confirmed ?? true,
          confirmed_dose_amount: item.confirmed_dose_amount ?? '',
          confirm_dose: item.is_dose_confirmed ?? true,
          confirmed_dose_unit: item.confirmed_dose_unit || 'mg',
          confirmed_route: item.confirmed_route || 'Oral',
          confirm_route: item.is_route_confirmed ?? true,
          confirmed_frequency: item.confirmed_frequency || '',
          confirm_frequency: item.is_frequency_confirmed ?? true,
          confirmed_duration_days: item.confirmed_duration_days ?? '',
          confirm_duration: item.is_duration_confirmed ?? true,
          confirmed_instructions: item.confirmed_instructions || '',
          legal_category: item.legal_category || 'POM',
        };
      } else {
        // High confidence (>=0.85) extractions populate candidates; missing or low confidence fields remain blank.
        // All confirm_* flags start as FALSE requiring affirmative confirmation.
        initialConfirmed[item.id] = {
          item_id: item.id,
          confirmed_drug_name:
            item.confidence_drug_name >= 0.85 && item.ocr_drug_name ? item.ocr_drug_name : (item.confirmed_drug_name || ''),
          confirm_drug_name: false,
          confirmed_strength:
            item.confidence_strength >= 0.85 && item.ocr_strength ? item.ocr_strength : (item.confirmed_strength || ''),
          confirm_strength: false,
          confirmed_dosage_form:
            item.confidence_dosage_form >= 0.85 && item.ocr_dosage_form ? item.ocr_dosage_form : (item.confirmed_dosage_form || 'Tablet'),
          confirm_dosage_form: false,
          confirmed_dose_amount:
            item.confidence_dose >= 0.85 && item.ocr_dose_amount !== null && item.ocr_dose_amount !== undefined
              ? item.ocr_dose_amount
              : (item.confirmed_dose_amount ?? ''),
          confirm_dose: false,
          confirmed_dose_unit: item.ocr_dose_unit || 'mg',
          confirmed_route:
            item.confidence_route >= 0.85 && item.ocr_route ? item.ocr_route : (item.confirmed_route || 'Oral'),
          confirm_route: false,
          confirmed_frequency:
            item.confidence_frequency >= 0.85 && item.ocr_frequency ? item.ocr_frequency : (item.confirmed_frequency || ''),
          confirm_frequency: false,
          confirmed_duration_days:
            item.confidence_duration >= 0.85 && item.ocr_duration_days !== null && item.ocr_duration_days !== undefined
              ? item.ocr_duration_days
              : (item.confirmed_duration_days ?? ''),
          confirm_duration: false,
          confirmed_instructions: item.confirmed_instructions || '',
          legal_category: item.legal_category || 'POM',
        };
      }
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
        setScans((prev) => [scan, ...prev.filter((s) => s.id !== scan.id)]);
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
        image_base64: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400"><rect width="600" height="400" fill="#f8fafc"/><rect x="10" y="10" width="580" height="380" fill="#ffffff" stroke="#cbd5e1" stroke-width="2"/><text x="30" y="50" fill="#0f172a" font-size="18" font-family="sans-serif" font-weight="bold">CLINICAL OUTPATIENT PRESCRIPTION SLIP</text><line x1="30" y1="65" x2="570" y2="65" stroke="#0f172a" stroke-width="1.5"/><text x="30" y="100" fill="#334155" font-size="14" font-family="sans-serif">Date: 2026-11-12 | Ref: RX-2026-0849</text><text x="30" y="130" fill="#334155" font-size="14" font-family="sans-serif">Patient: PT-SYN-001 | Age: 34y | Gender: Female</text><text x="30" y="180" fill="#0f172a" font-size="15" font-family="sans-serif" font-weight="bold">Rx 1: Amoxicillin/Clavulanic Acid 625mg tabs</text><text x="60" y="210" fill="#475569" font-size="13" font-family="sans-serif">Sig: 1 tab orally BID for 7 days (Oral)</text><text x="30" y="250" fill="#0f172a" font-size="15" font-family="sans-serif" font-weight="bold">Rx 2: Paracetamol 500mg tablets</text><text x="60" y="280" fill="#475569" font-size="13" font-family="sans-serif">Sig: 2 tabs TID for 3 days as needed for pain (Oral)</text><text x="30" y="340" fill="#64748b" font-size="13" font-family="sans-serif">Prescriber: Licensed Medical Practitioner</text></svg>',
        patient_identifier: 'PT-SYN-' + Math.floor(1000 + Math.random() * 9000),
        raw_text_override: sample.rawText,
      });
      setScans((prev) => [scan, ...prev.filter((s) => s.id !== scan.id)]);
      selectScan(scan);
      setSuccessMessage(`Sample "${sample.name}" parsed successfully.`);
    } catch (err: any) {
      setErrorMessage(err.message || 'Sample processing failed.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleManualTextSubmit = async () => {
    if (!manualPrescriptionText.trim()) {
      setErrorMessage('Please enter prescription slip text.');
      return;
    }
    setIsProcessing(true);
    setErrorMessage(null);
    try {
      const scan = await api.community.uploadPrescription({
        filename: 'counter_transcription.txt',
        content_type: 'text/plain',
        image_base64:
          'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="600" height="200"><rect width="600" height="200" fill="#f8fafc"/><text x="20" y="40" fill="#0f172a" font-size="14" font-family="sans-serif" font-weight="bold">TRANSCRIBED COUNTER PRESCRIPTION SLIP</text></svg>',
        patient_identifier: manualPatientId.trim() || ('PT-COMM-' + Math.floor(1000 + Math.random() * 9000)),
        raw_text_override: manualPrescriptionText.trim(),
      });
      setScans((prev) => [scan, ...prev.filter((s) => s.id !== scan.id)]);
      selectScan(scan);
      setShowTextInputModal(false);
      setManualPrescriptionText('');
      setManualPatientId('');
      setSuccessMessage('Prescription slip text parsed successfully into 7-field confirmation gate.');
    } catch (err: any) {
      setErrorMessage(err.message || 'Prescription parsing failed.');
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

    // Strict validation: Verify all 7 core clinical fields for every item
    for (let i = 0; i < activeScan.items.length; i++) {
      const item = activeScan.items[i];
      const form = confirmedItems[item.id];
      if (!form) {
        setErrorMessage(`Medication Item #${i + 1} has not been filled out.`);
        setIsProcessing(false);
        return;
      }

      const missing: string[] = [];
      if (!form.confirmed_drug_name || form.confirmed_drug_name.trim().length < 2) {
        missing.push('1. Drug Name');
      }
      if (!form.confirmed_strength || form.confirmed_strength.trim().length < 1) {
        missing.push('2. Strength');
      }
      if (!form.confirmed_dosage_form || form.confirmed_dosage_form.trim().length < 2) {
        missing.push('3. Formulation');
      }
      const doseNum =
        typeof form.confirmed_dose_amount === 'number'
          ? form.confirmed_dose_amount
          : parseFloat(form.confirmed_dose_amount);
      if (isNaN(doseNum) || doseNum <= 0) {
        missing.push('4. Dose Amount (must be > 0)');
      }
      if (!form.confirmed_route || form.confirmed_route.trim().length < 2) {
        missing.push('5. Route');
      }
      if (!form.confirmed_frequency || form.confirmed_frequency.trim().length < 1) {
        missing.push('6. Frequency');
      }
      const durNum =
        typeof form.confirmed_duration_days === 'number'
          ? form.confirmed_duration_days
          : parseInt(form.confirmed_duration_days, 10);
      if (isNaN(durNum) || durNum <= 0) {
        missing.push('7. Duration (must be >= 1 day)');
      }

      if (missing.length > 0) {
        setErrorMessage(
          `Validation Gate Blocked: Medication Item #${i + 1} (${form.confirmed_drug_name || 'Unnamed'}) is missing required clinical fields: ${missing.join(', ')}. All 7 core clinical fields must be explicitly supplied and confirmed by the pharmacist.`
        );
        setIsProcessing(false);
        return;
      }

      // Explicit Affirmative Confirmation Check: Every field must be confirmed (confirm_* === true)
      const unconfirmed: string[] = [];
      if (!form.confirm_drug_name) unconfirmed.push('1. Drug Name');
      if (!form.confirm_strength) unconfirmed.push('2. Strength');
      if (!form.confirm_dosage_form) unconfirmed.push('3. Formulation');
      if (!form.confirm_dose) unconfirmed.push('4. Dose Amount');
      if (!form.confirm_route) unconfirmed.push('5. Route');
      if (!form.confirm_frequency) unconfirmed.push('6. Frequency');
      if (!form.confirm_duration) unconfirmed.push('7. Duration');

      if (unconfirmed.length > 0) {
        setErrorMessage(
          `Validation Gate Blocked: Medication Item #${i + 1} (${form.confirmed_drug_name || 'Unnamed'}) has unconfirmed fields: ${unconfirmed.join(', ')}. The reviewing pharmacist must affirmatively confirm each of the 7 clinical fields.`
        );
        setIsProcessing(false);
        return;
      }
    }

    try {
      const itemsPayload: ItemConfirmPayload[] = activeScan.items.map((item) => {
        const form = confirmedItems[item.id];
        return {
          item_id: item.id,
          confirmed_drug_name: form.confirmed_drug_name.trim(),
          confirm_drug_name: !!form.confirm_drug_name,
          confirmed_strength: form.confirmed_strength.trim(),
          confirm_strength: !!form.confirm_strength,
          confirmed_dosage_form: form.confirmed_dosage_form.trim(),
          confirm_dosage_form: !!form.confirm_dosage_form,
          confirmed_dose_amount:
            typeof form.confirmed_dose_amount === 'number'
              ? form.confirmed_dose_amount
              : parseFloat(form.confirmed_dose_amount),
          confirm_dose: !!form.confirm_dose,
          confirmed_dose_unit: form.confirmed_dose_unit || 'mg',
          confirmed_route: form.confirmed_route.trim(),
          confirm_route: !!form.confirm_route,
          confirmed_frequency: form.confirmed_frequency.trim(),
          confirm_frequency: !!form.confirm_frequency,
          confirmed_duration_days:
            typeof form.confirmed_duration_days === 'number'
              ? form.confirmed_duration_days
              : parseInt(form.confirmed_duration_days, 10),
          confirm_duration: !!form.confirm_duration,
          confirmed_instructions: form.confirmed_instructions || '',
          legal_category: form.legal_category || 'POM',
        };
      });

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
        <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-950/80 dark:text-emerald-300 dark:border-emerald-600/50 font-mono font-medium">
          {pct}% OCR
        </span>
      );
    }
    return (
      <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-50 text-amber-900 border border-amber-300 dark:bg-amber-950/80 dark:text-amber-300 dark:border-amber-600/50 font-mono font-medium flex items-center gap-1">
        <AlertTriangle className="w-2.5 h-2.5 text-amber-600 dark:text-amber-400" />
        {pct}% Review Required
      </span>
    );
  };

  const renderFieldConfirmToggle = (
    itemId: string,
    fieldKey: keyof ItemConfirmPayload,
    isConfirmed: boolean,
    label: string
  ) => (
    <button
      type="button"
      onClick={() => updateField(itemId, fieldKey, !isConfirmed)}
      disabled={activeScan?.status === 'DISPENSED'}
      className={`text-[10px] px-1.5 py-0.5 rounded font-mono font-semibold flex items-center gap-1 border transition-colors cursor-pointer ${
        isConfirmed
          ? 'bg-emerald-50 text-emerald-800 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-600'
          : 'bg-slate-100 hover:bg-slate-200 text-slate-600 border-slate-300 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'
      }`}
      title={isConfirmed ? `Confirmed by Pharmacist (click to unconfirm ${label})` : `Click to explicitly confirm ${label}`}
    >
      {isConfirmed ? <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600 dark:text-emerald-400" /> : null}
      {isConfirmed ? 'Confirmed' : 'Confirm'}
    </button>
  );

  return (
    <div className="space-y-6">
      {/* Top Header & Sub-Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2.5 py-0.5 rounded text-xs font-bold uppercase tracking-wider bg-sky-50 text-sky-800 border border-sky-200 dark:bg-sky-950 dark:text-sky-300 dark:border-sky-800 shrink-0">
                Prescription Protocol (Phase 3)
              </span>
              <h1 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                Prescription Scanner & 7-Field Human Confirmation Gate
              </h1>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
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
              variant="secondary"
              size="sm"
              onClick={() => setShowTextInputModal(true)}
              icon={<FileText className="w-4 h-4" />}
              disabled={isProcessing}
            >
              Type / Paste Slip Text
            </Button>
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
        <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center gap-2">
          <span className="text-xs text-slate-700 dark:text-slate-300 font-semibold">Sample Prescriptions:</span>
          {SAMPLE_PRESCRIPTIONS.map((sample, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => handleSampleUpload(idx)}
              disabled={isProcessing}
              className="text-xs px-2.5 py-1 rounded bg-slate-100 hover:bg-sky-50 text-slate-800 hover:text-sky-900 border border-slate-300 hover:border-sky-400 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-sky-300 dark:border-slate-700 dark:hover:border-sky-500 font-medium transition-colors"
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
          <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center gap-2">
            <span className="text-xs text-slate-600 dark:text-slate-400 font-semibold">Loaded Slips ({scans.length}):</span>
            {scans.map((scan) => (
              <button
                key={scan.id}
                type="button"
                onClick={() => selectScan(scan)}
                className={`text-xs px-2 py-0.5 rounded border transition-colors ${
                  activeScan?.id === scan.id
                    ? 'bg-sky-100 text-sky-900 border-sky-400 dark:bg-sky-950/80 dark:text-sky-300 dark:border-sky-600 font-semibold'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700 font-medium'
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
        <div className="p-3.5 rounded-lg bg-rose-50 dark:bg-rose-950/80 border border-rose-200 dark:border-rose-600 text-rose-900 dark:text-rose-200 text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}
      {successMessage && (
        <div className="p-3.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/80 border border-emerald-200 dark:border-emerald-600 text-emerald-900 dark:text-emerald-200 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Main Split-Screen Workstation */}
      {activeScan ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Panel: Prescription Slip Image & OCR Text Viewer (5 cols) */}
          <div className="lg:col-span-5 space-y-4">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-xs flex flex-col h-full">
              <div className="border-b border-slate-100 dark:border-slate-800 pb-3 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <FileText className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                    Prescription Slip Visual
                  </h3>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">{activeScan.original_filename}</span>
                </div>

                {/* Zoom & Rotation Controls */}
                <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-950 p-1 rounded-lg border border-slate-200 dark:border-slate-700">
                  <button
                    type="button"
                    onClick={() => setZoomLevel((z) => Math.min(z + 0.25, 2.5))}
                    title="Zoom In"
                    className="p-1 text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                  >
                    <ZoomIn className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setZoomLevel((z) => Math.max(z - 0.25, 0.5))}
                    title="Zoom Out"
                    className="p-1 text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
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
                    className="p-1 text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white text-[10px] font-mono px-1"
                  >
                    1:1
                  </button>
                  <button
                    type="button"
                    onClick={() => setRotation((r) => (r + 90) % 360)}
                    title="Rotate 90deg"
                    className="p-1 text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                  >
                    <RotateCw className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Visual Canvas */}
              <div className="flex-1 min-h-[320px] bg-slate-100 dark:bg-slate-950 rounded-lg my-3 border border-slate-200 dark:border-slate-800 overflow-hidden relative flex items-center justify-center p-4">
                <div
                  style={{
                    transform: `scale(${zoomLevel}) rotate(${rotation}deg)`,
                    transition: 'transform 0.15s ease-out',
                  }}
                  className="max-w-full max-h-[380px] p-4 bg-white dark:bg-slate-900 rounded border border-slate-300 dark:border-slate-700 shadow-md font-mono text-xs text-slate-800 dark:text-slate-200 select-text"
                >
                  <div className="border-b border-slate-200 dark:border-slate-700 pb-2 mb-2 flex items-center justify-between text-[11px] text-sky-700 dark:text-sky-400 font-bold">
                    <span>OUTPATIENT CLINICAL PRESCRIPTION</span>
                    <span>{activeScan.scan_number}</span>
                  </div>
                  <pre className="whitespace-pre-wrap font-sans text-xs text-slate-800 dark:text-slate-300 leading-relaxed">
                    {activeScan.extracted_raw_text || 'No raw text extracted.'}
                  </pre>
                </div>
              </div>

              {/* Confidence Summary Banner */}
              <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-700 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="text-slate-600 dark:text-slate-400">OCR Confidence:</span>
                  <span className="font-mono font-bold text-slate-900 dark:text-white">
                    {Math.round(activeScan.overall_confidence * 100)}%
                  </span>
                </div>
                {activeScan.low_confidence_flag ? (
                  <span className="text-amber-800 dark:text-amber-400 flex items-center gap-1 font-semibold text-[11px]">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    Uncertainty Flag Active (&lt;85%)
                  </span>
                ) : (
                  <span className="text-emerald-700 dark:text-emerald-400 flex items-center gap-1 font-semibold text-[11px]">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    High Extraction Confidence
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Right Panel: Mandatory 7-Field Human Confirmation Gate (7 cols) */}
          <div className="lg:col-span-7 space-y-4">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-xs space-y-5">
              <div className="border-b border-slate-100 dark:border-slate-800 pb-3 flex items-center justify-between">
                <div>
                  <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    Mandatory 7-Field Human Confirmation Gate
                  </h2>
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    Reviewing Pharmacist must explicitly confirm all 7 core clinical fields for each item
                  </span>
                </div>

                <span
                  className={`text-xs font-mono px-2.5 py-1 rounded font-bold uppercase border ${
                    activeScan.status === 'HUMAN_CONFIRMED'
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-600'
                      : activeScan.status === 'DISPENSED'
                      ? 'bg-blue-50 text-blue-800 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-600'
                      : 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-600'
                  }`}
                >
                  {activeScan.status}
                </span>
              </div>

              {/* Patient & Prescription Header Context (Auxiliary Context - Distinct from the 7 Clinical Verification Fields) */}
              <div className="p-3.5 rounded-lg bg-sky-50/70 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800/60 space-y-2">
                <div className="flex items-center justify-between text-xs font-semibold text-sky-900 dark:text-sky-200">
                  <span className="flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
                    Prescription Header Information (Patient & Date Context)
                  </span>
                  <span className="text-[11px] font-normal text-sky-700 dark:text-sky-300">
                    Additional metadata — does not replace the 7 clinical verification fields
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 block">Identifier</span>
                    <span className="font-mono font-medium text-slate-900 dark:text-white">{activeScan.patient_identifier || 'PT-RX-SCAN'}</span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 block">Patient Name</span>
                    <span className="font-medium text-slate-900 dark:text-white">{activeScan.patient_name || 'Not documented on slip'}</span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 block">Age</span>
                    <span className="font-medium text-slate-900 dark:text-white">{activeScan.patient_age || 'Not specified'}</span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 block">Date</span>
                    <span className="font-medium text-slate-900 dark:text-white">{activeScan.prescription_date || 'Not specified'}</span>
                  </div>
                </div>
              </div>

              {/* Items List */}
              <div className="space-y-4">
                {activeScan.items.map((item, idx) => {
                  const form = confirmedItems[item.id] || {
                    item_id: item.id,
                    confirmed_drug_name: item.confirmed_drug_name || (item.confidence_drug_name >= 0.85 ? item.ocr_drug_name : ''),
                    confirmed_strength: item.confirmed_strength || (item.confidence_strength >= 0.85 ? item.ocr_strength || '' : ''),
                    confirmed_dosage_form: item.confirmed_dosage_form || (item.confidence_dosage_form >= 0.85 ? item.ocr_dosage_form || 'Tablet' : 'Tablet'),
                    confirmed_dose_amount: item.confirmed_dose_amount ?? (item.confidence_dose >= 0.85 ? item.ocr_dose_amount ?? '' : ''),
                    confirmed_dose_unit: item.ocr_dose_unit || 'mg',
                    confirmed_route: item.confirmed_route || (item.confidence_route >= 0.85 ? item.ocr_route || 'Oral' : 'Oral'),
                    confirmed_frequency: item.confirmed_frequency || (item.confidence_frequency >= 0.85 ? item.ocr_frequency || '' : ''),
                    confirmed_duration_days: item.confirmed_duration_days ?? (item.confidence_duration >= 0.85 ? item.ocr_duration_days ?? '' : ''),
                    legal_category: item.legal_category || 'POM',
                  };

                  return (
                    <div
                      key={item.id}
                      className="bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-700 rounded-xl p-4 space-y-3"
                    >
                      <div className="flex flex-wrap items-center justify-between border-b border-slate-200 dark:border-slate-750 pb-2 gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-sky-700 dark:text-sky-400">
                            Medication Item #{idx + 1}
                          </span>
                          <span className="text-xs px-2 py-0.5 rounded bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 font-mono font-medium">
                            Act 857: {form.legal_category}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setConfirmedItems((prev) => ({
                                ...prev,
                                [item.id]: {
                                  ...prev[item.id],
                                  confirm_drug_name: true,
                                  confirm_strength: true,
                                  confirm_dosage_form: true,
                                  confirm_dose: true,
                                  confirm_route: true,
                                  confirm_frequency: true,
                                  confirm_duration: true,
                                },
                              }));
                            }}
                            disabled={activeScan.status === 'DISPENSED'}
                            className="text-[11px] px-2.5 py-1 rounded bg-sky-50 text-sky-800 hover:bg-sky-100 dark:bg-sky-950 dark:text-sky-300 dark:hover:bg-sky-900 border border-sky-300 dark:border-sky-700 font-semibold transition-colors flex items-center gap-1.5 cursor-pointer"
                          >
                            <ShieldCheck className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
                            Confirm All 7 Fields
                          </button>
                        </div>
                      </div>

                      {/* The 7 Core Clinical Fields Form */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                        {/* 1. Drug Name */}
                        <div className="sm:col-span-2 space-y-1">
                          <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                            <span>1. Drug Name *</span>
                            <div className="flex items-center gap-1.5">
                              {renderConfidenceBadge(item.confidence_drug_name)}
                              {renderFieldConfirmToggle(item.id, 'confirm_drug_name', !!form.confirm_drug_name, 'Drug Name')}
                            </div>
                          </label>
                          <input
                            type="text"
                            value={form.confirmed_drug_name}
                            onChange={(e) => updateField(item.id, 'confirmed_drug_name', e.target.value)}
                            disabled={activeScan.status === 'DISPENSED'}
                            placeholder="Drug Name (Required)"
                            className={`w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border rounded text-slate-900 dark:text-white font-medium focus:outline-none focus:ring-1 focus:ring-sky-500 focus:border-sky-500 ${
                              !form.confirmed_drug_name ? 'border-amber-400 dark:border-amber-600' : 'border-slate-300 dark:border-slate-700'
                            }`}
                          />
                        </div>

                        {/* 2. Strength */}
                        <div className="space-y-1">
                          <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                            <span>2. Strength *</span>
                            <div className="flex items-center gap-1.5">
                              {renderConfidenceBadge(item.confidence_strength)}
                              {renderFieldConfirmToggle(item.id, 'confirm_strength', !!form.confirm_strength, 'Strength')}
                            </div>
                          </label>
                          <input
                            type="text"
                            value={form.confirmed_strength}
                            onChange={(e) => updateField(item.id, 'confirmed_strength', e.target.value)}
                            disabled={activeScan.status === 'DISPENSED'}
                            placeholder="e.g. 500mg (Required)"
                            className={`w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border rounded text-slate-900 dark:text-white font-medium focus:outline-none focus:ring-1 focus:ring-sky-500 focus:border-sky-500 ${
                              !form.confirmed_strength ? 'border-amber-400 dark:border-amber-600' : 'border-slate-300 dark:border-slate-700'
                            }`}
                          />
                        </div>

                        {/* 3. Formulation */}
                        <div className="space-y-1">
                          <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                            <span>3. Formulation *</span>
                            <div className="flex items-center gap-1.5">
                              {renderConfidenceBadge(item.confidence_dosage_form)}
                              {renderFieldConfirmToggle(item.id, 'confirm_dosage_form', !!form.confirm_dosage_form, 'Formulation')}
                            </div>
                          </label>
                          <select
                            value={form.confirmed_dosage_form}
                            onChange={(e) => updateField(item.id, 'confirmed_dosage_form', e.target.value)}
                            disabled={activeScan.status === 'DISPENSED'}
                            className="w-full px-2 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded text-slate-900 dark:text-white font-medium focus:outline-none focus:ring-1 focus:ring-sky-500 focus:border-sky-500"
                          >
                            <option value="Tablet">Tablet</option>
                            <option value="Capsule">Capsule</option>
                            <option value="Syrup">Syrup</option>
                            <option value="Suspension">Suspension</option>
                            <option value="Sachet">Sachet</option>
                            <option value="Injection">Injection</option>
                            <option value="Ointment">Ointment</option>
                            <option value="Drops">Drops</option>
                            <option value="Inhalation">Inhalation</option>
                          </select>
                        </div>

                        {/* 4. Dose Amount */}
                        <div className="space-y-1">
                          <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                            <span>4. Dose *</span>
                            <div className="flex items-center gap-1.5">
                              {item.confidence_dose < 0.85 || !form.confirmed_dose_amount ? (
                                <span className="text-[10px] text-amber-700 dark:text-amber-400 font-semibold flex items-center gap-0.5">
                                  <AlertTriangle className="w-2.5 h-2.5" /> Entry Req.
                                </span>
                              ) : (
                                renderConfidenceBadge(item.confidence_dose)
                              )}
                              {renderFieldConfirmToggle(item.id, 'confirm_dose', !!form.confirm_dose, 'Dose Amount')}
                            </div>
                          </label>
                          <input
                            type="number"
                            step="0.5"
                            min="0.1"
                            value={form.confirmed_dose_amount ?? ''}
                            onChange={(e) => updateField(item.id, 'confirmed_dose_amount', e.target.value === '' ? '' : parseFloat(e.target.value))}
                            disabled={activeScan.status === 'DISPENSED'}
                            placeholder="e.g. 1 (Required)"
                            className={`w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border rounded text-slate-900 dark:text-white font-medium focus:outline-none focus:ring-1 focus:ring-sky-500 focus:border-sky-500 ${
                              !form.confirmed_dose_amount || Number(form.confirmed_dose_amount) <= 0
                                ? 'border-amber-400 dark:border-amber-600'
                                : 'border-slate-300 dark:border-slate-700'
                            }`}
                          />
                        </div>

                        {/* 5. Route */}
                        <div className="space-y-1">
                          <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                            <span>5. Route *</span>
                            <div className="flex items-center gap-1.5">
                              {renderConfidenceBadge(item.confidence_route)}
                              {renderFieldConfirmToggle(item.id, 'confirm_route', !!form.confirm_route, 'Route')}
                            </div>
                          </label>
                          <select
                            value={form.confirmed_route}
                            onChange={(e) => updateField(item.id, 'confirmed_route', e.target.value)}
                            disabled={activeScan.status === 'DISPENSED'}
                            className="w-full px-2 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded text-slate-900 dark:text-white font-medium focus:outline-none focus:ring-1 focus:ring-sky-500 focus:border-sky-500"
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
                          <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                            <span>6. Frequency *</span>
                            <div className="flex items-center gap-1.5">
                              {item.confidence_frequency < 0.85 || !form.confirmed_frequency ? (
                                <span className="text-[10px] text-amber-700 dark:text-amber-400 font-semibold flex items-center gap-0.5">
                                  <AlertTriangle className="w-2.5 h-2.5" /> Entry Req.
                                </span>
                              ) : (
                                renderConfidenceBadge(item.confidence_frequency)
                              )}
                              {renderFieldConfirmToggle(item.id, 'confirm_frequency', !!form.confirm_frequency, 'Frequency')}
                            </div>
                          </label>
                          <select
                            value={form.confirmed_frequency || ''}
                            onChange={(e) => updateField(item.id, 'confirmed_frequency', e.target.value)}
                            disabled={activeScan.status === 'DISPENSED'}
                            className={`w-full px-2 py-1.5 bg-white dark:bg-slate-900 border rounded text-slate-900 dark:text-white font-medium focus:outline-none focus:ring-1 focus:ring-sky-500 focus:border-sky-500 ${
                              !form.confirmed_frequency ? 'border-amber-400 dark:border-amber-600' : 'border-slate-300 dark:border-slate-700'
                            }`}
                          >
                            <option value="">-- Select Frequency --</option>
                            <option value="Daily">Daily (Once daily)</option>
                            <option value="BID">BID (Twice daily)</option>
                            <option value="TID">TID (Three times daily)</option>
                            <option value="QID">QID (Four times daily)</option>
                            <option value="PRN">PRN (As needed)</option>
                          </select>
                        </div>

                        {/* 7. Duration */}
                        <div className="space-y-1">
                          <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                            <span>7. Duration (Days) *</span>
                            <div className="flex items-center gap-1.5">
                              {item.confidence_duration < 0.85 || !form.confirmed_duration_days ? (
                                <span className="text-[10px] text-amber-700 dark:text-amber-400 font-semibold flex items-center gap-0.5">
                                  <AlertTriangle className="w-2.5 h-2.5" /> Entry Req.
                                </span>
                              ) : (
                                renderConfidenceBadge(item.confidence_duration)
                              )}
                              {renderFieldConfirmToggle(item.id, 'confirm_duration', !!form.confirm_duration, 'Duration')}
                            </div>
                          </label>
                          <input
                            type="number"
                            min="1"
                            value={form.confirmed_duration_days ?? ''}
                            onChange={(e) => updateField(item.id, 'confirmed_duration_days', e.target.value === '' ? '' : parseInt(e.target.value, 10))}
                            disabled={activeScan.status === 'DISPENSED'}
                            placeholder="e.g. 5 (Required)"
                            className={`w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border rounded text-slate-900 dark:text-white font-medium focus:outline-none focus:ring-1 focus:ring-sky-500 focus:border-sky-500 ${
                              !form.confirmed_duration_days || Number(form.confirmed_duration_days) <= 0
                                ? 'border-amber-400 dark:border-amber-600'
                                : 'border-slate-300 dark:border-slate-700'
                            }`}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Pharmacist Review Notes & Legal Sign-Off */}
              <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Pharmacist Verification & Clinical Sign-Off Notes:
                </label>
                <textarea
                  rows={2}
                  value={pharmacistNotes}
                  onChange={(e) => setPharmacistNotes(e.target.value)}
                  placeholder="Document visual cross-check against physical prescription slip..."
                  disabled={activeScan.status === 'DISPENSED'}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-md text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  {activeScan.status === 'PENDING_REVIEW' && (
                    <span className="text-amber-800 dark:text-amber-400 font-semibold flex items-center gap-1">
                      <Lock className="w-3.5 h-3.5" />
                      Dispensing blocked pending 7-Field confirmation
                    </span>
                  )}
                  {activeScan.status === 'HUMAN_CONFIRMED' && (
                    <span className="text-emerald-800 dark:text-emerald-400 font-semibold flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Confirmed by {activeScan.pharmacist_confirmed_by || 'Pharmacist'}
                    </span>
                  )}
                  {activeScan.status === 'DISPENSED' && (
                    <span className="text-blue-800 dark:text-blue-400 font-semibold flex items-center gap-1">
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
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-12 text-center space-y-4 shadow-xs">
          <FileText className="w-12 h-12 text-slate-400 dark:text-slate-500 mx-auto" />
          <h3 className="text-base font-bold text-slate-900 dark:text-white">No Prescription Scans Selected</h3>
          <p className="text-xs text-slate-600 dark:text-slate-400 max-w-md mx-auto">
            Upload a prescription image or select a sample preset above to activate the OCR extraction
            and 7-Field Human Confirmation Gate.
          </p>
        </div>
      )}

      {/* Real-World Prescription Slip Text Intake Modal */}
      {showTextInputModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl max-w-xl w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2 text-sky-700 dark:text-sky-400 font-bold text-sm">
                <FileText className="w-5 h-5" />
                <span>Transcribe / Paste Paper Prescription Slip</span>
              </div>
              <button
                type="button"
                onClick={() => setShowTextInputModal(false)}
                className="text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white p-1"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300">
              For field trials with physical clinic slips or telephone orders: type or paste the text written on the prescription slip. The deterministic parser will extract the 7 core fields for pharmacist verification.
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Patient Identifier / Slip Ref (Optional)
                </label>
                <input
                  type="text"
                  value={manualPatientId}
                  onChange={(e) => setManualPatientId(e.target.value)}
                  placeholder="e.g. PT-2026-089 or RX-OPD-4412"
                  className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-sky-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Prescription Slip Content *
                </label>
                <textarea
                  rows={5}
                  value={manualPrescriptionText}
                  onChange={(e) => setManualPrescriptionText(e.target.value)}
                  placeholder="e.g.&#10;Rx: Ciprofloxacin 500mg tablets 1 tab BID for 5 days&#10;Rx: Metronidazole 400mg tablets 1 tab TID for 5 days"
                  className="w-full text-xs font-mono p-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-sky-500"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setShowTextInputModal(false)}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleManualTextSubmit}
                disabled={isProcessing || !manualPrescriptionText.trim()}
                icon={<ShieldCheck className="w-4 h-4" />}
              >
                Parse &amp; Verify Prescription
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

