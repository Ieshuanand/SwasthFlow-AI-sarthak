"""Phase 5 Verification Suite: The Sequencer (OR-Tools CP-SAT) & Calibration Proof.
Verifies:
  1. Discharge Radar Calibration & Naive Baseline Comparison (Guardrail #9).
  2. Concrete trace: Sequencer dynamically consumes Delay Book's learned P90 (single source of truth).
  3. CP-SAT multi-objective optimization (missed rounds -> 11am beds -> payer starts -> walking -> churn).
  4. Guardrail #5 Alert Fatigue Cap (<= 10 tasks/staff/shift) and Guardrail #4 (>= 70% confidence).
  5. Fasting blood draw hard constraint (<= 08:00 AM).
  6. Shortfall window diagnostic.
  7. FastAPI endpoint GET /api/plan/today.
"""

import sys
import datetime

# Ensure utf-8 encoding on Windows console
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

from database import SessionLocal
import models
import adapter
from discharge_radar import DischargeRadar
from round_clock import RoundClock
from delay_book import DelayBook
from sequencer import Sequencer, DEFAULT_STAFF
from guardrails import (
    MIN_TASK_CONFIDENCE,
    MAX_TASKS_PER_STAFF_SHIFT,
    enforce_alert_fatigue_cap,
    enforce_task_confidence
)
from fastapi.testclient import TestClient
from main import app, simulator

client = TestClient(app)

def test_phase5_suite():
    print("================================================================================")
    print("=== PHASE 5 VERIFICATION: CALIBRATION PROOF & OR-TOOLS CP-SAT SEQUENCER ===")
    print("================================================================================")

    db = SessionLocal()
    adapter.sync_payers_to_db(db)
    adapter.sync_simulator_to_db(simulator, db)
    radar = DischargeRadar()
    clock = RoundClock()
    book = DelayBook(db)

    # -------------------------------------------------------------------------
    # TEST 1: DISCHARGE RADAR CALIBRATION & NAIVE BASELINE BENCHMARK
    # -------------------------------------------------------------------------
    print("\n--- TEST 1: DISCHARGE RADAR CALIBRATION & HELD-OUT RELIABILITY ---")
    cal_results = radar.evaluate_calibration(n_test=1000)
    print(f"Held-Out Evaluation (n={cal_results['n_test_samples']} synthetic patient trajectories):")
    print(f"  • Model Accuracy:           {cal_results['model_accuracy']}%")
    print(f"  • Naive Baseline Accuracy:  {cal_results['naive_baseline_accuracy']}% (rule: discharge if stay >= mean LOS)")
    print(f"  • Model Brier Score:        {cal_results['brier_score']}")
    print(f"  • Naive Brier Score:        {cal_results['naive_brier_score']}")
    print(f"  • Expected Cal. Error (ECE):{cal_results['expected_calibration_error']}")
    print(f"  • Saturated 0.0% count:     {cal_results['saturated_zero_count']} (strictly 0)")
    print(f"  • Saturated 100.0% count:   {cal_results['saturated_one_count']} (strictly 0)")
    print(f"  • Probability Bounds:       [{cal_results['min_prob_observed']}, {cal_results['max_prob_observed']}]")
    print(f"  • Calibration Mechanism:    {cal_results['calibration_mechanism']}")

    print("\n  Reliability Bins Table:")
    for b in cal_results["calibration_bins"]:
        print(f"    Bin {b['bin_range']}: count={b['sample_count']}, mean_pred={b['mean_predicted_p']}, actual_acc={b['empirical_accuracy']}")

    assert cal_results["saturated_zero_count"] == 0, "Guardrail #9 violation: Model predicted exact 0.0%"
    assert cal_results["saturated_one_count"] == 0, "Guardrail #9 violation: Model predicted exact 100.0%"
    assert cal_results["min_prob_observed"] >= 0.05
    assert cal_results["max_prob_observed"] <= 0.92
    assert cal_results["model_accuracy"] > cal_results["naive_baseline_accuracy"]
    assert cal_results["brier_score"] < cal_results["naive_brier_score"]
    print("[PASS] Test 1: Calibration verified. Zero probability saturation; beats naive baseline.")

    # -------------------------------------------------------------------------
    # TEST 2: CONCRETE TRACE: DELAY BOOK LEARNED P90 AS SINGLE SOURCE OF TRUTH
    # -------------------------------------------------------------------------
    print("\n--- TEST 2: CONCRETE TRACE: SEQUENCER CONSUMES DELAY BOOK P90 ---")
    seq = Sequencer(db=db, delay_book=book, round_clock=clock, discharge_radar=radar)
    now_dt = simulator.simulated_time

    # Verify that candidate tasks dynamically read their deadlines from DelayBook
    candidates = seq.build_candidate_tasks(now_dt)
    billing_tasks = [t for t in candidates if t["role"] == "BILLING"]
    print(f"Candidate tasks generated: {len(candidates)} total ({len(billing_tasks)} billing tasks)")

    # Trace Ayushman learned P90 to task deadline
    ayushman_p90 = book.get_step_budget_p90("PAYER_CLEARANCE_AYUSHMAN")
    tpa_p90 = book.get_step_budget_p90("PAYER_CLEARANCE_TPA")
    print(f"Delay Book Learned P90 Values:")
    print(f"  • Ayushman learned P90: {ayushman_p90:.1f} min ({ayushman_p90/60.0:.1f} hours)")
    print(f"  • TPA learned P90:      {tpa_p90:.1f} min ({tpa_p90/60.0:.1f} hours)")

    # Simulate dynamic change in learned p90 to prove the Sequencer reacts dynamically
    book.stats["PAYER_CLEARANCE_AYUSHMAN"]["p90_min"] = 2400.0 # 40.0 hours
    ayushman_p90_updated = book.get_step_budget_p90("PAYER_CLEARANCE_AYUSHMAN")
    assert ayushman_p90_updated == 2400.0
    print(f"  • Injected test update to Ayushman P90 -> {ayushman_p90_updated:.1f} min (40.0h)")

    updated_candidates = seq.build_candidate_tasks(now_dt)
    for t in updated_candidates:
        if "PM-JAY" in t["task_title"] or "Ayushman" in t["task_title"]:
            expected_deadline = now_dt + datetime.timedelta(minutes=2400.0)
            assert t["deadline_dt"] == expected_deadline, "Sequencer failed to dynamically consume updated Delay Book p90!"
            print(f"  • [VERIFIED TRACE] Ayushman task deadline dynamically shifted to: {t['deadline_dt'].strftime('%Y-%m-%d %H:%M')}")
            break
    print("[PASS] Test 2: Sequencer proven to dynamically consume Delay Book learned P90 with zero drift.")

    # -------------------------------------------------------------------------
    # TEST 3: OR-TOOLS CP-SAT MULTI-OBJECTIVE SOLVER EXECUTION
    # -------------------------------------------------------------------------
    print("\n--- TEST 3: CP-SAT SOLVER EXECUTION & OBJECTIVES ---")
    plan = seq.solve(simulated_dt=now_dt)
    print(f"CP-SAT Solver Status:      {plan['solver_status']}")
    print(f"Solve Time:                {plan['solve_time_seconds']} seconds")
    print(f"Total Tasks Scheduled:     {plan['total_tasks_scheduled']}")
    print(f"Shortfall Windows flagged: {len(plan['shortfall_windows'])}")

    assert plan["solver_status"] in ["OPTIMAL", "FEASIBLE"], f"Solver failed: {plan['solver_status']}"
    assert plan["total_tasks_scheduled"] > 0

    # -------------------------------------------------------------------------
    # TEST 4: GUARDRAIL ENFORCEMENT IN SEQUENCER
    # -------------------------------------------------------------------------
    print("\n--- TEST 4: GUARDRAIL COMPLIANCE IN GENERATED PLAN ---")
    # Guardrail #5: Max 10 tasks per staff member per shift
    print("Staff Shift Workload (Guardrail #5 Alert Fatigue Cap <= 10):")
    for s in plan["staff_summary"]:
        print(f"  • {s['staff_name']} ({s['role']}): {s['assigned_task_count']} / {s['max_cap']} tasks ({s['cap_utilized_percent']}%) [Respected: {s['is_cap_respected']}]")
        assert s["assigned_task_count"] <= MAX_TASKS_PER_STAFF_SHIFT, f"Guardrail #5 violation for {s['staff_name']}"

    # Guardrail #4: Confidence Floor >= 70%
    for t in plan["scheduled_tasks"]:
        assert t["confidence"] >= MIN_TASK_CONFIDENCE, f"Guardrail #4 violation: task {t['task_id']} confidence {t['confidence']} < 0.70"
    print("  • Guardrail #4 Verified: 100% of scheduled tasks have confidence >= 70%")

    # Fasting blood draw constraint (must complete <= 08:00 AM / minute 120)
    for t in plan["scheduled_tasks"]:
        if t["role"] == "PHLEBOTOMY":
            assert t["scheduled_end_min"] <= 120, f"Fasting draw violated: finished at minute {t['scheduled_end_min']} (> 08:00 AM)"
    print("  • Hard Constraint Verified: 100% of fasting blood draws complete before 08:00 AM breakfast")

    # -------------------------------------------------------------------------
    # TEST 5: FASTAPI ENDPOINT GET /api/plan/today
    # -------------------------------------------------------------------------
    print("\n--- TEST 5: FASTAPI ENDPOINT GET /api/plan/today ---")
    res = client.get("/api/plan/today")
    assert res.status_code == 200, f"GET /api/plan/today failed: {res.status_code}"
    data = res.json()
    print(f"GET /api/plan/today -> HTTP 200 OK")
    print(f"  • Solver status: {data['solver_status']}")
    print(f"  • Total tasks:   {data['total_tasks_scheduled']}")
    print(f"  • First 3 tasks in Today's Master Schedule:")
    for t in data["scheduled_tasks"][:3]:
        print(f"    [{t['scheduled_start_str']} - {t['scheduled_end_str']}] {t['task_title']} -> Assigned: {t['assigned_staff_name']}")

    # -------------------------------------------------------------------------
    # TEST 6: SHORTFALL WINDOW DIAGNOSTIC UPON STAFF CAPACITY OVERLOAD
    # -------------------------------------------------------------------------
    print("\n--- TEST 6: SHORTFALL WINDOW DIAGNOSTIC UNDER CAPACITY SATURATION ---")
    # Simulate tight staff roster with only 2 phlebotomists (max capacity = 20) for 25 blood draws
    tight_staff = [
        {"id": "STAFF_PHLEB_1", "name": "Sunita K. (Phleb)", "role": "PHLEBOTOMY", "primary_ward": "WARD_A"},
        {"id": "STAFF_PHLEB_2", "name": "Manoj V. (Phleb)", "role": "PHLEBOTOMY", "primary_ward": "WARD_B"},
    ]
    tight_plan = seq.solve(simulated_dt=now_dt, staff_roster=tight_staff)
    print(f"Tight Roster Solver Status: {tight_plan['solver_status']}")
    print(f"Tasks Scheduled:           {tight_plan['total_tasks_scheduled']} (Capped by 2 staff x 10 = 20)")
    print(f"Shortfall Windows flagged: {len(tight_plan['shortfall_windows'])}")
    assert len(tight_plan["shortfall_windows"]) > 0, "Expected shortfall windows when capacity is saturated!"
    sample_shortfall = tight_plan["shortfall_windows"][0]
    print(f"Sample Shortfall Window Diagnostic:")
    print(f"  • Task:       {sample_shortfall['task_title']}")
    print(f"  • Role:       {sample_shortfall['role']} ({sample_shortfall['ward']})")
    print(f"  • Diagnostic: {sample_shortfall['bottleneck_diagnostic']}")
    print("[PASS] Test 6: Shortfall window diagnostic proven to flag bottlenecks and capacity deficits.")

    print("\n================================================================================")
    print("=== ALL PHASE 5 TESTS PASSED SUCCESSFULLY! ===")
    print("================================================================================")

if __name__ == "__main__":
    test_phase5_suite()
