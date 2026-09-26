import datetime
import random
import math
from typing import List, Dict, Any, Optional

# Diagnosis catalog with clinical Length of Stay (LOS) characteristics (Hidden Truth)
DIAGNOSES = [
    {
        "code": "A90",
        "name": "Dengue Fever (Non-severe)",
        "mean_los": 4.0,
        "std_los": 0.8,
        "ward": "WARD_A",
        "bed_type": "GENERAL",
        "consultant_id": "DR_SHARMA",
        "consultant_name": "Dr. Vivek Sharma (Internal Med)",
        "base_cost_per_day": 4500
    },
    {
        "code": "K35.8",
        "name": "Post Laparoscopic Appendectomy",
        "mean_los": 3.0,
        "std_los": 0.5,
        "ward": "WARD_B",
        "bed_type": "GENERAL",
        "consultant_id": "DR_RAO",
        "consultant_name": "Dr. Sunita Rao (Gen Surgery)",
        "base_cost_per_day": 7500
    },
    {
        "code": "J18.9",
        "name": "Community Acquired Pneumonia",
        "mean_los": 5.5,
        "std_los": 1.2,
        "ward": "WARD_A",
        "bed_type": "GENERAL",
        "consultant_id": "DR_KAPOOR",
        "consultant_name": "Dr. Ananya Kapoor (Pulmonology)",
        "base_cost_per_day": 5200
    },
    {
        "code": "I20.0",
        "name": "Unstable Angina / Subacute Cardiac",
        "mean_los": 4.5,
        "std_los": 1.0,
        "ward": "ICU",
        "bed_type": "ICU",
        "consultant_id": "DR_PATEL",
        "consultant_name": "Dr. Rajesh Patel (Cardiology)",
        "base_cost_per_day": 14000
    },
    {
        "code": "S72.0",
        "name": "Femur Fracture Post-Op ORIF",
        "mean_los": 4.0,
        "std_los": 0.7,
        "ward": "WARD_B",
        "bed_type": "GENERAL",
        "consultant_id": "DR_MEHRA",
        "consultant_name": "Dr. Vikram Mehra (Orthopedics)",
        "base_cost_per_day": 6800
    },
    {
        "code": "A09",
        "name": "Acute Gastroenteritis with Dehydration",
        "mean_los": 2.5,
        "std_los": 0.5,
        "ward": "WARD_A",
        "bed_type": "GENERAL",
        "consultant_id": "DR_SHARMA",
        "consultant_name": "Dr. Vivek Sharma (Internal Med)",
        "base_cost_per_day": 3800
    },
    {
        "code": "J44.1",
        "name": "COPD Acute Exacerbation",
        "mean_los": 5.0,
        "std_los": 1.1,
        "ward": "WARD_A",
        "bed_type": "GENERAL",
        "consultant_id": "DR_KAPOOR",
        "consultant_name": "Dr. Ananya Kapoor (Pulmonology)",
        "base_cost_per_day": 5800
    },
    {
        "code": "Z98.89",
        "name": "ICU Post-Major Abdominal Surgery",
        "mean_los": 3.0, # in ICU before step-down
        "std_los": 0.6,
        "ward": "ICU",
        "bed_type": "ICU",
        "consultant_id": "DR_RAO",
        "consultant_name": "Dr. Sunita Rao (Gen Surgery)",
        "base_cost_per_day": 16500
    }
]

PAYER_CONFIGS = [
    {
        "type": "CASH",
        "name": "Self Pay (Cash)",
        "weight": 0.30,
        "median_clearance_min": 720, # 12h
        "p90_clearance_min": 1080,   # 18h (family arranging money)
        "required_lead_hours": 14,
        "process_steps": ["Provisional bill review", "Cash/UPI payment arrangement", "Final settlement"]
    },
    {
        "type": "TPA",
        "name": "Private Health Insurance (TPA)",
        "weight": 0.35,
        "median_clearance_min": 240, # 4h
        "p90_clearance_min": 360,   # 6h
        "required_lead_hours": 5,
        "process_steps": ["Discharge summary upload", "Query resolution", "Final authorization letter"]
    },
    {
        "type": "AYUSHMAN",
        "name": "Ayushman Bharat (PM-JAY)",
        "weight": 0.20,
        "median_clearance_min": 1680, # 28h
        "p90_clearance_min": 2880,   # 48h (portal approval)
        "required_lead_hours": 36,
        "process_steps": ["TMS portal discharge entry", "Biometric verification", "State nodal officer pre-clearance"]
    },
    {
        "type": "STATE_SCHEME",
        "name": "State Govt Health Scheme",
        "weight": 0.10,
        "median_clearance_min": 840,  # 14h
        "p90_clearance_min": 1440,   # 24h
        "required_lead_hours": 18,
        "process_steps": ["Department countersignature", "Treasury verification", "Billing sign-off"]
    },
    {
        "type": "CGHS",
        "name": "Central Govt Health Scheme (CGHS)",
        "weight": 0.05,
        "median_clearance_min": 780,  # 13h
        "p90_clearance_min": 1320,   # 22h
        "required_lead_hours": 16,
        "process_steps": ["CGHS dispensary referral check", "Itemized package breakdown", "Clearance seal"]
    }
]

WARD_CONFIGS = {
    "WARD_A": {"name": "Medical Ward A", "beds": 12, "type": "GENERAL", "doc_lag_min": (15, 30)},
    "WARD_B": {"name": "Surgical Ward B", "beds": 12, "type": "GENERAL", "doc_lag_min": (45, 90)}, # High documentation lag
    "ICU":    {"name": "Intensive Care Unit", "beds": 6, "type": "ICU", "doc_lag_min": (5, 15)}
}

PATIENT_NAMES_MALE = [
    "Ramesh Kumar", "Suresh Sharma", "Amitabh Verma", "Rajesh Gupta",
    "Manoj Tiwari", "Vikram Patel", "Deepak Singh", "Arun Nair",
    "Pankaj Jaiswal", "Mohit Chauhan", "Sunil Yadav", "Dinesh Aggarwal"
]

PATIENT_NAMES_FEMALE = [
    "Sunita Devi", "Pooja Sharma", "Rekha Verma", "Anita Gupta",
    "Geeta Singh", "Meena Patel", "Kavita Rao", "Priyanka Mishra",
    "Shanti Devi", "Sudha Kumari", "Asha Parekh", "Vandana Joshi"
]

class HospitalSimulator:
    def __init__(self, seed: int = 42):
        self.rng = random.Random(seed)
        # Anchor simulation start time at 06:00 AM
        self.simulated_time = datetime.datetime(2026, 9, 10, 6, 0, 0)
        self.patients: Dict[str, Dict[str, Any]] = {}
        self.beds: Dict[str, Dict[str, Any]] = {}
        self.patient_counter = 1000
        self.encounter_counter = 5000
        self.doctor_ot_schedule: Dict[str, List[int]] = {
            # Dr Rao (Surgeon) has OT on Tuesday (1), Thursday (3), Saturday (5)
            "DR_RAO": [1, 3, 5]
        }
        self.events: List[Dict[str, Any]] = []
        self._initialize_beds()
        self._seed_initial_patients()

    def log_event(self, actual_time: datetime.datetime, ward: str, actor: str, action: str, entity: str, payload: dict = None) -> Dict[str, Any]:
        """Logs a hospital event with both actual clinical occurrence time and delayed logged time."""
        doc_lag = self.get_ward_documentation_lag(ward)
        logged_time = actual_time + datetime.timedelta(minutes=doc_lag)
        event = {
            "ts": logged_time,
            "actual_time": actual_time,
            "logged_time": logged_time,
            "doc_lag_minutes": float(doc_lag),
            "ward": ward,
            "actor": actor,
            "action": action,
            "entity": entity,
            "payload_json": payload or {}
        }
        self.events.append(event)
        return event

    def _initialize_beds(self):
        self.beds = {}
        for ward_id, cfg in WARD_CONFIGS.items():
            for b in range(1, cfg["beds"] + 1):
                bed_id = f"{ward_id}-{b:02d}"
                self.beds[bed_id] = {
                    "id": bed_id,
                    "ward": ward_id,
                    "bed_type": cfg["type"],
                    "state": "READY",
                    "current_encounter_id": None,
                    "predicted_free_at": None,
                    "predicted_free_lo": None,
                    "predicted_free_hi": None,
                    "blocking_step": "READY"
                }

    def _sample_payer(self) -> Dict[str, Any]:
        r = self.rng.random()
        cumulative = 0.0
        for p in PAYER_CONFIGS:
            cumulative += p["weight"]
            if r <= cumulative:
                return p
        return PAYER_CONFIGS[0]

    def _sample_diagnosis(self, ward: Optional[str] = None) -> Dict[str, Any]:
        candidates = DIAGNOSES
        if ward:
            candidates = [d for d in DIAGNOSES if d["ward"] == ward]
            if not candidates:
                candidates = DIAGNOSES
        return self.rng.choice(candidates)

    def _seed_initial_patients(self):
        """Populates ~80-85% of hospital beds with varied lengths of stay."""
        bed_ids = list(self.beds.keys())
        self.rng.shuffle(bed_ids)
        
        # Fill ~25 beds out of 30
        target_fill = int(len(bed_ids) * 0.85)
        for bed_id in bed_ids[:target_fill]:
            ward = self.beds[bed_id]["ward"]
            self._admit_new_patient(bed_id, ward=ward, backdate_days=True)

    def _admit_new_patient(self, bed_id: str, ward: str, backdate_days: bool = False) -> Dict[str, Any]:
        self.patient_counter += 1
        self.encounter_counter += 1
        
        is_female = self.rng.random() < 0.48
        name = self.rng.choice(PATIENT_NAMES_FEMALE if is_female else PATIENT_NAMES_MALE)
        gender = "F" if is_female else "M"
        age = self.rng.randint(22, 76)
        
        diag = self._sample_diagnosis(ward=ward)
        payer = self._sample_payer()

        # 1. HIDDEN TRUTH: Sample true length of stay from Gaussian distribution truncated at 1.2 days
        raw_los = self.rng.gauss(diag["mean_los"], diag["std_los"])
        true_los_days = max(1.2, round(raw_los, 1))

        if backdate_days:
            # Patient has already spent some fraction of their stay in hospital
            elapsed_fraction = self.rng.uniform(0.1, 0.95)
            elapsed_days = true_los_days * elapsed_fraction
            admission_time = self.simulated_time - datetime.timedelta(days=elapsed_days)
        else:
            admission_time = self.simulated_time

        doc_lag = self.get_ward_documentation_lag(ward)
        admission_actual_time = admission_time
        admission_logged_time = admission_actual_time + datetime.timedelta(minutes=doc_lag)

        true_discharge_time = admission_actual_time + datetime.timedelta(days=true_los_days)

        # 2. 15% COMPLICATION REVERSAL (Hidden truth anomaly)
        has_complication = (self.rng.random() < 0.15)
        if has_complication:
            # Complication pushes true discharge back by 2-4 days
            delay_days = self.rng.uniform(2.0, 4.0)
            true_discharge_time += datetime.timedelta(days=delay_days)

        encounter_id = f"ENC-{self.encounter_counter}"
        patient_id = f"PAT-{self.patient_counter}"

        patient = {
            "encounter_id": encounter_id,
            "patient_id": patient_id,
            "patient_name": name,
            "age": age,
            "gender": gender,
            "ward": ward,
            "bed_id": bed_id,
            "admission_time": admission_logged_time, # legacy display uses logged time
            "admission_actual_time": admission_actual_time,
            "admission_logged_time": admission_logged_time,
            "admission_doc_lag_min": float(doc_lag),
            "diagnosis_code": diag["code"],
            "diagnosis_name": diag["name"],
            "consultant_id": diag["consultant_id"],
            "consultant_name": diag["consultant_name"],
            "base_cost_per_day": diag["base_cost_per_day"],
            "payer_type": payer["type"],
            "payer_name": payer["name"],
            "true_discharge_day": true_discharge_time,
            "has_complication": has_complication,
            "status": "ACTIVE",
            "consent": None, # nurse_check consent: green/amber/red
            "icu_stepdown_ready": False # Toggled by ICU doctor only
        }

        # Log admission event with doc lag
        self.log_event(
            actual_time=admission_actual_time,
            ward=ward,
            actor="Admission Desk",
            action="PATIENT_ADMITTED",
            entity=encounter_id,
            payload={"diagnosis": diag["code"], "bed": bed_id, "payer": payer["type"]}
        )

        # Update bed state if bed exists in inventory
        if bed_id in self.beds:
            self.beds[bed_id]["state"] = "OCCUPIED"
            self.beds[bed_id]["current_encounter_id"] = encounter_id
            self.beds[bed_id]["blocking_step"] = self._compute_initial_blocker(patient)

        self.patients[encounter_id] = patient
        return patient

    def _compute_initial_blocker(self, patient: Dict[str, Any]) -> str:
        if patient["ward"] == "ICU":
            return "ICU_CLINICAL_MONITORING"
        if patient["payer_type"] in ["AYUSHMAN", "TPA"]:
            return "PRE_AUTH_DOCUMENTS"
        return "DOCTOR_ROUND"

    def get_doctor_round_time(self, consultant_id: str, date: datetime.date) -> datetime.datetime:
        """Computes doctor round window.
        Specifically, Dr. Rao (Surgeon) has a bimodal distribution:
        - OT days (Tue, Thu, Sat): 16:30 - 17:30
        - Non-OT days: 08:30 - 09:30
        Other consultants have distinct typical morning burst windows."""
        weekday = date.weekday()
        base_date = datetime.datetime(date.year, date.month, date.day)

        if consultant_id == "DR_RAO":
            has_ot = weekday in self.doctor_ot_schedule.get("DR_RAO", [])
            if has_ot:
                # Afternoon round
                minute_offset = self.rng.randint(0, 45)
                return base_date + datetime.timedelta(hours=16, minutes=30 + minute_offset)
            else:
                # Early morning round
                minute_offset = self.rng.randint(0, 30)
                return base_date + datetime.timedelta(hours=8, minutes=30 + minute_offset)

        elif consultant_id == "DR_SHARMA":
            # 09:30 - 10:15
            return base_date + datetime.timedelta(hours=9, minutes=self.rng.randint(25, 50))
        elif consultant_id == "DR_KAPOOR":
            # 11:00 - 11:45
            return base_date + datetime.timedelta(hours=11, minutes=self.rng.randint(0, 35))
        elif consultant_id == "DR_PATEL":
            # 10:00 - 10:45
            return base_date + datetime.timedelta(hours=10, minutes=self.rng.randint(0, 30))
        elif consultant_id == "DR_MEHRA":
            # 14:00 - 14:45
            return base_date + datetime.timedelta(hours=14, minutes=self.rng.randint(0, 30))
        else:
            return base_date + datetime.timedelta(hours=10, minutes=0)

    def compute_visible_signs(self, patient: Dict[str, Any]) -> Dict[str, Any]:
        """Calculates visible operational signs that an ML model or dashboard sees.
        Incorporates realistic timing noise and handles the 15% complication reversal."""
        now = self.simulated_time
        admission = patient["admission_time"]
        los_current_days = max(0.1, (now - admission).total_seconds() / 86400.0)
        true_discharge = patient["true_discharge_day"]
        hours_to_true_discharge = (true_discharge - now).total_seconds() / 3600.0

        has_comp = patient["has_complication"]

        # Realistic signs transition as discharge approaches
        if hours_to_true_discharge <= 0:
            # At or past target discharge
            if has_comp:
                # Reversal due to complication: signs regress!
                hours_since_last_test = round(max(1.0, self.rng.gauss(3.0, 1.0)), 1)
                iv_to_oral = False
                oxygen_removed = False
                diet_normalized = False
                pt_cleared = False
                vitals_stable = False
            else:
                hours_since_last_test = round(max(24.0, self.rng.gauss(32.0, 6.0)), 1)
                iv_to_oral = True
                oxygen_removed = True
                diet_normalized = True
                pt_cleared = True
                vitals_stable = True
        elif hours_to_true_discharge <= 18:
            # Evening before / within 18h of discharge
            if has_comp and self.rng.random() < 0.70:
                # Complication kicking in
                hours_since_last_test = round(max(2.0, self.rng.gauss(4.0, 1.5)), 1)
                iv_to_oral = False
                oxygen_removed = True
                diet_normalized = False
                pt_cleared = False
                vitals_stable = False
            else:
                hours_since_last_test = round(max(18.0, self.rng.gauss(24.0, 4.0)), 1)
                iv_to_oral = True
                oxygen_removed = True
                diet_normalized = True
                pt_cleared = True
                vitals_stable = True
        elif hours_to_true_discharge <= 36:
            # 1 to 1.5 days out
            hours_since_last_test = round(max(8.0, self.rng.gauss(14.0, 3.0)), 1)
            iv_to_oral = self.rng.random() < 0.65
            oxygen_removed = True
            diet_normalized = True
            pt_cleared = self.rng.random() < 0.50
            vitals_stable = True
        else:
            # Early in stay
            hours_since_last_test = round(max(1.0, self.rng.gauss(4.0, 2.0)), 1)
            iv_to_oral = False
            oxygen_removed = patient["ward"] != "ICU"
            diet_normalized = False
            pt_cleared = False
            vitals_stable = True

        return {
            "hours_since_last_test": hours_since_last_test,
            "iv_to_oral": iv_to_oral,
            "oxygen_removed": oxygen_removed,
            "diet_normalized": diet_normalized,
            "los_days": round(los_current_days, 1),
            "pt_cleared": pt_cleared,
            "vitals_stable": vitals_stable,
            "hours_to_true_discharge": round(hours_to_true_discharge, 1)
        }

    def get_ward_documentation_lag(self, ward: str) -> int:
        """Returns simulated documentation lag in minutes per ward."""
        cfg = WARD_CONFIGS.get(ward, {"doc_lag_min": (15, 30)})
        lo, hi = cfg["doc_lag_min"]
        return self.rng.randint(lo, hi)

    def advance_time(self, minutes: int = 60) -> Dict[str, Any]:
        """Advances simulated time and processes bed discharges/admissions."""
        self.simulated_time += datetime.timedelta(minutes=minutes)
        discharged_count = 0
        new_admission_count = 0

        # Check for patients whose true discharge time has arrived
        for enc_id, p in list(self.patients.items()):
            if p["status"] == "ACTIVE":
                if self.simulated_time >= p["true_discharge_day"]:
                    # Discharged!
                    p["status"] = "DISCHARGED"
                    bed_id = p["bed_id"]
                    if bed_id and bed_id in self.beds:
                        self.beds[bed_id]["state"] = "DIRTY"
                        self.beds[bed_id]["blocking_step"] = "CLEANING"
                        self.beds[bed_id]["current_encounter_id"] = None
                    self.log_event(
                        actual_time=self.simulated_time,
                        ward=p["ward"],
                        actor="Ward Staff",
                        action="PATIENT_DISCHARGED",
                        entity=enc_id,
                        payload={"bed_id": bed_id, "diagnosis": p["diagnosis_code"]}
                    )
                    discharged_count += 1

        # Clean dirty beds and admit new patients to maintain realistic turnover
        for bed_id, b in self.beds.items():
            if b["state"] == "DIRTY":
                # Cleaning takes ~45 mins
                b["state"] = "READY"
                b["blocking_step"] = "READY"
            elif b["state"] == "READY":
                # 30% chance of new admission during daytime hours (08:00 - 20:00)
                hour = self.simulated_time.hour
                if 8 <= hour <= 20 and self.rng.random() < 0.35:
                    self._admit_new_patient(bed_id, ward=b["ward"])
                    new_admission_count += 1

        return {
            "new_simulated_time": self.simulated_time.isoformat(),
            "discharged": discharged_count,
            "admitted": new_admission_count,
            "active_patients": len([p for p in self.patients.values() if p["status"] == "ACTIVE"])
        }

    def trigger_chaos(self, num_surge_patients: int = 6) -> List[Dict[str, Any]]:
        """CHAOS BUTTON: Injects a sudden mass-casualty surge of trauma/respiratory patients
        demanding immediate HDU/ICU and Surgical ward capacity."""
        admitted = []
        # Find any available beds or convert general beds
        ready_beds = [b_id for b_id, b in self.beds.items() if b["state"] == "READY"]
        
        surge_diagnoses = [
            {"code": "T07", "name": "Multiple Trauma (Highway Accident)", "ward": "ICU", "bed_type": "ICU", "cost": 22000, "consultant": ("DR_RAO", "Dr. Sunita Rao (Gen Surgery)")},
            {"code": "T20.2", "name": "Major Burn Injury Grade II-III", "ward": "ICU", "bed_type": "ICU", "cost": 25000, "consultant": ("DR_RAO", "Dr. Sunita Rao (Gen Surgery)")},
            {"code": "S06.9", "name": "Severe Traumatic Brain Contusion", "ward": "ICU", "bed_type": "ICU", "cost": 28000, "consultant": ("DR_PATEL", "Dr. Rajesh Patel (Cardiology)")},
            {"code": "S82.1", "name": "Compound Tibia Fracture Post-Collision", "ward": "WARD_B", "bed_type": "GENERAL", "cost": 9500, "consultant": ("DR_MEHRA", "Dr. Vikram Mehra (Orthopedics)")}
        ]

        count = 0
        for b_id in ready_beds:
            if count >= num_surge_patients:
                break
            b = self.beds[b_id]
            sd = self.rng.choice(surge_diagnoses)
            
            self.patient_counter += 1
            self.encounter_counter += 1
            enc_id = f"ENC-{self.encounter_counter}"
            pat_id = f"PAT-{self.patient_counter}"
            
            doc_lag = self.get_ward_documentation_lag(b["ward"])
            actual_adm = self.simulated_time
            logged_adm = actual_adm + datetime.timedelta(minutes=doc_lag)

            patient = {
                "encounter_id": enc_id,
                "patient_id": pat_id,
                "patient_name": f"Surge Victim #{count+1} ({self.rng.choice(['M', 'F'])})",
                "age": self.rng.randint(18, 55),
                "gender": self.rng.choice(["M", "F"]),
                "ward": b["ward"],
                "bed_id": b_id,
                "admission_time": logged_adm,
                "admission_actual_time": actual_adm,
                "admission_logged_time": logged_adm,
                "admission_doc_lag_min": float(doc_lag),
                "diagnosis_code": sd["code"],
                "diagnosis_name": sd["name"],
                "consultant_id": sd["consultant"][0],
                "consultant_name": sd["consultant"][1],
                "base_cost_per_day": sd["cost"],
                "payer_type": "CASH",
                "payer_name": "Emergency Trauma Self-Pay",
                "true_discharge_day": self.simulated_time + datetime.timedelta(days=5),
                "has_complication": True,
                "status": "ACTIVE",
                "consent": None,
                "icu_stepdown_ready": False
            }
            b["state"] = "OCCUPIED"
            b["current_encounter_id"] = enc_id
            b["blocking_step"] = "EMERGENCY_TRIAGE_SURGERY"
            self.patients[enc_id] = patient
            self.log_event(
                actual_time=actual_adm,
                ward=b["ward"],
                actor="Emergency Triage",
                action="SURGE_PATIENT_ADMITTED",
                entity=enc_id,
                payload={"diagnosis": sd["code"], "bed": b_id}
            )
            admitted.append(patient)
            count += 1

        return admitted
