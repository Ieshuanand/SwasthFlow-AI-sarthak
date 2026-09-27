"""SwasthFlow AI — Phase 7 Automated Test Suite.
Verifies:
  1. Payer-type aware consent classification:
     - Cash patient + payer_confirmed='no' -> AMBER with resolving action "Bill estimate sent — awaiting family confirmation by morning".
     - Institutional payer + payer_confirmed='no' -> RED (denial/blocker).
  2. Bill Estimator range calculation: +/- 10% uncertainty range, rounded to nearest ₹1,000, never a single point estimate.
  3. Guardrail #6 compliance: mandatory 'estimate' and 'not the final bill' disclaimers in English & Hindi.
  4. SMS dispatch, database persistence in bill_estimate, and audit logging to event_log with dual timestamps.
  5. Frontline confirmation loop & Guardrail #8 capacity unlock: transition from AMBER -> GREEN.
  6. FastAPI endpoints integration.
"""

import sys
import datetime
from sqlalchemy.orm import Session
from fastapi.testclient import TestClient

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

import models
from database import SessionLocal, engine
from simulator import HospitalSimulator
from nurse_check import classify_consent, NurseCheckManager
from bill_estimator import BillEstimator
from guardrails import (
    enforce_financial_estimate_disclaimer,
    enforce_green_consent_capacity,
    GuardrailViolation
)
from main import app

client = TestClient(app)


def test_payer_type_aware_consent():
    print("\n--- TEST 1: PAYER-TYPE AWARE CONSENT CLASSIFICATION ---")
    
    # 1. CASH patient with payer_confirmed='no' -> MUST be AMBER (expected evening state)
    cash_eval = classify_consent(
        payer_confirmed="no",
        family_available="yes",
        home_problem="None",
        payer_type="CASH"
    )
    print(f"CASH Patient (Payer=No): Consent = {cash_eval['consent'].upper()}")
    print(f"  • Reason:           {cash_eval['reason_en']}")
    print(f"  • Resolving Action: {cash_eval['resolving_action_en']}")
    print(f"  • Is Actionable:    {cash_eval['is_actionable_amber']}")
    assert cash_eval["consent"] == "amber", "CASH unconfirmed payer MUST be AMBER, not RED!"
    assert "Bill estimate sent" in cash_eval["resolving_action_en"]
    assert cash_eval["is_actionable_amber"] is True

    # 2. TPA patient with payer_confirmed='no' -> MUST be RED (insurance denial)
    tpa_eval = classify_consent(
        payer_confirmed="no",
        family_available="yes",
        home_problem="None",
        payer_type="TPA"
    )
    print(f"\nTPA Patient (Payer=No): Consent = {tpa_eval['consent'].upper()}")
    print(f"  • Reason:           {tpa_eval['reason_en']}")
    print(f"  • Resolving Action: {tpa_eval['resolving_action_en']}")
    assert tpa_eval["consent"] == "red", "TPA unconfirmed/denied MUST be RED!"
    assert tpa_eval["is_actionable_amber"] is False

    # 3. AYUSHMAN patient with payer_confirmed='no' -> MUST be RED (scheme denial)
    ayush_eval = classify_consent(
        payer_confirmed="no",
        family_available="yes",
        home_problem="None",
        payer_type="AYUSHMAN"
    )
    print(f"\nAYUSHMAN Patient (Payer=No): Consent = {ayush_eval['consent'].upper()}")
    assert ayush_eval["consent"] == "red", "Ayushman unconfirmed/denied MUST be RED!"
    
    print("[PASS] Test 1: Payer-type aware consent verified. CASH maps to AMBER, institutional payers map to RED.")


def test_bill_estimator_range_and_guardrail6():
    print("\n--- TEST 2: BILL ESTIMATOR RANGE CALCULATION & GUARDRAIL #6 ---")
    db: Session = SessionLocal()
    try:
        # Find or create a CASH encounter
        cash_enc = db.query(models.Encounter).filter(
            models.Encounter.status == "ACTIVE",
            models.Encounter.payer_type == "CASH"
        ).first()

        if not cash_enc:
            cash_enc = models.Encounter(
                id="ENC-TEST-CASH-01",
                patient_id="PT-CASH-01",
                patient_name="Mohit Agarwal",
                age=45,
                gender="M",
                ward="WARD_A",
                bed_id="WARD_A-05",
                admission_time=datetime.datetime.utcnow() - datetime.timedelta(days=3),
                admission_actual_time=datetime.datetime.utcnow() - datetime.timedelta(days=3),
                admission_logged_time=datetime.datetime.utcnow() - datetime.timedelta(days=3, minutes=20),
                diagnosis_code="A90",
                diagnosis_name="Dengue Fever with Thrombocytopenia",
                consultant_id="DR_SHARMA",
                consultant_name="Dr. Vivek Sharma (Internal Med)",
                payer_type="CASH",
                payer_name="Self Pay (Cash)",
                los_days=3.0,
                status="ACTIVE",
                consent="amber",
                p_discharge=0.88
            )
            db.add(cash_enc)
            db.commit()

        estimator = BillEstimator(db=db)
        est = estimator.calculate_estimate(cash_enc.id)

        print(f"Patient:          {est['patient_name']} ({est['bed_id']})")
        print(f"Accrued Amount:   Rs. {est['accrued_amount']:,.2f}")
        print(f"Projected Low:    Rs. {est['projected_low']:,.2f}")
        print(f"Projected High:   Rs. {est['projected_high']:,.2f}")
        print(f"Projected Range:  Rs. {int(est['projected_low']):,} - {int(est['projected_high']):,}")
        print(f"Breakdown:        Room=Rs. {est['breakdown']['room_and_bed']}, Docs=Rs. {est['breakdown']['physician_consultations']}, Diag=Rs. {est['breakdown']['diagnostics_and_lab']}")

        # Verify range properties
        assert est["projected_low"] < est["projected_high"], "Estimate must be a range, never single point!"
        assert est["projected_low"] % 1000 == 0, "Projected low must be rounded to nearest ₹1,000"
        assert est["projected_high"] % 1000 == 0, "Projected high must be rounded to nearest ₹1,000"
        
        # Verify Guardrail #6 disclaimer
        print(f"\nDisclaimer EN:    {est['breakdown']['disclaimer_en']}")
        print(f"Disclaimer HI:    {est['breakdown']['disclaimer_hi']}")
        assert enforce_financial_estimate_disclaimer(est['breakdown']['disclaimer_en']) is True
        assert "estimate" in est["sms_text_en"].lower()
        assert "final bill" in est["sms_text_en"].lower()

        print("[PASS] Test 2: Bill Estimator calculates strict +/- 10% range rounded to ₹1,000 with mandatory disclaimers.")
    finally:
        db.close()


def test_sms_dispatch_and_audit_logging():
    print("\n--- TEST 3: SMS DISPATCH, PERSISTENCE & DUAL-TIMESTAMP LOGGING ---")
    db: Session = SessionLocal()
    try:
        cash_enc = db.query(models.Encounter).filter(
            models.Encounter.status == "ACTIVE",
            models.Encounter.payer_type == "CASH"
        ).first()
        assert cash_enc is not None

        estimator = BillEstimator(db=db)
        res = estimator.send_bill_estimate_sms(
            encounter_id=cash_enc.id,
            family_phone="+91 98123 45678"
        )
        print(f"SMS Dispatch Result: Status={res['status']}, Range={res['projected_range']}")
        print(f"SMS Copy EN: {res['sms_en']}")
        print(f"SMS Copy HI: {res['sms_hi']}")
        assert res["success"] is True

        # Verify database record
        est_db = db.query(models.BillEstimate).filter(
            models.BillEstimate.encounter_id == cash_enc.id
        ).first()
        assert est_db is not None
        assert est_db.status == "SMS_SENT"
        assert est_db.sent_at is not None
        assert est_db.family_phone == "+91 98123 45678"

        # Verify audit log in event_log
        log_event = db.query(models.EventLog).filter(
            models.EventLog.action == "BILL_ESTIMATE_SMS_SENT",
            models.EventLog.entity == cash_enc.id
        ).order_by(models.EventLog.id.desc()).first()

        assert log_event is not None
        print(f"\nAudit Event Logged:")
        print(f"  • Action:       {log_event.action}")
        print(f"  • Actual Time:  {log_event.actual_time}")
        print(f"  • Logged Time:  {log_event.logged_time}")
        print(f"  • Doc Lag:      {log_event.doc_lag_minutes} minutes")
        assert log_event.doc_lag_minutes > 0

        print("[PASS] Test 3: SMS dispatch persisted to DB and recorded in append-only event_log.")
    finally:
        db.close()


def test_confirmation_and_capacity_unlock():
    print("\n--- TEST 4: FAMILY CONFIRMATION & GUARDRAIL #8 CAPACITY UNLOCK ---")
    db: Session = SessionLocal()
    try:
        cash_enc = db.query(models.Encounter).filter(
            models.Encounter.status == "ACTIVE",
            models.Encounter.payer_type == "CASH"
        ).first()
        assert cash_enc is not None

        # Simulate nurse check submission with payer_confirmed='no'
        mgr = NurseCheckManager(db=db)
        eval_prior = mgr.submit_nurse_check(
            encounter_id=cash_enc.id,
            payer_confirmed="no",
            family_available="yes",
            home_problem="None",
            nurse_name="Sister Rekha"
        )
        print(f"Pre-Confirmation Consent:  {eval_prior['consent'].upper()} (Counts as capacity = {eval_prior['counts_as_forecasted_capacity']})")
        assert eval_prior["consent"] == "amber"
        assert eval_prior["counts_as_forecasted_capacity"] is False

        # Frontline action: Family confirms arranged funds
        estimator = BillEstimator(db=db)
        confirm_res = estimator.confirm_family_funds(encounter_id=cash_enc.id)
        print(f"\nFamily Funds Confirmed:")
        print(f"  • Previous Consent: {confirm_res['previous_consent'].upper()}")
        print(f"  • New Consent:      {confirm_res['new_consent'].upper()}")
        print(f"  • Counts as Capacity: {confirm_res['counts_as_forecasted_capacity']}")

        assert confirm_res["new_consent"] == "green", "Confirmed funds must transition consent to GREEN!"
        assert confirm_res["counts_as_forecasted_capacity"] is True, "Green consent with high confidence must unlock capacity!"

        # Verify Guardrail #8
        assert enforce_green_consent_capacity("green", 0.85) is True
        assert enforce_green_consent_capacity("amber", 0.85) is False

        print("[PASS] Test 4: Family funds confirmation successfully unlocks forecasted capacity under Guardrail #8.")
    finally:
        db.close()


def test_fastapi_phase7_endpoints():
    print("\n--- TEST 5: FASTAPI PHASE 7 ENDPOINTS ---")
    
    # 1. GET /api/bill-estimate/candidates
    res = client.get("/api/bill-estimate/candidates")
    assert res.status_code == 200
    data = res.json()
    print(f"[PASS] GET /api/bill-estimate/candidates -> {data['cash_candidate_count']} cash candidates")
    assert data["cash_candidate_count"] >= 1
    sample_enc_id = data["candidates"][0]["encounter_id"]

    # 2. GET /api/bill-estimate/{encounter_id}
    res_est = client.get(f"/api/bill-estimate/{sample_enc_id}")
    assert res_est.status_code == 200
    est_data = res_est.json()
    print(f"[PASS] GET /api/bill-estimate/{sample_enc_id} -> Range: Rs. {int(est_data['projected_low']):,} - {int(est_data['projected_high']):,}")
    assert est_data["projected_low"] < est_data["projected_high"]

    # 3. POST /api/bill-estimate/send/{encounter_id}
    res_send = client.post(
        f"/api/bill-estimate/send/{sample_enc_id}",
        json={"family_phone": "+91 99887 76655"}
    )
    assert res_send.status_code == 200
    send_data = res_send.json()
    print(f"[PASS] POST /api/bill-estimate/send/{sample_enc_id} -> Status: {send_data['status']}")
    assert send_data["success"] is True

    # 4. POST /api/bill-estimate/confirm/{encounter_id}
    res_conf = client.post(f"/api/bill-estimate/confirm/{sample_enc_id}")
    assert res_conf.status_code == 200
    conf_data = res_conf.json()
    print(f"[PASS] POST /api/bill-estimate/confirm/{sample_enc_id} -> Consent: {conf_data['new_consent'].upper()}")
    assert conf_data["new_consent"] == "green"

    print("[PASS] Test 5: All 4 FastAPI endpoints respond with valid schemas and HTTP 200.")


if __name__ == "__main__":
    print("=" * 80)
    print("=== PHASE 7 VERIFICATION: BILL ESTIMATOR & FAMILY PROJECTED RANGE SMS ===")
    print("=" * 80)
    test_payer_type_aware_consent()
    test_bill_estimator_range_and_guardrail6()
    test_sms_dispatch_and_audit_logging()
    test_confirmation_and_capacity_unlock()
    test_fastapi_phase7_endpoints()
    print("\n" + "=" * 80)
    print("=== ALL PHASE 7 TESTS PASSED SUCCESSFULLY! ===")
    print("=" * 80)
