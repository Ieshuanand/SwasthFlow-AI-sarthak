export const INITIAL_SIM_STATUS = {
  simulated_time: "2026-09-26T06:00:00",
  simulated_date_str: "06:00 AM",
  total_beds: 30,
  occupied_beds: 18,
  ready_beds: 7,
  dirty_beds: 5,
  active_encounters: 18
};

export const INITIAL_READINESS_METRICS = {
  readiness_number: 6,
  ready_now: 4,
  turnover_in_30m: 2,
  threshold_state: "HEALTHY" as const,
  threshold_label: "Adequate Intake Capacity",
  threshold_action: "Intake capacity healthy. 4 beds immediately ready + 2 completing sanitization in ≤30m.",
  ward_breakdown: {
    ICU: { ready_now: 0, turnover_30m: 1, occupied: 6, dirty: 1, reserved: 0, total: 6 },
    WARD_A: { ready_now: 2, turnover_30m: 1, occupied: 7, dirty: 2, reserved: 0, total: 12 },
    WARD_B: { ready_now: 2, turnover_30m: 0, occupied: 5, dirty: 2, reserved: 0, total: 12 }
  },
  ready_now_beds: [
    { bed_id: "A-102", ward: "WARD_A", bed_type: "Standard", state: "READY", available_in_minutes: 0, status_label: "Ready Now" },
    { bed_id: "A-104", ward: "WARD_A", bed_type: "Standard", state: "READY", available_in_minutes: 0, status_label: "Ready Now" },
    { bed_id: "B-201", ward: "WARD_B", bed_type: "Post-Op", state: "READY", available_in_minutes: 0, status_label: "Ready Now" },
    { bed_id: "B-205", ward: "WARD_B", bed_type: "Post-Op", state: "READY", available_in_minutes: 0, status_label: "Ready Now" }
  ],
  near_ready_beds: [
    { bed_id: "ICU-03", ward: "ICU", bed_type: "Critical Care", state: "DIRTY", available_in_minutes: 18, status_label: "Turnover in 18m" },
    { bed_id: "A-106", ward: "WARD_A", bed_type: "Standard", state: "DIRTY", available_in_minutes: 24, status_label: "Turnover in 24m" }
  ],
  total_hospital_beds: 30,
  as_of_time: "06:00 AM"
};

export const INITIAL_TIME_SAVED = {
  live_demonstrator_30bed: {
    bed_capacity: 30,
    total_minutes_saved: 204,
    total_hours_saved: 3.4,
    label: "30-Bed Live Demonstrator",
    breakdown: [
      { intervention: "Backwards-Scheduled Morning Phlebotomy", minutes_saved: 75, hours_saved: 1.25, events: 5 },
      { intervention: "Pre-Authenticated TPA Insurance Approvals", minutes_saved: 60, hours_saved: 1.0, events: 3 },
      { intervention: "Advance Cash Bill Estimation SMS", minutes_saved: 45, hours_saved: 0.75, events: 2 },
      { intervention: "Rapid Terminal Housekeeping Turnover", minutes_saved: 24, hours_saved: 0.4, events: 4 }
    ]
  },
  projected_hospital_300bed: {
    bed_capacity: 300,
    scale_factor: "10x Bed Scaling (Separated Metric)",
    daily_hours_saved: 34.2,
    annual_hours_saved: 12483,
    annual_bed_days_freed: 520,
    label: "Enterprise Hospital Projection (300 Beds)",
    guardrail_note: "Strictly separated from live demonstrator telemetry under Guardrail #10."
  }
};

export const INITIAL_TODAYS_PLAN = {
  solver_status: "OPTIMAL",
  solve_time_seconds: 0.042,
  simulated_shift_date: "2026-09-26",
  shift_start_time: "06:00 AM",
  total_tasks_scheduled: 12,
  guardrails_enforced: [
    "Guardrail #3: Delay Book P90 Multi-Payer Lead Times",
    "Guardrail #4: Confidence Floor >= 70%",
    "Guardrail #5: Shift Alert Fatigue Cap <= 10 Tasks per Staff"
  ],
  staff_summary: [
    { staff_id: "STF-PHLEB-01", staff_name: "Hari Das", role: "PHLEBOTOMY", primary_ward: "WARD_A", assigned_task_count: 4, max_cap: 10, cap_utilized_percent: 40, is_cap_respected: true },
    { staff_id: "STF-BILL-01", staff_name: "Anita Sharma", role: "BILLING", primary_ward: "HOSPITAL-WIDE", assigned_task_count: 3, max_cap: 10, cap_utilized_percent: 30, is_cap_respected: true },
    { staff_id: "STF-HOUSE-01", staff_name: "Ramesh Kumar", role: "HOUSEKEEPING", primary_ward: "WARD_B", assigned_task_count: 3, max_cap: 10, cap_utilized_percent: 30, is_cap_respected: true },
    { staff_id: "STF-PORT-01", staff_name: "Vikram Singh", role: "PORTER", primary_ward: "ICU", assigned_task_count: 2, max_cap: 10, cap_utilized_percent: 20, is_cap_respected: true }
  ],
  shortfall_windows: [
    {
      task_id: "TSK-009",
      task_title: "Ayushman Bharat Discharge Portal Upload",
      ward: "WARD_A",
      role: "BILLING",
      shortfall_minutes: 25,
      scheduled_end: "10:55 AM",
      required_deadline: "10:30 AM",
      bottleneck_diagnostic: "Government portal verification lag. Early documentation dispatch initiated."
    }
  ],
  scheduled_tasks: [
    {
      task_id: "TSK-001",
      task_title: "Fasting Morning Phlebotomy (Pre-Breakfast)",
      role: "PHLEBOTOMY",
      ward: "WARD_A",
      patient_name: "Priya Sundaram",
      bed_id: "A-102",
      duration_min: 15,
      scheduled_start_min: 30,
      scheduled_end_min: 45,
      scheduled_start_str: "06:30 AM",
      scheduled_end_str: "06:45 AM",
      deadline_str: "07:30 AM",
      assigned_staff_id: "STF-PHLEB-01",
      assigned_staff_name: "Hari Das",
      confidence: 0.94,
      priority_weight: 95,
      shortfall_min: 0
    },
    {
      task_id: "TSK-002",
      task_title: "Pre-Round CBC & Renal Profile Phlebotomy",
      role: "PHLEBOTOMY",
      ward: "WARD_B",
      patient_name: "Kavita Reddy",
      bed_id: "B-203",
      duration_min: 15,
      scheduled_start_min: 45,
      scheduled_end_min: 60,
      scheduled_start_str: "06:45 AM",
      scheduled_end_str: "07:00 AM",
      deadline_str: "07:45 AM",
      assigned_staff_id: "STF-PHLEB-01",
      assigned_staff_name: "Hari Das",
      confidence: 0.91,
      priority_weight: 90,
      shortfall_min: 0
    },
    {
      task_id: "TSK-003",
      task_title: "Pre-Round Stat Electrolytes Draw",
      role: "PHLEBOTOMY",
      ward: "ICU",
      patient_name: "Manish Gupta",
      bed_id: "ICU-02",
      duration_min: 20,
      scheduled_start_min: 60,
      scheduled_end_min: 80,
      scheduled_start_str: "07:00 AM",
      scheduled_end_str: "07:20 AM",
      deadline_str: "08:15 AM",
      assigned_staff_id: "STF-PHLEB-01",
      assigned_staff_name: "Hari Das",
      confidence: 0.96,
      priority_weight: 98,
      shortfall_min: 0
    },
    {
      task_id: "TSK-004",
      task_title: "TPA Star Health Pre-Authorization Package",
      role: "BILLING",
      ward: "WARD_A",
      patient_name: "Rajesh Verma",
      bed_id: "A-105",
      duration_min: 30,
      scheduled_start_min: 90,
      scheduled_end_min: 120,
      scheduled_start_str: "07:30 AM",
      scheduled_end_str: "08:00 AM",
      deadline_str: "09:30 AM",
      assigned_staff_id: "STF-BILL-01",
      assigned_staff_name: "Anita Sharma",
      confidence: 0.88,
      priority_weight: 85,
      shortfall_min: 0
    },
    {
      task_id: "TSK-005",
      task_title: "Medi Assist Claim Package Submission",
      role: "BILLING",
      ward: "WARD_B",
      patient_name: "Sunil Joshi",
      bed_id: "B-204",
      duration_min: 30,
      scheduled_start_min: 120,
      scheduled_end_min: 150,
      scheduled_start_str: "08:00 AM",
      scheduled_end_str: "08:30 AM",
      deadline_str: "10:00 AM",
      assigned_staff_id: "STF-BILL-01",
      assigned_staff_name: "Anita Sharma",
      confidence: 0.86,
      priority_weight: 82,
      shortfall_min: 0
    },
    {
      task_id: "TSK-006",
      task_title: "Cash Bill Estimate SMS Dispatch & Review",
      role: "BILLING",
      ward: "WARD_A",
      patient_name: "Deepak Chopra",
      bed_id: "A-108",
      duration_min: 20,
      scheduled_start_min: 150,
      scheduled_end_min: 170,
      scheduled_start_str: "08:30 AM",
      scheduled_end_str: "08:50 AM",
      deadline_str: "09:45 AM",
      assigned_staff_id: "STF-BILL-01",
      assigned_staff_name: "Anita Sharma",
      confidence: 0.92,
      priority_weight: 80,
      shortfall_min: 0
    },
    {
      task_id: "TSK-007",
      task_title: "Terminal Room Disinfection & Dressing",
      role: "HOUSEKEEPING",
      ward: "ICU",
      patient_name: "Discharged Bed",
      bed_id: "ICU-03",
      duration_min: 25,
      scheduled_start_min: 60,
      scheduled_end_min: 85,
      scheduled_start_str: "07:00 AM",
      scheduled_end_str: "07:25 AM",
      deadline_str: "07:30 AM",
      assigned_staff_id: "STF-HOUSE-01",
      assigned_staff_name: "Ramesh Kumar",
      confidence: 0.95,
      priority_weight: 92,
      shortfall_min: 0
    },
    {
      task_id: "TSK-008",
      task_title: "Bed Sanitization & UV Sterilization",
      role: "HOUSEKEEPING",
      ward: "WARD_A",
      patient_name: "Discharged Bed",
      bed_id: "A-106",
      duration_min: 20,
      scheduled_start_min: 85,
      scheduled_end_min: 105,
      scheduled_start_str: "07:25 AM",
      scheduled_end_str: "07:45 AM",
      deadline_str: "08:00 AM",
      assigned_staff_id: "STF-HOUSE-01",
      assigned_staff_name: "Ramesh Kumar",
      confidence: 0.91,
      priority_weight: 88,
      shortfall_min: 0
    },
    {
      task_id: "TSK-009",
      task_title: "Ayushman Bharat Discharge Portal Upload",
      role: "HOUSEKEEPING",
      ward: "WARD_B",
      patient_name: "Discharged Bed",
      bed_id: "B-206",
      duration_min: 20,
      scheduled_start_min: 105,
      scheduled_end_min: 125,
      scheduled_start_str: "07:45 AM",
      scheduled_end_str: "08:05 AM",
      deadline_str: "08:30 AM",
      assigned_staff_id: "STF-HOUSE-01",
      assigned_staff_name: "Ramesh Kumar",
      confidence: 0.89,
      priority_weight: 84,
      shortfall_min: 0
    },
    {
      task_id: "TSK-010",
      task_title: "ICU Stepdown Patient Wheelchair Escort",
      role: "PORTER",
      ward: "ICU",
      patient_name: "Amitabh Sen",
      bed_id: "ICU-01",
      duration_min: 25,
      scheduled_start_min: 180,
      scheduled_end_min: 205,
      scheduled_start_str: "09:00 AM",
      scheduled_end_str: "09:25 AM",
      deadline_str: "09:45 AM",
      assigned_staff_id: "STF-PORT-01",
      assigned_staff_name: "Vikram Singh",
      confidence: 0.93,
      priority_weight: 90,
      shortfall_min: 0
    },
    {
      task_id: "TSK-011",
      task_title: "Post-Op Ward Transfer to Physical Rehab",
      role: "PORTER",
      ward: "WARD_B",
      patient_name: "Vikram Rao",
      bed_id: "B-202",
      duration_min: 20,
      scheduled_start_min: 205,
      scheduled_end_min: 225,
      scheduled_start_str: "09:25 AM",
      scheduled_end_str: "09:45 AM",
      deadline_str: "10:15 AM",
      assigned_staff_id: "STF-PORT-01",
      assigned_staff_name: "Vikram Singh",
      confidence: 0.90,
      priority_weight: 85,
      shortfall_min: 0
    },
    {
      task_id: "TSK-012",
      task_title: "Fasting Lipid Profile Draw (Pre-Ward Round)",
      role: "PHLEBOTOMY",
      ward: "WARD_A",
      patient_name: "Sanjay Singhania",
      bed_id: "A-110",
      duration_min: 15,
      scheduled_start_min: 80,
      scheduled_end_min: 95,
      scheduled_start_str: "07:20 AM",
      scheduled_end_str: "07:35 AM",
      deadline_str: "08:00 AM",
      assigned_staff_id: "STF-PHLEB-01",
      assigned_staff_name: "Hari Das",
      confidence: 0.95,
      priority_weight: 92,
      shortfall_min: 0
    }
  ]
};

export const INITIAL_TASKS = [
  {
    id: "TSK-CLR-01",
    role: "PHLEBOTOMIST",
    ward: "WARD_A",
    title_en: "Morning Fasting Draw (Pre-Breakfast)",
    title_hi: "नाश्ते से पहले सुबह का खाली पेट रक्त नमूना",
    reason_en: "Must be collected before 08:00 AM breakfast to ensure lab results are ready for Dr. Sharma's 09:30 AM round.",
    reason_hi: "डॉ. शर्मा के सुबह 09:30 बजे के राउंड के लिए परिणाम तैयार करने हेतु नाश्ते से पहले आवश्यक।",
    deadline: "07:30 AM",
    confidence: 0.94,
    channel: "WHATSAPP",
    response: null,
    responded_at: null
  },
  {
    id: "TSK-CLR-02",
    role: "CLEANER",
    ward: "ICU",
    title_en: "Terminal ICU Bed Sterilization",
    title_hi: "आईसीयू बेड का अंतिम स्वच्छताकरण और स्टरलाइजेशन",
    reason_en: "ICU Bed 03 vacated. 30-min turnover SLA required to absorb emergency surgical intake.",
    reason_hi: "आपातकालीन भर्ती के लिए 30 मिनट में बेड तैयार किया जाना अनिवार्य है।",
    deadline: "07:45 AM",
    confidence: 0.96,
    channel: "SMS",
    response: null,
    responded_at: null
  },
  {
    id: "TSK-CLR-03",
    role: "OPERATIONS",
    ward: "WARD_B",
    title_en: "TPA Pre-Authorization Submission",
    title_hi: "टीपीए बीमा पूर्व-अनुमोदन जमा करना",
    reason_en: "Medi Assist clearance for Bed 204. P90 turnaround is 210 min. Early submission unlocks 11:30 AM discharge.",
    reason_hi: "दोपहर के डिस्चार्ज को समय पर पूरा करने हेतु बीमा पूर्व-अनुमोदन आवश्यक।",
    deadline: "08:15 AM",
    confidence: 0.88,
    channel: "WHATSAPP",
    response: null,
    responded_at: null
  },
  {
    id: "TSK-CLR-04",
    role: "NURSE",
    ward: "WARD_A",
    title_en: "Caregiver Readiness & Home Barrier Check",
    title_hi: "देखभालकर्ता तैयारी और घरेलू बाधा सत्यापन",
    reason_en: "Verify family transportation and bedside caregiver availability before physician discharge order.",
    reason_hi: "डॉक्टर के डिस्चार्ज आदेश से पहले परिवार की तैयारी की पुष्टि करें।",
    deadline: "08:30 AM",
    confidence: 0.91,
    channel: "WHATSAPP",
    response: null,
    responded_at: null
  }
];

export const INITIAL_DELAY_BOOK = {
  ward_documentation_lags_minutes: {
    WARD_A: 42,
    WARD_B: 35,
    ICU: 18
  },
  step_duration_stats: {
    "LAB_TURNAROUND_ROUTINE": { median_min: 75, p90_min: 140, sample_count: 320 },
    "TPA_PREAUTH_APPROVAL": { median_min: 150, p90_min: 330, sample_count: 185 },
    "AYUSHMAN_BHARAT_DISCHARGE_PORTAL": { median_min: 180, p90_min: 420, sample_count: 94 },
    "TERMINAL_HOUSEKEEPING_CLEAN": { median_min: 22, p90_min: 30, sample_count: 512 },
    "PHARMACY_DISCHARGE_PACK": { median_min: 35, p90_min: 65, sample_count: 240 }
  },
  note: "Learned empirical 90th percentile step durations preventing optimistic scheduling collapses."
};

export const INITIAL_EVALUATION_DATA = {
  evaluation_timestamp: "2026-09-26T06:00:00",
  n_evaluation_samples: 1000,
  calibration_benchmark: {
    model_accuracy: 91.2,
    naive_baseline_accuracy: 64.2,
    accuracy_gain_percent: 27.0,
    model_brier_score: 0.068,
    naive_brier_score: 0.262,
    brier_error_reduction_percent: 74.0,
    expected_calibration_error: 0.0182,
    saturated_zero_count: 0,
    saturated_one_count: 0,
    min_prob_observed: 0.05,
    max_prob_observed: 0.92,
    calibration_mechanism: "Isotonic Regression + Clinical Uncertainty Cap [0.05, 0.92]",
    calibration_bins: [
      { bin_range: "[0.00, 0.10)", samples_count: 72, mean_predicted_prob: 0.068, observed_accuracy: 0.071, is_calibrated: true, interpretation: "Acutely unstable / early admission stays" },
      { bin_range: "[0.10, 0.20)", samples_count: 54, mean_predicted_prob: 0.142, observed_accuracy: 0.148, is_calibrated: true, interpretation: "Active diagnostic workup phase" },
      { bin_range: "[0.20, 0.30)", samples_count: 61, mean_predicted_prob: 0.245, observed_accuracy: 0.238, is_calibrated: true, interpretation: "Intermediate post-surgical observation" },
      { bin_range: "[0.30, 0.40)", samples_count: 85, mean_predicted_prob: 0.352, observed_accuracy: 0.364, is_calibrated: true, interpretation: "Oral conversion pending verification" },
      { bin_range: "[0.40, 0.50)", samples_count: 98, mean_predicted_prob: 0.458, observed_accuracy: 0.449, is_calibrated: true, interpretation: "Borderline discharge candidates" },
      { bin_range: "[0.50, 0.60)", samples_count: 110, mean_predicted_prob: 0.551, observed_accuracy: 0.563, is_calibrated: true, interpretation: "Moderate confidence discharge trajectory" },
      { bin_range: "[0.60, 0.70)", samples_count: 142, mean_predicted_prob: 0.655, observed_accuracy: 0.647, is_calibrated: true, interpretation: "Approaching discharge threshold" },
      { bin_range: "[0.70, 0.80)", samples_count: 178, mean_predicted_prob: 0.748, observed_accuracy: 0.758, is_calibrated: true, interpretation: "High confidence (>70% confidence floor)" },
      { bin_range: "[0.80, 0.90)", samples_count: 145, mean_predicted_prob: 0.842, observed_accuracy: 0.855, is_calibrated: true, interpretation: "Near-discharge stable patients" },
      { bin_range: "[0.90, 1.00]", samples_count: 55, mean_predicted_prob: 0.912, observed_accuracy: 0.909, is_calibrated: true, interpretation: "Clinical ceiling reached (0% at 1.0)" }
    ]
  },
  round_clock_benchmark: {
    fasting_blood_draws_count: 8,
    fasting_before_breakfast_compliant: true,
    breakfast_deadline: "08:00 AM",
    dr_rao_bimodal_proven: true,
    dr_rao_ot_round_time: "16:45 PM",
    dr_rao_ot_is_afternoon: true,
    dr_rao_non_ot_round_time: "08:45 AM",
    dr_rao_non_ot_is_morning: true,
    backwards_scheduling_formula: "latest_draw = round_start - P90_turnaround - 15m_buffer",
    guardrail_7_privacy_compliant: true,
    guardrail_7_note: "On-premise local scheduling without external cloud data leakage."
  },
  sequencer_benchmark: {
    solver_engine: "Google OR-Tools CP-SAT (Integer Programming)",
    solver_status: "OPTIMAL",
    solve_time_seconds: 0.042,
    tasks_scheduled: 12,
    tasks_candidate_pool: 12,
    guardrail_5_alert_fatigue_cap: "<= 10 Tasks per Staff Member per Shift",
    guardrail_5_respected: true,
    guardrail_4_confidence_floor: ">= 70% Confidence Threshold",
    guardrail_4_respected: true,
    staff_utilized_count: 4,
    shortfall_windows_detected: 1
  },
  honest_failure_modes: [
    {
      case_id: "CASE-FAIL-01",
      title: "Sudden Clinical Complication Reversal (~15% Baseline Risk)",
      patient_name: "Sunil Yadav",
      patient_encounter: "ENC-5005",
      ward: "Medical Ward A (Bed 05)",
      diagnosis: "Community-Acquired Pneumonia",
      clinical_scenario: "Patient on Day 4 demonstrated classic visible recovery signs: serial lab orders had ceased, IV antibiotics were switched to oral, and oxygen was successfully weaned. The LightGBM model predicted 88.0% discharge likelihood for morning physician rounds.",
      the_failure_event: "At 04:30 AM, patient suffered an unexpected bacteremic rigors episode: fever spiked to 102.4°F, respiratory rate elevated to 26 bpm, and blood cultures were urgently drawn.",
      why_ai_failed: "Pure non-invasive operational telemetry cannot anticipate de novo nosocomial bacteremia hours before core vital signs break. No model can or should be 100% certain.",
      safeguarding_guardrail: "🛡️ Guardrail #1 (The Doctor Decides) & Guardrail #9 (Clinical Honesty)",
      how_swasthflow_intercepted: "Because SwasthFlow never automates medical discharge, Dr. Verma reviewed the fever curve bedside at 08:30 AM, cancelled discharge, and re-initiated IV therapy. The model's 92% ceiling honestly accommodated this complication reality, and zero premature discharges occurred.",
      outcome_safety: "PATIENT SAFE — 0 False Discharges",
      severity_badge: "CLINICAL_SAFETY" as const
    },
    {
      case_id: "CASE-FAIL-02",
      title: "Missing Bedside Caregiver / Home Environment Barrier",
      patient_name: "Mohit Chauhan",
      patient_encounter: "ENC-5006",
      ward: "Surgical Ward B (Bed 06)",
      diagnosis: "Laparoscopic Cholecystectomy Post-Op",
      clinical_scenario: "Surgeon Dr. Rao declared patient clinically stable for discharge. Vitals normal, surgical incision clean, oral diet tolerated. Model assigned 91.0% discharge probability.",
      the_failure_event: "During morning nurse assessment, patient revealed his only adult son had been called away on an emergency factory shift, leaving no caregiver at home to assist with mobility or medication.",
      why_ai_failed: "Clinical EHR records healing and vitals, not family household logistics or caregiver presence. Sending an elderly surgical patient home alone is an acute safety failure.",
      safeguarding_guardrail: "🛡️ Guardrail #8 (Green-Consent Capacity Rule) & Phase 6 Nurse Check",
      how_swasthflow_intercepted: "Ward Sister logged home_problem='No caregiver'. The consent algorithm classified this as 🔴 RED. Under Guardrail #8, forecasted bed capacity was NOT unlocked. Patient was held safely in ward, and Medical Social Work was alerted to arrange family support.",
      outcome_safety: "PATIENT SAFE — Discharge Postponed Safely",
      severity_badge: "SOCIAL_LOGISTICS" as const
    },
    {
      case_id: "CASE-FAIL-03",
      title: "Frontline Shift Fatigue Overload / Capacity Starvation",
      patient_name: "Hospital Logistics Pool (Anand R. & Suresh G.)",
      patient_encounter: "SYSTEM-ROSTER-SURGE",
      ward: "Emergency & Inpatient Wards",
      diagnosis: "Mass-Casualty Highway Collision (6 Incoming Intakes)",
      clinical_scenario: "A sudden highway multi-casualty collision generated 26 concurrent non-clinical turnaround tasks (terminal disinfection, porter moves, insurance clearance packets) during morning shift change.",
      the_failure_event: "A naive greedy scheduler or unconstrained queue would dump 16+ high-urgency tasks onto the only two on-duty sweepers and porters, triggering severe task fatigue, missed deadlines, and frontline collapse.",
      why_ai_failed: "Algorithms optimized solely for throughput ignore biological human fatigue limits, resulting in ignored notifications and system rebellion.",
      safeguarding_guardrail: "🛡️ Guardrail #5 (Alert Fatigue Cap <= 10 Tasks / Shift)",
      how_swasthflow_intercepted: "The CP-SAT solver strictly capped assignments at 10 tasks per worker. 6 excess tasks were flagged as Shortfall Windows, notifying the Operations Coordinator to mobilize on-call reserve logistics staff.",
      outcome_safety: "FRONTLINE PROTECTED — No Staff Burnout",
      severity_badge: "STAFF_FATIGUE" as const
    },
    {
      case_id: "CASE-FAIL-04",
      title: "Ayushman Bharat Government Portal Pre-Auth Gateway Timeout",
      patient_name: "Devendra Patil",
      patient_encounter: "ENC-5007",
      ward: "Medical Ward A (Bed 07)",
      diagnosis: "Acute Coronary Syndrome (Stented)",
      clinical_scenario: "Cardiologist Dr. Patel signed clinical discharge at 09:30 AM. Patient medically fit and eager to return home. Payer is Ayushman Bharat (AB-PMJAY).",
      the_failure_event: "The national TMS/AB-PMJAY portal experienced an unannounced 3-hour server downtime. Hospital billing could not upload the final discharge summary or obtain the biometric settlement token.",
      why_ai_failed: "External government IT servers are fundamentally uncontrollable by hospital software. Optimistic timelines cause immense family anxiety and cashier crowding.",
      safeguarding_guardrail: "🛡️ Guardrail #3 (Empirical P90 Lead Times) & Delay Book",
      how_swasthflow_intercepted: "The Delay Book budgeted 420 minutes (7 hours) for Ayushman tail-latency based on learned history. The Sequencer initiated portal packet staging 4 hours before rounds, preventing premature family waiting.",
      outcome_safety: "TRANSPARENT EXPECTATIONS — No False Promises",
      severity_badge: "PAYER_LATENCY" as const
    }
  ],
  canonical_guardrails_audit: [
    { id: 1, name: "Doctor Decides", charter: "AI predicts and sequences; only the physician authorizes discharges and transfers.", module: "Clinical Gate", status: "PASS", test_ref: "test_guardrail_1_doctor_decides" },
    { id: 2, name: "Human in the Loop", charter: "Autonomous background coordination with mandatory human confirmation for high-stakes steps.", module: "Operations Command", status: "PASS", test_ref: "test_guardrail_2_hitl" },
    { id: 3, name: "Empirical P90 Planning", charter: "Schedules against learned 90th percentile budgets, never optimistic averages.", module: "Delay Book", status: "PASS", test_ref: "test_guardrail_3_p90" },
    { id: 4, name: "70% Confidence Floor", charter: "Non-clinical task dispatches require >= 70% model confidence.", module: "Discharge Radar", status: "PASS", test_ref: "test_guardrail_4_confidence" },
    { id: 5, name: "Shift Fatigue Cap", charter: "Maximum 10 dispatched tasks per staff member per shift.", module: "CP-SAT Sequencer", status: "PASS", test_ref: "test_guardrail_5_fatigue_cap" },
    { id: 6, name: "Financial Estimate Disclaimer", charter: "Cash estimates bounded to ±10% with mandatory clinical disclaimer.", module: "Bill Estimator", status: "PASS", test_ref: "test_guardrail_6_disclaimer" },
    { id: 7, name: "On-Premises Data Privacy", charter: "Air-gapped local neural TTS and data processing with zero cloud PHI leakage.", module: "Piper Neural Engine", status: "PASS", test_ref: "test_guardrail_7_privacy" },
    { id: 8, name: "Green Consent Gate", charter: "Only patients with confirmed GREEN family consent unlock forecasted capacity.", module: "Nurse Check", status: "PASS", test_ref: "test_guardrail_8_green_consent" },
    { id: 9, name: "Clinical Honesty Ceiling", charter: "Probabilities strictly capped at 92% representing irreducible baseline complication risk.", module: "Discharge Radar", status: "PASS", test_ref: "test_guardrail_9_honesty" },
    { id: 10, name: "Strict Scale Separation", charter: "30-bed demonstrator telemetry is never blended with enterprise 300-bed projections.", module: "Readiness & Metrics", status: "PASS", test_ref: "test_guardrail_10_scale_sep" }
  ],
  operational_impact: {
    live_30bed_demonstrator: {
      bed_capacity: 30,
      total_minutes_saved: 204,
      total_hours_saved: 3.4,
      label: "30-Bed Live Demonstrator",
      breakdown: [
        { intervention: "Backwards-Scheduled Morning Phlebotomy", minutes_saved: 75, hours_saved: 1.25, events: 5 },
        { intervention: "Pre-Authenticated TPA Insurance Approvals", minutes_saved: 60, hours_saved: 1.0, events: 3 },
        { intervention: "Advance Cash Bill Estimation SMS", minutes_saved: 45, hours_saved: 0.75, events: 2 },
        { intervention: "Rapid Terminal Housekeeping Turnover", minutes_saved: 24, hours_saved: 0.4, events: 4 }
      ]
    },
    projected_300bed_hospital: {
      bed_capacity: 300,
      scale_factor: "10x Bed Scaling (Separated Metric)",
      daily_hours_saved: 34.2,
      annual_hours_saved: 12483,
      annual_bed_days_freed: 520,
      label: "Enterprise Hospital Projection (300 Beds)",
      guardrail_note: "Strictly separated from live demonstrator telemetry under Guardrail #10."
    },
    morning_discharge_rate_swasthflow: "78.4%",
    morning_discharge_rate_baseline: "22.6%",
    average_hours_saved_per_patient: "2.4 hours"
  }
};
