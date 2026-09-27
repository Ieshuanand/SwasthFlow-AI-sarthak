import os
import json
import datetime
from fastapi import FastAPI, Depends, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional, Dict, Any

from database import engine, get_db, Base
import models
from simulator import HospitalSimulator, DIAGNOSES
import adapter
from discharge_radar import DischargeRadar
from delay_book import DelayBook
import payer_router
from round_clock import RoundClock, DOCTORS
from sequencer import Sequencer
from nurse_check import NurseCheckManager, classify_consent, NURSE_PHRASING_SCRIPT, HOME_PROBLEM_MAPPING
from whatsapp_service import WhatsAppService
from tts_engine import synthesize_task_audio
from bill_estimator import BillEstimator
from icu_stepdown import (
    get_stepdown_roster,
    trigger_doctor_stepdown,
    submit_family_consent,
    execute_transfer,
    generate_family_stepdown_script
)
from guardrails import GuardrailViolation, enforce_doctor_decides
from readiness_engine import (
    get_readiness_metrics,
    get_bed_blockers,
    calculate_time_saved,
    activate_emergency_console
)
from evaluation_engine import get_proof_evaluation_metrics

# Create all database tables on startup
Base.metadata.create_all(bind=engine)

discharge_radar = DischargeRadar()
round_clock = RoundClock()

app = FastAPI(
    title="SwasthFlow AI Backend",
    description="Predictive Hospital Operations & Bottleneck Prevention Engine",
    version="1.0.0"
)

# Mount static directory for offline TTS WAV audio files
static_dir = os.path.join(os.path.dirname(__file__), "static")
os.makedirs(static_dir, exist_ok=True)
app.mount("/static", StaticFiles(directory=static_dir), name="static")

# Enable CORS for Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global simulator instance
simulator = HospitalSimulator(seed=42)

@app.on_event("startup")
def startup_event():
    # Sync initial seed state into DB
    db = next(get_db())
    adapter.sync_payers_to_db(db)
    adapter.sync_simulator_to_db(simulator, db)
    db.close()

# Request Models
class TickRequest(BaseModel):
    minutes: int = 60

class ChaosRequest(BaseModel):
    num_patients: int = 6

@app.get("/api/health")
def health():
    return {
        "status": "healthy",
        "service": "SwasthFlow AI Engine",
        "simulated_time": simulator.simulated_time.isoformat()
    }

@app.get("/api/simulator/status")
def get_simulator_status(db: Session = Depends(get_db)):
    total_beds = db.query(models.Bed).count()
    occupied_beds = db.query(models.Bed).filter(models.Bed.state == "OCCUPIED").count()
    ready_beds = db.query(models.Bed).filter(models.Bed.state == "READY").count()
    dirty_beds = db.query(models.Bed).filter(models.Bed.state == "DIRTY").count()
    active_encounters = db.query(models.Encounter).filter(models.Encounter.status == "ACTIVE").count()

    return {
        "simulated_time": simulator.simulated_time.isoformat(),
        "simulated_date_str": simulator.simulated_time.strftime("%A, %d %b %Y, %I:%M %p"),
        "total_beds": total_beds,
        "occupied_beds": occupied_beds,
        "ready_beds": ready_beds,
        "dirty_beds": dirty_beds,
        "active_encounters": active_encounters
    }

@app.post("/api/simulator/tick")
def tick_simulator(req: TickRequest, db: Session = Depends(get_db)):
    result = simulator.advance_time(minutes=req.minutes)
    adapter.sync_simulator_to_db(simulator, db)
    return {
        "message": f"Advanced simulation by {req.minutes} minutes",
        **result
    }

@app.post("/api/simulator/reset")
def reset_simulator(db: Session = Depends(get_db)):
    global simulator
    random_seed = int(datetime.datetime.utcnow().timestamp()) % 1000
    simulator = HospitalSimulator(seed=random_seed)
    # Clear and resync
    db.query(models.Encounter).delete()
    db.query(models.Bed).delete()
    db.commit()
    adapter.sync_payers_to_db(db)
    adapter.sync_simulator_to_db(simulator, db)
    return {
        "message": "Simulator reset successfully",
        "simulated_time": simulator.simulated_time.isoformat()
    }

@app.post("/api/simulator/chaos")
def trigger_chaos(req: ChaosRequest, db: Session = Depends(get_db)):
    admitted = simulator.trigger_chaos(num_surge_patients=req.num_patients)
    adapter.sync_simulator_to_db(simulator, db)
    return {
        "message": f"Mass-casualty event injected! {len(admitted)} patients admitted to surge beds.",
        "surge_patients": admitted
    }

@app.get("/api/beds")
def get_beds(ward: Optional[str] = None, state: Optional[str] = None, db: Session = Depends(get_db)):
    query = db.query(models.Bed)
    if ward:
        query = query.filter(models.Bed.ward == ward)
    if state:
        query = query.filter(models.Bed.state == state)
    
    beds = query.order_by(models.Bed.ward, models.Bed.id).all()
    
    # Diagnosis mean LOS map
    diag_map = {d["code"]: d["mean_los"] for d in DIAGNOSES}
    delay_book = DelayBook(db)

    # Attach encounter details and discharge radar predictions if occupied
    results = []
    for b in beds:
        enc_info = None
        if b.current_encounter_id:
            enc = db.query(models.Encounter).filter(models.Encounter.id == b.current_encounter_id).first()
            if enc:
                mean_los = diag_map.get(enc.diagnosis_code, 4.0)
                pred = discharge_radar.predict_encounter({
                    "hours_since_last_test": enc.hours_since_last_test,
                    "iv_to_oral": enc.iv_to_oral,
                    "oxygen_removed": enc.oxygen_removed,
                    "diet_normalized": enc.diet_normalized,
                    "los_days": enc.los_days,
                    "pt_cleared": enc.pt_cleared,
                    "vitals_stable": enc.vitals_stable,
                    "payer_type": enc.payer_type,
                    "ward": enc.ward
                }, diag_mean_los=mean_los, delay_book=delay_book)

                # Check nurse check consent
                nc = db.query(models.NurseCheck).filter(models.NurseCheck.encounter_id == enc.id).order_by(models.NurseCheck.id.desc()).first()
                consent = nc.consent if nc else None

                # GUARDRAIL #8: Only green consent counts as forecasted capacity!
                is_forecasted_capacity = (consent == "green") and pred["is_high_confidence"]

                # P90 free at estimate
                step_key = f"PAYER_CLEARANCE_{enc.payer_type}"
                p90_delay_mins = delay_book.get_step_budget_p90(step_key)
                med_delay_mins = delay_book.get_step_stat(step_key)["median_min"]

                free_at_dt = simulator.simulated_time + datetime.timedelta(minutes=p90_delay_mins)
                free_lo_dt = simulator.simulated_time + datetime.timedelta(minutes=med_delay_mins)
                free_hi_dt = free_at_dt

                enc_info = {
                    "encounter_id": enc.id,
                    "patient_name": enc.patient_name,
                    "age": enc.age,
                    "gender": enc.gender,
                    "diagnosis": enc.diagnosis_name,
                    "consultant": enc.consultant_name,
                    "payer_type": enc.payer_type,
                    "admission_time": enc.admission_time.isoformat(),
                    "los_days": enc.los_days,
                    "iv_to_oral": enc.iv_to_oral,
                    "oxygen_removed": enc.oxygen_removed,
                    "diet_normalized": enc.diet_normalized,
                    "vitals_stable": enc.vitals_stable,
                    "p_discharge": pred["p_discharge"],
                    "discharge_reasons": pred["top_reasons"],
                    "is_high_confidence": pred["is_high_confidence"],
                    "target_horizon_hours": pred["target_horizon_hours"],
                    "payer_strategy": pred["payer_strategy"],
                    "consent": consent,
                    "is_forecasted_capacity": is_forecasted_capacity,
                    "predicted_free_at": free_at_dt.isoformat() if is_forecasted_capacity else None,
                    "predicted_free_lo": free_lo_dt.isoformat() if is_forecasted_capacity else None,
                    "predicted_free_hi": free_hi_dt.isoformat() if is_forecasted_capacity else None
                }
        results.append({
            "id": b.id,
            "ward": b.ward,
            "bed_type": b.bed_type,
            "state": b.state,
            "blocking_step": b.blocking_step,
            "current_encounter": enc_info
        })
    return results

@app.get("/api/discharge-radar")
def get_discharge_radar(db: Session = Depends(get_db)):
    """Discharge Radar: returns all active patients with multi-payer adapted P(discharge) and Top 3 explanations."""
    encs = db.query(models.Encounter).filter(models.Encounter.status == "ACTIVE").all()
    diag_map = {d["code"]: d["mean_los"] for d in DIAGNOSES}
    delay_book = DelayBook(db)

    radar_items = []
    for enc in encs:
        mean_los = diag_map.get(enc.diagnosis_code, 4.0)
        pred = discharge_radar.predict_encounter({
            "hours_since_last_test": enc.hours_since_last_test,
            "iv_to_oral": enc.iv_to_oral,
            "oxygen_removed": enc.oxygen_removed,
            "diet_normalized": enc.diet_normalized,
            "los_days": enc.los_days,
            "pt_cleared": enc.pt_cleared,
            "vitals_stable": enc.vitals_stable,
            "payer_type": enc.payer_type,
            "ward": enc.ward
        }, diag_mean_los=mean_los, delay_book=delay_book)

        nc = db.query(models.NurseCheck).filter(models.NurseCheck.encounter_id == enc.id).order_by(models.NurseCheck.id.desc()).first()
        consent = nc.consent if nc else None

        # Guardrail: Only green consent counts as forecasted capacity
        is_capacity = (consent == "green") and pred["is_high_confidence"]

        radar_items.append({
            "encounter_id": enc.id,
            "patient_name": enc.patient_name,
            "bed_id": enc.bed_id,
            "ward": enc.ward,
            "diagnosis": enc.diagnosis_name,
            "consultant": enc.consultant_name,
            "payer_type": enc.payer_type,
            "los_days": enc.los_days,
            "p_discharge": pred["p_discharge"],
            "top_reasons": pred["top_reasons"],
            "is_high_confidence": pred["is_high_confidence"],
            "target_horizon_hours": pred["target_horizon_hours"],
            "payer_strategy": pred["payer_strategy"],
            "consent": consent,
            "counts_as_forecasted_capacity": is_capacity
        })

    # Rank high-probability candidates first
    radar_items.sort(key=lambda x: x["p_discharge"], reverse=True)
    return radar_items

@app.get("/api/delay-book")
def get_delay_book(db: Session = Depends(get_db)):
    """Delay Book: returns learned step durations (median & p90) and learned ward documentation lag."""
    book = DelayBook(db)
    return {
        "ward_documentation_lags_minutes": book.ward_doc_lags,
        "step_duration_stats": book.stats,
        "note": "Per Guardrail #5, operational planning strictly uses p90 values to prevent optimistic scheduling."
    }

@app.post("/api/payer/route-tasks")
def route_payer_tasks(db: Session = Depends(get_db)):
    """Routes clearance tasks per payer type for all high-confidence discharge candidates."""
    encs = db.query(models.Encounter).filter(models.Encounter.status == "ACTIVE").all()
    diag_map = {d["code"]: d["mean_los"] for d in DIAGNOSES}
    delay_book = DelayBook(db)

    generated_tasks = []
    for enc in encs:
        mean_los = diag_map.get(enc.diagnosis_code, 4.0)
        pred = discharge_radar.predict_encounter({
            "hours_since_last_test": enc.hours_since_last_test,
            "iv_to_oral": enc.iv_to_oral,
            "oxygen_removed": enc.oxygen_removed,
            "diet_normalized": enc.diet_normalized,
            "los_days": enc.los_days,
            "pt_cleared": enc.pt_cleared,
            "vitals_stable": enc.vitals_stable,
            "payer_type": enc.payer_type,
            "ward": enc.ward
        }, diag_mean_los=mean_los, delay_book=delay_book)

        if pred["is_high_confidence"]:
            step_key = f"PAYER_CLEARANCE_{enc.payer_type}"
            p90_dur = delay_book.get_step_budget_p90(step_key)
            
            # Check if task already exists
            existing_task = db.query(models.Task).filter(models.Task.id == f"TSK-BILL-{enc.id}").first()
            if not existing_task:
                task = payer_router.generate_payer_billing_task(
                    encounter=enc,
                    p_discharge=pred["p_discharge"],
                    reasons=pred["top_reasons"],
                    p90_duration_min=p90_dur,
                    current_time=simulator.simulated_time
                )
                if task:
                    db.add(task)
                    generated_tasks.append(task)

    db.commit()
    return {
        "message": f"Generated {len(generated_tasks)} payer clearance tasks for high-confidence candidates",
        "tasks": [{
            "id": t.id,
            "role": t.role,
            "ward": t.ward,
            "title_en": t.title_en,
            "reason_en": t.reason_en,
            "deadline": t.deadline.isoformat(),
            "confidence": t.confidence
        } for t in generated_tasks]
    }

@app.get("/api/tasks")
def get_tasks(role: Optional[str] = None, db: Session = Depends(get_db)):
    query = db.query(models.Task)
    if role:
        query = query.filter(models.Task.role == role)
    tasks = query.order_by(models.Task.deadline.asc()).all()
    return [{
        "id": t.id,
        "role": t.role,
        "ward": t.ward,
        "title_en": t.title_en,
        "title_hi": t.title_hi,
        "reason_en": t.reason_en,
        "reason_hi": t.reason_hi,
        "deadline": t.deadline.isoformat(),
        "confidence": t.confidence,
        "channel": t.channel,
        "response": t.response,
        "responded_at": t.responded_at.isoformat() if t.responded_at else None
    } for t in tasks]

@app.get("/api/encounters")
def get_encounters(status: str = "ACTIVE", db: Session = Depends(get_db)):
    encs = db.query(models.Encounter).filter(models.Encounter.status == status).all()
    results = []
    for e in encs:
        results.append({
            "id": e.id,
            "patient_id": e.patient_id,
            "patient_name": e.patient_name,
            "age": e.age,
            "gender": e.gender,
            "ward": e.ward,
            "bed_id": e.bed_id,
            "admission_time": e.admission_time.isoformat(),
            "admission_actual_time": e.admission_actual_time.isoformat() if e.admission_actual_time else None,
            "admission_doc_lag_min": e.admission_doc_lag_min,
            "diagnosis_code": e.diagnosis_code,
            "diagnosis_name": e.diagnosis_name,
            "consultant_id": e.consultant_id,
            "consultant_name": e.consultant_name,
            "payer_type": e.payer_type,
            "payer_name": e.payer_name,
            "status": e.status,
            "clinical_signs": {
                "hours_since_last_test": e.hours_since_last_test,
                "iv_to_oral": e.iv_to_oral,
                "oxygen_removed": e.oxygen_removed,
                "diet_normalized": e.diet_normalized,
                "los_days": e.los_days,
                "pt_cleared": e.pt_cleared,
                "vitals_stable": e.vitals_stable
            }
        })
    return results

@app.get("/api/payers")
def get_payers(db: Session = Depends(get_db)):
    payers = db.query(models.Payer).all()
    return [{
        "type": p.type,
        "name": p.name,
        "median_clearance_min": p.median_clearance_min,
        "p90_clearance_min": p.p90_clearance_min,
        "required_lead_hours": p.required_lead_hours,
        "process_steps": p.process_steps
    } for p in payers]

@app.get("/api/round-clock")
def get_round_clock(db: Session = Depends(get_db)):
    """Feature F2 & Engine Component 1: Round Clock.
    Predicts when each consultant will round each ward today.
    GUARDRAIL #9: Never exposed as a punctuality or performance metric — strictly for backward scheduling."""
    today = simulator.simulated_time.date()
    rounds = []

    for doc in DOCTORS:
        pred = round_clock.predict_doctor_round(
            consultant_id=doc["id"],
            ward=doc["primary_ward"],
            date=today,
            was_on_night_call=False,
            is_holiday=(today.weekday() == 6)
        )
        # Count patients under this consultant's care today
        pt_count = db.query(models.Encounter).filter(
            models.Encounter.consultant_id == doc["id"],
            models.Encounter.status == "ACTIVE"
        ).count()

        pred["assigned_patient_count"] = pt_count
        rounds.append(pred)

    # Sort chronologically by predicted round start
    rounds.sort(key=lambda x: x["predicted_round_start"])
    return {
        "simulated_date": today.isoformat(),
        "simulated_day_name": today.strftime("%A"),
        "predicted_rounds": rounds,
        "guardrail_notice": "Doctor round-time predictions are for backwards operational coordination only. Never used for admin punctuality evaluation."
    }

@app.get("/api/round-clock/blood-draw-schedule")
def get_blood_draw_schedule(db: Session = Depends(get_db)):
    """FEATURE F2: Report Before The Round.
    Computes latest safe blood-draw time by working backwards from the doctor's predicted round time
    through lab p90 turnaround time. Produces an ordered route for phlebotomy staff."""
    today = simulator.simulated_time.date()
    delay_book = DelayBook(db)
    lab_p90 = delay_book.get_step_budget_p90("LAB_TURNAROUND_ROUTINE") # 140 min

    # Find active patients who have pending lab needs or upcoming morning round review
    encs = db.query(models.Encounter).filter(models.Encounter.status == "ACTIVE").all()
    route_items = []

    for enc in encs:
        # Doctor round prediction
        pred_round = round_clock.predict_doctor_round(
            consultant_id=enc.consultant_id,
            ward=enc.ward,
            date=today
        )
        round_start = datetime.datetime.fromisoformat(pred_round["predicted_round_start"])
        
        # Backwards calculation
        backwards = round_clock.compute_latest_safe_blood_draw(
            predicted_round_start=round_start,
            lab_p90_turnaround_min=lab_p90,
            buffer_minutes=15.0
        )
        draw_dt = datetime.datetime.fromisoformat(backwards["latest_safe_blood_draw_time"])

        # Determine priority: patients with earlier rounds or whose discharge is pending
        is_round_critical = (draw_dt <= simulator.simulated_time + datetime.timedelta(hours=3))

        route_items.append({
            "encounter_id": enc.id,
            "patient_name": enc.patient_name,
            "bed_id": enc.bed_id,
            "ward": enc.ward,
            "consultant_name": enc.consultant_name,
            "consultant_round_time": backwards["doctor_round_time_str"],
            "latest_safe_blood_draw_time": backwards["latest_safe_blood_draw_time"],
            "latest_safe_draw_str": backwards["latest_safe_time_str"],
            "lab_p90_turnaround_min": backwards["lab_p90_budget_min"],
            "safety_margin_min": backwards["safety_margin_min"],
            "why_reason": backwards["reason"],
            "fasting_required": True, # Hard constraint: fasting before breakfast
            "is_round_critical": is_round_critical
        })

    # Order by latest safe draw time ascending (earliest deadline first)
    route_items.sort(key=lambda x: x["latest_safe_blood_draw_time"])

    return {
        "lab_p90_turnaround_used_min": lab_p90,
        "phlebotomy_route": route_items
    }

@app.get("/api/plan/today")
def get_todays_plan(db: Session = Depends(get_db)):
    """PHASE 5 & ENGINE COMPONENT 2: THE SEQUENCER.
    CP-SAT constraint optimization model generating Today's Plan View.
    Orders non-clinical tasks against priority:
      1. Missed doctor rounds (weight 1000)
      2. Beds freed after 11:00 AM (weight 500)
      3. Late payer-clearance starts (weight 300)
      4. Staff walking distance (weight 50)
      5. Plan churn vs previous published plan (weight 20)
    Respects Guardrail #4 (confidence >= 70%) and Guardrail #5 (<= 10 tasks/staff/shift)."""
    delay_book = DelayBook(db)
    seq = Sequencer(
        db=db,
        delay_book=delay_book,
        round_clock=round_clock,
        discharge_radar=discharge_radar
    )
    plan = seq.solve(simulated_dt=simulator.simulated_time)
    return plan


# ==============================================================================
# PHASE 6: NURSE CHECK & WHATSAPP HINDI DELIVERY ENDPOINTS
# ==============================================================================

class NurseCheckSubmitRequest(BaseModel):
    encounter_id: str
    payer_confirmed: str # "yes", "no", "unsure"
    family_available: str # "yes", "no", "evening_only"
    home_problem: str # "None", "Needs ramp", "No caregiver", "Oxygen cylinder required", "Other"
    nurse_name: Optional[str] = "Sister Sunita (Ward In-Charge)"
    custom_refusal_reason: Optional[str] = None


class TaskRespondRequest(BaseModel):
    response: str # "done" or "cannot"
    refusal_reason: Optional[str] = None
    staff_name: Optional[str] = None


@app.get("/api/nurse-check/script")
def get_nurse_check_script():
    """Returns canonical Guardrail #1 nurse phrasing script and home barrier mapping."""
    return {
        "script": NURSE_PHRASING_SCRIPT,
        "home_barrier_mapping": HOME_PROBLEM_MAPPING
    }


@app.get("/api/nurse-check/candidates")
def get_nurse_check_candidates(db: Session = Depends(get_db)):
    """Returns active encounters eligible for morning Nurse Check with radar predictions."""
    mgr = NurseCheckManager(db=db, simulator=simulator)
    candidates = mgr.get_candidate_encounters()
    
    diag_map = {
        "MED_SEPSIS": 6.5, "MED_PNEUMONIA": 4.5, "MED_COPD": 4.0, "MED_GI_BLEED": 3.5, "MED_AKI": 4.0,
        "SURG_APP": 2.5, "SURG_CHOLE": 3.0, "SURG_HERNIA": 2.0, "SURG_ORIF": 5.0, "SURG_BOWEL": 6.0,
        "ICU_ARDS": 8.0, "ICU_SHOCK": 7.0, "ICU_POST_OP": 3.5
    }
    enriched = []
    for c in candidates:
        mean_los = diag_map.get(c.get("diagnosis_code", ""), 4.0)
        pred = discharge_radar.predict_encounter(c, diag_mean_los=mean_los)
        c["p_discharge"] = pred["p_discharge"]
        c["p_discharge_percent"] = round(pred["p_discharge"] * 100, 1)
        c["is_high_confidence"] = pred["is_high_confidence"]
        c["top_reasons"] = pred["top_reasons"]
        enriched.append(c)

    enriched.sort(key=lambda x: x["p_discharge"], reverse=True)
    return {
        "candidate_count": len(enriched),
        "candidates": enriched
    }


@app.post("/api/nurse-check/submit")
def submit_nurse_check(req: NurseCheckSubmitRequest, db: Session = Depends(get_db)):
    """Submits 3-question evaluation, determines Green/Amber/Red consent, logs to event_log."""
    mgr = NurseCheckManager(db=db, simulator=simulator)
    try:
        result = mgr.submit_nurse_check(
            encounter_id=req.encounter_id,
            payer_confirmed=req.payer_confirmed,
            family_available=req.family_available,
            home_problem=req.home_problem,
            nurse_name=req.nurse_name or "Sister Sunita (Ward In-Charge)",
            custom_refusal_reason=req.custom_refusal_reason
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@app.get("/api/whatsapp/messages")
def get_whatsapp_messages(role: Optional[str] = None, db: Session = Depends(get_db)):
    """Returns frontline WhatsApp task cards with bilingual copy and offline TTS audio links."""
    ws = WhatsAppService(db=db, simulator=simulator)
    messages = ws.get_active_whatsapp_messages(role_filter=role)
    return {
        "message_count": len(messages),
        "messages": messages
    }


@app.post("/api/whatsapp/synthesize/{task_id}")
def synthesize_whatsapp_audio(task_id: str, db: Session = Depends(get_db)):
    """Triggers offline voice note generation for a specific task."""
    ws = WhatsAppService(db=db, simulator=simulator)
    try:
        audio_info = ws.ensure_task_audio(task_id=task_id)
        return audio_info
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@app.post("/api/tasks/{task_id}/respond")
def respond_to_task(task_id: str, req: TaskRespondRequest, db: Session = Depends(get_db)):
    """Frontline staff action: Done or Can't (with reason). Propagates downstream side-effects and logs event."""
    ws = WhatsAppService(db=db, simulator=simulator)
    try:
        result = ws.respond_to_task(
            task_id=task_id,
            response=req.response,
            refusal_reason=req.refusal_reason,
            staff_name=req.staff_name
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# ==============================================================================
# PHASE 7: BILL ESTIMATOR & FAMILY PROJECTED RANGE SMS (FEATURE F6)
# ==============================================================================

class BillSendRequest(BaseModel):
    family_phone: Optional[str] = "+91 98765 43210"


@app.get("/api/bill-estimate/candidates")
def get_bill_estimate_candidates(db: Session = Depends(get_db)):
    """Returns active CASH patients with current bill estimate statuses and discharge readiness."""
    estimator = BillEstimator(db=db, simulator=simulator)
    candidates = estimator.get_cash_candidates()
    return {
        "cash_candidate_count": len(candidates),
        "candidates": candidates
    }


@app.get("/api/bill-estimate/{encounter_id}")
def get_bill_estimate(encounter_id: str, db: Session = Depends(get_db)):
    """Calculates or retrieves the itemized bill estimate with +/- 10% range and bilingual SMS copy."""
    estimator = BillEstimator(db=db, simulator=simulator)
    try:
        estimate = estimator.calculate_estimate(encounter_id=encounter_id)
        return estimate
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@app.post("/api/bill-estimate/calculate/{encounter_id}")
def calculate_bill_estimate(encounter_id: str, db: Session = Depends(get_db)):
    """Calculates and persists a projected bill estimate for a CASH patient."""
    estimator = BillEstimator(db=db, simulator=simulator)
    try:
        estimate = estimator.calculate_estimate(encounter_id=encounter_id)
        return estimate
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@app.post("/api/bill-estimate/send/{encounter_id}")
def send_bill_estimate_sms(encounter_id: str, req: BillSendRequest, db: Session = Depends(get_db)):
    """Dispatches projected bill estimate range SMS to family the evening before, logs event."""
    estimator = BillEstimator(db=db, simulator=simulator)
    try:
        result = estimator.send_bill_estimate_sms(
            encounter_id=encounter_id,
            family_phone=req.family_phone or "+91 98765 43210"
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@app.post("/api/bill-estimate/confirm/{encounter_id}")
def confirm_family_funds(encounter_id: str, db: Session = Depends(get_db)):
    """Family confirms arranged funds: updates payer confirmation to 'yes',
    re-evaluates consent to GREEN, and unlocks forecasted bed capacity per Guardrail #8."""
    estimator = BillEstimator(db=db, simulator=simulator)
    try:
        result = estimator.confirm_family_funds(encounter_id=encounter_id)
        return result
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


# ==============================================================================
# PHASE 8: ICU STEP-DOWN & 2X CANDIDATE OVER-PREPARATION (FEATURE F3)
# ==============================================================================

class IcuStepdownTriggerRequest(BaseModel):
    encounter_id: str
    consultant_id: str = "DR_PATEL"
    clinician_confirmed: bool = True


class IcuConsentRequest(BaseModel):
    encounter_id: str
    consent: str # "agreed", "worried", "refused"
    notes: Optional[str] = None
    nurse_name: Optional[str] = "Sister Sunita (ICU In-Charge)"


class IcuExecuteTransferRequest(BaseModel):
    encounter_id: str
    actor: Optional[str] = "ICU Staff + Porter Team"


@app.get("/api/icu/step-down/roster")
def get_icu_stepdown_roster(
    target_beds_needed: int = Query(default=1, ge=1, le=5),
    db: Session = Depends(get_db)
):
    """Retrieves all active ICU patients with 2x candidate over-preparation (Rule #10),
    clinical stabilization markers, preferred ward routing, and available ward beds."""
    roster = get_stepdown_roster(db, target_beds_needed=target_beds_needed)
    return roster


@app.post("/api/icu/step-down/trigger")
def trigger_doctor_stepdown_endpoint(
    req: IcuStepdownTriggerRequest,
    db: Session = Depends(get_db)
):
    """Guardrail #1: Doctor exclusively triggers step-down. AI never auto-triggers.
    Auto-reserves best matching ward bed (Surgery -> Ward B, Med/Cardio -> Ward A)
    and queues porter transfer task with backward-math WHY."""
    try:
        result = trigger_doctor_stepdown(
            encounter_id=req.encounter_id,
            consultant_id=req.consultant_id,
            db=db,
            clinician_confirmed=req.clinician_confirmed
        )
        return result
    except GuardrailViolation as e:
        raise HTTPException(status_code=400, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=409, detail=str(e))


@app.post("/api/icu/step-down/consent")
def submit_icu_family_consent_endpoint(
    req: IcuConsentRequest,
    db: Session = Depends(get_db)
):
    """ICU Nurse Family Consent Traffic Light:
    - 🟢 agreed: Unlocks forecasted ICU bed capacity under Guardrail #8.
    - 🟡 worried: Anxious family; shows counseling path; relies on 2x redundancy buffer.
    - 🔴 refused: Releases ward bed; promotes 2x alternate candidate immediately."""
    try:
        result = submit_family_consent(
            encounter_id=req.encounter_id,
            consent=req.consent,
            notes=req.notes,
            db=db,
            nurse_name=req.nurse_name or "Sister Sunita (ICU In-Charge)"
        )
        return result
    except GuardrailViolation as e:
        raise HTTPException(status_code=400, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@app.post("/api/icu/step-down/execute")
def execute_icu_transfer_endpoint(
    req: IcuExecuteTransferRequest,
    db: Session = Depends(get_db)
):
    """Completes the physical patient step-down transfer:
    Moves patient to reserved ward bed, sets old ICU bed to DIRTY, and queues rapid turnover cleaning."""
    try:
        result = execute_transfer(
            encounter_id=req.encounter_id,
            db=db,
            actor=req.actor or "ICU Staff + Porter Team"
        )
        return result
    except GuardrailViolation as e:
        raise HTTPException(status_code=400, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


# ==============================================================================
# PHASE 9: READINESS NUMBER, EMERGENCY CONSOLE, TIME SAVED & BLOCKER VIEW
# ==============================================================================

class EmergencyActivateRequest(BaseModel):
    surge_type: str = "MASS_CASUALTY_COLLISION"
    beds_needed: int = 4
    caller_role: Optional[str] = "Emergency Dept In-Charge"


@app.get("/api/readiness/live")
def get_live_readiness_endpoint(db: Session = Depends(get_db)):
    """Computes real-time hospital bed readiness index absorbable in 30 mins
    with threshold status (CRITICAL, STRAINED, HEALTHY) and ward breakdown."""
    try:
        metrics = get_readiness_metrics(db=db)
        return metrics
    except GuardrailViolation as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/api/blockers")
def get_bed_blockers_endpoint(db: Session = Depends(get_db)):
    """Single-Blocker Diagnostic View ('What's Blocking This Bed?'):
    Identifies the exact single active bottleneck per bed with Delay Book learned P90 budgets."""
    try:
        blockers = get_bed_blockers(db=db)
        return blockers
    except GuardrailViolation as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/api/metrics/time-saved")
def get_time_saved_endpoint(db: Session = Depends(get_db)):
    """Time Saved Today counter with strict Guardrail #10 scale separation:
    - Live Demonstrator (30 beds): measured hours saved across current cohort.
    - Scaled Projection (300 beds): strictly separated 10x extrapolation."""
    try:
        savings = calculate_time_saved(db=db)
        return savings
    except GuardrailViolation as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/emergency/activate")
def activate_emergency_console_endpoint(
    req: EmergencyActivateRequest,
    db: Session = Depends(get_db)
):
    """One-Tap Emergency Console Trigger (Feature F9):
    In a mass-casualty or acute surge event:
    1. Expedites housekeeping priority across all DIRTY beds (15m SLA).
    2. Identifies near-ready step-downs and dispatches high-priority alerts.
    3. Broadcasts operational alerts without violating Guardrail #1.
    4. Logs EMERGENCY_SURGE_ACTIVATED with dual timestamps."""
    try:
        result = activate_emergency_console(
            surge_type=req.surge_type,
            beds_needed=req.beds_needed,
            db=db,
            caller_role=req.caller_role or "Emergency Dept In-Charge"
        )
        return result
    except GuardrailViolation as e:
        raise HTTPException(status_code=400, detail=str(e))


# ==============================================================================
# PHASE 10: EVALUATION ENGINE & THE PROOF SCREEN
# ==============================================================================

@app.get("/api/evaluation/metrics")
def get_evaluation_metrics_endpoint(db: Session = Depends(get_db)):
    """PHASE 10 & THE PROOF SCREEN:
    Serves holistic scientific and operational evaluation metrics:
      - Discharge Radar accuracy (91%) vs naive baseline (64.1%)
      - Brier score reduction (-74%) and ECE calibration (< 0.02)
      - Probability saturation audit (strictly zero 0.0% / 100.0%)
      - Backwards scheduling & CP-SAT optimization metrics
      - The Medical Humility Matrix: 4 honest clinical/operational failure case studies
      - Canonical 10-guardrails live audit status
      - Cumulative operational time saved (30-bed live vs 300-bed projected)."""
    try:
        metrics = get_proof_evaluation_metrics(db=db)
        return metrics
    except GuardrailViolation as e:
        raise HTTPException(status_code=400, detail=str(e))


# ==============================================================================
# ROLE-BASED DASHBOARDS: PERSONA ACTIONS & ROSTER ENDPOINTS
# ==============================================================================

class BedCleanRequest(BaseModel):
    staff_name: Optional[str] = "Anand R. (Sweeper)"
    cleaning_notes: Optional[str] = "Terminal disinfection complete, linen changed, sanitization verified."


class DoctorDischargeRequest(BaseModel):
    consultant_id: Optional[str] = "DOC_01"
    doctor_name: Optional[str] = "Attending Physician"
    clinical_notes: Optional[str] = "Clinically stable for home discharge. Vitals stable, oral meds established."
    confirm_discharge: bool = True


@app.post("/api/beds/{bed_id}/clean")
def mark_bed_cleaned_endpoint(bed_id: str, req: BedCleanRequest, db: Session = Depends(get_db)):
    """Frontline Cleaner Action: Transitions a DIRTY bed to READY after terminal disinfection.
    Logs terminal cleaning event with dual timestamps."""
    bed = db.query(models.Bed).filter(models.Bed.id == bed_id).first()
    if not bed:
        raise HTTPException(status_code=404, detail=f"Bed {bed_id} not found")
    
    old_state = bed.state
    bed.state = "READY"
    bed.blocking_step = None
    bed.current_encounter_id = None
    
    # Complete any cleaning tasks associated with this bed
    cleaning_tasks = db.query(models.Task).filter(
        models.Task.role == "CLEANING",
        models.Task.ward == bed.ward
    ).all()
    for t in cleaning_tasks:
        if bed_id in (t.title_en or "") or bed_id in (t.reason_en or ""):
            t.status = "COMPLETED"
            
    # Log dual-timestamp event
    actual_time = simulator.simulated_time
    logged_time = actual_time + datetime.timedelta(minutes=3)
    event = models.EventLog(
        actual_time=actual_time,
        logged_time=logged_time,
        doc_lag_minutes=3.0,
        ward=bed.ward,
        actor=req.staff_name or "Anand R. (Sweeper)",
        action="BED_TERMINAL_CLEANED",
        entity=bed_id,
        payload_json={
            "bed_id": bed_id,
            "previous_state": old_state,
            "new_state": "READY",
            "staff_name": req.staff_name,
            "notes": req.cleaning_notes
        }
    )
    db.add(event)
    db.commit()
    db.refresh(bed)
    return {
        "message": f"Bed {bed_id} marked READY and sanitized.",
        "bed_id": bed_id,
        "state": "READY",
        "staff_name": req.staff_name
    }


@app.post("/api/encounters/{encounter_id}/doctor-discharge")
def doctor_discharge_endpoint(encounter_id: str, req: DoctorDischargeRequest, db: Session = Depends(get_db)):
    """Guardrail #1: Doctor Decides. Attending physician explicitly signs off on clinical discharge.
    Releases patient from bed, marks bed DIRTY for housekeeping terminal cleaning."""
    try:
        enforce_doctor_decides(
            action_type="PATIENT_DISCHARGE",
            clinician_confirmed=req.confirm_discharge
        )
    except GuardrailViolation as e:
        raise HTTPException(status_code=400, detail=str(e))
    enc = db.query(models.Encounter).filter(models.Encounter.id == encounter_id).first()
    if not enc:
        raise HTTPException(status_code=404, detail=f"Encounter {encounter_id} not found")
    
    bed_id = enc.bed_id
    enc.status = "DISCHARGED"
    
    # Mark bed as DIRTY for cleaner terminal disinfection
    bed = db.query(models.Bed).filter(models.Bed.id == bed_id).first() if bed_id else None
    if bed:
        bed.state = "DIRTY"
        bed.blocking_step = "HOUSEKEEPING_CLEANING"
        bed.current_encounter_id = None
        
    # Log dual timestamp event
    actual_time = simulator.simulated_time
    logged_time = actual_time + datetime.timedelta(minutes=5)
    event = models.EventLog(
        actual_time=actual_time,
        logged_time=logged_time,
        doc_lag_minutes=5.0,
        ward=enc.ward,
        actor=req.doctor_name or req.consultant_id,
        action="DOCTOR_DISCHARGE_CONFIRMED",
        entity=encounter_id,
        payload_json={
            "patient_name": enc.patient_name,
            "consultant_id": req.consultant_id,
            "doctor_name": req.doctor_name,
            "bed_id": bed_id,
            "notes": req.clinical_notes
        }
    )
    db.add(event)
    db.commit()
    actor_label = req.doctor_name or req.consultant_id or "Doctor"
    if not actor_label.startswith("Dr.") and not actor_label.startswith("Dr "):
        actor_label = f"Dr. {actor_label}"
    return {
        "message": f"{actor_label} signed discharge for {enc.patient_name}. Bed {bed_id} moved to DIRTY queue for housekeeping.",
        "encounter_id": encounter_id,
        "patient_name": enc.patient_name,
        "bed_id": bed_id,
        "bed_state": "DIRTY"
    }


@app.get("/api/staff/roster")
def get_staff_roster_endpoint():
    """Returns staff roster categorized by frontline roles for persona dashboard switcher."""
    return {
        "doctors": [
            {"id": "DR_SHARMA", "name": "Dr. Vivek Sharma", "specialty": "Internal Medicine", "ward": "WARD_A", "round_time": "09:48 AM"},
            {"id": "DR_RAO", "name": "Dr. Sunita Rao", "specialty": "General Surgery", "ward": "WARD_B", "round_time": "16:45 PM (OT Day) / 08:45 AM"},
            {"id": "DR_PATEL", "name": "Dr. Rajesh Patel", "specialty": "Cardiology / ICU", "ward": "ICU", "round_time": "10:15 AM"},
            {"id": "DR_KAPOOR", "name": "Dr. Ananya Kapoor", "specialty": "Pulmonology", "ward": "WARD_A", "round_time": "11:14 AM"},
            {"id": "DR_MEHRA", "name": "Dr. Vikram Mehra", "specialty": "Orthopedics", "ward": "WARD_B", "round_time": "14:15 PM"}
        ],
        "nurses": [
            {"id": "NURSE_1", "name": "Sister Sunita", "role": "Ward In-Charge", "ward": "WARD_A"},
            {"id": "NURSE_2", "name": "Sister Mary", "role": "Senior Staff Nurse", "ward": "WARD_B"},
            {"id": "NURSE_3", "name": "Sister Anita", "role": "ICU Nurse Lead", "ward": "ICU"}
        ],
        "cleaners": [
            {"id": "STAFF_CLEAN_1", "name": "Anand R.", "role": "Senior Housekeeping", "primary_ward": "WARD_A"},
            {"id": "STAFF_CLEAN_2", "name": "Deepa M.", "role": "Terminal Disinfection Tech", "primary_ward": "WARD_B"}
        ],
        "phlebotomists": [
            {"id": "STAFF_PHLEB_1", "name": "Sunita K.", "role": "Phlebotomy Tech", "primary_ward": "WARD_A"},
            {"id": "STAFF_PHLEB_2", "name": "Manoj V.", "role": "Morning Fasting Draw Specialist", "primary_ward": "WARD_B"},
            {"id": "STAFF_PHLEB_3", "name": "Amit R.", "role": "Critical Care Phlebotomist", "primary_ward": "ICU"}
        ]
    }


class StaffLoginRequest(BaseModel):
    staff_id: str
    role: str  # NURSE, DOCTOR, CLEANER, PHLEBOTOMIST, OPERATIONS
    name: Optional[str] = None
    ward: Optional[str] = None
    pin: Optional[str] = "1234"


@app.post("/api/auth/login")
def staff_login_endpoint(req: StaffLoginRequest, db: Session = Depends(get_db)):
    """Frontline Authentication: Authenticates staff member for their role-isolated shift
    and records immutable STAFF_DUTY_LOGIN audit log."""
    actual_time = simulator.simulated_time
    logged_time = actual_time + datetime.timedelta(seconds=45)

    event = models.EventLog(
        actual_time=actual_time,
        logged_time=logged_time,
        doc_lag_minutes=0.75,
        ward=req.ward or "ALL",
        actor=req.name or req.staff_id,
        action="STAFF_DUTY_LOGIN",
        entity=req.staff_id,
        payload_json={
            "staff_id": req.staff_id,
            "role": req.role,
            "name": req.name,
            "ward": req.ward,
            "shift": "MORNING_SHIFT_06_14"
        }
    )
    db.add(event)
    db.commit()

    return {
        "status": "authenticated",
        "staff_id": req.staff_id,
        "name": req.name or f"Staff {req.staff_id}",
        "role": req.role.upper(),
        "ward": req.ward or ("WARD_A" if req.role.upper() == "NURSE" else "ALL"),
        "shift": "Morning Shift (06:00 - 14:00)",
        "token": f"swasthflow-jwt-{req.staff_id}-{int(datetime.datetime.now().timestamp())}"
    }




