import sys
import datetime

# Ensure utf-8 output on Windows console
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

from round_clock import RoundClock, DOCTORS
from delay_book import DelayBook
from database import SessionLocal
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

def test_round_clock_burst_predictions():
    print("=== TEST 1: ROUND CLOCK BURST PREDICTIONS & BIMODAL SURGEON CASE ===")
    clock = RoundClock()
    assert clock.model is not None, "Round Clock LightGBM model failed to train"

    # 1. Test Dr. Rao on Thursday (OT day) -> Bimodal Afternoon burst (16:30 - 17:30)
    thursday = datetime.date(2026, 9, 10) # weekday = 3 (Thursday, OT Day)
    ot_pred = clock.predict_doctor_round("DR_RAO", "WARD_B", thursday)
    print(f"[PASS] Dr. Rao on OT Day ({thursday.strftime('%A')}): Predicted {ot_pred['predicted_time_str']}")
    print(f"       Note: {ot_pred['schedule_note']}")
    assert ot_pred["has_OT_today"] is True
    
    # Parse predicted hour
    hours = int(ot_pred["predicted_time_str"].split(":")[0])
    assert 16 <= hours <= 17, f"Expected afternoon round on OT day, got {hours}h"

    # 2. Test Dr. Rao on Wednesday (Non-OT day) -> Bimodal Morning burst (08:30 - 09:30)
    wednesday = datetime.date(2026, 9, 9) # weekday = 2 (Wednesday, Non-OT Day)
    non_ot_pred = clock.predict_doctor_round("DR_RAO", "WARD_B", wednesday)
    print(f"\n[PASS] Dr. Rao on Non-OT Day ({wednesday.strftime('%A')}): Predicted {non_ot_pred['predicted_time_str']}")
    print(f"       Note: {non_ot_pred['schedule_note']}")
    assert non_ot_pred["has_OT_today"] is False
    hours_non_ot = int(non_ot_pred["predicted_time_str"].split(":")[0])
    assert 8 <= hours_non_ot <= 9, f"Expected early morning round on non-OT day, got {hours_non_ot}h"

    # 3. Test Dr. Sharma (Internal Medicine) -> Morning burst (09:30 - 10:15)
    sharma_pred = clock.predict_doctor_round("DR_SHARMA", "WARD_A", thursday)
    print(f"\n[PASS] Dr. Vivek Sharma: Predicted round at {sharma_pred['predicted_time_str']}")
    sharma_hour = int(sharma_pred["predicted_time_str"].split(":")[0])
    assert 9 <= sharma_hour <= 10

def test_backwards_blood_draw_math():
    print("\n=== TEST 2: REPORT BEFORE THE ROUND (BACKWARDS BLOOD-DRAW SCHEDULING) ===")
    clock = RoundClock()
    
    # Doctor round at 09:30 AM (570 minutes from midnight)
    round_time = datetime.datetime(2026, 9, 10, 9, 30, 0)
    lab_p90 = 140.0 # 2 hours 20 minutes lab turnaround p90
    safety_buffer = 15.0 # 15 minutes margin

    draw_plan = clock.compute_latest_safe_blood_draw(
        predicted_round_start=round_time,
        lab_p90_turnaround_min=lab_p90,
        buffer_minutes=safety_buffer
    )

    print(f"[PASS] Backwards Phlebotomy Math:")
    print(f"       - Predicted Doctor Round Time: {draw_plan['doctor_round_time_str']}")
    print(f"       - Subtracted Lab P90 Turnaround: {int(draw_plan['lab_p90_budget_min'])} mins")
    print(f"       - Subtracted Buffer Margin: {int(draw_plan['safety_margin_min'])} mins")
    print(f"       - Latest Safe Blood Draw Time: {draw_plan['latest_safe_time_str']}")
    print(f"       - Generated WHY Reason: {draw_plan['reason']}")

    deadline_dt = datetime.datetime.fromisoformat(draw_plan["latest_safe_blood_draw_time"])
    # 09:30 AM minus 155 minutes = 06:55 AM
    expected_dt = round_time - datetime.timedelta(minutes=155)
    assert deadline_dt == expected_dt, f"Expected {expected_dt}, got {deadline_dt}"
    assert "draw before" in draw_plan["reason"]

def test_guardrail_ethics_no_punctuality():
    print("\n=== TEST 3: GUARDRAIL #9 ETHICS (NO PUNCTUALITY TRACKING) ===")
    clock = RoundClock()
    pred = clock.predict_doctor_round("DR_SHARMA", "WARD_A", datetime.date(2026, 9, 10))
    
    # Verify no punctuality or doctor ranking fields exist
    forbidden_terms = ["punctuality", "delay_score", "doctor_rank", "lateness", "performance_score"]
    for key in pred.keys():
        for term in forbidden_terms:
            assert term not in key.lower(), f"Guardrail #9 violation: {key} found in Round Clock response"
    
    assert "SCHEDULING_ONLY" in pred["intended_use"]
    print("[PASS] Verified: Zero punctuality or performance metrics exposed in Round Clock.")

def test_api_endpoints_phase4():
    print("\n=== TEST 4: FASTAPI ENDPOINTS FOR ROUND CLOCK & BLOOD DRAW ROUTE ===")
    
    # 1. Test /api/round-clock
    res_clock = client.get("/api/round-clock")
    assert res_clock.status_code == 200
    clock_data = res_clock.json()
    rounds = clock_data["predicted_rounds"]
    print(f"[PASS] GET /api/round-clock -> {len(rounds)} consultants scheduled for {clock_data['simulated_day_name']}")
    for r in rounds:
        print(f"       • {r['consultant_name']} ({r['ward']}): {r['predicted_time_str']} [{r['schedule_note']}]")

    # 2. Test /api/round-clock/blood-draw-schedule
    res_blood = client.get("/api/round-clock/blood-draw-schedule")
    assert res_blood.status_code == 200
    blood_data = res_blood.json()
    route = blood_data["phlebotomy_route"]
    print(f"\n[PASS] GET /api/round-clock/blood-draw-schedule -> {len(route)} patients ordered for phlebotomy")
    assert len(route) > 0
    
    # Verify chronological ordering (earliest draw deadline first)
    for i in range(len(route) - 1):
        t1 = datetime.datetime.fromisoformat(route[i]["latest_safe_blood_draw_time"])
        t2 = datetime.datetime.fromisoformat(route[i+1]["latest_safe_blood_draw_time"])
        assert t1 <= t2, f"Phlebotomy route not ordered chronologically: {t1} > {t2}"

    first_item = route[0]
    print(f"       First in route: {first_item['patient_name']} ({first_item['bed_id']})")
    print(f"       Draw deadline: {first_item['latest_safe_draw_str']} (for {first_item['consultant_name']} round at {first_item['consultant_round_time']})")
    print(f"       Why: {first_item['why_reason']}")
    assert first_item["fasting_required"] is True

    print("\nALL PHASE 4 TESTS PASSED SUCCESSFULLY!")

if __name__ == "__main__":
    test_round_clock_burst_predictions()
    test_backwards_blood_draw_math()
    test_guardrail_ethics_no_punctuality()
    test_api_endpoints_phase4()
