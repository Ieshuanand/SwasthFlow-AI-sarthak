import datetime
import numpy as np
import lightgbm as lgb
from typing import List, Dict, Any, Tuple, Optional
from simulator import HospitalSimulator

DOCTORS = [
    {"id": "DR_SHARMA", "name": "Dr. Vivek Sharma", "specialty": "Internal Med", "primary_ward": "WARD_A", "has_ot": False},
    {"id": "DR_RAO",    "name": "Dr. Sunita Rao",   "specialty": "Gen Surgery",  "primary_ward": "WARD_B", "has_ot": True},
    {"id": "DR_KAPOOR", "name": "Dr. Ananya Kapoor", "specialty": "Pulmonology", "primary_ward": "WARD_A", "has_ot": False},
    {"id": "DR_PATEL",  "name": "Dr. Rajesh Patel", "specialty": "Cardiology",   "primary_ward": "ICU",    "has_ot": False},
    {"id": "DR_MEHRA",  "name": "Dr. Vikram Mehra", "specialty": "Orthopedics",  "primary_ward": "WARD_B", "has_ot": False}
]

DOC_MAP = {d["id"]: i for i, d in enumerate(DOCTORS)}
WARD_MAP = {"WARD_A": 0, "WARD_B": 1, "ICU": 2}

class RoundClock:
    def __init__(self):
        self.model: lgb.Booster = None
        self.feature_names = [
            "doc_idx",
            "ward_idx",
            "day_of_week",
            "has_OT_today",
            "OT_start_time_min",
            "was_on_night_call",
            "is_holiday"
        ]
        self._train_round_model()

    def _generate_synthetic_round_burst_history(self, n_samples: int = 3000) -> Tuple[np.ndarray, np.ndarray]:
        """Generates historical round burst training data reflecting each doctor's burst distribution."""
        rng = np.random.RandomState(42)
        X = []
        y = []

        for _ in range(n_samples):
            doc = rng.choice(DOCTORS)
            doc_id = doc["id"]
            ward = doc["primary_ward"]
            day_of_week = rng.randint(0, 7) # 0=Mon, 6=Sun
            is_holiday = 1 if (day_of_week == 6 or rng.random() < 0.05) else 0
            was_on_night_call = 1 if rng.random() < 0.20 else 0

            # Dr. Rao has OT on Tue (1), Thu (3), Sat (5)
            has_ot_today = 1 if (doc_id == "DR_RAO" and day_of_week in [1, 3, 5]) else 0
            ot_start_min = 540 if has_ot_today else 0 # 9:00 AM OT start

            # Base round start minute (minutes from midnight)
            if doc_id == "DR_RAO":
                if has_ot_today:
                    # Bimodal afternoon round: 16:30 - 17:15 (990 - 1035 mins)
                    base_min = rng.normal(1005, 15)
                else:
                    # Bimodal morning round: 08:30 - 09:15 (510 - 555 mins)
                    base_min = rng.normal(525, 12)
            elif doc_id == "DR_SHARMA":
                # 09:30 - 10:15 (570 - 615 mins)
                base_min = rng.normal(585, 14)
            elif doc_id == "DR_KAPOOR":
                # 11:00 - 11:45 (660 - 705 mins)
                base_min = rng.normal(675, 15)
            elif doc_id == "DR_PATEL":
                # 10:00 - 10:45 (600 - 645 mins)
                base_min = rng.normal(615, 12)
            else: # DR_MEHRA
                # 14:00 - 14:45 (840 - 885 mins)
                base_min = rng.normal(855, 15)

            # If doctor was on night call, morning rounds shift ~30-40 min later
            if was_on_night_call and base_min < 720:
                base_min += rng.uniform(25, 45)

            # Weekend / holiday slight delay
            if is_holiday:
                base_min += rng.uniform(15, 30)

            features = [
                float(DOC_MAP[doc_id]),
                float(WARD_MAP[ward]),
                float(day_of_week),
                float(has_ot_today),
                float(ot_start_min),
                float(was_on_night_call),
                float(is_holiday)
            ]
            X.append(features)
            y.append(float(base_min))

        return np.array(X), np.array(y)

    def _train_round_model(self):
        """Trains LightGBM regression model to predict ward round burst start times."""
        X, y = self._generate_synthetic_round_burst_history(n_samples=4000)
        train_data = lgb.Dataset(X, label=y, feature_name=self.feature_names)

        params = {
            "objective": "regression",
            "metric": "rmse",
            "boosting_type": "gbdt",
            "num_leaves": 25,
            "learning_rate": 0.05,
            "verbose": -1,
            "random_state": 42
        }

        self.model = lgb.train(
            params,
            train_data,
            num_boost_round=120
        )

    def predict_doctor_round(
        self,
        consultant_id: str,
        ward: str,
        date: datetime.date,
        was_on_night_call: bool = False,
        is_holiday: bool = False
    ) -> Dict[str, Any]:
        """Predicts doctor round window for backward operational scheduling.
        GUARDRAIL #9: Never exposed as a punctuality metric or performance review."""
        
        doc_info = next((d for d in DOCTORS if d["id"] == consultant_id), DOCTORS[0])
        day_of_week = date.weekday()
        has_ot = (consultant_id == "DR_RAO" and day_of_week in [1, 3, 5])
        ot_start_min = 540 if has_ot else 0

        features = [
            float(DOC_MAP.get(consultant_id, 0)),
            float(WARD_MAP.get(ward, 0)),
            float(day_of_week),
            float(1 if has_ot else 0),
            float(ot_start_min),
            float(1 if was_on_night_call else 0),
            float(1 if is_holiday else 0)
        ]

        pred_min = float(self.model.predict(np.array([features]))[0])
        pred_min = round(pred_min)

        # Build datetime window
        base_dt = datetime.datetime(date.year, date.month, date.day)
        round_start = base_dt + datetime.timedelta(minutes=pred_min)
        # 45-minute typical burst duration
        round_end = round_start + datetime.timedelta(minutes=45)

        hours = int(pred_min // 60)
        minutes = int(pred_min % 60)
        time_str = f"{hours:02d}:{minutes:02d}"

        # Bimodal explanation if surgeon
        note = ""
        if consultant_id == "DR_RAO":
            if has_ot:
                note = "OT Day (Afternoon Round Schedule: Post-surgical ward burst)"
            else:
                note = "Non-OT Day (Morning Round Schedule: Pre-OP burst)"
        else:
            note = f"Standard {doc_info['specialty']} round burst profile"

        return {
            "consultant_id": consultant_id,
            "consultant_name": doc_info["name"],
            "specialty": doc_info["specialty"],
            "ward": ward,
            "predicted_round_start": round_start.isoformat(),
            "predicted_round_end": round_end.isoformat(),
            "predicted_time_str": time_str,
            "has_OT_today": has_ot,
            "schedule_note": note,
            "intended_use": "SCHEDULING_ONLY - Never to be used as a doctor punctuality metric"
        }

    def compute_latest_safe_blood_draw(
        self,
        predicted_round_start: datetime.datetime,
        lab_p90_turnaround_min: float = 140.0,
        buffer_minutes: float = 15.0
    ) -> Dict[str, Any]:
        """FEATURE F2: Report Before The Round.
        Works BACKWARDS from predicted round time through lab p90 turnaround
        to compute the exact deadline when blood must be drawn."""
        
        total_backwards_lead = lab_p90_turnaround_min + buffer_minutes
        deadline = predicted_round_start - datetime.timedelta(minutes=total_backwards_lead)

        return {
            "latest_safe_blood_draw_time": deadline.isoformat(),
            "latest_safe_time_str": deadline.strftime("%I:%M %p"),
            "lab_p90_budget_min": lab_p90_turnaround_min,
            "safety_margin_min": buffer_minutes,
            "doctor_round_time_str": predicted_round_start.strftime("%I:%M %p"),
            "reason": f"Report needed before {predicted_round_start.strftime('%I:%M %p')} round. Backwards math: {int(lab_p90_turnaround_min)}m lab p90 turnaround + {int(buffer_minutes)}m buffer = draw before {deadline.strftime('%I:%M %p')}."
        }
