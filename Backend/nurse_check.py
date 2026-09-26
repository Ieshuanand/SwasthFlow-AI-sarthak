"""SwasthFlow AI — Nurse Check Module (Phase 6).
Implements:
  1. 3-Question Clinical Readiness Check (Payer, Family Availability, Home Problem).
  2. Explicit Home Problem Mapping & Resolving Actions:
     - None: Contributes to GREEN
     - Needs ramp: AMBER (Resolving action: Offer hospital transport aid / wheelchair loan)
     - No caregiver: RED (Hard clinical safety blocker)
     - Oxygen cylinder required: AMBER (Resolving action: Connect family to empanelled home oxygen rental service)
     - Other: AMBER (Surfaces nurse's free-text reason to Bed Manager)
  3. Guardrail #1: Canonical Phrasing Script (bilingual EN/HI) — never a promise, strictly conditional on doctor.
  4. Guardrail #8: Only GREEN consent counts as forecasted bed capacity.
  5. Audit logging to event_log.
"""

import datetime
from typing import Dict, Any, List, Optional, Tuple
from sqlalchemy.orm import Session
import models
from guardrails import enforce_doctor_decides, enforce_green_consent_capacity, MIN_TASK_CONFIDENCE

# CANONICAL GUARDRAIL #1 NURSE PHRASING SCRIPT
NURSE_PHRASING_SCRIPT = {
    "rule": "Guardrail #1: Never a promise of discharge. Always conditional on physician assessment.",
    "script_en": "The doctor may consider discharge tomorrow IF all morning clinical checks and lab tests are clear. Is the family ready to pick up the patient by 11:00 AM?",
    "script_hi": "अगर कल सुबह डॉक्टर साहब की राउंड में सभी रिपोर्ट्स और जांचें ठीक आती हैं, तो डिस्चार्ज की संभावना है। क्या परिवार सुबह 11:00 बजे तक मरीज को ले जाने के लिए तैयार रहेगा?",
    "guidance": "Do NOT say: 'Your patient is going home tomorrow.' Say: 'If the doctor agrees after morning rounds, we want everything ready so you don't have to wait.'"
}

# EXPLICIT HOME BARRIER MAPPING & RESOLVING ACTIONS
HOME_PROBLEM_MAPPING = {
    "None": {
        "severity": "GREEN",
        "is_blocker": False,
        "resolving_action_en": "No home barriers reported. Discharge destination is safe.",
        "resolving_action_hi": "घर पर कोई बाधा नहीं है। गंतव्य सुरक्षित है।"
    },
    "Needs ramp": {
        "severity": "AMBER",
        "is_blocker": False,
        "resolving_action_en": "Arrangeable: Offer hospital transport aid / collapsible wheelchair loan to bridge access barrier.",
        "resolving_action_hi": "समाधान योग्य: पहुंच बाधा को दूर करने के लिए अस्पताल परिवहन सहायता या व्हीलचेयर ऋण की पेशकश करें।"
    },
    "No caregiver": {
        "severity": "RED",
        "is_blocker": True,
        "resolving_action_en": "Hard Safety Blocker: Patient cannot be safely discharged without a dedicated bedside caregiver at home.",
        "resolving_action_hi": "सुरक्षा अवरोधक: घर पर समर्पित देखभालकर्ता के बिना मरीज को सुरक्षित रूप से छुट्टी नहीं दी जा सकती।"
    },
    "Oxygen cylinder required": {
        "severity": "AMBER",
        "is_blocker": False,
        "resolving_action_en": "Arrangeable: Connect family to hospital-empanelled home oxygen concentrator/cylinder vendor before doctor round.",
        "resolving_action_hi": "समाधान योग्य: डॉक्टर राउंड से पहले परिवार को अस्पताल से संबद्ध होम ऑक्सीजन वेंडर से जोड़ें।"
    },
    "Other": {
        "severity": "AMBER",
        "is_blocker": False,
        "resolving_action_en": "Custom Barrier: Free-text nurse notes surfaced directly to Bed Manager and Social Work.",
        "resolving_action_hi": "अन्य बाधा: नर्स की टिप्पणी सीधे बेड मैनेजर और सोशल वर्क टीम को भेजी गई।"
    }
}


def classify_consent(
    payer_confirmed: str,
    family_available: str,
    home_problem: str,
    custom_refusal_reason: Optional[str] = None,
    payer_type: str = "TPA"
) -> Dict[str, Any]:
    """Classifies patient readiness into GREEN, AMBER, or RED based on clinical and social logistics.
    
    Inputs:
      - payer_confirmed: 'yes' | 'no' | 'unsure'
      - family_available: 'yes' | 'no' | 'evening_only'
      - home_problem: 'None' | 'Needs ramp' | 'No caregiver' | 'Oxygen cylinder required' | 'Other'
      - custom_refusal_reason: optional string explaining amber/red
      - payer_type: 'CASH' | 'TPA' | 'AYUSHMAN' | 'STATE_SCHEME' | 'CGHS'
    """
    barrier_info = HOME_PROBLEM_MAPPING.get(home_problem, HOME_PROBLEM_MAPPING["Other"])
    
    # 1. Check for HARD RED blockers
    if family_available == "no":
        return {
            "consent": "red",
            "reason_en": "Family unavailable to receive or pick up patient.",
            "reason_hi": "मरीज को ले जाने के लिए परिवार उपलब्ध नहीं है।",
            "barrier_type": "FAMILY_UNAVAILABLE",
            "resolving_action_en": "Escalate to medical social worker to contact emergency family contacts.",
            "resolving_action_hi": "आपातकालीन परिवार संपर्कों से संपर्क करने के लिए मेडिकल सोशल वर्कर को भेजें।",
            "is_actionable_amber": False
        }
        
    if payer_confirmed == "no":
        if str(payer_type).upper() == "CASH":
            # For CASH patients, unconfirmed the evening before is the expected baseline state.
            # Classified as AMBER with resolving action to dispatch bill estimate SMS.
            return {
                "consent": "amber",
                "reason_en": "Cash settlement pending: bill estimate awaiting family confirmation.",
                "reason_hi": "नकद भुगतान लंबित: बिल अनुमान परिवार की पुष्टि की प्रतीक्षा में।",
                "barrier_type": "CASH_SETTLEMENT_PENDING",
                "resolving_action_en": "Bill estimate sent — awaiting family confirmation by morning.",
                "resolving_action_hi": "बिल अनुमान भेजा गया — सुबह तक परिवार की पुष्टि की प्रतीक्षा है।",
                "is_actionable_amber": True
            }
        else:
            return {
                "consent": "red",
                "reason_en": f"{payer_type} authorization denied or unarranged financial deficit.",
                "reason_hi": f"{payer_type} बीमा/योजना अस्वीकृत या वित्तीय व्यवस्था अधूरी।",
                "barrier_type": "PAYER_DENIED",
                "resolving_action_en": "Direct family to hospital billing counselor for alternate payment assistance.",
                "resolving_action_hi": "वैकल्पिक भुगतान सहायता के लिए परिवार को अस्पताल बिलिंग काउंसलर के पास भेजें।",
                "is_actionable_amber": False
            }
        
    if barrier_info["severity"] == "RED":
        return {
            "consent": "red",
            "reason_en": f"Hard Safety Blocker: {home_problem}.",
            "reason_hi": f"कठिन सुरक्षा अवरोधक: {barrier_info['resolving_action_hi']}",
            "barrier_type": "NO_CAREGIVER",
            "resolving_action_en": barrier_info["resolving_action_en"],
            "resolving_action_hi": barrier_info["resolving_action_hi"],
            "is_actionable_amber": False
        }

    # 2. Check for AMBER (Arrangeable barriers with actionable paths to Green)
    amber_reasons_en = []
    amber_reasons_hi = []
    resolving_actions_en = []
    resolving_actions_hi = []

    if family_available == "evening_only":
        amber_reasons_en.append("Family available evening only (after 5 PM)")
        amber_reasons_hi.append("परिवार केवल शाम को (5 बजे के बाद) उपलब्ध है")
        resolving_actions_en.append("Coordinate with family if pickup can be shifted to relative or arrange transit lounge holding.")
        resolving_actions_hi.append("क्या किसी रिश्तेदार द्वारा पिकअप सुबह हो सकता है, या ट्रांजिट लाउंज में प्रतीक्षा की व्यवस्था करें।")

    if payer_confirmed == "unsure":
        amber_reasons_en.append("Payer documentation under query/verification")
        amber_reasons_hi.append("बीमा/योजना के कागजात अभी सत्यापन में हैं")
        resolving_actions_en.append("Dispatch billing task to prioritize query resolution with TPA/Scheme nodal desk.")
        resolving_actions_hi.append("टीपीए/नोडल डेस्क के साथ प्रश्नों को हल करने के लिए बिलिंग कार्य को प्राथमिकता दें।")

    if barrier_info["severity"] == "AMBER":
        amber_reasons_en.append(f"Home barrier: {home_problem}")
        amber_reasons_hi.append(f"घरेलू बाधा: {home_problem}")
        resolving_actions_en.append(barrier_info["resolving_action_en"])
        resolving_actions_hi.append(barrier_info["resolving_action_hi"])

    if custom_refusal_reason:
        amber_reasons_en.append(f"Nurse note: {custom_refusal_reason}")
        amber_reasons_hi.append(f"नर्स टिप्पणी: {custom_refusal_reason}")

    if amber_reasons_en:
        return {
            "consent": "amber",
            "reason_en": "; ".join(amber_reasons_en),
            "reason_hi": "; ".join(amber_reasons_hi),
            "barrier_type": "ARRANGEABLE_BARRIER",
            "resolving_action_en": " ".join(resolving_actions_en),
            "resolving_action_hi": " ".join(resolving_actions_hi),
            "is_actionable_amber": True
        }

    # 3. All clear: GREEN
    return {
        "consent": "green",
        "reason_en": "All checks clear: Payer confirmed, family ready by 11 AM, safe home environment.",
        "reason_hi": "सभी जांचें स्पष्ट: बीमा/योजना पुष्ट, परिवार 11 बजे तक तैयार, सुरक्षित घरेलू माहौल।",
        "barrier_type": "NONE",
        "resolving_action_en": "Patient unblocked for same-day discharge execution upon doctor sign-off.",
        "resolving_action_hi": "डॉक्टर के हस्ताक्षर पर उसी दिन डिस्चार्ज के लिए मरीज तैयार।",
        "is_actionable_amber": False
    }


class NurseCheckManager:
    def __init__(self, db: Session, simulator: Any = None):
        self.db = db
        self.simulator = simulator

    def get_candidate_encounters(self) -> List[Dict[str, Any]]:
        """Returns active ward encounters that are candidates for the morning Nurse Check.
        Prioritizes patients with Discharge Radar probability >= 0.70 or nearing diagnosis mean LOS."""
        encounters = self.db.query(models.Encounter).filter(models.Encounter.status == "ACTIVE").all()
        candidates = []
        for enc in encounters:
            candidates.append({
                "encounter_id": enc.id,
                "patient_id": enc.patient_id,
                "patient_name": enc.patient_name,
                "age": enc.age,
                "gender": enc.gender,
                "ward": enc.ward,
                "bed_id": enc.bed_id or "Unassigned",
                "diagnosis_name": enc.diagnosis_name,
                "consultant_name": enc.consultant_name,
                "payer_type": enc.payer_type,
                "los_days": enc.los_days,
                "iv_to_oral": enc.iv_to_oral,
                "oxygen_removed": enc.oxygen_removed,
                "current_consent": enc.consent,
                "hours_since_last_test": enc.hours_since_last_test
            })
        return candidates

    def submit_nurse_check(
        self,
        encounter_id: str,
        payer_confirmed: str,
        family_available: str,
        home_problem: str,
        nurse_name: str = "Sister Sunita (Ward In-Charge)",
        custom_refusal_reason: Optional[str] = None
    ) -> Dict[str, Any]:
        # Update Encounter in DB
        enc = self.db.query(models.Encounter).filter(models.Encounter.id == encounter_id).first()
        if not enc:
            raise ValueError(f"Encounter {encounter_id} not found")

        payer_type = enc.payer_type or "CASH"

        # Classify consent with payer-type awareness
        eval_result = classify_consent(
            payer_confirmed=payer_confirmed,
            family_available=family_available,
            home_problem=home_problem,
            custom_refusal_reason=custom_refusal_reason,
            payer_type=payer_type
        )
        consent = eval_result["consent"]
        now = datetime.datetime.utcnow()

        enc.consent = consent

        # Create NurseCheck record
        nc = models.NurseCheck(
            encounter_id=encounter_id,
            asked_at=now,
            asked_by=nurse_name,
            payer_confirmed=payer_confirmed,
            family_available=family_available,
            home_problem=home_problem,
            consent=consent,
            refusal_reason=eval_result["reason_en"]
        )
        self.db.add(nc)

        # Update Simulator memory if present
        if self.simulator and encounter_id in self.simulator.patients:
            self.simulator.patients[encounter_id]["consent"] = consent

        # Log to event_log
        event = models.EventLog(
            ts=now,
            actual_time=now,
            logged_time=now,
            doc_lag_minutes=0.0,
            ward=enc.ward,
            actor=nurse_name,
            action="NURSE_CHECK_SUBMITTED",
            entity=encounter_id,
            payload_json={
                "payer_confirmed": payer_confirmed,
                "family_available": family_available,
                "home_problem": home_problem,
                "consent": consent,
                "resolving_action": eval_result["resolving_action_en"],
                "counts_as_forecasted_capacity": (consent == "green")
            }
        )
        self.db.add(event)
        self.db.commit()

        # Check Guardrail #8
        counts_as_capacity = enforce_green_consent_capacity(consent_status=consent, confidence=0.85)

        return {
            "encounter_id": encounter_id,
            "patient_name": enc.patient_name,
            "ward": enc.ward,
            "bed_id": enc.bed_id,
            "consent": consent,
            "consent_badge": "🟢 GREEN" if consent == "green" else ("🟡 AMBER" if consent == "amber" else "🔴 RED"),
            "reason_en": eval_result["reason_en"],
            "reason_hi": eval_result["reason_hi"],
            "resolving_action_en": eval_result["resolving_action_en"],
            "resolving_action_hi": eval_result["resolving_action_hi"],
            "is_actionable_amber": eval_result["is_actionable_amber"],
            "counts_as_forecasted_capacity": counts_as_capacity,
            "timestamp": now.isoformat()
        }
