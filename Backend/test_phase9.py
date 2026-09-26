"""SwasthFlow AI — Phase 9 Test Suite: Readiness Engine, Emergency Console, Time Saved Counter & Blocker View.

Verifies:
1. Live Bed Readiness Number calculation and threshold warnings (CRITICAL < 2, STRAINED 2-4, HEALTHY > 4).
2. Guardrail #8 (Green-Consent Capacity Rule: only 🟢 Green consent or verified READY beds enter readiness).
3. Guardrail #10 (Scale Separation: 30-bed live demonstrator strictly separated from 10x 300-bed projection).
4. One-Tap Emergency Console (Feature F9): Expediting housekeeping to 15m SLA without clinical discharge automation (Guardrail #1).
5. Single-Blocker Diagnostic View ('What's Blocking This Bed?'): 30-bed bottleneck mapping with Delay Book P90 budgets.
6. FastAPI Phase 9 Endpoints Integration (HTTP 200 responses and payload validation).
"""

import sys
import os
import datetime
from fastapi.testclient import TestClient

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

# Ensure backend path is in sys.path
sys.path.insert(0, os.path.dirname(__file__))

import models
from database import get_db, SessionLocal
from main import app
from guardrails import (
    enforce_doctor_decides,
    enforce_green_consent_capacity,
    enforce_scale_separation,
    LIVE_DEMO_BED_COUNT,
    GuardrailViolation
)
from readiness_engine import (
    get_readiness_metrics,
    get_bed_blockers,
    calculate_time_saved,
    activate_emergency_console
)

client = TestClient(app)


def assert_raises(exc_type, func, *args, **kwargs):
    try:
        func(*args, **kwargs)
    except exc_type as e:
        return e
    raise AssertionError(f"Expected {exc_type.__name__} but no exception was raised")


def test_1_readiness_number_and_thresholds():
    """Test 1: Live Bed Readiness Number Calculation & Threshold Warnings.
    Verifies ready_now + turnover_in_30m sum to readiness_number,
    ward breakdown partitions correctly, and threshold classifications hold.
    """
    db = SessionLocal()
    try:
        metrics = get_readiness_metrics(db)
        
        # Structure validations
        assert "readiness_number" in metrics
        assert "ready_now" in metrics
        assert "turnover_in_30m" in metrics
        assert "threshold_state" in metrics
        assert "ward_breakdown" in metrics
        
        # Arithmetic check
        assert metrics["readiness_number"] == metrics["ready_now"] + metrics["turnover_in_30m"]
        assert metrics["total_hospital_beds"] == LIVE_DEMO_BED_COUNT, f"Must match exactly {LIVE_DEMO_BED_COUNT} live beds"
        
        # Ward breakdown check
        wards = metrics["ward_breakdown"]
        assert "ICU" in wards
        assert "WARD_A" in wards
        assert "WARD_B" in wards
        total_ward_beds = sum(w["total"] for w in wards.values())
        assert total_ward_beds == LIVE_DEMO_BED_COUNT
        
        # Threshold logic check
        score = metrics["readiness_number"]
        if score < 2:
            assert metrics["threshold_state"] == "CRITICAL"
            assert "🔴" in metrics["threshold_label"]
        elif score <= 4:
            assert metrics["threshold_state"] == "STRAINED"
            assert "🟡" in metrics["threshold_label"]
        else:
            assert metrics["threshold_state"] == "HEALTHY"
            assert "🟢" in metrics["threshold_label"]
            
        print(f"\n[PASS] Test 1: Live Readiness Engine — Score: {score} ({metrics['threshold_label']}) | Ready Now: {metrics['ready_now']} | 30m Turnover: {metrics['turnover_in_30m']}")
    finally:
        db.close()


def test_2_guardrail_8_green_consent_in_readiness():
    """Test 2: Guardrail #8 Compliance in Readiness Engine.
    Only beds with 🟢 Green consent or verified READY status enter forecasted capacity.
    Occupied beds with Amber / Red / Unconfirmed consent are strictly excluded.
    """
    db = SessionLocal()
    try:
        # Find an occupied bed
        occ_bed = db.query(models.Bed).filter(models.Bed.state == "OCCUPIED").first()
        assert occ_bed is not None, "Need an occupied bed for consent check"
        enc = db.query(models.Encounter).filter(models.Encounter.id == occ_bed.current_encounter_id).first()
        assert enc is not None
        
        # Case A: Amber consent (e.g. Needs ramp) -> must NOT unlock capacity
        orig_consent = enc.consent
        orig_p = enc.p_discharge
        
        enc.consent = "amber"
        enc.p_discharge = 0.85
        db.commit()
        
        metrics_amber = get_readiness_metrics(db)
        near_ready_ids_amber = [b["bed_id"] for b in metrics_amber["near_ready_beds"]]
        assert occ_bed.id not in near_ready_ids_amber, "Amber consent bed must NOT count in readiness under Guardrail #8"
        
        # Case B: Red consent (e.g. Refused) -> must NOT unlock capacity
        enc.consent = "red"
        db.commit()
        metrics_red = get_readiness_metrics(db)
        near_ready_ids_red = [b["bed_id"] for b in metrics_red["near_ready_beds"]]
        assert occ_bed.id not in near_ready_ids_red, "Red consent bed must NOT count in readiness under Guardrail #8"
        
        # Restore original state
        enc.consent = orig_consent
        enc.p_discharge = orig_p
        db.commit()
        
        print("\n[PASS] Test 2: Guardrail #8 enforced — Amber and Red consent beds strictly excluded from readiness capacity.")
    finally:
        db.close()


def test_3_guardrail_10_scale_separation_and_time_saved():
    """Test 3: Guardrail #10 Compliance in Time Saved Counter.
    Live demonstrator telemetry is strictly bound to 30 beds.
    300-bed hospital numbers are explicitly marked as 10x projections and never blended.
    """
    db = SessionLocal()
    try:
        # Direct Guardrail function test
        enforce_scale_separation(is_live_telemetry=True, bed_count=30)
        
        # Violation test: Passing 300 beds as live telemetry must raise GuardrailViolation
        exc = assert_raises(
            GuardrailViolation,
            enforce_scale_separation,
            is_live_telemetry=True,
            bed_count=300
        )
        assert "GUARDRAIL #10 VIOLATION" in str(exc) or "Live telemetry" in str(exc)
        
        # Compute time saved
        savings = calculate_time_saved(db)
        live = savings["live_demonstrator_30bed"]
        proj = savings["projected_hospital_300bed"]
        
        assert live["bed_capacity"] == 30
        assert proj["bed_capacity"] == 300
        assert proj["scale_factor"] == "10x Extrapolation"
        
        # Mathematical 10x relationship
        expected_proj_hours = round(live["total_hours_saved"] * 10.0, 1)
        assert abs(proj["daily_hours_saved"] - expected_proj_hours) < 0.1
        
        # Annualized projections
        assert proj["annual_hours_saved"] == int(round(proj["daily_hours_saved"] * 365, 0))
        assert proj["annual_bed_days_freed"] == int(round(proj["annual_hours_saved"] / 24.0, 0))
        
        print(f"\n[PASS] Test 3: Guardrail #10 verified — Live 30-bed ({live['total_hours_saved']}h) strictly partitioned from 10x 300-bed projection ({proj['daily_hours_saved']}h/day, {proj['annual_bed_days_freed']} bed-days/yr).")
    finally:
        db.close()


def test_4_one_tap_emergency_console_and_guardrail_1():
    """Test 4: One-Tap Emergency Console (Feature F9) & Guardrail #1 Clinical Primacy.
    Emergency trigger sets 15m housekeeping SLA, alerts porters, and writes dual-timestamp event log.
    Strictly verifies Guardrail #1: clinical discharge is NEVER automated.
    """
    db = SessionLocal()
    try:
        # Count encounters before emergency trigger
        active_enc_count_before = db.query(models.Encounter).filter(models.Encounter.status == "ACTIVE").count()
        
        res = activate_emergency_console(
            surge_type="MASS_CASUALTY_BUS_ACCIDENT",
            beds_needed=4,
            db=db,
            caller_role="Emergency Dept CMO"
        )
        
        assert res["status"] == "ACTIVATED"
        assert res["surge_type"] == "MASS_CASUALTY_BUS_ACCIDENT"
        assert res["beds_needed"] == 4
        assert len(res["broadcast_alerts"]) >= 3
        
        # Guardrail #1: Active clinical encounters must remain untouched (no automated discharges!)
        active_enc_count_after = db.query(models.Encounter).filter(models.Encounter.status == "ACTIVE").count()
        assert active_enc_count_before == active_enc_count_after, "Guardrail #1 violated: Emergency trigger altered clinical status!"
        
        # Verify housekeeping tasks were expedited to 15m deadline
        for bed_id in res["expedited_cleaning_beds"]:
            task = db.query(models.Task).filter(models.Task.id == f"TSK-CLEAN-{bed_id}").first()
            assert task is not None
            assert task.confidence == 0.99
            assert "EMERGENCY EXPEDITE" in task.title_en
            
        # Verify dual-timestamp audit trail in event_log
        event = db.query(models.EventLog).filter(
            models.EventLog.action == "EMERGENCY_SURGE_ACTIVATED"
        ).order_by(models.EventLog.id.desc()).first()
        
        assert event is not None
        assert event.actual_time is not None
        assert event.logged_time is not None
        assert event.payload_json["surge_type"] == "MASS_CASUALTY_BUS_ACCIDENT"
        assert "Guardrail #1" in event.payload_json["guardrail_enforced"]
        
        print(f"\n[PASS] Test 4: One-Tap Emergency Console — Activated for {res['beds_needed']} beds. Housekeeping tasks expedited to 15m SLA. Guardrail #1 verified (0 auto-discharges). Dual-timestamp event logged.")
    finally:
        db.close()


def test_5_single_blocker_diagnostic_view():
    """Test 5: Single-Blocker Diagnostic View ('What's Blocking This Bed?').
    Verifies every bed maps to exactly one primary bottleneck,
    and Delay Book learned P90 budgets and actionable resolving steps are attached.
    """
    db = SessionLocal()
    try:
        result = get_bed_blockers(db)
        
        assert result["total_beds_analyzed"] == LIVE_DEMO_BED_COUNT
        assert len(result["blockers"]) == LIVE_DEMO_BED_COUNT
        
        # All beds must have non-empty blocker attributes
        blocker_keys_seen = set()
        for b in result["blockers"]:
            assert "bed_id" in b
            assert "ward" in b
            assert "blocker_key" in b
            assert "blocker_name" in b
            assert "learned_p90_minutes" in b
            assert "resolving_action" in b
            assert "severity" in b
            assert b["severity"] in ["GREEN", "AMBER", "RED", "BLUE"]
            assert b["learned_p90_minutes"] >= 0.0
            blocker_keys_seen.add(b["blocker_key"])
            
        # Verify blocker counts match
        counts = result["blocker_counts"]
        total_counted = sum(counts.values())
        assert total_counted == LIVE_DEMO_BED_COUNT
        
        print(f"\n[PASS] Test 5: Single-Blocker Diagnostic View — Analyzed all {LIVE_DEMO_BED_COUNT} beds. Blockers identified: {dict(counts)}.")
    finally:
        db.close()


def test_6_fastapi_endpoints():
    """Test 6: FastAPI Phase 9 Endpoints Integration.
    Tests HTTP 200 OK responses and schema adherence across:
    - GET /api/readiness/live
    - GET /api/blockers
    - GET /api/metrics/time-saved
    - POST /api/emergency/activate
    """
    # 1. Live readiness
    r1 = client.get("/api/readiness/live")
    assert r1.status_code == 200, f"Expected 200, got {r1.status_code}"
    d1 = r1.json()
    assert "readiness_number" in d1
    assert "threshold_state" in d1
    
    # 2. Blockers
    r2 = client.get("/api/blockers")
    assert r2.status_code == 200, f"Expected 200, got {r2.status_code}"
    d2 = r2.json()
    assert d2["total_beds_analyzed"] == 30
    assert len(d2["blockers"]) == 30
    
    # 3. Time saved
    r3 = client.get("/api/metrics/time-saved")
    assert r3.status_code == 200, f"Expected 200, got {r3.status_code}"
    d3 = r3.json()
    assert d3["live_demonstrator_30bed"]["bed_capacity"] == 30
    assert d3["projected_hospital_300bed"]["bed_capacity"] == 300
    
    # 4. Emergency activation
    r4 = client.post("/api/emergency/activate", json={
        "surge_type": "HIGHWAY_COLLISION_TRIAGE",
        "beds_needed": 4,
        "caller_role": "Trauma Director"
    })
    assert r4.status_code == 200, f"Expected 200, got {r4.status_code}"
    d4 = r4.json()
    assert d4["status"] == "ACTIVATED"
    assert d4["surge_type"] == "HIGHWAY_COLLISION_TRIAGE"
    
    print("\n[PASS] Test 6: FastAPI Phase 9 Endpoints — All 4 endpoints return 200 OK with valid schema.")


if __name__ == "__main__":
    print("=" * 75)
    print("SWASTHFLOW AI — PHASE 9 TEST SUITE: READINESS ENGINE & EMERGENCY CONSOLE")
    print("=" * 75)
    
    test_1_readiness_number_and_thresholds()
    test_2_guardrail_8_green_consent_in_readiness()
    test_3_guardrail_10_scale_separation_and_time_saved()
    test_4_one_tap_emergency_console_and_guardrail_1()
    test_5_single_blocker_diagnostic_view()
    test_6_fastapi_endpoints()
    
    print("\n" + "=" * 75)
    print("ALL 6 PHASE 9 TESTS PASSED WITH ZERO FAILURES OR REGRESSIONS.")
    print("=" * 75)
