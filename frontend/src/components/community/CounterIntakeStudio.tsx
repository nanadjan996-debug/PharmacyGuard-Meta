import React, { useState, useEffect } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  FileText,
  UserCheck,
  Printer,
  ShieldAlert,
  Plus,
  Trash2,
  Clock,
  RefreshCw,
  Info,
  Sparkles,
} from 'lucide-react';
import { api, ApiError } from '../../services/api';
import {
  CommunityConsultation,
  ConsultationCreatePayload,
  ConsultationItem,
  AllergyEntry,
  MRDTStatus,
  G6PDEpistemicStatus,
  AllergyEpistemicState,
  ConsultationLifecycleState,
} from '../../types/community';
import { Button } from '../common/Button';
import { SeverityBadge } from '../common/SeverityBadge';

const COMMON_SYMPTOMS = [
  { id: 'fever', label: 'Fever (Temp ≥ 38°C)', category: 'malaria' },
  { id: 'chills', label: 'Chills & Rigors', category: 'malaria' },
  { id: 'prostration', label: 'Prostration / Lethargy', category: 'severe_malaria' },
  { id: 'repeated_vomiting', label: 'Repeated Vomiting (Unable to retain oral meds)', category: 'severe_malaria' },
  { id: 'dark_urine', label: 'Dark Urine ("Blackwater")', category: 'severe_malaria' },
  { id: 'cough', label: 'Cough', category: 'respiratory' },
  { id: 'fast_breathing', label: 'Fast Breathing', category: 'respiratory' },
  { id: 'subcostal_chest_indrawing', label: 'Subcostal Chest Indrawing (Child)', category: 'severe_respiratory' },
  { id: 'severe_headache', label: 'Severe Occipital Headache', category: 'cardiovascular' },
  { id: 'blurred_vision', label: 'Acute Blurred Vision', category: 'cardiovascular' },
  { id: 'neck_stiffness', label: 'Neck Stiffness (Nuchal Rigidity)', category: 'meningitis' },
  { id: 'photophobia', label: 'Photophobia', category: 'meningitis' },
  { id: 'acute_abdominal_pain', label: 'Acute Severe Abdominal Pain', category: 'abdo' },
  { id: 'abdominal_rigidity', label: 'Abdominal Rigidity / Guarding', category: 'severe_abdo' },
  { id: 'rebound_tenderness', label: 'Rebound Tenderness', category: 'severe_abdo' },
];

const PRESET_MEDICATIONS: { name: string; strength: string; form: string; dose: number; unit: string; freq: string; dur: number; cat: 'OTC' | 'P' | 'POM' }[] = [
  { name: 'Artemether-Lumefantrine', strength: '20/120mg', form: 'Tablet', dose: 4, unit: 'tabs', freq: 'BID', dur: 3, cat: 'P' },
  { name: 'Paracetamol', strength: '500mg', form: 'Tablet', dose: 1000, unit: 'mg', freq: 'TID', dur: 3, cat: 'OTC' },
  { name: 'Amoxicillin', strength: '500mg', form: 'Capsule', dose: 500, unit: 'mg', freq: 'TID', dur: 5, cat: 'POM' },
  { name: 'Oral Rehydration Salts (ORS)', strength: '20.5g sachet', form: 'Oral Powder', dose: 1, unit: 'sachet', freq: 'PRN', dur: 3, cat: 'OTC' },
  { name: 'Zinc Sulfate', strength: '20mg', form: 'Dispersible Tablet', dose: 20, unit: 'mg', freq: 'OD', dur: 10, cat: 'OTC' },
  { name: 'Ibuprofen', strength: '400mg', form: 'Tablet', dose: 400, unit: 'mg', freq: 'TID', dur: 3, cat: 'OTC' },
];

export const CounterIntakeStudio: React.FC = () => {
  // Form State
  const [patientId, setPatientId] = useState(`SYN-WI-${Math.floor(1000 + Math.random() * 9000)}`);
  const [ageYears, setAgeYears] = useState<number | ''>(28);
  const [ageMonths, setAgeMonths] = useState<number | ''>('');
  const [gender, setGender] = useState<'FEMALE' | 'MALE' | 'OTHER'>('FEMALE');
  const [weightKg, setWeightKg] = useState<number | ''>(62.5);

  // Vitals State
  const [tempC, setTempC] = useState<number | ''>(38.2);
  const [sbp, setSbp] = useState<number | ''>(125);
  const [dbp, setDbp] = useState<number | ''>(82);
  const [hr, setHr] = useState<number | ''>(84);
  const [rr, setRr] = useState<number | ''>(18);
  const [spo2, setSpo2] = useState<number | ''>(98);

  // Diagnostic screening (On-Demand)
  const [hasDiagnosticTests, setHasDiagnosticTests] = useState<boolean>(true);
  const [mrdtStatus, setMrdtStatus] = useState<MRDTStatus>('CONFIRMED_POSITIVE');
  const [g6pdStatus, setG6pdStatus] = useState<G6PDEpistemicStatus>('REPORTED_UNKNOWN');
  const [pocBloodSugar, setPocBloodSugar] = useState<'NOT_DONE' | 'NORMAL' | 'ELEVATED' | 'HYPOGLYCEMIC'>('NOT_DONE');

  // Symptoms & Chief Complaint
  const [chiefComplaint, setChiefComplaint] = useState('Patient presents with fever, chills, and headache for 2 days.');
  const [selectedSymptoms, setSelectedSymptoms] = useState<string[]>(['fever', 'chills']);

  // Allergies
  const [allergies, setAllergies] = useState<AllergyEntry[]>([
    { allergen: 'Penicillin', state: 'CONFIRMED_OBJECTIVE', reaction: 'Urticaria / Hives' },
  ]);
  const [newAllergen, setNewAllergen] = useState('');
  const [newAllergyState, setNewAllergyState] = useState<AllergyEpistemicState>('CONFIRMED_OBJECTIVE');

  // Proposed Items
  const [items, setItems] = useState<ConsultationItem[]>([
    {
      drug_name: 'Artemether-Lumefantrine',
      strength: '20/120mg',
      dosage_form: 'Tablet',
      dose_amount: 4,
      dose_unit: 'tabs',
      frequency: 'BID',
      duration_days: 3,
      route: 'Oral',
      instructions: 'Take with milk or fatty meal',
      legal_category: 'P',
    },
  ]);

  // Active / Selected Consultation
  const [activeConsultation, setActiveConsultation] = useState<CommunityConsultation | null>(null);
  const [recentConsultations, setRecentConsultations] = useState<CommunityConsultation[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Modals & Action Controls
  const [showReferralModal, setShowReferralModal] = useState(false);
  const [showOverrideModal, setShowOverrideModal] = useState(false);
  const [overrideRationale, setOverrideRationale] = useState('');
  const [pharmacistNotes, setPharmacistNotes] = useState('');

  // Load recent consultations
  const loadConsultations = async () => {
    setIsLoading(true);
    try {
      const data = await api.community.listConsultations();
      setRecentConsultations(data);
    } catch (err) {
      console.error('Failed to load community consultations:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadConsultations();
  }, []);

  // Toggle symptom chip
  const toggleSymptom = (symptomId: string) => {
    setSelectedSymptoms((prev) =>
      prev.includes(symptomId) ? prev.filter((s) => s !== symptomId) : [...prev, symptomId]
    );
  };

  // Quick-Test Demo Scenarios (Enables 1-click evaluation without supervision across multiple specialties)
  const applyScenario = (type: 'routine' | 'emergency' | 'allergy' | 'hypertension') => {
    setActiveConsultation(null);
    setErrorMessage(null);
    if (type === 'routine') {
      setPatientId(`SYN-WI-${Math.floor(1000 + Math.random() * 9000)}`);
      setAgeYears(32);
      setAgeMonths('');
      setGender('FEMALE');
      setWeightKg(60.0);
      setTempC(37.0);
      setSbp(118);
      setDbp(76);
      setHr(72);
      setRr(16);
      setSpo2(99);
      setHasDiagnosticTests(false);
      setMrdtStatus('NOT_DONE');
      setG6pdStatus('REPORTED_UNKNOWN');
      setPocBloodSugar('NOT_DONE');
      setChiefComplaint('Mild frontal tension headache and general fatigue after long work hours. No nausea or visual disturbances.');
      setSelectedSymptoms([]);
      setAllergies([]);
      setItems([
        {
          drug_name: 'Paracetamol',
          strength: '500mg',
          dosage_form: 'Tablet',
          dose_amount: 1000,
          dose_unit: 'mg',
          frequency: 'TID',
          duration_days: 3,
          route: 'Oral',
          legal_category: 'OTC',
        },
      ]);
    } else if (type === 'emergency') {
      setPatientId(`SYN-WI-${Math.floor(1000 + Math.random() * 9000)}`);
      setAgeYears(28);
      setAgeMonths('');
      setGender('FEMALE');
      setWeightKg(62.5);
      setTempC(39.5);
      setSbp(112);
      setDbp(72);
      setHr(110);
      setRr(24);
      setSpo2(95);
      setHasDiagnosticTests(true);
      setMrdtStatus('CONFIRMED_POSITIVE');
      setG6pdStatus('REPORTED_UNKNOWN');
      setPocBloodSugar('NOT_DONE');
      setChiefComplaint('High fever, repeated vomiting, severe prostration, and dark urine for 2 days.');
      setSelectedSymptoms(['fever', 'chills', 'prostration', 'repeated_vomiting', 'dark_urine', 'neck_stiffness']);
      setAllergies([]);
      setItems([
        {
          drug_name: 'Artemether-Lumefantrine',
          strength: '20/120mg',
          dosage_form: 'Tablet',
          dose_amount: 4,
          dose_unit: 'tabs',
          frequency: 'BID',
          duration_days: 3,
          route: 'Oral',
          legal_category: 'P',
        },
      ]);
    } else if (type === 'allergy') {
      setPatientId(`SYN-WI-${Math.floor(1000 + Math.random() * 9000)}`);
      setAgeYears(42);
      setAgeMonths('');
      setGender('MALE');
      setWeightKg(75.0);
      setTempC(38.4);
      setSbp(126);
      setDbp(82);
      setHr(80);
      setRr(18);
      setSpo2(98);
      setHasDiagnosticTests(false);
      setMrdtStatus('CONFIRMED_NEGATIVE');
      setG6pdStatus('CONFIRMED_NORMAL');
      setPocBloodSugar('NOT_DONE');
      setChiefComplaint('Sore throat, moderate fever, and productive cough for 3 days.');
      setSelectedSymptoms(['fever', 'cough']);
      setAllergies([
        { allergen: 'Penicillin', state: 'CONFIRMED_OBJECTIVE', reaction: 'Urticaria / Hives' },
      ]);
      setItems([
        {
          drug_name: 'Amoxicillin',
          strength: '500mg',
          dosage_form: 'Capsule',
          dose_amount: 500,
          dose_unit: 'mg',
          frequency: 'TID',
          duration_days: 5,
          route: 'Oral',
          legal_category: 'POM',
        },
      ]);
    } else if (type === 'hypertension') {
      setPatientId(`SYN-WI-${Math.floor(1000 + Math.random() * 9000)}`);
      setAgeYears(58);
      setAgeMonths('');
      setGender('MALE');
      setWeightKg(82.0);
      setTempC(36.8);
      setSbp(195);
      setDbp(124);
      setHr(92);
      setRr(20);
      setSpo2(97);
      setHasDiagnosticTests(false);
      setMrdtStatus('NOT_DONE');
      setG6pdStatus('REPORTED_UNKNOWN');
      setPocBloodSugar('NOT_DONE');
      setChiefComplaint('Severe throbbing occipital headache, acute blurred vision, and dizziness for several hours.');
      setSelectedSymptoms(['severe_headache', 'blurred_vision']);
      setAllergies([]);
      setItems([
        {
          drug_name: 'Paracetamol',
          strength: '500mg',
          dosage_form: 'Tablet',
          dose_amount: 1000,
          dose_unit: 'mg',
          frequency: 'TID',
          duration_days: 2,
          route: 'Oral',
          legal_category: 'OTC',
        },
      ]);
    }
  };

  const resetForm = () => {
    setActiveConsultation(null);
    setPatientId(`SYN-WI-${Math.floor(1000 + Math.random() * 9000)}`);
    setAgeYears(28);
    setAgeMonths('');
    setGender('FEMALE');
    setWeightKg(62.5);
    setTempC(38.2);
    setSbp(125);
    setDbp(82);
    setHr(84);
    setRr(18);
    setSpo2(98);
    setHasDiagnosticTests(true);
    setMrdtStatus('CONFIRMED_POSITIVE');
    setG6pdStatus('REPORTED_UNKNOWN');
    setPocBloodSugar('NOT_DONE');
    setChiefComplaint('Patient presents with fever, chills, and headache for 2 days.');
    setSelectedSymptoms(['fever', 'chills']);
    setAllergies([{ allergen: 'Penicillin', state: 'CONFIRMED_OBJECTIVE', reaction: 'Urticaria / Hives' }]);
    setItems([
      {
        drug_name: 'Artemether-Lumefantrine',
        strength: '20/120mg',
        dosage_form: 'Tablet',
        dose_amount: 4,
        dose_unit: 'tabs',
        frequency: 'BID',
        duration_days: 3,
        route: 'Oral',
        legal_category: 'P',
      },
    ]);
    setErrorMessage(null);
  };

  // Add Allergy
  const addAllergy = () => {
    if (!newAllergen.trim()) return;
    setAllergies([...allergies, { allergen: newAllergen.trim(), state: newAllergyState }]);
    setNewAllergen('');
  };

  // Remove Allergy
  const removeAllergy = (index: number) => {
    setAllergies(allergies.filter((_, i) => i !== index));
  };

  // Add Item from preset
  const addPresetMed = (preset: typeof PRESET_MEDICATIONS[0]) => {
    setItems([
      ...items,
      {
        drug_name: preset.name,
        strength: preset.strength,
        dosage_form: preset.form,
        dose_amount: preset.dose,
        dose_unit: preset.unit,
        frequency: preset.freq,
        duration_days: preset.dur,
        route: 'Oral',
        legal_category: preset.cat,
      },
    ]);
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  // Submit Consultation
  const handleSubmitConsultation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chiefComplaint.trim()) {
      setErrorMessage('Chief complaint is required.');
      return;
    }
    setErrorMessage(null);
    setIsSubmitting(true);

    const payload: ConsultationCreatePayload = {
      patient_identifier: patientId,
      age_years: ageYears === '' ? null : Number(ageYears),
      age_months: ageMonths === '' ? null : Number(ageMonths),
      gender,
      weight_kg: weightKg === '' ? null : Number(weightKg),
      temperature_c: tempC === '' ? null : Number(tempC),
      sbp_mmhg: sbp === '' ? null : Number(sbp),
      dbp_mmhg: dbp === '' ? null : Number(dbp),
      heart_rate_bpm: hr === '' ? null : Number(hr),
      respiratory_rate_bpm: rr === '' ? null : Number(rr),
      spo2_percent: spo2 === '' ? null : Number(spo2),
      mrdt_status: hasDiagnosticTests ? mrdtStatus : 'NOT_DONE',
      g6pd_status: hasDiagnosticTests ? g6pdStatus : 'REPORTED_UNKNOWN',
      chief_complaint: chiefComplaint,
      symptoms: selectedSymptoms,
      allergies,
      current_medications: [],
      proposed_items: items,
    };

    try {
      const created = await api.community.createConsultation(payload);
      setActiveConsultation(created);
      await loadConsultations();
      if (created.referral_triggered) {
        setShowReferralModal(true);
      }
    } catch (err) {
      if (err instanceof ApiError) {
        setErrorMessage(String(err.detail || err.message));
      } else {
        setErrorMessage('Failed to evaluate consultation.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Lifecycle Transitions
  const handleTransition = async (targetState: ConsultationLifecycleState, rationale?: string) => {
    if (!activeConsultation) return;
    setErrorMessage(null);
    try {
      const updated = await api.community.transitionConsultation(activeConsultation.id, {
        target_state: targetState,
        dispense_rationale: rationale,
        pharmacist_notes: pharmacistNotes || undefined,
      });
      setActiveConsultation(updated);
      setShowOverrideModal(false);
      setOverrideRationale('');
      setPharmacistNotes('');
      await loadConsultations();
    } catch (err) {
      if (err instanceof ApiError) {
        setErrorMessage(String(err.detail || err.message));
      } else {
        setErrorMessage('Failed to transition consultation lifecycle state.');
      }
    }
  };

  return (
    <div className="flex flex-col h-full bg-transparent text-slate-900 dark:text-slate-100 overflow-y-auto space-y-6" data-testid="counter-intake-studio">
      {/* Top Banner Header */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-6 py-4 flex flex-wrap items-center justify-between gap-4 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400">
            <UserCheck className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">Community Counter Consultation Studio</h1>
              <span className="px-2 py-0.5 text-xs font-semibold rounded bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800">
                Phase 2 Prototype
              </span>
              <span className="px-2 py-0.5 text-xs font-semibold rounded bg-slate-100 text-slate-700 border border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700">
                Synthetic Intake Mode
              </span>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
              Structured walk-in intake, rapid vitals assessment, point-of-care triage, and clinical safety verification.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {activeConsultation && (
            <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs">
              <span className="text-slate-700 dark:text-slate-300 font-mono font-medium">{activeConsultation.consultation_number}</span>
              <span className="font-semibold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">{activeConsultation.status}</span>
            </div>
          )}
          <Button
            variant="secondary"
            size="sm"
            onClick={resetForm}
            icon={<Plus className="w-4 h-4" />}
          >
            New Consultation
          </Button>
        </div>
      </div>

      {/* Quick Demo Test Scenarios Bar */}
      <div className="bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800/60 rounded-xl p-3.5 flex flex-wrap items-center justify-between gap-3 shadow-xs">
        <div className="flex items-center gap-2">
          <span className="p-1.5 rounded-md bg-sky-100 dark:bg-sky-900 text-sky-800 dark:text-sky-300">
            <Sparkles className="w-4 h-4" />
          </span>
          <div>
            <div className="text-xs font-bold text-sky-950 dark:text-sky-200">Quick Test Scenarios (1-Click Evaluation):</div>
            <div className="text-[11px] text-sky-800 dark:text-sky-300 font-medium">Select a pre-configured clinical presentation to test the safety engine across specialties without manual typing.</div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => applyScenario('routine')}
            className="px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-800 hover:bg-emerald-50 hover:border-emerald-300 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700 text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors"
          >
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            1. Routine Care (Normal)
          </button>
          <button
            type="button"
            onClick={() => applyScenario('emergency')}
            className="px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-800 hover:bg-rose-50 hover:border-rose-300 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700 text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors"
          >
            <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse"></span>
            2. Emergency Red Flag
          </button>
          <button
            type="button"
            onClick={() => applyScenario('allergy')}
            className="px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-800 hover:bg-amber-50 hover:border-amber-300 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700 text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors"
          >
            <span className="w-2 h-2 rounded-full bg-amber-500"></span>
            3. Penicillin Allergy Warning
          </button>
          <button
            type="button"
            onClick={() => applyScenario('hypertension')}
            className="px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-800 hover:bg-purple-50 hover:border-purple-300 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700 text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors"
          >
            <span className="w-2 h-2 rounded-full bg-purple-500"></span>
            4. Hypertensive Urgency
          </button>
          <button
            type="button"
            onClick={resetForm}
            className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 text-xs font-bold transition-colors"
            title="Reset Form"
          >
            Reset
          </button>
        </div>
      </div>

      {errorMessage && (
        <div className="p-4 rounded-lg bg-rose-50 dark:bg-rose-950/80 border border-rose-200 dark:border-rose-800 text-rose-900 dark:text-rose-200 text-sm flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
          <div>
            <div className="font-semibold">Clinical / Safety Notice:</div>
            <div>{errorMessage}</div>
          </div>
        </div>
      )}

      {/* Main Workspace Layout (2 Columns) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Form Intake (7 Cols) */}
        <div className="lg:col-span-7 space-y-6">
          <form onSubmit={handleSubmitConsultation} className="space-y-6">
            {/* Card 1: Demographics & Vitals */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                  1. Walk-In Patient Demographics & Vitals
                </h2>
                <span className="text-xs text-slate-700 dark:text-slate-300 font-mono font-semibold">{patientId}</span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1">Age (Years)</label>
                  <input
                    type="number"
                    min="0"
                    max="120"
                    value={ageYears}
                    onChange={(e) => setAgeYears(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-md text-sm text-slate-900 dark:text-white placeholder-slate-500 dark:placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 font-medium"
                    placeholder="e.g. 28"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1">Age (Months if &lt;5y)</label>
                  <input
                    type="number"
                    min="0"
                    max="59"
                    value={ageMonths}
                    onChange={(e) => setAgeMonths(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-md text-sm text-slate-900 dark:text-white placeholder-slate-500 dark:placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 font-medium"
                    placeholder="e.g. 18"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1">Gender</label>
                  <select
                    value={gender}
                    onChange={(e) => setGender(e.target.value as any)}
                    className="w-full px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-md text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 font-medium"
                  >
                    <option value="FEMALE">Female</option>
                    <option value="MALE">Male</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1">Weight (kg)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={weightKg}
                    onChange={(e) => setWeightKg(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-md text-sm text-slate-900 dark:text-white placeholder-slate-500 dark:placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 font-medium"
                    placeholder="e.g. 62.5"
                  />
                </div>
              </div>

              {/* Vitals Row */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-2">
                <div>
                  <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1">Temp (°C)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={tempC}
                    onChange={(e) => setTempC(e.target.value === '' ? '' : Number(e.target.value))}
                    className={`w-full px-3 py-1.5 bg-white dark:bg-slate-800 border rounded-md text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
                      tempC !== '' && Number(tempC) >= 38.0
                        ? 'border-amber-500 bg-amber-50 text-amber-950 dark:bg-amber-950/60 dark:text-amber-200 font-bold'
                        : 'border-slate-300 dark:border-slate-700 font-medium'
                    }`}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1">BP (mmHg)</label>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      placeholder="SBP"
                      value={sbp}
                      onChange={(e) => setSbp(e.target.value === '' ? '' : Number(e.target.value))}
                      className="w-1/2 px-2 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-md text-xs text-slate-900 dark:text-white placeholder-slate-500 dark:placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-500 font-medium"
                    />
                    <span className="text-slate-700 dark:text-slate-200 font-bold">/</span>
                    <input
                      type="number"
                      placeholder="DBP"
                      value={dbp}
                      onChange={(e) => setDbp(e.target.value === '' ? '' : Number(e.target.value))}
                      className="w-1/2 px-2 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-md text-xs text-slate-900 dark:text-white placeholder-slate-500 dark:placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-500 font-medium"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1">HR (bpm)</label>
                  <input
                    type="number"
                    value={hr}
                    onChange={(e) => setHr(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-md text-sm text-slate-900 dark:text-white placeholder-slate-500 dark:placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1">RR (bpm)</label>
                  <input
                    type="number"
                    value={rr}
                    onChange={(e) => setRr(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-md text-sm text-slate-900 dark:text-white placeholder-slate-500 dark:placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1">SpO2 (%)</label>
                  <input
                    type="number"
                    value={spo2}
                    onChange={(e) => setSpo2(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-md text-sm text-slate-900 dark:text-white placeholder-slate-500 dark:placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
                  />
                </div>
              </div>
            </div>

            {/* Card 2: Presenting Complaints & Clinical Picture */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-xs space-y-4">
              <div className="border-b border-slate-100 dark:border-slate-800 pb-3 flex items-center justify-between">
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                  2. Presenting Complaints & Clinical Picture
                </h2>
                <span className="text-xs text-slate-700 dark:text-slate-300 font-semibold">Free-Form Patient Intake</span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-900 dark:text-slate-100 mb-1">
                  Chief Complaint & Encounter Narrative *
                </label>
                <textarea
                  rows={3}
                  value={chiefComplaint}
                  onChange={(e) => setChiefComplaint(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white placeholder-slate-500 dark:placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-2xs font-medium"
                  placeholder="Record patient complaints, symptom onset, severity, and clinical history (e.g., headache, fever, cough, chest tightness, abdominal pain)..."
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-xs font-bold text-slate-900 dark:text-slate-100">
                    Clinical Warning Signs & System Review (Checklist):
                  </label>
                  <span className="text-[11px] text-slate-700 dark:text-slate-300 font-semibold">
                    {selectedSymptoms.length} selected
                  </span>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {COMMON_SYMPTOMS.map((sym) => {
                    const isSelected = selectedSymptoms.includes(sym.id);
                    const isSevere = sym.category.startsWith('severe') || sym.category === 'meningitis';
                    return (
                      <button
                        key={sym.id}
                        type="button"
                        onClick={() => toggleSymptom(sym.id)}
                        className={`px-2.5 py-1 rounded-full text-xs font-semibold transition-colors border ${
                          isSelected
                            ? isSevere
                              ? 'bg-rose-950 text-white border-rose-600 ring-2 ring-rose-400 shadow-xs'
                              : 'bg-emerald-600 text-white border-emerald-700 ring-2 ring-emerald-400 shadow-xs'
                            : 'bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200 dark:border-slate-700'
                        }`}
                      >
                        {sym.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Card 3: Point-of-Care Diagnostics & Rapid Tests */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-xs space-y-4">
              <div className="border-b border-slate-100 dark:border-slate-800 pb-3 flex items-center justify-between">
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                  3. Point-of-Care Diagnostics & Rapid Tests
                </h2>
                <div className="flex items-center gap-2">
                  {hasDiagnosticTests ? (
                    <button
                      type="button"
                      onClick={() => {
                        setHasDiagnosticTests(false);
                        setMrdtStatus('NOT_DONE');
                        setG6pdStatus('REPORTED_UNKNOWN');
                      }}
                      className="text-xs text-slate-700 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white underline font-semibold"
                    >
                      No Tests Indicated
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setHasDiagnosticTests(true)}
                      className="text-xs text-emerald-700 dark:text-emerald-400 hover:text-emerald-800 font-bold flex items-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Record Tests
                    </button>
                  )}
                </div>
              </div>

              {!hasDiagnosticTests ? (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-300 dark:border-slate-700">
                  <div className="flex items-start sm:items-center gap-3">
                    <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700 shrink-0">
                      <CheckCircle2 className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-950 dark:text-white">
                        No Point-of-Care Tests Conducted / Indicated
                      </div>
                      <div className="text-[11px] text-slate-700 dark:text-slate-300 mt-0.5 font-medium">
                        Routine presentation. If rapid malaria mRDT, blood glucose, or G6PD tests were performed at the counter, click to record clinical results.
                      </div>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setHasDiagnosticTests(true)}
                    icon={<Plus className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400" />}
                    className="shrink-0 font-bold text-slate-800 dark:text-slate-100 border-slate-400 dark:border-slate-600"
                  >
                    Record Rapid Test
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="p-3 bg-sky-50 dark:bg-sky-950/40 rounded-lg border border-sky-200 dark:border-sky-800 text-[11px] text-sky-900 dark:text-sky-300 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Info className="w-4 h-4 text-sky-600 shrink-0" />
                      <span>Point-of-care rapid testing panel active. Differentiates verified lab records from unverified patient recall.</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setHasDiagnosticTests(false);
                        setMrdtStatus('NOT_DONE');
                        setG6pdStatus('REPORTED_UNKNOWN');
                      }}
                      className="text-xs font-semibold text-sky-800 dark:text-sky-200 hover:underline shrink-0 ml-2"
                    >
                      Clear
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-900 dark:text-slate-100 mb-1.5 flex items-center gap-1.5">
                        Malaria Rapid Diagnostic Test (mRDT)
                        <Info className="w-3.5 h-3.5 text-slate-600 dark:text-slate-400" />
                      </label>
                      <select
                        value={mrdtStatus}
                        onChange={(e) => setMrdtStatus(e.target.value as MRDTStatus)}
                        className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-md text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 font-semibold"
                      >
                        <option value="CONFIRMED_POSITIVE">Confirmed Positive (Pf / Pan-specific)</option>
                        <option value="CONFIRMED_NEGATIVE">Confirmed Negative</option>
                        <option value="TESTING_UNAVAILABLE">Testing Unavailable (Stock-Out / Defective)</option>
                        <option value="NOT_DONE">Not Done</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-900 dark:text-slate-100 mb-1.5 flex items-center gap-1.5">
                        G6PD Deficiency Status (Clinical Screening)
                        <Info className="w-3.5 h-3.5 text-slate-600 dark:text-slate-400" />
                      </label>
                      <select
                        value={g6pdStatus}
                        onChange={(e) => setG6pdStatus(e.target.value as G6PDEpistemicStatus)}
                        className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-md text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 font-semibold"
                      >
                        <option value="REPORTED_UNKNOWN">REPORTED_UNKNOWN (Patient Unaware)</option>
                        <option value="NOT_COLLECTED">NOT_COLLECTED (Not Inquired)</option>
                        <option value="CONFIRMED_NORMAL">CONFIRMED_NORMAL (Official Lab Record)</option>
                        <option value="CONFIRMED_DEFICIENT">CONFIRMED_DEFICIENT (High Hemolysis Risk)</option>
                        <option value="NOT_TESTED">NOT_TESTED (Never Tested)</option>
                      </select>
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-xs font-bold text-slate-900 dark:text-slate-100 mb-1.5 flex items-center gap-1.5">
                        Rapid Blood Glucose (POC RBS / Glycemia)
                        <span className="text-[10px] text-slate-600 dark:text-slate-400 font-semibold">(Optional Screening)</span>
                      </label>
                      <select
                        value={pocBloodSugar}
                        onChange={(e) => setPocBloodSugar(e.target.value as any)}
                        className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-md text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 font-semibold"
                      >
                        <option value="NOT_DONE">Not Measured / Routine Encounter</option>
                        <option value="NORMAL">Normal Glycemia (4.0 - 7.8 mmol/L / 70 - 140 mg/dL)</option>
                        <option value="ELEVATED">Hyperglycemia / Marked Elevation (&gt;11.1 mmol/L / &gt;200 mg/dL)</option>
                        <option value="HYPOGLYCEMIC">Acute Hypoglycemia (&lt;3.9 mmol/L / &lt;70 mg/dL)</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Card 4: Allergy Profile (5-State Model) */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-xs space-y-4">
              <div className="border-b border-slate-100 dark:border-slate-800 pb-3 flex items-center justify-between">
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                  4. Patient Allergies & Adverse Drug History
                </h2>
                <span className="text-xs text-slate-700 dark:text-slate-300 font-semibold">Evidence Certainty</span>
              </div>

              <div className="space-y-2">
                {allergies.map((all, idx) => (
                  <div key={idx} className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-sm">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-slate-950 dark:text-white">{all.allergen}</span>
                      {all.state === 'CONFIRMED_OBJECTIVE' && (
                        <span className="text-[11px] px-2 py-0.5 rounded bg-emerald-100 text-emerald-900 border border-emerald-300 dark:bg-emerald-950 dark:text-emerald-200 dark:border-emerald-700 font-mono font-bold">
                          CONFIRMED_OBJECTIVE
                        </span>
                      )}
                      {all.state === 'REPORTED_UNVERIFIED' && (
                        <span className="text-[11px] px-2 py-0.5 rounded bg-sky-100 text-sky-900 border border-sky-300 dark:bg-sky-950 dark:text-sky-200 dark:border-sky-700 font-mono font-bold">
                          REPORTED_UNVERIFIED
                        </span>
                      )}
                      {all.state === 'PATIENT_UNKNOWN' && (
                        <span className="text-[11px] px-2 py-0.5 rounded bg-purple-100 text-purple-900 border border-purple-300 dark:bg-purple-950 dark:text-purple-200 dark:border-purple-700 font-mono font-bold">
                          PATIENT_UNKNOWN
                        </span>
                      )}
                      {all.state === 'NOT_COLLECTED' && (
                        <span className="text-[11px] px-2 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300 dark:bg-amber-950 dark:text-amber-200 dark:border-amber-700 font-mono font-bold">
                          NOT_COLLECTED
                        </span>
                      )}
                      {all.state === 'CLINICALLY_IRRELEVANT' && (
                        <span className="text-[11px] px-2 py-0.5 rounded bg-slate-200 text-slate-900 border border-slate-300 dark:bg-slate-700 dark:text-slate-100 dark:border-slate-600 font-mono font-bold">
                          CLINICALLY_IRRELEVANT
                        </span>
                      )}
                      {all.reaction && <span className="text-xs text-slate-700 dark:text-slate-300 italic font-medium">({all.reaction})</span>}
                    </div>
                    <button
                      type="button"
                      onClick={() => removeAllergy(idx)}
                      className="text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 transition-colors p-1"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}

                <div className="flex items-center gap-2 pt-1 flex-wrap sm:flex-nowrap">
                  <input
                    type="text"
                    value={newAllergen}
                    onChange={(e) => setNewAllergen(e.target.value)}
                    placeholder="e.g. Sulfonamides, Penicillin, NSAIDs"
                    className="flex-1 px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-md text-xs text-slate-900 dark:text-white placeholder-slate-500 dark:placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-500 font-medium"
                  />
                  <select
                    value={newAllergyState}
                    onChange={(e) => setNewAllergyState(e.target.value as AllergyEpistemicState)}
                    className="px-2 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-md text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-emerald-500 font-semibold"
                  >
                    <option value="CONFIRMED_OBJECTIVE">CONFIRMED_OBJECTIVE</option>
                    <option value="REPORTED_UNVERIFIED">REPORTED_UNVERIFIED</option>
                    <option value="PATIENT_UNKNOWN">PATIENT_UNKNOWN</option>
                    <option value="NOT_COLLECTED">NOT_COLLECTED</option>
                    <option value="CLINICALLY_IRRELEVANT">CLINICALLY_IRRELEVANT</option>
                  </select>
                  <Button type="button" size="sm" variant="secondary" onClick={addAllergy} className="font-bold border border-slate-300 dark:border-slate-600">
                    Add
                  </Button>
                </div>
              </div>
            </div>

            {/* Card 5: Proposed Counter Regimen */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-xs space-y-4">
              <div className="border-b border-slate-100 dark:border-slate-800 pb-3 flex items-center justify-between">
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                  5. Proposed Counter Regimen & Dispensing Items
                </h2>
                <span className="text-xs text-slate-700 dark:text-slate-300 font-semibold">Dispensing Classification</span>
              </div>

              {/* Preset quick buttons */}
              <div className="flex flex-wrap gap-1.5">
                <span className="text-xs text-slate-800 dark:text-slate-200 font-bold self-center mr-1">Common Presets:</span>
                {PRESET_MEDICATIONS.map((preset, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => addPresetMed(preset)}
                    className="px-2.5 py-1 rounded bg-slate-100 hover:bg-emerald-50 text-slate-800 hover:text-emerald-900 border border-slate-300 hover:border-emerald-400 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-100 dark:border-slate-600 text-xs flex items-center gap-1 font-bold transition-colors shadow-2xs"
                  >
                    <Plus className="w-3 h-3 text-emerald-700 dark:text-emerald-400" />
                    {preset.name}
                  </button>
                ))}
              </div>

              {/* Items List */}
              <div className="space-y-2">
                {items.map((it, idx) => (
                  <div key={idx} className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 flex items-center justify-between text-sm">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-950 dark:text-white">{it.drug_name}</span>
                        <span className="text-xs text-slate-700 dark:text-slate-300 font-medium">{it.strength} • {it.dosage_form}</span>
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${
                          it.legal_category === 'POM'
                            ? 'bg-rose-100 text-rose-900 border-rose-300 dark:bg-rose-950 dark:text-rose-200 dark:border-rose-700'
                            : it.legal_category === 'P'
                            ? 'bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950 dark:text-amber-200 dark:border-amber-700'
                            : 'bg-emerald-100 text-emerald-900 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-200 dark:border-emerald-700'
                        }`}>
                          {it.legal_category}
                        </span>
                      </div>
                      <div className="text-xs text-slate-800 dark:text-slate-200 mt-1 font-medium">
                        Dose: {it.dose_amount} {it.dose_unit} • {it.frequency} for {it.duration_days} days ({it.route})
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeItem(idx)}
                      className="text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 transition-colors p-1"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}

                {items.length === 0 && (
                  <div className="p-4 text-center text-xs text-slate-700 dark:text-slate-300 border border-dashed border-slate-300 dark:border-slate-700 rounded-lg font-medium">
                    No medications proposed yet. Use quick-presets above or proceed to red-flag triage only.
                  </div>
                )}
              </div>
            </div>

            {/* Run Verification Button */}
            <div className="pt-2">
              <Button
                type="submit"
                variant="primary"
                size="lg"
                className="w-full justify-center shadow-sm"
                disabled={isSubmitting}
                icon={<ShieldAlert className="w-5 h-5" />}
              >
                {isSubmitting ? 'Evaluating Clinical Triage...' : 'Execute Red-Flag Triage & Safety Verification'}
              </Button>
            </div>
          </form>
        </div>

        {/* Right Column: Verification Results, Emergency Red Flags & Pharmacist Oversight (5 Cols) */}
        <div className="lg:col-span-5 space-y-6">
          {activeConsultation ? (
            <div className="space-y-5">
              {/* Emergency Red Flag Alert Banner */}
              {activeConsultation.referral_triggered ? (
                <div className="p-5 rounded-xl bg-rose-50 dark:bg-rose-950/90 border-2 border-rose-500 dark:border-rose-600 text-rose-900 dark:text-rose-100 shadow-md space-y-3 animate-pulse">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-rose-100 dark:bg-rose-900 border border-rose-300 dark:border-rose-500 text-rose-700 dark:text-rose-200">
                      <AlertTriangle className="w-7 h-7" />
                    </div>
                    <div>
                      <div className="text-xs uppercase font-extrabold tracking-wider text-rose-700 dark:text-rose-300">
                        Critical Clinical Warning
                      </div>
                      <h3 className="text-base font-black text-rose-950 dark:text-white">EMERGENCY HOSPITAL REFERRAL TRIGGERED</h3>
                    </div>
                  </div>

                  <p className="text-xs text-rose-800 dark:text-rose-200">
                    <strong>Primary Reason:</strong> {activeConsultation.referral_reason}
                  </p>

                  <div className="p-3 rounded-lg bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-800 text-xs space-y-1.5 text-slate-800 dark:text-slate-200">
                    <div className="font-semibold text-rose-700 dark:text-rose-400">Mandated Action:</div>
                    <div>• Withhold routine oral counter antimalarial or antimicrobial treatment.</div>
                    <div>• Issue immediate hospital emergency referral note.</div>
                    <div>• Pre-referral rectal artesunate administration: BLOCKED_PENDING_CLINICAL_APPROVAL.</div>
                  </div>

                  <Button
                    variant="danger"
                    size="sm"
                    className="w-full justify-center"
                    onClick={() => setShowReferralModal(true)}
                    icon={<FileText className="w-4 h-4" />}
                  >
                    View & Print Emergency Referral Note
                  </Button>
                </div>
              ) : (
                <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/80 border border-emerald-300 dark:border-emerald-700 text-emerald-900 dark:text-emerald-200 flex items-center gap-3">
                  <CheckCircle2 className="w-6 h-6 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <div>
                    <h3 className="text-sm font-bold text-emerald-950 dark:text-white">No Critical Red Flags Detected</h3>
                    <p className="text-xs text-emerald-800 dark:text-emerald-300 mt-0.5">
                      Presentation is suitable for community pharmacist care under standard clinical guidelines.
                    </p>
                  </div>
                </div>
              )}

              {/* Findings List */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-xs space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-slate-100 border-b border-slate-100 dark:border-slate-800 pb-2">
                  Deterministic Verification Findings ({activeConsultation.findings.length})
                </h3>

                {activeConsultation.findings.length === 0 ? (
                  <div className="text-xs text-slate-700 dark:text-slate-300 py-3 text-center font-medium">
                    Zero rule violations. All clinical checks cleared.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {activeConsultation.findings.map((f) => (
                      <div key={f.id} className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-mono font-bold text-slate-900 dark:text-slate-100">[{f.rule_identifier}]</span>
                          <SeverityBadge severity={f.severity} />
                        </div>
                        <div className="text-sm font-bold text-slate-950 dark:text-white">{f.title}</div>
                        <p className="text-xs text-slate-800 dark:text-slate-200 leading-relaxed font-normal">{f.description}</p>
                        <div className={`text-xs pt-1 font-semibold ${
                          f.is_red_flag ? 'text-rose-800 dark:text-rose-300' : 'text-amber-800 dark:text-amber-300'
                        }`}>
                          Action: {f.action_required}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Pharmacist Action Bar & Lifecycle Transition */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-xs space-y-4">
                <div className="border-b border-slate-100 dark:border-slate-800 pb-2 flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-slate-100">
                    Pharmacist Clinical Decision & Sign-Off
                  </h3>
                  <span className={`text-xs font-mono px-2.5 py-0.5 rounded font-bold border ${
                    activeConsultation.status === 'VERIFICATION_COMPLETED'
                      ? 'bg-sky-100 text-sky-900 border-sky-300 dark:bg-sky-950 dark:text-sky-200 dark:border-sky-700'
                      : activeConsultation.status === 'APPROVED_FOR_DISPENSING' || activeConsultation.status === 'COMPLETED'
                      ? 'bg-emerald-100 text-emerald-900 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-200 dark:border-emerald-700'
                      : activeConsultation.status === 'REFERRED'
                      ? 'bg-rose-100 text-rose-900 border-rose-300 dark:bg-rose-950 dark:text-rose-200 dark:border-rose-700'
                      : 'bg-slate-200 text-slate-900 border-slate-300 dark:bg-slate-700 dark:text-slate-100 dark:border-slate-600'
                  }`}>
                    {activeConsultation.status}
                  </span>
                </div>

                <div className="space-y-2">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">Clinical Consultation Notes:</label>
                  <textarea
                    rows={2}
                    value={pharmacistNotes}
                    onChange={(e) => setPharmacistNotes(e.target.value)}
                    placeholder="Enter notes on patient counseling, fluids, red-flag return warnings..."
                    className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-md text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div className="flex flex-col gap-2 pt-2">
                  {activeConsultation.status === 'VERIFICATION_COMPLETED' && (
                    <Button
                      variant="primary"
                      onClick={() => handleTransition('FINDINGS_REVIEWED')}
                      className="w-full justify-center"
                      icon={<CheckCircle2 className="w-4 h-4" />}
                    >
                      Acknowledge & Review Findings
                    </Button>
                  )}

                  {activeConsultation.status === 'FINDINGS_REVIEWED' && (
                    <>
                      {activeConsultation.referral_triggered ? (
                        <>
                          <Button
                            variant="danger"
                            onClick={() => handleTransition('REFERRED')}
                            className="w-full justify-center"
                            icon={<FileText className="w-4 h-4" />}
                          >
                            Dispatch Emergency Referral
                          </Button>
                          {activeConsultation.referral_urgency === 'EMERGENCY' ? (
                            <div className="p-2.5 rounded bg-rose-50 dark:bg-rose-950/70 border border-rose-300 dark:border-rose-800 text-rose-900 dark:text-rose-200 text-xs text-center font-medium">
                              Safety Invariant: Emergency referral cannot be overridden. Mandatory hospital transfer required.
                            </div>
                          ) : (
                            <Button
                              variant="secondary"
                              onClick={() => setShowOverrideModal(true)}
                              className="w-full justify-center text-xs"
                            >
                              Override Flag with Clinical Justification
                            </Button>
                          )}
                        </>
                      ) : (
                        <Button
                          variant="primary"
                          onClick={() => handleTransition('APPROVED_FOR_DISPENSING')}
                          className="w-full justify-center"
                          icon={<CheckCircle2 className="w-4 h-4" />}
                        >
                          Approve for Dispensing
                        </Button>
                      )}
                      <Button
                        variant="secondary"
                        onClick={() => handleTransition('PRESCRIBER_CLARIFICATION_PENDING')}
                        className="w-full justify-center text-xs"
                      >
                        Prescriber Clarification Required
                      </Button>
                    </>
                  )}

                  {activeConsultation.status === 'APPROVED_FOR_DISPENSING' && (
                    <Button
                      variant="primary"
                      onClick={() => handleTransition('COMPLETED')}
                      className="w-full justify-center"
                      icon={<CheckCircle2 className="w-4 h-4" />}
                    >
                      Record Dispensing & Complete Encounter
                    </Button>
                  )}

                  {activeConsultation.status === 'REFERRED' && (
                    <Button
                      variant="secondary"
                      onClick={() => handleTransition('COMPLETED')}
                      className="w-full justify-center"
                      icon={<CheckCircle2 className="w-4 h-4" />}
                    >
                      Acknowledge Referral Hand-Off & Close
                    </Button>
                  )}

                  {activeConsultation.status === 'COMPLETED' && (
                    <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-center text-xs text-emerald-800 dark:text-emerald-300 font-semibold">
                      ✓ Consultation Encounter Completed (v{activeConsultation.version})
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-8 text-center space-y-4 shadow-xs">
              <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center mx-auto text-slate-500 dark:text-slate-400">
                <FileText className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">No Active Consultation</h3>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 max-w-xs mx-auto">
                  Complete the intake fields on the left or select a 1-click test scenario above, then click "Execute Red-Flag Triage".
                </p>
              </div>
            </div>
          )}

          {/* Recent Walk-In Consultations Ledger */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-2">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                Recent Counter Consultations ({recentConsultations.length})
              </h3>
              <button
                type="button"
                onClick={loadConsultations}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              </button>
            </div>

            <div className="space-y-1.5 max-h-64 overflow-y-auto">
              {recentConsultations.map((c) => (
                <div
                  key={c.id}
                  onClick={() => setActiveConsultation(c)}
                  className={`p-2.5 rounded-lg border text-xs cursor-pointer transition-colors flex items-center justify-between ${
                    activeConsultation?.id === c.id
                      ? 'bg-emerald-50 dark:bg-slate-800 border-emerald-500'
                      : 'bg-slate-50 hover:bg-slate-100 dark:bg-slate-800/60 dark:hover:bg-slate-800 border-slate-200 dark:border-slate-700/80'
                  }`}
                >
                  <div>
                    <div className="font-bold text-slate-950 dark:text-white flex items-center gap-1.5">
                      {c.consultation_number}
                      {c.referral_triggered && (
                        <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse"></span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-700 dark:text-slate-300 font-medium">
                      {c.patient_identifier} • {c.age_years ? `${c.age_years}y` : `${c.age_months}m`}
                    </div>
                  </div>
                  <div className="text-right">
                    <span className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold border ${
                      c.status === 'VERIFICATION_COMPLETED'
                        ? 'bg-sky-100 text-sky-900 border-sky-300 dark:bg-sky-950 dark:text-sky-200 dark:border-sky-700'
                        : c.status === 'APPROVED_FOR_DISPENSING' || c.status === 'COMPLETED'
                        ? 'bg-emerald-100 text-emerald-900 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-200 dark:border-emerald-700'
                        : c.status === 'REFERRED'
                        ? 'bg-rose-100 text-rose-900 border-rose-300 dark:bg-rose-950 dark:text-rose-200 dark:border-rose-700'
                        : 'bg-slate-200 text-slate-900 border-slate-300 dark:bg-slate-700 dark:text-slate-100 dark:border-slate-600'
                    }`}>
                      {c.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* MODAL 1: Emergency Referral Note Modal */}
      {showReferralModal && activeConsultation && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border-2 border-slate-300 dark:border-slate-700 rounded-xl max-w-2xl w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2 text-rose-700 dark:text-rose-400 font-extrabold text-sm uppercase tracking-wide">
                <AlertTriangle className="w-5 h-5" />
                <span>Clinical Emergency Referral & Transfer Note</span>
              </div>
              <button
                type="button"
                onClick={() => setShowReferralModal(false)}
                className="text-slate-600 hover:text-slate-950 dark:text-slate-400 dark:hover:text-white font-bold p-1"
              >
                ✕
              </button>
            </div>

            {/* Document Body with High Contrast & Print Id */}
            <div id="printable-referral-note" className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg p-5 space-y-4 text-xs text-slate-900 dark:text-slate-100 max-h-[70vh] overflow-y-auto">
              <div className="border-b-2 border-slate-900 dark:border-slate-300 pb-3 flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h2 className="text-sm font-extrabold tracking-tight uppercase text-slate-950 dark:text-white">
                    Clinical Emergency Referral & Transfer Note
                  </h2>
                  <p className="text-[11px] text-slate-700 dark:text-slate-300 mt-0.5 font-medium">
                    Community Pharmacy Walk-In Encounter & Safety Assessment
                  </p>
                </div>
                <div className="text-right">
                  <span className="inline-block px-2.5 py-0.5 rounded bg-rose-100 text-rose-950 dark:bg-rose-950 dark:text-rose-200 border border-rose-300 dark:border-rose-700 font-bold text-[10px] uppercase tracking-wider">
                    Emergency Transfer
                  </span>
                  <div className="text-[10px] text-slate-700 dark:text-slate-300 font-mono mt-0.5 font-semibold">
                    Ref: {activeConsultation.consultation_number}
                  </div>
                </div>
              </div>

              {/* Patient Vitals Summary */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-slate-50 dark:bg-slate-800/80 p-3 rounded-md border border-slate-300 dark:border-slate-700 text-xs">
                <div>
                  <span className="text-slate-700 dark:text-slate-300 block text-[10px] font-bold">Patient Code</span>
                  <span className="font-bold text-slate-950 dark:text-white">{activeConsultation.patient_identifier}</span>
                </div>
                <div>
                  <span className="text-slate-700 dark:text-slate-300 block text-[10px] font-bold">Age / Gender</span>
                  <span className="font-bold text-slate-950 dark:text-white">
                    {activeConsultation.age_years ? `${activeConsultation.age_years}y` : `${activeConsultation.age_months}m`} / {activeConsultation.gender || 'N/A'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-700 dark:text-slate-300 block text-[10px] font-bold">Weight</span>
                  <span className="font-bold text-slate-950 dark:text-white">{activeConsultation.weight_kg ? `${activeConsultation.weight_kg} kg` : 'Unmeasured'}</span>
                </div>
                <div>
                  <span className="text-slate-700 dark:text-slate-300 block text-[10px] font-bold">Vitals</span>
                  <span className="font-bold text-slate-950 dark:text-white">
                    {activeConsultation.temperature_c ?? 'N/A'}°C • {activeConsultation.sbp_mmhg ?? 'N/A'}/{activeConsultation.dbp_mmhg ?? 'N/A'} mmHg
                  </span>
                </div>
              </div>

              {/* Primary Clinical Reason */}
              <div className="p-3 rounded-md bg-rose-50 dark:bg-rose-950/70 border border-rose-300 dark:border-rose-800 text-xs space-y-1">
                <div className="font-bold text-rose-950 dark:text-rose-200 flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400 shrink-0" />
                  Primary Clinical Reason for Hospital Referral:
                </div>
                <div className="text-rose-950 dark:text-rose-100 font-bold pl-5">
                  {activeConsultation.referral_reason}
                </div>
              </div>

              {/* Clinical Summary & Mandated Actions */}
              <div className="space-y-2">
                <div className="font-bold uppercase tracking-wider text-slate-900 dark:text-slate-100 border-b border-slate-200 dark:border-slate-800 pb-1 text-[11px]">
                  Clinical Findings & Mandatory Transfer Directives:
                </div>
                <div className="space-y-2">
                  {activeConsultation.findings.filter((f) => f.requires_referral).map((f) => (
                    <div key={f.id} className="p-2.5 rounded bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 space-y-1">
                      <div className="font-bold text-slate-950 dark:text-white flex items-center gap-2">
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-rose-100 text-rose-900 border border-rose-300 font-bold">
                          {f.rule_identifier}
                        </span>
                        <span>{f.title}</span>
                      </div>
                      <p className="text-slate-800 dark:text-slate-200 text-xs leading-relaxed font-normal">{f.description}</p>
                      <div className="text-rose-900 dark:text-rose-200 font-bold text-xs mt-1">
                        Mandated Action: {f.action_required}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Disposition & Clinician Signature Line */}
              <div className="border-t border-slate-300 dark:border-slate-700 pt-3 flex flex-wrap justify-between items-end gap-2 text-[11px] text-slate-700 dark:text-slate-300">
                <div>
                  <div><strong className="text-slate-950 dark:text-white">Disposition:</strong> Immediate transfer to nearest emergency center.</div>
                  <div className="text-slate-600 dark:text-slate-400 font-medium">PharmacyGuard Clinical Decision Support</div>
                </div>
                <div className="text-right">
                  <div className="font-mono text-slate-900 dark:text-slate-100 font-bold">{new Date(activeConsultation.created_at).toUTCString()}</div>
                  <div className="text-slate-600 dark:text-slate-400 font-medium">Electronic Clinician Record</div>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  navigator.clipboard.writeText(activeConsultation.referral_notes || '');
                  alert('Referral note copied to clipboard!');
                }}
                className="font-bold text-slate-900 dark:text-slate-100 border border-slate-400 dark:border-slate-600"
              >
                Copy Text
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  window.print();
                }}
                icon={<Printer className="w-4 h-4" />}
                className="font-bold shadow-sm"
              >
                Print Referral Note
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: Clinical Override Justification Modal */}
      {showOverrideModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border-2 border-slate-300 dark:border-slate-700 rounded-xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <h3 className="text-base font-bold text-slate-950 dark:text-white flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-amber-500" />
              Pharmacist Red-Flag Clinical Override
            </h3>
            <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed font-medium">
              An emergency red flag was detected for this patient. Dispensing without referral is restricted under
              statutory clinical safety guidelines and healthcare protocols. A formal clinical justification (minimum 10 characters) is legally required.
            </p>

            <textarea
              rows={3}
              value={overrideRationale}
              onChange={(e) => setOverrideRationale(e.target.value)}
              placeholder="Document your clinical rationale (e.g. physician confirmed outpatient safety, acute transfer arranged)..."
              className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-md text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />

            <div className="flex justify-end gap-3 pt-2">
              <Button variant="secondary" size="sm" onClick={() => setShowOverrideModal(false)}>
                Cancel
              </Button>
              <Button
                variant="danger"
                size="sm"
                disabled={overrideRationale.trim().length < 10}
                onClick={() => handleTransition('APPROVED_FOR_DISPENSING', overrideRationale)}
              >
                Sign & Authorize Dispensing
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
