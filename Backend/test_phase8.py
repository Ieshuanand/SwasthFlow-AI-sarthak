"""SwasthFlow AI — Phase 8 Test Suite: ICU Step-Down & 2x Candidate Over-Preparation (Feature F3).
Verifies:
1. Guardrail #1 (Doctor Decides: unconfirmed step-down strictly raises GuardrailViolation)
2. Rule #10 (2x Candidate Over-Preparation: prepares 2K candidates for K beds, surgical vs medical routing)
3. Phrasing Guardrail (Positive recovery phrasing approved; coercive bed-shortage pressure blocked)
4. Family Refusal -> Immediate Bed Release & 2x Alternate Candidate Promotion with MANDATORY Guardrail #1 Doctor Gate
5. Dedicated Amber-Path Test: Hold in transit lounge, ward-sister reassurance resolving action, bed NOT released, capacity NOT unlocked
6. Guardrail #8 (Green-Consent Capacity: only 🟢 Agreed unlocks capacity; 🟡 Worried & 🔴 Refused do not)
7. Physical Transfer Execution (Bed occupancy swap, old ICU bed set to DIRTY with rapid clean task)
8. FastAPI Endpoints Integration (200 OK responses, 400 on GuardrailViolation)
"""

import sys
import os
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
    enforce_family_communication_script,
    GuardrailViolation
)
from icu_stepdown import (
    get_stepdown_roster,
    trigger_doctor_stepdown,
    submit_family_consent,
    execute_transfer,
    compute_stability_score,
    generate_family_stepdown_script,
    determine_preferred_ward
)

client = TestClient(app)


def assert_raises(exc_type, func, *args, **kwargs):
    try:
        func(*args, **kwargs)
    except exc_type as e:
        return e
    raise AssertionError(f"Expected {exc_type.__name__} but no exception was raised")


def reset_icu_test_state(db):
    """Resets ICU encounters and reserved ward beds for clean, idempotent testing."""
    icu_bed_mapping = {
        "ENC-5004": "ICU-01",
        "ENC-5010": "ICU-02",
        "ENC-5013": "ICU-03",
        "ENC-5021": "ICU-04",
        "ENC-5003": "ICU-06",
    }
    for enc_id, bed_id in icu_bed_mapping.items():
        enc = db.query(models.Encounter).filter(models.Encounter.id == enc_id).first()
        if enc:
            enc.ward = "ICU"
            enc.bed_id = bed_id
            enc.status = "ACTIVE"
            enc.icu_stepdown_status = "NONE"
            enc.stepdown_doctor_confirmed = False
            enc.reserved_bed_id = None
            enc.stepdown_consent = None
            enc.stepdown_consent_notes = None

            icu_bed = db.query(models.Bed).filter(models.Bed.id == bed_id).first()
            if icu_bed:
                icu_bed.state = "OCCUPIED"
                icu_bed.current_encounter_id = enc_id
                icu_bed.blocking_step = "CLINICAL_MONITORING"

    for bed in db.query(models.Bed).filter(models.Bed.ward.in_(["WARD_A", "WARD_B"])).all():
        if bed.state == "RESERVED" or bed.current_encounter_id in icu_bed_mapping:
            bed.state = "READY"
            bed.current_encounter_id = None
            bed.blocking_step = "READY"

    for b_id in ["WARD_A-08", "WARD_A-12", "WARD_B-03", "WARD_B-07"]:
        b = db.query(models.Bed).filter(models.Bed.id == b_id).first()
        if b and (b.current_encounter_id in icu_bed_mapping or b.current_encounter_id is None):
            b.state = "READY"
            b.blocking_step = "READY"
            b.current_encounter_id = None

    db.commit()


def test_guardrail_1_doctor_decides():
    """Test 1: Guardrail #1 — AI never auto-triggers clinical readiness.
    Triggering step-down without clinician confirmation strictly raises GuardrailViolation."""
    db = SessionLocal()
    try:
        reset_icu_test_state(db)
        enc = db.query(models.Encounter).filter(
            models.Encounter.ward == "ICU",
            models.Encounter.status == "ACTIVE"
        ).first()
        assert enc is not None, "Need at least one active ICU encounter"

        # Attempt to trigger without clinician confirmation
        exc = assert_raises(
            GuardrailViolation,
            trigger_doctor_stepdown,
            encounter_id=enc.id,
            consultant_id="AI_ASSISTANT",
            db=db,
            clinician_confirmed=False
        )
        assert "requires explicit human clinician authorization" in str(exc)
        print("\n[PASS] Test 1: Guardrail #1 enforced — Unconfirmed step-down blocked with GuardrailViolation.")
    finally:
        db.close()


def test_2x_candidate_over_preparation_and_routing():
    """Test 2: Rule #10 — 2x Candidate Over-Preparation and Clinical Specialty Routing.
    For target_beds_needed=1, prepares 2 candidates (Primary + Buffer).
    Verifies surgical vs medical preferred ward routing."""
    db = SessionLocal()
    try:
        reset_icu_test_state(db)
        roster_data = get_stepdown_roster(db, target_beds_needed=1)

        assert roster_data["target_beds_needed"] == 1
        assert roster_data["over_preparation_multiplier"] == 2
        assert roster_data["candidates_required"] == 2
        assert roster_data["candidates_prepared"] >= 2
        assert roster_data["buffer_healthy"] is True

        # Check buffer roles
        roles = [c["role_in_buffer"] for c in roster_data["roster"]]
        assert "PRIMARY" in roles, "Must have a PRIMARY candidate"
        assert "BUFFER" in roles, "Must have a 2x BUFFER candidate"

        primary_cand = next(c for c in roster_data["roster"] if c["role_in_buffer"] == "PRIMARY")
        buffer_cand = next(c for c in roster_data["roster"] if c["role_in_buffer"] == "BUFFER")
        assert primary_cand["encounter_id"] != buffer_cand["encounter_id"]

        # Check clinical specialty routing
        for cand in roster_data["roster"]:
            diag = cand["diagnosis_name"].lower()
            doc = cand["consultant_name"].lower()
            if "surgery" in diag or "surgical" in diag or "abdominal" in diag or "rao" in doc:
                assert cand["preferred_ward"] == "WARD_B", f"Surgical candidate {cand['patient_name']} must route to WARD_B"
            else:
                assert cand["preferred_ward"] == "WARD_A", f"Medical candidate {cand['patient_name']} must route to WARD_A"

        print(f"\n[PASS] Test 2: 2x Candidate Over-Preparation verified. Primary: {primary_cand['patient_name']}, Buffer: {buffer_cand['patient_name']}")
    finally:
        db.close()


def test_phrasing_guardrail_positive_recovery():
    """Test 3: Phrasing Guardrail — Family script must use positive recovery phrasing;
    coercive bed-shortage pressure ('we need this bed') strictly blocked."""
    # 1. Canonical positive recovery script
    scripts = generate_family_stepdown_script(
        patient_name="Suresh Sharma",
        consultant_name="Dr. Rajesh Patel",
        reserved_bed_id="WARD-A-11",
        ward_name="WARD_A"
    )
    assert "improved significantly" in scripts["script_en"]
    assert "clinically stable" in scripts["script_en"]
    assert "सुधार हुआ है" in scripts["script_hi"]

    # 2. Prohibited coercive phrase raises GuardrailViolation
    coercive_script = "Please vacate immediately because we need this bed for an emergency intake."
    exc = assert_raises(GuardrailViolation, enforce_family_communication_script, coercive_script)
    assert "Coercive bed-pressure phrase" in str(exc)

    print("\n[PASS] Test 3: Phrasing guardrail verified — Positive recovery approved, coercive language blocked.")


def test_family_refusal_and_candidate_2_promotion_doctor_gate():
    """Test 4: Candidate #2 Promotion & Mandatory Guardrail #1 Doctor-Confirmation Gate —
    When Candidate #1's family refuses:
    1. Reserved ward bed is released back to READY.
    2. Guardrail #8 blocks capacity unlock (counts_as_capacity == False).
    3. Candidate #2 (the 2x buffer candidate) is promoted to PRIMARY queue slot.
    4. MANDATORY GUARDRAIL #1 GATE ON PROMOTION:
       - Candidate #2 MUST NOT be auto-confirmed or auto-assigned a bed!
       - candidate_2.stepdown_doctor_confirmed remains False.
       - candidate_2.reserved_bed_id remains None.
       - Attempting to submit family consent on Candidate #2 raises GuardrailViolation!
       - Attempting to trigger step-down for Candidate #2 with clinician_confirmed=False raises GuardrailViolation!
       - Only when Candidate #2's attending clinician explicitly confirms (clinician_confirmed=True)
         does Candidate #2 get a reserved bed and proceed to the family consent workflow."""
    db = SessionLocal()
    try:
        reset_icu_test_state(db)
        roster_data = get_stepdown_roster(db, target_beds_needed=1)
        c1_info = next(c for c in roster_data["roster"] if c["role_in_buffer"] == "PRIMARY")
        c2_info = next(c for c in roster_data["roster"] if c["role_in_buffer"] == "BUFFER")

        c1 = db.query(models.Encounter).filter(models.Encounter.id == c1_info["encounter_id"]).first()
        c2 = db.query(models.Encounter).filter(models.Encounter.id == c2_info["encounter_id"]).first()

        # Doctor triggers step-down for Candidate 1
        trig_res = trigger_doctor_stepdown(
            encounter_id=c1.id,
            consultant_id=c1.consultant_id,
            db=db,
            clinician_confirmed=True
        )
        reserved_bed_id = trig_res["reserved_bed_id"]
        bed = db.query(models.Bed).filter(models.Bed.id == reserved_bed_id).first()
        assert bed.state == "RESERVED"

        # Candidate 1 family refuses
        consent_res = submit_family_consent(
            encounter_id=c1.id,
            consent="refused",
            notes="Family feels patient needs one more night in ICU.",
            db=db,
            nurse_name="Sister Sunita"
        )

        assert consent_res["consent"] == "refused"
        assert consent_res["counts_as_forecasted_capacity"] is False
        assert consent_res["icu_stepdown_status"] == "CONSENT_REFUSED"
        assert consent_res["alternate_promoted"] is not None
        assert consent_res["alternate_promoted"]["encounter_id"] == c2.id

        # 1. Verify Candidate 1's reserved bed was released back to READY
        db.refresh(bed)
        assert bed.state == "READY", f"Bed {bed.id} must be released back to READY on family refusal"
        assert bed.blocking_step == "READY"

        # 2. VERIFY CANDIDATE 2'S GUARDRAIL #1 GATE:
        db.refresh(c2)
        assert c2.stepdown_doctor_confirmed is False, "Candidate #2 MUST NOT be auto-confirmed on promotion"
        assert c2.reserved_bed_id is None, "Candidate #2 MUST NOT be auto-assigned a reserved bed on promotion"

        # Attempting family consent on Candidate #2 without doctor confirmation MUST raise GuardrailViolation!
        exc_consent = assert_raises(
            GuardrailViolation,
            submit_family_consent,
            encounter_id=c2.id,
            consent="agreed",
            notes="Family says yes",
            db=db
        )
        assert "without prior explicit authorization by attending clinician" in str(exc_consent)

        # Attempting unconfirmed clinical trigger for Candidate #2 MUST raise GuardrailViolation!
        exc_trig = assert_raises(
            GuardrailViolation,
            trigger_doctor_stepdown,
            encounter_id=c2.id,
            consultant_id=c2.consultant_id,
            db=db,
            clinician_confirmed=False
        )
        assert "requires explicit human clinician authorization" in str(exc_trig)

        # 3. Only when Candidate #2's attending clinician explicitly authorizes does Candidate #2 pass the gate
        c2_doc_res = trigger_doctor_stepdown(
            encounter_id=c2.id,
            consultant_id=c2.consultant_id,
            db=db,
            clinician_confirmed=True
        )
        assert c2_doc_res["status"] == "SUCCESS"
        db.refresh(c2)
        assert c2.stepdown_doctor_confirmed is True
        assert c2.reserved_bed_id is not None
        assert c2.icu_stepdown_status == "BED_RESERVED"

        # 4. Now Candidate #2 can proceed into family consent
        c2_consent_res = submit_family_consent(
            encounter_id=c2.id,
            consent="agreed",
            notes="Family reviewed and agreed with Dr. Patel",
            db=db
        )
        assert c2_consent_res["counts_as_forecasted_capacity"] is True
        assert c2_consent_res["icu_stepdown_status"] == "READY_FOR_TRANSFER"

        print(f"\n[PASS] Test 4: Candidate #2 promotion verified — Bed {reserved_bed_id} released, Candidate #2 re-entered Guardrail #1 doctor gate before bed reservation & consent.")
    finally:
        db.close()


def test_amber_path_worried_reassurance_hold():
    """Test 5: Dedicated Amber-Path Verification (Hold in Transit Lounge & Ward-Sister Reassurance) —
    When a family is worried/anxious:
    1. Clinician confirms step-down -> Bed is reserved in matching ward.
    2. Nurse records consent = 'worried'.
    3. Guardrail #8: counts_as_capacity is strictly False (does NOT unlock capacity).
    4. DOES NOT RELEASE BED: The reserved ward bed remains held in RESERVED state while counseling occurs.
    5. Resolving Action: Surfaces senior ward sister counseling on continuous monitoring equipment.
    6. Patient state: Held in ICU / transit lounge (status = CONSENT_WORRIED).
    7. 2x Buffer Candidate stays on standby.
    8. Attempting physical transfer while in this Amber state strictly raises GuardrailViolation."""
    db = SessionLocal()
    try:
        reset_icu_test_state(db)
        enc = db.query(models.Encounter).filter(
            models.Encounter.ward == "ICU",
            models.Encounter.status == "ACTIVE"
        ).first()
        assert enc is not None

        # 1. Clinician confirms step-down
        trig_res = trigger_doctor_stepdown(
            encounter_id=enc.id,
            consultant_id=enc.consultant_id,
            db=db,
            clinician_confirmed=True
        )
        reserved_bed_id = trig_res["reserved_bed_id"]
        bed = db.query(models.Bed).filter(models.Bed.id == reserved_bed_id).first()
        assert bed.state == "RESERVED"

        # 2. Family expresses worry/anxiety
        consent_res = submit_family_consent(
            encounter_id=enc.id,
            consent="worried",
            notes="Family anxious about ward nursing ratio and monitoring.",
            db=db,
            nurse_name="Sister Sunita (ICU In-Charge)"
        )

        # 3. Guardrail #8 capacity check: MUST NOT unlock capacity
        assert consent_res["counts_as_forecasted_capacity"] is False, "Amber consent MUST NOT unlock capacity (Guardrail #8)"
        assert consent_res["icu_stepdown_status"] == "CONSENT_WORRIED"

        # 4. BED IS NOT RELEASED: Bed remains held for the patient during counseling
        db.refresh(bed)
        assert bed.state == "RESERVED", f"Bed {bed.id} MUST NOT be released on Amber consent (held for reassurance)"
        assert enc.reserved_bed_id == reserved_bed_id

        # 5. Resolving action surfaced
        resolving_action = consent_res["resolving_action"]
        assert "Senior Ward" in resolving_action
        assert "pulse oximeter" in resolving_action
        assert "transit lounge" in resolving_action
        assert "2x Buffer Candidate on standby" in resolving_action

        # 6. Physical transfer is strictly blocked while in Amber state
        exc_xfer = assert_raises(
            GuardrailViolation,
            execute_transfer,
            encounter_id=enc.id,
            db=db
        )
        assert "Cannot execute transfer without family GREEN/Agreed consent" in str(exc_xfer)

        print(f"\n[PASS] Test 5: Dedicated Amber-path verified — Bed {reserved_bed_id} held in RESERVED, capacity NOT unlocked, counseling action surfaced, transfer blocked.")
    finally:
        db.close()


def test_consent_traffic_light_and_guardrail_8():
    """Test 6: Family Consent Traffic Light & Guardrail #8 Matrix —
    🟢 Agreed -> unlocks forecasted capacity.
    🟡 Worried -> counseling path; does NOT unlock capacity.
    🔴 Refused -> does NOT unlock capacity."""
    # Guardrail #8 direct verification
    assert enforce_green_consent_capacity("agreed", confidence=0.90) is True
    assert enforce_green_consent_capacity("green", confidence=0.85) is True
    assert enforce_green_consent_capacity("worried", confidence=0.90) is False
    assert enforce_green_consent_capacity("amber", confidence=0.90) is False
    assert enforce_green_consent_capacity("refused", confidence=0.90) is False
    assert enforce_green_consent_capacity("red", confidence=0.90) is False
    assert enforce_green_consent_capacity("agreed", confidence=0.65) is False # fails confidence floor

    print("\n[PASS] Test 6: Guardrail #8 green-consent capacity strictly enforced for ICU step-down.")


def test_successful_stepdown_transfer_execution():
    """Test 7: Full Happy-Path End-to-End Transfer —
    1. Clinician confirms step-down (Doctor Decides).
    2. Porter task auto-created with backward-math WHY.
    3. Family gives 🟢 Agreed consent -> unlocks capacity.
    4. Execute transfer:
       - Patient moved to ward bed (state: OCCUPIED).
       - Old ICU bed set to DIRTY.
       - Rapid ICU bed turnover sanitization task queued.
       - Dual-timestamp event logged."""
    db = SessionLocal()
    try:
        reset_icu_test_state(db)
        enc = db.query(models.Encounter).filter(
            models.Encounter.ward == "ICU",
            models.Encounter.status == "ACTIVE"
        ).first()
        assert enc is not None

        old_icu_bed_id = enc.bed_id

        # 1. Clinician confirmation
        doc_res = trigger_doctor_stepdown(
            encounter_id=enc.id,
            consultant_id=enc.consultant_id,
            db=db,
            clinician_confirmed=True
        )
        assert doc_res["status"] == "SUCCESS"
        res_bed_id = doc_res["reserved_bed_id"]

        # 2. Check porter task with backward-math WHY
        porter_task = db.query(models.Task).filter(
            models.Task.id == doc_res["porter_task_id"]
        ).first()
        assert porter_task is not None
        assert porter_task.role == "PORTER"
        assert "Backward-math" in porter_task.reason_en
        assert "वाइटल्स राउंड" in porter_task.reason_hi

        # 3. Family gives GREEN Agreed consent
        consent_res = submit_family_consent(
            encounter_id=enc.id,
            consent="agreed",
            notes="Family very happy with patient recovery and consents to ward.",
            db=db
        )
        assert consent_res["counts_as_forecasted_capacity"] is True
        assert consent_res["icu_stepdown_status"] == "READY_FOR_TRANSFER"

        # 4. Execute physical transfer
        xfer_res = execute_transfer(
            encounter_id=enc.id,
            db=db,
            actor="Sister Sunita + Porter Ramesh"
        )
        assert xfer_res["status"] == "SUCCESS"
        assert xfer_res["to_bed"] == res_bed_id
        assert xfer_res["from_bed"] == old_icu_bed_id

        # Verify old ICU bed is DIRTY with turnover task queued
        old_bed = db.query(models.Bed).filter(models.Bed.id == old_icu_bed_id).first()
        assert old_bed.state == "DIRTY"
        clean_task = db.query(models.Task).filter(
            models.Task.id == f"TSK-CLEAN-{old_icu_bed_id}"
        ).first()
        assert clean_task is not None
        assert clean_task.role == "HOUSEKEEPING"

        # Verify new ward bed is OCCUPIED
        new_bed = db.query(models.Bed).filter(models.Bed.id == res_bed_id).first()
        assert new_bed.state == "OCCUPIED"
        assert new_bed.current_encounter_id == enc.id

        # Verify encounter is updated
        db.refresh(enc)
        assert enc.ward == new_bed.ward
        assert enc.bed_id == new_bed.id
        assert enc.icu_stepdown_status == "TRANSFERRED"

        print(f"\n[PASS] Test 7: Happy-path step-down transfer executed successfully. Patient in {new_bed.id}, ICU bed {old_icu_bed_id} marked DIRTY.")
    finally:
        db.close()


def test_fastapi_endpoints_integration():
    """Test 8: FastAPI Endpoints Integration —
    GET /api/icu/step-down/roster
    POST /api/icu/step-down/trigger
    POST /api/icu/step-down/consent
    POST /api/icu/step-down/execute"""
    db = SessionLocal()
    reset_icu_test_state(db)
    db.close()

    # 1. Roster endpoint
    res = client.get("/api/icu/step-down/roster?target_beds_needed=1")
    assert res.status_code == 200
    data = res.json()
    assert "roster" in data
    assert "candidates_required" in data
    assert data["target_beds_needed"] == 1
    assert data["over_preparation_multiplier"] == 2

    # Find a candidate to test endpoints
    candidate = next((c for c in data["roster"] if c["icu_stepdown_status"] not in ["TRANSFERRED"]), None)
    if candidate:
        enc_id = candidate["encounter_id"]
        doc_id = candidate["consultant_id"]

        # 2. Trigger endpoint with unconfirmed clinician (should 400 GuardrailViolation)
        bad_trig = client.post("/api/icu/step-down/trigger", json={
            "encounter_id": enc_id,
            "consultant_id": doc_id,
            "clinician_confirmed": False
        })
        assert bad_trig.status_code == 400
        assert "GUARDRAIL" in bad_trig.json()["detail"]

        # 3. Trigger endpoint with clinician confirmation
        good_trig = client.post("/api/icu/step-down/trigger", json={
            "encounter_id": enc_id,
            "consultant_id": doc_id,
            "clinician_confirmed": True
        })
        assert good_trig.status_code == 200
        assert good_trig.json()["stepdown_doctor_confirmed"] is True

        # 4. Consent endpoint (worried - Amber path)
        consent_worried = client.post("/api/icu/step-down/consent", json={
            "encounter_id": enc_id,
            "consent": "worried",
            "notes": "Family requested doctor explanation"
        })
        assert consent_worried.status_code == 200
        assert consent_worried.json()["counts_as_forecasted_capacity"] is False

        # 5. Consent endpoint (agreed - Green path)
        consent_agreed = client.post("/api/icu/step-down/consent", json={
            "encounter_id": enc_id,
            "consent": "agreed",
            "notes": "Family agreed after explanation"
        })
        assert consent_agreed.status_code == 200
        assert consent_agreed.json()["counts_as_forecasted_capacity"] is True

        # 6. Execute transfer endpoint
        exec_res = client.post("/api/icu/step-down/execute", json={
            "encounter_id": enc_id,
            "actor": "Sister Sunita + Porter Ramesh"
        })
        assert exec_res.status_code == 200
        assert exec_res.json()["icu_stepdown_status"] == "TRANSFERRED"

    print("\n[PASS] Test 8: FastAPI endpoints integration verified with 200 OK responses and proper Guardrail error codes.")


if __name__ == "__main__":
    print("=== RUNNING SWASTHFLOW AI PHASE 8 VERIFICATION SUITE ===")
    test_guardrail_1_doctor_decides()
    test_2x_candidate_over_preparation_and_routing()
    test_phrasing_guardrail_positive_recovery()
    test_family_refusal_and_candidate_2_promotion_doctor_gate()
    test_amber_path_worried_reassurance_hold()
    test_consent_traffic_light_and_guardrail_8()
    test_successful_stepdown_transfer_execution()
    test_fastapi_endpoints_integration()
    print("\n=== ALL 8 PHASE 8 TESTS PASSED SUCCESSFULLY! ===")
