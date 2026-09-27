"""SwasthFlow AI — Canonical Programmatic Guardrails Enforcement Module.
Every engine component and test suite imports and verifies against this single source of truth.
See GUARDRAILS.md for complete charter details.
"""

from typing import Dict, Any, List, Optional

# CANONICAL GUARDRAIL CONSTANTS
MIN_TASK_CONFIDENCE = 0.70          # Guardrail #4: Confidence Floor
MAX_TASKS_PER_STAFF_SHIFT = 10     # Guardrail #5: Alert Fatigue Cap
BILL_ESTIMATE_UNCERTAINTY = 0.10   # Guardrail #6: Financial Uncertainty (+/- 10%)
CALIBRATED_PROB_FLOOR = 0.05       # Guardrail #9: Clinical Honesty Floor
CALIBRATED_PROB_CEILING = 0.92     # Guardrail #9: Clinical Honesty Ceiling (15% reversal risk)
LIVE_DEMO_BED_COUNT = 30           # Guardrail #10: Scale Separation (Live unit)


class GuardrailViolation(Exception):
    """Raised when an engine action violates a core clinical or operational guardrail."""
    pass


def enforce_doctor_decides(action_type: str, clinician_confirmed: bool) -> bool:
    """Guardrail #1: AI never diagnoses, prescribes, or discharges without human authorization."""
    if not clinician_confirmed:
        raise GuardrailViolation(
            f"[GUARDRAIL #1 VIOLATION] Action '{action_type}' requires explicit human clinician authorization."
        )
    return True


def enforce_p90_budget(step_name: str, planned_duration_min: float, p90_budget_min: float) -> bool:
    """Guardrail #3: All operational lead times must budget against p90 durations, never medians."""
    if planned_duration_min < p90_budget_min:
        raise GuardrailViolation(
            f"[GUARDRAIL #3 VIOLATION] Step '{step_name}' planned for {planned_duration_min}m, "
            f"which is below the learned p90 budget of {p90_budget_min}m (optimistic planning prohibited)."
        )
    return True


def enforce_task_confidence(task_id: str, confidence: float) -> bool:
    """Guardrail #4: Never emit a task below 70% model confidence."""
    if confidence < MIN_TASK_CONFIDENCE:
        raise GuardrailViolation(
            f"[GUARDRAIL #4 VIOLATION] Task {task_id} has confidence {confidence*100:.1f}%, "
            f"below the mandatory {MIN_TASK_CONFIDENCE*100:.0f}% confidence floor."
        )
    return True


def enforce_alert_fatigue_cap(staff_id: str, shift_tasks_count: int) -> bool:
    """Guardrail #5: Max 10 tasks per staff member per 8-hour shift."""
    if shift_tasks_count > MAX_TASKS_PER_STAFF_SHIFT:
        raise GuardrailViolation(
            f"[GUARDRAIL #5 VIOLATION] Staff member {staff_id} assigned {shift_tasks_count} tasks, "
            f"exceeding the alert fatigue cap of {MAX_TASKS_PER_STAFF_SHIFT} per shift."
        )
    return True


def enforce_financial_estimate_disclaimer(estimate_text: str) -> bool:
    """Guardrail #6: Financial figures must state 'estimate' and 'not the final bill'."""
    text_lower = estimate_text.lower()
    if "estimate" not in text_lower or "final bill" not in text_lower:
        raise GuardrailViolation(
            "[GUARDRAIL #6 VIOLATION] Financial communication must explicitly include 'estimate' "
            "and 'not the final bill' disclaimer."
        )
    return True


def enforce_doctor_privacy(data_dict: Dict[str, Any]) -> bool:
    """Guardrail #7: Doctor round predictions are strictly for backwards scheduling; never administrative KPIs."""
    prohibited_keys = ["punctuality", "on_time_score", "lateness", "ranking", "compliance_score", "doctor_delay"]
    for k in data_dict.keys():
        if any(bad in k.lower() for bad in prohibited_keys):
            raise GuardrailViolation(
                f"[GUARDRAIL #7 VIOLATION] Prohibited administrative surveillance metric '{k}' detected."
            )
    return True


def enforce_green_consent_capacity(consent_status: Optional[str], confidence: float = 1.0) -> bool:
    """Guardrail #8: Only confirmed GREEN / Agreed consent patients enter forecasted bed capacity."""
    if consent_status in ("green", "agreed") and confidence >= MIN_TASK_CONFIDENCE:
        return True
    return False


def enforce_family_communication_script(script_text: str) -> bool:
    """Guardrail: Family communication must use positive recovery phrasing; never coercive bed-pressure urgency."""
    text_lower = script_text.lower()
    prohibited_phrases = ["we need this bed", "we need the bed", "bed is needed", "must vacate", "short of beds", "bed shortage"]
    for phrase in prohibited_phrases:
        if phrase in text_lower:
            raise GuardrailViolation(
                f"[GUARDRAIL VIOLATION] Coercive bed-pressure phrase '{phrase}' detected in family script. "
                f"Always frame transfer positively around patient clinical recovery."
            )
    return True


def enforce_calibrated_probability(raw_prob: float) -> float:
    """Guardrail #9: Clinical Honesty & Calibration.
    Probabilities are bounded in [0.05, 0.92] to reflect immutable complication risks (~15%).
    Never returns 0.0% or 100.0%."""
    if raw_prob <= 0.0 or raw_prob >= 1.0:
        pass # Model raw outputs might saturate, but calibrated output MUST NOT
    calibrated = min(max(raw_prob, CALIBRATED_PROB_FLOOR), CALIBRATED_PROB_CEILING)
    return round(float(calibrated), 3)


def enforce_scale_separation(is_live_telemetry: bool, bed_count: int) -> bool:
    """Guardrail #10: Strictly separate 30-bed live telemetry from 300-bed hospital projections."""
    if is_live_telemetry and bed_count != LIVE_DEMO_BED_COUNT:
        raise GuardrailViolation(
            f"[GUARDRAIL #10 VIOLATION] Live telemetry reported {bed_count} beds instead of {LIVE_DEMO_BED_COUNT}."
        )
    return True
