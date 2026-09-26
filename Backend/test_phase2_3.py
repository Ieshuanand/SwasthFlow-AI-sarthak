import sys
import datetime

# Ensure utf-8 encoding on Windows console for Hindi text output
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

from database import SessionLocal, engine, Base
import models
import adapter
from simulator import HospitalSimulator, DIAGNOSES
from discharge_radar import DischargeRadar
from delay_book import DelayBook
import payer_router
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

def test_discharge_radar_and_delay_book():
    print("=== TEST 1: DISCHARGE RADAR (LIGHTGBM + EXPLANATIONS) ===")
    radar = DischargeRadar()
    assert radar.model is not None, "LightGBM model failed to train"
    
    # 1. Test ready-to-discharge patient (Oral meds, O2 removed, long LOS, tests stopped)
    ready_patient = {
        "hours_since_last_test": 28.0,
        "iv_to_oral": True,
        "oxygen_removed": True,
        "diet_normalized": True,
        "los_days": 4.2,
        "pt_cleared": True,
        "vitals_stable": True,
        "payer_type": "TPA",
        "ward": "WARD_A"
    }
    pred_ready = radar.predict_encounter(ready_patient, diag_mean_los=4.0)
    print(f"[PASS] Ready patient predicted: P(discharge) = {pred_ready['p_discharge']*100:.1f}%")
    print(f"       Top 3 Reasons: {pred_ready['top_reasons']}")
    print(f"       Payer Strategy: {pred_ready['payer_strategy']['action_title']}")
    
    assert 0.70 <= pred_ready["p_discharge"] <= 0.94, f"Expected realistic calibrated probability (70-94%), got {pred_ready['p_discharge']}"
    assert pred_ready["p_discharge"] < 1.0, "Clinical honesty violation: Model should never claim 100.0% certainty"
    assert len(pred_ready["top_reasons"]) == 3, f"Expected 3 plain-English reasons, got {len(pred_ready['top_reasons'])}"
    assert pred_ready["is_high_confidence"] is True

    # 2. Test acute patient (Recent tests, on IV, low LOS)
    acute_patient = {
        "hours_since_last_test": 2.0,
        "iv_to_oral": False,
        "oxygen_removed": False,
        "diet_normalized": False,
        "los_days": 0.8,
        "pt_cleared": False,
        "vitals_stable": False,
        "payer_type": "AYUSHMAN",
        "ward": "WARD_A"
    }
    pred_acute = radar.predict_encounter(acute_patient, diag_mean_los=4.0)
    print(f"\n[PASS] Acute patient predicted: P(discharge) = {pred_acute['p_discharge']*100:.1f}%")
    print(f"       Top 3 Reasons: {pred_acute['top_reasons']}")
    assert 0.04 <= pred_acute["p_discharge"] < 0.50, f"Expected low probability for acute patient, got {pred_acute['p_discharge']}"
    assert pred_acute["p_discharge"] > 0.0, "Clinical honesty violation: Model should never claim 0.0% certainty"
    assert pred_acute["is_high_confidence"] is False

    # 3. Test multi-payer adaptive horizon: Ayushman unified with Delay Book learned p90 (38.7h) vs TPA (6.0h)
    assert pred_acute["target_horizon_hours"] == 38.7
    assert pred_ready["target_horizon_hours"] == 6.0
    print(f"\n[PASS] Payer-adaptive horizons verified from Delay Book: Ayushman=38.7h vs TPA=6.0h")

    # 4. Held-out calibration evaluation (Guardrail #9)
    cal_eval = radar.evaluate_calibration(n_test=1000)
    print(f"\n[PASS] Held-out Calibration Evaluation (n={cal_eval['n_test_samples']}):")
    print(f"       - Brier Score: {cal_eval['brier_score']}")
    print(f"       - Expected Calibration Error (ECE): {cal_eval['expected_calibration_error']}")
    print(f"       - Saturated 0.0% count: {cal_eval['saturated_zero_count']} (MUST BE 0)")
    print(f"       - Saturated 100.0% count: {cal_eval['saturated_one_count']} (MUST BE 0)")
    print(f"       - Probability bounds: [{cal_eval['min_prob_observed']}, {cal_eval['max_prob_observed']}]")
    assert cal_eval["saturated_zero_count"] == 0, "Guardrail #9 violation: Found saturated 0.0% predictions"
    assert cal_eval["saturated_one_count"] == 0, "Guardrail #9 violation: Found saturated 100.0% predictions"
    assert cal_eval["min_prob_observed"] >= 0.05
    assert cal_eval["max_prob_observed"] <= 0.92
    assert cal_eval["expected_calibration_error"] < 0.20

def test_delay_book_and_doc_lag():
    print("\n=== TEST 2: DELAY BOOK & DOCUMENTATION LAG SUBTRACTION ===")
    db = SessionLocal()
    book = DelayBook(db)
    
    # Check that learned stats have p90 > median
    cash_stat = book.get_step_stat("PAYER_CLEARANCE_CASH")
    ayushman_stat = book.get_step_stat("PAYER_CLEARANCE_AYUSHMAN")
    cleaning_stat = book.get_step_stat("BED_CLEANING_GENERAL")

    print(f"[PASS] Learned Step Durations (Median vs P90):")
    print(f"       - Cash Clearance: median={cash_stat['median_min']}m, p90={cash_stat['p90_min']}m")
    print(f"       - Ayushman Clearance: median={ayushman_stat['median_min']}m, p90={ayushman_stat['p90_min']}m")
    print(f"       - Bed Cleaning: median={cleaning_stat['median_min']}m, p90={cleaning_stat['p90_min']}m")
    
    assert cash_stat["p90_min"] > cash_stat["median_min"]
    assert ayushman_stat["p90_min"] > ayushman_stat["median_min"]
    assert book.get_step_budget_p90("PAYER_CLEARANCE_AYUSHMAN") == ayushman_stat["p90_min"]

    # Check documentation lag subtraction logic
    now = datetime.datetime(2026, 9, 10, 10, 0, 0)
    corrected_ward_b = book.correct_logged_timestamp(now, "WARD_B")
    lag_applied = (now - corrected_ward_b).total_seconds() / 60.0
    print(f"[PASS] Doc lag correction in Ward B: subtracted {lag_applied:.1f} mins from raw timestamp")
    assert lag_applied >= 45.0, f"Expected at least 45 min correction for Ward B, got {lag_applied}"
    
    db.close()

def test_payer_task_routing_guardrails():
    print("\n=== TEST 3: PAYER TASK ROUTING & GUARDRAIL ENFORCEMENT ===")
    db = SessionLocal()
    
    # Create test high-confidence encounter
    enc = models.Encounter(
        id="ENC-TEST-TPA",
        patient_id="PAT-TEST",
        patient_name="Rajeev Saxena",
        age=45,
        gender="M",
        ward="WARD_A",
        bed_id="WARD_A-01",
        admission_time=datetime.datetime.utcnow(),
        admission_actual_time=datetime.datetime.utcnow(),
        admission_logged_time=datetime.datetime.utcnow(),
        admission_doc_lag_min=20.0,
        diagnosis_code="A90",
        diagnosis_name="Dengue Fever",
        consultant_id="DR_SHARMA",
        consultant_name="Dr. Vivek Sharma",
        payer_type="TPA",
        payer_name="Star Health Insurance",
        status="ACTIVE"
    )

    # 1. High confidence test (p=0.85) -> Task generated with mandatory WHO and WHY
    task = payer_router.generate_payer_billing_task(
        encounter=enc,
        p_discharge=0.85,
        reasons=["Oral medications started", "Lab tests normalized"],
        p90_duration_min=360,
        current_time=datetime.datetime.utcnow()
    )
    assert task is not None
    assert task.role == "BILLING", f"Expected BILLING role, got {task.role}"
    assert len(task.reason_en) > 15, "Guardrail violation: Missing or empty reason_en"
    assert len(task.reason_hi) > 15, "Guardrail violation: Missing or empty reason_hi"
    assert task.confidence == 0.85
    print(f"[PASS] High confidence task generated: [{task.role}] {task.title_en}")
    print(f"       Reason EN: {task.reason_en}")
    print(f"       Reason HI: {task.reason_hi}")

    # 2. Low confidence suppression test (p=0.65 < 0.70)
    low_task = payer_router.generate_payer_billing_task(
        encounter=enc,
        p_discharge=0.65,
        reasons=["Testing underway"],
        p90_duration_min=360,
        current_time=datetime.datetime.utcnow()
    )
    assert low_task is None, "Guardrail violation: Task emitted below 70% confidence"
    print(f"[PASS] Low confidence prediction (< 70%) strictly suppressed: No task emitted")

    db.close()

def test_api_endpoints_phase2_3():
    print("\n=== TEST 4: FASTAPI ENDPOINTS FOR DISCHARGE RADAR & DELAY BOOK ===")
    
    # 1. Test /api/discharge-radar
    res_radar = client.get("/api/discharge-radar")
    assert res_radar.status_code == 200
    radar_data = res_radar.json()
    print(f"[PASS] GET /api/discharge-radar returned {len(radar_data)} patients")
    assert len(radar_data) > 0
    top_candidate = radar_data[0]
    print(f"       Top candidate: {top_candidate['patient_name']} (P={top_candidate['p_discharge']*100:.1f}%)")
    print(f"       Payer: {top_candidate['payer_type']} (Lead window: {top_candidate['target_horizon_hours']}h)")
    print(f"       Explanations: {top_candidate['top_reasons']}")

    # 2. Test /api/delay-book
    res_delay = client.get("/api/delay-book")
    assert res_delay.status_code == 200
    delay_data = res_delay.json()
    print(f"[PASS] GET /api/delay-book -> Learned ward doc lags: {delay_data['ward_documentation_lags_minutes']}")

    # 3. Test /api/payer/route-tasks
    res_route = client.post("/api/payer/route-tasks")
    assert res_route.status_code == 200
    route_data = res_route.json()
    print(f"[PASS] POST /api/payer/route-tasks -> {route_data['message']}")

    # 4. Test /api/tasks
    res_tasks = client.get("/api/tasks")
    assert res_tasks.status_code == 200
    tasks_data = res_tasks.json()
    print(f"[PASS] GET /api/tasks -> {len(tasks_data)} total tasks in operational queue")

    print("\nALL PHASE 2 & PHASE 3 TESTS PASSED SUCCESSFULLY!")

if __name__ == "__main__":
    test_discharge_radar_and_delay_book()
    test_delay_book_and_doc_lag()
    test_payer_task_routing_guardrails()
    test_api_endpoints_phase2_3()
