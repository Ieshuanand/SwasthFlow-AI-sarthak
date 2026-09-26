"""SwasthFlow AI — Test Suite for Role-Based Persona Dashboards.

Verifies:
1. Cleaner Terminal Disinfection: Transitions DIRTY bed to READY, clears blocking step, logs dual timestamps.
2. Doctor Clinical Discharge: Attending doctor explicitly confirms discharge, patient released, bed moved to DIRTY queue (Guardrail #1).
3. Doctor Discharge Gate: Unconfirmed discharge blocked with GuardrailViolation.
4. Staff Roster: Correctly returns doctors, nurses, cleaners, and phlebotomists.
"""

import sys
import os
import json
from fastapi.testclient import TestClient

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

sys.path.insert(0, os.path.dirname(__file__))

import models
from database import SessionLocal
from main import app
from guardrails import GuardrailViolation

client = TestClient(app)


def test_1_cleaner_terminal_disinfection():
    """Test 1: Cleaner marks a DIRTY bed as disinfected & READY."""
    db = SessionLocal()
    try:
        # Find or make a bed dirty
        bed = db.query(models.Bed).first()
        assert bed is not None
        bed.state = "DIRTY"
        bed.blocking_step = "HOUSEKEEPING_CLEANING"
        db.commit()

        # Call endpoint as cleaner Anand R.
        res = client.post(
            f"/api/beds/{bed.id}/clean",
            json={"staff_name": "Anand R. (Sweeper)", "cleaning_notes": "Terminal cleaning complete"}
        )
        assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text}"
        data = res.json()
        assert data["state"] == "READY"
        assert data["bed_id"] == bed.id

        # Verify DB state
        db.refresh(bed)
        assert bed.state == "READY"
        assert bed.blocking_step is None

        # Verify event log with dual timestamps
        event = db.query(models.EventLog).filter(
            models.EventLog.action == "BED_TERMINAL_CLEANED"
        ).order_by(models.EventLog.id.desc()).first()
        assert event is not None
        assert event.doc_lag_minutes == 3.0
        details = event.payload_json if isinstance(event.payload_json, dict) else json.loads(event.payload_json)
        assert details["bed_id"] == bed.id
        assert details["new_state"] == "READY"

        print(f"[PASS] Test 1: Cleaner terminal disinfection verified for bed {bed.id} (marked READY with dual-timestamp audit).")
    finally:
        db.close()


def test_2_doctor_clinical_discharge_guardrail_1():
    """Test 2: Doctor signs clinical discharge under Guardrail #1."""
    db = SessionLocal()
    try:
        # Find an active encounter
        enc = db.query(models.Encounter).filter(models.Encounter.status == "ACTIVE").first()
        assert enc is not None
        orig_bed_id = enc.bed_id

        # 1. Unconfirmed discharge must be rejected per Guardrail #1
        res_fail = client.post(
            f"/api/encounters/{enc.id}/doctor-discharge",
            json={"consultant_id": "DR_SHARMA", "confirm_discharge": False}
        )
        assert res_fail.status_code == 400
        assert "GUARDRAIL #1" in res_fail.text

        # 2. Confirmed doctor discharge succeeds
        res_ok = client.post(
            f"/api/encounters/{enc.id}/doctor-discharge",
            json={
                "consultant_id": "DR_SHARMA",
                "doctor_name": "Dr. Vivek Sharma",
                "clinical_notes": "Vitals stable for 24h, oral switch complete, safe for discharge.",
                "confirm_discharge": True
            }
        )
        assert res_ok.status_code == 200, f"Expected 200, got {res_ok.status_code}: {res_ok.text}"
        data = res_ok.json()
        assert data["bed_state"] == "DIRTY"

        # Verify encounter discharged
        db.refresh(enc)
        assert enc.status == "DISCHARGED"

        # Verify bed is now in DIRTY housekeeping queue
        if orig_bed_id:
            bed = db.query(models.Bed).filter(models.Bed.id == orig_bed_id).first()
            assert bed is not None
            assert bed.state == "DIRTY"
            assert bed.blocking_step == "HOUSEKEEPING_CLEANING"

        print(f"[PASS] Test 2: Doctor clinical discharge verified under Guardrail #1 for encounter {enc.id} (bed moved to DIRTY queue).")
    finally:
        db.close()


def test_3_staff_roster():
    """Test 3: Verify staff roster endpoint returns categorized roles."""
    res = client.get("/api/staff/roster")
    assert res.status_code == 200
    roster = res.json()
    assert len(roster["doctors"]) >= 5
    assert len(roster["nurses"]) >= 3
    assert len(roster["cleaners"]) >= 2
    assert len(roster["phlebotomists"]) >= 3
    print(f"[PASS] Test 3: Staff roster returned {len(roster['doctors'])} doctors, {len(roster['nurses'])} nurses, {len(roster['cleaners'])} cleaners, {len(roster['phlebotomists'])} phlebotomists.")


def test_4_staff_duty_login():
    """Test 4: Verify staff duty login and audit trail logging."""
    res = client.post(
        "/api/auth/login",
        json={
            "staff_id": "NURSE_1",
            "name": "Sister Sunita",
            "role": "NURSE",
            "ward": "WARD_A",
            "pin": "1234"
        }
    )
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "authenticated"
    assert data["role"] == "NURSE"
    assert data["ward"] == "WARD_A"
    assert "token" in data

    db = SessionLocal()
    try:
        ev = db.query(models.EventLog).filter(
            models.EventLog.action == "STAFF_DUTY_LOGIN",
            models.EventLog.entity == "NURSE_1"
        ).order_by(models.EventLog.id.desc()).first()
        assert ev is not None
        assert ev.actor == "Sister Sunita"
        print(f"[PASS] Test 4: Staff duty login verified for {data['name']} ({data['role']}) with audit trail.")
    finally:
        db.close()


if __name__ == "__main__":
    print("=== RUNNING ROLE-BASED DASHBOARDS VERIFICATION SUITE ===")
    test_1_cleaner_terminal_disinfection()
    test_2_doctor_clinical_discharge_guardrail_1()
    test_3_staff_roster()
    test_4_staff_duty_login()
    print("\nALL ROLE-BASED DASHBOARD TESTS PASSED SUCCESSFULLY!")
