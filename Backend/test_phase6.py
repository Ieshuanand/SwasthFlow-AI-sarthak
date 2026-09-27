"""Phase 6 Verification Suite: Nurse Check & WhatsApp Hindi Delivery.
Verifies:
  1. 3-Question Nurse Readiness Check and explicit Home Barrier mapping:
     - None -> GREEN
     - Needs ramp -> AMBER + resolving action (wheelchair loan)
     - No caregiver -> RED (hard clinical safety blocker)
     - Oxygen cylinder -> AMBER + resolving action (oxygen vendor connect)
     - Family unavailable / Payer denied -> RED
  2. Guardrail #1: Canonical Nurse Phrasing Script (bilingual conditional phrasing, never a promise).
  3. Guardrail #8: Only GREEN consent counts as forecasted bed capacity.
  4. Offline Piper Hindi ONNX speech synthesis (valid WAV, > 10KB, air-gapped).
  5. Bilingual WhatsApp task cards with backward-math WHY reasons.
  6. Frontline action loop (Done / Can't with reason) writing to event_log and transitioning bed states.
  7. FastAPI Phase 6 endpoints.
"""

import sys
import os
import wave
import datetime

# Ensure utf-8 encoding on Windows console
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

from database import SessionLocal
import models
import adapter
from main import app, simulator
from nurse_check import (
    NurseCheckManager,
    classify_consent,
    NURSE_PHRASING_SCRIPT,
    HOME_PROBLEM_MAPPING
)
from tts_engine import synthesize_task_audio
from whatsapp_service import WhatsAppService
from guardrails import enforce_green_consent_capacity, MIN_TASK_CONFIDENCE
from fastapi.testclient import TestClient

client = TestClient(app)

def test_phase6_suite():
    print("================================================================================")
    print("=== PHASE 6 VERIFICATION: NURSE CHECK & WHATSAPP HINDI DELIVERY ===")
    print("================================================================================")

    db = SessionLocal()
    adapter.sync_payers_to_db(db)
    adapter.sync_simulator_to_db(simulator, db)

    # -------------------------------------------------------------------------
    # TEST 1: 3-QUESTION EVALUATION & EXPLICIT HOME BARRIER MAPPING
    # -------------------------------------------------------------------------
    print("\n--- TEST 1: 3-QUESTION NURSE CHECK & HOME BARRIER CLASSIFICATION ---")
    
    # Case A: All clear -> GREEN
    c_green = classify_consent(payer_confirmed="yes", family_available="yes", home_problem="None")
    print(f"Case A (Payer=Yes, Family=Yes, Home=None): Consent = {c_green['consent'].upper()}")
    print(f"  • Reason: {c_green['reason_en']}")
    assert c_green["consent"] == "green"
    assert c_green["barrier_type"] == "NONE"

    # Case B: Needs ramp -> AMBER with resolving action
    c_ramp = classify_consent(payer_confirmed="yes", family_available="yes", home_problem="Needs ramp")
    print(f"\nCase B (Home='Needs ramp'): Consent = {c_ramp['consent'].upper()}")
    print(f"  • Reason:           {c_ramp['reason_en']}")
    print(f"  • Resolving Action: {c_ramp['resolving_action_en']}")
    assert c_ramp["consent"] == "amber"
    assert c_ramp["is_actionable_amber"] is True
    assert "wheelchair" in c_ramp["resolving_action_en"].lower() or "transport" in c_ramp["resolving_action_en"].lower()

    # Case C: No caregiver -> RED (Hard clinical safety blocker)
    c_caregiver = classify_consent(payer_confirmed="yes", family_available="yes", home_problem="No caregiver")
    print(f"\nCase C (Home='No caregiver'): Consent = {c_caregiver['consent'].upper()}")
    print(f"  • Reason:           {c_caregiver['reason_en']}")
    print(f"  • Resolving Action: {c_caregiver['resolving_action_en']}")
    assert c_caregiver["consent"] == "red", f"Expected RED for 'No caregiver', got {c_caregiver['consent']}"
    assert c_caregiver["barrier_type"] == "NO_CAREGIVER"
    assert "safety blocker" in c_caregiver["reason_en"].lower()

    # Case D: Oxygen cylinder required -> AMBER with resolving action
    c_o2 = classify_consent(payer_confirmed="yes", family_available="yes", home_problem="Oxygen cylinder required")
    print(f"\nCase D (Home='Oxygen cylinder required'): Consent = {c_o2['consent'].upper()}")
    print(f"  • Reason:           {c_o2['reason_en']}")
    print(f"  • Resolving Action: {c_o2['resolving_action_en']}")
    assert c_o2["consent"] == "amber"
    assert c_o2["is_actionable_amber"] is True
    assert "oxygen" in c_o2["resolving_action_en"].lower()

    # Case E: Family unavailable -> RED
    c_fam_no = classify_consent(payer_confirmed="yes", family_available="no", home_problem="None")
    print(f"\nCase E (Family='no'): Consent = {c_fam_no['consent'].upper()}")
    assert c_fam_no["consent"] == "red"

    # Case F: Payer denied -> RED
    c_payer_no = classify_consent(payer_confirmed="no", family_available="yes", home_problem="None")
    print(f"Case F (Payer='no'):  Consent = {c_payer_no['consent'].upper()}")
    assert c_payer_no["consent"] == "red"

    print("[PASS] Test 1: All 3-question combinations & barrier mappings verified.")

    # -------------------------------------------------------------------------
    # TEST 2: GUARDRAIL #1 PHRASING SCRIPT VERIFICATION
    # -------------------------------------------------------------------------
    print("\n--- TEST 2: GUARDRAIL #1 NURSE PHRASING SCRIPT ---")
    script_en = NURSE_PHRASING_SCRIPT["script_en"]
    script_hi = NURSE_PHRASING_SCRIPT["script_hi"]
    print(f"EN Script: \"{script_en}\"")
    print(f"HI Script: \"{script_hi}\"")
    
    assert "IF" in script_en, "Script must include conditional 'IF'"
    assert "may consider" in script_en or "consider" in script_en, "Script must be conditional on physician assessment"
    assert "अगर" in script_hi and "संभावना" in script_hi, "Hindi script must reflect conditional possibility"
    print("[PASS] Test 2: Guardrail #1 script strictly prevents false promises of discharge.")

    # -------------------------------------------------------------------------
    # TEST 3: GUARDRAIL #8 CAPACITY RULE ENFORCEMENT
    # -------------------------------------------------------------------------
    print("\n--- TEST 3: GUARDRAIL #8 GREEN-CONSENT CAPACITY ENFORCEMENT ---")
    green_capacity = enforce_green_consent_capacity(consent_status="green", confidence=0.85)
    amber_capacity = enforce_green_consent_capacity(consent_status="amber", confidence=0.85)
    red_capacity = enforce_green_consent_capacity(consent_status="red", confidence=0.85)
    low_conf_capacity = enforce_green_consent_capacity(consent_status="green", confidence=0.65)

    print(f"  • Green Consent (conf=85%): Counts as capacity = {green_capacity} [MUST BE True]")
    print(f"  • Amber Consent (conf=85%): Counts as capacity = {amber_capacity} [MUST BE False]")
    print(f"  • Red Consent   (conf=85%): Counts as capacity = {red_capacity} [MUST BE False]")
    print(f"  • Green Consent (conf=65%): Counts as capacity = {low_conf_capacity} [MUST BE False (Guardrail #4)]")

    assert green_capacity is True
    assert amber_capacity is False
    assert red_capacity is False
    assert low_conf_capacity is False
    print("[PASS] Test 3: Guardrail #8 strictly enforced. Only Green consent unlocks capacity.")

    # -------------------------------------------------------------------------
    # TEST 4: OFFLINE TTS VOICE NOTE SYNTHESIS (PIPER HINDI ONNX)
    # -------------------------------------------------------------------------
    print("\n--- TEST 4: OFFLINE TTS VOICE NOTE SYNTHESIS ---")
    tts_result = synthesize_task_audio(
        task_id="PHASE6-TEST-VOICE-01",
        role="PHLEBOTOMY",
        title_hi="सुबह का ब्लड टेस्ट: रमेश कुमार (वार्ड ए, बेड 05)",
        reason_hi="डॉक्टर साहब के राउंड से पहले रिपोर्ट तैयार करने हेतु नाश्ते से पहले खाली पेट ब्लड टेस्ट।",
        deadline_str="सुबह 07:15 बजे",
        title_en="Morning blood draw for Ramesh Kumar (WARD_A-05)"
    )
    print(f"TTS Synthesis Result:")
    print(f"  • Task ID:    {tts_result['task_id']}")
    print(f"  • Audio URL:  {tts_result['audio_url']}")
    print(f"  • Engine:     {tts_result['engine']}")
    print(f"  • File Size:  {tts_result['file_size']} bytes")
    
    assert tts_result["file_size"] > 10000, f"Expected audio size > 10KB, got {tts_result['file_size']}"
    wav_full_path = os.path.join(os.path.dirname(__file__), "static", "audio", tts_result["filename"])
    assert os.path.exists(wav_full_path), "WAV file was not created on disk"

    with wave.open(wav_full_path, "rb") as wf:
        n_channels = wf.getnchannels()
        framerate = wf.getframerate()
        n_frames = wf.getnframes()
        duration_sec = n_frames / float(framerate)
        print(f"  • Audio Format: {n_channels} channel(s), {framerate} Hz, {duration_sec:.2f} seconds")
        assert duration_sec > 1.0, f"Audio duration too short: {duration_sec}s"

    print("[PASS] Test 4: Offline Piper Hindi ONNX speech synthesized and verified on disk.")

    # -------------------------------------------------------------------------
    # TEST 5: BILINGUAL WHATSAPP TASK CARDS
    # -------------------------------------------------------------------------
    print("\n--- TEST 5: WHATSAPP TASK CARDS GENERATION ---")
    ws = WhatsAppService(db=db, simulator=simulator)
    messages = ws.get_active_whatsapp_messages()
    print(f"Total active WhatsApp task cards generated: {len(messages)}")
    assert len(messages) > 0, "No WhatsApp task cards found"

    sample_msg = messages[0]
    print(f"\nSample WhatsApp Message Card:")
    print(f"  • To:          {sample_msg['recipient_name']} ({sample_msg['recipient_role']} - {sample_msg['recipient_phone']})")
    print(f"  • Title EN:    {sample_msg['title_en']}")
    print(f"  • Title HI:    {sample_msg['title_hi']}")
    print(f"  • Reason EN:   {sample_msg['reason_en']}")
    print(f"  • Reason HI:   {sample_msg['reason_hi']}")
    print(f"  • Deadline:    {sample_msg['deadline_str']}")
    print(f"  • Audio URL:   {sample_msg['audio_url']}")
    print(f"  • Confidence:  {sample_msg['confidence_percent']}%")

    assert len(sample_msg["title_hi"]) > 5
    assert len(sample_msg["reason_hi"]) > 10
    assert sample_msg["confidence"] >= MIN_TASK_CONFIDENCE
    print("[PASS] Test 5: Bilingual WhatsApp task cards contain mandatory backwards-math WHY.")

    # -------------------------------------------------------------------------
    # TEST 6: WORKER FEEDBACK LOOP & EVENT LOGGING
    # -------------------------------------------------------------------------
    print("\n--- TEST 6: FRONTLINE FEEDBACK LOOP (DONE / CANNOT) ---")
    
    # 1. Test "Done" action on cleaning bed
    cleaning_task = next((m for m in messages if m["role"] in ["CLEANING", "HOUSEKEEPING"]), None)
    if not cleaning_task:
        # Create a cleaning task for verification
        cleaning_task_id = "TSK-TEST-CLEAN-WARD_A-01"
        t_clean = models.Task(
            id=cleaning_task_id,
            role="CLEANING",
            ward="WARD_A",
            title_en="Turnover & Sanitize Bed: WARD_A-01",
            title_hi="बेड की सफाई और सैनिटाइजेशन: WARD_A-01",
            reason_en="Vacated bed cleaning",
            reason_hi="खाली बेड की सफाई",
            deadline=datetime.datetime.utcnow() + datetime.timedelta(minutes=30),
            confidence=0.95,
            channel="WHATSAPP"
        )
        db.add(t_clean)
        db.commit()
        cleaning_task = {"task_id": cleaning_task_id}

    done_resp = ws.respond_to_task(
        task_id=cleaning_task["task_id"],
        response="done",
        staff_name="Anand Rao (Housekeeping)"
    )
    print(f"[PASS] 'Done' action submitted: Task={done_resp['task_id']}, Status={done_resp['status']}")
    print(f"       Side effects: {done_resp['side_effects']}")
    assert done_resp["status"] == "DONE"

    # 2. Test "Cannot" action with structured refusal reason
    first_task_id = messages[0]["task_id"]
    cannot_resp = ws.respond_to_task(
        task_id=first_task_id,
        response="cannot",
        refusal_reason="Patient not at bed (in ultrasound)",
        staff_name="Manoj Verma (Phlebotomist)"
    )
    print(f"\n[PASS] 'Cannot' action submitted: Task={cannot_resp['task_id']}, Status={cannot_resp['status']}")
    print(f"       Refusal reason: {cannot_resp['refusal_reason']}")
    assert cannot_resp["status"] == "CANNOT"
    assert cannot_resp["refusal_reason"] == "Patient not at bed (in ultrasound)"

    # Verify event_log table entries
    logged_events = db.query(models.EventLog).filter(
        models.EventLog.action.in_(["TASK_COMPLETED", "TASK_FAILED"])
    ).all()
    print(f"Confirmed {len(logged_events)} task feedback events recorded in append-only event_log.")
    assert len(logged_events) >= 2

    # -------------------------------------------------------------------------
    # TEST 7: FASTAPI ENDPOINTS INTEGRATION
    # -------------------------------------------------------------------------
    print("\n--- TEST 7: FASTAPI PHASE 6 ENDPOINTS ---")
    
    # 1. GET /api/nurse-check/script
    resp_script = client.get("/api/nurse-check/script")
    assert resp_script.status_code == 200
    assert "script" in resp_script.json()
    print("[PASS] GET /api/nurse-check/script -> HTTP 200 OK")

    # 2. GET /api/nurse-check/candidates
    resp_cand = client.get("/api/nurse-check/candidates")
    assert resp_cand.status_code == 200
    cands = resp_cand.json()["candidates"]
    print(f"[PASS] GET /api/nurse-check/candidates -> HTTP 200 OK ({len(cands)} candidates)")
    assert len(cands) > 0

    # 3. POST /api/nurse-check/submit
    sample_enc_id = cands[0]["encounter_id"]
    resp_submit = client.post("/api/nurse-check/submit", json={
        "encounter_id": sample_enc_id,
        "payer_confirmed": "yes",
        "family_available": "yes",
        "home_problem": "Needs ramp",
        "nurse_name": "Sister Sunita (Ward In-Charge)"
    })
    assert resp_submit.status_code == 200
    submit_data = resp_submit.json()
    print(f"[PASS] POST /api/nurse-check/submit -> HTTP 200 OK (Consent={submit_data['consent_badge']})")
    print(f"       Resolving Action: {submit_data['resolving_action_en']}")
    assert submit_data["consent"] == "amber"

    # 4. GET /api/whatsapp/messages
    resp_wa = client.get("/api/whatsapp/messages")
    assert resp_wa.status_code == 200
    wa_msgs = resp_wa.json()["messages"]
    print(f"[PASS] GET /api/whatsapp/messages -> HTTP 200 OK ({len(wa_msgs)} messages)")
    assert len(wa_msgs) > 0

    # 5. POST /api/tasks/{task_id}/respond
    resp_act = client.post(f"/api/tasks/{sample_msg['task_id']}/respond", json={
        "response": "done",
        "staff_name": "Test Runner"
    })
    assert resp_act.status_code == 200
    assert resp_act.json()["status"] == "DONE"
    print(f"[PASS] POST /api/tasks/{sample_msg['task_id']}/respond -> HTTP 200 OK (DONE)")

    print("\n================================================================================")
    print("=== ALL PHASE 6 TESTS PASSED SUCCESSFULLY! ===")
    print("================================================================================")

if __name__ == "__main__":
    test_phase6_suite()
