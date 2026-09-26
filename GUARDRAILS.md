# SwasthFlow AI — Canonical System Guardrails Charter

This document establishes the canonical, numbered definitions for all **10 System Guardrails** in SwasthFlow AI. Every engine component—including the Discharge Radar, Delay Book, Round Clock, Sequencer (CP-SAT), Nurse Check, and Bill Estimator—must strictly adhere to these guardrails.

---

### Guardrail #1: The Doctor Decides (Clinical Primacy)
- **Principle**: AI never diagnoses, prescribes, discharges, or moves a patient.
- **Rule**: Every clinical milestone requires explicit clinician authorization. SwasthFlow's role is strictly logistical: preparing non-medical paperwork, lab tubes, bills, and clean beds *just before* the clinical decision point so no minutes are wasted after the doctor says "go home."
- **Enforcement**: No automated patient status mutation in HMS; all actions require human click/acknowledgment.

---

### Guardrail #2: Read-Only HMS (Source-of-Truth Isolation)
- **Principle**: Never corrupt or lock core hospital EHR/HMS clinical tables.
- **Rule**: The hospital database is treated as read-only. SwasthFlow reads clinical signs, orders, and admissions through an ingest adapter and writes only to isolated operational tables (`task`, `prediction`, `nurse_check`, `bill_estimate`, `delay_stat`).
- **Enforcement**: Database session architecture isolates operational coordination from EHR schemas.

---

### Guardrail #3: P90 Duration Planning (Non-Optimistic Scheduling)
- **Principle**: Real hospital logistics are prone to tail delays; planning on medians creates cascading failures.
- **Rule**: All scheduling deadlines, pre-clearance horizons, and operational buffers MUST budget against empirical **90th percentile (P90)** turnaround times from the Delay Book, never median averages.
- **Enforcement**: `DelayBook.get_step_budget_p90()` is the single source of truth for duration math in Discharge Radar, Payer Router, and CP-SAT Sequencer.

---

### Guardrail #4: Confidence Floor ($\ge 70\%$)
- **Principle**: Protect staff from alert fatigue caused by speculative machine learning flags.
- **Rule**: No task or pre-clearance packet is ever dispatched to staff if model confidence is below **70%** ($P < 0.70$).
- **Enforcement**: `payer_router.py` and `sequencer.py` filter out any candidate encounter with $P < 0.70$.

---

### Guardrail #5: Alert Fatigue Cap ($\le 10$ Tasks / Shift)
- **Principle**: High task volumes cause notifications to be ignored.
- **Rule**: No individual staff member (nurse, billing clerk, porter, sweeper) may receive more than **10 tasks per 8-hour shift**. Tasks are pre-sequenced into a daily route, not sent as sporadic interruptions.
- **Enforcement**: OR-Tools CP-SAT model in `backend/sequencer.py` enforces `sum(tasks_assigned[staff, shift]) <= 10`.

---

### Guardrail #6: Financial Transparency & Disclaimer ($\pm 10\%$)
- **Principle**: Patient families need cost visibility to arrange funds, but preliminary figures cannot be mistaken for final audited invoices.
- **Rule**: All self-pay (Cash) bill projections must provide a $\pm 10\%$ range and carry the mandatory label:
  > *"This is an estimate, not the final bill. The final bill is determined upon clinical discharge."*
- **Enforcement**: Enforced by schema check in `backend/bill_estimator.py` and SMS payload generators.

---

### Guardrail #7: Doctor Privacy & Anti-Surveillance
- **Principle**: Clinicians will reject systems that monitor them as labor productivity metrics.
- **Rule**: Doctor round-time predictions from the Round Clock are strictly used for **backward logistical coordination** (scheduling phlebotomy draws, cleaning, and billing clearance so results are ready at bedside).
- **Prohibition**: Round predictions and historical round timings are **strictly forbidden** from being surfaced to hospital administration as punctuality scores, KPIs, or audit metrics.
- **Enforcement**: Zero punctuality or clinician ranking fields exist in API responses or database models. Verified by automated test `test_phase4.py`.

---

### Guardrail #8: Green-Consent Capacity Rule
- **Principle**: A clinically ready patient whose family is unavailable or whose insurance query is unresolved does not create an empty bed.
- **Rule**: Only patients with confirmed **🟢 GREEN** nurse check (family present, payment path ready, home readiness confirmed) count toward forecasted bed capacity in Discharge Radar and Bed Management.
- **Enforcement**: `counts_as_forecasted_capacity = (consent == "green") and (p_discharge >= 0.70)`.

---

### Guardrail #9: Clinical Honesty & Probability Calibration ($[0.05, 0.92]$)
- **Principle**: In real clinical practice, surprise complications occur (~15% baseline). Saturated confidence (0.0% or 100.0%) is medically false.
- **Rule**: LightGBM hazard models must be properly calibrated. Predictions are bounded within **$[0.05, 0.92]$**:
  - Upper ceiling of **92%** reflects immutable complication risks (fever spike, lab anomaly, physician re-eval).
  - Lower floor of **5%** reflects emergency transfers, AMA discharges, or rapid recovery.
- **Enforcement**: Saturated values ($0.0\%$ or $100.0\%$) are prohibited and rejected by validation tests.

---

### Guardrail #10: Scale Separation (30-Bed Live Demo vs. 300-Bed Projection)
- **Principle**: Maintain absolute honesty between live demonstrator telemetry and projected hospital-wide impact.
- **Rule**: The live simulation models a focused **30-bed capacity unit** (12 Medical, 12 Surgical, 6 ICU). All enterprise metrics (e.g. 300-bed hospital capacity, annual hours saved) are strictly labeled as **scaled projections**, never blended into live operational counters.
- **Enforcement**: UI banners and evaluation metrics maintain distinct display sections for Live 30-Bed Telemetry vs Scaled Projections.

---

### Summary Table for Engine Verification

| # | Guardrail | Primary Module | Enforcement Mechanism |
|---|---|---|---|
| **1** | The Doctor Decides | All | Human-in-the-loop action confirmation |
| **2** | Read-Only HMS | `adapter.py` | Isolated coordination tables |
| **3** | P90 Duration Planning | `delay_book.py` | Learned 90th percentile step budgets |
| **4** | Confidence Floor ($\ge 70\%$) | `payer_router.py`, `sequencer.py` | Low-probability task suppression |
| **5** | Alert Fatigue Cap ($\le 10$) | `sequencer.py` | CP-SAT capacity constraint per staff |
| **6** | Financial Transparency ($\pm 10\%$) | `bill_estimator.py` | Mandatory estimate disclaimer |
| **7** | Doctor Privacy & Anti-Surveillance | `round_clock.py` | Zero punctuality metrics exposed |
| **8** | Green-Consent Capacity | `discharge_radar.py`, `main.py` | Consent state requirement for forecast |
| **9** | Clinical Honesty ($[0.05, 0.92]$) | `discharge_radar.py` | Bounded probability calibration |
| **10** | Scale Separation | Web Dashboard & Metrics | Strict partitioning of 30-bed vs 300-bed |
