import React, { useRef } from 'react';
import {
  ShieldCheck,
  Printer,
  FileText,
  Calendar,
  User,
  Building,
  Hash,
} from 'lucide-react';
import { StudentSubmissionResponse } from '../../types/api';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';

export interface ClinicalReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  submission: StudentSubmissionResponse;
}

export const ClinicalReportModal: React.FC<ClinicalReportModalProps> = ({
  isOpen,
  onClose,
  submission,
}) => {
  const printAreaRef = useRef<HTMLDivElement>(null);
  const { feedback } = submission;

  const score = submission.score_awarded;
  const isMastery = score >= 90;
  const isPassing = score >= 70;

  const handlePrint = () => {
    window.print();
  };

  const getVerificationHash = () => {
    const raw = `${submission.case_code}-${submission.student_name}-${submission.id}-${submission.score_awarded}`;
    let hash = 0;
    for (let i = 0; i < raw.length; i++) {
      hash = (hash << 5) - hash + raw.charCodeAt(i);
      hash |= 0;
    }
    const hex = Math.abs(hash).toString(16).toUpperCase().padStart(8, '0');
    return `PG-CERT-${submission.case_code}-${hex}`;
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Official Clinical Assessment Report & Transcript"
      maxWidth="2xl"
    >
      <div className="space-y-6">
        {/* Quick Toolbar */}
        <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 text-xs">
          <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>Document Preview • Ready for Academic Portfolio or Residency Verification</span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              icon={<Printer className="w-3.5 h-3.5 text-indigo-600" />}
              onClick={handlePrint}
              data-testid="print-report-button"
            >
              Print / Save as PDF
            </Button>
          </div>
        </div>

        {/* Printable Official Document Sheet */}
        <div
          ref={printAreaRef}
          className="bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-700 rounded-2xl p-6 sm:p-8 shadow-sm space-y-6 text-slate-900 dark:text-white print:border-none print:shadow-none print:p-0"
          data-testid="clinical-report-document"
        >
          {/* Official Document Header */}
          <div className="border-b-2 border-slate-900 dark:border-slate-100 pb-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                <ShieldCheck className="w-7 h-7" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 dark:text-white uppercase font-sans">
                  PharmacyGuard Simulation Lab
                </h1>
                <p className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 uppercase tracking-widest mt-0.5">
                  Clinical Competency Evaluation & Verification Transcript
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  Central University School of Pharmacy • Department of Experiential Education
                </p>
              </div>
            </div>

            <div className="text-right sm:text-right shrink-0">
              <span className="font-mono text-[10px] uppercase font-bold px-2 py-1 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded text-slate-700 dark:text-slate-300">
                {getVerificationHash()}
              </span>
              <div className="text-[10px] text-slate-400 font-mono mt-1">
                Issued: {new Date(submission.submitted_at).toLocaleString()}
              </div>
            </div>
          </div>

          {/* Candidate & Encounter Metadata Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 text-xs">
            <div>
              <div className="text-[10px] text-slate-500 uppercase font-semibold flex items-center gap-1">
                <User className="w-3 h-3 text-slate-400" />
                Candidate Name
              </div>
              <div className="font-bold text-slate-900 dark:text-white mt-0.5">
                {submission.student_name || 'Alex Rivera'}
              </div>
              <div className="text-[10px] text-slate-500">P3 Pharmacy Candidate</div>
            </div>

            <div>
              <div className="text-[10px] text-slate-500 uppercase font-semibold flex items-center gap-1">
                <Hash className="w-3 h-3 text-slate-400" />
                Case Identifier
              </div>
              <div className="font-mono font-bold text-slate-900 dark:text-white mt-0.5">
                {submission.case_code}
              </div>
              <div className="text-[10px] text-slate-500 truncate">{submission.case_title}</div>
            </div>

            <div>
              <div className="text-[10px] text-slate-500 uppercase font-semibold flex items-center gap-1">
                <Calendar className="w-3 h-3 text-slate-400" />
                Attempt Number
              </div>
              <div className="font-bold text-slate-900 dark:text-white mt-0.5">
                Attempt #{submission.attempt_number}
              </div>
              <div className="text-[10px] text-slate-500">Longitudinal Record</div>
            </div>

            <div>
              <div className="text-[10px] text-slate-500 uppercase font-semibold flex items-center gap-1">
                <Building className="w-3 h-3 text-slate-400" />
                Academic Facility
              </div>
              <div className="font-bold text-slate-900 dark:text-white mt-0.5 truncate">
                Central University
              </div>
              <div className="text-[10px] text-slate-500">Clinical Simulation</div>
            </div>
          </div>

          {/* Certified Performance Banner */}
          <div className="p-5 rounded-xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="text-xs uppercase tracking-wider font-semibold text-slate-400">
                Official Clinical Standing
              </div>
              <div className="text-xl sm:text-2xl font-black">
                {isMastery
                  ? 'Clinical Mastery Achieved'
                  : isPassing
                  ? 'Satisfactory Clinical Competency Certified'
                  : 'Remedial Pedagogical Review Recommended'}
              </div>
              <p className="text-xs text-slate-300 max-w-lg">
                Performance evaluated against deterministic clinical guidelines, safety thresholds, and institutional dispensing rubrics.
              </p>
            </div>

            <div className="bg-slate-800/80 border border-slate-700/80 rounded-xl px-5 py-3.5 text-center shrink-0 self-start sm:self-auto min-w-[130px]">
              <div className="text-[10px] text-slate-400 uppercase font-semibold">Total Score</div>
              <div className="text-3xl font-black tracking-tight mt-0.5 text-emerald-400">
                {score} <span className="text-sm font-normal text-slate-400">/ 100</span>
              </div>
            </div>
          </div>

          {/* Standardized 100-Point Rubric Scorecard Table */}
          <div className="space-y-3">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-indigo-500" />
              Standardized 100-Point Clinical Rubric Breakdown (50 / 30 / 20)
            </h2>

            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold uppercase text-[10px] border-b border-slate-200 dark:border-slate-700">
                  <tr>
                    <th className="px-4 py-2.5">Evaluation Pillar</th>
                    <th className="px-4 py-2.5">Candidate Submission</th>
                    <th className="px-4 py-2.5">Clinical Benchmark</th>
                    <th className="px-4 py-2.5 text-right">Score Awarded</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {/* Pillar 1 */}
                  <tr>
                    <td className="px-4 py-3 font-semibold text-slate-900 dark:text-white">
                      Pillar 1: Determination Accuracy
                      <div className="text-[10px] font-normal text-slate-500">Dispensing & Safety Action</div>
                    </td>
                    <td className="px-4 py-3 font-mono">
                      {submission.submitted_determination}
                    </td>
                    <td className="px-4 py-3 font-mono text-emerald-600 dark:text-emerald-400 font-bold">
                      {feedback.preferred_determination || feedback.expected_determination}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-bold">
                      {feedback.determination_score} / 50 pts
                    </td>
                  </tr>

                  {/* Pillar 2 */}
                  <tr>
                    <td className="px-4 py-3 font-semibold text-slate-900 dark:text-white">
                      Pillar 2: Issue Identification
                      <div className="text-[10px] font-normal text-slate-500">Safety & Contraindication Checks</div>
                    </td>
                    <td className="px-4 py-3">
                      {feedback.correctly_identified_issues.length > 0 ? (
                        <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                          {feedback.correctly_identified_issues.join(', ')}
                        </span>
                      ) : (
                        <span className="text-slate-400">None identified</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                      {feedback.missed_issues.length === 0 ? 'All Expected Issues Identified' : `Missed: ${feedback.missed_issues.join(', ')}`}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-bold">
                      {feedback.issue_identification_score} / 30 pts
                    </td>
                  </tr>

                  {/* Pillar 3 */}
                  <tr>
                    <td className="px-4 py-3 font-semibold text-slate-900 dark:text-white">
                      Pillar 3: Clinical Reasoning
                      <div className="text-[10px] font-normal text-slate-500">Pharmacological Articulation</div>
                    </td>
                    <td className="px-4 py-3">
                      {feedback.correctly_identified_reasoning_elements.length > 0 ? (
                        <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                          {feedback.correctly_identified_reasoning_elements.join(', ')}
                        </span>
                      ) : (
                        <span className="text-amber-500">Minimal elements articulated</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                      Core biochemical cross-reactivity & dosing rationale
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-bold">
                      {feedback.reasoning_score} / 20 pts
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Candidate Written Clinical Defense */}
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 space-y-1.5 text-xs">
            <div className="font-semibold text-slate-700 dark:text-slate-300 uppercase text-[10px] tracking-wider">
              Candidate's Articulated Clinical Defense
            </div>
            <blockquote className="italic text-slate-800 dark:text-slate-200 leading-relaxed border-l-2 border-indigo-500 pl-3">
              "{submission.submitted_reasoning}"
            </blockquote>
          </div>

          {/* Benchmark Solution & Takeaways */}
          <div className="p-4 rounded-xl bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/40 space-y-2 text-xs">
            <div className="font-semibold text-indigo-900 dark:text-indigo-300 uppercase text-[10px] tracking-wider">
              Benchmark Clinical Takeaways & Guidelines
            </div>
            <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
              {feedback.clinical_rationale || submission.predefined_explanation}
            </p>
          </div>

          {/* Official Seal / Sign-off Footer */}
          <div className="pt-4 border-t border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-[11px] text-slate-500">
            <div className="space-y-0.5">
              <div className="font-semibold text-slate-700 dark:text-slate-300">
                PharmacyGuard Automated Pedagogical Evaluator • v0.1
              </div>
              <div>Deterministic scoring engine with immutable attempt recording.</div>
            </div>

            <div className="text-right sm:text-right space-y-0.5">
              <div className="font-mono font-semibold text-slate-700 dark:text-slate-300">
                CENTRAL UNIVERSITY SCHOOL OF PHARMACY
              </div>
              <div className="text-[10px] text-slate-400">
                Experiential Simulation Credit Verified
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between pt-2">
          <div className="text-xs text-slate-400 font-mono">
            Report ID: {submission.id.substring(0, 8)}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={onClose}>
              Close Preview
            </Button>
            <Button
              variant="primary"
              size="sm"
              icon={<Printer className="w-3.5 h-3.5" />}
              onClick={handlePrint}
            >
              Print / Save as PDF
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
};
