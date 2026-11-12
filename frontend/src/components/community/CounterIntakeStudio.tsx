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

  // Diagnostic screening
  const [mrdtStatus, setMrdtStatus] = useState<MRDTStatus>('CONFIRMED_POSITIVE');
  const [g6pdStatus, setG6pdStatus] = useState<G6PDEpistemicStatus>('REPORTED_UNKNOWN');

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
      mrdt_status: mrdtStatus,
      g6pd_status: g6pdStatus,
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
    <div className="flex flex-col h-full bg-slate-900 text-slate-100 overflow-y-auto" data-testid="counter-intake-studio">
      {/* Top Banner Header */}
      <div className="bg-slate-800/90 border-b border-slate-700/80 px-6 py-4 flex flex-wrap items-center justify-between gap-4 sticky top-0 z-20 backdrop-blur">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
            <UserCheck className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight text-white">Community Counter Consultation Studio</h1>
              <span className="px-2 py-0.5 text-xs font-semibold rounded bg-emerald-950 text-emerald-400 border border-emerald-800">
                Phase 2 Prototype
              </span>
              <span className="px-2 py-0.5 text-xs font-semibold rounded bg-slate-700 text-slate-300">
                Synthetic Intake Mode
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Structured counter presentation, rapid vitals intake, malaria mRDT triage, and Ghana STG red-flag safety verification.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {activeConsultation && (
            <div className="flex items-center gap-2 bg-slate-900/80 px-3 py-1.5 rounded-lg border border-slate-700 text-xs">
              <span className="text-slate-400 font-mono">{activeConsultation.consultation_number}</span>
              <span className="font-semibold text-emerald-400 uppercase tracking-wider">{activeConsultation.status}</span>
            </div>
          )}
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              setActiveConsultation(null);
              setPatientId(`SYN-WI-${Math.floor(1000 + Math.random() * 9000)}`);
              setErrorMessage(null);
            }}
            icon={<Plus className="w-4 h-4" />}
          >
            New Consultation
          </Button>
        </div>
      </div>

      {errorMessage && (
        <div className="mx-6 mt-4 p-4 rounded-lg bg-rose-950/80 border border-rose-800 text-rose-200 text-sm flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
          <div>
            <div className="font-semibold">Clinical / Safety Notice:</div>
            <div>{errorMessage}</div>
          </div>
        </div>
      )}

      {/* Main Workspace Layout (2 Columns) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 p-6">
        {/* Left Column: Form Intake (7 Cols) */}
        <div className="lg:col-span-7 space-y-6">
          <form onSubmit={handleSubmitConsultation} className="space-y-6">
            {/* Card 1: Demographics & Vitals */}
            <div className="bg-slate-800/80 border border-slate-700/80 rounded-xl p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-700 pb-3">
                <h2 className="text-sm font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                  1. Walk-In Patient Demographics & Vitals
                </h2>
                <span className="text-xs text-slate-400 font-mono">{patientId}</span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Age (Years)</label>
                  <input
                    type="number"
                    min="0"
                    max="120"
                    value={ageYears}
                    onChange={(e) => setAgeYears(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-md text-sm text-white focus:ring-1 focus:ring-emerald-500"
                    placeholder="e.g. 28"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Age (Months if &lt;5y)</label>
                  <input
                    type="number"
                    min="0"
                    max="59"
                    value={ageMonths}
                    onChange={(e) => setAgeMonths(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-md text-sm text-white focus:ring-1 focus:ring-emerald-500"
                    placeholder="e.g. 18"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Gender</label>
                  <select
                    value={gender}
                    onChange={(e) => setGender(e.target.value as any)}
                    className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-md text-sm text-white focus:ring-1 focus:ring-emerald-500"
                  >
                    <option value="FEMALE">Female</option>
                    <option value="MALE">Male</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Weight (kg)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={weightKg}
                    onChange={(e) => setWeightKg(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-md text-sm text-white focus:ring-1 focus:ring-emerald-500"
                    placeholder="e.g. 62.5"
                  />
                </div>
              </div>

              {/* Vitals Row */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-2">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Temp (°C)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={tempC}
                    onChange={(e) => setTempC(e.target.value === '' ? '' : Number(e.target.value))}
                    className={`w-full px-3 py-1.5 bg-slate-900 border rounded-md text-sm text-white ${
                      tempC !== '' && Number(tempC) >= 38.0 ? 'border-amber-500/80 text-amber-300 font-semibold' : 'border-slate-700'
                    }`}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">BP (mmHg)</label>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      placeholder="SBP"
                      value={sbp}
                      onChange={(e) => setSbp(e.target.value === '' ? '' : Number(e.target.value))}
                      className="w-1/2 px-2 py-1.5 bg-slate-900 border border-slate-700 rounded-md text-xs text-white"
                    />
                    <span className="text-slate-500">/</span>
                    <input
                      type="number"
                      placeholder="DBP"
                      value={dbp}
                      onChange={(e) => setDbp(e.target.value === '' ? '' : Number(e.target.value))}
                      className="w-1/2 px-2 py-1.5 bg-slate-900 border border-slate-700 rounded-md text-xs text-white"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">HR (bpm)</label>
                  <input
                    type="number"
                    value={hr}
                    onChange={(e) => setHr(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-md text-sm text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">RR (bpm)</label>
                  <input
                    type="number"
                    value={rr}
                    onChange={(e) => setRr(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-md text-sm text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">SpO2 (%)</label>
                  <input
                    type="number"
                    value={spo2}
                    onChange={(e) => setSpo2(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-md text-sm text-white"
                  />
                </div>
              </div>
            </div>

            {/* Card 2: Ghana Diagnostics & Epistemic Screening */}
            <div className="bg-slate-800/80 border border-slate-700/80 rounded-xl p-5 shadow-sm space-y-4">
              <div className="border-b border-slate-700 pb-3 flex items-center justify-between">
                <h2 className="text-sm font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                  2. Ghana Diagnostic & Epistemic Screening
                </h2>
                <span className="text-xs text-slate-400">5-State Clinical Uncertainty Model</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5 flex items-center gap-1.5">
                    Malaria Rapid Diagnostic Test (mRDT)
                    <Info className="w-3.5 h-3.5 text-slate-400" />
                  </label>
                  <select
                    value={mrdtStatus}
                    onChange={(e) => setMrdtStatus(e.target.value as MRDTStatus)}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-md text-sm text-white focus:ring-1 focus:ring-emerald-500"
                  >
                    <option value="CONFIRMED_POSITIVE">Confirmed Positive (Pf / Pan-specific)</option>
                    <option value="CONFIRMED_NEGATIVE">Confirmed Negative</option>
                    <option value="TESTING_UNAVAILABLE">Testing Unavailable (Stock-Out / Defective)</option>
                    <option value="NOT_DONE">Not Done</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5 flex items-center gap-1.5">
                    G6PD Deficiency Status (Ghana STG)
                    <Info className="w-3.5 h-3.5 text-slate-400" />
                  </label>
                  <select
                    value={g6pdStatus}
                    onChange={(e) => setG6pdStatus(e.target.value as G6PDEpistemicStatus)}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-md text-sm text-white focus:ring-1 focus:ring-emerald-500"
                  >
                    <option value="REPORTED_UNKNOWN">REPORTED_UNKNOWN (Patient Unaware)</option>
                    <option value="NOT_COLLECTED">NOT_COLLECTED (Not Inquired)</option>
                    <option value="CONFIRMED_NORMAL">CONFIRMED_NORMAL (Official Lab Record)</option>
                    <option value="CONFIRMED_DEFICIENT">CONFIRMED_DEFICIENT (High Hemolysis Risk)</option>
                    <option value="NOT_TESTED">NOT_TESTED (Never Tested)</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Card 3: Symptoms & Red-Flag Checklist */}
            <div className="bg-slate-800/80 border border-slate-700/80 rounded-xl p-5 shadow-sm space-y-4">
              <div className="border-b border-slate-700 pb-3 flex items-center justify-between">
                <h2 className="text-sm font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                  3. Presenting Complaints & Red-Flag Triage
                </h2>
                <span className="text-xs text-slate-400">Quick-Select Clinical Presentation</span>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Chief Complaint & Encounter Description</label>
                <textarea
                  rows={2}
                  value={chiefComplaint}
                  onChange={(e) => setChiefComplaint(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-md text-sm text-white focus:ring-1 focus:ring-emerald-500"
                  placeholder="Summarize the presenting clinical complaint..."
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-2">Select Active Presenting Symptoms & Warning Signs:</label>
                <div className="flex flex-wrap gap-1.5">
                  {COMMON_SYMPTOMS.map((sym) => {
                    const isSelected = selectedSymptoms.includes(sym.id);
                    const isSevere = sym.category.startsWith('severe') || sym.category === 'meningitis';
                    return (
                      <button
                        key={sym.id}
                        type="button"
                        onClick={() => toggleSymptom(sym.id)}
                        className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors border ${
                          isSelected
                            ? isSevere
                              ? 'bg-rose-950 text-rose-300 border-rose-700 ring-1 ring-rose-500'
                              : 'bg-emerald-950 text-emerald-300 border-emerald-700 ring-1 ring-emerald-500'
                            : 'bg-slate-900 text-slate-400 border-slate-700/80 hover:border-slate-600'
                        }`}
                      >
                        {sym.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Card 4: Allergy Profile (5-State Model) */}
            <div className="bg-slate-800/80 border border-slate-700/80 rounded-xl p-5 shadow-sm space-y-4">
              <div className="border-b border-slate-700 pb-3 flex items-center justify-between">
                <h2 className="text-sm font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                  4. Patient Allergies & Adverse Drug History
                </h2>
                <span className="text-xs text-slate-400">Epistemic Status</span>
              </div>

              <div className="space-y-2">
                {allergies.map((all, idx) => (
                  <div key={idx} className="flex items-center justify-between p-2.5 rounded-lg bg-slate-900/90 border border-slate-700 text-sm">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-white">{all.allergen}</span>
                      {all.state === 'CONFIRMED_OBJECTIVE' && (
                        <span className="text-xs px-2 py-0.5 rounded bg-emerald-950/80 text-emerald-300 border border-emerald-600/50 font-mono font-medium">
                          CONFIRMED_OBJECTIVE
                        </span>
                      )}
                      {all.state === 'REPORTED_UNVERIFIED' && (
                        <span className="text-xs px-2 py-0.5 rounded bg-sky-950/80 text-sky-300 border border-sky-600/50 font-mono font-medium">
                          REPORTED_UNVERIFIED
                        </span>
                      )}
                      {all.state === 'PATIENT_UNKNOWN' && (
                        <span className="text-xs px-2 py-0.5 rounded bg-purple-950/80 text-purple-300 border border-purple-600/50 font-mono font-medium">
                          PATIENT_UNKNOWN
                        </span>
                      )}
                      {all.state === 'NOT_COLLECTED' && (
                        <span className="text-xs px-2 py-0.5 rounded bg-amber-950/80 text-amber-300 border border-amber-600/50 font-mono font-medium">
                          NOT_COLLECTED
                        </span>
                      )}
                      {all.state === 'CLINICALLY_IRRELEVANT' && (
                        <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700 font-mono font-medium">
                          CLINICALLY_IRRELEVANT
                        </span>
                      )}
                      {all.reaction && <span className="text-xs text-slate-400 italic">({all.reaction})</span>}
                    </div>
                    <button
                      type="button"
                      onClick={() => removeAllergy(idx)}
                      className="text-slate-400 hover:text-rose-400 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}

                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="text"
                    value={newAllergen}
                    onChange={(e) => setNewAllergen(e.target.value)}
                    placeholder="e.g. Sulfonamides, Penicillin, NSAIDs"
                    className="flex-1 px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-md text-xs text-white"
                  />
                  <select
                    value={newAllergyState}
                    onChange={(e) => setNewAllergyState(e.target.value as AllergyEpistemicState)}
                    className="px-2 py-1.5 bg-slate-900 border border-slate-700 rounded-md text-xs text-white"
                  >
                    <option value="CONFIRMED_OBJECTIVE">CONFIRMED_OBJECTIVE</option>
                    <option value="REPORTED_UNVERIFIED">REPORTED_UNVERIFIED</option>
                    <option value="PATIENT_UNKNOWN">PATIENT_UNKNOWN</option>
                    <option value="NOT_COLLECTED">NOT_COLLECTED</option>
                    <option value="CLINICALLY_IRRELEVANT">CLINICALLY_IRRELEVANT</option>
                  </select>
                  <Button type="button" size="sm" variant="secondary" onClick={addAllergy}>
                    Add
                  </Button>
                </div>
              </div>
            </div>

            {/* Card 5: Proposed Counter Regimen */}
            <div className="bg-slate-800/80 border border-slate-700/80 rounded-xl p-5 shadow-sm space-y-4">
              <div className="border-b border-slate-700 pb-3 flex items-center justify-between">
                <h2 className="text-sm font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                  5. Proposed Counter Regimen & Dispensing Items
                </h2>
                <span className="text-xs text-slate-400">Act 857 Categorization</span>
              </div>

              {/* Preset quick buttons */}
              <div className="flex flex-wrap gap-1.5">
                <span className="text-xs text-slate-400 self-center mr-1">Ghana Presets:</span>
                {PRESET_MEDICATIONS.map((preset, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => addPresetMed(preset)}
                    className="px-2 py-1 rounded bg-slate-900/90 hover:bg-slate-700 border border-slate-700 text-xs text-slate-300 flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3 text-emerald-400" />
                    {preset.name}
                  </button>
                ))}
              </div>

              {/* Items List */}
              <div className="space-y-2">
                {items.map((it, idx) => (
                  <div key={idx} className="p-3 rounded-lg bg-slate-900/90 border border-slate-700 flex items-center justify-between text-sm">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white">{it.drug_name}</span>
                        <span className="text-xs text-slate-400">{it.strength} • {it.dosage_form}</span>
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${
                          it.legal_category === 'POM'
                            ? 'bg-rose-950/80 text-rose-300 border-rose-700'
                            : it.legal_category === 'P'
                            ? 'bg-amber-950/80 text-amber-300 border-amber-700'
                            : 'bg-emerald-950/80 text-emerald-300 border-emerald-700'
                        }`}>
                          {it.legal_category}
                        </span>
                      </div>
                      <div className="text-xs text-slate-400 mt-1">
                        Dose: {it.dose_amount} {it.dose_unit} • {it.frequency} for {it.duration_days} days ({it.route})
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeItem(idx)}
                      className="text-slate-400 hover:text-rose-400 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}

                {items.length === 0 && (
                  <div className="p-4 text-center text-xs text-slate-500 border border-dashed border-slate-700 rounded-lg">
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
                className="w-full justify-center shadow-lg"
                disabled={isSubmitting}
                icon={<ShieldAlert className="w-5 h-5 text-emerald-300" />}
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
                <div className="p-5 rounded-xl bg-rose-950/90 border-2 border-rose-600 text-rose-100 shadow-xl space-y-3 animate-pulse">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-rose-900 border border-rose-500 text-rose-200">
                      <AlertTriangle className="w-7 h-7" />
                    </div>
                    <div>
                      <div className="text-xs uppercase font-extrabold tracking-wider text-rose-300">
                        Critical Clinical Warning
                      </div>
                      <h3 className="text-lg font-black text-white">EMERGENCY HOSPITAL REFERRAL TRIGGERED</h3>
                    </div>
                  </div>

                  <p className="text-xs text-rose-200">
                    <strong>Primary Reason:</strong> {activeConsultation.referral_reason}
                  </p>

                  <div className="p-3 rounded-lg bg-slate-900/90 border border-rose-800 text-xs space-y-1.5 text-slate-200">
                    <div className="font-semibold text-rose-400">Mandated Action:</div>
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
                <div className="p-4 rounded-xl bg-emerald-950/80 border border-emerald-700 text-emerald-200 flex items-center gap-3">
                  <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0" />
                  <div>
                    <h3 className="text-sm font-bold text-white">No Critical Red Flags Detected</h3>
                    <p className="text-xs text-emerald-300 mt-0.5">
                      Presentation is suitable for community pharmacist care under Ghana STG guidelines.
                    </p>
                  </div>
                </div>
              )}

              {/* Findings List */}
              <div className="bg-slate-800/80 border border-slate-700/80 rounded-xl p-5 shadow-sm space-y-3">
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-300 border-b border-slate-700 pb-2">
                  Deterministic Verification Findings ({activeConsultation.findings.length})
                </h3>

                {activeConsultation.findings.length === 0 ? (
                  <div className="text-xs text-slate-400 py-3 text-center">
                    Zero rule violations. All clinical checks cleared.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {activeConsultation.findings.map((f) => (
                      <div key={f.id} className="p-3 rounded-lg bg-slate-900/90 border border-slate-700 space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-mono font-bold text-slate-300">[{f.rule_identifier}]</span>
                          <SeverityBadge severity={f.severity} />
                        </div>
                        <div className="text-sm font-semibold text-white">{f.title}</div>
                        <p className="text-xs text-slate-400">{f.description}</p>
                        <div className="text-xs text-amber-300 pt-1 font-medium">Action: {f.action_required}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Pharmacist Action Bar & Lifecycle Transition */}
              <div className="bg-slate-800/80 border border-slate-700/80 rounded-xl p-5 shadow-sm space-y-4">
                <div className="border-b border-slate-700 pb-2 flex items-center justify-between">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-slate-300">
                    Pharmacist Clinical Decision & Sign-Off
                  </h3>
                  <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-900 text-emerald-400 border border-slate-700">
                    {activeConsultation.status}
                  </span>
                </div>

                <div className="space-y-2">
                  <label className="block text-xs font-medium text-slate-400">Clinical Consultation Notes:</label>
                  <textarea
                    rows={2}
                    value={pharmacistNotes}
                    onChange={(e) => setPharmacistNotes(e.target.value)}
                    placeholder="Enter notes on patient counseling, fluids, red-flag return warnings..."
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-md text-xs text-white"
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
                            <div className="p-2.5 rounded bg-rose-950/70 border border-rose-800 text-rose-200 text-xs text-center font-medium">
                              Safety Invariant: Emergency referral cannot be overridden. Mandatory hospital transfer required under Ghana STG.
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
                    <div className="p-3 rounded-lg bg-emerald-950/60 border border-emerald-800 text-center text-xs text-emerald-300">
                      ✓ Consultation Encounter Completed (v{activeConsultation.version})
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-slate-800/80 border border-slate-700/80 rounded-xl p-8 text-center space-y-4">
              <div className="w-12 h-12 rounded-full bg-slate-900 border border-slate-700 flex items-center justify-center mx-auto text-slate-500">
                <FileText className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">No Active Consultation</h3>
                <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
                  Complete the counter intake fields on the left and click "Execute Red-Flag Triage" to run Ghana clinical rules.
                </p>
              </div>
            </div>
          )}

          {/* Recent Walk-In Consultations Ledger */}
          <div className="bg-slate-800/80 border border-slate-700/80 rounded-xl p-5 shadow-sm space-y-3">
            <div className="flex items-center justify-between border-b border-slate-700 pb-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                Recent Counter Consultations ({recentConsultations.length})
              </h3>
              <button
                type="button"
                onClick={loadConsultations}
                className="text-slate-400 hover:text-white transition-colors"
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
                      ? 'bg-slate-700/90 border-emerald-500'
                      : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div>
                    <div className="font-semibold text-white flex items-center gap-1.5">
                      {c.consultation_number}
                      {c.referral_triggered && (
                        <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-400">
                      {c.patient_identifier} • {c.age_years ? `${c.age_years}y` : `${c.age_months}m`}
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">
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
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-xl max-w-2xl w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-700 pb-3">
              <div className="flex items-center gap-2 text-rose-400 font-bold">
                <AlertTriangle className="w-5 h-5" />
                <span>Ghana Health Service — Emergency Referral Protocol Note</span>
              </div>
              <button
                type="button"
                onClick={() => setShowReferralModal(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="bg-slate-950 p-4 rounded-lg font-mono text-xs text-slate-200 whitespace-pre-wrap max-h-96 overflow-y-auto border border-slate-800">
              {activeConsultation.referral_notes}
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  navigator.clipboard.writeText(activeConsultation.referral_notes || '');
                  alert('Referral note copied to clipboard!');
                }}
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
              >
                Print Referral Note
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: Clinical Override Justification Modal */}
      {showOverrideModal && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-amber-400" />
              Pharmacist Red-Flag Clinical Override
            </h3>
            <p className="text-xs text-slate-300">
              An emergency red flag was detected for this patient. Dispensing without referral is restricted under
              Act 857 and clinical safety governance. A formal clinical justification (minimum 10 characters) is legally required.
            </p>

            <textarea
              rows={3}
              value={overrideRationale}
              onChange={(e) => setOverrideRationale(e.target.value)}
              placeholder="Document your clinical rationale (e.g. physician confirmed outpatient safety, acute transfer arranged)..."
              className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-md text-sm text-white"
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
