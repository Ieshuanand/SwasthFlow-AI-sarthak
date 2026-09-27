import datetime
from sqlalchemy import Column, String, Integer, Float, Boolean, DateTime, JSON, Text, ForeignKey
from sqlalchemy.orm import relationship
from database import Base

class Bed(Base):
    __tablename__ = "bed"

    id = Column(String(50), primary_key=True, index=True) # e.g. "WARD-A-01", "ICU-02"
    ward = Column(String(50), nullable=False, index=True) # "WARD_A", "WARD_B", "ICU", "SURGICAL"
    bed_type = Column(String(20), nullable=False) # "GENERAL", "ICU", "HDU"
    state = Column(String(20), nullable=False, default="READY") # "OCCUPIED", "PENDING", "DIRTY", "READY"
    
    predicted_free_at = Column(DateTime, nullable=True)
    predicted_free_lo = Column(DateTime, nullable=True)
    predicted_free_hi = Column(DateTime, nullable=True)
    blocking_step = Column(String(100), nullable=True) # "INSURANCE_CLEARANCE", "DOCTOR_ROUND", "FAMILY_CONSENT", "CLEANING", "PORTER", "READY"
    current_encounter_id = Column(String(50), nullable=True)

class Encounter(Base):
    __tablename__ = "encounter"

    id = Column(String(50), primary_key=True, index=True) # "ENC-1001"
    patient_id = Column(String(50), nullable=False, index=True) # "PAT-9842"
    patient_name = Column(String(100), nullable=False)
    age = Column(Integer, nullable=False)
    gender = Column(String(10), nullable=False)
    ward = Column(String(50), nullable=False, index=True)
    bed_id = Column(String(50), nullable=True, index=True)
    admission_time = Column(DateTime, nullable=False) # legacy alias for logged time
    admission_actual_time = Column(DateTime, nullable=False) # When patient truly entered ward
    admission_logged_time = Column(DateTime, nullable=False) # When staff typed it into HMS
    admission_doc_lag_min = Column(Float, nullable=False, default=0.0) # Ward logging lag
    diagnosis_code = Column(String(100), nullable=False)
    diagnosis_name = Column(String(200), nullable=False)
    consultant_id = Column(String(50), nullable=False) # "DR_SHARMA", "DR_RAO"
    consultant_name = Column(String(100), nullable=False)
    
    payer_type = Column(String(30), nullable=False) # "CASH", "TPA", "AYUSHMAN", "STATE_SCHEME", "CGHS"
    payer_name = Column(String(100), nullable=False)
    
    estimated_discharge = Column(DateTime, nullable=True)
    p_discharge = Column(Float, nullable=True) # Predicted probability
    discharge_reasons = Column(JSON, default=list) # Top 3 plain English explanations
    status = Column(String(20), default="ACTIVE") # "ACTIVE", "DISCHARGED", "TRANSFERRED"
    consent = Column(String(20), nullable=True, default=None) # "green", "amber", "red" (Nurse Check)
    
    # Clinical visible signs (generated with realistic noise by simulator)
    hours_since_last_test = Column(Float, default=0.0)
    iv_to_oral = Column(Boolean, default=False)
    oxygen_removed = Column(Boolean, default=True)
    diet_normalized = Column(Boolean, default=False)
    los_days = Column(Float, default=1.0)
    pt_cleared = Column(Boolean, default=False)
    vitals_stable = Column(Boolean, default=True)
    
    # Phase 8: ICU Step-Down Tracking
    icu_stepdown_status = Column(String(30), default="NONE") # "NONE", "CLINICALLY_READY", "BED_RESERVED", "READY_FOR_TRANSFER", "CONSENT_WORRIED", "CONSENT_REFUSED", "TRANSFERRED"
    reserved_bed_id = Column(String(50), nullable=True)
    stepdown_doctor_confirmed = Column(Boolean, default=False)
    stepdown_consent = Column(String(20), nullable=True) # "agreed", "worried", "refused"
    stepdown_consent_notes = Column(String(255), nullable=True)
    
    # Hidden Truth fields (used by simulator and evaluation, NOT by operational decision logic)
    true_discharge_day = Column(DateTime, nullable=True)
    has_complication = Column(Boolean, default=False) # ~15% reversals

class Payer(Base):
    __tablename__ = "payer"

    type = Column(String(30), primary_key=True) # "CASH", "TPA", "AYUSHMAN", "STATE_SCHEME", "CGHS"
    name = Column(String(100), nullable=False)
    median_clearance_min = Column(Integer, nullable=False)
    p90_clearance_min = Column(Integer, nullable=False)
    required_lead_hours = Column(Integer, nullable=False)
    process_steps = Column(JSON, default=list)

class NurseCheck(Base):
    __tablename__ = "nurse_check"

    id = Column(Integer, primary_key=True, autoincrement=True)
    encounter_id = Column(String(50), nullable=False, index=True)
    asked_at = Column(DateTime, default=datetime.datetime.utcnow)
    asked_by = Column(String(100), default="Nurse In-Charge")
    payer_confirmed = Column(String(20), nullable=False) # "yes", "no", "unsure"
    family_available = Column(String(20), nullable=False) # "yes", "no", "evening_only"
    home_problem = Column(String(255), nullable=True) # "None", "Needs ramp", "No caregiver", etc.
    consent = Column(String(20), nullable=False) # "green", "amber", "red"
    refusal_reason = Column(String(255), nullable=True)

class BillEstimate(Base):
    __tablename__ = "bill_estimate"

    id = Column(Integer, primary_key=True, autoincrement=True)
    encounter_id = Column(String(50), nullable=False, index=True)
    accrued_amount = Column(Float, nullable=False)
    projected_low = Column(Float, nullable=False)
    projected_high = Column(Float, nullable=False)
    out_of_pocket = Column(Float, nullable=False)
    breakdown_json = Column(JSON, nullable=True)
    sms_text_en = Column(Text, nullable=True)
    sms_text_hi = Column(Text, nullable=True)
    family_phone = Column(String(50), nullable=True)
    status = Column(String(20), default="ESTIMATED") # "ESTIMATED", "SMS_SENT", "CONFIRMED"
    computed_at = Column(DateTime, default=datetime.datetime.utcnow)
    sent_at = Column(DateTime, nullable=True)

class Task(Base):
    __tablename__ = "task"

    id = Column(String(50), primary_key=True) # e.g. "TSK-202409-001"
    role = Column(String(50), nullable=False) # "NURSE", "BILLING", "HOUSEKEEPING", "PORTER", "PHLEBOTOMY", "PHARMACY"
    ward = Column(String(50), nullable=False)
    title_en = Column(String(255), nullable=False)
    title_hi = Column(String(255), nullable=False)
    reason_en = Column(Text, nullable=False) # Mandatory non-negotiable WHY
    reason_hi = Column(Text, nullable=False)
    deadline = Column(DateTime, nullable=False)
    confidence = Column(Float, nullable=False) # >= 0.70 required to publish
    sent_at = Column(DateTime, default=datetime.datetime.utcnow)
    channel = Column(String(30), default="WHATSAPP") # "WHATSAPP", "SMS", "DASHBOARD"
    response = Column(String(20), nullable=True) # "done", "cannot"
    responded_at = Column(DateTime, nullable=True)
    refusal_reason = Column(String(255), nullable=True)

class Prediction(Base):
    __tablename__ = "prediction"

    id = Column(Integer, primary_key=True, autoincrement=True)
    encounter_id = Column(String(50), nullable=False, index=True)
    made_at = Column(DateTime, default=datetime.datetime.utcnow)
    target = Column(String(50), nullable=False) # "discharge_horizon", "round_time"
    value = Column(Float, nullable=False)
    actual = Column(Float, nullable=True)
    error = Column(Float, nullable=True)

class DelayStat(Base):
    __tablename__ = "delay_stat"

    id = Column(Integer, primary_key=True, autoincrement=True)
    step = Column(String(100), nullable=False) # "TPA_CLEARANCE", "BED_CLEANING", "PORTER_TRANSFER", "DISCHARGE_SUMMARY"
    ward = Column(String(50), nullable=True)
    payer_type = Column(String(30), nullable=True)
    hour_bucket = Column(Integer, nullable=True)
    median_min = Column(Float, nullable=False)
    p90_min = Column(Float, nullable=False)
    sample_count = Column(Integer, default=1)

class EventLog(Base):
    __tablename__ = "event_log"

    id = Column(Integer, primary_key=True, autoincrement=True)
    ts = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)
    actual_time = Column(DateTime, nullable=False) # When the event actually happened
    logged_time = Column(DateTime, nullable=False) # When staff logged it in the HMS
    doc_lag_minutes = Column(Float, nullable=False) # Documentation delay in minutes
    ward = Column(String(50), nullable=True, index=True)
    actor = Column(String(100), nullable=False)
    action = Column(String(100), nullable=False)
    entity = Column(String(100), nullable=False)
    payload_json = Column(JSON, default=dict)

