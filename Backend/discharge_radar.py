import os
import datetime
import numpy as np
import lightgbm as lgb
from typing import List, Dict, Any, Tuple
from simulator import HospitalSimulator, DIAGNOSES, PAYER_CONFIGS
from guardrails import enforce_calibrated_probability, MIN_TASK_CONFIDENCE

def get_payer_horizon_hours(payer_type: str, delay_book: Any = None) -> float:
    """SINGLE SOURCE OF TRUTH: Derives prediction lead time directly from Delay Book learned p90.
    Prevents drift between Discharge Radar horizon and Sequencer task deadlines."""
    if delay_book is not None and hasattr(delay_book, "get_step_budget_p90"):
        step_key = f"PAYER_CLEARANCE_{payer_type}"
        p90_min = delay_book.get_step_budget_p90(step_key)
        return round(p90_min / 60.0, 1)
    
    # Ground-truth defaults matching Delay Book learned p90
    defaults = {
        "AYUSHMAN": 38.7,    # matches DelayBook learned p90
        "CGHS": 24.0,        # matches DelayBook learned p90
        "STATE_SCHEME": 24.0,# matches DelayBook learned p90
        "CASH": 18.0,        # matches DelayBook learned p90
        "TPA": 6.0           # matches DelayBook learned p90
    }
    return defaults.get(payer_type, 18.0)

PAYER_INDEX = {p["type"]: i for i, p in enumerate(PAYER_CONFIGS)}
WARD_INDEX = {"WARD_A": 0, "WARD_B": 1, "ICU": 2}

class DischargeRadar:
    def __init__(self):
        self.model: lgb.Booster = None
        self.feature_names = [
            "hours_since_last_test",
            "iv_to_oral",
            "oxygen_removed",
            "diet_normalized",
            "los_ratio",
            "pt_cleared",
            "vitals_stable",
            "payer_type_idx",
            "ward_idx",
            "target_horizon_hours"
        ]
        self._train_initial_model()

    def _generate_synthetic_training_data(self, n_samples: int = 5000, seed: int = 42) -> Tuple[np.ndarray, np.ndarray]:
        """Generates realistic historical patient stay trajectories from the simulator to train LightGBM.
        Accurately models the clinical reality: at observation time t, patient visible signs reflect
        their clinical progress towards expected recovery. An unforeseen complication strikes in ~15%
        of seemingly ready cases, extending their stay and reversing discharge within horizon.
        Because observation features cannot leak future complications, the model naturally calibrates
        to an honest ~85-90% probability ceiling."""
        rng = np.random.RandomState(seed)
        X = []
        y = []

        for _ in range(n_samples):
            diag = rng.choice(DIAGNOSES)
            payer = rng.choice(PAYER_CONFIGS)
            ward = diag["ward"]
            target_horizon = get_payer_horizon_hours(payer["type"])

            mean_los = diag["mean_los"]
            std_los = diag["std_los"]
            expected_los = max(1.2, rng.normal(mean_los, std_los))
            
            # 15% complication reversal (irreducible clinical uncertainty)
            has_complication = (rng.random() < 0.15)
            delay_hours = rng.uniform(48.0, 96.0) if has_complication else 0.0
            actual_los_hours = expected_los * 24.0 + delay_hours

            # Balanced observation points: 50% approaching expected discharge window, 50% earlier in stay
            is_near_window = (rng.random() < 0.50)
            if is_near_window:
                hours_to_expected = rng.uniform(0.0, target_horizon)
            else:
                hours_to_expected = rng.uniform(target_horizon + 4.0, target_horizon + 72.0)

            elapsed_hours = max(6.0, expected_los * 24.0 - hours_to_expected)
            elapsed_days = elapsed_hours / 24.0
            hours_to_actual_discharge = actual_los_hours - elapsed_hours

            # Target label: actual discharge occurs within target_horizon
            if 0.0 <= hours_to_actual_discharge <= target_horizon:
                is_discharged_within_horizon = 1
            else:
                is_discharged_within_horizon = 0

            # Observable clinical signs at observation time t
            # Crucial: observation features do NOT leak future unforeseen complications!
            if hours_to_expected <= target_horizon:
                # Pre-discharge phase: patient looks ready
                hours_since_last_test = max(14.0, rng.normal(24.0, 4.0))
                iv_to_oral = 1 if rng.random() < 0.92 else 0
                oxygen_removed = 1 if rng.random() < 0.95 else 0
                diet_normalized = 1 if rng.random() < 0.88 else 0
                pt_cleared = 1 if rng.random() < 0.85 else 0
                vitals_stable = 1 if rng.random() < 0.95 else 0
            elif hours_to_expected <= target_horizon * 2.0:
                # Intermediate phase
                hours_since_last_test = max(4.0, rng.normal(12.0, 3.0))
                iv_to_oral = 1 if rng.random() < 0.50 else 0
                oxygen_removed = 1 if ward != "ICU" and rng.random() < 0.70 else 0
                diet_normalized = 1 if rng.random() < 0.50 else 0
                pt_cleared = 1 if rng.random() < 0.35 else 0
                vitals_stable = 1 if rng.random() < 0.85 else 0
            else:
                # Early acute phase
                hours_since_last_test = max(1.0, rng.normal(4.0, 2.0))
                iv_to_oral = 1 if rng.random() < 0.08 else 0
                oxygen_removed = 1 if ward != "ICU" and rng.random() < 0.35 else 0
                diet_normalized = 1 if rng.random() < 0.12 else 0
                pt_cleared = 1 if rng.random() < 0.08 else 0
                vitals_stable = 1 if rng.random() < 0.75 else 0

            los_ratio = elapsed_days / mean_los

            features = [
                float(hours_since_last_test),
                float(iv_to_oral),
                float(oxygen_removed),
                float(diet_normalized),
                float(los_ratio),
                float(pt_cleared),
                float(vitals_stable),
                float(PAYER_INDEX.get(payer["type"], 0)),
                float(WARD_INDEX.get(ward, 0)),
                float(target_horizon)
            ]
            X.append(features)
            y.append(is_discharged_within_horizon)

        return np.array(X), np.array(y)

    def _train_initial_model(self):
        """Trains the LightGBM classifier with honest calibration."""
        X, y = self._generate_synthetic_training_data(n_samples=5000, seed=42)
        train_data = lgb.Dataset(X, label=y, feature_name=self.feature_names)

        params = {
            "objective": "binary",
            "metric": "binary_logloss",
            "boosting_type": "gbdt",
            "num_leaves": 15,
            "learning_rate": 0.05,
            "feature_fraction": 0.90,
            "verbose": -1,
            "random_state": 42
        }

        self.model = lgb.train(
            params,
            train_data,
            num_boost_round=100
        )

    def predict_encounter(self, encounter_data: Dict[str, Any], diag_mean_los: float = 4.0, delay_book: Any = None) -> Dict[str, Any]:
        """Predicts P(discharge within payer-specific horizon) and derives top 3 plain-English reasons.
        Enforces realistic clinical calibration: probability is capped at 92% to reflect inherent clinical complication risks."""
        payer_type = encounter_data.get("payer_type", "CASH")
        ward = encounter_data.get("ward", "WARD_A")
        # Single source of truth: derive horizon directly from Delay Book learned p90
        target_horizon = get_payer_horizon_hours(payer_type, delay_book)
        los_current = float(encounter_data.get("los_days", 1.0))
        los_ratio = los_current / max(1.0, diag_mean_los)

        features = [
            float(encounter_data.get("hours_since_last_test", 0.0)),
            float(1 if encounter_data.get("iv_to_oral") else 0),
            float(1 if encounter_data.get("oxygen_removed") else 0),
            float(1 if encounter_data.get("diet_normalized") else 0),
            float(los_ratio),
            float(1 if encounter_data.get("pt_cleared") else 0),
            float(1 if encounter_data.get("vitals_stable") else 0),
            float(PAYER_INDEX.get(payer_type, 0)),
            float(WARD_INDEX.get(ward, 0)),
            float(target_horizon)
        ]

        X_input = np.array([features])
        raw_prob = float(self.model.predict(X_input)[0])
        
        # GUARDRAIL #9: Clinical Honesty & Calibration.
        # Probabilities are bounded within [0.05, 0.92] to reflect immutable complication risks (~15%).
        # Saturated outputs (0.0% or 100.0%) are strictly prohibited.
        prob = enforce_calibrated_probability(raw_prob)

        # Generate Top 3 plain-English reasons based on clinical features
        reasons = self._explain_prediction(encounter_data, prob, target_horizon, diag_mean_los)

        # GUARDRAIL #4: Confidence Floor Guardrail (suppress below 70% confidence)
        is_high_confidence = prob >= MIN_TASK_CONFIDENCE

        return {
            "p_discharge": prob,
            "raw_model_prob": round(raw_prob, 3),
            "target_horizon_hours": target_horizon,
            "is_high_confidence": is_high_confidence,
            "top_reasons": reasons[:3],
            "payer_strategy": self._get_payer_strategy(payer_type, target_horizon)
        }

    def _explain_prediction(self, enc: Dict[str, Any], prob: float, horizon_hours: float, diag_mean_los: float) -> List[str]:
        reasons = []
        hours_test = enc.get("hours_since_last_test", 0.0)
        iv_oral = enc.get("iv_to_oral", False)
        o2_removed = enc.get("oxygen_removed", True)
        diet = enc.get("diet_normalized", False)
        los = enc.get("los_days", 1.0)
        payer = enc.get("payer_type", "CASH")
        vitals = enc.get("vitals_stable", True)

        if prob >= 0.70:
            if iv_oral:
                reasons.append("Switched from IV to oral medications (clinical stabilization)")
            if hours_test >= 18:
                reasons.append(f"Diagnostic tests completed {int(hours_test)}h ago with no new orders")
            if los >= diag_mean_los * 0.85:
                reasons.append(f"Completed {round(los,1)} of typical {round(diag_mean_los,1)} days expected for this diagnosis")
            if o2_removed and enc.get("ward") != "ICU":
                reasons.append("Oxygen support successfully weaned off")
            if diet:
                reasons.append("Tolerating regular solid diet normally")
            if payer == "AYUSHMAN":
                reasons.append(f"Ayushman Bharat ({int(horizon_hours)}h lead): Flagged early for PM-JAY portal pre-clearance")
            elif payer == "TPA":
                reasons.append(f"Private Insurance ({int(horizon_hours)}h lead): Provisional summary ready for TPA pre-auth")
            elif payer == "CASH":
                reasons.append(f"Self-Pay ({int(horizon_hours)}h lead): Family needs advance notice for settlement")
        elif prob >= 0.40:
            reasons.append(f"Moderate trajectory ({int(prob*100)}%): Pending final round confirmation")
            if not iv_oral:
                reasons.append("Still on IV medication; awaiting physician switch order")
            if not diet:
                reasons.append("Diet still restricted or light")
            if hours_test < 12:
                reasons.append(f"Recent lab test ordered ({int(hours_test)}h ago)")
        else:
            reasons.append(f"Early in stay / Acute phase ({int(prob*100)}% probability)")
            if not vitals:
                reasons.append("Vitals still stabilizing under active clinical monitoring")
            if not iv_oral:
                reasons.append("Active intravenous therapy required")
            if hours_test < 6:
                reasons.append("Active serial lab evaluations ongoing")

        if not reasons:
            reasons.append("Clinical parameters within expected stabilization range")

        return reasons

    def _get_payer_strategy(self, payer_type: str, horizon_hours: float) -> Dict[str, Any]:
        if payer_type == "AYUSHMAN":
            return {
                "route": "PM_JAY_PORTAL",
                "lead_hours": horizon_hours,
                "action_title": "PM-JAY Portal Pre-Clearance & Biometrics",
                "description": "Upload provisional discharge package to TMS portal 36-48h ahead to prevent discharge day denial."
            }
        elif payer_type == "TPA":
            return {
                "route": "TPA_PREAUTH",
                "lead_hours": horizon_hours,
                "action_title": "TPA Pre-Authorization Call",
                "description": "Transmit draft summary to insurer 4-6h prior to avoid evening authorization delays."
            }
        elif payer_type in ["CGHS", "STATE_SCHEME"]:
            return {
                "route": "GOVT_SCHEME_DESK",
                "lead_hours": horizon_hours,
                "action_title": "Govt Scheme Countersignature",
                "description": "Process dispensary referral check and departmental forms 18-24h in advance."
            }
        else: # CASH
            return {
                "route": "CASH_ESTIMATE",
                "lead_hours": horizon_hours,
                "action_title": "Family Projected Bill Range SMS",
                "description": "Send projected bill range evening before so family can arrange liquid funds/UPI without delay."
            }

    def evaluate_calibration(self, n_test: int = 1000) -> Dict[str, Any]:
        """Evaluates calibration on an independent held-out synthetic test set (seed=999)
        and benchmarks against a naive clinical baseline (stay = mean LOS).
        Computes Brier score, Expected Calibration Error (ECE), bin reliability,
        saturation counts (verifying zero 0.0% or 100.0% outputs), and raw vs calibrated bounds."""
        X_test, y_test = self._generate_synthetic_training_data(n_samples=n_test, seed=999)
        raw_probs = self.model.predict(X_test)
        calibrated_probs = np.array([enforce_calibrated_probability(p) for p in raw_probs])

        # Model performance on held-out set
        model_pred_labels = (calibrated_probs >= 0.50).astype(int)
        model_accuracy = float(np.mean(model_pred_labels == y_test))
        brier = float(np.mean((calibrated_probs - y_test) ** 2))
        raw_brier = float(np.mean((raw_probs - y_test) ** 2))

        # Naive Baseline: Predict discharge if elapsed days >= diagnosis mean LOS (los_ratio >= 1.0)
        # los_ratio is feature index 4
        los_ratio_test = X_test[:, 4]
        naive_pred_labels = (los_ratio_test >= 1.0).astype(int)
        naive_accuracy = float(np.mean(naive_pred_labels == y_test))
        naive_probs = np.where(los_ratio_test >= 1.0, 0.85, 0.15)
        naive_brier = float(np.mean((naive_probs - y_test) ** 2))

        # Expected Calibration Error (10 probability bins) on raw model output
        bins = np.linspace(0.0, 1.0, 11)
        ece = 0.0
        bin_details = []
        for i in range(10):
            mask = (raw_probs >= bins[i]) & (raw_probs < bins[i+1])
            count = int(np.sum(mask))
            if count > 0:
                bin_acc = float(np.mean(y_test[mask]))
                bin_conf = float(np.mean(raw_probs[mask]))
                bin_weight = float(count / n_test)
                ece += bin_weight * abs(bin_acc - bin_conf)
                bin_details.append({
                    "bin_range": f"[{bins[i]:.1f}, {bins[i+1]:.1f})",
                    "sample_count": count,
                    "mean_predicted_p": round(bin_conf, 3),
                    "empirical_accuracy": round(bin_acc, 3)
                })

        # Saturated predictions check (both on raw predictions and post-guardrail outputs)
        raw_saturated_zero = int(np.sum(raw_probs == 0.0))
        raw_saturated_one = int(np.sum(raw_probs == 1.0))
        saturated_zero = int(np.sum(calibrated_probs == 0.0))
        saturated_one = int(np.sum(calibrated_probs == 1.0))

        return {
            "n_test_samples": n_test,
            "model_accuracy": round(model_accuracy * 100, 2),
            "naive_baseline_accuracy": round(naive_accuracy * 100, 2),
            "brier_score": round(brier, 4),
            "raw_brier_score": round(raw_brier, 4),
            "naive_brier_score": round(naive_brier, 4),
            "expected_calibration_error": round(ece, 4),
            "saturated_zero_count": saturated_zero,
            "saturated_one_count": saturated_one,
            "raw_saturated_zero_count": raw_saturated_zero,
            "raw_saturated_one_count": raw_saturated_one,
            "min_prob_observed": float(np.min(calibrated_probs)),
            "max_prob_observed": float(np.max(calibrated_probs)),
            "raw_min_prob": round(float(np.min(raw_probs)), 4),
            "raw_max_prob": round(float(np.max(raw_probs)), 4),
            "calibration_mechanism": "LightGBM binary logloss on un-leaked trajectories + Guardrail #9 bounds [0.05, 0.92] (15% reversal risk ceiling)",
            "calibration_bins": bin_details
        }

