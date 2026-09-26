"""SwasthFlow AI — Bill Estimator Module (Phase 7 / Feature F6).
Implements:
  1. Accrued charges + projected remaining stay calculation for CASH patients.
  2. Range calculation (+/- 10%, rounded to nearest ₹1,000, never a single point number).
  3. Guardrail #6 enforcement: mandatory 'estimate' and 'not the final bill' disclaimer.
  4. Bilingual family SMS generation (English + Hindi) dispatched the evening before.
  5. Payer-aware Nurse Check feedback loop: confirms cash funds, transitions consent
     from AMBER to GREEN, unlocking forecasted bed capacity per Guardrail #8.
  6. Audit logging to event_log with dual timestamps.
"""

import datetime
from typing import Dict, Any, List, Optional, Tuple
from sqlalchemy.orm import Session

import models
from guardrails import (
    BILL_ESTIMATE_UNCERTAINTY,
    enforce_financial_estimate_disclaimer,
    enforce_green_consent_capacity,
    MIN_TASK_CONFIDENCE
)

# DAILY TARIFF BENCHMARKS BY WARD & DIAGNOSIS
WARD_DAILY_RATES = {
    "WARD_A": 2500.0,   # General Medical
    "WARD_B": 3000.0,   # Surgical post-op
    "ICU": 12000.0      # Intensive Care Unit
}

CONSULTANT_ROUND_RATE_DAILY = 1200.0
NURSING_CARE_RATE_DAILY = 800.0
FINAL_DISCHARGE_PACK_FEE = 1500.0  # Discharge summary, take-home meds pack

DIAGNOSIS_ACCRUED_BENCHMARKS = {
    "A90": {"diagnostics": 4500.0, "pharmacy": 3500.0},      # Dengue
    "S72.0": {"diagnostics": 8500.0, "pharmacy": 9500.0},    # Femur fracture post-op
    "J18.9": {"diagnostics": 5200.0, "pharmacy": 4200.0},    # Community-acquired pneumonia
    "I21.9": {"diagnostics": 14000.0, "pharmacy": 12000.0},  # Post-NSTEMI / Cardiology
    "Z98.89": {"diagnostics": 16000.0, "pharmacy": 18000.0}  # Post-Major Abdominal Surgery (ICU)
}


class BillEstimator:
    def __init__(self, db: Session, simulator: Any = None):
        self.db = db
        self.simulator = simulator

    def _get_simulated_time(self) -> datetime.datetime:
        if self.simulator and hasattr(self.simulator, "current_time"):
            return self.simulator.current_time
        return datetime.datetime.utcnow()

    def _get_ward_doc_lag(self, ward: str) -> float:
        lags = {"ICU": 10.0, "WARD_A": 22.0, "WARD_B": 68.0}
        return lags.get(ward, 30.0)

    def calculate_estimate(self, encounter_id: str) -> Dict[str, Any]:
        """Calculates an itemized bill estimate and projected range for a CASH patient.
        Enforces Guardrail #6 (+/- 10% range, rounded to nearest ₹1,000, never a single point number).
        """
        enc = self.db.query(models.Encounter).filter(models.Encounter.id == encounter_id).first()
        if not enc:
            raise ValueError(f"Encounter {encounter_id} not found.")

        ward = enc.ward or "WARD_A"
        los = max(enc.los_days or 1.0, 0.5)
        room_daily = WARD_DAILY_RATES.get(ward, 2500.0)

        # 1. Accrued Charges Calculation
        room_charges = round(room_daily * los, 2)
        doctor_charges = round(CONSULTANT_ROUND_RATE_DAILY * los, 2)
        nursing_charges = round(NURSING_CARE_RATE_DAILY * los, 2)

        diag_bench = DIAGNOSIS_ACCRUED_BENCHMARKS.get(
            enc.diagnosis_code,
            {"diagnostics": 4000.0, "pharmacy": 3500.0}
        )
        diag_fee = round(diag_bench["diagnostics"] * (1.0 + (los - 1.0) * 0.15), 2)
        pharmacy_fee = round(diag_bench["pharmacy"] * (1.0 + (los - 1.0) * 0.20), 2)

        accrued_total = round(
            room_charges + doctor_charges + nursing_charges + diag_fee + pharmacy_fee,
            2
        )

        # 2. Projected Remaining Charges (for next morning discharge ~11:00 AM)
        remaining_stay_days = 1.0
        remaining_room = round(room_daily * remaining_stay_days, 2)
        remaining_doctor = round(CONSULTANT_ROUND_RATE_DAILY * remaining_stay_days, 2)
        remaining_nursing = round(NURSING_CARE_RATE_DAILY * remaining_stay_days, 2)
        remaining_misc = FINAL_DISCHARGE_PACK_FEE

        projected_remaining_total = round(
            remaining_room + remaining_doctor + remaining_nursing + remaining_misc,
            2
        )

        # 3. Midpoint Projected Total
        projected_mid = accrued_total + projected_remaining_total

        # 4. Guardrail #6: Uncertainty Range (+/- 10%, rounded to nearest ₹1,000)
        # NEVER a single point estimate
        uncertainty = BILL_ESTIMATE_UNCERTAINTY # 0.10
        raw_low = projected_mid * (1.0 - uncertainty)
        raw_high = projected_mid * (1.0 + uncertainty)

        # Round to nearest ₹1,000
        projected_low = float(round(raw_low / 1000.0) * 1000)
        projected_high = float(round(raw_high / 1000.0) * 1000)
        out_of_pocket = projected_high

        # 5. Mandatory Guardrail #6 Disclaimer
        disclaimer_en = (
            "This is an estimate, not the final bill. Final billing is subject to "
            "morning physician round discharge orders and any additional pharmacy or lab requirements."
        )
        disclaimer_hi = (
            "यह एक अनुमान है, अंतिम बिल नहीं। अंतिम बिल सुबह के डॉक्टर राउंड और "
            "अतिरिक्त दवाइयों अथवा जांचों के अधीन है।"
        )
        # Programmatic verification of Guardrail #6
        enforce_financial_estimate_disclaimer(disclaimer_en)

        # 6. Bilingual Family SMS Text
        pt_name = enc.patient_name
        bed_id = enc.bed_id or "Unassigned"
        sms_text_en = (
            f"SwasthFlow Health Alert: For patient {pt_name} ({bed_id}), likely discharge window is "
            f"tomorrow ~11:00 AM (pending morning doctor rounds). Projected settlement estimate: "
            f"₹{int(projected_low):,} – ₹{int(projected_high):,}. This is an estimate, not the final bill. "
            f"Payment modes: UPI, Debit/Credit Cards, or Cash at Billing Counter A. "
            f"We share this early so you can arrange funds comfortably."
        )
        sms_text_hi = (
            f"स्वास्थ्यफ्लो सूचना: मरीज {pt_name} ({bed_id}) के लिए कल सुबह ~11:00 बजे डिस्चार्ज की संभावना है "
            f"(सुबह डॉक्टर राउंड के अधीन)। अनुमानित बिल: ₹{int(projected_low):,} – ₹{int(projected_high):,}। "
            f"यह एक अनुमान है, अंतिम बिल नहीं। भुगतान मोड: UPI, कार्ड या काउंटर पर नकद। "
            f"यह अग्रिम जानकारी इसलिए दी गई है ताकि आप सुविधापूर्वक धनराशि व्यवस्थित कर सकें।"
        )

        breakdown = {
            "room_and_bed": room_charges,
            "physician_consultations": doctor_charges,
            "nursing_and_care": nursing_charges,
            "diagnostics_and_lab": diag_fee,
            "pharmacy_and_consumables": pharmacy_fee,
            "accrued_total": accrued_total,
            "projected_remaining_room": remaining_room,
            "projected_remaining_clinical": remaining_doctor + remaining_nursing,
            "projected_discharge_pack": remaining_misc,
            "projected_remaining_total": projected_remaining_total,
            "projected_mid": projected_mid,
            "uncertainty_percent": int(uncertainty * 100),
            "projected_low": projected_low,
            "projected_high": projected_high,
            "disclaimer_en": disclaimer_en,
            "disclaimer_hi": disclaimer_hi
        }

        # Check existing BillEstimate record or prepare new one
        existing = self.db.query(models.BillEstimate).filter(
            models.BillEstimate.encounter_id == encounter_id
        ).first()

        now = self._get_simulated_time()
        if existing:
            existing.accrued_amount = accrued_total
            existing.projected_low = projected_low
            existing.projected_high = projected_high
            existing.out_of_pocket = out_of_pocket
            existing.breakdown_json = breakdown
            existing.sms_text_en = sms_text_en
            existing.sms_text_hi = sms_text_hi
            existing.computed_at = now
            self.db.commit()
            record_id = existing.id
            status = existing.status or "ESTIMATED"
            sent_at = existing.sent_at
            phone = existing.family_phone or "+91 98765 43210"
        else:
            new_est = models.BillEstimate(
                encounter_id=encounter_id,
                accrued_amount=accrued_total,
                projected_low=projected_low,
                projected_high=projected_high,
                out_of_pocket=out_of_pocket,
                breakdown_json=breakdown,
                sms_text_en=sms_text_en,
                sms_text_hi=sms_text_hi,
                family_phone="+91 98765 43210",
                status="ESTIMATED",
                computed_at=now
            )
            self.db.add(new_est)
            self.db.commit()
            record_id = new_est.id
            status = "ESTIMATED"
            sent_at = None
            phone = "+91 98765 43210"

        return {
            "estimate_id": record_id,
            "encounter_id": encounter_id,
            "patient_name": enc.patient_name,
            "bed_id": bed_id,
            "ward": ward,
            "diagnosis_name": enc.diagnosis_name,
            "payer_type": enc.payer_type,
            "los_days": los,
            "status": status,
            "sent_at": sent_at.isoformat() if sent_at else None,
            "family_phone": phone,
            "accrued_amount": accrued_total,
            "projected_low": projected_low,
            "projected_high": projected_high,
            "out_of_pocket": out_of_pocket,
            "breakdown": breakdown,
            "disclaimer": disclaimer_en,
            "sms_text_en": sms_text_en,
            "sms_text_hi": sms_text_hi
        }

    def get_cash_candidates(self) -> List[Dict[str, Any]]:
        """Returns all active CASH patients with current bill estimate statuses."""
        encounters = self.db.query(models.Encounter).filter(
            models.Encounter.status == "ACTIVE",
            models.Encounter.payer_type == "CASH"
        ).all()

        candidates = []
        for enc in encounters:
            est = self.db.query(models.BillEstimate).filter(
                models.BillEstimate.encounter_id == enc.id
            ).first()

            candidates.append({
                "encounter_id": enc.id,
                "patient_id": enc.patient_id,
                "patient_name": enc.patient_name,
                "ward": enc.ward,
                "bed_id": enc.bed_id or "Unassigned",
                "diagnosis_name": enc.diagnosis_name,
                "consultant_name": enc.consultant_name,
                "los_days": enc.los_days,
                "p_discharge": enc.p_discharge or 0.0,
                "consent": enc.consent,
                "estimate_status": est.status if est else "PENDING",
                "projected_low": est.projected_low if est else None,
                "projected_high": est.projected_high if est else None,
                "sms_sent_at": est.sent_at.isoformat() if (est and est.sent_at) else None,
                "family_phone": est.family_phone if est else "+91 98765 43210"
            })
        return candidates

    def send_bill_estimate_sms(self, encounter_id: str, family_phone: str = "+91 98765 43210") -> Dict[str, Any]:
        """Dispatches projected bill estimate range SMS to patient's family the evening before.
        Records dispatch in bill_estimate table and appends to event_log with dual timestamps.
        """
        enc = self.db.query(models.Encounter).filter(models.Encounter.id == encounter_id).first()
        if not enc:
            raise ValueError(f"Encounter {encounter_id} not found.")

        # Ensure estimate is computed
        est_data = self.calculate_estimate(encounter_id)
        now = self._get_simulated_time()
        doc_lag = self._get_ward_doc_lag(enc.ward or "WARD_A")
        logged_time = now + datetime.timedelta(minutes=doc_lag)

        # Update bill_estimate record
        est = self.db.query(models.BillEstimate).filter(models.BillEstimate.encounter_id == encounter_id).first()
        if est:
            est.status = "SMS_SENT"
            est.sent_at = now
            est.family_phone = family_phone
            self.db.commit()

        # Log event into append-only event_log
        event = models.EventLog(
            action="BILL_ESTIMATE_SMS_SENT",
            ward=enc.ward or "WARD_A",
            actor="Billing Counselor",
            entity=encounter_id,
            actual_time=now,
            logged_time=logged_time,
            doc_lag_minutes=doc_lag,
            payload_json={
                "encounter_id": encounter_id,
                "patient_name": enc.patient_name,
                "bed_id": enc.bed_id or "Unassigned",
                "family_phone": family_phone,
                "projected_low": est_data["projected_low"],
                "projected_high": est_data["projected_high"],
                "sms_text_en": est_data["sms_text_en"],
                "sms_text_hi": est_data["sms_text_hi"]
            }
        )
        self.db.add(event)
        self.db.commit()

        return {
            "success": True,
            "encounter_id": encounter_id,
            "patient_name": enc.patient_name,
            "status": "SMS_SENT",
            "sent_at": now.isoformat(),
            "family_phone": family_phone,
            "projected_range": f"₹{int(est_data['projected_low']):,} – ₹{int(est_data['projected_high']):,}",
            "sms_en": est_data["sms_text_en"],
            "sms_hi": est_data["sms_text_hi"],
            "message": "Bill estimate SMS successfully dispatched to family."
        }

    def confirm_family_funds(self, encounter_id: str) -> Dict[str, Any]:
        """Frontline feedback: Family confirms funds/UPI are arranged.
        Transitions payer_confirmed to 'yes', re-evaluates nurse check from AMBER -> GREEN,
        and unlocks forecasted bed capacity per Guardrail #8.
        """
        enc = self.db.query(models.Encounter).filter(models.Encounter.id == encounter_id).first()
        if not enc:
            raise ValueError(f"Encounter {encounter_id} not found.")

        now = self._get_simulated_time()
        doc_lag = self._get_ward_doc_lag(enc.ward or "WARD_A")
        logged_time = now + datetime.timedelta(minutes=doc_lag)

        # Update bill estimate status
        est = self.db.query(models.BillEstimate).filter(models.BillEstimate.encounter_id == encounter_id).first()
        if est:
            est.status = "CONFIRMED"

        # Update latest NurseCheck record if present
        nc = self.db.query(models.NurseCheck).filter(
            models.NurseCheck.encounter_id == encounter_id
        ).order_by(models.NurseCheck.asked_at.desc()).first()

        prev_consent = enc.consent or "amber"
        if nc:
            nc.payer_confirmed = "yes"
            # If the barrier was cash settlement pending, clear it on funds confirmation
            if nc.refusal_reason and "cash settlement" in nc.refusal_reason.lower():
                nc.refusal_reason = None

            # Re-evaluate consent with updated payer confirmation
            from nurse_check import classify_consent
            new_eval = classify_consent(
                payer_confirmed="yes",
                family_available=nc.family_available,
                home_problem=nc.home_problem,
                custom_refusal_reason=nc.refusal_reason,
                payer_type=enc.payer_type or "CASH"
            )
            nc.consent = new_eval["consent"]
            enc.consent = new_eval["consent"]
            new_consent = new_eval["consent"]
        else:
            enc.consent = "green"
            new_consent = "green"

        # Check if patient now qualifies as forecasted capacity (Guardrail #8)
        conf = enc.p_discharge or 0.85
        counts_as_capacity = enforce_green_consent_capacity(new_consent, conf)

        # Log confirmation to event_log
        event = models.EventLog(
            action="CASH_FUNDS_CONFIRMED",
            ward=enc.ward or "WARD_A",
            actor="Family Financial Counselor",
            entity=encounter_id,
            actual_time=now,
            logged_time=logged_time,
            doc_lag_minutes=doc_lag,
            payload_json={
                "encounter_id": encounter_id,
                "patient_name": enc.patient_name,
                "prev_consent": prev_consent,
                "new_consent": new_consent,
                "counts_as_capacity": counts_as_capacity
            }
        )
        self.db.add(event)
        self.db.commit()

        return {
            "success": True,
            "encounter_id": encounter_id,
            "patient_name": enc.patient_name,
            "status": "CONFIRMED",
            "previous_consent": prev_consent,
            "new_consent": new_consent,
            "counts_as_forecasted_capacity": counts_as_capacity,
            "message": f"Family funds confirmed. Consent transitioned to {new_consent.upper()}."
        }
