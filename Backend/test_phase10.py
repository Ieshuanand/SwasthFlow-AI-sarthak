"""SwasthFlow AI — Phase 10 Test Suite: Evaluation Engine & The Proof Screen.

Verifies:
1. Model Accuracy vs. Naive Baseline & Calibration Reliability (ECE < 0.05, 0% saturation).
2. Round Clock & Phlebotomy Backwards Scheduling (100% fasting draws before 08:00 AM breakfast, Dr. Rao bimodal case).
3. Master Sequencer CP-SAT Solver Benchmarks (Solve time < 0.5s, Guardrail #4 floor, Guardrail #5 cap).
4. The Medical Humility Matrix: 4 Honest Failure-Case Studies integrity.
5. Canonical 10-Guardrails Compliance Audit (10/10 verified passing).
6. FastAPI Phase 10 Endpoint Integration (GET /api/evaluation/metrics returns HTTP 200 with full schema).
"""

import sys
import os
from fastapi.testclient import TestClient

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

# Ensure backend path is in sys.path
sys.path.insert(0, os.path.dirname(__file__))

import models
from database import SessionLocal
from main import app
from evaluation_engine import get_proof_evaluation_metrics
from guardrails import (
    enforce_doctor_decides,
    enforce_green_consent_capacity,
    enforce_scale_separation,
    GuardrailViolation
)

client = TestClient(app)


def test_1_calibration_and_naive_baseline():
    """Test 1: Model Accuracy vs. Naive Baseline & Calibration Reliability.
    Verifies:
    - LightGBM accuracy exceeds naive baseline (stay >= mean LOS) by >= 20%.
    - Brier score reduction >= 50%.
    - Expected Calibration Error (ECE) < 0.05.
    - Saturated 0.0% count strictly = 0.
    - Saturated 100.0% count strictly = 0.
    - Probability bounds adhere to Guardrail #9 [0.05, 0.92].
    - Calibration bins distribute across spectrum.
    """
    db = SessionLocal()
    try:
        metrics = get_proof_evaluation_metrics(db)
        cal = metrics["calibration_benchmark"]

        # 1. Accuracy vs Baseline
        assert cal["model_accuracy"] >= 85.0, f"Model accuracy {cal['model_accuracy']}% below 85%"
        assert cal["naive_baseline_accuracy"] < cal["model_accuracy"], "Model must beat naive baseline"
        assert cal["accuracy_gain_percent"] >= 20.0, f"Accuracy gain {cal['accuracy_gain_percent']}% less than 20%"

        # 2. Brier Score Error Reduction
        assert cal["model_brier_score"] < 0.10, f"Brier score {cal['model_brier_score']} too high"
        assert cal["brier_error_reduction_percent"] >= 50.0, f"Brier reduction {cal['brier_error_reduction_percent']}% under 50%"

        # 3. Calibration Error (ECE)
        assert cal["expected_calibration_error"] < 0.05, f"ECE {cal['expected_calibration_error']} exceeds 0.05"

        # 4. Strict Zero Saturation (Guardrail #9)
        assert cal["saturated_zero_count"] == 0, "Guardrail #9 violation: Found exact 0.0% predictions"
        assert cal["saturated_one_count"] == 0, "Guardrail #9 violation: Found exact 100.0% predictions"

        # 5. Guardrail #9 Bounds [0.05, 0.92]
        assert cal["min_prob_observed"] >= 0.05, f"Min prob {cal['min_prob_observed']} violates 0.05 floor"
        assert cal["max_prob_observed"] <= 0.92, f"Max prob {cal['max_prob_observed']} violates 0.92 ceiling"

        # 6. Reliability Bins
        bins = cal["calibration_bins"]
        assert len(bins) >= 8, "Expected at least 8 occupied probability bins"

        print(f"\n[PASS] Test 1: Calibration & Naive Baseline — Accuracy: {cal['model_accuracy']}% vs Naive: {cal['naive_baseline_accuracy']}% (+{cal['accuracy_gain_percent']}% gain) | Brier: {cal['model_brier_score']} (-{cal['brier_error_reduction_percent']}%) | ECE: {cal['expected_calibration_error']} | Saturation: 0")
    finally:
        db.close()


def test_2_round_clock_backwards_scheduling():
    """Test 2: Round Clock Backwards Scheduling & Fasting Draw Compliance.
    Verifies:
    - 100% of morning fasting blood draws scheduled before 08:00 AM breakfast.
    - Dr. Rao bimodal proof: Thursday (OT) afternoon (~16:45) vs Wednesday (Non-OT) morning (~08:45).
    - Guardrail #7 privacy compliance: Zero doctor punctuality rankings.
    """
    db = SessionLocal()
    try:
        metrics = get_proof_evaluation_metrics(db)
        rc = metrics["round_clock_benchmark"]

        assert rc["fasting_blood_draws_count"] > 0, "Expected active fasting blood draws"
        assert rc["fasting_before_breakfast_compliant"] is True, "All fasting draws must be before 08:00 AM breakfast"
        assert rc["dr_rao_bimodal_proven"] is True
        assert rc["dr_rao_ot_is_afternoon"] is True
        assert rc["dr_rao_non_ot_is_morning"] is True
        assert rc["guardrail_7_privacy_compliant"] is True

        print(f"\n[PASS] Test 2: Round Clock Backwards Scheduling — Fasting draws ({rc['fasting_blood_draws_count']}) 100% before {rc['breakfast_deadline']}. Dr. Rao bimodal verified (OT: {rc['dr_rao_ot_round_time']}, Non-OT: {rc['dr_rao_non_ot_round_time']}). Guardrail #7 privacy verified.")
    finally:
        db.close()


def test_3_sequencer_cp_sat_metrics():
    """Test 3: Master Sequencer CP-SAT Solver Metrics.
    Verifies:
    - CP-SAT solver status is OPTIMAL or FEASIBLE.
    - Solve execution time < 0.5 seconds.
    - Guardrail #5 Alert Fatigue Cap: 100% staff have <= 10 tasks / shift.
    - Guardrail #4 Confidence Floor: 100% tasks have confidence >= 70%.
    """
    db = SessionLocal()
    try:
        metrics = get_proof_evaluation_metrics(db)
        seq = metrics["sequencer_benchmark"]

        assert seq["solver_status"] in ["OPTIMAL", "FEASIBLE"], f"Solver status {seq['solver_status']}"
        assert seq["solve_time_seconds"] < 0.5, f"Solve time {seq['solve_time_seconds']}s too slow"
        assert seq["guardrail_5_respected"] is True, "Guardrail #5 Alert Fatigue Cap violated"
        assert seq["guardrail_4_respected"] is True, "Guardrail #4 Confidence Floor violated"
        assert seq["tasks_scheduled"] > 0

        print(f"\n[PASS] Test 3: CP-SAT Sequencer Metrics — Status: {seq['solver_status']} in {seq['solve_time_seconds']}s. Tasks: {seq['tasks_scheduled']}. Guardrail #5 (<= 10 tasks/shift): 100% compliant. Guardrail #4 (>= 70% conf): 100% compliant.")
    finally:
        db.close()


def test_4_honest_failure_case_breakdown():
    """Test 4: The Medical Humility Matrix — 4 Honest Failure-Case Studies.
    Verifies:
    - Exactly 4 structured real-world clinical/operational failure modes.
    - All cases contain full clinical narrative, AI limitation, safeguarding guardrail, and safe resolution.
    - All 4 safety categories covered (Clinical Safety, Social Logistics, Staff Fatigue, Payer Latency).
    """
    db = SessionLocal()
    try:
        metrics = get_proof_evaluation_metrics(db)
        cases = metrics["honest_failure_modes"]

        assert len(cases) == 4, f"Expected exactly 4 failure cases, found {len(cases)}"
        expected_case_ids = ["CASE-FAIL-01", "CASE-FAIL-02", "CASE-FAIL-03", "CASE-FAIL-04"]
        found_ids = [c["case_id"] for c in cases]
        assert found_ids == expected_case_ids

        # Check required fields
        for c in cases:
            assert "title" in c and len(c["title"]) > 5
            assert "patient_name" in c and len(c["patient_name"]) > 2
            assert "clinical_scenario" in c and len(c["clinical_scenario"]) > 20
            assert "the_failure_event" in c and len(c["the_failure_event"]) > 20
            assert "why_ai_failed" in c and len(c["why_ai_failed"]) > 20
            assert "safeguarding_guardrail" in c and "Guardrail" in c["safeguarding_guardrail"]
            assert "how_swasthflow_intercepted" in c and len(c["how_swasthflow_intercepted"]) > 20
            assert "outcome_safety" in c and len(c["outcome_safety"]) > 5
            assert c["severity_badge"] in ["CLINICAL_SAFETY", "SOCIAL_LOGISTICS", "STAFF_FATIGUE", "PAYER_LATENCY"]

        print(f"\n[PASS] Test 4: The Medical Humility Matrix — Verified 4 honest failure-case studies across clinical reversals, caregiver absence, staff fatigue, and payer latency.")
    finally:
        db.close()


def test_5_canonical_10_guardrails_audit():
    """Test 5: Canonical 10-Guardrails Compliance Audit.
    Verifies:
    - All 10 canonical guardrails are present in the audit.
    - 100% of guardrails report VERIFIED_PASSING status.
    - Every guardrail links to its charter, implementation module, and test reference.
    """
    db = SessionLocal()
    try:
        metrics = get_proof_evaluation_metrics(db)
        audit = metrics["canonical_guardrails_audit"]

        assert len(audit) == 10, f"Expected 10 guardrails, found {len(audit)}"
        for idx, g in enumerate(audit, start=1):
            assert g["id"] == idx
            assert g["status"] == "VERIFIED_PASSING"
            assert len(g["name"]) > 3
            assert len(g["charter"]) > 10
            assert len(g["module"]) > 3
            assert len(g["test_ref"]) > 5

        print(f"\n[PASS] Test 5: Canonical Guardrails Audit — All 10 canonical guardrails verified passing with active module and test linkage.")
    finally:
        db.close()


def test_6_fastapi_phase10_endpoint():
    """Test 6: FastAPI Phase 10 Endpoint Integration (GET /api/evaluation/metrics).
    Verifies:
    - HTTP 200 OK response.
    - Response contains all 6 top-level evaluation sections.
    - Schema adherence and numeric type correctness.
    """
    res = client.get("/api/evaluation/metrics")
    assert res.status_code == 200, f"Expected 200, got {res.status_code}"
    data = res.json()

    # Section verification
    assert "evaluation_timestamp" in data
    assert "n_evaluation_samples" in data and data["n_evaluation_samples"] == 1000
    assert "calibration_benchmark" in data
    assert "round_clock_benchmark" in data
    assert "sequencer_benchmark" in data
    assert "honest_failure_modes" in data and len(data["honest_failure_modes"]) == 4
    assert "canonical_guardrails_audit" in data and len(data["canonical_guardrails_audit"]) == 10
    assert "operational_impact" in data

    # Scale separation in operational impact
    op = data["operational_impact"]
    assert "live_30bed_demonstrator" in op
    assert "projected_300bed_hospital" in op
    assert op["live_30bed_demonstrator"]["bed_capacity"] == 30
    assert op["projected_300bed_hospital"]["bed_capacity"] == 300

    print(f"\n[PASS] Test 6: FastAPI Phase 10 Endpoint — GET /api/evaluation/metrics returned 200 OK with valid schema across all 6 sections.")


if __name__ == "__main__":
    print("=" * 75)
    print("SWASTHFLOW AI — PHASE 10 TEST SUITE: EVALUATION ENGINE & THE PROOF SCREEN")
    print("=" * 75)

    test_1_calibration_and_naive_baseline()
    test_2_round_clock_backwards_scheduling()
    test_3_sequencer_cp_sat_metrics()
    test_4_honest_failure_case_breakdown()
    test_5_canonical_10_guardrails_audit()
    test_6_fastapi_phase10_endpoint()

    print("\n" + "=" * 75)
    print("ALL 6 PHASE 10 TESTS PASSED WITH ZERO FAILURES OR REGRESSIONS.")
    print("=" * 75)
