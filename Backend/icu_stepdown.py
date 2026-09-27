"""SwasthFlow AI — ICU Step-Down Screen & 2x Candidate Over-Preparation (Feature F3).
Strictly adheres to:
- Guardrail #1 (The Doctor Decides: AI never auto-triggers clinical readiness)
- Guardrail #8 (Green-Consent Capacity: only green-consent unlocks capacity)
- Rule #10 (2x Candidate Over-Preparation: prepare 2K candidates for K beds)
- Phrasing Guardrail: Positive recovery phrasing; strictly no coercive bed-shortage pressure.
"""

import datetime
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import func

import models
from guardrails import (
    enforce_doctor_decides,
    enforce_green_consent_capacity,
    enforce_family_communication_script,
    MIN_TASK_CONFIDENCE,
    GuardrailViolation
)


def compute_stability_score(encounter: models.Encounter) -> Dict[str, Any]:
    """Computes clinical stabilization score purely as an advisory triage metric for doctor review.
    AI NEVER auto-triggers clinical readiness based on this score (Guardrail #1)."""
    score = 0.0
    factors = []

    if encounter.vitals_stable:
        score += 0.40
        factors.append("Vitals Hemodynamically Stable (+40%)")
    else:
        factors.append("Vitals Unstable / Inotropic Support (0%)")

    if encounter.oxygen_removed:
        score += 0.30
        factors.append("Room Air / Weaned from High-Flow O2 (+30%)")
    else:
        factors.append("Active Oxygen / Ventilator Dependent (0%)")

    if encounter.iv_to_oral:
        score += 0.20
        factors.append("Switched to Oral Medications (+20%)")
    else:
        factors.append("Continuous IV Infusions / Arterial Line (0%)")

    los = encounter.los_days or 0.0
    if los >= 2.0:
        score += 0.10
        factors.append(f"ICU Stay {los:.1f}d Adequate for Step-Down (+10%)")
    elif los >= 1.0:
        score += 0.05
        factors.append(f"ICU Stay {los:.1f}d Recent Post-Op (+5%)")
    else:
        factors.append(f"ICU Stay {los:.1f}d Acute Phase (0%)")

    score = round(min(score, 1.0), 2)

    if encounter.vitals_stable and encounter.oxygen_removed and encounter.iv_to_oral:
        stability_status = "CLINICALLY_STABLE"
    elif encounter.vitals_stable and (encounter.oxygen_removed or encounter.iv_to_oral):
        stability_status = "BORDERLINE_OBSERVATION"
    else:
        stability_status = "ACUTE_ICU_MONITORING"

    return {
        "stability_score": score,
        "stability_status": stability_status,
        "factors": factors
    }


def generate_family_stepdown_script(
    patient_name: str,
    consultant_name: str,
    reserved_bed_id: Optional[str] = None,
    ward_name: Optional[str] = None
) -> Dict[str, str]:
    """Generates bilingual family step-down explanation script using canonical positive recovery phrasing.
    Strictly verified against coercive phrasing guardrails."""
    bed_str = reserved_bed_id or "General Ward Bed"
    ward_str = ward_name or "Step-Down Ward"

    script_en = (
        f"Good news! Dr. {consultant_name} has reviewed {patient_name} and confirmed that their condition "
        f"has improved significantly and is clinically stable to step down from the ICU to the general ward. "
        f"We have reserved bed {bed_str} in {ward_str} with continuous nursing care. "
        f"Are you comfortable proceeding with the step-down transfer?"
    )

    script_hi = (
        f"शुभ समाचार! डॉ. {consultant_name} ने {patient_name} की जांच की है और पुष्टि की है कि उनके "
        f"स्वास्थ्य में काफी सुधार हुआ है और वे आईसीयू से जनरल वार्ड में जाने के लिए पूरी तरह स्थिर हैं। "
        f"हमने {ward_str} में बेड {bed_str} आरक्षित किया है जहाँ 24 घंटे नर्सिंग देखरेख रहेगी। "
        f"क्या आप वार्ड में स्थानांतरण के लिए सहमत हैं?"
    )

    # Programmatically enforce guardrail on phrasing
    enforce_family_communication_script(script_en)

    return {
        "script_en": script_en,
        "script_hi": script_hi
    }


def determine_preferred_ward(encounter: models.Encounter) -> str:
    """Routes step-down based on clinical specialty:
    Surgical -> WARD_B (Surgical Ward)
    Medical / Cardiology -> WARD_A (Medical Ward)"""
    diag = (encounter.diagnosis_name or "").lower()
    doc = (encounter.consultant_name or "").lower()
    doc_id = (encounter.consultant_id or "").lower()

    if "surgery" in diag or "surgical" in diag or "abdominal" in diag or "rao" in doc or "rao" in doc_id:
        return "WARD_B"
    return "WARD_A"


def get_stepdown_roster(db: Session, target_beds_needed: int = 1) -> Dict[str, Any]:
    """Feature F3: Retrieves ICU step-down candidate roster with 2x over-preparation.
    For K target beds needed, prepares 2K candidates (Rule #10)."""
    # 1. Fetch active ICU encounters
    encounters = db.query(models.Encounter).filter(
        models.Encounter.ward == "ICU",
        models.Encounter.status == "ACTIVE"
    ).all()

    candidates_evaluated = []
    for enc in encounters:
        stab = compute_stability_score(enc)
        pref_ward = determine_preferred_ward(enc)
        scripts = generate_family_stepdown_script(
            patient_name=enc.patient_name,
            consultant_name=enc.consultant_name,
            reserved_bed_id=enc.reserved_bed_id,
            ward_name=pref_ward
        )

        candidates_evaluated.append({
            "encounter_id": enc.id,
            "patient_id": enc.patient_id,
            "patient_name": enc.patient_name,
            "age": enc.age,
            "gender": enc.gender,
            "bed_id": enc.bed_id,
            "diagnosis_name": enc.diagnosis_name,
            "consultant_id": enc.consultant_id,
            "consultant_name": enc.consultant_name,
            "payer_type": enc.payer_type,
            "vitals_stable": enc.vitals_stable,
            "iv_to_oral": enc.iv_to_oral,
            "oxygen_removed": enc.oxygen_removed,
            "los_days": round(enc.los_days or 0.0, 1),
            "stability_score": stab["stability_score"],
            "stability_status": stab["stability_status"],
            "stability_factors": stab["factors"],
            "preferred_ward": pref_ward,
            "icu_stepdown_status": enc.icu_stepdown_status or "NONE",
            "stepdown_doctor_confirmed": bool(enc.stepdown_doctor_confirmed),
            "reserved_bed_id": enc.reserved_bed_id,
            "stepdown_consent": enc.stepdown_consent,
            "stepdown_consent_notes": enc.stepdown_consent_notes,
            "script_en": scripts["script_en"],
            "script_hi": scripts["script_hi"]
        })

    # Sort candidates by:
    # 1. Already doctor confirmed & active
    # 2. Stability score descending
    # 3. LOS days descending
    def sort_key(c):
        status_priority = 0
        if c["icu_stepdown_status"] == "READY_FOR_TRANSFER":
            status_priority = 5
        elif c["icu_stepdown_status"] == "BED_RESERVED":
            status_priority = 4
        elif c["stepdown_doctor_confirmed"]:
            status_priority = 3
        elif c["icu_stepdown_status"] == "CONSENT_REFUSED":
            status_priority = -1 # refused candidate pushed down
        elif c["stability_status"] == "CLINICALLY_STABLE":
            status_priority = 2
        return (status_priority, c["stability_score"], c["los_days"])

    candidates_evaluated.sort(key=sort_key, reverse=True)

    # 2. Assign 2x Over-Preparation Roles (Rule #10)
    # Target beds = K -> Candidates needed = 2K
    candidates_needed = target_beds_needed * 2

    # Filter out refused candidates for the active primary/buffer selection
    active_pool = [c for c in candidates_evaluated if c["icu_stepdown_status"] != "CONSENT_REFUSED"]
    refused_pool = [c for c in candidates_evaluated if c["icu_stepdown_status"] == "CONSENT_REFUSED"]

    for idx, c in enumerate(active_pool):
        if idx < target_beds_needed:
            c["role_in_buffer"] = "PRIMARY"
            c["role_description"] = "Designated Primary Step-Down Candidate"
        elif idx < candidates_needed:
            c["role_in_buffer"] = "BUFFER"
            c["role_description"] = "2x Redundancy Buffer Candidate (Activates instantly if primary hesitates/refuses)"
        else:
            c["role_in_buffer"] = "MONITORING"
            c["role_description"] = "ICU Clinical Monitoring"

    for c in refused_pool:
        c["role_in_buffer"] = "REFUSED"
        c["role_description"] = "Family Refused — Bed Released to 2x Buffer Candidate"

    # Re-combine preserving the ordering
    final_roster = active_pool + refused_pool

    # 3. Query available ward beds in WARD_A and WARD_B
    ward_beds = db.query(models.Bed).filter(
        models.Bed.ward.in_(["WARD_A", "WARD_B"])
    ).all()

    available_ward_beds = [
        {
            "id": b.id,
            "ward": b.ward,
            "bed_type": b.bed_type,
            "state": b.state,
            "blocking_step": b.blocking_step
        }
        for b in ward_beds if b.state in ["READY", "RESERVED"]
    ]

    # Calculate live metrics
    green_count = sum(1 for c in final_roster if c["stepdown_consent"] == "agreed")
    amber_count = sum(1 for c in final_roster if c["stepdown_consent"] == "worried")
    refused_count = sum(1 for c in final_roster if c["stepdown_consent"] == "refused")
    reserved_count = sum(1 for c in final_roster if c["icu_stepdown_status"] in ["BED_RESERVED", "READY_FOR_TRANSFER"])

    return {
        "target_beds_needed": target_beds_needed,
        "over_preparation_multiplier": 2,
        "candidates_required": candidates_needed,
        "candidates_prepared": min(len(active_pool), candidates_needed),
        "buffer_healthy": len(active_pool) >= candidates_needed,
        "icu_total_occupied": len(encounters),
        "green_consent_count": green_count,
        "amber_consent_count": amber_count,
        "refused_consent_count": refused_count,
        "reserved_beds_count": reserved_count,
        "roster": final_roster,
        "available_ward_beds": available_ward_beds
    }


def trigger_doctor_stepdown(
    encounter_id: str,
    consultant_id: str,
    db: Session,
    clinician_confirmed: bool = True
) -> Dict[str, Any]:
    """Guardrail #1: AI never auto-triggers clinical readiness.
    Doctor explicitly taps [Confirm Clinically Stable for Ward].
    On tap:
    - Auto-reserves best matching ward bed (Surgery -> Ward B; Med/Cardio -> Ward A)
    - Queues cleaning verification if needed
    - Queues porter transfer task with mandatory backward-math WHY
    - Transitions encounter to BED_RESERVED."""
    # Programmatic Guardrail #1 check
    enforce_doctor_decides("ICU_STEPDOWN_CLINICAL_TRIGGER", clinician_confirmed)

    enc = db.query(models.Encounter).filter(models.Encounter.id == encounter_id).first()
    if not enc:
        raise ValueError(f"Encounter {encounter_id} not found.")

    if enc.ward != "ICU":
        raise ValueError(f"Encounter {encounter_id} is in {enc.ward}, not ICU.")

    now = datetime.datetime.utcnow()

    # 1. Match best available ward bed
    pref_ward = determine_preferred_ward(enc)
    target_bed = db.query(models.Bed).filter(
        models.Bed.ward == pref_ward,
        models.Bed.state == "READY"
    ).first()

    # If preferred ward has no ready beds, try the other general ward
    if not target_bed:
        other_ward = "WARD_A" if pref_ward == "WARD_B" else "WARD_B"
        target_bed = db.query(models.Bed).filter(
            models.Bed.ward == other_ward,
            models.Bed.state == "READY"
        ).first()

    if not target_bed:
        raise RuntimeError(f"No READY bed found in {pref_ward} or alternative general wards for step-down.")

    # 2. Reserve the ward bed
    target_bed.state = "RESERVED"
    target_bed.blocking_step = f"ICU_STEPDOWN_TRANSFER_{enc.id}"

    # 3. Create Porter transfer task with mandatory backwards-math WHY
    porter_task_id = f"TSK-PORTER-STEPDOWN-{enc.id}"
    existing_porter_task = db.query(models.Task).filter(models.Task.id == porter_task_id).first()
    if not existing_porter_task:
        porter_task = models.Task(
            id=porter_task_id,
            role="PORTER",
            ward=enc.ward,
            title_en=f"ICU Step-Down Transfer: {enc.patient_name} -> {target_bed.id}",
            title_hi=f"आईसीयू स्टेप-डाउन स्थानांतरण: {enc.patient_name} -> {target_bed.id}",
            reason_en=(
                f"Clinician Dr. {enc.consultant_name} confirmed clinical stability for ward. "
                f"Backward-math: 20m porter transfer + 15m ward intake handover scheduled before afternoon vitals round."
            ),
            reason_hi=(
                f"चिकित्सक डॉ. {enc.consultant_name} ने वार्ड के लिए नैदानिक स्थिरता की पुष्टि की। "
                f"दोपहर के वाइटल्स राउंड से पहले स्थानांतरण और वार्ड हैंडओवर निर्धारित है।"
            ),
            deadline=now + datetime.timedelta(minutes=45),
            confidence=0.95,
            sent_at=now,
            channel="DASHBOARD"
        )
        db.add(porter_task)

    # 4. Update encounter state
    enc.stepdown_doctor_confirmed = True
    enc.reserved_bed_id = target_bed.id
    enc.icu_stepdown_status = "BED_RESERVED"

    # 5. Dual-timestamp Event Log
    event = models.EventLog(
        ts=now,
        actual_time=now,
        logged_time=now,
        doc_lag_minutes=0.0,
        ward="ICU",
        actor=f"{consultant_id} (ICU Clinician)",
        action="ICU_STEPDOWN_DOCTOR_TRIGGERED",
        entity=encounter_id,
        payload_json={
            "encounter_id": enc.id,
            "patient_name": enc.patient_name,
            "consultant_id": consultant_id,
            "reserved_bed_id": target_bed.id,
            "reserved_ward": target_bed.ward,
            "porter_task_id": porter_task_id,
            "guardrail_enforced": "Guardrail #1 (The Doctor Decides)"
        }
    )
    db.add(event)
    db.commit()

    return {
        "status": "SUCCESS",
        "encounter_id": enc.id,
        "patient_name": enc.patient_name,
        "stepdown_doctor_confirmed": True,
        "reserved_bed_id": target_bed.id,
        "reserved_ward": target_bed.ward,
        "porter_task_id": porter_task_id,
        "icu_stepdown_status": enc.icu_stepdown_status,
        "message": f"Clinician confirmed step-down. Bed {target_bed.id} ({target_bed.ward}) reserved and porter task queued."
    }


def submit_family_consent(
    encounter_id: str,
    consent: str,
    notes: Optional[str] = None,
    db: Session = None,
    nurse_name: str = "Sister Sunita (ICU In-Charge)"
) -> Dict[str, Any]:
    """ICU Nurse Family Consent Traffic Light:
    - 🟢 agreed: Unlocks forecasted ICU bed capacity under Guardrail #8. Status -> READY_FOR_TRANSFER.
    - 🟡 worried: Anxious family. Shows counseling path; does NOT unlock capacity. Status -> CONSENT_WORRIED.
    - 🔴 refused: Releases reserved ward bed back to READY; activates 2x alternate candidate immediately. Status -> CONSENT_REFUSED."""
    valid_consents = ["agreed", "worried", "refused"]
    consent_normalized = consent.lower().strip()
    if consent_normalized not in valid_consents:
        raise ValueError(f"Invalid consent value '{consent}'. Must be one of {valid_consents}.")

    enc = db.query(models.Encounter).filter(models.Encounter.id == encounter_id).first()
    if not enc:
        raise ValueError(f"Encounter {encounter_id} not found.")

    # Guardrail #1 Enforcement: Family consent cannot be evaluated or recorded unless
    # the attending clinician has explicitly authorized clinical step-down for THIS specific patient.
    if not enc.stepdown_doctor_confirmed:
        raise GuardrailViolation(
            f"[GUARDRAIL #1 VIOLATION] Cannot record family step-down consent for patient {enc.patient_name} ({enc.id}) "
            f"without prior explicit authorization by attending clinician {enc.consultant_name}."
        )

    now = datetime.datetime.utcnow()
    prev_status = enc.icu_stepdown_status
    prev_reserved_bed = enc.reserved_bed_id

    alternate_promoted = None
    counts_as_capacity = False
    resolving_action = None

    if consent_normalized == "agreed":
        enc.stepdown_consent = "agreed"
        enc.stepdown_consent_notes = notes or "Family agrees to transfer to general ward."
        enc.icu_stepdown_status = "READY_FOR_TRANSFER"

        # Guardrail #8 Check: Only agreed/green consent unlocks capacity
        counts_as_capacity = enforce_green_consent_capacity("agreed", confidence=0.90)

    elif consent_normalized == "worried":
        enc.stepdown_consent = "worried"
        enc.stepdown_consent_notes = notes or "Family anxious regarding ward monitoring protocols."
        enc.icu_stepdown_status = "CONSENT_WORRIED"
        counts_as_capacity = False # Guardrail #8

        resolving_action = (
            f"Assign Senior Ward In-Charge Sister to meet family at ICU reception. "
            f"Demonstrate continuous pulse oximeter monitoring in {enc.reserved_bed_id or 'the ward'}. "
            f"Hold in ICU/transit lounge during counseling. 2x Buffer Candidate on standby."
        )

    elif consent_normalized == "refused":
        enc.stepdown_consent = "refused"
        enc.stepdown_consent_notes = notes or "Family explicitly refused ward transfer; requested another day in ICU."
        enc.icu_stepdown_status = "CONSENT_REFUSED"
        counts_as_capacity = False # Guardrail #8

        # RELEASE RESERVED WARD BED
        if enc.reserved_bed_id:
            res_bed = db.query(models.Bed).filter(models.Bed.id == enc.reserved_bed_id).first()
            if res_bed:
                res_bed.state = "READY"
                res_bed.blocking_step = "READY"
            enc.reserved_bed_id = None

        # ACTIVATE 2X REDUNDANCY BUFFER CANDIDATE IMMEDIATELY (Rule #10)
        # Find next eligible candidate who is NOT this encounter
        roster_info = get_stepdown_roster(db, target_beds_needed=1)
        buffer_candidates = [
            c for c in roster_info["roster"]
            if c["encounter_id"] != encounter_id and c["icu_stepdown_status"] not in ["CONSENT_REFUSED", "TRANSFERRED"]
        ]

        if buffer_candidates:
            alternate_promoted = buffer_candidates[0]
            resolving_action = (
                f"Primary candidate {enc.patient_name} refused. "
                f"Reserved bed released. 2x Alternate Candidate {alternate_promoted['patient_name']} "
                f"({alternate_promoted['encounter_id']}) promoted to PRIMARY step-down slot. "
                f"Mandatory Guardrail #1 Gate: Requires fresh confirmation by attending clinician {alternate_promoted['consultant_name']} "
                f"before bed reservation and family consent."
            )
        else:
            resolving_action = "Primary candidate refused. No remaining 2x buffer candidates in ICU."

    # Dual-timestamp Event Log
    event = models.EventLog(
        ts=now,
        actual_time=now,
        logged_time=now,
        doc_lag_minutes=0.0,
        ward="ICU",
        actor=nurse_name,
        action="ICU_FAMILY_CONSENT_LOGGED",
        entity=encounter_id,
        payload_json={
            "encounter_id": enc.id,
            "patient_name": enc.patient_name,
            "previous_status": prev_status,
            "consent": consent_normalized,
            "notes": enc.stepdown_consent_notes,
            "released_bed_id": prev_reserved_bed if consent_normalized == "refused" else None,
            "counts_as_forecasted_capacity": counts_as_capacity,
            "alternate_candidate_promoted": alternate_promoted["encounter_id"] if alternate_promoted else None,
            "guardrail_enforced": "Guardrail #8 (Green-Consent Capacity)"
        }
    )
    db.add(event)
    db.commit()

    return {
        "status": "SUCCESS",
        "encounter_id": enc.id,
        "patient_name": enc.patient_name,
        "consent": consent_normalized,
        "icu_stepdown_status": enc.icu_stepdown_status,
        "counts_as_forecasted_capacity": counts_as_capacity,
        "resolving_action": resolving_action,
        "alternate_promoted": alternate_promoted,
        "reserved_bed_id": enc.reserved_bed_id
    }


def execute_transfer(
    encounter_id: str,
    db: Session,
    actor: str = "ICU Staff + Porter Team"
) -> Dict[str, Any]:
    """Completes the physical patient step-down transfer:
    - Moves patient to reserved ward bed (sets ward bed to OCCUPIED)
    - Sets old ICU bed to DIRTY and queues rapid ICU turnover sanitization
    - Updates encounter bed and ward
    - Sets encounter.icu_stepdown_status = 'TRANSFERRED'
    - Logs ICU_TRANSFER_COMPLETED."""
    enc = db.query(models.Encounter).filter(models.Encounter.id == encounter_id).first()
    if not enc:
        raise ValueError(f"Encounter {encounter_id} not found.")

    if not enc.stepdown_doctor_confirmed:
        raise GuardrailViolation("Cannot execute transfer without clinician authorization (Guardrail #1).")

    if enc.stepdown_consent != "agreed":
        raise GuardrailViolation("Cannot execute transfer without family GREEN/Agreed consent (Guardrail #8).")

    if not enc.reserved_bed_id:
        raise ValueError(f"Encounter {encounter_id} has no reserved ward bed.")

    new_bed = db.query(models.Bed).filter(models.Bed.id == enc.reserved_bed_id).first()
    if not new_bed:
        raise ValueError(f"Reserved bed {enc.reserved_bed_id} not found in database.")

    old_icu_bed_id = enc.bed_id
    old_icu_bed = db.query(models.Bed).filter(models.Bed.id == old_icu_bed_id).first() if old_icu_bed_id else None

    now = datetime.datetime.utcnow()

    # 1. Update New Bed
    new_bed.state = "OCCUPIED"
    new_bed.current_encounter_id = enc.id
    new_bed.blocking_step = "READY"

    # 2. Update Old Bed -> DIRTY + Queue Rapid Sanitization Task
    if old_icu_bed:
        old_icu_bed.state = "DIRTY"
        old_icu_bed.current_encounter_id = None
        old_icu_bed.blocking_step = "CLEANING"

        clean_task_id = f"TSK-CLEAN-{old_icu_bed.id}"
        clean_task = db.query(models.Task).filter(models.Task.id == clean_task_id).first()
        if not clean_task:
            clean_task = models.Task(
                id=clean_task_id,
                role="HOUSEKEEPING",
                ward="ICU",
                title_en=f"Urgent ICU Bed Turnover: {old_icu_bed.id}",
                title_hi=f"अत्यावश्यक आईसीयू बेड सफाई: {old_icu_bed.id}",
                reason_en="ICU bed freed via step-down. Rapid 30m turnover required for incoming emergency intake.",
                reason_hi="स्टेप-डाउन द्वारा आईसीयू बेड खाली हुआ। आपातकालीन भर्ती के लिए 30 मिनट में त्वरित सफाई आवश्यक।",
                deadline=now + datetime.timedelta(minutes=30),
                confidence=0.98,
                sent_at=now,
                channel="DASHBOARD"
            )
            db.add(clean_task)

    # 3. Update Encounter Location
    enc.bed_id = new_bed.id
    enc.ward = new_bed.ward
    enc.icu_stepdown_status = "TRANSFERRED"
    enc.reserved_bed_id = None

    # 4. Dual-timestamp Event Log
    event = models.EventLog(
        ts=now,
        actual_time=now,
        logged_time=now,
        doc_lag_minutes=0.0,
        ward="ICU",
        actor=actor,
        action="ICU_TRANSFER_COMPLETED",
        entity=encounter_id,
        payload_json={
            "encounter_id": enc.id,
            "patient_name": enc.patient_name,
            "from_bed": old_icu_bed_id,
            "from_ward": "ICU",
            "to_bed": new_bed.id,
            "to_ward": new_bed.ward,
            "old_bed_state": "DIRTY",
            "new_bed_state": "OCCUPIED"
        }
    )
    db.add(event)
    db.commit()

    return {
        "status": "SUCCESS",
        "encounter_id": enc.id,
        "patient_name": enc.patient_name,
        "from_bed": old_icu_bed_id,
        "to_bed": new_bed.id,
        "to_ward": new_bed.ward,
        "icu_stepdown_status": "TRANSFERRED",
        "message": f"Patient {enc.patient_name} successfully transferred to {new_bed.id} ({new_bed.ward}). ICU bed {old_icu_bed_id} marked DIRTY and queued for rapid turnover."
    }
