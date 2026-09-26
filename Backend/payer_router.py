import datetime
from typing import Dict, Any, Optional
import models

from guardrails import MIN_TASK_CONFIDENCE

def generate_payer_billing_task(
    encounter: models.Encounter,
    p_discharge: float,
    reasons: list,
    p90_duration_min: float,
    current_time: datetime.datetime
) -> Optional[models.Task]:
    """Routes billing and clearance tasks with payer-specific workflows, enforcing:
    1. Mandatory WHO and WHY.
    2. Minimum confidence >= 0.70 (Guardrail #4).
    3. P90 planning budget (Guardrail #3)."""
    
    if p_discharge < MIN_TASK_CONFIDENCE:
        # GUARDRAIL #4: Suppress any task below 70% confidence floor
        return None

    payer = encounter.payer_type
    enc_id = encounter.id
    pt_name = encounter.patient_name
    ward = encounter.ward
    bed = encounter.bed_id or "Unassigned"
    reasons_summary = "; ".join(reasons[:2])

    deadline = current_time + datetime.timedelta(minutes=p90_duration_min)
    task_id = f"TSK-BILL-{enc_id}"
    lead_hours = round(p90_duration_min / 60.0, 1)
    lead_hours_str = f"{lead_hours:.1f}".rstrip('0').rstrip('.')

    if payer == "TPA":
        return models.Task(
            id=task_id,
            role="BILLING",
            ward=ward,
            title_en=f"Submit TPA Pre-Authorization for {pt_name} ({bed})",
            title_hi=f"{pt_name} ({bed}) के लिए TPA प्री-ऑथराइज़ेशन जमा करें",
            reason_en=f"Discharge Radar predicted {int(p_discharge*100)}% chance of discharge within {lead_hours_str}h ({reasons_summary}). TPA authorization p90 lead time requires {lead_hours_str}h advance packet submission.",
            reason_hi=f"डिस्चार्ज रडार ने {lead_hours_str} घंटे में डिस्चार्ज की {int(p_discharge*100)}% संभावना दिखाई है ({reasons_summary})। TPA क्लीयरेंस के लिए {lead_hours_str} घंटे पहले दस्तावेज़ जमा करना आवश्यक है।",
            deadline=deadline,
            confidence=p_discharge,
            channel="WHATSAPP",
            sent_at=current_time
        )
    elif payer == "AYUSHMAN":
        return models.Task(
            id=task_id,
            role="BILLING",
            ward=ward,
            title_en=f"Upload PM-JAY TMS Portal Discharge Pre-Clearance: {pt_name} ({bed})",
            title_hi=f"PM-JAY TMS पोर्टल डिस्चार्ज दस्तावेज़ अपलोड करें: {pt_name} ({bed})",
            reason_en=f"Discharge Radar flagged patient {int(p_discharge*100)}% likely to discharge within {lead_hours_str}h ({reasons_summary}). Ayushman Bharat state portal approvals take learned p90={lead_hours_str}h; early submission prevents bed blocking.",
            reason_hi=f"डिस्चार्ज रडार ने {lead_hours_str} घंटे में डिस्चार्ज की {int(p_discharge*100)}% संभावना पाई है ({reasons_summary})। आयुष्मान पोर्टल स्वीकृति में {lead_hours_str} घंटे लगते हैं; समय पर शुरू करने से देरी बचेगी।",
            deadline=deadline,
            confidence=p_discharge,
            channel="WHATSAPP",
            sent_at=current_time
        )
    elif payer in ["CGHS", "STATE_SCHEME"]:
        return models.Task(
            id=task_id,
            role="BILLING",
            ward=ward,
            title_en=f"Process Govt Scheme Referral & Treasury Form: {pt_name} ({bed})",
            title_hi=f"सरकारी योजना फॉर्म और काउंटर-हस्ताक्षर तैयार करें: {pt_name} ({bed})",
            reason_en=f"Discharge Radar identified {int(p_discharge*100)}% discharge readiness within {lead_hours_str}h ({reasons_summary}). Govt health schemes require learned p90={lead_hours_str}h departmental countersignature.",
            reason_hi=f"डिस्चार्ज रडार ने {lead_hours_str} घंटे में {int(p_discharge*100)}% डिस्चार्ज की संभावना पाई है ({reasons_summary})। सरकारी योजनाओं में {lead_hours_str} घंटे का समय लगता है।",
            deadline=deadline,
            confidence=p_discharge,
            channel="WHATSAPP",
            sent_at=current_time
        )
    else: # CASH
        return models.Task(
            id=task_id,
            role="BILLING",
            ward=ward,
            title_en=f"Compute Projected Bill Estimate Range for Cash Patient: {pt_name} ({bed})",
            title_hi=f"कैश मरीज़ के लिए अनुमानित बिल रेंज तैयार करें: {pt_name} ({bed})",
            reason_en=f"Self-pay patient predicted {int(p_discharge*100)}% ready within {lead_hours_str}h ({reasons_summary}). Learned p90 cash arrangement delay is {lead_hours_str}h; sending estimate SMS gives family all night to arrange funds.",
            reason_hi=f"कैश मरीज़ {lead_hours_str} घंटे में तैयार होने की {int(p_discharge*100)}% संभावना है ({reasons_summary})। परिवार को पैसे जुटाने के लिए {lead_hours_str} घंटे का समय देने हेतु अनुमानित बिल SMS भेजें।",
            deadline=deadline,
            confidence=p_discharge,
            channel="WHATSAPP",
            sent_at=current_time
        )
