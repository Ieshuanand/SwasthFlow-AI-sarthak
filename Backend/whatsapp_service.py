"""SwasthFlow AI — WhatsApp Task Delivery & Feedback Service (Phase 6).
Simulates realistic frontline WhatsApp delivery with:
  1. Bilingual Task Cards (English + Hindi) with mandatory backward-math WHY reasons.
  2. Direct offline TTS voice note integration for each task.
  3. Interactive feedback loop: [✅ Done / पूरा हुआ] and [❌ Can't / संभव नहीं].
  4. Structured failure reason logging into append-only event_log.
  5. Downstream state transitions (e.g. Bed CLEANING Done -> Bed READY).
"""

import os
import datetime
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session
import models
from tts_engine import synthesize_task_audio

# CANONICAL STAFF ROSTER MAPPING FOR WHATSAPP DISPATCH
STAFF_ROSTER = {
    "PHLEBOTOMY": [
        {"name": "Sunita Kumari", "phone": "+91 98765 11001", "role": "Senior Phlebotomist", "shift": "06:00 - 14:00"},
        {"name": "Manoj Verma", "phone": "+91 98765 11002", "role": "Ward Phlebotomist", "shift": "06:00 - 14:00"},
        {"name": "Amit Roy", "phone": "+91 98765 11003", "role": "ICU Phlebotomist", "shift": "06:00 - 14:00"}
    ],
    "BILLING": [
        {"name": "Ramesh Tiwari", "phone": "+91 98765 22001", "role": "TPA / Scheme Desk Lead", "shift": "07:00 - 15:00"},
        {"name": "Priya Sharma", "phone": "+91 98765 22002", "role": "Ayushman PM-JAY Executive", "shift": "07:00 - 15:00"}
    ],
    "HOUSEKEEPING": [
        {"name": "Anand Rao", "phone": "+91 98765 33001", "role": "Ward Sanitization Lead", "shift": "06:00 - 14:00"},
        {"name": "Deepa Murmu", "phone": "+91 98765 33002", "role": "Bed Turnover Specialist", "shift": "06:00 - 14:00"}
    ],
    "CLEANING": [
        {"name": "Anand Rao", "phone": "+91 98765 33001", "role": "Ward Sanitization Lead", "shift": "06:00 - 14:00"},
        {"name": "Deepa Murmu", "phone": "+91 98765 33002", "role": "Bed Turnover Specialist", "shift": "06:00 - 14:00"}
    ],
    "PORTER": [
        {"name": "Suresh Gawli", "phone": "+91 98765 44001", "role": "Lead Patient Porter", "shift": "06:00 - 14:00"},
        {"name": "Rajesh Kumar", "phone": "+91 98765 44002", "role": "Ward Porter", "shift": "06:00 - 14:00"}
    ]
}


class WhatsAppService:
    def __init__(self, db: Session, simulator: Any = None):
        self.db = db
        self.simulator = simulator

    def seed_tasks_if_empty(self):
        """Seeds realistic frontline tasks if Task table is empty."""
        count = self.db.query(models.Task).count()
        if count > 0:
            return

        active_encs = self.db.query(models.Encounter).filter(models.Encounter.status == "ACTIVE").all()
        now = datetime.datetime.utcnow()
        today = now.date()

        tasks_to_add = []
        for i, enc in enumerate(active_encs[:6]):
            # 1. Phlebotomy morning draw
            phleb_time = datetime.datetime.combine(today, datetime.time(6, 30 + (i * 12) % 60))
            t1 = models.Task(
                id=f"TSK-PHLEB-{enc.id}",
                role="PHLEBOTOMY",
                ward=enc.ward,
                title_en=f"Morning Blood Draw: {enc.patient_name} ({enc.bed_id})",
                title_hi=f"सुबह का ब्लड टेस्ट: {enc.patient_name} ({enc.bed_id})",
                reason_en=f"Report needed before {enc.consultant_name} round. Fasting draw before 08:00 AM.",
                reason_hi=f"{enc.consultant_name} के राउंड से पहले रिपोर्ट तैयार करने हेतु नाश्ते से पहले खाली पेट ब्लड टेस्ट।",
                deadline=phleb_time,
                confidence=0.88,
                sent_at=now,
                channel="WHATSAPP"
            )
            tasks_to_add.append(t1)

            # 2. Billing clearance task
            if enc.payer_type in ["AYUSHMAN", "TPA", "STATE_SCHEME"] and i < 3:
                bill_time = phleb_time + datetime.timedelta(hours=2)
                t2 = models.Task(
                    id=f"TSK-BILL-{enc.id}",
                    role="BILLING",
                    ward=enc.ward,
                    title_en=f"Payer Pre-Clearance: {enc.patient_name} ({enc.payer_type})",
                    title_hi=f"बीमा/योजना प्री-क्लीयरेंस: {enc.patient_name} ({enc.payer_type})",
                    reason_en=f"Discharge Radar predicted high discharge probability. Submit pre-clearance 6-24h in advance.",
                    reason_hi=f"डिस्चार्ज रडार ने उच्च संभावना दिखाई है। विलंब से बचने के लिए समय से पहले दस्तावेज जमा करें।",
                    deadline=bill_time,
                    confidence=0.82,
                    sent_at=now,
                    channel="WHATSAPP"
                )
                tasks_to_add.append(t2)

        # 3. Housekeeping bed cleaning task
        dirty_beds = self.db.query(models.Bed).filter(models.Bed.state == "DIRTY").all()
        target_bed = dirty_beds[0].id if dirty_beds else "WARD_B-02"
        t3 = models.Task(
            id=f"TSK-CLEAN-{target_bed}",
            role="HOUSEKEEPING",
            ward="WARD_B",
            title_en=f"Turnover & Sanitize Bed: ({target_bed})",
            title_hi=f"बेड की सफाई और सैनिटाइजेशन: ({target_bed})",
            reason_en="Bed vacated after discharge. Deep sanitization needed for incoming admission by 11:00 AM.",
            reason_hi="डिस्चार्ज के बाद बेड खाली हुआ। सुबह 11:00 बजे नए मरीज के दाखिले के लिए सैनिटाइजेशन जरूरी है।",
            deadline=now + datetime.timedelta(minutes=45),
            confidence=0.95,
            sent_at=now,
            channel="WHATSAPP"
        )
        tasks_to_add.append(t3)

        # 4. Porter wheelchair transfer
        t4 = models.Task(
            id="TSK-PORT-01",
            role="PORTER",
            ward="ICU",
            title_en="Patient Wheelchair Escort: ICU Step-Down to WARD_A",
            title_hi="मरीज व्हीलचेयर स्थानांतरण: आईसीयू से वार्ड ए",
            reason_en="Physician approved ICU step-down. Transfer patient to General Ward A before 10:30 AM.",
            reason_hi="डॉक्टर ने आईसीयू स्टेप-डाउन की अनुमति दी है। मरीज को सुबह 10:30 से पहले वार्ड ए में शिफ्ट करें।",
            deadline=now + datetime.timedelta(minutes=60),
            confidence=0.91,
            sent_at=now,
            channel="WHATSAPP"
        )
        tasks_to_add.append(t4)

        for t in tasks_to_add:
            self.db.add(t)
        self.db.commit()

    def get_active_whatsapp_messages(self, role_filter: Optional[str] = None) -> List[Dict[str, Any]]:
        """Retrieves active tasks from DB formatted as interactive WhatsApp chat messages."""
        self.seed_tasks_if_empty()
        query = self.db.query(models.Task)
        if role_filter and role_filter != "ALL":
            query = query.filter(models.Task.role == role_filter)
        
        db_tasks = query.order_by(models.Task.deadline.asc()).all()

        messages = []
        for t in db_tasks:
            # Assign recipient staff member based on role
            staff_list = STAFF_ROSTER.get(t.role, STAFF_ROSTER.get("PHLEBOTOMY", []))
            staff_idx = hash(t.id) % len(staff_list) if staff_list else 0
            staff = staff_list[staff_idx] if staff_list else {"name": "Staff Member", "phone": "+91 98000 00000", "role": t.role}

            deadline_str = t.deadline.strftime("%I:%M %p")
            wav_filename = f"{t.id}.wav"
            audio_url = f"/static/audio/{wav_filename}"

            messages.append({
                "task_id": t.id,
                "role": t.role,
                "ward": t.ward,
                "recipient_name": staff["name"],
                "recipient_role": staff["role"],
                "recipient_phone": staff["phone"],
                "title_en": t.title_en,
                "title_hi": t.title_hi,
                "reason_en": t.reason_en,
                "reason_hi": t.reason_hi,
                "deadline_iso": t.deadline.isoformat(),
                "deadline_str": deadline_str,
                "confidence": t.confidence,
                "confidence_percent": round(t.confidence * 100, 1),
                "audio_url": audio_url,
                "status": "DONE" if t.response == "done" else ("CANNOT" if t.response == "cannot" else "PENDING"),
                "response": t.response,
                "responded_at": t.responded_at.isoformat() if t.responded_at else None,
                "refusal_reason": t.refusal_reason,
                "sent_at": t.sent_at.isoformat() if t.sent_at else None
            })

        return messages

    def ensure_task_audio(self, task_id: str) -> Dict[str, Any]:
        """Synthesizes TTS audio for a specific task if not already cached."""
        t = self.db.query(models.Task).filter(models.Task.id == task_id).first()
        if not t:
            raise ValueError(f"Task {task_id} not found")

        deadline_str = t.deadline.strftime("%I:%M %p")
        return synthesize_task_audio(
            task_id=t.id,
            role=t.role,
            title_hi=t.title_hi,
            reason_hi=t.reason_hi,
            deadline_str=deadline_str,
            title_en=t.title_en
        )

    def respond_to_task(
        self,
        task_id: str,
        response: str,
        refusal_reason: Optional[str] = None,
        staff_name: Optional[str] = None
    ) -> Dict[str, Any]:
        """Processes worker action: 'done' or 'cannot'.
        Updates task, logs to event_log, and triggers downstream operational side-effects."""
        if response not in ["done", "cannot"]:
            raise ValueError("Response must be 'done' or 'cannot'")

        t = self.db.query(models.Task).filter(models.Task.id == task_id).first()
        if not t:
            raise ValueError(f"Task {task_id} not found")

        now = datetime.datetime.utcnow()
        t.response = response
        t.responded_at = now
        t.refusal_reason = refusal_reason if response == "cannot" else None

        actor = staff_name or f"{t.role} Staff"

        # 1. Log to event_log
        action_name = "TASK_COMPLETED" if response == "done" else "TASK_FAILED"
        event = models.EventLog(
            ts=now,
            actual_time=now,
            logged_time=now,
            doc_lag_minutes=0.0,
            ward=t.ward,
            actor=actor,
            action=action_name,
            entity=task_id,
            payload_json={
                "task_title": t.title_en,
                "role": t.role,
                "deadline": t.deadline.isoformat(),
                "response": response,
                "refusal_reason": refusal_reason
            }
        )
        self.db.add(event)

        # 2. Downstream side-effects
        side_effects = []
        if response == "done":
            # If cleaning task completed, mark corresponding bed as READY
            if t.role in ["CLEANING", "HOUSEKEEPING"]:
                # Find bed from task title e.g. "WARD_A-04"
                for word in t.title_en.replace("(", " ").replace(")", " ").split():
                    if "-" in word and any(w in word for w in ["WARD_A", "WARD_B", "ICU"]):
                        bed_obj = self.db.query(models.Bed).filter(models.Bed.id == word).first()
                        if bed_obj:
                            bed_obj.state = "READY"
                            bed_obj.blocking_step = "READY"
                            side_effects.append(f"Bed {bed_obj.id} transitioned to READY state.")
                            if self.simulator and bed_obj.id in self.simulator.beds:
                                self.simulator.beds[bed_obj.id]["state"] = "READY"
                                self.simulator.beds[bed_obj.id]["blocking_step"] = "READY"
                            break

            elif t.role == "PHLEBOTOMY":
                side_effects.append("Phlebotomy specimen sent to central lab for priority analysis.")

            elif t.role == "BILLING":
                side_effects.append("Pre-clearance packet authorized with nodal desk.")

        self.db.commit()

        return {
            "task_id": t.id,
            "status": "DONE" if response == "done" else "CANNOT",
            "response": response,
            "responded_at": now.isoformat(),
            "refusal_reason": refusal_reason,
            "side_effects": side_effects
        }
