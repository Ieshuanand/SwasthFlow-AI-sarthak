import datetime
from sqlalchemy.orm import Session
import models
from simulator import HospitalSimulator, PAYER_CONFIGS

def sync_payers_to_db(db: Session):
    """Seed / sync standard payer configurations into database."""
    for p in PAYER_CONFIGS:
        existing = db.query(models.Payer).filter(models.Payer.type == p["type"]).first()
        if not existing:
            payer_record = models.Payer(
                type=p["type"],
                name=p["name"],
                median_clearance_min=p["median_clearance_min"],
                p90_clearance_min=p["p90_clearance_min"],
                required_lead_hours=p["required_lead_hours"],
                process_steps=p["process_steps"]
            )
            db.add(payer_record)
    db.commit()

def sync_simulator_to_db(sim: HospitalSimulator, db: Session):
    """Reads current simulated hospital state and updates SwasthFlow database tables."""
    # 1. Sync Beds
    for bed_id, bed_data in sim.beds.items():
        existing_bed = db.query(models.Bed).filter(models.Bed.id == bed_id).first()
        if not existing_bed:
            existing_bed = models.Bed(
                id=bed_id,
                ward=bed_data["ward"],
                bed_type=bed_data["bed_type"],
                state=bed_data["state"],
                blocking_step=bed_data["blocking_step"],
                current_encounter_id=bed_data["current_encounter_id"]
            )
            db.add(existing_bed)
        else:
            existing_bed.ward = bed_data["ward"]
            existing_bed.bed_type = bed_data["bed_type"]
            existing_bed.state = bed_data["state"]
            existing_bed.blocking_step = bed_data["blocking_step"]
            existing_bed.current_encounter_id = bed_data["current_encounter_id"]

    # 2. Sync Patients / Encounters with visible signs
    for enc_id, p in sim.patients.items():
        signs = sim.compute_visible_signs(p)
        existing_enc = db.query(models.Encounter).filter(models.Encounter.id == enc_id).first()
        if not existing_enc:
            new_enc = models.Encounter(
                id=enc_id,
                patient_id=p["patient_id"],
                patient_name=p["patient_name"],
                age=p["age"],
                gender=p["gender"],
                ward=p["ward"],
                bed_id=p["bed_id"],
                admission_time=p["admission_time"],
                admission_actual_time=p["admission_actual_time"],
                admission_logged_time=p["admission_logged_time"],
                admission_doc_lag_min=p["admission_doc_lag_min"],
                diagnosis_code=p["diagnosis_code"],
                diagnosis_name=p["diagnosis_name"],
                consultant_id=p["consultant_id"],
                consultant_name=p["consultant_name"],
                payer_type=p["payer_type"],
                payer_name=p["payer_name"],
                status=p["status"],
                consent=p.get("consent"),
                # Visible signs
                hours_since_last_test=signs["hours_since_last_test"],
                iv_to_oral=signs["iv_to_oral"],
                oxygen_removed=signs["oxygen_removed"],
                diet_normalized=signs["diet_normalized"],
                los_days=signs["los_days"],
                pt_cleared=signs["pt_cleared"],
                vitals_stable=signs["vitals_stable"],
                # Hidden truth (for scoring & simulation only)
                true_discharge_day=p["true_discharge_day"],
                has_complication=p["has_complication"]
            )
            db.add(new_enc)
        else:
            existing_enc.status = p["status"]
            existing_enc.bed_id = p["bed_id"]
            if p.get("consent") is not None:
                existing_enc.consent = p["consent"]
            existing_enc.hours_since_last_test = signs["hours_since_last_test"]
            existing_enc.iv_to_oral = signs["iv_to_oral"]
            existing_enc.oxygen_removed = signs["oxygen_removed"]
            existing_enc.diet_normalized = signs["diet_normalized"]
            existing_enc.los_days = signs["los_days"]
            existing_enc.pt_cleared = signs["pt_cleared"]
            existing_enc.vitals_stable = signs["vitals_stable"]

    # 3. Sync Event Log with actual vs logged timestamps (for Delay Book)
    existing_events = db.query(models.EventLog).count()
    if len(sim.events) > existing_events:
        for ev in sim.events[existing_events:]:
            db.add(models.EventLog(
                ts=ev["ts"],
                actual_time=ev["actual_time"],
                logged_time=ev["logged_time"],
                doc_lag_minutes=ev["doc_lag_minutes"],
                ward=ev.get("ward"),
                actor=ev["actor"],
                action=ev["action"],
                entity=ev["entity"],
                payload_json=ev.get("payload_json", {})
            ))

    db.commit()
