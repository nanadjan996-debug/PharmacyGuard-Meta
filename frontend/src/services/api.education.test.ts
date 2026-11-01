import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { api } from './api';

describe('Stage 4 Phase 4.1: Education API Client Contract Alignment', () => {
  beforeEach(() => {
    localStorage.clear();
    api.setToken(null);
    vi.restoreAllMocks();
  });

  afterEach(() => {
    localStorage.clear();
    api.setToken(null);
  });

  it('listCases calls GET /api/v1/education/cases without exposing criteria', async () => {
    const mockCases = [
      {
        id: 'case-1',
        case_code: 'CASE-BEG-01',
        title: 'Penicillin Allergy',
        difficulty: 'BEGINNER',
        category: 'ALLERGY_CROSS_REACTIVITY',
        learning_objectives: ['Identify cross-reactivity'],
        completion_status: 'NOT_ATTEMPTED',
        is_completed: false,
        attempts_count: 0,
        best_score: null,
        disclaimer: 'Advisory educational simulation prototype.',
      },
    ];

    const fetchSpy = vi.spyOn(window, 'fetch').mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => mockCases,
    } as Response);

    const result = await api.education.listCases();

    expect(fetchSpy).toHaveBeenCalledWith(
      '/api/v1/education/cases',
      expect.objectContaining({
        headers: expect.any(Headers),
      })
    );
    expect(result).toEqual(mockCases);
  });

  it('getCaseDetail calls GET /api/v1/education/cases/{id} and returns dynamic available_determinations', async () => {
    const mockDetail = {
      id: 'case-1',
      case_code: 'CASE-BEG-01',
      title: 'Penicillin Allergy',
      difficulty: 'BEGINNER',
      category: 'ALLERGY_CROSS_REACTIVITY',
      patient_summary: '54 yo male',
      prescription_summary: 'Amoxicillin 500mg',
      clinical_scenario: 'Scenario text',
      learning_objectives: ['Objective 1'],
      available_determinations: ['APPROVE', 'REJECT', 'APPROVE_WITH_MONITORING', 'OVERRIDE_WITH_RATIONALE', 'ESCALATE'],
      is_completed: false,
      attempts_count: 0,
      disclaimer: 'Advisory educational simulation prototype.',
    };

    const fetchSpy = vi.spyOn(window, 'fetch').mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => mockDetail,
    } as Response);

    const result = await api.education.getCaseDetail('CASE-BEG-01');

    expect(fetchSpy).toHaveBeenCalledWith(
      '/api/v1/education/cases/CASE-BEG-01',
      expect.anything()
    );
    expect(result).toEqual(mockDetail);
  });

  it('submitAssessment calls POST /api/v1/education/cases/{id}/submit with JSON payload', async () => {
    api.setToken('student_mock_token');

    const mockResponse = {
      id: 'sub-1',
      case_id: 'case-1',
      case_code: 'CASE-BEG-01',
      case_title: 'Penicillin Allergy',
      student_id: 'usr-student-001',
      student_name: 'Jordan Taylor',
      submitted_determination: 'REJECT',
      submitted_reasoning: 'Severe penicillin anaphylaxis history contraindicates amoxicillin.',
      is_correct: true,
      score_awarded: 100,
      predefined_explanation: 'Amoxicillin is a beta-lactam.',
      feedback: {
        determination_status: 'PREFERRED',
        preferred_determination: 'REJECT',
        acceptable_alternatives: ['ESCALATE'],
        determination_correct: true,
        determination_feedback: 'Optimal determination.',
        expected_determination: 'REJECT',
        determination_score: 50,
        expected_rules: [],
        correctly_identified_issues: ['ALLERGY_CROSS_REACTIVITY'],
        missed_issues: [],
        unconfirmed_issues: [],
        issue_identification_score: 30,
        correctly_identified_reasoning_elements: ['BETA_LACTAM_STRUCTURE'],
        missed_reasoning_elements: [],
        reasoning_feedback: 'Excellent reasoning.',
        reasoning_score: 20,
        total_score: 100,
        is_correct: true,
        clinical_rationale: 'Expert rationale text',
        key_learning_points: ['Point 1'],
        educational_limitations: 'Advisory prototype',
        disclaimer: 'Advisory educational simulation prototype.',
      },
      submitted_at: '2026-11-01T04:00:00Z',
      attempt_number: 1,
      disclaimer: 'Advisory educational simulation prototype.',
    };

    const fetchSpy = vi.spyOn(window, 'fetch').mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => mockResponse,
    } as Response);

    const payload = {
      determination: 'REJECT',
      reasoning: 'Severe penicillin anaphylaxis history contraindicates amoxicillin.',
      identified_issues: ['ALLERGY_CROSS_REACTIVITY'],
    };

    const result = await api.education.submitAssessment('CASE-BEG-01', payload);

    expect(fetchSpy).toHaveBeenCalledWith(
      '/api/v1/education/cases/CASE-BEG-01/submit',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify(payload),
      })
    );
    expect(result).toEqual(mockResponse);
  });

  it('listSubmissions and getHistory both call GET /api/v1/education/submissions (not /education/history)', async () => {
    const mockList = [
      {
        id: 'sub-1',
        case_id: 'case-1',
        case_code: 'CASE-BEG-01',
        case_title: 'Penicillin Allergy',
        difficulty: 'BEGINNER',
        category: 'ALLERGY_CROSS_REACTIVITY',
        submitted_determination: 'REJECT',
        is_correct: true,
        score_awarded: 100,
        submitted_at: '2026-11-01T04:00:00Z',
        attempt_number: 1,
      },
    ];

    const fetchSpy = vi.spyOn(window, 'fetch')
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockList,
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockList,
      } as Response);

    // Test listSubmissions
    const res1 = await api.education.listSubmissions();
    expect(fetchSpy).toHaveBeenNthCalledWith(
      1,
      '/api/v1/education/submissions',
      expect.anything()
    );
    expect(res1).toEqual(mockList);

    // Test getHistory alias
    const res2 = await api.education.getHistory();
    expect(fetchSpy).toHaveBeenNthCalledWith(
      2,
      '/api/v1/education/submissions',
      expect.anything()
    );
    expect(res2).toEqual(mockList);
  });

  it('getSubmissionDetail calls GET /api/v1/education/submissions/{id}', async () => {
    const mockDetail = {
      id: 'sub-abc-123',
      case_id: 'case-1',
      case_code: 'CASE-BEG-01',
      case_title: 'Penicillin Allergy',
      student_id: 'usr-student-001',
      student_name: 'Jordan Taylor',
      submitted_determination: 'REJECT',
      submitted_reasoning: 'Valid reasoning > 10 chars',
      is_correct: true,
      score_awarded: 90,
      feedback: {
        total_score: 90,
      },
      submitted_at: '2026-11-01T04:00:00Z',
      attempt_number: 1,
      disclaimer: 'Advisory prototype',
    };

    const fetchSpy = vi.spyOn(window, 'fetch').mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => mockDetail,
    } as Response);

    const result = await api.education.getSubmissionDetail('sub-abc-123');

    expect(fetchSpy).toHaveBeenCalledWith(
      '/api/v1/education/submissions/sub-abc-123',
      expect.anything()
    );
    expect(result).toEqual(mockDetail);
  });
});

