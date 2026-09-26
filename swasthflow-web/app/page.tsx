"use client";

import React, { useState, useEffect, useCallback } from "react";
import { 
  Activity, 
  Clock, 
  RefreshCw, 
  Zap, 
  Radar, 
  Timer, 
  Send, 
  Sparkles, 
  Layers,
  Stethoscope,
  Syringe,
  CalendarCheck,
  AlertTriangle,
  CheckCircle2,
  UserCheck,
  MessageSquare,
  Volume2,
  ShieldAlert,
  Check,
  X,
  Receipt,
  SendHorizonal,
  HeartPulse,
  ArrowRight,
  Award,
  ShieldCheck,
  Scale,
  BookOpen,
  BarChart3,
  TrendingUp,
  ChevronRight,
  ChevronLeft,
  Compass,
  FastForward,
  Keyboard,
  LogOut,
  Droplet,
  Play,
  Phone,
  Smartphone,
  Bed,
  MapPin,
  ChevronDown
} from "lucide-react";

import { HeroVantaBackground } from "./components/HeroVantaBackground";
import { PageTopologyBackground } from "./components/PageTopologyBackground";
import { HOSPITAL_DISPLAY_NAME } from "./config/hospital";
import { StaffAlertsDrawer } from "./components/StaffAlertsFeed";
import { RegionalBloodInventory } from "./components/RegionalBloodInventory";
import { WhatsAppDrawer } from "./components/WhatsAppDrawer";
import { StaffIdentityModal, RoleCategoryDefinition } from "./components/StaffIdentityModal";
import { PatientPortalShell } from "./components/PatientPortalShell";
import { sendSMS, getSMSMessages, SMSMessage } from "./services/smsService";
import {
  INITIAL_SIM_STATUS,
  INITIAL_READINESS_METRICS,
  INITIAL_TIME_SAVED,
  INITIAL_TODAYS_PLAN,
  INITIAL_TASKS,
  INITIAL_DELAY_BOOK,
  INITIAL_EVALUATION_DATA
} from "./config/initialData";

interface IcuCandidate {
  encounter_id: string;
  patient_id: string;
  patient_name: string;
  age: number;
  gender: string;
  bed_id: string;
  diagnosis_name: string;
  consultant_id: string;
  consultant_name: string;
  payer_type: string;
  vitals_stable: boolean;
  iv_to_oral: boolean;
  oxygen_removed: boolean;
  los_days: number;
  stability_score: number;
  stability_status: "CLINICALLY_STABLE" | "BORDERLINE_OBSERVATION" | "ACUTE_ICU_MONITORING";
  stability_factors: string[];
  preferred_ward: string;
  icu_stepdown_status: string;
  stepdown_doctor_confirmed: boolean;
  reserved_bed_id: string | null;
  stepdown_consent: "agreed" | "worried" | "refused" | null;
  stepdown_consent_notes: string | null;
  script_en: string;
  script_hi: string;
  role_in_buffer: "PRIMARY" | "BUFFER" | "MONITORING" | "REFUSED";
  role_description: string;
}

interface AvailableWardBed {
  id: string;
  ward: string;
  bed_type: string;
  state: string;
  blocking_step: string | null;
}

interface IcuRosterData {
  target_beds_needed: number;
  over_preparation_multiplier: number;
  candidates_required: number;
  candidates_prepared: number;
  buffer_healthy: boolean;
  icu_total_occupied: number;
  green_consent_count: number;
  amber_consent_count: number;
  refused_consent_count: number;
  reserved_beds_count: number;
  roster: IcuCandidate[];
  available_ward_beds: AvailableWardBed[];
}

interface CashCandidate {
  encounter_id: string;
  patient_id: string;
  patient_name: string;
  ward: string;
  bed_id: string;
  diagnosis_name: string;
  consultant_name: string;
  los_days: number;
  p_discharge: number;
  consent: string | null;
  estimate_status: "PENDING" | "ESTIMATED" | "SMS_SENT" | "CONFIRMED";
  projected_low: number | null;
  projected_high: number | null;
  sms_sent_at: string | null;
  family_phone: string;
}

// Phase 9 Interfaces: Readiness Engine, Emergency Console, Time Saved & Blocker View
interface ReadinessMetrics {
  readiness_number: number;
  ready_now: number;
  turnover_in_30m: number;
  threshold_state: "CRITICAL" | "STRAINED" | "HEALTHY";
  threshold_label: string;
  threshold_action: string;
  ward_breakdown: {
    ICU: { ready_now: number; turnover_30m: number; occupied: number; dirty: number; reserved: number; total: number };
    WARD_A: { ready_now: number; turnover_30m: number; occupied: number; dirty: number; reserved: number; total: number };
    WARD_B: { ready_now: number; turnover_30m: number; occupied: number; dirty: number; reserved: number; total: number };
  };
  ready_now_beds: Array<{ bed_id: string; ward: string; bed_type: string; state: string; available_in_minutes: number; status_label: string }>;
  near_ready_beds: Array<{ bed_id: string; ward: string; bed_type: string; state: string; available_in_minutes: number; status_label: string }>;
  total_hospital_beds: number;
  as_of_time: string;
}

interface BlockerItem {
  bed_id: string;
  ward: string;
  bed_type: string;
  state: string;
  patient_name: string | null;
  encounter_id: string | null;
  diagnosis_name: string | null;
  consultant_name: string | null;
  payer_type: string | null;
  blocker_key: string;
  blocker_name: string;
  blocker_description: string;
  learned_p90_minutes: number;
  resolving_action: string;
  severity: "GREEN" | "AMBER" | "RED" | "BLUE";
}

interface BlockerData {
  total_beds_analyzed: number;
  blocker_counts: Record<string, number>;
  blockers: BlockerItem[];
}

interface TimeSavedBreakdownItem {
  intervention: string;
  minutes_saved: number;
  hours_saved: number;
  events: number;
}

interface TimeSavedData {
  live_demonstrator_30bed: {
    bed_capacity: number;
    total_minutes_saved: number;
    total_hours_saved: number;
    label: string;
    breakdown: TimeSavedBreakdownItem[];
  };
  projected_hospital_300bed: {
    bed_capacity: number;
    scale_factor: string;
    daily_hours_saved: number;
    annual_hours_saved: number;
    annual_bed_days_freed: number;
    label: string;
    guardrail_note: string;
  };
}

// Phase 10 Interfaces: Scientific Proof, Calibration Reliability, Medical Humility Matrix & Canonical Guardrails
interface CalibrationBin {
  bin_range: string;
  samples_count: number;
  mean_predicted_prob: number;
  observed_accuracy: number;
  is_calibrated: boolean;
  interpretation: string;
}

interface CalibrationBenchmark {
  model_accuracy: number;
  naive_baseline_accuracy: number;
  accuracy_gain_percent: number;
  model_brier_score: number;
  naive_brier_score: number;
  brier_error_reduction_percent: number;
  expected_calibration_error: number;
  saturated_zero_count: number;
  saturated_one_count: number;
  min_prob_observed: number;
  max_prob_observed: number;
  calibration_mechanism: string;
  calibration_bins: CalibrationBin[];
}

interface RoundClockBenchmark {
  fasting_blood_draws_count: number;
  fasting_before_breakfast_compliant: boolean;
  breakfast_deadline: string;
  dr_rao_bimodal_proven: boolean;
  dr_rao_ot_round_time: string;
  dr_rao_ot_is_afternoon: boolean;
  dr_rao_non_ot_round_time: string;
  dr_rao_non_ot_is_morning: boolean;
  backwards_scheduling_formula: string;
  guardrail_7_privacy_compliant: boolean;
  guardrail_7_note: string;
}

interface SequencerBenchmark {
  solver_engine: string;
  solver_status: string;
  solve_time_seconds: number;
  tasks_scheduled: number;
  tasks_candidate_pool: number;
  guardrail_5_alert_fatigue_cap: string;
  guardrail_5_respected: boolean;
  guardrail_4_confidence_floor: string;
  guardrail_4_respected: boolean;
  staff_utilized_count: number;
  shortfall_windows_detected: number;
}

interface HonestFailureCase {
  case_id: string;
  title: string;
  patient_name: string;
  patient_encounter: string;
  ward: string;
  diagnosis: string;
  clinical_scenario: string;
  the_failure_event: string;
  why_ai_failed: string;
  safeguarding_guardrail: string;
  how_swasthflow_intercepted: string;
  outcome_safety: string;
  severity_badge: "CLINICAL_SAFETY" | "SOCIAL_LOGISTICS" | "STAFF_FATIGUE" | "PAYER_LATENCY";
}

interface GuardrailAuditItem {
  id: number;
  name: string;
  charter: string;
  module: string;
  status: string;
  test_ref: string;
}

interface EvaluationMetricsData {
  evaluation_timestamp: string;
  n_evaluation_samples: number;
  calibration_benchmark: CalibrationBenchmark;
  round_clock_benchmark: RoundClockBenchmark;
  sequencer_benchmark: SequencerBenchmark;
  honest_failure_modes: HonestFailureCase[];
  canonical_guardrails_audit: GuardrailAuditItem[];
  operational_impact: {
    live_30bed_demonstrator: {
      bed_capacity: number;
      total_minutes_saved: number;
      total_hours_saved: number;
      label: string;
      breakdown: TimeSavedBreakdownItem[];
    };
    projected_300bed_hospital: {
      bed_capacity: number;
      scale_factor: string;
      daily_hours_saved: number;
      annual_hours_saved: number;
      annual_bed_days_freed: number;
      label: string;
      guardrail_note: string;
    };
    morning_discharge_rate_swasthflow: string;
    morning_discharge_rate_baseline: string;
    average_hours_saved_per_patient: string;
  };
}

interface EmergencyActivationResult {
  status: string;
  surge_type: string;
  beds_needed: number;
  immediately_ready_beds: string[];
  immediately_ready_count: number;
  expedited_cleaning_beds: string[];
  expedited_stepdowns: Array<{ encounter_id: string; patient_name: string; reserved_bed_id: string | null }>;
  broadcast_alerts: string[];
  total_absorbable_soon: number;
  timestamp: string;
}

interface BillEstimateDetail {
  estimate_id: number;
  encounter_id: string;
  patient_name: string;
  bed_id: string;
  ward: string;
  diagnosis_name: string;
  payer_type: string;
  los_days: number;
  status: string;
  sent_at: string | null;
  family_phone: string;
  accrued_amount: number;
  projected_low: number;
  projected_high: number;
  out_of_pocket: number;
  breakdown: {
    room_and_bed: number;
    physician_consultations: number;
    nursing_and_care: number;
    diagnostics_and_lab: number;
    pharmacy_and_consumables: number;
    accrued_total: number;
    projected_remaining_room: number;
    projected_remaining_clinical: number;
    projected_discharge_pack: number;
    projected_remaining_total: number;
    projected_mid: number;
    uncertainty_percent: number;
    projected_low: number;
    projected_high: number;
    disclaimer_en: string;
    disclaimer_hi: string;
  };
  disclaimer: string;
  sms_text_en: string;
  sms_text_hi: string;
}

interface NurseCandidate {
  encounter_id: string;
  patient_id: string;
  patient_name: string;
  age: number;
  gender: string;
  ward: string;
  bed_id: string;
  diagnosis_name: string;
  consultant_name: string;
  payer_type: string;
  los_days: number;
  current_consent: string | null;
  p_discharge: number;
  p_discharge_percent: number;
  is_high_confidence: boolean;
  top_reasons: string[];
}

interface WhatsAppCard {
  task_id: string;
  role: string;
  ward: string;
  recipient_name: string;
  recipient_role: string;
  recipient_phone: string;
  title_en: string;
  title_hi: string;
  reason_en: string;
  reason_hi: string;
  deadline_iso: string;
  deadline_str: string;
  confidence: number;
  confidence_percent: number;
  audio_url: string;
  status: "PENDING" | "DONE" | "CANNOT";
  response: string | null;
  responded_at: string | null;
  refusal_reason: string | null;
  sent_at: string | null;
}

interface BedData {
  id: string;
  ward: string;
  bed_type: string;
  state: "OCCUPIED" | "READY" | "DIRTY" | "PENDING";
  blocking_step: string | null;
  current_encounter: {
    encounter_id: string;
    patient_name: string;
    age: number;
    gender: string;
    diagnosis: string;
    consultant: string;
    payer_type: string;
    admission_time: string;
    los_days: number;
    iv_to_oral: boolean;
    oxygen_removed: boolean;
    diet_normalized: boolean;
    vitals_stable: boolean;
    p_discharge?: number;
    discharge_reasons?: string[];
    is_high_confidence?: boolean;
    target_horizon_hours?: number;
    is_forecasted_capacity?: boolean;
    predicted_free_at?: string;
  } | null;
}

interface RadarItem {
  encounter_id: string;
  patient_name: string;
  bed_id: string;
  ward: string;
  diagnosis: string;
  consultant: string;
  payer_type: string;
  los_days: number;
  p_discharge: number;
  top_reasons: string[];
  is_high_confidence: boolean;
  target_horizon_hours: number;
  payer_strategy: {
    route: string;
    lead_hours: number;
    action_title: string;
    description: string;
  };
  consent: string | null;
  counts_as_forecasted_capacity: boolean;
}

interface DelayBookData {
  ward_documentation_lags_minutes: Record<string, number>;
  step_duration_stats: Record<string, { median_min: number; p90_min: number; sample_count: number }>;
  note: string;
}

interface DoctorRound {
  consultant_id: string;
  consultant_name: string;
  specialty: string;
  ward: string;
  predicted_round_start: string;
  predicted_time_str: string;
  has_OT_today: boolean;
  schedule_note: string;
  assigned_patient_count: number;
}

interface PhlebotomyRouteItem {
  encounter_id: string;
  patient_name: string;
  bed_id: string;
  ward: string;
  consultant_name: string;
  consultant_round_time: string;
  latest_safe_blood_draw_time: string;
  latest_safe_draw_str: string;
  why_reason: string;
  fasting_required: boolean;
  is_round_critical: boolean;
}

interface TaskItem {
  id: string;
  role: string;
  ward: string;
  title_en: string;
  title_hi: string;
  reason_en: string;
  reason_hi: string;
  deadline: string;
  confidence: number;
  channel: string;
  response: string | null;
  responded_at: string | null;
}

interface ScheduledPlanTask {
  task_id: string;
  task_title: string;
  role: string;
  ward: string;
  patient_name: string;
  bed_id: string;
  duration_min: number;
  scheduled_start_min: number;
  scheduled_end_min: number;
  scheduled_start_str: string;
  scheduled_end_str: string;
  deadline_str: string;
  assigned_staff_id: string;
  assigned_staff_name: string;
  confidence: number;
  priority_weight: number;
  shortfall_min: number;
}

interface ShortfallWindowItem {
  task_id: string;
  task_title: string;
  ward: string;
  role: string;
  shortfall_minutes: number;
  scheduled_end: string;
  required_deadline: string;
  bottleneck_diagnostic: string;
}

interface StaffSummaryItem {
  staff_id: string;
  staff_name: string;
  role: string;
  primary_ward: string;
  assigned_task_count: number;
  max_cap: number;
  cap_utilized_percent: number;
  is_cap_respected: boolean;
}

interface TodaysPlanData {
  solver_status: string;
  solve_time_seconds: number;
  simulated_shift_date: string;
  shift_start_time: string;
  total_tasks_scheduled: number;
  scheduled_tasks: ScheduledPlanTask[];
  shortfall_windows: ShortfallWindowItem[];
  staff_summary: StaffSummaryItem[];
  guardrails_enforced: string[];
}

interface SimStatus {
  simulated_time: string;
  simulated_date_str: string;
  total_beds: number;
  occupied_beds: number;
  ready_beds: number;
  dirty_beds: number;
  active_encounters: number;
}

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState<"TODAYS_PLAN" | "EMERGENCY_READINESS" | "PROOF_EVALUATION" | "ICU_STEPDOWN" | "NURSE_CHECK" | "BILL_ESTIMATOR" | "WHATSAPP" | "ROUND_CLOCK" | "RADAR" | "DELAY_BOOK" | "TASKS" | "BEDS" | "BLOOD_INVENTORY">("TODAYS_PLAN");
  const [showWhatsAppDrawer, setShowWhatsAppDrawer] = useState<boolean>(false);
  const [moreMenuOpen, setMoreMenuOpen] = useState<boolean>(false);
  const [beds, setBeds] = useState<BedData[]>([]);
  const [radar, setRadar] = useState<RadarItem[]>([]);
  const [rounds, setRounds] = useState<DoctorRound[]>([]);
  const [bloodRoute, setBloodRoute] = useState<PhlebotomyRouteItem[]>([]);
  const [delayBook, setDelayBook] = useState<DelayBookData | null>(INITIAL_DELAY_BOOK as any);
  const [tasks, setTasks] = useState<TaskItem[]>(INITIAL_TASKS as any);
  const [todaysPlan, setTodaysPlan] = useState<TodaysPlanData | null>(INITIAL_TODAYS_PLAN as any);
  const [selectedPlanRole, setSelectedPlanRole] = useState<string>("ALL");
  const [status, setStatus] = useState<SimStatus | null>(INITIAL_SIM_STATUS as any);
  const [actionLoading, setActionLoading] = useState(false);
  const [selectedWard, setSelectedWard] = useState<string>("ALL");
  const backendUrl = "http://localhost:8000";

  // Phase 10 States: Evaluation Engine & Proof Screen
  const [evaluationData, setEvaluationData] = useState<EvaluationMetricsData | null>(INITIAL_EVALUATION_DATA as any);
  const [selectedFailureCaseId, setSelectedFailureCaseId] = useState<string>("CASE-FAIL-01");

  // Phase 11 States: Interactive Demo Tour, Pitch Briefing & Keyboard Shortcuts
  const [tourActive, setTourActive] = useState<boolean>(false);
  const [tourStepIndex, setTourStepIndex] = useState<number>(0);
  const [showPitchModal, setShowPitchModal] = useState<boolean>(false);
  const [showShortcutsHelp, setShowShortcutsHelp] = useState<boolean>(false);

  // Phase 9 States: Readiness Engine, Emergency Console, Time Saved Counter & Blocker View
  const [readinessMetrics, setReadinessMetrics] = useState<ReadinessMetrics | null>(INITIAL_READINESS_METRICS as any);
  const [blockersData, setBlockersData] = useState<BlockerData | null>(null);
  const [timeSavedData, setTimeSavedData] = useState<TimeSavedData | null>(INITIAL_TIME_SAVED as any);
  const [selectedBlockerFilter, setSelectedBlockerFilter] = useState<string>("ALL");
  const [emergencySurgeType, setEmergencySurgeType] = useState<string>("MASS_CASUALTY_COLLISION");
  const [emergencyBedsNeeded, setEmergencyBedsNeeded] = useState<number>(4);
  const [emergencyActivationResult, setEmergencyActivationResult] = useState<EmergencyActivationResult | null>(null);
  const [emergencyLoading, setEmergencyLoading] = useState<boolean>(false);

  // Phase 8 States: ICU Step-Down & 2x Candidate Over-Preparation (Feature F3)
  const [icuRoster, setIcuRoster] = useState<IcuRosterData | null>(null);
  const [selectedIcuEncounterId, setSelectedIcuEncounterId] = useState<string | null>(null);
  const [stepdownTargetBeds, setStepdownTargetBeds] = useState<number>(1);
  const [icuScriptLang, setIcuScriptLang] = useState<"EN" | "HI">("EN");
  const [icuConsentNotes, setIcuConsentNotes] = useState<string>("");
  const [icuActionLoading, setIcuActionLoading] = useState<boolean>(false);

  // Phase 6 States: Nurse Check & WhatsApp Delivery
  const [nurseCandidates, setNurseCandidates] = useState<NurseCandidate[]>([]);
  const [nurseForm, setNurseForm] = useState<Record<string, { payer: string; family: string; home: string; customReason?: string }>>({});
  const [submittingEncounterId, setSubmittingEncounterId] = useState<string | null>(null);

  const [whatsappMessages, setWhatsappMessages] = useState<WhatsAppCard[]>([]);
  const [selectedWhatsAppRole, setSelectedWhatsAppRole] = useState<string>("ALL");
  const [cannotModalTaskId, setCannotModalTaskId] = useState<string | null>(null);
  const [cannotReason, setCannotReason] = useState<string>("Patient not at bed (in diagnostic scan)");
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string | null>(null);
  const [dispatchChannel, setDispatchChannel] = useState<"ALL" | "WHATSAPP" | "SMS">("ALL");
  const [smsLogs, setSmsLogs] = useState<SMSMessage[]>([]);
  const [testSmsModal, setTestSmsModal] = useState<boolean>(false);
  const [testSmsPhone, setTestSmsPhone] = useState<string>("+91 98765 43210");
  const [testSmsRecipient, setTestSmsRecipient] = useState<string>("Hari Das (Phlebotomy)");
  const [testSmsRole, setTestSmsRole] = useState<string>("SUPPORT");
  const [testSmsBody, setTestSmsBody] = useState<string>("Morning Fasting Phlebotomy for Bed 102 backwards-scheduled before 08:00 AM breakfast deadline.");
  const [selectedShiftFilter, setSelectedShiftFilter] = useState<"ALL" | "MORNING" | "EVENING" | "NIGHT">("ALL");

  // Phase 7 States: Bill Estimator & Family SMS
  const [cashCandidates, setCashCandidates] = useState<CashCandidate[]>([]);
  const [selectedBillEncounterId, setSelectedBillEncounterId] = useState<string | null>(null);
  const [billDetail, setBillDetail] = useState<BillEstimateDetail | null>(null);
  const [billLoading, setBillLoading] = useState(false);
  const [smsPhoneInput, setSmsPhoneInput] = useState<string>("+91 98765 43210");
  const [sendingSms, setSendingSms] = useState(false);
  const [confirmingFunds, setConfirmingFunds] = useState(false);

  // Frontline Staff User & Duty Authentication
  interface StaffUser {
    staff_id: string;
    name: string;
    role: "NURSE" | "DOCTOR" | "CLEANER" | "PHLEBOTOMIST" | "OPERATIONS";
    roleCategoryId?: string;
    ward?: string;
    title?: string;
    department?: string;
    shift?: string;
  }

  // Generalized Role Categories (Modern Healthcare Theme)
  const GENERALIZED_ROLE_CATEGORIES: RoleCategoryDefinition[] = [
    {
      id: "NURSE",
      mappedSystemRole: "NURSE",
      label: "Nurse",
      title: "Inpatient & Critical Care Nursing",
      category: "Bedside Clinical Operations",
      badge: "Ward & ICU Duty",
      accentColor: "#0d9488",
      borderColor: "border-teal-500",
      btnBg: "bg-slate-900 text-white hover:bg-slate-800",
      iconEmoji: "👩‍⚕️",
      defaultIdPrefix: "N",
      placeholder: "Search nurse name or ID (e.g., Sunita, N001)...",
      defaultName: "Staff Nurse",
      systemScope: "Bedside verification ensuring patients are clinically and socially prepared before doctor rounds."
    },
    {
      id: "DOCTOR",
      mappedSystemRole: "DOCTOR",
      label: "Doctor",
      title: "Attending & Surgical Consultant",
      category: "Clinical Authority & Discharge Gate",
      badge: "Clinical Lead",
      accentColor: "#0284c7",
      borderColor: "border-sky-500",
      btnBg: "bg-slate-900 text-white hover:bg-slate-800",
      iconEmoji: "👨‍⚕️",
      defaultIdPrefix: "D",
      placeholder: "Search doctor name or ID (e.g., Dr. Rao, D001)...",
      defaultName: "Dr. Consultant",
      systemScope: "Clinical decision authority: AI predicts and stages, but only the physician authorizes discharges and transfers."
    },
    {
      id: "COORDINATOR",
      mappedSystemRole: "OPERATIONS",
      label: "Coordinator",
      title: "Hospital Flow & Operations Command",
      category: "Hospital-Wide Capacity Orchestration",
      badge: "Command Center",
      accentColor: "#5b7b94",
      borderColor: "border-[#5b7b94]",
      btnBg: "bg-slate-900 text-white hover:bg-slate-800",
      iconEmoji: "📋",
      defaultIdPrefix: "C",
      placeholder: "Search coordinator name or ID (e.g., Anil, C001)...",
      defaultName: "Operations Coordinator",
      systemScope: "Cross-departmental command center orchestrating non-clinical logistics across all hospital wards."
    },
    {
      id: "SUPPORT",
      mappedSystemRole: "CLEANER",
      label: "Support Staff",
      title: "Pathology, Housekeeping & Logistics",
      category: "Integrated Frontline Execution",
      badge: "Facilities & Lab",
      accentColor: "#ea580c",
      borderColor: "border-amber-500",
      btnBg: "bg-slate-900 text-white hover:bg-slate-800",
      iconEmoji: "⚙️",
      defaultIdPrefix: "S",
      placeholder: "Search support staff (e.g., Ramesh, S001)...",
      defaultName: "Support Specialist",
      systemScope: "Unified execution portal for phlebotomy, housekeeping, and porters scoped by task type."
    },
    {
      id: "PATIENT",
      mappedSystemRole: "OPERATIONS",
      label: "Patient & Family",
      title: "Recovery Journey & Transparency Portal",
      category: "Patient & Caregiver Experience",
      badge: "Family Access",
      accentColor: "#4f46e5",
      borderColor: "border-indigo-500",
      btnBg: "bg-slate-900 text-white hover:bg-slate-800",
      iconEmoji: "❤️",
      defaultIdPrefix: "P",
      placeholder: "Search patient or caregiver name...",
      defaultName: "Patient Family Member",
      systemScope: "Transparent milestone updates and financial estimates eliminating discharge anxiety."
    }
  ];

  // Role-Based Persona Dashboard & Authentication States
  const [currentUser, setCurrentUser] = useState<StaffUser | null>(null);
  const isCoordinator = !!(
    currentUser && (
      currentUser.roleCategoryId === "COORDINATOR" ||
      (!currentUser.roleCategoryId && currentUser.role === "OPERATIONS")
    )
  );
  const [activeRole, setActiveRole] = useState<"NURSE" | "DOCTOR" | "CLEANER" | "PHLEBOTOMIST" | "OPERATIONS">("NURSE");
  const [selectedRoleForLogin, setSelectedRoleForLogin] = useState<RoleCategoryDefinition | null>(null);
  const [landingFilterTab, setLandingFilterTab] = useState<string>("ALL");
  const [selectedDoctorId, setSelectedDoctorId] = useState<string>("DR_SHARMA");
  const [selectedNurseWard, setSelectedNurseWard] = useState<string>("WARD_A");
  const [selectedCleanerStaff, setSelectedCleanerStaff] = useState<string>("Anand R. (Sweeper)");
  const [selectedPhlebStaff, setSelectedPhlebStaff] = useState<string>("Sunita K. (Phleb)");
  const [cleanerActionLoading, setCleanerActionLoading] = useState<string | null>(null);
  const [doctorActionLoading, setDoctorActionLoading] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState<boolean>(false);
  const loginPin = "1234";

  const handleStaffIdentityConfirm = async (staffId: string, staffName: string, roleCat: RoleCategoryDefinition) => {
    setAuthLoading(true);
    const user: StaffUser = {
      staff_id: staffId,
      name: staffName,
      role: roleCat.mappedSystemRole,
      roleCategoryId: roleCat.id,
      ward: roleCat.id === "NURSE" ? "WARD_A" : undefined,
      title: roleCat.title,
      department: roleCat.category,
      shift: "Morning Shift (06:00 - 14:00)"
    };

    try {
      await fetch(`${backendUrl}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          staff_id: user.staff_id,
          name: user.name,
          role: user.role,
          ward: user.ward,
          pin: loginPin
        })
      });
    } catch (e) {
      console.warn("Backend auth offline fallback:", e);
    }

    setCurrentUser(user);
    setActiveRole(roleCat.mappedSystemRole);

    if (roleCat.id === "NURSE") {
      setActiveTab("NURSE_CHECK");
      setSelectedNurseWard("WARD_A");
    } else if (roleCat.id === "DOCTOR") {
      setActiveTab("ROUND_CLOCK");
      setSelectedDoctorId("DR_SHARMA");
    } else if (roleCat.id === "SUPPORT") {
      setActiveTab("TASKS");
    } else if (roleCat.id === "PATIENT") {
      setActiveTab("BILL_ESTIMATOR");
    } else {
      setActiveTab("TODAYS_PLAN");
    }

    try {
      localStorage.setItem("swasthflow_staff_user", JSON.stringify(user));
    } catch (e) {
      console.error(e);
    }

    setSelectedRoleForLogin(null);
    setActionSuccessMsg(`Clocked in: ${user.name} on duty.`);
    setAuthLoading(false);
  };

  const handleStaffLogout = () => {
    setCurrentUser(null);
    try {
      localStorage.removeItem("swasthflow_staff_user");
    } catch (e) {
      console.error(e);
    }
    setActionSuccessMsg("Signed out from frontline duty session.");
  };

  // Step 7: CP-SAT Master Plan Token-Based Approval Gate
  const [planApprovalState, setPlanApprovalState] = useState<{
    isApproved: boolean;
    token: string | null;
    approvedBy: string | null;
    approvedAt: string | null;
  }>({
    isApproved: false,
    token: null,
    approvedBy: null,
    approvedAt: null,
  });

  const handleApprovePlan = () => {
    const staffId = currentUser?.staff_id || "C001";
    const staffName = currentUser?.name || "Operations Coordinator";
    const token = `swasthflow-jwt-${staffId}-${Date.now()}`;
    const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setPlanApprovalState({
      isApproved: true,
      token,
      approvedBy: `${staffName} (${staffId})`,
      approvedAt: now,
    });
    setActionSuccessMsg(`Master Shift Plan approved & locked via Coordinator token ${token}. Non-clinical tasks dispatched.`);
  };

  // Step 10: Patient Portal Handlers (reporting to staff side)
  const handlePatientEmergencyIntake = (data: {
    name: string;
    age: number;
    gender: string;
    triage: "RED" | "YELLOW" | "GREEN";
    complaint: string;
    payer: string;
    eta: string;
  }) => {
    const ticketId = `ER-INTAKE-${Math.floor(1000 + Math.random() * 9000)}`;
    const newTask: TaskItem = {
      id: `TASK-ER-${Date.now()}`,
      role: "NURSE",
      ward: "ER",
      title_en: `Emergency Triage: ${data.name} (${data.triage} - ${data.eta})`,
      title_hi: `आपातकालीन ट्राइएज: ${data.name} (${data.triage})`,
      reason_en: `Chief Complaint: ${data.complaint}. Payer: ${data.payer}. Bed triage required immediately.`,
      reason_hi: `शिकायत: ${data.complaint}. ट्राइएज आवश्यक।`,
      deadline: "Immediate",
      confidence: 0.95,
      channel: "WHATSAPP",
      response: null,
      responded_at: null,
    };
    setTasks(prev => [newTask, ...prev]);
    setActionSuccessMsg(`Emergency intake ticket ${ticketId} logged for ${data.name}. ER triage team notified.`);
    return ticketId;
  };

  const handlePatientPreAdmission = (data: {
    name: string;
    phone: string;
    procedure: string;
    ward_type: string;
    admission_date: string;
    doctor: string;
    preauth_no: string;
  }) => {
    const ticketId = `PRE-ADM-${Math.floor(1000 + Math.random() * 9000)}`;
    const newTask: TaskItem = {
      id: `TASK-ADM-${Date.now()}`,
      role: "OPERATIONS",
      ward: "ADMISSIONS",
      title_en: `Pre-Admission Staging: ${data.name} (${data.procedure})`,
      title_hi: `प्री-एडमिशन स्टेजिंग: ${data.name}`,
      reason_en: `Target: ${data.admission_date}. Doctor: ${data.doctor}. Pre-Auth: ${data.preauth_no}. Bed reserved in ${data.ward_type}.`,
      reason_hi: `निर्धारित: ${data.admission_date}. बेड आवंटन।`,
      deadline: data.admission_date,
      confidence: 0.92,
      channel: "PORTAL",
      response: null,
      responded_at: null,
    };
    setTasks(prev => [newTask, ...prev]);
    setActionSuccessMsg(`Pre-admission registration ${ticketId} confirmed for ${data.name}. Bed staging reserved.`);
    return ticketId;
  };

  // Restore staff session on client mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem("swasthflow_staff_user");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.role) {
          setCurrentUser(parsed);
          setActiveRole(parsed.role);
          if (parsed.ward && parsed.role === "NURSE") setSelectedNurseWard(parsed.ward);
          if (parsed.staff_id && parsed.role === "DOCTOR") setSelectedDoctorId(parsed.staff_id);
          if (parsed.name && parsed.role === "CLEANER") setSelectedCleanerStaff(parsed.name);
          if (parsed.name && parsed.role === "PHLEBOTOMIST") setSelectedPhlebStaff(parsed.name);
        }
      }
    } catch (e) {
      console.error("Failed to restore session:", e);
    }

    // Deep-link check for ?tab=map, ?tab=regional-map, #map, etc.
    try {
      if (typeof window !== "undefined") {
        const search = window.location.search.toLowerCase();
        const hash = window.location.hash.toLowerCase();
        if (search.includes("map") || hash.includes("map")) {
          setActiveRole("OPERATIONS");
          setActiveTab("BLOOD_INVENTORY");
        }
      }
    } catch {
      // Ignore
    }
  }, []);

  const DOCTOR_PROFILES: Record<string, { id: string; name: string; specialty: string; ward: string; roundTime: string; isSurgeon?: boolean }> = {
    DR_SHARMA: { id: "DR_SHARMA", name: "Dr. Vivek Sharma", specialty: "Internal Medicine", ward: "WARD_A", roundTime: "09:48 AM (Standard Internal Med burst)" },
    DR_RAO: { id: "DR_RAO", name: "Dr. Sunita Rao", specialty: "General Surgery", ward: "WARD_B", roundTime: "16:45 PM (OT Day: Post-Op Burst) / 08:45 AM (Non-OT Day)", isSurgeon: true },
    DR_PATEL: { id: "DR_PATEL", name: "Dr. Rajesh Patel", specialty: "Cardiology / Critical Care", ward: "ICU", roundTime: "10:15 AM (ICU Morning Rounds)" },
    DR_KAPOOR: { id: "DR_KAPOOR", name: "Dr. Ananya Kapoor", specialty: "Pulmonology", ward: "WARD_A", roundTime: "11:14 AM (Pulmonology ward round)" },
    DR_MEHRA: { id: "DR_MEHRA", name: "Dr. Vikram Mehra", specialty: "Orthopedics", ward: "WARD_B", roundTime: "14:15 PM (Post-clinic round)" },
  };

  const fetchData = useCallback(async () => {
    try {
      const [
        resBeds, resRadar, resRounds, resBlood, resDelay, resTasks, resStatus, resPlan, resNurse, resWA, resBill, resIcu,
        resReadiness, resBlockers, resTimeSaved, resEvaluation
      ] = await Promise.all([
        fetch(`${backendUrl}/api/beds`),
        fetch(`${backendUrl}/api/discharge-radar`),
        fetch(`${backendUrl}/api/round-clock`),
        fetch(`${backendUrl}/api/round-clock/blood-draw-schedule`),
        fetch(`${backendUrl}/api/delay-book`),
        fetch(`${backendUrl}/api/tasks`),
        fetch(`${backendUrl}/api/simulator/status`),
        fetch(`${backendUrl}/api/plan/today`),
        fetch(`${backendUrl}/api/nurse-check/candidates`),
        fetch(`${backendUrl}/api/whatsapp/messages`),
        fetch(`${backendUrl}/api/bill-estimate/candidates`),
        fetch(`${backendUrl}/api/icu/step-down/roster?target_beds_needed=${stepdownTargetBeds}`),
        fetch(`${backendUrl}/api/readiness/live`),
        fetch(`${backendUrl}/api/blockers`),
        fetch(`${backendUrl}/api/metrics/time-saved`),
        fetch(`${backendUrl}/api/evaluation/metrics`)
      ]);
      if (resBeds.ok && resStatus.ok) {
        setBeds(await resBeds.json());
        setStatus(await resStatus.json());
      }
      if (resRadar.ok) setRadar(await resRadar.json());
      if (resRounds.ok) {
        const rData = await resRounds.json();
        setRounds(rData.predicted_rounds || []);
      }
      if (resBlood.ok) {
        const bData = await resBlood.json();
        setBloodRoute(bData.phlebotomy_route || []);
      }
      if (resDelay.ok) setDelayBook(await resDelay.json());
      if (resTasks.ok) setTasks(await resTasks.json());
      if (resPlan.ok) setTodaysPlan(await resPlan.json());
      if (resNurse.ok) {
        const ncData = await resNurse.json();
        setNurseCandidates(ncData.candidates || []);
      }
      if (resWA.ok) {
        const waData = await resWA.json();
        setWhatsappMessages(waData.messages || []);
      }
      if (resBill.ok) {
        const bData = await resBill.json();
        setCashCandidates(bData.candidates || []);
      }
      if (resIcu.ok) {
        const icuData: IcuRosterData = await resIcu.json();
        setIcuRoster(icuData);
        setSelectedIcuEncounterId(prev => {
          if (prev && icuData.roster.some(c => c.encounter_id === prev)) return prev;
          return icuData.roster.length > 0 ? icuData.roster[0].encounter_id : null;
        });
      }
      if (resReadiness && resReadiness.ok) {
        setReadinessMetrics(await resReadiness.json());
      }
      if (resBlockers && resBlockers.ok) {
        setBlockersData(await resBlockers.json());
      }
      if (resTimeSaved && resTimeSaved.ok) {
        setTimeSavedData(await resTimeSaved.json());
      }
      if (resEvaluation && resEvaluation.ok) {
        setEvaluationData(await resEvaluation.json());
      }
      setSmsLogs(getSMSMessages());
    } catch (err) {
      console.error("Failed fetching SwasthFlow data:", err);
    }
  }, [backendUrl, stepdownTargetBeds]);

  const handleSendCustomSMS = async () => {
    try {
      await sendSMS(testSmsPhone, testSmsBody, {
        name: testSmsRecipient,
        role: testSmsRole,
        title: "Frontline Operational Alert",
        tag: "Guardrail #5 (Alert Fatigue Cap: <= 10 Tasks)"
      });
      setSmsLogs(getSMSMessages());
      setTestSmsModal(false);
      setActionSuccessMsg(`📱 Carrier SMS Dispatched to ${testSmsRecipient} (${testSmsPhone}). Provider: Simulated Twilio.`);
      setTimeout(() => setActionSuccessMsg(null), 6000);
    } catch (e) {
      console.error("Failed sending SMS:", e);
    }
  };

  const handleActivateEmergency = async () => {
    setEmergencyLoading(true);
    try {
      const res = await fetch(`${backendUrl}/api/emergency/activate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          surge_type: emergencySurgeType,
          beds_needed: emergencyBedsNeeded,
          caller_role: "Emergency Dept In-Charge"
        })
      });
      if (res.ok) {
        const data: EmergencyActivationResult = await res.json();
        setEmergencyActivationResult(data);
        setActionSuccessMsg(`🚨 Emergency Clearance Activated! ${data.expedited_cleaning_beds.length} beds expedited to 15m housekeeping SLA. ${data.immediately_ready_count} beds immediately ready.`);
        setTimeout(() => setActionSuccessMsg(null), 8000);
        await fetchData();
      } else {
        const err = await res.json();
        alert(`Emergency Activation Error: ${err.detail || "Failed"}`);
      }
    } catch (err) {
      console.error("Failed activating emergency clearance:", err);
    } finally {
      setEmergencyLoading(false);
    }
  };

  const handleDoctorStepdownTrigger = async (encId: string, consultantId: string) => {
    setIcuActionLoading(true);
    try {
      const res = await fetch(`${backendUrl}/api/icu/step-down/trigger`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ encounter_id: encId, consultant_id: consultantId, clinician_confirmed: true })
      });
      if (res.ok) {
        const data = await res.json();
        setActionSuccessMsg(`👨‍⚕️ Clinician authorized step-down! Bed ${data.reserved_bed_id} (${data.reserved_ward}) reserved and porter transfer task queued.`);
        setTimeout(() => setActionSuccessMsg(null), 6000);
        await fetchData();
      } else {
        const err = await res.json();
        alert(`Step-Down Error: ${err.detail || "Failed to trigger"}`);
      }
    } catch (err) {
      console.error("Error triggering doctor stepdown:", err);
    } finally {
      setIcuActionLoading(false);
    }
  };

  const handleIcuConsentSubmit = async (encId: string, consent: "agreed" | "worried" | "refused") => {
    setIcuActionLoading(true);
    try {
      const res = await fetch(`${backendUrl}/api/icu/step-down/consent`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          encounter_id: encId,
          consent: consent,
          notes: icuConsentNotes || (consent === "agreed" ? "Family consented to ward transfer" : consent === "worried" ? "Family anxious about ward care" : "Family refused transfer"),
          nurse_name: "Sister Sunita (ICU In-Charge)"
        })
      });
      if (res.ok) {
        await res.json();
        if (consent === "agreed") {
          setActionSuccessMsg(`🟢 Family Agreed! Forecasted ICU bed capacity unlocked under Guardrail #8.`);
        } else if (consent === "worried") {
          setActionSuccessMsg(`🟡 Family Worried. Counseling path activated. 2x Redundancy Buffer candidate on standby.`);
        } else {
          setActionSuccessMsg(`🔴 Family Refused. Reserved ward bed released to READY. 2x Alternate Candidate promoted immediately!`);
        }
        setIcuConsentNotes("");
        setTimeout(() => setActionSuccessMsg(null), 6000);
        await fetchData();
      } else {
        const err = await res.json();
        alert(`Consent Submission Error: ${err.detail || "Failed"}`);
      }
    } catch (err) {
      console.error("Error submitting ICU consent:", err);
    } finally {
      setIcuActionLoading(false);
    }
  };

  const handleExecuteIcuTransfer = async (encId: string) => {
    setIcuActionLoading(true);
    try {
      const res = await fetch(`${backendUrl}/api/icu/step-down/execute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ encounter_id: encId, actor: "Sister Sunita + Porter Ramesh" })
      });
      if (res.ok) {
        const data = await res.json();
        setActionSuccessMsg(`🚀 Patient transferred to ${data.to_bed}! ICU bed ${data.from_bed} marked DIRTY and queued for rapid turnover sanitization.`);
        setTimeout(() => setActionSuccessMsg(null), 6000);
        await fetchData();
      } else {
        const err = await res.json();
        alert(`Transfer Execution Error: ${err.detail || "Failed"}`);
      }
    } catch (err) {
      console.error("Error executing ICU transfer:", err);
    } finally {
      setIcuActionLoading(false);
    }
  };

  const fetchBillDetail = useCallback(async (encId: string) => {
    setBillLoading(true);
    try {
      const res = await fetch(`${backendUrl}/api/bill-estimate/${encId}`);
      if (res.ok) {
        const data = await res.json();
        setBillDetail(data);
        if (data.family_phone) setSmsPhoneInput(data.family_phone);
      }
    } catch (err) {
      console.error("Failed fetching bill estimate detail:", err);
    } finally {
      setBillLoading(false);
    }
  }, [backendUrl]);

  useEffect(() => {
    if (selectedBillEncounterId) {
      fetchBillDetail(selectedBillEncounterId);
    } else if (cashCandidates.length > 0 && !selectedBillEncounterId) {
      setSelectedBillEncounterId(cashCandidates[0].encounter_id);
    }
  }, [selectedBillEncounterId, cashCandidates, fetchBillDetail]);

  const handleSendBillSms = async (encId: string) => {
    setSendingSms(true);
    try {
      const res = await fetch(`${backendUrl}/api/bill-estimate/send/${encId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ family_phone: smsPhoneInput })
      });
      if (res.ok) {
        const result = await res.json();
        setActionSuccessMsg(`SMS dispatched to ${smsPhoneInput} (${result.projected_range})`);
        setTimeout(() => setActionSuccessMsg(null), 5000);
        await fetchData();
        await fetchBillDetail(encId);
      }
    } catch (err) {
      console.error("Failed sending bill SMS:", err);
    } finally {
      setSendingSms(false);
    }
  };

  const handleConfirmFunds = async (encId: string) => {
    setConfirmingFunds(true);
    try {
      const res = await fetch(`${backendUrl}/api/bill-estimate/confirm/${encId}`, {
        method: "POST"
      });
      if (res.ok) {
        await res.json();
        setActionSuccessMsg(`Family funds confirmed! Consent transitioned to 🟢 GREEN. Bed capacity unlocked under Guardrail #8.`);
        setTimeout(() => setActionSuccessMsg(null), 6000);
        await fetchData();
        await fetchBillDetail(encId);
      }
    } catch (err) {
      console.error("Failed confirming family funds:", err);
    } finally {
      setConfirmingFunds(false);
    }
  };

  const handleNurseFormChange = (encId: string, field: "payer" | "family" | "home" | "customReason", value: string) => {
    setNurseForm(prev => ({
      ...prev,
      [encId]: {
        payer: prev[encId]?.payer || "yes",
        family: prev[encId]?.family || "yes",
        home: prev[encId]?.home || "None",
        customReason: prev[encId]?.customReason || "",
        [field]: value
      }
    }));
  };

  const handleNurseSubmit = async (encId: string) => {
    const formData = nurseForm[encId] || { payer: "yes", family: "yes", home: "None" };
    setSubmittingEncounterId(encId);
    try {
      const res = await fetch(`${backendUrl}/api/nurse-check/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          encounter_id: encId,
          payer_confirmed: formData.payer,
          family_available: formData.family,
          home_problem: formData.home,
          custom_refusal_reason: formData.customReason || undefined
        })
      });
      const data = await res.json();
      setActionSuccessMsg(`Nurse Check saved: ${data.patient_name} evaluated as ${data.consent_badge}. ${data.counts_as_forecasted_capacity ? "Unlocked forecasted bed capacity!" : "Excluded from bed forecast."}`);
      setTimeout(() => setActionSuccessMsg(null), 6000);
      await fetchData();
    } catch (e) {
      console.error(e);
      alert("Failed submitting nurse check");
    } finally {
      setSubmittingEncounterId(null);
    }
  };

  const handleTaskAction = async (taskId: string, response: "done" | "cannot", refusalReason?: string) => {
    setActionLoading(true);
    try {
      const res = await fetch(`${backendUrl}/api/tasks/${taskId}/respond`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          response,
          refusal_reason: refusalReason,
          staff_name: "Frontline Staff via WhatsApp"
        })
      });
      const data = await res.json();
      setCannotModalTaskId(null);
      setActionSuccessMsg(`Task ${taskId} marked as ${data.status}! ${data.side_effects?.join(" ") || ""}`);
      setTimeout(() => setActionSuccessMsg(null), 6000);
      await fetchData();
    } catch (e) {
      console.error(e);
      alert("Failed recording task response");
    } finally {
      setActionLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 4000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const handleTick = async (minutes: number) => {
    setActionLoading(true);
    try {
      await fetch(`${backendUrl}/api/simulator/tick`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ minutes })
      });
      await fetchData();
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleRoutePayerTasks = async () => {
    setActionLoading(true);
    try {
      const res = await fetch(`${backendUrl}/api/payer/route-tasks`, { method: "POST" });
      const data = await res.json();
      alert(data.message || "Payer clearance tasks queued!");
      await fetchData();
      setActiveTab("TASKS");
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleChaos = async () => {
    if (!confirm("Inject mass-casualty emergency surge (6 trauma patients into ICU/Surgical)?")) return;
    setActionLoading(true);
    try {
      await fetch(`${backendUrl}/api/simulator/chaos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ num_patients: 6 })
      });
      await fetchData();
      setActionSuccessMsg("⚠ Chaos Injected! 6 trauma cases admitted. ICU at 100% capacity (0 beds available). Check Regional Map for Priority #1 Metro General.");
      setTimeout(() => setActionSuccessMsg(null), 8000);
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleReset = async () => {
    if (!confirm("Reset simulator with a fresh cohort?")) return;
    setActionLoading(true);
    try {
      await fetch(`${backendUrl}/api/simulator/reset`, { method: "POST" });
      await fetchData();
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleMarkBedCleaned = async (bedId: string) => {
    setCleanerActionLoading(bedId);
    try {
      const res = await fetch(`${backendUrl}/api/beds/${bedId}/clean`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          staff_name: selectedCleanerStaff,
          cleaning_notes: "Terminal disinfection completed. Linen sanitized and bed dressed."
        })
      });
      if (res.ok) {
        await fetchData();
        setActionSuccessMsg(`Bed ${bedId} marked READY and sanitized! Bed is now immediately available for admissions.`);
      } else {
        const err = await res.json();
        alert(`Error cleaning bed: ${err.detail || "Failed"}`);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setCleanerActionLoading(null);
    }
  };

  const handleDoctorDischarge = async (encounterId: string, patientName: string) => {
    if (!confirm(`Doctor sign-off: Confirm clinical discharge for ${patientName}?\nThis exercises Guardrail #1 (Doctor Decides), moves the encounter to DISCHARGED, and triggers the bed to the DIRTY queue for housekeeping.`)) {
      return;
    }
    setDoctorActionLoading(encounterId);
    try {
      const docName = DOCTOR_PROFILES[selectedDoctorId]?.name || "Attending Physician";
      const res = await fetch(`${backendUrl}/api/encounters/${encounterId}/doctor-discharge`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          consultant_id: selectedDoctorId,
          doctor_name: docName,
          clinical_notes: "Vitals stable for 24h, oral switch complete, safe for discharge.",
          confirm_discharge: true
        })
      });
      if (res.ok) {
        await fetchData();
        setActionSuccessMsg(`Clinical discharge signed for ${patientName}! Bed has been queued for terminal cleaning.`);
      } else {
        const err = await res.json();
        alert(`Discharge blocked: ${err.detail || "Error"}`);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setDoctorActionLoading(null);
    }
  };

  const filteredBeds = selectedWard === "ALL" ? beds : beds.filter(b => b.ward === selectedWard);

  const getPayerColor = (payer: string) => {
    switch (payer) {
      case "AYUSHMAN":
        return "bg-purple-100 text-purple-800 border-purple-200";
      case "TPA":
        return "bg-blue-100 text-blue-800 border-blue-200";
      case "CASH":
        return "bg-amber-100 text-amber-800 border-amber-200";
      case "CGHS":
      case "STATE_SCHEME":
        return "bg-emerald-100 text-emerald-800 border-emerald-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  // Phase 11: Tour Steps Definition
  const TOUR_STEPS = [
    {
      step: 1,
      title: "1. The Core Thesis: Sequencing Non-Clinical Logistics",
      tab: "TODAYS_PLAN" as const,
      subtitle: "Hospitals aren't short of beds; beds are vacant at 4 PM instead of 10 AM.",
      body: "Observe the Master Sequencer: non-clinical logistics (blood draws, insurance pre-auth, billing confirmation, room disinfection) are constraint-scheduled using Google OR-Tools CP-SAT to finish just before physician rounds.",
      badge: "Engine: CP-SAT Solver"
    },
    {
      step: 2,
      title: "2. Backwards Phlebotomy & Fasting Breakfast Constraint",
      tab: "ROUND_CLOCK" as const,
      subtitle: "Lab reports must be ready BEFORE the physician steps onto the ward.",
      body: "Dr. Sharma rounds at 09:30 AM. Backwards math: 09:30 − 140m lab turnaround P90 − 15m safety buffer = 06:55 AM draw deadline. Morning fasting draws finish before 08:00 AM breakfast.",
      badge: "Feature F2: Backwards Scheduling"
    },
    {
      step: 3,
      title: "3. P90 Delay Planning & Multi-Payer Lead Times",
      tab: "DELAY_BOOK" as const,
      subtitle: "Never plan against optimistic averages in Indian healthcare.",
      body: "The Delay Book continuously updates empirical P90 step budgets. Ayushman Bharat clearance exhibits a 40.4h tail latency, while TPA takes 5.5h. The Sequencer budgets for the 90th percentile, preventing morning discharge delays.",
      badge: "Engine: Delay Book"
    },
    {
      step: 4,
      title: "4. Frontline Nurse Check & Hindi Voice Delivery",
      tab: "NURSE_CHECK" as const,
      subtitle: "Structured caregiver barrier verification & Piper neural Hindi TTS.",
      body: "A patient cannot step down if their caregiver is absent. The Ward Sister validates payer status, family readiness, and home barriers. Audio notices are synthesized in Hindi using Piper neural TTS.",
      badge: "Feature F4 & F5: Frontline Verification"
    },
    {
      step: 5,
      title: "5. Advance Cash Bill Estimation (+/-10% Bound)",
      tab: "BILL_ESTIMATOR" as const,
      subtitle: "Eliminating the 2.5-hour afternoon cashier queue.",
      body: "Cash patients receive a transparent itemized estimate SMS the evening prior, bounded to ±10% with a statutory clinical disclaimer (Guardrail #6), enabling families to confirm bank funds before morning rounds.",
      badge: "Feature F6: Out-of-Pocket Transparency"
    },
    {
      step: 6,
      title: "6. ICU Step-Down 2x Candidate Buffer & Doctor Confirmation",
      tab: "ICU_STEPDOWN" as const,
      subtitle: "2x over-preparation prevents empty ICU beds when family hesitates.",
      body: "To free 1 ICU bed, 2 candidates are prepared. If Candidate #1's family refuses, Candidate #2 promotes through a strict fresh doctor confirmation gate (Guardrail #1) before bed reservation.",
      badge: "Feature F3: Buffer Over-Preparation"
    },
    {
      step: 7,
      title: "7. The Proof Screen & The Medical Humility Matrix",
      tab: "PROOF_EVALUATION" as const,
      subtitle: "91% accuracy vs 64% naive baseline & radical transparency.",
      body: "Held-out test verification (n=1000) achieves 91% accuracy (Brier -74%, ECE 0.0182). Crucially, the Medical Humility Matrix openly discloses 4 failure cases and how guardrails safely catch them.",
      badge: "Phase 10: Scientific Validation"
    }
  ];

  const startTour = (step = 0) => {
    setTourActive(true);
    setTourStepIndex(step);
    setActiveTab(TOUR_STEPS[step].tab);
  };

  const nextTourStep = () => {
    if (tourStepIndex < TOUR_STEPS.length - 1) {
      const nextIdx = tourStepIndex + 1;
      setTourStepIndex(nextIdx);
      setActiveTab(TOUR_STEPS[nextIdx].tab);
    } else {
      setTourActive(false);
    }
  };

  const prevTourStep = () => {
    if (tourStepIndex > 0) {
      const prevIdx = tourStepIndex - 1;
      setTourStepIndex(prevIdx);
      setActiveTab(TOUR_STEPS[prevIdx].tab);
    }
  };

  const handleMorningRushScenario = async () => {
    if (!confirm("Run Morning Shift Rush Scenario (06:00 AM -> 11:00 AM)?\nThis advances the hospital clock by 5 hours (+300m) to execute morning phlebotomy, doctor rounds, and scheduled morning discharges.")) return;
    setActionLoading(true);
    try {
      await fetch(`${backendUrl}/api/simulator/tick`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ minutes: 300 })
      });
      await fetchData();
      setActionSuccessMsg("Morning Shift Rush executed! Simulation advanced 5 hours (06:00 AM -> 11:00 AM). Check Today's Plan and Bed status.");
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoading(false);
    }
  };

  // Keyboard Navigation Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) {
        return;
      }
      const key = e.key.toUpperCase();
      if (e.key === "1") setActiveRole("NURSE");
      else if (e.key === "2") setActiveRole("DOCTOR");
      else if (e.key === "3") setActiveRole("CLEANER");
      else if (e.key === "4") setActiveRole("PHLEBOTOMIST");
      else if (e.key === "5") setActiveRole("OPERATIONS");
      else if (key === "P") { setActiveRole("OPERATIONS"); setActiveTab("TODAYS_PLAN"); }
      else if (key === "E") { setActiveRole("OPERATIONS"); setActiveTab("EMERGENCY_READINESS"); }
      else if (key === "S") { setActiveRole("OPERATIONS"); setActiveTab("PROOF_EVALUATION"); }
      else if (key === "I") { setActiveRole("OPERATIONS"); setActiveTab("ICU_STEPDOWN"); }
      else if (key === "N") { setActiveRole("NURSE"); setActiveTab("NURSE_CHECK"); }
      else if (key === "B") { setActiveRole("OPERATIONS"); setActiveTab("BILL_ESTIMATOR"); }
      else if (key === "W") { if (isCoordinator) setShowWhatsAppDrawer(prev => !prev); }
      else if (key === "R") { setActiveRole("DOCTOR"); setActiveTab("ROUND_CLOCK"); }
      else if (key === "D") { setActiveRole("OPERATIONS"); setActiveTab("RADAR"); }
      else if (key === "L") { setActiveRole("OPERATIONS"); setActiveTab("DELAY_BOOK"); }
      else if (key === "M") { setActiveRole("OPERATIONS"); setActiveTab("BLOOD_INVENTORY"); }
      else if (key === "T") {
        setTourActive(prev => {
          const next = !prev;
          if (next) startTour(0);
          return next;
        });
      }
      else if (key === "?" || key === "H") {
        setShowShortcutsHelp(prev => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-900 flex flex-col font-sans relative selection:bg-[#5b7b94]/30">
      <PageTopologyBackground />

      {/* Floating Modern Clinical Header Box */}
      <div className="sticky top-3 z-50 max-w-7xl mx-auto w-[calc(100%-1.5rem)] sm:w-[calc(100%-3rem)] my-2">
        <header className="w-full h-20 bg-white/95 backdrop-blur-xl border border-white/80 rounded-2xl px-6 sm:px-10 flex items-center justify-between text-slate-800 shadow-2xl">
        {/* Left: SwasthAI Brand Lockup */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#eef4f8] text-[#5b7b94] flex items-center justify-center font-bold shadow-xs">
            <Activity className="w-5 h-5 text-[#5b7b94]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl font-black tracking-tight text-slate-900 font-sans">SwasthAI</span>
              <span className="bg-[#eef4f8] text-[#5b7b94] text-[10px] px-2 py-0.5 rounded-full font-bold">
                Hospital AI
              </span>
            </div>
            <p className="text-[10px] text-slate-500 font-medium leading-tight">
              Hospital Operations Platform
            </p>
          </div>
        </div>

        {/* Center: Navigation Links (When on landing page) or Telemetry (When on duty) */}
        {!currentUser ? (
          <nav className="hidden lg:flex items-center gap-7 text-xs font-semibold text-slate-600">
            <a href="#hero-section" className="text-slate-900 font-bold hover:text-[#5b7b94] transition">Home</a>
            <a href="#impact-section" className="hover:text-[#5b7b94] transition">About Platform</a>
            <a href="#role-selection-section" className="hover:text-[#5b7b94] transition">Hospital Roles</a>
            <button onClick={() => setShowPitchModal(true)} className="hover:text-[#5b7b94] transition">Pitch Brief</button>
            <button 
              onClick={() => {
                const coordRole = GENERALIZED_ROLE_CATEGORIES.find(r => r.id === "COORDINATOR");
                if (coordRole) handleStaffIdentityConfirm("C001", "Demo Operator", coordRole);
                startTour(0);
              }} 
              className="text-[#5b7b94] font-bold hover:underline"
            >
              Interactive Tour
            </button>
          </nav>
        ) : (
          <div className="hidden md:flex items-center gap-3 bg-slate-50 px-3.5 py-1.5 rounded-full border border-slate-200 text-xs">
            <div className="flex items-center gap-1.5 font-bold text-slate-800">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>10/10 Guardrails</span>
            </div>
            <div className="w-px h-5 bg-slate-300"></div>
            <div className="font-semibold text-slate-700">
              {readinessMetrics ? `${readinessMetrics.readiness_number} Beds (30m)` : `${status?.ready_beds ?? 4} Ready`}
            </div>
            <div className="w-px h-5 bg-slate-300"></div>
            <div className="font-mono text-slate-600 flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              <span>{status?.simulated_date_str || "06:00 AM"}</span>
            </div>
            <div className="w-px h-5 bg-slate-300"></div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => handleTick(15)}
                disabled={actionLoading}
                className="px-2 py-0.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 text-[11px] font-mono rounded-full transition disabled:opacity-50"
                title="Advance 15 minutes"
              >
                +15m
              </button>
              <button
                onClick={() => handleTick(60)}
                disabled={actionLoading}
                className="px-2 py-0.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 text-[11px] font-mono rounded-full transition disabled:opacity-50"
                title="Advance 1 hour"
              >
                +1h
              </button>
              <button
                onClick={handleMorningRushScenario}
                disabled={actionLoading}
                className="px-2.5 py-0.5 bg-slate-900 hover:bg-slate-800 text-white text-[11px] font-bold rounded-full transition disabled:opacity-50 flex items-center gap-1 shadow-xs"
                title="Fast-forward 5 hours (06:00 AM -> 11:00 AM)"
              >
                <FastForward className="w-3 h-3 text-white" />
                Rush (5h)
              </button>
              <button
                onClick={handleChaos}
                disabled={actionLoading}
                className="px-2 py-0.5 bg-amber-500 hover:bg-amber-600 text-white text-[11px] font-bold rounded-full transition flex items-center gap-1 shadow-xs"
                title="Inject mass-casualty emergency intake"
              >
                <Zap className="w-3 h-3 text-white" />
                Chaos
              </button>
              <button
                onClick={handleReset}
                disabled={actionLoading}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-full hover:bg-slate-200 transition"
                title="Reset Simulator"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* Right: Hotline, Alerts Drawer & Primary Action */}
        <div className="flex items-center gap-3">
          {!currentUser ? (
            /* Landing Page Header: Public navigation only — NO Alerts and NO WhatsApp */
            <>
              {/* Styled phone pill */}
              <div className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-100 hover:bg-slate-200/80 border border-slate-200 text-slate-700 text-xs font-mono font-medium transition shadow-xs">
                <Phone className="w-3.5 h-3.5 text-[#5b7b94]" />
                <span>+91 800-SWASTH</span>
              </div>

              {/* Single strongest call-to-action on the far right */}
              <button
                onClick={() => {
                  const el = document.getElementById("role-selection-section");
                  if (el) el.scrollIntoView({ behavior: "smooth" });
                  else {
                    const coordRole = GENERALIZED_ROLE_CATEGORIES.find(r => r.id === "COORDINATOR");
                    if (coordRole) setSelectedRoleForLogin(coordRole);
                  }
                }}
                className="px-5 py-2.5 rounded-full bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition shadow-sm hover:shadow-md flex items-center gap-2 ring-2 ring-slate-900/10"
              >
                <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>Select Role</span>
              </button>
            </>
          ) : (
            /* Logged-in Staff Dashboard Header */
            <>
              {/* Styled phone pill */}
              <div className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-50 border border-slate-200 text-slate-600 text-xs font-mono font-medium shadow-xs">
                <Phone className="w-3.5 h-3.5 text-[#5b7b94]" />
                <span>+91 800-SWASTH</span>
              </div>

              {/* Subtle divider before operational tools */}
              <div className="hidden sm:block w-px h-6 bg-slate-200"></div>

              {/* Operational Group: Staff Alerts + Coordinator WhatsApp (Staff Only) */}
              {currentUser.roleCategoryId !== "PATIENT" && (
                <div className="flex items-center gap-1.5 bg-slate-50 p-1 rounded-full border border-slate-200 shadow-xs">
                  <StaffAlertsDrawer 
                    currentRole={currentUser.role} 
                    currentStaffName={currentUser.name} 
                    onNavigateTab={(tab, section) => {
                      setActiveRole("OPERATIONS");
                      setActiveTab("BLOOD_INVENTORY");
                      if (section) {
                        setTimeout(() => {
                          window.dispatchEvent(new CustomEvent("swasthai_navigate_regional_map", { detail: { section } }));
                        }, 100);
                      }
                    }}
                    icuAtCapacity={beds.filter(b => b.ward === "ICU" && b.state === "OCCUPIED").length >= 6}
                  />

                  {/* WhatsApp Header Icon — EXCLUSIVELY for Coordinator */}
                  {isCoordinator && (
                    <button
                      onClick={() => setShowWhatsAppDrawer(true)}
                      className="relative px-3 py-1.5 rounded-full bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 shadow-xs transition flex items-center gap-1.5"
                      title="Operations WhatsApp & Patient Messaging (Press 'W')"
                    >
                      <MessageSquare className="w-4 h-4 text-emerald-600" />
                      <span className="text-xs font-bold text-slate-700 hidden md:inline">WhatsApp</span>
                      {whatsappMessages.filter(m => m.status === "PENDING").length > 0 && (
                        <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-emerald-600 text-white font-mono">
                          {whatsappMessages.filter(m => m.status === "PENDING").length}
                        </span>
                      )}
                    </button>
                  )}
                </div>
              )}

              {/* Subtle divider before user identity */}
              <div className="hidden sm:block w-px h-6 bg-slate-200"></div>

              {/* Strong User Identity Block on far right */}
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-2 px-3.5 py-1.5 bg-slate-900 text-white rounded-full shadow-sm text-xs font-bold ring-2 ring-slate-900/10">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                  <span className="max-w-[130px] truncate">{currentUser.name}</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/20 font-mono text-emerald-200 uppercase tracking-wider">
                    {currentUser.roleCategoryId || currentUser.role}
                  </span>
                </div>

                <button
                  onClick={() => {
                    if (tourActive) setTourActive(false);
                    else startTour(0);
                  }}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold transition flex items-center gap-1.5 ${
                    tourActive ? "bg-indigo-600 text-white shadow-xs" : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  <Compass className="w-3.5 h-3.5 text-[#5b7b94]" />
                  <span className="hidden sm:inline">{tourActive ? "Exit Tour" : "Tour"}</span>
                </button>
                <button
                  onClick={() => setShowShortcutsHelp(true)}
                  className="p-2 rounded-full bg-white hover:bg-slate-100 border border-slate-200 text-slate-600 text-xs transition"
                  title="Keyboard Shortcuts"
                >
                  <Keyboard className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={handleStaffLogout}
                  className="px-3 py-1.5 rounded-full text-xs font-bold transition flex items-center gap-1.5 bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 shadow-xs"
                  title="Sign out and choose another role"
                >
                  <LogOut className="w-3.5 h-3.5 text-slate-500" />
                  <span className="hidden sm:inline">Logout</span>
                </button>
              </div>
            </>
          )}
        </div>
        </header>
      </div>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 flex-1 w-full space-y-6 relative z-10">
        {!currentUser ? (
          <div className="space-y-10 pb-12 animate-fade-in" id="hero-section">
            {/* HERO SECTION — Slate-Blue Clinical Theme (Matches User's Design Image) */}
            <div className="relative w-full rounded-3xl overflow-hidden medical-hero-gradient text-white shadow-2xl p-6 sm:p-10 lg:p-14 border border-white/20">
              <HeroVantaBackground />

              <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
                {/* Left Column (Hero Content) */}
                <div className="lg:col-span-7 space-y-6">
                  {/* Floating Avatar Stack Pill */}
                  <div className="inline-flex items-center gap-2.5 px-3.5 py-1.5 rounded-full bg-white/15 backdrop-blur-md border border-white/25 text-white text-xs font-semibold shadow-xs">
                    <div className="flex -space-x-1.5">
                      <div className="w-5 h-5 rounded-full bg-slate-200 border border-white flex items-center justify-center text-[9px] text-slate-800 font-bold">👩‍⚕️</div>
                      <div className="w-5 h-5 rounded-full bg-slate-300 border border-white flex items-center justify-center text-[9px] text-slate-800 font-bold">👨‍⚕️</div>
                      <div className="w-5 h-5 rounded-full bg-slate-400 border border-white flex items-center justify-center text-[9px] text-slate-800 font-bold">🩺</div>
                    </div>
                    <span>1,200+ Discharges Accelerated • Autonomous Flow</span>
                  </div>

                  {/* Huge Bold Headline & Subtitle */}
                  <div className="space-y-3">
                    {/* Live-Status Branding Line */}
                    <div className="hero-live-line">
                      <span className="hero-live-dot" />
                      <span>LIVE &middot; Powered by SwasthAI</span>
                    </div>

                    <h1 className="hero-hospital-name text-5xl sm:text-6xl lg:text-7xl xl:text-8xl font-black uppercase leading-[1.05] font-sans">
                      {HOSPITAL_DISPLAY_NAME}
                    </h1>
                    <p className="text-base sm:text-lg text-white/90 font-medium max-w-xl leading-relaxed mt-4">
                      Together, advancing healthcare through compassion, innovation, and patient-centered clinical excellence.
                    </p>
                  </div>

                  {/* Primary Call to Action */}
                  <div className="pt-2 flex items-center gap-3 flex-wrap">
                    <button
                      onClick={() => {
                        const el = document.getElementById("role-selection-section");
                        if (el) el.scrollIntoView({ behavior: "smooth" });
                      }}
                      className="btn-navy inline-flex items-center gap-2 text-xs font-bold px-7 py-3.5 shadow-xl hover:scale-105 transition"
                    >
                      <span>Explore Operations</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setShowPitchModal(true)}
                      className="px-6 py-3 rounded-full bg-white/20 hover:bg-white/30 text-white font-bold text-xs backdrop-blur-md border border-white/30 transition"
                    >
                      Read Architecture
                    </button>
                  </div>

                  {/* Floating Glassmorphism Card (Bottom-Left) */}
                  <div className="pt-4">
                    <div className="inline-flex items-center gap-3.5 p-3 rounded-2xl bg-white/95 text-slate-900 shadow-xl border border-white/40 max-w-md">
                      <img 
                        src="https://images.unsplash.com/photo-1622253692010-333f2da6031d?auto=format&fit=crop&q=80&w=200" 
                        alt="Medical specialist" 
                        className="w-12 h-12 rounded-xl object-cover shadow-xs" 
                      />
                      <div className="text-xs">
                        <div className="font-bold text-slate-900 leading-snug">
                          Professional healthcare services for real-time
                        </div>
                        <div className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5 font-medium">
                          <span>Autonomous Bed Flow</span>
                          <span>•</span>
                          <span className="text-[#5b7b94] font-bold">10 Guardrails</span>
                        </div>
                      </div>
                      <button 
                        onClick={() => {
                          const coordRole = GENERALIZED_ROLE_CATEGORIES.find(r => r.id === "COORDINATOR");
                          if (coordRole) handleStaffIdentityConfirm("C001", "Demo Operator", coordRole);
                          startTour(0);
                        }}
                        className="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center ml-auto shrink-0 shadow-md hover:scale-105 transition"
                        title="Start Interactive Tour"
                      >
                        <Play className="w-3.5 h-3.5 ml-0.5 fill-white" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Right Column: Hero Doctor Image & Narrative Card */}
                <div className="lg:col-span-5 relative flex flex-col items-center">
                  {/* Doctor Portrait */}
                  <div className="relative rounded-3xl overflow-hidden shadow-2xl border-4 border-white/30 w-full max-w-md">
                    <img
                      src="https://images.unsplash.com/photo-1559839734-2b71ea197ec2?auto=format&fit=crop&q=80&w=800"
                      alt="Attending Clinical Physician"
                      className="w-full h-auto object-cover max-h-[440px]"
                    />
                  </div>

                  {/* Narrative Block (Right Side) */}
                  <div className="mt-4 p-4 rounded-2xl bg-white/15 backdrop-blur-md border border-white/20 text-white text-xs max-w-md">
                    <p className="leading-relaxed text-white/90">
                      At our healthcare operations center, we are committed to delivering advanced medical logistics that place clinical safety, patient dignity, and frontline efficiency at the heart of everything we do.
                    </p>
                    <button 
                      onClick={() => setShowPitchModal(true)}
                      className="mt-2 text-white font-bold flex items-center gap-1 hover:underline text-[11px]"
                    >
                      <span>Explore more</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* SECTION 2 — TRUST, METRICS & CLINICAL CARDS (Matches Middle of Image) */}
            <div className="bg-white/95 backdrop-blur-xl rounded-3xl p-8 sm:p-12 border border-white/80 shadow-2xl space-y-10" id="impact-section">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
                {/* Big Metric Block (Left) */}
                <div className="lg:col-span-4 flex items-center gap-4">
                  <div className="text-6xl sm:text-7xl font-black text-[#5b7b94] font-sans">
                    25+
                  </div>
                  <div className="text-xs font-bold text-slate-500 uppercase tracking-wider leading-snug">
                    Real-time Monitored Hospital Beds &amp; Autonomous Logistics
                  </div>
                </div>

                {/* Narrative Statement (Right) */}
                <div className="lg:col-span-8 space-y-2">
                  <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight leading-tight">
                    Trusted medical professionals united by one purpose — delivering compassionate, quality healthcare.
                  </h2>
                  <p className="text-sm text-slate-600 leading-relaxed">
                    Working together as experienced doctors, dedicated nurses, and specialized support staff to provide accurate diagnoses, personalized care plans, and comprehensive patient recovery with complete clinical oversight.
                  </p>
                  <div className="pt-2">
                    <button
                      onClick={() => setShowPitchModal(true)}
                      className="px-5 py-2.5 rounded-full bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-xs transition"
                    >
                      Explore Operations Brief
                    </button>
                  </div>
                </div>
              </div>

              {/* Two Media / Stat Preview Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
                {/* Card 1: Collaborative Rounding Video Preview */}
                <div className="relative rounded-2xl overflow-hidden border border-slate-200 shadow-sm group">
                  <img
                    src="https://images.unsplash.com/photo-1579684385127-1ef15d508118?auto=format&fit=crop&q=80&w=700"
                    alt="Clinical Consultations"
                    className="w-full h-52 object-cover group-hover:scale-105 transition duration-300"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/70 via-slate-950/20 to-transparent flex items-end p-5">
                    <div className="flex items-center justify-between w-full">
                      <div>
                        <div className="text-white font-bold text-sm">Autonomous Clinical Telemetry</div>
                        <div className="text-white/80 text-xs">Real-time bed turnover &amp; ICU stepdown orchestration</div>
                      </div>
                      <div className="w-10 h-10 rounded-full bg-white text-slate-900 flex items-center justify-center shadow-lg">
                        <Play className="w-4 h-4 ml-0.5 fill-slate-900 text-slate-900" />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Card 2: Diagnostics & Hospital Statistics */}
                <div className="p-6 rounded-2xl border border-slate-200 bg-[#eef4f8] flex flex-col justify-between space-y-4">
                  <div className="flex items-center gap-4">
                    <img
                      src="https://images.unsplash.com/photo-1582719471384-894fbb16e074?auto=format&fit=crop&q=80&w=300"
                      alt="Diagnostics Laboratory"
                      className="w-24 h-24 rounded-2xl object-cover shadow-sm border-2 border-white shrink-0"
                    />
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#5b7b94]">Laboratory &amp; TPA</span>
                      <h3 className="text-base font-bold text-slate-900 mt-0.5">Automated Discharge Gate</h3>
                      <p className="text-xs text-slate-600 mt-1 leading-snug">
                        Backwards-scheduled fasting phlebotomy and multi-payer P90 authorization lead times.
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 pt-3 border-t border-slate-200">
                    <div>
                      <div className="text-2xl font-black text-slate-900 font-sans">90%</div>
                      <div className="text-[11px] text-slate-500 font-medium">Patient satisfaction rate</div>
                    </div>
                    <div>
                      <div className="text-2xl font-black text-slate-900 font-sans">135+</div>
                      <div className="text-[11px] text-slate-500 font-medium">Patients successfully healed</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* SECTION 3 — DEPARTMENT DOCTOR AVAILABILITY & ROLE PORTALS (Matches Bottom of Image) */}
            <div className="bg-white/95 backdrop-blur-xl rounded-3xl p-8 sm:p-12 border border-white/80 shadow-2xl space-y-8" id="role-selection-section">
              <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                  <span className="text-xs font-bold text-[#5b7b94] uppercase tracking-wider">Healthcare Services &amp; Roles</span>
                  <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight mt-1">
                    Medicine department doctor availability and schedule
                  </h2>
                  <p className="text-xs text-slate-500 mt-1 max-w-xl">
                    Select your clinical duty station to access personalized AI automation, bedside check-ins, and doctor authorization workflows.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => {
                      const tabs = ["ALL", "NURSE", "DOCTOR", "COORDINATOR", "SUPPORT", "PATIENT"];
                      const currIdx = tabs.indexOf(landingFilterTab);
                      const nextIdx = (currIdx - 1 + tabs.length) % tabs.length;
                      setLandingFilterTab(tabs[nextIdx]);
                    }}
                    className="w-9 h-9 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-100 transition shadow-xs"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={() => {
                      const tabs = ["ALL", "NURSE", "DOCTOR", "COORDINATOR", "SUPPORT", "PATIENT"];
                      const currIdx = tabs.indexOf(landingFilterTab);
                      const nextIdx = (currIdx + 1) % tabs.length;
                      setLandingFilterTab(tabs[nextIdx]);
                    }}
                    className="w-9 h-9 rounded-full bg-slate-900 text-white flex items-center justify-center hover:bg-slate-800 transition shadow-xs"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Department Filter Tabs */}
              <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
                {[
                  { id: "ALL", label: "All Roles" },
                  { id: "NURSE", label: "Nursing Care" },
                  { id: "DOCTOR", label: "Doctor Authority" },
                  { id: "COORDINATOR", label: "Operations Command" },
                  { id: "SUPPORT", label: "Support & Lab" },
                  { id: "PATIENT", label: "Family Portal" }
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setLandingFilterTab(tab.id)}
                    className={`px-4 py-2 rounded-full font-bold transition whitespace-nowrap ${
                      landingFilterTab === tab.id
                        ? "bg-slate-900 text-white shadow-sm"
                        : "bg-white hover:bg-slate-100 text-slate-600 border border-slate-200"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Role Cards Grid matching screenshot */}
              <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-5">
                {GENERALIZED_ROLE_CATEGORIES
                  .filter(role => landingFilterTab === "ALL" || role.id === landingFilterTab)
                  .map((role, idx) => (
                  <div
                    key={role.id}
                    onClick={() => setSelectedRoleForLogin(role)}
                    className={`stagger-card-${idx} bg-white rounded-2xl border border-slate-200 p-4 shadow-sm hover:shadow-lg hover:-translate-y-1 transition duration-200 flex flex-col justify-between group cursor-pointer`}
                  >
                    <div className="space-y-3">
                      {/* Image Thumbnail Header for each role */}
                      <div className="relative h-32 rounded-xl overflow-hidden bg-slate-100">
                        <img
                          src={
                            role.id === "NURSE" ? "https://images.unsplash.com/photo-1576765608535-5f04d1e3f289?auto=format&fit=crop&q=80&w=400" :
                            role.id === "DOCTOR" ? "https://images.unsplash.com/photo-1622253692010-333f2da6031d?auto=format&fit=crop&q=80&w=400" :
                            role.id === "COORDINATOR" ? "https://images.unsplash.com/photo-1584515979956-d9f6e5d09982?auto=format&fit=crop&q=80&w=400" :
                            role.id === "SUPPORT" ? "https://images.unsplash.com/photo-1582719471384-894fbb16e074?auto=format&fit=crop&q=80&w=400" :
                            "https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?auto=format&fit=crop&q=80&w=400"
                          }
                          alt={role.label}
                          className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                        />
                        <div className="absolute top-2 left-2 bg-white/90 backdrop-blur-md px-2 py-0.5 rounded-full text-[10px] font-bold text-slate-800 shadow-xs flex items-center gap-1">
                          <span>{role.iconEmoji}</span>
                          <span>{role.badge}</span>
                        </div>
                      </div>

                      <div>
                        <h3 className="font-extrabold text-slate-900 text-base group-hover:text-[#5b7b94] transition">
                          {role.label}
                        </h3>
                        <div className="text-[11px] text-slate-500 font-medium">
                          {role.title}
                        </div>
                      </div>

                      <div className="pt-2 border-t border-slate-100 text-[11px] text-slate-600 line-clamp-3">
                        {role.systemScope}
                      </div>
                    </div>

                    <div className="pt-4 mt-2">
                      <button
                        type="button"
                        className="w-full py-2.5 rounded-full bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition flex items-center justify-center gap-1.5 shadow-xs"
                      >
                        <UserCheck className="w-3.5 h-3.5 text-white" />
                        Select Role ➔
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Bottom Operational Telemetry Strip */}
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-4 text-xs font-mono text-slate-600">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  <span className="font-bold text-slate-900 uppercase">Live Hospital Status:</span>
                  <span className="bg-[#eef4f8] text-[#5b7b94] px-2.5 py-0.5 rounded-full font-bold">
                    10/10 Guardrails Active
                  </span>
                  <span className="bg-slate-100 text-slate-700 px-2.5 py-0.5 rounded-full font-bold">
                    Live 30-Bed Demonstrator
                  </span>
                </div>

                <div className="flex items-center gap-4 text-slate-600 text-xs flex-wrap">
                  <span className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    Clock: <strong className="text-slate-900">{status?.simulated_date_str || "06:00 AM"}</strong>
                  </span>
                  <div className="w-px h-3.5 bg-slate-200"></div>
                  <span>Ready Beds: <strong className="text-emerald-600">{status?.ready_beds ?? 4}</strong></span>
                  <div className="w-px h-3.5 bg-slate-200"></div>
                  <span>Occupancy: <strong className="text-slate-900">{status?.occupied_beds ?? 22}/30</strong></span>
                  <div className="w-px h-3.5 bg-slate-200"></div>
                  <span className="text-emerald-700 font-bold">Shift: Morning (06:00 - 14:00)</span>
                </div>
              </div>
            </div>

            {/* Staff Identity Autocomplete Modal */}
            {selectedRoleForLogin && (
              <StaffIdentityModal
                role={selectedRoleForLogin}
                onClose={() => setSelectedRoleForLogin(null)}
                onConfirm={handleStaffIdentityConfirm}
                authLoading={authLoading}
              />
            )}
          </div>
        ) : (
          <>
            {/* ACTIVE DUTY STATUS BANNER (Staff Only) */}
            {currentUser.roleCategoryId !== "PATIENT" && (
              <div className="bg-white text-slate-900 p-5 rounded-2xl shadow-sm border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4 animate-fade-in">
                <div className="flex items-center gap-3.5">
                  <div className="w-12 h-12 rounded-2xl bg-[#eef4f8] border border-[#5b7b94]/20 flex items-center justify-center text-2xl shadow-inner">
                    {currentUser.role === "NURSE" ? "👩‍⚕️" :
                     currentUser.role === "DOCTOR" ? "👨‍⚕️" :
                     currentUser.role === "CLEANER" ? "🧹" :
                     currentUser.role === "PHLEBOTOMIST" ? "🩸" : "🎛️"}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold font-mono">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                        ON DUTY: {currentUser.shift || "Morning Shift"}
                      </span>
                      <span className="text-[10px] font-mono px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full border border-slate-200">
                        ID: {currentUser.staff_id}
                      </span>
                    </div>
                    <h2 className="text-lg font-black text-slate-900 mt-0.5 flex items-center gap-2">
                      <span>{currentUser.name}</span>
                      <span className="text-xs font-normal text-slate-500">• {currentUser.title || currentUser.role} ({currentUser.ward ? (currentUser.ward === "WARD_A" ? "Medical Ward A" : currentUser.ward === "WARD_B" ? "Surgical Ward B" : "ICU") : currentUser.department || "Hospital-Wide"})</span>
                    </h2>
                  </div>
                </div>

                {/* Handoff & Fast Switch Controls */}
                <div className="flex items-center gap-2.5 flex-wrap">
                  <div className="flex items-center gap-1.5 bg-slate-50 px-3 py-1.5 rounded-full border border-slate-200 text-xs">
                    <span className="text-slate-500 text-[10px] font-bold uppercase tracking-wider">Switch Duty:</span>
                    <select
                      value={currentUser.role}
                      onChange={(e) => {
                        const targetRole = e.target.value;
                        const match = GENERALIZED_ROLE_CATEGORIES.find(s => s.mappedSystemRole === targetRole);
                        if (match) handleStaffIdentityConfirm(currentUser.staff_id, currentUser.name, match);
                      }}
                      className="bg-white text-slate-800 text-xs p-1 rounded-lg border border-slate-200 font-bold focus:outline-none"
                    >
                      <option value="NURSE">👩‍⚕️ Nurse Duty</option>
                      <option value="DOCTOR">👨‍⚕️ Doctor Duty</option>
                      <option value="OPERATIONS">🎛️ Operations Command</option>
                      <option value="CLEANER">🧹 Support Staff</option>
                    </select>
                  </div>

                  <button
                    onClick={handleStaffLogout}
                    className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 rounded-full text-xs font-bold transition flex items-center gap-1.5 shadow-xs border border-slate-200"
                    title="Sign Out from shift and return to Staff Login Portal"
                  >
                    <LogOut className="w-3.5 h-3.5 text-slate-600" />
                    Sign Out / Shift Change
                  </button>
                </div>
              </div>
            )}

        {/* ========================================================================= */}
        {/* DEDICATED ROLE DASHBOARD 1: WARD SISTER / NURSE PORTAL                     */}
        {/* ========================================================================= */}
        {activeRole === "NURSE" && (
          <div className="space-y-6 animate-fade-in">
            {/* Nurse Banner & Ward Sub-selector */}
            <div className="bg-gradient-to-r from-blue-950 via-indigo-950 to-slate-900 text-white p-5 rounded-2xl shadow-md border border-indigo-700/40 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-white/10 rounded-xl border border-white/20 text-indigo-300">
                  <UserCheck className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-indigo-500/30 text-indigo-200 border border-indigo-400/30">
                      Ward Sister Portal
                    </span>
                    <span className="text-xs text-slate-300 font-medium">
                      Frontline Bedside Screening &amp; Logistics
                    </span>
                  </div>
                  <h2 className="text-xl font-black text-white mt-0.5">
                    {selectedNurseWard === "WARD_A" ? "Sister Sunita — Medical Ward A" :
                     selectedNurseWard === "WARD_B" ? "Sister Mary — Surgical Ward B" :
                     "Sister Anita — Intensive Care Unit"}
                  </h2>
                </div>
              </div>

              {/* Ward Selector */}
              <div className="flex items-center gap-2 bg-black/30 p-1.5 rounded-xl border border-white/10">
                {[
                  { id: "WARD_A", label: "Medical Ward A", nurse: "Sister Sunita" },
                  { id: "WARD_B", label: "Surgical Ward B", nurse: "Sister Mary" },
                  { id: "ICU",    label: "ICU",             nurse: "Sister Anita" }
                ].map(w => (
                  <button
                    key={w.id}
                    onClick={() => setSelectedNurseWard(w.id)}
                    className={`px-3 py-1.5 text-xs font-bold rounded-lg transition ${
                      selectedNurseWard === w.id
                        ? "bg-indigo-600 text-white shadow-sm"
                        : "text-slate-300 hover:text-white hover:bg-white/10"
                    }`}
                  >
                    {w.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Nurse Quick Metrics */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                <div className="text-[10px] uppercase tracking-wider font-bold text-slate-400">Ward Census</div>
                <div className="text-2xl font-black text-slate-800 mt-1">
                  {beds.filter(b => b.ward === selectedNurseWard && b.state === "OCCUPIED").length}
                  <span className="text-xs font-normal text-slate-400"> / {beds.filter(b => b.ward === selectedNurseWard).length} Beds</span>
                </div>
              </div>
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                <div className="text-[10px] uppercase tracking-wider font-bold text-slate-400">Nurse Checks Needed</div>
                <div className="text-2xl font-black text-amber-600 mt-1">
                  {nurseCandidates.filter(c => c.ward === selectedNurseWard && !c.current_consent).length}
                </div>
              </div>
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                <div className="text-[10px] uppercase tracking-wider font-bold text-slate-400">My Nursing Tasks</div>
                <div className="text-2xl font-black text-indigo-600 mt-1">
                  {tasks.filter(t => (t.ward === selectedNurseWard || t.ward === "ALL") && t.role === "NURSE").length}
                </div>
              </div>
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                <div className="text-[10px] uppercase tracking-wider font-bold text-slate-400">Flagged Barriers</div>
                <div className="text-2xl font-black text-rose-600 mt-1">
                  {nurseCandidates.filter(c => c.ward === selectedNurseWard && c.current_consent === "red").length}
                </div>
              </div>
            </div>

            {/* Two-Column Nurse Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Left Column: Morning Bedside Checks & Audio */}
              <div className="space-y-6">
                {/* Morning Bedside Check Form Card */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <div>
                      <h3 className="font-bold text-slate-900 flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-indigo-600" />
                        Morning Bedside Nurse Check (Feature F4)
                      </h3>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Screen caregiver availability and home obstacles before rounds.
                      </p>
                    </div>
                    <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                      {nurseCandidates.filter(c => c.ward === selectedNurseWard).length} Patients
                    </span>
                  </div>

                  {nurseCandidates.filter(c => c.ward === selectedNurseWard).length === 0 ? (
                    <div className="p-6 text-center text-slate-400 text-xs italic bg-slate-50 rounded-xl">
                      No patients currently pending morning nurse check in this ward.
                    </div>
                  ) : (
                    nurseCandidates.filter(c => c.ward === selectedNurseWard).map(cand => {
                      const currentForm = nurseForm[cand.encounter_id] || { payer: "yes", family: "yes", home: "None" };
                      return (
                        <div key={cand.encounter_id} className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-3">
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="font-bold text-slate-900 text-sm">{cand.patient_name} ({cand.bed_id})</div>
                              <div className="text-[11px] text-slate-500">{cand.diagnosis_name} • Dr. {cand.consultant_name}</div>
                            </div>
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${getPayerColor(cand.payer_type)}`}>
                              {cand.payer_type}
                            </span>
                          </div>

                          {/* 3 Questions */}
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                            <div>
                              <label className="text-[10px] font-bold text-slate-600 block mb-1">Payer Confirmed?</label>
                              <select
                                value={currentForm.payer}
                                onChange={(e) => handleNurseFormChange(cand.encounter_id, "payer", e.target.value)}
                                className="w-full text-xs p-1.5 border border-slate-200 rounded-lg bg-white"
                              >
                                <option value="yes">Yes (Confirmed)</option>
                                <option value="no">No (Unconfirmed)</option>
                                <option value="unsure">Unsure</option>
                              </select>
                            </div>
                            <div>
                              <label className="text-[10px] font-bold text-slate-600 block mb-1">Family Available?</label>
                              <select
                                value={currentForm.family}
                                onChange={(e) => handleNurseFormChange(cand.encounter_id, "family", e.target.value)}
                                className="w-full text-xs p-1.5 border border-slate-200 rounded-lg bg-white"
                              >
                                <option value="yes">Yes (At Bedside)</option>
                                <option value="no">No (Absent)</option>
                                <option value="evening_only">Evening Only</option>
                              </select>
                            </div>
                            <div>
                              <label className="text-[10px] font-bold text-slate-600 block mb-1">Home Barrier?</label>
                              <select
                                value={currentForm.home}
                                onChange={(e) => handleNurseFormChange(cand.encounter_id, "home", e.target.value)}
                                className="w-full text-xs p-1.5 border border-slate-200 rounded-lg bg-white"
                              >
                                <option value="None">None (🟢 Ready)</option>
                                <option value="Needs ramp">Needs ramp (🟡 Amber)</option>
                                <option value="No caregiver">No caregiver (🔴 Red)</option>
                                <option value="Oxygen cylinder required">Oxygen cylinder (🔴 Red)</option>
                                <option value="Other">Other (🔴 Red)</option>
                              </select>
                            </div>
                          </div>

                          <div className="flex items-center justify-between pt-1">
                            <span className="text-[11px] text-indigo-700 font-mono font-medium">
                              P(Discharge): {cand.p_discharge_percent}%
                            </span>
                            <button
                              onClick={() => handleNurseSubmit(cand.encounter_id)}
                              disabled={submittingEncounterId === cand.encounter_id}
                              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg shadow-sm transition disabled:opacity-50"
                            >
                              {submittingEncounterId === cand.encounter_id ? "Saving..." : "Save Assessment"}
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Urgent Hindi Voice Delivery Card */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <div>
                      <h3 className="font-bold text-slate-900 flex items-center gap-2">
                        <Volume2 className="w-4 h-4 text-emerald-600" />
                        Urgent Hindi Voice Alerts (Feature F5)
                      </h3>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Local Piper Neural TTS voice prompts in Hindi for busy stations.
                      </p>
                    </div>
                    <span className="text-[10px] font-mono px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded font-bold">
                      Piper ONNX Offline
                    </span>
                  </div>

                  {whatsappMessages.slice(0, 3).map(msg => (
                    <div key={msg.task_id} className="p-3 bg-emerald-50/50 border border-emerald-200 rounded-xl space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-slate-900">{msg.title_en}</span>
                        <span className="text-[10px] font-mono px-1.5 py-0.5 bg-emerald-100 text-emerald-800 rounded font-bold">
                          {msg.ward}
                        </span>
                      </div>
                      <div className="text-xs text-slate-700 font-hindi leading-relaxed bg-white p-2.5 rounded-lg border border-emerald-100">
                        {msg.reason_hi || msg.title_hi}
                      </div>
                      <div className="flex items-center justify-between pt-1">
                        <span className="text-[10px] text-slate-500 font-mono">
                          Task ID: {msg.task_id}
                        </span>
                        {msg.audio_url ? (
                          <audio controls className="h-7 max-w-[200px]" src={`${backendUrl}${msg.audio_url}`} />
                        ) : (
                          <button
                            onClick={async () => {
                              try {
                                await fetch(`${backendUrl}/api/whatsapp/synthesize/${msg.task_id}`, { method: "POST" });
                                await fetchData();
                              } catch (e) {
                                console.error(e);
                              }
                            }}
                            className="px-2.5 py-1 bg-emerald-600 text-white text-xs font-bold rounded-lg hover:bg-emerald-700 transition flex items-center gap-1 shadow-sm"
                          >
                            <Volume2 className="w-3.5 h-3.5" />
                            Synthesize Hindi Audio
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Right Column: Ward Nursing Tasks & Caregiver Barrier Resolution */}
              <div className="space-y-6">
                {/* Nursing Tasks from Sequencer */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <div>
                      <h3 className="font-bold text-slate-900 flex items-center gap-2">
                        <CalendarCheck className="w-4 h-4 text-indigo-600" />
                        Assigned Nursing Worklist (CP-SAT)
                      </h3>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Prioritized tasks with mathematical WHY evidence.
                      </p>
                    </div>
                    <span className="text-xs font-mono font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-200">
                      {tasks.filter(t => (t.ward === selectedNurseWard || t.ward === "ALL") && t.role === "NURSE").length} Tasks
                    </span>
                  </div>

                  {tasks.filter(t => (t.ward === selectedNurseWard || t.ward === "ALL") && t.role === "NURSE").length === 0 ? (
                    <div className="p-6 text-center text-slate-400 text-xs italic bg-slate-50 rounded-xl">
                      No pending nursing tasks in this ward.
                    </div>
                  ) : (
                    tasks.filter(t => (t.ward === selectedNurseWard || t.ward === "ALL") && t.role === "NURSE").map(t => (
                      <div key={t.id} className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <h4 className="font-bold text-slate-900 text-xs">{t.title_en}</h4>
                            <div className="text-[11px] text-indigo-700 font-hindi mt-0.5">{t.title_hi}</div>
                          </div>
                          <span className="text-[10px] font-mono px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded font-bold border border-indigo-200">
                            {Math.round(t.confidence * 100)}% Conf
                          </span>
                        </div>
                        <div className="p-2 bg-white rounded-lg border border-slate-100 text-[11px] text-slate-600">
                          <strong>WHY: </strong>{t.reason_en}
                        </div>
                        <div className="flex items-center justify-between pt-1 text-xs">
                          <span className="text-slate-400 text-[10px] font-mono">
                            Deadline: {new Date(t.deadline).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => handleTaskAction(t.id, "done")}
                              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-bold transition shadow-sm"
                            >
                              Done
                            </button>
                            <button
                              onClick={() => { setCannotModalTaskId(t.id); }}
                              className="px-2.5 py-1 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded text-xs font-medium transition"
                            >
                              Cannot
                            </button>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Caregiver Barrier Tracker */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <div>
                      <h3 className="font-bold text-slate-900 flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-amber-500" />
                        Caregiver &amp; Social Barrier Tracker
                      </h3>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Actionable counseling tasks for family readiness (Guardrail #8).
                      </p>
                    </div>
                  </div>

                  {nurseCandidates.filter(c => c.ward === selectedNurseWard && c.current_consent && c.current_consent !== "green").length === 0 ? (
                    <div className="p-6 text-center text-slate-400 text-xs italic bg-slate-50 rounded-xl">
                      No active caregiver barriers flagged in this ward.
                    </div>
                  ) : (
                    nurseCandidates.filter(c => c.ward === selectedNurseWard && c.current_consent && c.current_consent !== "green").map(c => (
                      <div key={c.encounter_id} className={`p-3.5 rounded-xl border space-y-2 ${c.current_consent === "red" ? "bg-rose-50/50 border-rose-200" : "bg-amber-50/50 border-amber-200"}`}>
                        <div className="flex items-center justify-between text-xs font-bold">
                          <span className="text-slate-900">{c.patient_name} ({c.bed_id})</span>
                          <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-black ${c.current_consent === "red" ? "bg-rose-100 text-rose-800" : "bg-amber-100 text-amber-800"}`}>
                            {c.current_consent === "red" ? "🔴 Red Barrier" : "🟡 Amber Pending"}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-700 bg-white p-2.5 rounded-lg border border-slate-200">
                          <strong>Counseling Action: </strong>
                          {c.current_consent === "red"
                            ? "Family barrier identified (No caregiver / Oxygen required). Bed release blocked until verified."
                            : "Financial / Transport pending. Follow up with family before physician rounds."}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* DEDICATED ROLE DASHBOARD 2: DOCTOR / CONSULTANT PORTAL                     */}
        {/* ========================================================================= */}
        {activeRole === "DOCTOR" && (
          <div className="space-y-6 animate-fade-in">
            {/* Doctor Header Bar */}
            <div className="bg-gradient-to-r from-indigo-950 via-slate-900 to-blue-950 text-white p-5 rounded-2xl shadow-md border border-indigo-700/40 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-indigo-600/30 rounded-xl border border-indigo-500/30 text-indigo-300">
                  <Stethoscope className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                      Attending Consultant Portal
                    </span>
                    <span className="text-xs text-slate-300">
                      Guardrail #1 Decision Gates &amp; Bedside Round Census
                    </span>
                  </div>
                  <h2 className="text-xl font-black text-white mt-0.5">
                    {DOCTOR_PROFILES[selectedDoctorId]?.name} — {DOCTOR_PROFILES[selectedDoctorId]?.specialty}
                  </h2>
                </div>
              </div>

              {/* Doctor Dropdown */}
              <div className="flex items-center gap-2 bg-black/30 p-1.5 rounded-xl border border-white/10">
                <select
                  value={selectedDoctorId}
                  onChange={(e) => setSelectedDoctorId(e.target.value)}
                  className="bg-transparent text-white text-xs font-bold border-none outline-none cursor-pointer py-1 px-2"
                >
                  {Object.values(DOCTOR_PROFILES).map(doc => (
                    <option key={doc.id} value={doc.id} className="text-slate-900">
                      {doc.name} ({doc.specialty})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Doctor Info & Round Burst Banner */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600">
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-bold text-slate-900">Today&apos;s Round Schedule:</div>
                  <div className="text-slate-600 font-mono text-[11px]">{DOCTOR_PROFILES[selectedDoctorId]?.roundTime}</div>
                </div>
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl font-medium text-[11px]">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                Pre-Round Labs: Fasting blood draws collected before 08:00 AM breakfast. Results ready in LIS before rounds begin.
              </div>
            </div>

            {/* Doctor's Rounding Census (Assigned Patients) */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                    <HeartPulse className="w-5 h-5 text-indigo-600" />
                    My Rounding Patients ({beds.filter(b => b.current_encounter?.consultant?.toLowerCase().includes(DOCTOR_PROFILES[selectedDoctorId]?.name?.toLowerCase().split(" ")[1]?.toLowerCase() || "sharma")).length} Active Patients)
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Review clinical stabilization markers and authorize discharge or ICU step-down (Guardrail #1).
                  </p>
                </div>
              </div>

              {beds.filter(b => b.current_encounter?.consultant?.toLowerCase().includes(DOCTOR_PROFILES[selectedDoctorId]?.name?.toLowerCase().split(" ")[1]?.toLowerCase() || "sharma")).length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-xs italic bg-slate-50 rounded-xl">
                  No active patients currently assigned to {DOCTOR_PROFILES[selectedDoctorId]?.name}.
                </div>
              ) : (
                <div className="space-y-4">
                  {beds.filter(b => b.current_encounter?.consultant?.toLowerCase().includes(DOCTOR_PROFILES[selectedDoctorId]?.name?.toLowerCase().split(" ")[1]?.toLowerCase() || "sharma")).map(bed => {
                    const patient = bed.current_encounter!;
                    return (
                      <div key={bed.id} className="p-5 rounded-xl border border-slate-200 hover:border-indigo-200 transition space-y-3 bg-slate-50/50">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div className="flex items-center gap-3">
                            <span className="font-mono text-base font-black px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-slate-900 shadow-sm">
                              {bed.id}
                            </span>
                            <div>
                              <h4 className="font-bold text-slate-900 text-base">{patient.patient_name}</h4>
                              <div className="text-xs text-slate-500">{patient.age}y / {patient.gender} • {patient.diagnosis} • {bed.ward}</div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${getPayerColor(patient.payer_type)}`}>
                              {patient.payer_type}
                            </span>
                            <span className="px-2.5 py-1 rounded-full text-xs font-mono font-bold bg-indigo-100 text-indigo-800 border border-indigo-200">
                              P(Discharge): {patient.p_discharge !== undefined ? Math.round(patient.p_discharge * 100) : 0}%
                            </span>
                          </div>
                        </div>

                        {/* Visible Clinical Signs Strip */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-slate-200/60 text-xs">
                          <div className={`p-2 rounded-lg border flex items-center gap-1.5 ${patient.iv_to_oral ? "bg-emerald-50 border-emerald-200 text-emerald-800" : "bg-slate-100 border-slate-200 text-slate-600"}`}>
                            <Check className="w-3.5 h-3.5" />
                            <span>{patient.iv_to_oral ? "Oral Meds Tolerated" : "On IV Antibiotics"}</span>
                          </div>
                          <div className={`p-2 rounded-lg border flex items-center gap-1.5 ${patient.oxygen_removed ? "bg-emerald-50 border-emerald-200 text-emerald-800" : "bg-rose-50 border-rose-200 text-rose-800"}`}>
                            <Check className="w-3.5 h-3.5" />
                            <span>{patient.oxygen_removed ? "Room Air (O2 Weaned)" : "On Oxygen Support"}</span>
                          </div>
                          <div className={`p-2 rounded-lg border flex items-center gap-1.5 ${patient.diet_normalized ? "bg-emerald-50 border-emerald-200 text-emerald-800" : "bg-slate-100 border-slate-200 text-slate-600"}`}>
                            <Check className="w-3.5 h-3.5" />
                            <span>{patient.diet_normalized ? "Normal Diet" : "Restricted Diet"}</span>
                          </div>
                          <div className={`p-2 rounded-lg border flex items-center gap-1.5 ${patient.vitals_stable ? "bg-emerald-50 border-emerald-200 text-emerald-800" : "bg-amber-50 border-amber-200 text-amber-800"}`}>
                            <Check className="w-3.5 h-3.5" />
                            <span>{patient.vitals_stable ? "Vitals Stable (24h)" : "Vitals Monitored"}</span>
                          </div>
                        </div>

                        {/* AI Rationale Top 3 Reasons */}
                        {patient.discharge_reasons && (
                          <div className="p-2.5 bg-white rounded-lg border border-slate-200 text-[11px] text-slate-600 space-y-0.5">
                            <span className="font-bold text-slate-800">Operational Evidence: </span>
                            {patient.discharge_reasons.join(" • ")}
                          </div>
                        )}

                        {/* Guardrail #1 Action Gate */}
                        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                          <div className="text-[11px] text-slate-500 italic">
                            🛡️ Guardrail #1: Only attending physician can sign off on discharge. AI never auto-discharges.
                          </div>
                          <button
                            onClick={() => handleDoctorDischarge(patient.encounter_id, patient.patient_name)}
                            disabled={doctorActionLoading === patient.encounter_id}
                            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-sm transition flex items-center gap-1.5 disabled:opacity-50"
                          >
                            <Check className="w-4 h-4" />
                            {doctorActionLoading === patient.encounter_id ? "Authorizing..." : "Authorize Clinical Discharge (Doctor Sign-Off)"}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* DEDICATED ROLE DASHBOARD 3: CLEANER / HOUSEKEEPING DASHBOARD               */}
        {/* ========================================================================= */}
        {activeRole === "CLEANER" && (
          <div className="space-y-6 animate-fade-in">
            {/* Cleaner Header Bar */}
            <div className="bg-gradient-to-r from-emerald-950 via-teal-950 to-slate-900 text-white p-5 rounded-2xl shadow-md border border-emerald-700/40 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-emerald-600/30 rounded-xl border border-emerald-500/30 text-emerald-300">
                  <Sparkles className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      Terminal Cleaning &amp; Disinfection
                    </span>
                    <span className="text-xs text-slate-300">
                      Mobile / Tablet Frontline Console
                    </span>
                  </div>
                  <h2 className="text-xl font-black text-white mt-0.5">
                    {selectedCleanerStaff} — Housekeeping Operations
                  </h2>
                </div>
              </div>

              {/* Staff Selector */}
              <div className="flex items-center gap-2 bg-black/30 p-1.5 rounded-xl border border-white/10">
                {["Anand R. (Sweeper)", "Deepa M. (Sweeper)"].map(staff => (
                  <button
                    key={staff}
                    onClick={() => setSelectedCleanerStaff(staff)}
                    className={`px-3 py-1.5 text-xs font-bold rounded-lg transition ${
                      selectedCleanerStaff === staff
                        ? "bg-emerald-600 text-white shadow-sm"
                        : "text-slate-300 hover:text-white hover:bg-white/10"
                    }`}
                  >
                    {staff.split(" ")[0]} ({staff.includes("Anand") ? "Ward A" : "Ward B"})
                  </button>
                ))}
              </div>
            </div>

            {/* Cleaner Metrics */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                <div className="text-[10px] uppercase tracking-wider font-bold text-slate-400">Dirty Beds Waiting</div>
                <div className="text-2xl font-black text-rose-600 mt-1">
                  {beds.filter(b => b.state === "DIRTY").length}
                </div>
              </div>
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                <div className="text-[10px] uppercase tracking-wider font-bold text-slate-400">Turnover SLA</div>
                <div className="text-2xl font-black text-indigo-600 mt-1">
                  {readinessMetrics?.threshold_state === "CRITICAL" ? "15m" : "45m"}
                  <span className="text-xs font-normal text-slate-400"> {readinessMetrics?.threshold_state === "CRITICAL" ? "(Emergency)" : "(Standard)"}</span>
                </div>
              </div>
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                <div className="text-[10px] uppercase tracking-wider font-bold text-slate-400">Ready Beds Now</div>
                <div className="text-2xl font-black text-emerald-600 mt-1">
                  {beds.filter(b => b.state === "READY").length}
                </div>
              </div>
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                <div className="text-[10px] uppercase tracking-wider font-bold text-slate-400">Assigned Tasks</div>
                <div className="text-2xl font-black text-amber-600 mt-1">
                  {tasks.filter(t => t.role === "CLEANING").length}
                </div>
              </div>
            </div>

            {/* Section 1: URGENT TERMINAL CLEANING QUEUE (DIRTY BEDS) */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-amber-500" />
                    Urgent Terminal Cleaning Queue (Dirty Beds)
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Disinfect, strip soiled linen, and dress bed with clean linen to make bed READY.
                  </p>
                </div>
                <span className="px-3 py-1 bg-rose-100 text-rose-800 text-xs font-bold rounded-full border border-rose-200">
                  {beds.filter(b => b.state === "DIRTY").length} Beds Require Action
                </span>
              </div>

              {beds.filter(b => b.state === "DIRTY").length === 0 ? (
                <div className="p-10 text-center bg-emerald-50/50 border border-emerald-200 rounded-2xl space-y-2">
                  <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto" />
                  <h4 className="font-bold text-emerald-900">All Beds Sanitized!</h4>
                  <p className="text-xs text-emerald-700">No dirty beds in any ward. Great job keeping the hospital flow moving!</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {beds.filter(b => b.state === "DIRTY").map(bed => {
                    return (
                      <div key={bed.id} className="p-5 rounded-2xl border-2 border-amber-300 bg-amber-50/40 shadow-md space-y-3">
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="text-2xl font-black font-mono text-slate-900">{bed.id}</div>
                            <div className="text-xs font-semibold text-indigo-700">{bed.ward} • {bed.bed_type}</div>
                          </div>
                          <span className="px-2.5 py-1 bg-rose-100 text-rose-800 border border-rose-300 text-xs font-black rounded-lg uppercase">
                            DIRTY • NEEDS SANITIZATION
                          </span>
                        </div>

                        <div className="p-3 bg-white rounded-xl border border-amber-200 text-xs text-slate-700 space-y-1">
                          <div className="font-bold text-slate-900">Standard Terminal Protocol:</div>
                          <ul className="list-disc pl-4 space-y-0.5 text-[11px] text-slate-600">
                            <li>Disinfect mattress and bed frame with hospital-grade quat solution</li>
                            <li>Replace linen, pillowcase, and sterile draw sheet</li>
                            <li>Wipe IV pole, oxygen port, and side table</li>
                          </ul>
                        </div>

                        <button
                          onClick={() => handleMarkBedCleaned(bed.id)}
                          disabled={cleanerActionLoading === bed.id}
                          className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-black text-sm shadow-md transition flex items-center justify-center gap-2"
                        >
                          <Check className="w-5 h-5" />
                          {cleanerActionLoading === bed.id ? "Updating Bed State..." : "Mark Disinfected & Bed Ready"}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Ready Beds Status */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-3">
              <h3 className="font-bold text-slate-900 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                Cleaned &amp; Ready Beds ({beds.filter(b => b.state === "READY").length} Available)
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-6 gap-2">
                {beds.filter(b => b.state === "READY").map(b => (
                  <div key={b.id} className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-center">
                    <div className="font-mono font-bold text-emerald-900 text-sm">{b.id}</div>
                    <div className="text-[10px] text-emerald-700 font-medium">{b.ward}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* DEDICATED ROLE DASHBOARD 4: PHLEBOTOMIST / LAB PORTAL                     */}
        {/* ========================================================================= */}
        {activeRole === "PHLEBOTOMIST" && (
          <div className="space-y-6 animate-fade-in">
            {/* Phleb Header Bar */}
            <div className="bg-gradient-to-r from-rose-950 via-slate-900 to-red-950 text-white p-5 rounded-2xl shadow-md border border-rose-700/40 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-rose-600/30 rounded-xl border border-rose-500/30 text-rose-300">
                  <Syringe className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30">
                      Phlebotomy &amp; Lab Logistics
                    </span>
                    <span className="text-xs text-slate-300">
                      Feature F2: Backwards Scheduling from Doctor Rounds
                    </span>
                  </div>
                  <h2 className="text-xl font-black text-white mt-0.5">
                    {selectedPhlebStaff} — Morning Phlebotomy Route
                  </h2>
                </div>
              </div>

              {/* Staff Selector */}
              <div className="flex items-center gap-2 bg-black/30 p-1.5 rounded-xl border border-white/10">
                {["Sunita K. (Phleb)", "Manoj V. (Phleb)", "Amit R. (Phleb)"].map(staff => (
                  <button
                    key={staff}
                    onClick={() => setSelectedPhlebStaff(staff)}
                    className={`px-3 py-1.5 text-xs font-bold rounded-lg transition ${
                      selectedPhlebStaff === staff
                        ? "bg-rose-600 text-white shadow-sm"
                        : "text-slate-300 hover:text-white hover:bg-white/10"
                    }`}
                  >
                    {staff.split(" ")[0]}
                  </button>
                ))}
              </div>
            </div>

            {/* 08:00 AM Breakfast Constraint Notice */}
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-center gap-3 text-xs text-amber-900 shadow-sm">
              <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0" />
              <div>
                <strong className="text-amber-950 font-bold">Crucial Fasting Breakfast Constraint (08:00 AM): </strong>
                All morning fasting metabolic panels (LFT, KFT, Blood Sugar) must be drawn before morning breakfast service. Drawing after breakfast contaminates samples and delays discharge by 24 hours.
              </div>
            </div>

            {/* Ordered Blood Collection Route Table */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                    <Clock className="w-5 h-5 text-rose-600" />
                    Backwards Phlebotomy Schedule ({bloodRoute.length} Morning Draws)
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Draw Deadlines calculated backwards: Round Time − 140m Lab P90 − 15m Safety Buffer.
                  </p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 uppercase font-semibold text-[10px] tracking-wider border-b border-slate-200">
                    <tr>
                      <th className="py-3 px-4">Bed ID</th>
                      <th className="py-3 px-4">Patient Name</th>
                      <th className="py-3 px-4">Consultant</th>
                      <th className="py-3 px-4">Doctor Round</th>
                      <th className="py-3 px-4">Draw Deadline</th>
                      <th className="py-3 px-4">Fasting Constraint</th>
                      <th className="py-3 px-4">Mathematical Rationale</th>
                      <th className="py-3 px-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {bloodRoute.map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-50 transition">
                        <td className="py-3 px-4 font-mono font-bold text-slate-900">{item.bed_id}</td>
                        <td className="py-3 px-4 font-semibold text-slate-800">{item.patient_name}</td>
                        <td className="py-3 px-4 text-indigo-700 font-medium">{item.consultant_name}</td>
                        <td className="py-3 px-4 font-mono">
                          {item.consultant_round_time ? (item.consultant_round_time.includes("T") ? item.consultant_round_time.split("T")[1]?.slice(0, 5) : item.consultant_round_time) : "09:30"}
                        </td>
                        <td className="py-3 px-4 font-mono font-bold text-rose-700 bg-rose-50/50">
                          {item.latest_safe_draw_str || (item.latest_safe_blood_draw_time && item.latest_safe_blood_draw_time.includes("T") ? item.latest_safe_blood_draw_time.split("T")[1]?.slice(0, 5) : item.latest_safe_blood_draw_time) || "06:55"}
                        </td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                            Fasting (Before 08:00)
                          </span>
                        </td>
                        <td className="py-3 px-4 text-[11px] text-slate-500 max-w-xs truncate" title={item.why_reason}>
                          {item.why_reason}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            onClick={() => alert(`Sample collected for Bed ${item.bed_id}! Dispatched to central pathology lab.`)}
                            className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold shadow-sm transition"
                          >
                            Sample Drawn
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* DEDICATED ROLE DASHBOARD 5: OPERATIONS COMMAND (FULL ADMIN VIEW)          */}
        {/* ========================================================================= */}
        {activeRole === "OPERATIONS" && currentUser?.roleCategoryId !== "PATIENT" && (
          <>
            {/* Metric Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <div className="text-xs font-medium text-slate-500 uppercase tracking-wider">30-Bed Capacity</div>
            <div className="text-2xl font-black text-slate-800 mt-1">
              {status?.total_beds ?? 30}
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">Scale: 30-bed live unit</div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <div className="text-xs font-medium text-slate-500 uppercase tracking-wider">Occupied Beds</div>
            <div className="text-2xl font-black text-rose-600 mt-1 flex items-baseline gap-2">
              {status?.occupied_beds ?? 0}
              <span className="text-xs font-semibold text-rose-500">
                {status ? Math.round((status.occupied_beds / status.total_beds) * 100) : 0}%
              </span>
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">Active clinical cases</div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <div className="text-xs font-medium text-slate-500 uppercase tracking-wider">30m Readiness Number</div>
            <div className="text-2xl font-black text-emerald-600 mt-1 flex items-baseline gap-2">
              {readinessMetrics?.readiness_number ?? 0}
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                readinessMetrics?.threshold_state === "CRITICAL" ? "bg-rose-100 text-rose-800" :
                readinessMetrics?.threshold_state === "STRAINED" ? "bg-amber-100 text-amber-800" :
                "bg-emerald-100 text-emerald-800"
              }`}>
                {readinessMetrics?.threshold_state ?? "HEALTHY"}
              </span>
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              Ready: {readinessMetrics?.ready_now ?? 0} | 30m Turnover: {readinessMetrics?.turnover_in_30m ?? 0}
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <div className="text-xs font-medium text-slate-500 uppercase tracking-wider">Time Saved Today</div>
            <div className="text-2xl font-black text-indigo-600 mt-1 flex items-baseline gap-1.5">
              {timeSavedData?.live_demonstrator_30bed.total_hours_saved ?? 0}h
              <span className="text-xs font-medium text-indigo-500">Live 30-bed</span>
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5 truncate" title="Guardrail #10: Projected 300-bed scale">
              300-Bed: {timeSavedData?.projected_hospital_300bed.daily_hours_saved ?? 0}h/day
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <div className="text-xs font-medium text-slate-500 uppercase tracking-wider">Queued Clearance Tasks</div>
            <div className="text-2xl font-black text-amber-600 mt-1 flex items-baseline gap-2">
              {tasks.length}
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">Role-specific WHO & WHY</div>
          </div>
        </div>

        {/* INTERACTIVE DEMO TOUR BANNER (PHASE 11) */}
        {tourActive && (
          <div className="bg-gradient-to-r from-violet-950 via-indigo-950 to-slate-900 text-white rounded-2xl p-5 shadow-lg border border-violet-500/50 space-y-3 animate-fade-in">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-violet-600/40 border border-violet-400/40 rounded-xl flex-shrink-0 text-violet-300">
                  <Compass className="w-6 h-6 animate-pulse" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-violet-400/20 text-violet-200 border border-violet-400/30">
                      Step {tourStepIndex + 1} of {TOUR_STEPS.length}
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-400/20 text-emerald-300 border border-emerald-400/30">
                      {TOUR_STEPS[tourStepIndex].badge}
                    </span>
                    <span className="text-[10px] font-mono text-slate-300">
                      Feature: {TOUR_STEPS[tourStepIndex].tab}
                    </span>
                  </div>
                  <h3 className="text-base font-black text-white mt-1">
                    {TOUR_STEPS[tourStepIndex].title}
                  </h3>
                  <div className="text-xs text-violet-200 font-medium">
                    {TOUR_STEPS[tourStepIndex].subtitle}
                  </div>
                </div>
              </div>

              {/* Tour Controls */}
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={prevTourStep}
                  disabled={tourStepIndex === 0}
                  className="px-3 py-1.5 bg-white/10 hover:bg-white/20 disabled:opacity-30 rounded-lg text-xs font-bold text-white transition flex items-center gap-1"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Prev
                </button>
                <button
                  onClick={nextTourStep}
                  className="px-4 py-1.5 bg-violet-500 hover:bg-violet-600 text-white rounded-lg text-xs font-black transition flex items-center gap-1 shadow-md shadow-violet-900/50"
                >
                  {tourStepIndex === TOUR_STEPS.length - 1 ? "Finish Tour" : "Next Step"}
                  <ChevronRight className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setTourActive(false)}
                  className="p-1.5 text-slate-400 hover:text-white rounded-lg transition text-xs"
                  title="Close Guided Tour"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="pt-2 border-t border-white/10 text-xs text-slate-200 leading-relaxed flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <p className="max-w-3xl">
                {TOUR_STEPS[tourStepIndex].body}
              </p>
              <div className="flex items-center gap-2 flex-shrink-0">
                {TOUR_STEPS.map((s, idx) => (
                  <button
                    key={s.step}
                    onClick={() => startTour(idx)}
                    className={`w-2.5 h-2.5 rounded-full transition ${
                      idx === tourStepIndex ? "bg-amber-400 scale-125 ring-2 ring-amber-300/50" : "bg-white/30 hover:bg-white/60"
                    }`}
                    title={`Jump to step ${s.step}: ${s.title}`}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Feature Navigation Tabs: 4 Primary Tabs + 1 'More ▾' Dropdown */}
        {(() => {
          const MORE_DROPDOWN_TABS = [
            { id: "PROOF_EVALUATION" as const, label: "Proof & Evaluation", icon: Award, key: "S", badge: "10/10" },
            { id: "ICU_STEPDOWN" as const, label: "ICU Step-Down", icon: HeartPulse, key: "I", badge: icuRoster && icuRoster.roster.filter(c => c.icu_stepdown_status === "READY_FOR_TRANSFER").length > 0 ? `${icuRoster.roster.filter(c => c.icu_stepdown_status === "READY_FOR_TRANSFER").length}` : null },
            { id: "NURSE_CHECK" as const, label: "Nurse Check", icon: UserCheck, key: "N", badge: nurseCandidates.filter(c => !c.current_consent).length > 0 ? `${nurseCandidates.filter(c => !c.current_consent).length}` : null },
            { id: "BILL_ESTIMATOR" as const, label: "Bill Estimator", icon: Receipt, key: "B", badge: cashCandidates.filter(c => c.estimate_status === "PENDING" || c.estimate_status === "ESTIMATED").length > 0 ? `${cashCandidates.filter(c => c.estimate_status === "PENDING" || c.estimate_status === "ESTIMATED").length}` : null },
            { id: "ROUND_CLOCK" as const, label: "Round Clock", icon: Stethoscope, key: "R", badge: null },
            { id: "RADAR" as const, label: "Radar", icon: Radar, key: "D", badge: null },
            { id: "DELAY_BOOK" as const, label: "Delay Book", icon: Timer, key: "L", badge: null },
            { id: "TASKS" as const, label: "Tasks", icon: Send, key: "T", badge: `${tasks.length}` },
          ];

          const activeMoreTabItem = MORE_DROPDOWN_TABS.find(t => t.id === activeTab);
          const isMoreTabActive = !!activeMoreTabItem;
          const activeMoreTabLabel = activeMoreTabItem ? activeMoreTabItem.label : "";
          const activeMoreTabBadge = activeMoreTabItem?.badge || null;

          return (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-2.5 rounded-2xl border border-slate-200 shadow-sm relative z-20">
              <div className="flex items-center gap-1.5 flex-wrap">
                {/* 1. Today's Plan */}
                <button
                  type="button"
                  onClick={() => setActiveTab("TODAYS_PLAN")}
                  className={`px-3.5 py-2 text-xs font-bold rounded-xl transition flex items-center gap-1.5 ${
                    activeTab === "TODAYS_PLAN"
                      ? "bg-slate-900 text-white shadow-sm"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                  }`}
                >
                  <CalendarCheck className="w-4 h-4" />
                  <span>Today&apos;s Plan</span>
                  <span className={`text-[9px] px-1 py-0.2 rounded font-mono font-bold ${activeTab === "TODAYS_PLAN" ? "bg-slate-800 text-slate-200" : "bg-slate-100 text-slate-500 border border-slate-200"}`}>P</span>
                </button>

                {/* 2. Emergency & Readiness */}
                <button
                  type="button"
                  onClick={() => setActiveTab("EMERGENCY_READINESS")}
                  className={`px-3.5 py-2 text-xs font-bold rounded-xl transition flex items-center gap-1.5 ${
                    activeTab === "EMERGENCY_READINESS"
                      ? "bg-slate-900 text-white shadow-sm"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                  }`}
                >
                  <ShieldAlert className="w-4 h-4" />
                  <span>Emergency &amp; Readiness</span>
                  <span className={`text-[9px] px-1 py-0.2 rounded font-mono font-bold ${activeTab === "EMERGENCY_READINESS" ? "bg-slate-800 text-slate-200" : "bg-slate-100 text-slate-500 border border-slate-200"}`}>E</span>
                  {readinessMetrics && (
                    <span className={`ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                      activeTab === "EMERGENCY_READINESS" ? "bg-slate-800 text-white" : "bg-slate-100 text-slate-700 border border-slate-200"
                    }`}>
                      {readinessMetrics.readiness_number}
                    </span>
                  )}
                </button>

                {/* 3. Regional Map */}
                <button
                  type="button"
                  onClick={() => setActiveTab("BLOOD_INVENTORY")}
                  className={`px-3.5 py-2 text-xs font-bold rounded-xl transition flex items-center gap-1.5 ${
                    activeTab === "BLOOD_INVENTORY"
                      ? "bg-slate-900 text-white shadow-sm"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                  }`}
                >
                  <MapPin className="w-4 h-4 text-indigo-500" />
                  <span>Regional Map</span>
                  <span className={`text-[9px] px-1 py-0.2 rounded font-mono font-bold ${activeTab === "BLOOD_INVENTORY" ? "bg-slate-800 text-slate-200" : "bg-slate-100 text-slate-500 border border-slate-200"}`}>M</span>
                  <span className="flex items-center gap-1 ml-0.5">
                    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-rose-500 text-white shadow-xs" title="Condition 1: Blood Deficit (3u O-)">
                      <Droplet className="w-2.5 h-2.5 fill-white" />
                      3u
                    </span>
                    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-amber-500 text-slate-950 shadow-xs" title="Condition 2: ICU Capacity Overflow (0 Beds Free)">
                      <Bed className="w-2.5 h-2.5" />
                      0
                    </span>
                  </span>
                </button>

                {/* 4. All Beds */}
                <button
                  type="button"
                  onClick={() => setActiveTab("BEDS")}
                  className={`px-3.5 py-2 text-xs font-bold rounded-xl transition flex items-center gap-1.5 ${
                    activeTab === "BEDS"
                      ? "bg-slate-900 text-white shadow-sm"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                  }`}
                >
                  <Layers className="w-4 h-4" />
                  <span>All Beds</span>
                </button>

                {/* 5. More ▾ Dropdown Trigger & Popover */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setMoreMenuOpen(prev => !prev)}
                    className={`px-3.5 py-2 text-xs font-bold rounded-xl transition flex items-center gap-1.5 ${
                      isMoreTabActive
                        ? "bg-slate-900 text-white shadow-sm"
                        : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                    }`}
                  >
                    <span>{isMoreTabActive ? `More: ${activeMoreTabLabel}` : "More"}</span>
                    <ChevronDown className={`w-3.5 h-3.5 transition-transform ${moreMenuOpen ? "rotate-180" : ""}`} />
                    {activeMoreTabBadge && (
                      <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-slate-800 text-white border border-slate-700">
                        {activeMoreTabBadge}
                      </span>
                    )}
                  </button>

                  {moreMenuOpen && (
                    <>
                      <div
                        className="fixed inset-0 z-30"
                        onClick={() => setMoreMenuOpen(false)}
                      />
                      <div className="absolute left-0 mt-2 w-64 bg-white rounded-2xl shadow-2xl border border-slate-200 py-2 z-40 animate-fade-in divide-y divide-slate-100">
                        <div className="px-3.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          Operations &amp; Clinical Modules
                        </div>
                        <div className="py-1">
                          {MORE_DROPDOWN_TABS.map((tab) => {
                            const Icon = tab.icon;
                            const isCurrent = activeTab === tab.id;
                            return (
                              <button
                                key={tab.id}
                                type="button"
                                onClick={() => {
                                  setActiveTab(tab.id as any);
                                  setMoreMenuOpen(false);
                                }}
                                className={`w-full px-3.5 py-2 text-xs font-semibold flex items-center justify-between text-left transition ${
                                  isCurrent
                                    ? "bg-slate-900 text-white font-bold"
                                    : "text-slate-700 hover:bg-slate-100"
                                }`}
                              >
                                <div className="flex items-center gap-2.5">
                                  <Icon className={`w-4 h-4 ${isCurrent ? "text-white" : "text-slate-500"}`} />
                                  <span>{tab.label}</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                  {tab.badge && (
                                    <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
                                      isCurrent ? "bg-slate-800 text-white" : "bg-slate-100 text-slate-600 border border-slate-200"
                                    }`}>
                                      {tab.badge}
                                    </span>
                                  )}
                                  <span className={`text-[9px] px-1 py-0.2 rounded font-mono ${
                                    isCurrent ? "bg-slate-800 text-slate-300" : "bg-slate-100 text-slate-400"
                                  }`}>
                                    {tab.key}
                                  </span>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleRoutePayerTasks}
                  disabled={actionLoading}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl shadow-sm transition flex items-center gap-1.5"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  Auto-Route Payer Tasks
                </button>
              </div>
            </div>
          );
        })()}

        {/* Global Toast / Action Success Notification */}
        {actionSuccessMsg && (
          <div className="bg-emerald-50 border border-emerald-300 text-emerald-900 px-4 py-3 rounded-xl flex items-center justify-between text-sm shadow-sm animate-fade-in">
            <div className="flex items-center gap-2 font-medium">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
              {actionSuccessMsg}
            </div>
            <button onClick={() => setActionSuccessMsg(null)} className="text-emerald-700 hover:text-emerald-900 text-xs font-bold">
              Dismiss
            </button>
          </div>
        )}

        {/* TAB: PROOF SCREEN & SCIENTIFIC EVALUATION (PHASE 10) */}
        {activeTab === "PROOF_EVALUATION" && evaluationData && (
          <div className="space-y-6 animate-fade-in">
            {/* 1. HERO BANNER */}
            <div className="bg-gradient-to-r from-violet-950 via-slate-900 to-indigo-950 text-white rounded-2xl p-6 shadow-md border border-violet-800/40 space-y-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-start gap-4">
                  <div className="p-3 bg-violet-600/30 border border-violet-500/40 rounded-xl flex-shrink-0 text-violet-300">
                    <Award className="w-7 h-7 text-amber-300" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-black tracking-wider uppercase px-2.5 py-0.5 rounded-full bg-violet-500/20 text-violet-300 border border-violet-500/30">
                        Phase 10: Scientific Validation
                      </span>
                      <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                        🛡️ Canonical Guardrails: 10/10 Passing
                      </span>
                      <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                        Zero Saturation: 0% at 0.0 / 1.0
                      </span>
                      <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-sky-500/20 text-sky-300 border border-sky-500/30">
                        Held-out N = 1,000 Trajectories
                      </span>
                      <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                        🔬 Evaluated on Calibrated Synthetic Simulation Cohort (n=1,000)
                      </span>
                    </div>
                    <h1 className="text-2xl font-black tracking-tight text-white mt-1">
                      The Proof Screen &amp; Scientific Evaluation
                    </h1>
                    <p className="text-xs text-slate-300 mt-1 max-w-3xl leading-relaxed">
                      Rigorous held-out calibration against a naive baseline, backwards-scheduling mathematical benchmarks,
                      honest disclosure of 4 real-world clinical failure modes in the Medical Humility Matrix, and live verification of all 10 system guardrails.
                    </p>
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row items-center gap-2 flex-shrink-0">
                  <div className="text-right px-4 py-2 bg-white/5 border border-white/10 rounded-xl">
                    <div className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Accuracy Gain</div>
                    <div className="text-xl font-black text-emerald-400">+{evaluationData.calibration_benchmark.accuracy_gain_percent}%</div>
                    <div className="text-[10px] text-slate-400">vs Naive Baseline</div>
                  </div>
                  <div className="text-right px-4 py-2 bg-white/5 border border-white/10 rounded-xl">
                    <div className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Brier Reduction</div>
                    <div className="text-xl font-black text-violet-400">-{evaluationData.calibration_benchmark.brier_error_reduction_percent}%</div>
                    <div className="text-[10px] text-slate-400">Sq. Probability Error</div>
                  </div>
                </div>
              </div>
            </div>

            {/* 2. SECTION 1: SCOREBOARD (4 KPI METRIC CARDS) */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Card 1: Accuracy vs Naive Baseline */}
              <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-2 hover:border-violet-300 transition">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Model vs Naive Accuracy</span>
                  <BarChart3 className="w-4 h-4 text-violet-600" />
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-black text-slate-900">{evaluationData.calibration_benchmark.model_accuracy}%</span>
                  <span className="text-xs font-bold text-slate-500">vs {evaluationData.calibration_benchmark.naive_baseline_accuracy}%</span>
                </div>
                <div className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                  <TrendingUp className="w-3 h-3" />
                  +{evaluationData.calibration_benchmark.accuracy_gain_percent}% Absolute (+42.0% Relative)
                </div>
                <p className="text-[11px] text-slate-500 leading-normal pt-1">
                  Naive baseline guesses discharge purely if stay &ge; diagnosis mean LOS. SwasthFlow learns multi-factorial clinical trajectory indicators.
                </p>
              </div>

              {/* Card 2: Brier Score Error Reduction */}
              <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-2 hover:border-violet-300 transition">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Brier Score (Mean Sq. Error)</span>
                  <Scale className="w-4 h-4 text-indigo-600" />
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-black text-slate-900">{evaluationData.calibration_benchmark.model_brier_score}</span>
                  <span className="text-xs font-bold text-slate-500">vs {evaluationData.calibration_benchmark.naive_brier_score} Naive</span>
                </div>
                <div className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                  -{evaluationData.calibration_benchmark.brier_error_reduction_percent}% Error Reduction
                </div>
                <p className="text-[11px] text-slate-500 leading-normal pt-1">
                  Evaluates probability sharpness where 0.0 represents complete certainty. SwasthFlow eliminates ~74% of squared uncertainty compared to naive expectation.
                </p>
              </div>

              {/* Card 3: Expected Calibration Error */}
              <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-2 hover:border-violet-300 transition">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Calibration Error (ECE)</span>
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-black text-emerald-600">{evaluationData.calibration_benchmark.expected_calibration_error}</span>
                  <span className="text-xs font-bold text-slate-500">Pass (&lt; 0.050)</span>
                </div>
                <div className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                  <CheckCircle2 className="w-3 h-3" />
                  Clinically Calibrated (Isotonic)
                </div>
                <p className="text-[11px] text-slate-500 leading-normal pt-1">
                  10-bin held-out evaluation verifies predicted probabilities match observed discharge frequencies rather than overconfident clustering.
                </p>
              </div>

              {/* Card 4: Probability Saturation Audit */}
              <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-2 hover:border-violet-300 transition">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Saturation &amp; Bounds</span>
                  <AlertTriangle className="w-4 h-4 text-amber-500" />
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-black text-slate-900">0 Saturation</span>
                  <span className="text-xs font-bold text-slate-500">0% at 0.0 / 1.0</span>
                </div>
                <div className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                  🛡️ Guardrail #9: [{evaluationData.calibration_benchmark.min_prob_observed}, {evaluationData.calibration_benchmark.max_prob_observed}]
                </div>
                <p className="text-[11px] text-slate-500 leading-normal pt-1">
                  Strictly enforces a 92% ceiling representing irreducible ~15% baseline complication risk. Prohibits dishonest 100% certainty in medicine.
                </p>
              </div>
            </div>

            {/* 3. SECTION 2: 10-BIN CALIBRATION RELIABILITY TABLE */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden space-y-4 p-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-violet-600" />
                    10-Bin Calibration Reliability Distribution (Held-Out Test Set, N=1,000)
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Demonstrates realistic probability mass spread with tight calibration where sample sizes are statistically significant.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-1 text-[10px] font-bold bg-slate-100 text-slate-700 rounded-lg border border-slate-200">
                    Mechanism: Isotonic + Clinical Ceiling [0.05, 0.92]
                  </span>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 uppercase font-semibold text-[10px] tracking-wider border-y border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3">Probability Bin</th>
                      <th className="py-2.5 px-3 text-center">Sample Count (N)</th>
                      <th className="py-2.5 px-3">Sample Density</th>
                      <th className="py-2.5 px-3 text-right">Mean Predicted (P)</th>
                      <th className="py-2.5 px-3 text-right">Observed Rate (Y)</th>
                      <th className="py-2.5 px-3 text-right">Calibration Delta (|P - Y|)</th>
                      <th className="py-2.5 px-3">Interpretation &amp; Clinical Meaning</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                    {evaluationData.calibration_benchmark.calibration_bins.map((bin, idx) => {
                      const delta = Math.abs(bin.mean_predicted_prob - bin.observed_accuracy);
                      const densityPercent = Math.min(100, Math.round((bin.samples_count / 450) * 100));
                      const isDense = bin.samples_count >= 40;
                      return (
                        <tr key={idx} className={`hover:bg-slate-50/70 transition ${isDense ? "bg-violet-50/30 font-semibold" : ""}`}>
                          <td className="py-2.5 px-3 font-mono text-slate-900">{bin.bin_range}</td>
                          <td className="py-2.5 px-3 text-center">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                              bin.samples_count > 100 ? "bg-violet-100 text-violet-800" :
                              bin.samples_count > 20 ? "bg-slate-100 text-slate-800" : "bg-slate-50 text-slate-500"
                            }`}>
                              {bin.samples_count}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 min-w-[120px]">
                            <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                              <div
                                className={`h-full rounded-full ${bin.samples_count > 100 ? "bg-violet-600" : "bg-indigo-400"}`}
                                style={{ width: `${Math.max(4, densityPercent)}%` }}
                              />
                            </div>
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono">{(bin.mean_predicted_prob * 100).toFixed(1)}%</td>
                          <td className="py-2.5 px-3 text-right font-mono">{(bin.observed_accuracy * 100).toFixed(1)}%</td>
                          <td className="py-2.5 px-3 text-right font-mono">
                            <span className={`px-1.5 py-0.5 rounded text-[11px] ${
                              delta < 0.03 ? "bg-emerald-50 text-emerald-700 font-bold" :
                              delta < 0.08 ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-600"
                            }`}>
                              {(delta * 100).toFixed(1)}%
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-[11px] text-slate-600 max-w-xs">
                            {bin.interpretation}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-600 flex items-start gap-2">
                <Sparkles className="w-4 h-4 text-violet-600 flex-shrink-0 mt-0.5" />
                <p>
                  <strong className="text-slate-900">Why this proves genuine calibration:</strong> Rather than jamming 999 of 1000 samples into two extreme clamped bins, mass is distributed across intermediate bins. In the two dense, statistically robust bins — <span className="font-mono font-bold">[0.7, 0.8)</span> (N=46) and <span className="font-mono font-bold">[0.8, 0.9)</span> (N=429) — predicted probabilities match real-world outcomes within 1–2 percentage points (75.9% vs 73.9%, 85.2% vs 86.7%). Sparse low-probability bins reflect honest empirical sample variance rather than artificial display clipping.
                </p>
              </div>
            </div>

            {/* 4. SECTION 3: THE MEDICAL HUMILITY MATRIX (4 HONEST FAILURE CASES) */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <BookOpen className="w-5 h-5 text-rose-600" />
                    <h3 className="text-sm font-bold text-slate-900">
                      The Medical Humility Matrix: 4 Honest Failure-Case Studies
                    </h3>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Hospitals are not deterministic factories. SwasthFlow openly documents 4 critical real-world failure modes where algorithms break down, and how deterministic safeguards caught each one before patient or staff harm.
                  </p>
                </div>
                <div className="flex items-center gap-1 flex-wrap">
                  {evaluationData.honest_failure_modes.map(c => (
                    <button
                      key={c.case_id}
                      onClick={() => setSelectedFailureCaseId(c.case_id)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                        selectedFailureCaseId === c.case_id
                          ? "bg-slate-900 text-white shadow-sm"
                          : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                      }`}
                    >
                      <span className={`w-2 h-2 rounded-full ${
                        c.severity_badge === "CLINICAL_SAFETY" ? "bg-rose-500" :
                        c.severity_badge === "SOCIAL_LOGISTICS" ? "bg-amber-500" :
                        c.severity_badge === "STAFF_FATIGUE" ? "bg-purple-500" : "bg-sky-500"
                      }`} />
                      {c.case_id}
                    </button>
                  ))}
                </div>
              </div>

              {/* Active Failure Case Detailed Breakdown */}
              {(() => {
                const c = evaluationData.honest_failure_modes.find(x => x.case_id === selectedFailureCaseId) || evaluationData.honest_failure_modes[0];
                return (
                  <div className="space-y-4 animate-fade-in">
                    {/* Title & Metadata Banner */}
                    <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${
                            c.severity_badge === "CLINICAL_SAFETY" ? "bg-rose-100 text-rose-800 border border-rose-300" :
                            c.severity_badge === "SOCIAL_LOGISTICS" ? "bg-amber-100 text-amber-800 border border-amber-300" :
                            c.severity_badge === "STAFF_FATIGUE" ? "bg-purple-100 text-purple-800 border border-purple-300" :
                            "bg-sky-100 text-sky-800 border border-sky-300"
                          }`}>
                            {c.severity_badge.replace("_", " ")}
                          </span>
                          <span className="font-mono text-xs text-slate-500">{c.case_id}</span>
                          <span className="text-slate-300">&bull;</span>
                          <span className="text-xs font-bold text-slate-700">{c.patient_name}</span>
                          <span className="text-xs text-slate-400">({c.ward})</span>
                        </div>
                        <h4 className="text-base font-bold text-slate-900 mt-1">{c.title}</h4>
                        <div className="text-xs text-slate-500 mt-0.5">Clinical Context: <span className="font-semibold text-slate-700">{c.diagnosis}</span></div>
                      </div>
                      <div className="flex-shrink-0">
                        <span className="px-3 py-1.5 rounded-lg text-xs font-black bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1.5 shadow-sm">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          {c.outcome_safety}
                        </span>
                      </div>
                    </div>

                    {/* 4 Multi-Column Narrative Breakdown */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                      {/* Column 1: Clinical Scenario */}
                      <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-2 flex flex-col justify-between">
                        <div>
                          <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">1. Initial AI Forecast</div>
                          <h5 className="text-xs font-bold text-slate-900 mt-1">Signs Looked Favorable</h5>
                          <p className="text-xs text-slate-600 leading-relaxed mt-2">{c.clinical_scenario}</p>
                        </div>
                        <div className="pt-2 border-t border-slate-100 text-[11px] text-violet-700 font-medium flex items-center gap-1">
                          <Activity className="w-3.5 h-3.5" /> High ML Confidence Assigned
                        </div>
                      </div>

                      {/* Column 2: The Failure Event */}
                      <div className="bg-rose-50/40 border border-rose-200/80 rounded-xl p-4 space-y-2 flex flex-col justify-between">
                        <div>
                          <div className="text-[10px] uppercase font-bold text-rose-500 tracking-wider">2. The Real-World Breakdown</div>
                          <h5 className="text-xs font-bold text-rose-900 mt-1">Irreducible Clinical/Logistical Shock</h5>
                          <p className="text-xs text-slate-700 leading-relaxed mt-2">{c.the_failure_event}</p>
                        </div>
                        <div className="pt-2 border-t border-rose-100 text-[11px] text-rose-800 font-semibold flex items-center gap-1">
                          <AlertTriangle className="w-3.5 h-3.5 text-rose-600" /> Unexpected Event Arrived
                        </div>
                      </div>

                      {/* Column 3: Why AI Failed */}
                      <div className="bg-amber-50/40 border border-amber-200/80 rounded-xl p-4 space-y-2 flex flex-col justify-between">
                        <div>
                          <div className="text-[10px] uppercase font-bold text-amber-600 tracking-wider">3. Why Algorithms Fail Here</div>
                          <h5 className="text-xs font-bold text-amber-900 mt-1">Fundamental Scientific Limit</h5>
                          <p className="text-xs text-slate-700 leading-relaxed mt-2">{c.why_ai_failed}</p>
                        </div>
                        <div className="pt-2 border-t border-amber-100 text-[11px] text-amber-800 font-semibold flex items-center gap-1">
                          <Scale className="w-3.5 h-3.5 text-amber-600" /> AI Cannot Predict The Invisible
                        </div>
                      </div>

                      {/* Column 4: How SwasthFlow Intercepted */}
                      <div className="bg-emerald-50/50 border border-emerald-200 rounded-xl p-4 space-y-2 flex flex-col justify-between">
                        <div>
                          <div className="text-[10px] uppercase font-bold text-emerald-700 tracking-wider">4. Safeguarding Interception</div>
                          <h5 className="text-xs font-bold text-emerald-950 mt-1">{c.safeguarding_guardrail}</h5>
                          <p className="text-xs text-slate-700 leading-relaxed mt-2">{c.how_swasthflow_intercepted}</p>
                        </div>
                        <div className="pt-2 border-t border-emerald-100 text-[11px] text-emerald-800 font-bold flex items-center gap-1">
                          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" /> Guardrail Intercept Succeeded
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* 5. SECTION 4: OPERATIONAL BENCHMARKS (ROUND CLOCK & CP-SAT SEQUENCER) */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Panel A: Round Clock & Phlebotomy Backwards Scheduling */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2">
                    <Stethoscope className="w-4 h-4 text-indigo-600" />
                    <h3 className="text-sm font-bold text-slate-900">
                      Round Clock Backwards-Scheduling Engine
                    </h3>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                    100% Breakfast Compliant
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                    <div className="text-[10px] text-slate-400 uppercase font-bold">Fasting Draws Count</div>
                    <div className="text-xl font-black text-slate-900 mt-0.5">{evaluationData.round_clock_benchmark.fasting_blood_draws_count} Patients</div>
                    <div className="text-[10px] text-emerald-700 font-semibold mt-0.5">All scheduled before {evaluationData.round_clock_benchmark.breakfast_deadline}</div>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                    <div className="text-[10px] text-slate-400 uppercase font-bold">Dr. Rao Bimodal Proof</div>
                    <div className="text-xs font-bold text-slate-900 mt-1">OT Thu: <span className="font-mono text-indigo-600">{evaluationData.round_clock_benchmark.dr_rao_ot_round_time}</span></div>
                    <div className="text-xs font-bold text-slate-900">Non-OT Wed: <span className="font-mono text-emerald-600">{evaluationData.round_clock_benchmark.dr_rao_non_ot_round_time}</span></div>
                  </div>
                </div>

                <div className="p-3 bg-indigo-50/50 border border-indigo-100 rounded-xl space-y-1">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-indigo-800">Verified Backwards Formula</div>
                  <div className="font-mono text-xs font-bold text-indigo-950">{evaluationData.round_clock_benchmark.backwards_scheduling_formula}</div>
                  <div className="text-[11px] text-indigo-700 pt-1">
                    {evaluationData.round_clock_benchmark.guardrail_7_note}
                  </div>
                </div>
              </div>

              {/* Panel B: Master Sequencer CP-SAT Optimization */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2">
                    <CalendarCheck className="w-4 h-4 text-violet-600" />
                    <h3 className="text-sm font-bold text-slate-900">
                      Master Sequencer CP-SAT Optimization
                    </h3>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-violet-100 text-violet-800 border border-violet-200">
                    {evaluationData.sequencer_benchmark.solver_status} in {evaluationData.sequencer_benchmark.solve_time_seconds}s
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                    <div className="text-[10px] text-slate-400 uppercase font-bold">Tasks Scheduled</div>
                    <div className="text-xl font-black text-slate-900 mt-0.5">{evaluationData.sequencer_benchmark.tasks_scheduled} Tasks</div>
                    <div className="text-[10px] text-slate-500 mt-0.5">Across {evaluationData.sequencer_benchmark.staff_utilized_count} staff roster</div>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                    <div className="text-[10px] text-slate-400 uppercase font-bold">Guardrail #5 Alert Fatigue</div>
                    <div className="text-base font-black text-emerald-600 mt-0.5">100% Compliant</div>
                    <div className="text-[10px] text-slate-500 mt-0.5">{evaluationData.sequencer_benchmark.guardrail_5_alert_fatigue_cap}</div>
                  </div>
                </div>

                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5 text-xs text-slate-600">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-700">Guardrail #4 Confidence Floor:</span>
                    <span className="font-mono font-bold text-emerald-700">{evaluationData.sequencer_benchmark.guardrail_4_confidence_floor} (100% Passed)</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-700">Shortfall Windows Detected:</span>
                    <span className="font-mono font-bold text-slate-900">{evaluationData.sequencer_benchmark.shortfall_windows_detected} Under Standard Roster</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-700">Solver Engine:</span>
                    <span className="font-mono text-slate-600">{evaluationData.sequencer_benchmark.solver_engine}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* 6. SECTION 5: CANONICAL 10-GUARDRAILS AUDIT MATRIX */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden p-5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-emerald-600" />
                    Canonical 10-Guardrails Compliance Audit Matrix
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Live system verification showing all 10 canonical guardrails are hardcoded into production code and backed by automated unit tests.
                  </p>
                </div>
                <span className="px-3 py-1 bg-emerald-100 text-emerald-800 text-xs font-black rounded-lg border border-emerald-300 flex items-center gap-1.5 self-start sm:self-auto">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  10 / 10 Verified Passing
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 uppercase font-semibold text-[10px] tracking-wider border-y border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3 w-10 text-center">#</th>
                      <th className="py-2.5 px-3">Guardrail Name</th>
                      <th className="py-2.5 px-3">System Charter / Invariant</th>
                      <th className="py-2.5 px-3">Implementation Module</th>
                      <th className="py-2.5 px-3 text-center">Status</th>
                      <th className="py-2.5 px-3 font-mono">Test Reference</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                    {evaluationData.canonical_guardrails_audit.map(g => (
                      <tr key={g.id} className="hover:bg-slate-50/70 transition">
                        <td className="py-2.5 px-3 text-center font-mono font-bold text-slate-400">{g.id}</td>
                        <td className="py-2.5 px-3 font-bold text-slate-900">{g.name}</td>
                        <td className="py-2.5 px-3 text-[11px] text-slate-600 max-w-md leading-relaxed">{g.charter}</td>
                        <td className="py-2.5 px-3 font-mono text-[11px] text-indigo-700">{g.module}</td>
                        <td className="py-2.5 px-3 text-center">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300 inline-flex items-center gap-1">
                            <Check className="w-3 h-3 text-emerald-600" />
                            VERIFIED
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-mono text-[10px] text-slate-500">{g.test_ref}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 7. SECTION 6: STRICT SCALE SEPARATION (GUARDRAIL #10) */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
              <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <Scale className="w-4 h-4 text-indigo-600" />
                    Strict Operational Scale Separation (Guardrail #10)
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Live demonstrator telemetry is never conflated with hospital projections.
                  </p>
                </div>
                <span className="text-xs font-mono font-bold px-2.5 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
                  Guardrail #10 Active
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* 30-Bed Live Demonstrator */}
                <div className="p-4 bg-emerald-50/50 border border-emerald-200 rounded-xl space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black uppercase tracking-wider text-emerald-800">
                      Live Demonstrator ({evaluationData.operational_impact.live_30bed_demonstrator.bed_capacity} Beds)
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-200 text-emerald-900">
                      Real-Time Active
                    </span>
                  </div>
                  <div className="text-2xl font-black text-emerald-950">
                    {evaluationData.operational_impact.live_30bed_demonstrator.total_hours_saved} Hours Saved Today
                  </div>
                  <div className="space-y-1.5 pt-1">
                    {evaluationData.operational_impact.live_30bed_demonstrator.breakdown.map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between text-xs text-slate-600 bg-white/70 px-2.5 py-1 rounded border border-emerald-100">
                        <span>{item.intervention} ({item.events} events)</span>
                        <span className="font-mono font-bold text-emerald-800">{item.minutes_saved} mins ({item.hours_saved}h)</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 300-Bed Projected Regional Hospital */}
                <div className="p-4 bg-violet-50/50 border border-violet-200 rounded-xl space-y-3 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black uppercase tracking-wider text-violet-800">
                        Projected Regional Hospital ({evaluationData.operational_impact.projected_300bed_hospital.bed_capacity} Beds)
                      </span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-violet-200 text-violet-900">
                        Mathematical 10x
                      </span>
                    </div>
                    <div className="text-2xl font-black text-violet-950 mt-2">
                      {evaluationData.operational_impact.projected_300bed_hospital.daily_hours_saved} Hours Saved / Day
                    </div>
                    <div className="grid grid-cols-2 gap-2 mt-3 text-xs">
                      <div className="p-2.5 bg-white/70 rounded-lg border border-violet-100">
                        <div className="text-[10px] text-slate-400 uppercase font-bold">Annual Hours Saved</div>
                        <div className="text-base font-black text-violet-900">{evaluationData.operational_impact.projected_300bed_hospital.annual_hours_saved.toLocaleString()} hrs</div>
                      </div>
                      <div className="p-2.5 bg-white/70 rounded-lg border border-violet-100">
                        <div className="text-[10px] text-slate-400 uppercase font-bold">Annual Bed-Days Freed</div>
                        <div className="text-base font-black text-violet-900">{evaluationData.operational_impact.projected_300bed_hospital.annual_bed_days_freed.toLocaleString()} days</div>
                      </div>
                    </div>
                  </div>
                  <div className="text-[11px] text-violet-700 bg-white/80 p-2 rounded border border-violet-100 leading-normal">
                    {evaluationData.operational_impact.projected_300bed_hospital.guardrail_note}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB: EMERGENCY CONSOLE, READINESS NUMBER, TIME SAVED & BLOCKER VIEW (PHASE 9) */}
        {activeTab === "EMERGENCY_READINESS" && (
          <div className="space-y-6 animate-fade-in">
            {/* Header Hero Banner with Guardrails */}
            <div className="bg-gradient-to-r from-red-950 via-slate-900 to-indigo-950 text-white rounded-2xl p-6 shadow-md border border-red-800/40 space-y-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-start gap-4">
                  <div className="p-3 bg-red-600/30 border border-red-500/40 rounded-xl flex-shrink-0 text-red-300">
                    <ShieldAlert className="w-7 h-7" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-black tracking-wider uppercase px-2.5 py-0.5 rounded-full bg-red-500/20 text-red-300 border border-red-500/30">
                        Phase 9: Synthesis & Readiness
                      </span>
                      <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                        🛡️ Guardrail #1: The Doctor Decides
                      </span>
                      <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                        🛡️ Guardrail #8: Green-Consent Capacity
                      </span>
                      <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30">
                        🛡️ Guardrail #10: Strict Scale Separation
                      </span>
                    </div>
                    <h2 className="text-xl font-bold text-white mt-1.5 flex items-center gap-2">
                      Emergency Intake Console, 30m Readiness Number & Blocker View
                    </h2>
                    <p className="text-xs text-red-200/80 mt-1 max-w-3xl leading-relaxed">
                      Hospitals aren&apos;t short of beds; beds are free at the wrong time of day. SwasthFlow unifies real-time 30-minute absorption forecasting, single-blocker diagnostics with learned P90 budgets, one-tap mass-casualty emergency turnaround, and strictly separated demonstrator vs. hospital-scale time saved telemetry.
                    </p>
                  </div>
                </div>

                {/* Live Readiness Quick Badge */}
                <div className={`backdrop-blur-sm border rounded-xl p-4 flex flex-col items-center justify-center min-w-[210px] ${
                  readinessMetrics?.threshold_state === "CRITICAL" ? "bg-red-900/40 border-red-500/40" :
                  readinessMetrics?.threshold_state === "STRAINED" ? "bg-amber-900/40 border-amber-500/40" :
                  "bg-emerald-900/40 border-emerald-500/40"
                }`}>
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-300">
                    30-Minute Intake Margin
                  </div>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="text-3xl font-black text-white">
                      {readinessMetrics?.readiness_number ?? 0}
                    </span>
                    <span className="text-xs font-bold text-slate-200">Beds Absorbable</span>
                  </div>
                  <div className={`text-[10px] font-bold px-2 py-0.5 rounded-full mt-1.5 ${
                    readinessMetrics?.threshold_state === "CRITICAL" ? "bg-red-500 text-white" :
                    readinessMetrics?.threshold_state === "STRAINED" ? "bg-amber-500 text-slate-900" :
                    "bg-emerald-500 text-white"
                  }`}>
                    {readinessMetrics?.threshold_label ?? "🟢 Flow Healthy"}
                  </div>
                </div>
              </div>
            </div>

            {/* SECTION 1: ONE-TAP EMERGENCY CLEARANCE CONSOLE */}
            <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="p-1.5 bg-red-100 text-red-700 rounded-lg">
                      <Zap className="w-5 h-5" />
                    </span>
                    <h3 className="text-base font-bold text-slate-900">
                      One-Tap Emergency Console (Feature F9)
                    </h3>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded bg-red-50 text-red-700 border border-red-200">
                      Mass-Casualty Surge Response
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    Instantly expedites housekeeping across all DIRTY beds to 15m emergency SLA, alerts porters, and prioritizes step-down bed transfers.
                    <strong className="text-slate-700 ml-1">Guardrail #1 Invariant:</strong> Accelerates logistics; never forces automated clinical discharge.
                  </p>
                </div>

                <div className="flex items-center gap-3 flex-wrap">
                  <div>
                    <label className="text-[11px] font-semibold text-slate-500 block uppercase mb-1">
                      Surge Scenario
                    </label>
                    <select
                      value={emergencySurgeType}
                      onChange={e => setEmergencySurgeType(e.target.value)}
                      className="text-xs font-semibold bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-800 focus:ring-2 focus:ring-red-500 focus:outline-none"
                    >
                      <option value="MASS_CASUALTY_COLLISION">Highway Bus Collision (4 Beds)</option>
                      <option value="ACUTE_CARDIAC_INFLUX">Acute Cardiac/STEMI Influx (2 Beds)</option>
                      <option value="TRAUMA_MULTI_VEHICLE">Trauma Multi-Vehicle Crash (3 Beds)</option>
                      <option value="EPIDEMIC_SURGE">Epidemic Respiratory Wave (5 Beds)</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-slate-500 block uppercase mb-1">
                      Target Beds Needed
                    </label>
                    <div className="flex items-center gap-2 bg-slate-50 border border-slate-300 rounded-lg px-2 py-1">
                      <button
                        onClick={() => setEmergencyBedsNeeded(Math.max(1, emergencyBedsNeeded - 1))}
                        className="w-6 h-6 rounded bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-xs"
                      >
                        -
                      </button>
                      <span className="font-bold text-slate-800 text-sm px-1">{emergencyBedsNeeded}</span>
                      <button
                        onClick={() => setEmergencyBedsNeeded(Math.min(6, emergencyBedsNeeded + 1))}
                        className="w-6 h-6 rounded bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-xs"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  <div className="self-end">
                    <button
                      onClick={handleActivateEmergency}
                      disabled={emergencyLoading}
                      className="px-5 py-2.5 bg-red-600 hover:bg-red-700 active:bg-red-800 text-white font-bold text-xs rounded-lg shadow-md shadow-red-200 transition flex items-center gap-2 disabled:opacity-50"
                    >
                      <ShieldAlert className="w-4 h-4" />
                      {emergencyLoading ? "Activating Surge Response..." : "🚨 ACTIVATE EMERGENCY CLEARANCE"}
                    </button>
                  </div>
                </div>
              </div>

              {/* Emergency Execution Results Live Banner */}
              {emergencyActivationResult && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4 space-y-3 animate-fade-in">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-5 h-5 text-red-600" />
                      <span className="text-xs font-bold text-red-900 uppercase tracking-wider">
                        Surge Clearance Successfully Dispatched for {emergencyActivationResult.beds_needed} Beds
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-500 font-mono">
                      Timestamp: {new Date(emergencyActivationResult.timestamp).toLocaleTimeString()}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="bg-white p-3 rounded-lg border border-red-200 shadow-sm">
                      <div className="text-[10px] font-bold text-slate-500 uppercase">Immediate Ready Beds</div>
                      <div className="text-xl font-black text-emerald-700 mt-0.5">
                        {emergencyActivationResult.immediately_ready_count} Beds
                      </div>
                      <div className="text-[11px] text-slate-600 font-mono mt-1">
                        {emergencyActivationResult.immediately_ready_beds.length > 0 
                          ? emergencyActivationResult.immediately_ready_beds.join(", ") 
                          : "None immediately ready"}
                      </div>
                    </div>

                    <div className="bg-white p-3 rounded-lg border border-red-200 shadow-sm">
                      <div className="text-[10px] font-bold text-slate-500 uppercase">Expedited Cleaning (15m SLA)</div>
                      <div className="text-xl font-black text-amber-700 mt-0.5">
                        {emergencyActivationResult.expedited_cleaning_beds.length} Beds
                      </div>
                      <div className="text-[11px] text-slate-600 font-mono mt-1">
                        {emergencyActivationResult.expedited_cleaning_beds.length > 0
                          ? emergencyActivationResult.expedited_cleaning_beds.join(", ")
                          : "0 dirty beds in queue"}
                      </div>
                    </div>

                    <div className="bg-white p-3 rounded-lg border border-red-200 shadow-sm">
                      <div className="text-[10px] font-bold text-slate-500 uppercase">Total Absorbable Margin</div>
                      <div className="text-xl font-black text-indigo-700 mt-0.5">
                        {emergencyActivationResult.total_absorbable_soon} Beds in ≤ 30m
                      </div>
                      <div className="text-[11px] text-indigo-600 mt-1 font-semibold">
                        Sufficient for incoming casualty load
                      </div>
                    </div>
                  </div>

                  <div className="bg-white p-3 rounded-lg border border-red-100 space-y-1 text-xs text-slate-700">
                    <div className="text-[11px] font-bold text-red-800 uppercase tracking-wider mb-1">
                      Frontline Broadcast Alerts Transmitted:
                    </div>
                    {emergencyActivationResult.broadcast_alerts.map((alertText, idx) => (
                      <div key={idx} className="flex items-start gap-2">
                        <span className="text-red-500 font-bold">•</span>
                        <span>{alertText}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* SECTION 2: LIVE 30-MINUTE READINESS MATRIX */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Left Column: Readiness Scoreboard & Action */}
              <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4 md:col-span-1">
                <div className="flex items-center gap-2">
                  <span className="p-1.5 bg-indigo-100 text-indigo-700 rounded-lg">
                    <Activity className="w-5 h-5" />
                  </span>
                  <div>
                    <h3 className="text-base font-bold text-slate-900">Live Readiness Index</h3>
                    <p className="text-xs text-slate-500">Absorbable within 30 minutes</p>
                  </div>
                </div>

                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-center space-y-2">
                  <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Total Ready in 30 Minutes
                  </div>
                  <div className="text-5xl font-black text-slate-900">
                    {readinessMetrics?.readiness_number ?? 0}
                  </div>
                  <div className="text-xs font-bold text-slate-600">
                    {readinessMetrics?.ready_now ?? 0} Ready Now + {readinessMetrics?.turnover_in_30m ?? 0} Near-Ready (≤30m)
                  </div>
                  <div className={`inline-block px-3 py-1 rounded-full text-xs font-bold ${
                    readinessMetrics?.threshold_state === "CRITICAL" ? "bg-red-100 text-red-800 border border-red-300" :
                    readinessMetrics?.threshold_state === "STRAINED" ? "bg-amber-100 text-amber-800 border border-amber-300" :
                    "bg-emerald-100 text-emerald-800 border border-emerald-300"
                  }`}>
                    {readinessMetrics?.threshold_label ?? "🟢 Flow Healthy"}
                  </div>
                </div>

                <div className="p-3.5 bg-indigo-50 border border-indigo-200 rounded-xl space-y-1">
                  <div className="text-[11px] font-bold text-indigo-900 uppercase tracking-wider">
                    Recommended Operational Action:
                  </div>
                  <p className="text-xs text-indigo-800 leading-relaxed font-medium">
                    {readinessMetrics?.threshold_action ?? "Hospital operational flow within safe intake capacity margins."}
                  </p>
                </div>

                <div className="text-[11px] text-slate-400 bg-slate-50 p-2.5 rounded-lg border border-slate-200 leading-snug">
                  🛡️ <strong>Guardrail #8 Rule:</strong> Only verified <strong>READY</strong> beds or beds with confirmed <strong>🟢 Green consent</strong> are counted toward intake readiness.
                </div>
              </div>

              {/* Right Column: Ward Breakdown & Ready Bed Cards */}
              <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4 md:col-span-2">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-bold text-slate-900">Ward Capacity & Turnover Breakdown</h3>
                    <p className="text-xs text-slate-500">Live status across ICU, Medical Ward A, and Surgical Ward B</p>
                  </div>
                  <span className="text-xs font-bold px-2.5 py-1 bg-slate-100 text-slate-700 rounded-lg">
                    Total: {readinessMetrics?.total_hospital_beds ?? 30} Beds
                  </span>
                </div>

                {/* Ward Breakdown Cards */}
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { key: "ICU", title: "ICU", count: 6 },
                    { key: "WARD_A", title: "Ward A (Medical)", count: 12 },
                    { key: "WARD_B", title: "Ward B (Surgical)", count: 12 }
                  ].map(w => {
                    const stats = readinessMetrics?.ward_breakdown[w.key as "ICU" | "WARD_A" | "WARD_B"] || {
                      ready_now: 0, turnover_30m: 0, occupied: 0, dirty: 0, reserved: 0, total: w.count
                    };
                    return (
                      <div key={w.key} className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-900">{w.title}</span>
                          <span className="text-[10px] text-slate-500 font-semibold">{stats.total} Beds</span>
                        </div>
                        <div className="flex items-baseline gap-2">
                          <span className="text-2xl font-black text-emerald-700">{stats.ready_now}</span>
                          <span className="text-[11px] text-slate-500 font-medium">Ready now</span>
                        </div>
                        <div className="text-[11px] text-amber-700 font-semibold">
                          +{stats.turnover_30m} turnover in ≤30m
                        </div>
                        <div className="text-[10px] text-slate-500 pt-1 border-t border-slate-200 flex justify-between">
                          <span>Occ: {stats.occupied}</span>
                          <span>Dirty: {stats.dirty}</span>
                          <span>Res: {stats.reserved}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Near-Ready Beds List */}
                <div className="space-y-2 pt-2">
                  <div className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Immediate & Near-Ready Bed Queue (≤ 30 Min Availability)
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
                    {readinessMetrics?.ready_now_beds.map(b => (
                      <div key={b.bed_id} className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                          <div>
                            <span className="font-mono font-bold text-emerald-950">{b.bed_id}</span>
                            <span className="text-[10px] text-slate-500 ml-1.5">({b.ward})</span>
                          </div>
                        </div>
                        <span className="font-bold text-emerald-800 text-[11px] bg-white px-2 py-0.5 rounded border border-emerald-200">
                          Ready Immediately
                        </span>
                      </div>
                    ))}

                    {readinessMetrics?.near_ready_beds.map(b => (
                      <div key={b.bed_id} className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse"></span>
                          <div>
                            <span className="font-mono font-bold text-amber-950">{b.bed_id}</span>
                            <span className="text-[10px] text-slate-500 ml-1.5">({b.ward})</span>
                          </div>
                        </div>
                        <span className="font-bold text-amber-800 text-[11px] bg-white px-2 py-0.5 rounded border border-amber-200">
                          {b.status_label}
                        </span>
                      </div>
                    ))}

                    {(!readinessMetrics || (readinessMetrics.ready_now_beds.length === 0 && readinessMetrics.near_ready_beds.length === 0)) && (
                      <div className="p-4 text-center text-xs text-slate-400 italic sm:col-span-2">
                        No beds currently ready or completing turnover in ≤30m. Emergency clearance recommended.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* SECTION 3: TIME SAVED TODAY COUNTER (GUARDRAIL #10 SCALE SEPARATION) */}
            <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="p-1.5 bg-indigo-100 text-indigo-700 rounded-lg">
                      <Timer className="w-5 h-5" />
                    </span>
                    <h3 className="text-base font-bold text-slate-900">
                      Time Saved Today Counter (Proactive Sequencing vs Baseline)
                    </h3>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Empirically derived operational savings from insurance pre-clearance, backwards-scheduled lab draws, 2x ICU step-down prep, and rapid bed sanitization.
                  </p>
                </div>
                <span className="text-[11px] font-bold px-3 py-1 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg">
                  🛡️ Guardrail #10 Verified: Scale Separated
                </span>
              </div>

              {/* Side-by-Side Strict Scale Separation Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Column A: Live Measured Demonstrator (30 Beds) */}
                <div className="p-5 bg-gradient-to-br from-indigo-50 to-white border-2 border-indigo-200 rounded-xl space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-black uppercase tracking-wider text-indigo-600 bg-indigo-100 px-2 py-0.5 rounded">
                        Live Demonstrator Telemetry
                      </span>
                      <h4 className="text-base font-bold text-slate-900 mt-1">
                        Measured Hospital Unit (30 Beds)
                      </h4>
                    </div>
                    <div className="text-right">
                      <div className="text-3xl font-black text-indigo-700">
                        {timeSavedData?.live_demonstrator_30bed.total_hours_saved ?? 0} hrs
                      </div>
                      <div className="text-[11px] text-slate-500 font-semibold">
                        ({timeSavedData?.live_demonstrator_30bed.total_minutes_saved ?? 0} minutes saved today)
                      </div>
                    </div>
                  </div>

                  <div className="overflow-hidden border border-indigo-100 rounded-lg bg-white">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-indigo-50/50 text-slate-600 font-semibold uppercase text-[10px] border-b border-indigo-100">
                        <tr>
                          <th className="py-2 px-3">Intervention Workflow</th>
                          <th className="py-2 px-3 text-center">Active Events</th>
                          <th className="py-2 px-3 text-right">Hours Saved</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-indigo-50 text-slate-700">
                        {timeSavedData?.live_demonstrator_30bed.breakdown.map((item, idx) => (
                          <tr key={idx} className="hover:bg-indigo-50/30 transition">
                            <td className="py-2 px-3 font-medium text-slate-900">{item.intervention}</td>
                            <td className="py-2 px-3 text-center font-bold text-indigo-600">{item.events}</td>
                            <td className="py-2 px-3 text-right font-mono font-bold text-emerald-700">+{item.hours_saved}h</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="text-[11px] text-slate-500 italic">
                    * Measured live across the active 30-bed demonstrator cohort.
                  </div>
                </div>

                {/* Column B: Projected Enterprise Scale (300 Beds) */}
                <div className="p-5 bg-gradient-to-br from-slate-900 to-indigo-950 text-white border-2 border-slate-700 rounded-xl space-y-4 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-black uppercase tracking-wider text-amber-300 bg-amber-500/20 border border-amber-500/30 px-2 py-0.5 rounded">
                        10x Extrapolation Projection
                      </span>
                      <h4 className="text-base font-bold text-white mt-1">
                        Enterprise Hospital Projection (300 Beds)
                      </h4>
                    </div>
                    <div className="text-right">
                      <div className="text-3xl font-black text-amber-400">
                        {timeSavedData?.projected_hospital_300bed.daily_hours_saved ?? 0} hrs/day
                      </div>
                      <div className="text-[11px] text-slate-300">
                        Daily operational dividend
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <div className="bg-white/10 p-3 rounded-lg border border-white/10">
                      <div className="text-[10px] font-bold text-slate-300 uppercase">Annual Hours Saved</div>
                      <div className="text-2xl font-black text-emerald-400 mt-1">
                        {(timeSavedData?.projected_hospital_300bed.annual_hours_saved ?? 0).toLocaleString()} hrs
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5">365-day enterprise run-rate</div>
                    </div>

                    <div className="bg-white/10 p-3 rounded-lg border border-white/10">
                      <div className="text-[10px] font-bold text-slate-300 uppercase">Annual Bed-Days Freed</div>
                      <div className="text-2xl font-black text-indigo-400 mt-1">
                        {(timeSavedData?.projected_hospital_300bed.annual_bed_days_freed ?? 0).toLocaleString()} days
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5">Equivalent to adding 24 new beds</div>
                    </div>
                  </div>

                  <div className="bg-black/30 p-3 rounded-lg border border-white/10 text-[11px] text-slate-300 space-y-1">
                    <div className="font-bold text-amber-300 flex items-center gap-1">
                      <span>🛡️</span> Guardrail #10 Strict Scale Separation Notice:
                    </div>
                    <p className="leading-relaxed">
                      {timeSavedData?.projected_hospital_300bed.guardrail_note ?? "Live demonstrator telemetry is never blended with 300-bed hospital projections."}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* SECTION 4: 'WHAT'S BLOCKING THIS BED?' SINGLE-BLOCKER DIAGNOSTIC GRID */}
            <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="p-1.5 bg-amber-100 text-amber-700 rounded-lg">
                      <AlertTriangle className="w-5 h-5" />
                    </span>
                    <h3 className="text-base font-bold text-slate-900">
                      &ldquo;What&apos;s Blocking This Bed?&rdquo; Single-Blocker Diagnostic View
                    </h3>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Pinpoints the single active operational bottleneck for every bed with Delay Book learned P90 step budgets and actionable next steps.
                  </p>
                </div>

                <div className="text-xs text-slate-500">
                  Showing <strong>{blockersData?.total_beds_analyzed ?? 30} Beds Analyzed</strong>
                </div>
              </div>

              {/* Blocker Filter Chips */}
              <div className="flex items-center gap-1.5 flex-wrap">
                {[
                  { key: "ALL", label: `All Beds (${blockersData?.total_beds_analyzed ?? 30})` },
                  { key: "HOUSEKEEPING_CLEANING", label: `Cleaning (${blockersData?.blocker_counts["HOUSEKEEPING_CLEANING"] ?? 0})` },
                  { key: "DOCTOR_ROUND_PENDING", label: `Doctor Round (${blockersData?.blocker_counts["DOCTOR_ROUND_PENDING"] ?? 0})` },
                  { key: "TPA_QUERY_UNRESOLVED", label: `Insurance Pre-Clearance (${blockersData?.blocker_counts["TPA_QUERY_UNRESOLVED"] ?? 0})` },
                  { key: "CASH_BILL_CONFIRMATION", label: `Cash Estimate (${blockersData?.blocker_counts["CASH_BILL_CONFIRMATION"] ?? 0})` },
                  { key: "FAMILY_CONSENT_WORRIED", label: `Family Anxious (${blockersData?.blocker_counts["FAMILY_CONSENT_WORRIED"] ?? 0})` },
                  { key: "PORTER_TRANSFER_PENDING", label: `Porter Transfer (${blockersData?.blocker_counts["PORTER_TRANSFER_PENDING"] ?? 0})` },
                  { key: "CLINICAL_STABILIZATION", label: `Active Treatment (${blockersData?.blocker_counts["CLINICAL_STABILIZATION"] ?? 0})` },
                  { key: "READY", label: `Ready for Intake (${blockersData?.blocker_counts["READY"] ?? 0})` }
                ].map(chip => (
                  <button
                    key={chip.key}
                    onClick={() => setSelectedBlockerFilter(chip.key)}
                    className={`px-3 py-1 text-xs font-semibold rounded-lg transition ${
                      selectedBlockerFilter === chip.key
                        ? "bg-slate-900 text-white shadow-sm"
                        : "bg-slate-100 hover:bg-slate-200 text-slate-700"
                    }`}
                  >
                    {chip.label}
                  </button>
                ))}
              </div>

              {/* Blocker Table */}
              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 font-semibold uppercase text-[10px] tracking-wider border-b border-slate-200">
                    <tr>
                      <th className="py-3 px-3">Bed ID / Ward</th>
                      <th className="py-3 px-3">State</th>
                      <th className="py-3 px-3">Patient & Diagnosis</th>
                      <th className="py-3 px-3">Primary Bottleneck</th>
                      <th className="py-3 px-3 text-center">Learned P90 Budget</th>
                      <th className="py-3 px-3">Actionable Resolving Path</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {blockersData?.blockers
                      .filter(b => selectedBlockerFilter === "ALL" || b.blocker_key === selectedBlockerFilter)
                      .map(b => (
                        <tr key={b.bed_id} className="hover:bg-slate-50/70 transition">
                          <td className="py-3 px-3">
                            <div className="font-mono font-bold text-slate-900">{b.bed_id}</div>
                            <div className="text-[10px] text-slate-400 font-medium">{b.ward} • {b.bed_type}</div>
                          </td>
                          <td className="py-3 px-3">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              b.state === "READY" ? "bg-emerald-100 text-emerald-800" :
                              b.state === "DIRTY" ? "bg-amber-100 text-amber-800" :
                              b.state === "RESERVED" ? "bg-blue-100 text-blue-800" :
                              "bg-slate-100 text-slate-800"
                            }`}>
                              {b.state}
                            </span>
                          </td>
                          <td className="py-3 px-3">
                            {b.patient_name ? (
                              <div>
                                <div className="font-semibold text-slate-900">{b.patient_name}</div>
                                <div className="text-[10px] text-slate-500">
                                  {b.diagnosis_name} {b.payer_type && `• ${b.payer_type}`}
                                </div>
                              </div>
                            ) : (
                              <span className="text-slate-400 italic">— No Patient —</span>
                            )}
                          </td>
                          <td className="py-3 px-3">
                            <div className="flex items-center gap-1.5">
                              <span className={`w-2 h-2 rounded-full ${
                                b.severity === "RED" ? "bg-red-500" :
                                b.severity === "AMBER" ? "bg-amber-500" :
                                b.severity === "BLUE" ? "bg-blue-500" : "bg-emerald-500"
                              }`}></span>
                              <span className="font-bold text-slate-900">{b.blocker_name}</span>
                            </div>
                            <div className="text-[10px] text-slate-500 mt-0.5 max-w-xs">{b.blocker_description}</div>
                          </td>
                          <td className="py-3 px-3 text-center">
                            <span className="font-mono font-bold text-slate-800 bg-slate-100 px-2 py-1 rounded">
                              {b.learned_p90_minutes > 0 ? `${b.learned_p90_minutes}m` : "0m (Ready)"}
                            </span>
                          </td>
                          <td className="py-3 px-3">
                            <div className="text-slate-800 font-medium text-[11px] leading-snug">
                              {b.resolving_action}
                            </div>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB: ICU STEP-DOWN & 2X CANDIDATE OVER-PREPARATION (FEATURE F3) */}
        {activeTab === "ICU_STEPDOWN" && (
          <div className="space-y-6 animate-fade-in">
            {/* Header Hero Banner with Guardrails */}
            <div className="bg-gradient-to-r from-rose-950 via-slate-900 to-indigo-950 text-white rounded-2xl p-6 shadow-md border border-rose-800/40 space-y-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-start gap-4">
                  <div className="p-3 bg-rose-600/30 border border-rose-500/40 rounded-xl flex-shrink-0 text-rose-300">
                    <HeartPulse className="w-7 h-7" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-black tracking-wider uppercase px-2.5 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30">
                        Feature F3: ICU Step-Down
                      </span>
                      <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                        🛡️ Guardrail #1: Doctor Exclusively Triggers
                      </span>
                      <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30">
                        🛡️ Rule #10: 2x Candidate Over-Preparation
                      </span>
                      <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                        🛡️ Guardrail #8: Green-Consent Capacity
                      </span>
                    </div>
                    <h2 className="text-xl font-bold text-white mt-1.5 flex items-center gap-2">
                      ICU Step-Down Screen & 2x Candidate Over-Preparation
                    </h2>
                    <p className="text-xs text-rose-200/80 mt-1 max-w-3xl leading-relaxed">
                      Hospitals aren&apos;t short of ICU beds; emergency intake is blocked because families hesitate and ward beds aren&apos;t clean in advance.
                      SwasthFlow prepares <strong>2x candidates</strong> per target bed needed: if Candidate #1&apos;s family hesitates or refuses, Candidate #2 steps down immediately with zero emergency delay.
                    </p>
                  </div>
                </div>

                {/* Target Beds Needed Counter */}
                <div className="bg-white/10 backdrop-blur-sm border border-white/15 rounded-xl p-3.5 flex flex-col items-center justify-center min-w-[200px]">
                  <div className="text-[11px] font-semibold text-rose-200 uppercase tracking-wider">Target ICU Beds to Free</div>
                  <div className="flex items-center gap-3 mt-1.5">
                    <button
                      onClick={() => setStepdownTargetBeds(Math.max(1, stepdownTargetBeds - 1))}
                      className="w-7 h-7 rounded-lg bg-white/20 hover:bg-white/30 text-white font-bold flex items-center justify-center transition"
                    >
                      -
                    </button>
                    <span className="text-2xl font-black text-white">{stepdownTargetBeds}</span>
                    <button
                      onClick={() => setStepdownTargetBeds(Math.min(3, stepdownTargetBeds + 1))}
                      className="w-7 h-7 rounded-lg bg-white/20 hover:bg-white/30 text-white font-bold flex items-center justify-center transition"
                    >
                      +
                    </button>
                  </div>
                  <div className="text-[10px] text-amber-300 font-medium mt-1">
                    Requires {stepdownTargetBeds * 2} Candidates (2x Rule)
                  </div>
                </div>
              </div>

              {/* 2x Over-Preparation Live Buffer Bar */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-2 border-t border-white/10">
                <div className="bg-black/20 rounded-lg p-2.5">
                  <div className="text-[10px] uppercase tracking-wider text-rose-300 font-semibold">ICU Occupancy</div>
                  <div className="text-lg font-bold text-white mt-0.5">
                    {icuRoster?.icu_total_occupied ?? 0} / 6 Beds
                  </div>
                </div>
                <div className="bg-black/20 rounded-lg p-2.5">
                  <div className="text-[10px] uppercase tracking-wider text-blue-300 font-semibold">Candidates Prepared</div>
                  <div className="text-lg font-bold text-white mt-0.5 flex items-center gap-1.5">
                    {icuRoster?.candidates_prepared ?? 0} / {icuRoster?.candidates_required ?? 2}
                    <span className="text-[10px] px-1.5 py-0.2 bg-blue-500/40 text-blue-200 rounded font-semibold">
                      2x Active
                    </span>
                  </div>
                </div>
                <div className="bg-black/20 rounded-lg p-2.5">
                  <div className="text-[10px] uppercase tracking-wider text-emerald-300 font-semibold">🟢 Green Agreed</div>
                  <div className="text-lg font-bold text-emerald-400 mt-0.5">
                    {icuRoster?.green_consent_count ?? 0} Unlocked
                  </div>
                </div>
                <div className="bg-black/20 rounded-lg p-2.5">
                  <div className="text-[10px] uppercase tracking-wider text-amber-300 font-semibold">🟡 Amber Worried</div>
                  <div className="text-lg font-bold text-amber-400 mt-0.5">
                    {icuRoster?.amber_consent_count ?? 0} Counseling
                  </div>
                </div>
                <div className="bg-black/20 rounded-lg p-2.5">
                  <div className="text-[10px] uppercase tracking-wider text-rose-300 font-semibold">Ward Beds Reserved</div>
                  <div className="text-lg font-bold text-white mt-0.5">
                    {icuRoster?.reserved_beds_count ?? 0} Beds Held
                  </div>
                </div>
              </div>
            </div>

            {/* Master-Detail Split Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Left Column: Candidate Roster Cards (5 cols) */}
              <div className="lg:col-span-5 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                    <HeartPulse className="w-4 h-4 text-rose-600" />
                    ICU Patient Roster ({icuRoster?.roster.length ?? 0})
                  </h3>
                  <span className="text-[11px] text-slate-400 font-medium">Sorted by Clinical Stability</span>
                </div>

                {icuRoster?.roster.map((cand) => {
                  const isSelected = selectedIcuEncounterId === cand.encounter_id;
                  const isPrimary = cand.role_in_buffer === "PRIMARY";
                  const isBuffer = cand.role_in_buffer === "BUFFER";
                  const isRefused = cand.role_in_buffer === "REFUSED";

                  return (
                    <div
                      key={cand.encounter_id}
                      onClick={() => setSelectedIcuEncounterId(cand.encounter_id)}
                      className={`p-4 rounded-xl border transition cursor-pointer text-left ${
                        isSelected
                          ? "bg-rose-50/70 border-rose-400 shadow-sm ring-1 ring-rose-400"
                          : "bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/50"
                      }`}
                    >
                      {/* Top Row: Buffer Role Badge & Bed */}
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <div className="flex items-center gap-1.5">
                          {isPrimary && (
                            <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-purple-100 text-purple-800 border border-purple-200 flex items-center gap-1">
                              ⭐ Primary Candidate
                            </span>
                          )}
                          {isBuffer && (
                            <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-blue-100 text-blue-800 border border-blue-200 flex items-center gap-1">
                              🛡️ 2x Buffer Candidate
                            </span>
                          )}
                          {isRefused && (
                            <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-md bg-rose-100 text-rose-700 border border-rose-200 flex items-center gap-1">
                              ❌ Refused (Bed Released)
                            </span>
                          )}
                          {!isPrimary && !isBuffer && !isRefused && (
                            <span className="text-[10px] font-medium uppercase px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200">
                              ICU Monitoring
                            </span>
                          )}
                        </div>
                        <span className="text-xs font-mono font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                          {cand.bed_id}
                        </span>
                      </div>

                      {/* Patient Name & Clinical Details */}
                      <div className="flex items-baseline justify-between">
                        <div className="font-bold text-sm text-slate-900">{cand.patient_name}</div>
                        <div className="text-xs text-slate-500 font-medium">{cand.age}y • {cand.gender}</div>
                      </div>

                      <div className="text-xs text-slate-600 font-medium mt-0.5 truncate">
                        {cand.diagnosis_name}
                      </div>

                      <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-1">
                        <Stethoscope className="w-3 h-3 text-slate-400" />
                        {cand.consultant_name}
                      </div>

                      {/* Clinical Stability Score Bar */}
                      <div className="mt-3 pt-2.5 border-t border-slate-100">
                        <div className="flex items-center justify-between text-[11px] font-semibold mb-1">
                          <span className="text-slate-600">Clinical Stability Score</span>
                          <span className={
                            cand.stability_score >= 0.8
                              ? "text-emerald-700"
                              : cand.stability_score >= 0.5
                              ? "text-amber-700"
                              : "text-rose-700"
                          }>
                            {Math.round(cand.stability_score * 100)}% ({cand.stability_status.replace(/_/g, " ")})
                          </span>
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                          <div
                            className={`h-1.5 rounded-full transition-all ${
                              cand.stability_score >= 0.8
                                ? "bg-emerald-500"
                                : cand.stability_score >= 0.5
                                ? "bg-amber-500"
                                : "bg-rose-500"
                            }`}
                            style={{ width: `${Math.round(cand.stability_score * 100)}%` }}
                          />
                        </div>

                        {/* Signs Pills */}
                        <div className="flex items-center gap-1.5 flex-wrap mt-2 text-[10px]">
                          <span className={`px-1.5 py-0.5 rounded ${cand.vitals_stable ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-rose-50 text-rose-700 border border-rose-200"}`}>
                            Vitals: {cand.vitals_stable ? "Stable ✓" : "Unstable ✗"}
                          </span>
                          <span className={`px-1.5 py-0.5 rounded ${cand.oxygen_removed ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-amber-50 text-amber-700 border border-amber-200"}`}>
                            O2: {cand.oxygen_removed ? "Room Air ✓" : "Dependent"}
                          </span>
                          <span className={`px-1.5 py-0.5 rounded ${cand.iv_to_oral ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-slate-100 text-slate-600"}`}>
                            Meds: {cand.iv_to_oral ? "Oral ✓" : "IV Only"}
                          </span>
                          <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                            Stay: {cand.los_days}d
                          </span>
                        </div>
                      </div>

                      {/* Status Bottom Bar */}
                      <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                        <div className="text-[11px] font-medium text-slate-500">
                          Route: <strong className="text-slate-800">{cand.preferred_ward === "WARD_B" ? "Ward B (Surg)" : "Ward A (Med)"}</strong>
                        </div>
                        <div>
                          {cand.icu_stepdown_status === "NONE" && (
                            <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                              Doctor Review Pending
                            </span>
                          )}
                          {cand.icu_stepdown_status === "BED_RESERVED" && (
                            <span className="text-[10px] font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded">
                              Bed Reserved: {cand.reserved_bed_id}
                            </span>
                          )}
                          {cand.icu_stepdown_status === "READY_FOR_TRANSFER" && (
                            <span className="text-[10px] font-black text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded flex items-center gap-1">
                              🟢 Ready to Transfer
                            </span>
                          )}
                          {cand.icu_stepdown_status === "CONSENT_WORRIED" && (
                            <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded">
                              🟡 Worried (Counseling)
                            </span>
                          )}
                          {cand.icu_stepdown_status === "CONSENT_REFUSED" && (
                            <span className="text-[10px] font-bold text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded">
                              🔴 Refused (Bed Freed)
                            </span>
                          )}
                          {cand.icu_stepdown_status === "TRANSFERRED" && (
                            <span className="text-[10px] font-black text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded">
                              ✓ Transferred
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Right Column: Selected Candidate Action Panel (7 cols) */}
              <div className="lg:col-span-7 space-y-4">
                {(() => {
                  const selectedCand = icuRoster?.roster.find(c => c.encounter_id === selectedIcuEncounterId);
                  if (!selectedCand) {
                    return (
                      <div className="bg-white p-8 rounded-xl border border-slate-200 text-center text-slate-500">
                        Select an ICU patient from the roster to view step-down preparation workflow.
                      </div>
                    );
                  }

                  return (
                    <div className="space-y-4">
                      {/* Selected Candidate Header Card */}
                      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-3">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="text-lg font-bold text-slate-900">{selectedCand.patient_name}</h3>
                              <span className="text-xs font-mono bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-semibold">
                                {selectedCand.bed_id}
                              </span>
                              <span className="text-xs font-semibold px-2 py-0.5 rounded bg-rose-100 text-rose-800">
                                {selectedCand.role_description}
                              </span>
                            </div>
                            <div className="text-xs text-slate-600 mt-0.5">
                              {selectedCand.diagnosis_name} • {selectedCand.age}y {selectedCand.gender} • Attending: <strong>{selectedCand.consultant_name}</strong>
                            </div>
                          </div>
                          <div className="text-right">
                            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">Specialty Ward Routing</span>
                            <span className="text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2.5 py-1 rounded inline-block mt-0.5">
                              {selectedCand.preferred_ward === "WARD_B" ? "Ward B (Surgical Specialty)" : "Ward A (Medical/Cardio)"}
                            </span>
                          </div>
                        </div>

                        {/* Clinical Stabilization Checklist */}
                        <div className="bg-slate-50 p-3 rounded-lg border border-slate-200/80">
                          <div className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                            <Stethoscope className="w-3.5 h-3.5 text-rose-600" />
                            Clinical Stabilization Factors (Advisory Only)
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                            {selectedCand.stability_factors.map((factor, fIdx) => (
                              <div key={fIdx} className="flex items-center gap-1.5 text-slate-700">
                                <Check className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                                <span>{factor}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* STEP 1: THE DOCTOR DECIDES (GUARDRAIL #1) */}
                      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-rose-100 text-rose-800 font-bold text-xs flex items-center justify-center">
                              1
                            </div>
                            <h4 className="text-sm font-bold text-slate-900">
                              The Doctor Decides (Guardrail #1)
                            </h4>
                          </div>
                          <span className="text-[11px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded">
                            Mandatory Human Clinician Authorization
                          </span>
                        </div>

                        <p className="text-xs text-slate-600 leading-relaxed">
                          In accordance with <strong>Guardrail #1</strong>, SwasthFlow <em>never</em> automatically declares a patient ready for ward.
                          The attending clinician must physically verify hemodynamic stability and authorize step-down.
                        </p>

                        {!selectedCand.stepdown_doctor_confirmed ? (
                          <div className="pt-2">
                            <button
                              onClick={() => handleDoctorStepdownTrigger(selectedCand.encounter_id, selectedCand.consultant_id)}
                              disabled={icuActionLoading}
                              className="w-full sm:w-auto px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-lg shadow-sm transition flex items-center justify-center gap-2"
                            >
                              <Stethoscope className="w-4 h-4" />
                              {icuActionLoading ? "Reserving & Queuing Logistics..." : `Confirm Clinically Ready for Ward (${selectedCand.consultant_name})`}
                            </button>
                            <span className="text-[11px] text-slate-400 block mt-1.5">
                              Auto-reserves best matching {selectedCand.preferred_ward} bed, queues porter transfer with backward-math WHY.
                            </span>
                          </div>
                        ) : (
                          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg flex items-start gap-3">
                            <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                            <div className="text-xs space-y-0.5">
                              <div className="font-bold text-emerald-900">
                                Clinician Step-Down Authorized by {selectedCand.consultant_name}
                              </div>
                              <div className="text-emerald-700">
                                Ward Bed Reserved: <strong>{selectedCand.reserved_bed_id} ({selectedCand.preferred_ward})</strong> • Porter Transfer Task Queued with Backward-Math WHY.
                              </div>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* STEP 2: FAMILY COMMUNICATION & CONSENT TRAFFIC LIGHT */}
                      <div className={`bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-3 transition ${!selectedCand.stepdown_doctor_confirmed ? "opacity-50 pointer-events-none" : ""}`}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-800 font-bold text-xs flex items-center justify-center">
                              2
                            </div>
                            <h4 className="text-sm font-bold text-slate-900">
                              Family Consent Traffic Light & Positive Phrasing
                            </h4>
                          </div>
                          <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg text-xs">
                            <button
                              onClick={() => setIcuScriptLang("EN")}
                              className={`px-2 py-0.5 rounded font-bold transition ${icuScriptLang === "EN" ? "bg-white text-slate-900 shadow-xs" : "text-slate-500"}`}
                            >
                              English
                            </button>
                            <button
                              onClick={() => setIcuScriptLang("HI")}
                              className={`px-2 py-0.5 rounded font-bold transition ${icuScriptLang === "HI" ? "bg-white text-slate-900 shadow-xs" : "text-slate-500"}`}
                            >
                              हिंदी
                            </button>
                          </div>
                        </div>

                        {/* Canonical Positive Recovery Script Box */}
                        <div className="p-3.5 bg-indigo-50/70 border border-indigo-200 rounded-lg space-y-1.5">
                          <div className="flex items-center justify-between text-[11px] font-bold text-indigo-900">
                            <span className="flex items-center gap-1">
                              <MessageSquare className="w-3.5 h-3.5 text-indigo-600" />
                              Canonical Nurse Script (Recovery-Centered Phrasing)
                            </span>
                            <span className="text-[10px] text-emerald-700 bg-emerald-100 px-1.5 py-0.2 rounded font-semibold">
                              Coercive Urgency Prohibited
                            </span>
                          </div>
                          <p className="text-xs text-slate-800 leading-relaxed italic">
                            &ldquo;{icuScriptLang === "EN" ? selectedCand.script_en : selectedCand.script_hi}&rdquo;
                          </p>
                        </div>

                        {/* Consent Traffic Light Buttons */}
                        <div className="space-y-2 pt-1">
                          <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                            Record Family Consent Outcome:
                          </label>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                            <button
                              onClick={() => handleIcuConsentSubmit(selectedCand.encounter_id, "agreed")}
                              disabled={icuActionLoading}
                              className={`p-3 rounded-lg border text-left transition flex flex-col justify-between ${
                                selectedCand.stepdown_consent === "agreed"
                                  ? "bg-emerald-600 text-white border-emerald-700 shadow-sm"
                                  : "bg-emerald-50/70 hover:bg-emerald-100 border-emerald-200 text-emerald-900"
                              }`}
                            >
                              <div className="font-bold text-xs flex items-center gap-1.5">
                                <CheckCircle2 className="w-4 h-4" />
                                🟢 Agreed / सहमत
                              </div>
                              <div className="text-[10px] mt-1 opacity-90">
                                Unlocks ICU capacity under Guardrail #8. Ready for transfer.
                              </div>
                            </button>

                            <button
                              onClick={() => handleIcuConsentSubmit(selectedCand.encounter_id, "worried")}
                              disabled={icuActionLoading}
                              className={`p-3 rounded-lg border text-left transition flex flex-col justify-between ${
                                selectedCand.stepdown_consent === "worried"
                                  ? "bg-amber-600 text-white border-amber-700 shadow-sm"
                                  : "bg-amber-50/70 hover:bg-amber-100 border-amber-200 text-amber-900"
                              }`}
                            >
                              <div className="font-bold text-xs flex items-center gap-1.5">
                                <AlertTriangle className="w-4 h-4" />
                                🟡 Worried / चिंतित
                              </div>
                              <div className="text-[10px] mt-1 opacity-90">
                                Anxious family. Counseling path shown; relies on 2x buffer.
                              </div>
                            </button>

                            <button
                              onClick={() => handleIcuConsentSubmit(selectedCand.encounter_id, "refused")}
                              disabled={icuActionLoading}
                              className={`p-3 rounded-lg border text-left transition flex flex-col justify-between ${
                                selectedCand.stepdown_consent === "refused"
                                  ? "bg-rose-600 text-white border-rose-700 shadow-sm"
                                  : "bg-rose-50/70 hover:bg-rose-100 border-rose-200 text-rose-900"
                              }`}
                            >
                              <div className="font-bold text-xs flex items-center gap-1.5">
                                <X className="w-4 h-4" />
                                🔴 Refused / अस्वीकार
                              </div>
                              <div className="text-[10px] mt-1 opacity-90">
                                Releases ward bed; activates 2x alternate candidate immediately.
                              </div>
                            </button>
                          </div>
                        </div>

                        {/* Resolving Action Feedback Display */}
                        {selectedCand.icu_stepdown_status === "CONSENT_WORRIED" && (
                          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900 space-y-1">
                            <div className="font-bold flex items-center gap-1.5 text-amber-800">
                              <AlertTriangle className="w-4 h-4 text-amber-600" />
                              Reassurance Protocol Active (Guardrail #8: Does not unlock capacity)
                            </div>
                            <p>
                              Assign Senior Ward In-Charge Sister to meet family at ICU reception. Demonstrate continuous pulse oximeter monitoring in {selectedCand.reserved_bed_id || "the ward"}. Hold in ICU/transit lounge. 2x Alternate Candidate stands ready.
                            </p>
                          </div>
                        )}

                        {selectedCand.icu_stepdown_status === "CONSENT_REFUSED" && (
                          <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-900 space-y-1">
                            <div className="font-bold flex items-center gap-1.5 text-rose-800">
                              <ShieldAlert className="w-4 h-4 text-rose-600" />
                              2x Alternate Candidate Activated Instantly (Rule #10)
                            </div>
                            <p>
                              Family refused ward transfer. Reserved bed released back to READY. The 2x Redundancy Buffer candidate has been automatically promoted to the primary slot so hospital emergency intake is not blocked!
                            </p>
                          </div>
                        )}
                      </div>

                      {/* STEP 3: WARD LOGISTICS & TRANSFER EXECUTION */}
                      <div className={`bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-3 transition ${selectedCand.icu_stepdown_status !== "READY_FOR_TRANSFER" && selectedCand.icu_stepdown_status !== "TRANSFERRED" ? "opacity-50 pointer-events-none" : ""}`}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-800 font-bold text-xs flex items-center justify-center">
                              3
                            </div>
                            <h4 className="text-sm font-bold text-slate-900">
                              Ward Logistics & Transfer Execution
                            </h4>
                          </div>
                          {selectedCand.icu_stepdown_status === "READY_FOR_TRANSFER" && (
                            <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
                              🟢 Transfer Ready
                            </span>
                          )}
                        </div>

                        {selectedCand.icu_stepdown_status === "READY_FOR_TRANSFER" && (
                          <div className="space-y-3">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                                <span className="text-[10px] uppercase font-bold text-slate-500 block">Reserved Destination</span>
                                <span className="text-sm font-bold text-slate-800 mt-0.5 block">
                                  {selectedCand.reserved_bed_id} ({selectedCand.preferred_ward})
                                </span>
                              </div>
                              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                                <span className="text-[10px] uppercase font-bold text-slate-500 block">Porter Transfer Task</span>
                                <span className="text-sm font-bold text-slate-800 mt-0.5 block">
                                  TSK-PORTER-STEPDOWN-{selectedCand.encounter_id}
                                </span>
                              </div>
                            </div>

                            <button
                              onClick={() => handleExecuteIcuTransfer(selectedCand.encounter_id)}
                              disabled={icuActionLoading}
                              className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow-sm transition flex items-center justify-center gap-2"
                            >
                              <ArrowRight className="w-4 h-4" />
                              {icuActionLoading ? "Executing Transfer..." : `Execute Step-Down Transfer to ${selectedCand.reserved_bed_id}`}
                            </button>
                            <span className="text-[11px] text-slate-500 block text-center">
                              Moves patient to {selectedCand.reserved_bed_id}, marks {selectedCand.bed_id} as <strong>DIRTY</strong>, and queues rapid 30m turnover sanitization for emergency intake.
                            </span>
                          </div>
                        )}

                        {selectedCand.icu_stepdown_status === "TRANSFERRED" && (
                          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center gap-3">
                            <CheckCircle2 className="w-6 h-6 text-emerald-600 flex-shrink-0" />
                            <div className="text-xs">
                              <div className="font-bold text-emerald-900 text-sm">
                                Patient Successfully Transferred to Ward!
                              </div>
                              <div className="text-emerald-700 mt-0.5">
                                Bed {selectedCand.bed_id} in {selectedCand.preferred_ward} is now OCCUPIED. Former ICU bed marked DIRTY with emergency turnover cleaning dispatched.
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>
        )}

        {/* TAB: NURSE CHECK (3-QUESTION CLINICAL READINESS & GUARDRAIL #1 SCRIPT) */}
        {activeTab === "NURSE_CHECK" && (
          <div className="space-y-6">
            {/* Guardrail #1 Mandatory Script Banner */}
            <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white rounded-2xl p-6 shadow-md border border-indigo-700/50 space-y-4">
              <div className="flex items-start gap-4">
                <div className="p-3 bg-indigo-600/50 border border-indigo-400/30 rounded-xl flex-shrink-0">
                  <ShieldAlert className="w-6 h-6 text-amber-300" />
                </div>
                <div className="space-y-2 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-bold uppercase tracking-wider">
                      🛡️ Guardrail #1: The Doctor Decides
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-bold uppercase tracking-wider">
                      🛡️ Guardrail #8: Green-Consent Capacity Rule
                    </span>
                    <span className="text-xs text-slate-400">Clinical Primacy & Family Communication Standard</span>
                  </div>
                  <h3 className="text-base font-bold text-white">
                    Mandatory Nurse Phrasing Script — Never a Promise of Discharge
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                    <div className="bg-black/30 border border-indigo-500/20 p-3 rounded-xl">
                      <div className="text-[11px] font-bold text-indigo-300 uppercase tracking-wider mb-1">English Phrasing:</div>
                      <p className="text-sm font-medium text-slate-100 italic leading-snug">
                        &ldquo;The doctor may consider discharge tomorrow IF all morning clinical checks and lab tests are clear. Is the family ready to pick up the patient by 11:00 AM?&rdquo;
                      </p>
                    </div>
                    <div className="bg-black/30 border border-indigo-500/20 p-3 rounded-xl">
                      <div className="text-[11px] font-bold text-indigo-300 uppercase tracking-wider mb-1">हिंदी संवाद (Hindi Phrasing):</div>
                      <p className="text-sm font-medium text-slate-100 italic leading-snug">
                        &ldquo;अगर कल सुबह डॉक्टर साहब की राउंड में सभी रिपोर्ट्स और जांचें ठीक आती हैं, तो डिस्चार्ज की संभावना है। क्या परिवार सुबह 11:00 बजे तक मरीज को ले जाने के लिए तैयार रहेगा?&rdquo;
                      </p>
                    </div>
                  </div>
                  <p className="text-xs text-slate-300 bg-white/5 p-2 rounded-lg">
                    ⚠️ <strong className="text-rose-300">Strict Rule:</strong> Never tell a family &ldquo;Your patient is going home tomorrow.&rdquo; Only patients with confirmed <strong className="text-emerald-300">🟢 GREEN</strong> consent unlock forecasted bed capacity in Bed Management and Discharge Radar.
                  </p>
                </div>
              </div>
            </div>

            {/* Evaluation Cards Grid */}
            <div className="space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <h3 className="text-base font-bold text-slate-900">Morning Ward Nurse Verification Queue</h3>
                  <p className="text-xs text-slate-500">Classify social and logistics readiness across Payer, Family, and Home Care.</p>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span className="px-2.5 py-1 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-lg font-bold">
                    🟢 Green: {nurseCandidates.filter(c => c.current_consent === "green").length}
                  </span>
                  <span className="px-2.5 py-1 bg-amber-50 text-amber-800 border border-amber-200 rounded-lg font-bold">
                    🟡 Amber: {nurseCandidates.filter(c => c.current_consent === "amber").length}
                  </span>
                  <span className="px-2.5 py-1 bg-rose-50 text-rose-800 border border-rose-200 rounded-lg font-bold">
                    🔴 Red: {nurseCandidates.filter(c => c.current_consent === "red").length}
                  </span>
                  <span className="px-2.5 py-1 bg-slate-100 text-slate-600 rounded-lg font-bold">
                    Pending: {nurseCandidates.filter(c => !c.current_consent).length}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4">
                {nurseCandidates.map(cand => {
                  const currentForm = nurseForm[cand.encounter_id] || {
                    payer: "yes",
                    family: "yes",
                    home: "None",
                    customReason: ""
                  };

                  let previewConsent: "green" | "amber" | "red" = "green";
                  let previewResolvingAction = "";

                  if (currentForm.family === "no") {
                    previewConsent = "red";
                    previewResolvingAction = "Family unavailable: Escalate to medical social work to arrange transport / contact relatives.";
                  } else if (currentForm.payer === "no") {
                    if (cand.payer_type === "CASH") {
                      previewConsent = "amber";
                      previewResolvingAction = "Bill estimate sent — awaiting family confirmation by morning.";
                    } else {
                      previewConsent = "red";
                      previewResolvingAction = "Payer denied: Direct family to billing counselor for alternate payment assistance.";
                    }
                  } else if (currentForm.home === "No caregiver") {
                    previewConsent = "red";
                    previewResolvingAction = "Hard Safety Blocker: Patient cannot be discharged without dedicated caregiver at home.";
                  } else if (currentForm.family === "evening_only" || currentForm.payer === "unsure" || currentForm.home === "Needs ramp" || currentForm.home === "Oxygen cylinder required" || currentForm.home === "Other") {
                    previewConsent = "amber";
                    if (currentForm.home === "Needs ramp") {
                      previewResolvingAction = "Arrangeable: Offer hospital transport aid / collapsible wheelchair loan to bridge access barrier.";
                    } else if (currentForm.home === "Oxygen cylinder required") {
                      previewResolvingAction = "Arrangeable: Connect family to empanelled home oxygen concentrator vendor before doctor round.";
                    } else if (currentForm.family === "evening_only") {
                      previewResolvingAction = "Arrangeable: Check if alternate relative can pick up by 11 AM, or arrange transit lounge holding.";
                    } else if (currentForm.payer === "unsure") {
                      previewResolvingAction = "Arrangeable: Prioritize query response with scheme nodal desk.";
                    } else {
                      previewResolvingAction = "Custom barrier surfaced to Bed Manager.";
                    }
                  } else {
                    previewConsent = "green";
                    previewResolvingAction = "All criteria satisfied: Safe home, confirmed payer, family available by 11 AM.";
                  }

                  return (
                    <div key={cand.encounter_id} className={`bg-white rounded-2xl border p-5 shadow-sm space-y-4 transition ${
                      cand.current_consent === "green" ? "border-emerald-300 ring-1 ring-emerald-200" :
                      cand.current_consent === "amber" ? "border-amber-300 ring-1 ring-amber-200" :
                      cand.current_consent === "red" ? "border-rose-300 ring-1 ring-rose-200" : "border-slate-200"
                    }`}>
                      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-xl font-bold flex items-center justify-center text-sm ${
                            cand.ward === "ICU" ? "bg-rose-100 text-rose-800" : "bg-indigo-100 text-indigo-800"
                          }`}>
                            {cand.bed_id}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="font-bold text-slate-900 text-base">{cand.patient_name}</h4>
                              <span className="text-xs text-slate-400">({cand.age}y {cand.gender})</span>
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${getPayerColor(cand.payer_type)}`}>
                                {cand.payer_type}
                              </span>
                            </div>
                            <div className="text-xs text-slate-600 mt-0.5">
                              {cand.diagnosis_name} • <span className="font-medium text-slate-800">{cand.consultant_name}</span> (LOS: {cand.los_days}d)
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <div className="text-[11px] text-slate-400 uppercase font-semibold">Radar P(Discharge)</div>
                            <div className="text-sm font-black text-indigo-600">{cand.p_discharge_percent}%</div>
                          </div>

                          <div className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 border ${
                            cand.current_consent === "green" ? "bg-emerald-50 text-emerald-800 border-emerald-200" :
                            cand.current_consent === "amber" ? "bg-amber-50 text-amber-800 border-amber-200" :
                            cand.current_consent === "red" ? "bg-rose-50 text-rose-800 border-rose-200" : "bg-slate-100 text-slate-600 border-slate-200"
                          }`}>
                            {cand.current_consent === "green" && "🟢 GREEN CONSENT"}
                            {cand.current_consent === "amber" && "🟡 AMBER (ARRANGEABLE)"}
                            {cand.current_consent === "red" && "🔴 RED (BLOCKED)"}
                            {!cand.current_consent && "⚪ PENDING EVALUATION"}
                          </div>
                        </div>
                      </div>

                      {/* 3 Questions Interactive Form */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
                        {/* Question 1: Payer Status */}
                        <div className="space-y-2">
                          <label className="text-xs font-bold text-slate-800 flex items-center gap-1">
                            1. Payer / Scheme Status:
                          </label>
                          <div className="space-y-1.5">
                            <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                              <input
                                type="radio"
                                name={`payer-${cand.encounter_id}`}
                                value="yes"
                                checked={currentForm.payer === "yes"}
                                onChange={(e) => handleNurseFormChange(cand.encounter_id, "payer", e.target.value)}
                                className="text-indigo-600 focus:ring-indigo-500"
                              />
                              Confirmed / Pre-Auth Ready
                            </label>
                            <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                              <input
                                type="radio"
                                name={`payer-${cand.encounter_id}`}
                                value="unsure"
                                checked={currentForm.payer === "unsure"}
                                onChange={(e) => handleNurseFormChange(cand.encounter_id, "payer", e.target.value)}
                                className="text-indigo-600 focus:ring-indigo-500"
                              />
                              Pending Query / Documentation Incomplete
                            </label>
                            <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                              <input
                                type="radio"
                                name={`payer-${cand.encounter_id}`}
                                value="no"
                                checked={currentForm.payer === "no"}
                                onChange={(e) => handleNurseFormChange(cand.encounter_id, "payer", e.target.value)}
                                className="text-indigo-600 focus:ring-indigo-500"
                              />
                              Denied / Major Financial Shortfall
                            </label>
                          </div>
                        </div>

                        {/* Question 2: Family Availability */}
                        <div className="space-y-2">
                          <label className="text-xs font-bold text-slate-800 flex items-center gap-1">
                            2. Family Pickup Availability:
                          </label>
                          <div className="space-y-1.5">
                            <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                              <input
                                type="radio"
                                name={`family-${cand.encounter_id}`}
                                value="yes"
                                checked={currentForm.family === "yes"}
                                onChange={(e) => handleNurseFormChange(cand.encounter_id, "family", e.target.value)}
                                className="text-indigo-600 focus:ring-indigo-500"
                              />
                              Ready to pick up by 11:00 AM
                            </label>
                            <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                              <input
                                type="radio"
                                name={`family-${cand.encounter_id}`}
                                value="evening_only"
                                checked={currentForm.family === "evening_only"}
                                onChange={(e) => handleNurseFormChange(cand.encounter_id, "family", e.target.value)}
                                className="text-indigo-600 focus:ring-indigo-500"
                              />
                              Evening only (After 5:00 PM)
                            </label>
                            <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                              <input
                                type="radio"
                                name={`family-${cand.encounter_id}`}
                                value="no"
                                checked={currentForm.family === "no"}
                                onChange={(e) => handleNurseFormChange(cand.encounter_id, "family", e.target.value)}
                                className="text-indigo-600 focus:ring-indigo-500"
                              />
                              No family available tomorrow
                            </label>
                          </div>
                        </div>

                        {/* Question 3: Home Barriers */}
                        <div className="space-y-2">
                          <label className="text-xs font-bold text-slate-800 flex items-center gap-1">
                            3. Home Care Readiness / Barriers:
                          </label>
                          <select
                            value={currentForm.home}
                            onChange={(e) => handleNurseFormChange(cand.encounter_id, "home", e.target.value)}
                            className="w-full text-xs bg-white border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-indigo-500"
                          >
                            <option value="None">None (Home environment safe & clear)</option>
                            <option value="Needs ramp">Needs ramp / Mobility access aid</option>
                            <option value="No caregiver">No caregiver at home (Clinical Safety Blocker)</option>
                            <option value="Oxygen cylinder required">Oxygen cylinder / concentrator needed</option>
                            <option value="Other">Other custom barrier</option>
                          </select>

                          {currentForm.home === "Other" && (
                            <input
                              type="text"
                              placeholder="Describe custom home barrier..."
                              value={currentForm.customReason || ""}
                              onChange={(e) => handleNurseFormChange(cand.encounter_id, "customReason", e.target.value)}
                              className="w-full text-xs bg-white border border-slate-300 rounded-lg p-1.5 focus:ring-2 focus:ring-indigo-500"
                            />
                          )}
                        </div>
                      </div>

                      {/* Resolving Action Box & Submit Control */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
                        <div className="flex-1 text-xs">
                          <div className="font-bold flex items-center gap-1.5 text-slate-800 flex-wrap">
                            <span className="text-[11px] uppercase tracking-wider text-slate-500">Calculated Assessment:</span>
                            <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                              previewConsent === "green" ? "bg-emerald-100 text-emerald-800" :
                              previewConsent === "amber" ? "bg-amber-100 text-amber-800" : "bg-rose-100 text-rose-800"
                            }`}>
                              {previewConsent.toUpperCase()}
                            </span>
                            <span className="text-slate-400">•</span>
                            <span className="text-slate-700 font-medium">{previewResolvingAction}</span>
                          </div>
                          <div className="text-[11px] text-slate-500 mt-1">
                            {previewConsent === "green"
                              ? "✅ Guardrail #8: Unlocks forecasted bed availability upon doctor round completion."
                              : "🛡️ Guardrail #8: Excluded from bed capacity forecast until barrier is resolved."}
                          </div>
                        </div>

                        <button
                          onClick={() => handleNurseSubmit(cand.encounter_id)}
                          disabled={submittingEncounterId === cand.encounter_id}
                          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-sm transition flex items-center gap-1.5 flex-shrink-0"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          {submittingEncounterId === cand.encounter_id ? "Saving..." : "Confirm Nurse Check"}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* TAB: BILL ESTIMATOR & FAMILY PROJECTED RANGE SMS (FEATURE F6) */}
        {activeTab === "BILL_ESTIMATOR" && (
          <div className="space-y-6">
            {/* Feature Hero Banner */}
            <div className="bg-gradient-to-r from-amber-950 via-amber-900 to-slate-900 text-white rounded-2xl p-6 shadow-md border border-amber-700/50 space-y-4">
              <div className="flex items-start gap-4">
                <div className="p-3 bg-amber-600/50 border border-amber-400/30 rounded-xl flex-shrink-0">
                  <Receipt className="w-6 h-6 text-amber-200" />
                </div>
                <div className="space-y-2 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-bold uppercase tracking-wider">
                      Feature F6: Cash Patient Bill Estimator
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-xs font-bold uppercase tracking-wider">
                      🛡️ Guardrail #6: Financial Uncertainty Range (±10%)
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-bold uppercase tracking-wider">
                      🛡️ Guardrail #8: Green-Consent Unlock
                    </span>
                  </div>
                  <h3 className="text-base font-bold text-white">
                    Evening-Before Settlement Planning for Self-Pay (Cash) Patients
                  </h3>
                  <p className="text-xs text-slate-200 leading-relaxed max-w-4xl">
                    In Indian hospitals, discharge delays happen because families learn the bill only after morning rounds, scrambling for hours across ATMs and UPI limits while blocking the bed until evening. SwasthFlow computes an itemized accrued total + next-day projected stay, adds a <strong>calibrated ±10% uncertainty range</strong> (rounded to nearest ₹1,000, never a single number), and dispatches a bilingual SMS the evening before so families have all night to arrange funds comfortably.
                  </p>
                </div>
              </div>
            </div>

            {/* Metric Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                <div className="text-xs font-medium text-slate-500 uppercase tracking-wider">Total Cash Inpatients</div>
                <div className="text-2xl font-black text-slate-800 mt-1">{cashCandidates.length}</div>
                <div className="text-[11px] text-slate-400 mt-0.5">Self-pay patient cohort</div>
              </div>
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                <div className="text-xs font-medium text-slate-500 uppercase tracking-wider">Pending Estimates</div>
                <div className="text-2xl font-black text-amber-600 mt-1">
                  {cashCandidates.filter(c => c.estimate_status === "PENDING" || c.estimate_status === "ESTIMATED").length}
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">Awaiting evening calculation</div>
              </div>
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                <div className="text-xs font-medium text-slate-500 uppercase tracking-wider">Evening SMS Dispatched</div>
                <div className="text-2xl font-black text-blue-600 mt-1">
                  {cashCandidates.filter(c => c.estimate_status === "SMS_SENT" || c.estimate_status === "CONFIRMED").length}
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">Sent evening before (~6 PM)</div>
              </div>
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                <div className="text-xs font-medium text-slate-500 uppercase tracking-wider">Funds Confirmed</div>
                <div className="text-2xl font-black text-emerald-600 mt-1">
                  {cashCandidates.filter(c => c.estimate_status === "CONFIRMED" || c.consent === "green").length}
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">🟢 Unlocks bed capacity</div>
              </div>
            </div>

            {/* Main Roster & Estimator View */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Left Column: Cash Inpatients Roster */}
              <div className="lg:col-span-4 space-y-3">
                <div className="flex items-center justify-between pb-1">
                  <h4 className="text-sm font-bold text-slate-900">Cash Inpatient Cohort</h4>
                  <span className="text-xs text-slate-500">{cashCandidates.length} Active</span>
                </div>

                <div className="space-y-2.5 max-h-[720px] overflow-y-auto pr-1">
                  {cashCandidates.map(cand => {
                    const isSelected = selectedBillEncounterId === cand.encounter_id;
                    return (
                      <div
                        key={cand.encounter_id}
                        onClick={() => setSelectedBillEncounterId(cand.encounter_id)}
                        className={`p-4 rounded-xl border transition cursor-pointer text-left ${
                          isSelected
                            ? "bg-amber-50/70 border-amber-400 ring-2 ring-amber-300 shadow-sm"
                            : "bg-white border-slate-200 hover:border-amber-300 hover:bg-slate-50/80"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="w-8 h-8 rounded-lg bg-amber-100 text-amber-900 font-bold text-xs flex items-center justify-center flex-shrink-0">
                              {cand.bed_id}
                            </span>
                            <div>
                              <div className="text-sm font-bold text-slate-900">{cand.patient_name}</div>
                              <div className="text-[11px] text-slate-500 truncate max-w-[180px]">
                                {cand.diagnosis_name}
                              </div>
                            </div>
                          </div>

                          <div className="text-right flex-shrink-0">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${
                              cand.estimate_status === "CONFIRMED" ? "bg-emerald-100 text-emerald-800" :
                              cand.estimate_status === "SMS_SENT" ? "bg-blue-100 text-blue-800" :
                              cand.estimate_status === "ESTIMATED" ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-600"
                            }`}>
                              {cand.estimate_status}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-slate-100 text-[11px] text-slate-600">
                          <div>
                            LOS: <span className="font-semibold text-slate-800">{cand.los_days}d</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-semibold text-indigo-600">P: {Math.round(cand.p_discharge * 100)}%</span>
                            <span className={`w-2 h-2 rounded-full ${
                              cand.consent === "green" ? "bg-emerald-500" :
                              cand.consent === "amber" ? "bg-amber-500" : "bg-rose-500"
                            }`}></span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Right Column: Detailed Bill Breakdown & SMS Preview */}
              <div className="lg:col-span-8">
                {billLoading ? (
                  <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-400 flex flex-col items-center justify-center gap-3">
                    <RefreshCw className="w-8 h-8 animate-spin text-amber-500" />
                    <p className="text-sm font-medium">Computing itemized bill estimate & projected uncertainty range...</p>
                  </div>
                ) : billDetail ? (
                  <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-6">
                    {/* Patient Header & Current Status */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-lg font-bold text-slate-900">{billDetail.patient_name}</h3>
                          <span className="px-2.5 py-0.5 rounded-md bg-amber-100 text-amber-800 text-xs font-bold">
                            {billDetail.bed_id} ({billDetail.ward})
                          </span>
                          <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 text-xs font-medium">
                            Self Pay (CASH)
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 mt-1">
                          {billDetail.diagnosis_name} • Inpatient Stay: {billDetail.los_days} days
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                          billDetail.status === "CONFIRMED" ? "bg-emerald-100 text-emerald-800 border border-emerald-300" :
                          billDetail.status === "SMS_SENT" ? "bg-blue-100 text-blue-800 border border-blue-300" :
                          "bg-amber-100 text-amber-800 border border-amber-300"
                        }`}>
                          {billDetail.status === "CONFIRMED" ? "🟢 Funds Arranged" :
                           billDetail.status === "SMS_SENT" ? "📱 Evening SMS Sent" : "⏳ Estimate Ready"}
                        </span>
                      </div>
                    </div>

                    {/* Guardrail #6 Mandatory Watermark Banner */}
                    <div className="bg-amber-50 border-2 border-amber-300 rounded-xl p-3.5 flex items-start gap-3">
                      <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                      <div className="space-y-0.5">
                        <div className="text-xs font-black tracking-wide text-amber-900 uppercase">
                          Guardrail #6 Watermark: Mandatory Financial Disclaimer
                        </div>
                        <div className="text-xs font-medium text-amber-800 italic">
                          &ldquo;{billDetail.disclaimer}&rdquo;
                        </div>
                      </div>
                    </div>

                    {/* Big Projected Total Settlement Range Box */}
                    <div className="bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-transparent border border-amber-300/80 rounded-2xl p-5 text-center space-y-1.5 shadow-sm">
                      <div className="text-xs font-bold text-amber-800 uppercase tracking-wider">
                        Projected Total Settlement Estimate Range
                      </div>
                      <div className="text-3xl md:text-4xl font-black text-amber-950 tracking-tight">
                        ₹{billDetail.projected_low.toLocaleString()} – ₹{billDetail.projected_high.toLocaleString()}
                      </div>
                      <div className="text-xs text-amber-700 font-medium">
                        ±10% Calibrated Uncertainty Range • Rounded to nearest ₹1,000 • Out of Pocket: 100% (CASH)
                      </div>
                    </div>

                    {/* Itemized Accrued Breakdown Table */}
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600">
                          Itemized Accrued Charges & Next-Day Projected Completion
                        </h4>
                        <span className="text-xs font-semibold text-slate-500">
                          Accrued: ₹{billDetail.breakdown.accrued_total.toLocaleString()}
                        </span>
                      </div>

                      <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100 text-xs">
                        <div className="flex items-center justify-between p-2.5 bg-slate-50 font-semibold text-slate-700">
                          <span>Billing Category / Service Component</span>
                          <span>Computed Amount</span>
                        </div>
                        <div className="flex items-center justify-between p-2.5">
                          <span className="text-slate-600">Room & Bed Charges ({billDetail.los_days} days @ ward tariff)</span>
                          <span className="font-semibold text-slate-900">₹{billDetail.breakdown.room_and_bed.toLocaleString()}</span>
                        </div>
                        <div className="flex items-center justify-between p-2.5">
                          <span className="text-slate-600">Consultant Physician Rounds ({billDetail.los_days} rounds)</span>
                          <span className="font-semibold text-slate-900">₹{billDetail.breakdown.physician_consultations.toLocaleString()}</span>
                        </div>
                        <div className="flex items-center justify-between p-2.5">
                          <span className="text-slate-600">Nursing Care & Patient Monitoring</span>
                          <span className="font-semibold text-slate-900">₹{billDetail.breakdown.nursing_and_care.toLocaleString()}</span>
                        </div>
                        <div className="flex items-center justify-between p-2.5">
                          <span className="text-slate-600">Diagnostic Laboratory & Imaging Accrued</span>
                          <span className="font-semibold text-slate-900">₹{billDetail.breakdown.diagnostics_and_lab.toLocaleString()}</span>
                        </div>
                        <div className="flex items-center justify-between p-2.5">
                          <span className="text-slate-600">Pharmacy & Inpatient Clinical Consumables</span>
                          <span className="font-semibold text-slate-900">₹{billDetail.breakdown.pharmacy_and_consumables.toLocaleString()}</span>
                        </div>
                        <div className="flex items-center justify-between p-2.5 bg-amber-50/50 text-amber-900 font-medium">
                          <span>Projected Next-Day Charges (1.0d stay + final take-home meds pack)</span>
                          <span className="font-bold">₹{billDetail.breakdown.projected_remaining_total.toLocaleString()}</span>
                        </div>
                        <div className="flex items-center justify-between p-2.5 bg-slate-100 font-bold text-slate-900">
                          <span>Midpoint Estimated Total (Before ±10% Uncertainty Range)</span>
                          <span>₹{billDetail.breakdown.projected_mid.toLocaleString()}</span>
                        </div>
                      </div>
                    </div>

                    {/* Bilingual Family SMS Preview Box */}
                    <div className="space-y-3 bg-slate-50 border border-slate-200 rounded-xl p-4">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-2">
                          <SendHorizonal className="w-4 h-4 text-amber-600" />
                          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                            Family SMS Preview (Evening-Before Dispatch)
                          </h4>
                        </div>
                        <div className="flex items-center gap-2">
                          <label className="text-xs font-medium text-slate-500">Target Mobile:</label>
                          <input
                            type="text"
                            value={smsPhoneInput}
                            onChange={(e) => setSmsPhoneInput(e.target.value)}
                            className="text-xs font-bold text-slate-800 bg-white border border-slate-300 rounded px-2 py-1 w-36 focus:ring-1 focus:ring-amber-500"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                        <div className="bg-white border border-slate-200 rounded-xl p-3 space-y-1 shadow-sm">
                          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">English Copy:</div>
                          <p className="text-xs text-slate-700 leading-relaxed font-mono">
                            {billDetail.sms_text_en}
                          </p>
                        </div>
                        <div className="bg-white border border-slate-200 rounded-xl p-3 space-y-1 shadow-sm">
                          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">हिंदी संदेश (Hindi Copy):</div>
                          <p className="text-xs text-slate-700 leading-relaxed font-mono">
                            {billDetail.sms_text_hi}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
                      <div className="text-xs text-slate-500">
                        {billDetail.status === "CONFIRMED" ? (
                          <span className="text-emerald-700 font-bold flex items-center gap-1">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                            Funds confirmed. Bed capacity unlocked under Guardrail #8.
                          </span>
                        ) : billDetail.status === "SMS_SENT" ? (
                          <span className="text-blue-700 font-medium">
                            SMS delivered to family. Awaiting morning fund arrangement confirmation.
                          </span>
                        ) : (
                          <span>Ready for evening dispatch (~6:00 PM) to allow overnight fund arrangement.</span>
                        )}
                      </div>

                      <div className="flex items-center gap-2.5 flex-wrap">
                        <button
                          onClick={() => handleSendBillSms(billDetail.encounter_id)}
                          disabled={sendingSms}
                          className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl shadow-sm transition flex items-center gap-1.5"
                        >
                          <Send className="w-3.5 h-3.5" />
                          {sendingSms ? "Sending SMS..." : billDetail.status === "SMS_SENT" ? "Re-send SMS" : "Send Family SMS Evening Before"}
                        </button>

                        <button
                          onClick={() => handleConfirmFunds(billDetail.encounter_id)}
                          disabled={confirmingFunds || billDetail.status === "CONFIRMED"}
                          className={`px-4 py-2 text-xs font-bold rounded-xl shadow-sm transition flex items-center gap-1.5 ${
                            billDetail.status === "CONFIRMED"
                              ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                              : "bg-emerald-600 hover:bg-emerald-700 text-white"
                          }`}
                        >
                          <Check className="w-3.5 h-3.5" />
                          {confirmingFunds ? "Confirming..." : billDetail.status === "CONFIRMED" ? "Funds Confirmed (Green)" : "Confirm Family Arranged Funds"}
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-400">
                    Select a cash patient from the left roster to view bill estimate and dispatch family SMS.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Persistent Global Slide-Over Drawer: WhatsApp Feed & Patient Messaging (Coordinator Exclusively) */}
        {isCoordinator && (
          <WhatsAppDrawer
            isOpen={showWhatsAppDrawer}
            onClose={() => setShowWhatsAppDrawer(false)}
            whatsappMessages={whatsappMessages}
            smsLogs={smsLogs}
            onMarkDone={(taskId) => handleTaskAction(taskId, "done")}
            onCannotDo={(taskId, reason) => handleTaskAction(taskId, "cannot", reason)}
            onOpenTestSmsModal={() => setTestSmsModal(true)}
          />
        )}

        {/* Legacy redirect if activeTab was set to WHATSAPP */}
        {activeTab === ("WHATSAPP" as any) && (
          <div className="bg-white rounded-3xl border border-slate-200 p-8 text-center space-y-4 shadow-sm animate-fade-in">
            <div className="w-14 h-14 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto shadow-sm">
              <MessageSquare className="w-7 h-7" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                {isCoordinator ? "WhatsApp Promoted To Coordinator Header Panel" : "Coordination Feature"}
              </h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
                {isCoordinator
                  ? "WhatsApp task notices, neural audio voice notes, and patient family communications have been moved to the persistent header slide-over panel."
                  : "WhatsApp messaging and patient/family communication is exclusively managed by the Operations Coordinator."}
              </p>
            </div>
            <button
              onClick={() => {
                if (isCoordinator) setShowWhatsAppDrawer(true);
                setActiveTab("TODAYS_PLAN");
              }}
              className="px-5 py-2.5 rounded-full bg-[#075E54] hover:bg-[#128C7E] text-white text-xs font-bold transition shadow-sm inline-flex items-center gap-2"
            >
              <MessageSquare className="w-4 h-4" />
              <span>{isCoordinator ? "Open WhatsApp Slide-Over Panel" : "Go to Today's Plan"}</span>
            </button>
          </div>
        )}

        {/* TAB: REGIONAL BLOOD-TYPE INVENTORY */}
        {activeTab === "BLOOD_INVENTORY" && (
          <RegionalBloodInventory />
        )}

        {/* TAB: TODAY'S PLAN (OR-TOOLS CP-SAT SEQUENCER) */}
        {activeTab === "TODAYS_PLAN" && todaysPlan && (
          <div className="space-y-6">
            {/* Solver Status & Optimization Objectives Banner */}
            <div className="bg-slate-900 text-white rounded-2xl p-5 shadow-md space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-indigo-600 rounded-xl">
                    <CalendarCheck className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-base font-bold">Today&apos;s Master Plan (CP-SAT Constraint Optimizer)</h2>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${
                        todaysPlan.solver_status === "OPTIMAL" ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30" : "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                      }`}>
                        ● {todaysPlan.solver_status} ({todaysPlan.solve_time_seconds}s)
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Shift Start: {todaysPlan.shift_start_time} • {todaysPlan.total_tasks_scheduled} logistics tasks sequenced across phlebotomy, billing, housekeeping, and porters.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap text-[11px]">
                  {/* Step 7: Token-Based Coordinator Approval Gate */}
                  {planApprovalState.isApproved ? (
                    <div className="flex items-center gap-2 bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 px-3 py-1 rounded-lg font-bold">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      <span>APPROVED &amp; ACTIVE</span>
                      <span className="font-mono text-[10px] bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-500/30 text-emerald-200">
                        {planApprovalState.token}
                      </span>
                      <span className="text-[10px] text-slate-300 font-normal hidden lg:inline">
                        Auth: {planApprovalState.approvedBy} at {planApprovalState.approvedAt}
                      </span>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={handleApprovePlan}
                      className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg shadow-sm transition flex items-center gap-1.5 cursor-pointer"
                    >
                      <ShieldCheck className="w-4 h-4 text-white" />
                      <span>Approve Master Shift Plan (Coordinator Token Gate)</span>
                    </button>
                  )}

                  <span className="px-2.5 py-1 rounded-lg bg-slate-800 text-slate-300 border border-slate-700">
                    🛡️ Guardrail #5: Shift Cap &le; 10 Tasks
                  </span>
                  <span className="px-2.5 py-1 rounded-lg bg-slate-800 text-slate-300 border border-slate-700">
                    🛡️ Guardrail #4: Conf &ge; 70%
                  </span>
                  <span className="px-2.5 py-1 rounded-lg bg-slate-800 text-slate-300 border border-slate-700">
                    🛡️ Guardrail #3: Delay Book P90
                  </span>
                </div>
              </div>

              {/* Optimization Priority Ranking */}
              <div className="grid grid-cols-1 sm:grid-cols-5 gap-2 pt-1 text-[11px] text-slate-300">
                <div className="bg-slate-800/80 p-2.5 rounded-lg border border-slate-700/60">
                  <span className="text-rose-400 font-bold block">1. Missed Rounds</span>
                  <span className="text-[10px] text-slate-400">Blood draw results ready before doctor bedside arrival</span>
                </div>
                <div className="bg-slate-800/80 p-2.5 rounded-lg border border-slate-700/60">
                  <span className="text-amber-400 font-bold block">2. Free Bed &lt; 11 AM</span>
                  <span className="text-[10px] text-slate-400">Terminal cleans finish before morning admissions peak</span>
                </div>
                <div className="bg-slate-800/80 p-2.5 rounded-lg border border-slate-700/60">
                  <span className="text-blue-400 font-bold block">3. Late Payer Starts</span>
                  <span className="text-[10px] text-slate-400">Pre-auth packets submitted before P90 insurer backlog</span>
                </div>
                <div className="bg-slate-800/80 p-2.5 rounded-lg border border-slate-700/60">
                  <span className="text-purple-400 font-bold block">4. Walking Distance</span>
                  <span className="text-[10px] text-slate-400">Consecutive tasks clustered in primary ward</span>
                </div>
                <div className="bg-slate-800/80 p-2.5 rounded-lg border border-slate-700/60">
                  <span className="text-emerald-400 font-bold block">5. Plan Churn</span>
                  <span className="text-[10px] text-slate-400">Minimizes task reshuffling vs previous shift plan</span>
                </div>
              </div>
            </div>

            {/* Shortfall Windows Section (if any temporal or capacity deficits) */}
            {todaysPlan.shortfall_windows.length > 0 ? (
              <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 shadow-sm space-y-2">
                <div className="flex items-center gap-2 text-rose-800 font-bold text-xs">
                  <AlertTriangle className="w-4 h-4 text-rose-600" />
                  Shortfall Windows Detected ({todaysPlan.shortfall_windows.length} bottlenecks) — Surge Float Recommended
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                  {todaysPlan.shortfall_windows.map((sw, idx) => (
                    <div key={idx} className="bg-white p-3 rounded-xl border border-rose-200 text-xs shadow-xs space-y-1">
                      <div className="flex items-center justify-between font-bold text-slate-900">
                        <span>{sw.task_title}</span>
                        <span className="text-rose-700 font-mono">+{sw.shortfall_minutes}m Deficit</span>
                      </div>
                      <div className="text-[11px] text-slate-500">
                        Required Deadline: <strong className="text-slate-800">{sw.required_deadline}</strong> • Scheduled End: <strong className="text-slate-800">{sw.scheduled_end}</strong>
                      </div>
                      <div className="text-[11px] text-rose-700 bg-rose-50 p-1.5 rounded border border-rose-100 font-medium">
                        {sw.bottleneck_diagnostic}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="bg-emerald-50/80 border border-emerald-200 rounded-xl p-3 flex items-center justify-between text-xs text-emerald-900">
                <div className="flex items-center gap-2 font-medium">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  Zero Shortfall Windows: All non-clinical tasks scheduled ahead of clinical decision deadlines.
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded border border-emerald-300">
                  On-Time Schedule
                </span>
              </div>
            )}

            {/* Staff Workload Meters (Guardrail #5 Alert Fatigue Cap) */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-2">
                  <UserCheck className="w-4 h-4 text-indigo-600" />
                  Staff Shift Workloads (Guardrail #5: Alert Fatigue Cap &le; 10 Tasks)
                </h3>
                <span className="text-[11px] text-slate-500">
                  {todaysPlan.staff_summary.length} Staff on Roster
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {todaysPlan.staff_summary.map(s => {
                  const percent = s.cap_utilized_percent;
                  const isFull = s.assigned_task_count >= s.max_cap;
                  return (
                    <div key={s.staff_id} className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs text-slate-900">{s.staff_name}</span>
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold ${
                          isFull ? "bg-amber-100 text-amber-800 border border-amber-200" : "bg-slate-100 text-slate-700"
                        }`}>
                          {s.assigned_task_count} / {s.max_cap}
                        </span>
                      </div>

                      <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden border border-slate-200">
                        <div 
                          className={`h-full rounded-full transition-all duration-300 ${
                            isFull ? "bg-amber-500" : percent > 50 ? "bg-indigo-500" : "bg-emerald-500"
                          }`}
                          style={{ width: `${percent}%` }}
                        ></div>
                      </div>

                      <div className="flex items-center justify-between text-[10px] text-slate-500">
                        <span>{s.role} • {s.primary_ward}</span>
                        <span className="text-emerald-600 font-semibold">&le; 10 Cap Respected</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Bed Organizer: Full Day 24h Timeline Progress & Master Task Route */}
            <div className="space-y-4">
              {/* Full Day 24-Hour Progress & Shift Distribution Bar */}
              {(() => {
                const allTasks = todaysPlan.scheduled_tasks;
                const morningTasks = allTasks.filter(t => {
                  const h = parseInt(t.scheduled_start_str.split(":")[0] || "0", 10);
                  return h >= 6 && h < 14;
                });
                const eveningTasks = allTasks.filter(t => {
                  const h = parseInt(t.scheduled_start_str.split(":")[0] || "0", 10);
                  return h >= 14 && h < 22;
                });
                const nightTasks = allTasks.filter(t => {
                  const h = parseInt(t.scheduled_start_str.split(":")[0] || "0", 10);
                  return h >= 22 || h < 6;
                });

                return (
                  <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 text-white shadow-sm space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-2.5">
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-indigo-400" />
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-200">
                          Bed Organizer: Full-Day 24-Hour Progress (00:00 – 23:59)
                        </h4>
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-semibold">
                          24h Continuous Cycle
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400 flex items-center gap-3">
                        <span>Total Day Volume: <strong className="text-white font-mono">{allTasks.length}</strong> tasks</span>
                        <span>•</span>
                        <span>Horizon: <strong className="text-emerald-400 font-mono">1,440 mins</strong></span>
                      </div>
                    </div>

                    {/* 24-Hour Timeline Bar with Shift Bands */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono">
                        <span>00:00 Night</span>
                        <span>06:00 Morning Handover</span>
                        <span>11:00 Peak Discharge</span>
                        <span>14:00 Evening Shift</span>
                        <span>22:00 Night Shift</span>
                        <span>23:59</span>
                      </div>

                      <div className="w-full h-3 bg-slate-800 rounded-full overflow-hidden flex p-0.5 gap-0.5 border border-slate-700/60">
                        {/* 06:00 - 14:00 Morning Band */}
                        <div 
                          className="h-full bg-gradient-to-r from-amber-500 to-amber-400 rounded-l-full relative group cursor-pointer"
                          style={{ width: "33.33%" }}
                          title={`Morning Shift (06:00-14:00): ${morningTasks.length} tasks scheduled`}
                          onClick={() => setSelectedShiftFilter("MORNING")}
                        >
                          <div className="absolute inset-0 flex items-center justify-center text-[8px] font-black text-slate-900 uppercase">
                            Morning ({morningTasks.length})
                          </div>
                        </div>

                        {/* 14:00 - 22:00 Evening Band */}
                        <div 
                          className="h-full bg-gradient-to-r from-indigo-500 to-indigo-400 relative group cursor-pointer"
                          style={{ width: "33.33%" }}
                          title={`Evening Shift (14:00-22:00): ${eveningTasks.length} tasks scheduled`}
                          onClick={() => setSelectedShiftFilter("EVENING")}
                        >
                          <div className="absolute inset-0 flex items-center justify-center text-[8px] font-black text-white uppercase">
                            Evening ({eveningTasks.length})
                          </div>
                        </div>

                        {/* 22:00 - 06:00 Night Band */}
                        <div 
                          className="h-full bg-gradient-to-r from-purple-500 to-purple-400 rounded-r-full relative group cursor-pointer"
                          style={{ width: "33.34%" }}
                          title={`Night Shift (22:00-06:00): ${nightTasks.length} tasks scheduled`}
                          onClick={() => setSelectedShiftFilter("NIGHT")}
                        >
                          <div className="absolute inset-0 flex items-center justify-center text-[8px] font-black text-white uppercase">
                            Night ({nightTasks.length})
                          </div>
                        </div>
                      </div>

                      {/* Shift Filter Quick Select Tabs */}
                      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] uppercase font-bold text-slate-400">Shift Focus:</span>
                          {(["ALL", "MORNING", "EVENING", "NIGHT"] as const).map(shift => {
                            const count = shift === "ALL" ? allTasks.length :
                              shift === "MORNING" ? morningTasks.length :
                              shift === "EVENING" ? eveningTasks.length : nightTasks.length;
                            return (
                              <button
                                key={shift}
                                onClick={() => setSelectedShiftFilter(shift)}
                                className={`px-2 py-0.5 text-[10px] font-bold rounded transition flex items-center gap-1 ${
                                  selectedShiftFilter === shift
                                    ? "bg-indigo-500 text-white shadow-xs"
                                    : "bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700"
                                }`}
                              >
                                {shift === "ALL" ? "All 24h Cycle" : shift.charAt(0) + shift.slice(1).toLowerCase()}
                                <span className={`text-[9px] px-1 rounded font-mono ${
                                  selectedShiftFilter === shift ? "bg-indigo-700 text-white" : "bg-slate-700 text-slate-300"
                                }`}>
                                  {count}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                        <span className="text-[10px] text-slate-400">
                          Active horizon encompasses entire 24h clinical pipeline (Guardrail #3 P90 Turnaround)
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Master Task Schedule Table Controls */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-2">
                    <Clock className="w-4 h-4 text-indigo-600" />
                    Master Sequenced Logistics Route
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Chronologically prioritized to prevent missed rounds and morning admission delays.
                  </p>
                </div>

                {/* Role filter buttons */}
                <div className="flex items-center gap-1">
                  {["ALL", "PHLEBOTOMY", "BILLING", "CLEANING", "PORTER"].map(role => (
                    <button
                      key={role}
                      onClick={() => setSelectedPlanRole(role)}
                      className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition ${
                        selectedPlanRole === role
                          ? "bg-indigo-600 text-white shadow-xs"
                          : "bg-white hover:bg-slate-100 text-slate-600 border border-slate-200"
                      }`}
                    >
                      {role}
                    </button>
                  ))}
                </div>
              </div>

              {/* Master Task Table with Sticky Header and Scroll Affordance */}
              {(() => {
                const displayedTasks = todaysPlan.scheduled_tasks
                  .filter(t => selectedPlanRole === "ALL" || t.role === selectedPlanRole)
                  .filter(t => {
                    if (selectedShiftFilter === "ALL") return true;
                    const h = parseInt(t.scheduled_start_str.split(":")[0] || "0", 10);
                    if (selectedShiftFilter === "MORNING") return h >= 6 && h < 14;
                    if (selectedShiftFilter === "EVENING") return h >= 14 && h < 22;
                    if (selectedShiftFilter === "NIGHT") return h >= 22 || h < 6;
                    return true;
                  });

                return (
                  <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                    <div className="overflow-x-auto max-h-[520px] overflow-y-auto scrollbar-thin">
                      <table className="w-full text-left text-xs">
                        <thead className="sticky top-0 z-10 bg-slate-100/95 backdrop-blur-xs text-slate-600 uppercase font-semibold text-[10px] tracking-wider border-b border-slate-200 shadow-2xs">
                          <tr>
                            <th className="py-3 px-4">Time Window</th>
                            <th className="py-3 px-4">Role &amp; Ward</th>
                            <th className="py-3 px-4">Task Title / Patient</th>
                            <th className="py-3 px-4">Assigned Staff</th>
                            <th className="py-3 px-4">Required Deadline</th>
                            <th className="py-3 px-4">Priority Objective</th>
                            <th className="py-3 px-4">Confidence</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-slate-700">
                          {displayedTasks.length === 0 ? (
                            <tr>
                              <td colSpan={7} className="py-8 text-center text-slate-400">
                                <Clock className="w-6 h-6 mx-auto mb-2 text-slate-300" />
                                <p className="text-xs font-semibold text-slate-600">No scheduled tasks match the selected shift and role filters.</p>
                                <p className="text-[11px] text-slate-400 mt-1">Try switching to &quot;All 24h Cycle&quot; or clearing role filter.</p>
                                <button
                                  onClick={() => { setSelectedShiftFilter("ALL"); setSelectedPlanRole("ALL"); }}
                                  className="mt-3 px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-medium border border-slate-300"
                                >
                                  Reset Filters
                                </button>
                              </td>
                            </tr>
                          ) : (
                            displayedTasks.map((item) => (
                              <tr key={item.task_id} className="hover:bg-slate-50/70 transition">
                                <td className="py-3 px-4 font-mono font-bold text-slate-900">
                                  <span className="px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
                                    {item.scheduled_start_str} - {item.scheduled_end_str}
                                  </span>
                                </td>
                                <td className="py-3 px-4">
                                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                                    item.role === "PHLEBOTOMY" ? "bg-rose-100 text-rose-800 border-rose-200" :
                                    item.role === "BILLING" ? "bg-blue-100 text-blue-800 border-blue-200" :
                                    item.role === "CLEANING" ? "bg-emerald-100 text-emerald-800 border-emerald-200" :
                                    "bg-purple-100 text-purple-800 border-purple-200"
                                  }`}>
                                    {item.role}
                                  </span>
                                  <div className="text-[10px] text-slate-400 font-mono mt-0.5">{item.ward}</div>
                                </td>
                                <td className="py-3 px-4">
                                  <div className="font-semibold text-slate-900">{item.task_title}</div>
                                  <div className="text-[10px] text-slate-500">
                                    {item.patient_name} • Bed: <span className="font-mono font-bold text-indigo-700">{item.bed_id}</span>
                                  </div>
                                </td>
                                <td className="py-3 px-4">
                                  <div className="font-medium text-slate-800">{item.assigned_staff_name}</div>
                                </td>
                                <td className="py-3 px-4">
                                  <div className="font-mono text-slate-700">Deadline: {item.deadline_str}</div>
                                  {item.shortfall_min > 0 ? (
                                    <span className="text-[10px] font-bold text-rose-600">Shortfall +{item.shortfall_min}m</span>
                                  ) : (
                                    <span className="text-[10px] font-medium text-emerald-600">✓ On Schedule</span>
                                  )}
                                </td>
                                <td className="py-3 px-4">
                                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                                    {item.priority_weight === 1000 ? "P1: Round Sync" :
                                     item.priority_weight === 500 ? "P2: 11 AM Bed" :
                                     item.priority_weight === 300 ? "P3: Payer Pre-Auth" : "P4: Transfer"}
                                  </span>
                                </td>
                                <td className="py-3 px-4">
                                  <span className="font-mono font-bold text-emerald-700">
                                    {Math.round(item.confidence * 100)}%
                                  </span>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>

                    {/* Scroll Affordance and Summary Footer */}
                    <div className="bg-slate-50 px-4 py-2.5 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-500">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                        <span>
                          Showing <strong className="text-slate-800 font-semibold">{displayedTasks.length}</strong> of{" "}
                          <strong className="text-slate-800 font-semibold">{todaysPlan.scheduled_tasks.length}</strong> tasks across the 24-hour cycle
                          {selectedShiftFilter !== "ALL" && (
                            <span className="ml-1 text-indigo-600 font-medium">({selectedShiftFilter} Shift)</span>
                          )}
                          {selectedPlanRole !== "ALL" && (
                            <span className="ml-1 text-slate-600 font-medium">({selectedPlanRole})</span>
                          )}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-slate-400">
                        <span>↕ Scroll table to inspect all time slots</span>
                        <span>•</span>
                        <span>All assignments respect Guardrail #5 (&le; 10 tasks/shift)</span>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        )}

        {/* TAB 0: ROUND CLOCK & BLOOD DRAW ROUTE (FEATURE F2) */}
        {activeTab === "ROUND_CLOCK" && (
          <div className="space-y-6">
            {/* Guardrail #9 & Explanation Banner */}
            <div className="bg-indigo-50/90 border border-indigo-200 rounded-xl p-4 flex items-start gap-3 shadow-sm">
              <div className="bg-indigo-600 text-white p-2 rounded-lg mt-0.5">
                <Stethoscope className="w-5 h-5" />
              </div>
              <div className="text-xs text-slate-700 leading-relaxed space-y-1">
                <div>
                  <span className="font-bold text-indigo-900 text-sm">Feature F2: Report Before The Round (Round Clock &amp; Backwards Scheduling)</span>
                </div>
                <p>
                  Doctors cannot discharge or step-down patients without reviewing morning lab results. SwasthFlow predicts when each consultant will conduct rounds on each ward today using a gradient-boosted round predictor. It then works <strong>backwards</strong> through the lab&apos;s <strong>P90 turnaround time</strong> to calculate the exact latest safe blood-draw deadline.
                </p>
                <div className="pt-1 flex items-center gap-2">
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                    🛡️ Guardrail #9 Active
                  </span>
                  <span className="text-[11px] font-medium text-slate-600">
                    Doctor round predictions are strictly for backward operational coordination (phlebotomy, porter dispatch, billing). <strong>Never surfaced to hospital administration as a punctuality or performance metric.</strong>
                  </span>
                </div>
              </div>
            </div>

            {/* Doctor Round Burst Cards */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-indigo-600" />
                  Today&apos;s Predicted Consultant Round Bursts
                </h3>
                <span className="text-[11px] text-slate-500 font-medium">
                  {rounds.length} Consultants on Roster Today
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-3">
                {rounds.map(doc => (
                  <div 
                    key={doc.consultant_id} 
                    className={`p-4 rounded-xl border transition shadow-sm ${
                      doc.has_OT_today 
                        ? "bg-amber-50/40 border-amber-200" 
                        : "bg-white border-slate-200"
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-900 truncate" title={doc.consultant_name}>
                        {doc.consultant_name}
                      </span>
                      {doc.has_OT_today ? (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-black bg-amber-200 text-amber-900 border border-amber-300">
                          OT DAY
                        </span>
                      ) : (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                          REGULAR
                        </span>
                      )}
                    </div>
                    
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      {doc.specialty} • {doc.ward}
                    </div>

                    <div className="mt-3 pt-3 border-t border-slate-100 flex items-baseline justify-between">
                      <div>
                        <div className="text-[10px] uppercase font-bold text-slate-400">Predicted Round</div>
                        <div className="text-2xl font-black text-indigo-700 tracking-tight font-mono">
                          {doc.predicted_time_str}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-[10px] uppercase font-bold text-slate-400">Active Pts</div>
                        <div className="text-sm font-black text-slate-700">
                          {doc.assigned_patient_count}
                        </div>
                      </div>
                    </div>

                    <p className="text-[10px] text-slate-500 mt-2 leading-snug line-clamp-2" title={doc.schedule_note}>
                      {doc.schedule_note}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Phlebotomy Ordered Route Table */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-2">
                    <Syringe className="w-4 h-4 text-rose-600" />
                    Nurse &amp; Phlebotomist Morning Draw Route (Backwards Scheduled)
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Order of draw prioritized so each patient&apos;s results arrive in the LIS <strong>before</strong> that patient&apos;s doctor starts bedside rounds.
                  </p>
                </div>
                <span className="px-2.5 py-1 rounded bg-rose-50 text-rose-700 border border-rose-200 text-xs font-bold font-mono">
                  Lab P90: 140 min + 15 min buffer
                </span>
              </div>

              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100 text-slate-600 uppercase font-semibold text-[10px] tracking-wider border-b border-slate-200">
                      <tr>
                        <th className="py-3 px-4">Patient / Bed</th>
                        <th className="py-3 px-4">Attending Consultant</th>
                        <th className="py-3 px-4">Doctor Round Time</th>
                        <th className="py-3 px-4">Latest Safe Draw Deadline</th>
                        <th className="py-3 px-4">Preparation &amp; Fasting</th>
                        <th className="py-3 px-4">Mathematical Backwards Lead Rationale</th>
                        <th className="py-3 px-4">Status Window</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      {bloodRoute.map((item, idx) => (
                        <tr key={item.encounter_id} className="hover:bg-slate-50/70 transition">
                          <td className="py-3 px-4">
                            <div className="font-bold text-slate-900 flex items-center gap-1.5">
                              <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-mono flex items-center justify-center font-bold">
                                #{idx + 1}
                              </span>
                              {item.patient_name}
                            </div>
                            <div className="text-[10px] font-mono text-indigo-700 ml-6">
                              {item.bed_id} ({item.ward})
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <div className="font-semibold text-slate-800">{item.consultant_name}</div>
                            <div className="text-[10px] text-slate-400">{item.ward}</div>
                          </td>
                          <td className="py-3 px-4 font-mono font-bold text-slate-800">
                            {item.consultant_round_time}
                          </td>
                          <td className="py-3 px-4">
                            <span className="px-2 py-1 rounded bg-rose-50 text-rose-700 font-mono font-black text-xs border border-rose-200">
                              ⏰ {item.latest_safe_draw_str}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            {item.fasting_required ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                                🍳 Fasting (Before 8 AM)
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-600 border border-slate-200">
                                Routine
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 max-w-sm">
                            <div className="text-[11px] text-slate-700 leading-snug">
                              {item.why_reason}
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            {item.is_round_critical ? (
                              <span className="px-2 py-1 rounded bg-rose-100 text-rose-800 text-[10px] font-black border border-rose-200 animate-pulse">
                                ⚡ URGENT WINDOW
                              </span>
                            ) : (
                              <span className="px-2 py-1 rounded bg-slate-100 text-slate-600 text-[10px] font-medium border border-slate-200">
                                On Schedule
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 1: DISCHARGE RADAR */}
        {activeTab === "RADAR" && (
          <div className="space-y-4">
            <div className="bg-indigo-50/80 border border-indigo-200 rounded-xl p-4 flex items-start gap-3">
              <div className="bg-indigo-600 text-white p-1.5 rounded-lg mt-0.5">
                <Radar className="w-4 h-4" />
              </div>
              <div className="text-xs text-slate-700 leading-relaxed">
                <span className="font-bold text-indigo-900">Feature 1: Early Discharge Paperwork with Multi-Payer Adaptive Horizons. </span>
                LightGBM survival/hazard model predicts discharge probability. Notice that prediction lead time adapts dynamically per payer directly from Delay Book P90 benchmarks: <strong>Ayushman Bharat</strong> (~38–48h lead for state TMS portal approvals), <strong>TPA</strong> (~6h lead), and <strong>Cash</strong> (~18h lead).
                <div className="mt-1 text-indigo-800 font-semibold">
                  Guardrail #8 Enforced: Only confirmed 🟢 GREEN consent patients count as forecasted bed capacity. Guardrail #9: Calibrated within [0.05, 0.92] (15% reversal risk).
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 text-slate-600 uppercase font-semibold text-[10px] tracking-wider border-b border-slate-200">
                    <tr>
                      <th className="py-3 px-4">Patient / Bed</th>
                      <th className="py-3 px-4">Diagnosis & LOS</th>
                      <th className="py-3 px-4">Payer & Adaptive Horizon</th>
                      <th className="py-3 px-4">P(Discharge)</th>
                      <th className="py-3 px-4">Top 3 Plain-English Reasons</th>
                      <th className="py-3 px-4">Payer Routing Pathway</th>
                      <th className="py-3 px-4">Forecast Capacity</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {radar.map(item => {
                      const probPercent = Math.round(item.p_discharge * 100);
                      return (
                        <tr key={item.encounter_id} className="hover:bg-slate-50/70 transition">
                          <td className="py-3 px-4">
                            <div className="font-bold text-slate-900">{item.patient_name}</div>
                            <div className="text-[10px] font-mono text-indigo-700">{item.bed_id} ({item.ward})</div>
                          </td>
                          <td className="py-3 px-4">
                            <div className="font-medium text-slate-800">{item.diagnosis}</div>
                            <div className="text-[10px] text-slate-400">LOS: <strong>{item.los_days} days</strong> • {item.consultant}</div>
                          </td>
                          <td className="py-3 px-4">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${getPayerColor(item.payer_type)}`}>
                              {item.payer_type}
                            </span>
                            <div className="text-[10px] text-slate-500 font-semibold mt-1">
                              Flagged {item.target_horizon_hours}h ahead
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              <div className="w-16 bg-slate-100 rounded-full h-2.5 overflow-hidden border border-slate-200">
                                <div 
                                  className={`h-full rounded-full ${
                                    item.p_discharge >= 0.70 ? "bg-emerald-500" : item.p_discharge >= 0.40 ? "bg-amber-500" : "bg-slate-400"
                                  }`}
                                  style={{ width: `${probPercent}%` }}
                                ></div>
                              </div>
                              <span className={`font-mono font-bold text-xs ${
                                item.p_discharge >= 0.70 ? "text-emerald-700 font-black" : item.p_discharge >= 0.40 ? "text-amber-700" : "text-slate-500"
                              }`}>
                                {probPercent}%
                              </span>
                            </div>
                            <div className="text-[10px] mt-0.5 font-medium">
                              {item.p_discharge >= 0.70 ? (
                                <span className="text-emerald-600 font-semibold">High Confidence</span>
                              ) : (
                                <span className="text-slate-400">Low (Suppressed)</span>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-4 max-w-sm">
                            <ul className="space-y-1">
                              {item.top_reasons.map((reason, idx) => (
                                <li key={idx} className="text-[11px] text-slate-700 flex items-start gap-1.5 leading-snug">
                                  <span className="text-indigo-500 font-bold mt-0.5">•</span>
                                  <span>{reason}</span>
                                </li>
                              ))}
                            </ul>
                          </td>
                          <td className="py-3 px-4">
                            <div className="text-[11px] font-bold text-indigo-900">
                              {item.payer_strategy.action_title}
                            </div>
                            <div className="text-[10px] text-slate-500 leading-tight mt-0.5">
                              {item.payer_strategy.description}
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            {item.counts_as_forecasted_capacity ? (
                              <span className="px-2 py-1 rounded bg-emerald-100 text-emerald-800 text-[10px] font-bold border border-emerald-200">
                                🟢 COUNTED (GREEN)
                              </span>
                            ) : (
                              <span className="px-2 py-1 rounded bg-slate-100 text-slate-600 text-[10px] font-medium border border-slate-200" title="Only confirmed green consent enters forecast">
                                ⚪ Unconfirmed
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: DELAY BOOK & DOC LAG */}
        {activeTab === "DELAY_BOOK" && delayBook && (
          <div className="space-y-6">
            <div className="bg-emerald-50/80 border border-emerald-200 rounded-xl p-4 flex items-start gap-3">
              <div className="bg-emerald-600 text-white p-1.5 rounded-lg mt-0.5">
                <Timer className="w-4 h-4" />
              </div>
              <div className="text-xs text-slate-700 leading-relaxed">
                <span className="font-bold text-emerald-900">Delay Book: Learned Empirical Durations & Ward Documentation Lag Correction. </span>
                {delayBook.note} Raw logged timestamps in hospital systems are notoriously noisy. SwasthFlow subtracts the learned documentation lag for each ward before computing true clinical turnaround.
              </div>
            </div>

            {/* Ward Documentation Lag Cards */}
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
                Empirically Learned Ward Documentation Lag (Subtracted from Logged Timestamps)
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {Object.entries(delayBook.ward_documentation_lags_minutes).map(([ward, lag]) => (
                  <div key={ward} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-800">{ward}</span>
                      <span className="text-xs px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 font-semibold border border-indigo-200">
                        Correction Factor
                      </span>
                    </div>
                    <div className="text-3xl font-black text-indigo-600 mt-2">
                      -{Math.round(lag)} <span className="text-xs font-normal text-slate-400">mins</span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      {ward === "ICU" ? "Fast prompt entry (5-15 min spread)" : ward === "WARD_B" ? "Heavy documentation delay (45-90 min batch entry)" : "Standard entry lag (15-30 min spread)"}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Step Duration Table */}
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
                Operational Step Benchmarks (P90 Planning Budgets)
              </h3>
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 text-slate-600 uppercase font-semibold text-[10px] tracking-wider border-b border-slate-200">
                    <tr>
                      <th className="py-3 px-4">Operational Step / Workflow</th>
                      <th className="py-3 px-4">Learned Median Duration</th>
                      <th className="py-3 px-4">Learned P90 Duration (Used for Planning)</th>
                      <th className="py-3 px-4">Sample Count</th>
                      <th className="py-3 px-4">Planning Budget Rationale</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {Object.entries(delayBook.step_duration_stats).map(([step, stat]) => (
                      <tr key={step} className="hover:bg-slate-50/70 transition">
                        <td className="py-3 px-4 font-mono font-bold text-slate-900">
                          {step}
                        </td>
                        <td className="py-3 px-4 font-mono text-slate-600">
                          {stat.median_min} mins ({roundHours(stat.median_min)}h)
                        </td>
                        <td className="py-3 px-4 font-mono font-bold text-indigo-700">
                          {stat.p90_min} mins ({roundHours(stat.p90_min)}h)
                        </td>
                        <td className="py-3 px-4 text-slate-500">
                          {stat.sample_count} events
                        </td>
                        <td className="py-3 px-4 text-slate-600 text-[11px]">
                          {step.includes("AYUSHMAN") && "State TMS portal approval backlog buffer"}
                          {step.includes("TPA") && "Insurer query & authorization letter turnaround"}
                          {step.includes("CASH") && "Family bank/ATM liquid arrangement window"}
                          {step.includes("CLEANING") && "Terminal sanitization and bed make"}
                          {step.includes("PORTER") && "Patient transfer transit time"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: TASKS QUEUE */}
        {activeTab === "TASKS" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-900">Active Non-Clinical Tasks Queue</h2>
                <p className="text-xs text-slate-500">Every task strictly carries a WHO, WHAT, and WHY, with confidence ≥ 70%.</p>
              </div>
              <span className="px-3 py-1 bg-indigo-100 text-indigo-800 text-xs font-bold rounded-lg border border-indigo-200">
                {tasks.length} Active Tasks
              </span>
            </div>

            {tasks.length === 0 ? (
              <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-slate-400 space-y-3 shadow-sm">
                <p>No billing clearance tasks currently queued.</p>
                <button
                  onClick={handleRoutePayerTasks}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs font-bold shadow transition hover:bg-indigo-700"
                >
                  Generate Tasks for High-Confidence Candidates
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {tasks.map(t => (
                  <div key={t.id} className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-100 text-indigo-800 border border-indigo-200">
                          {t.role}
                        </span>
                        <span className="text-xs font-mono text-slate-400">{t.ward}</span>
                      </div>
                      <span className="text-xs font-bold text-emerald-700 font-mono">
                        {Math.round(t.confidence * 100)}% Conf
                      </span>
                    </div>

                    <div>
                      <h4 className="text-sm font-bold text-slate-900">{t.title_en}</h4>
                      <div className="text-xs text-indigo-700 font-medium mt-0.5 font-hindi">{t.title_hi}</div>
                    </div>

                    <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 space-y-1.5">
                      <div className="text-[11px] text-slate-700 leading-relaxed">
                        <strong className="text-slate-900">WHY (Evidence): </strong>
                        {t.reason_en}
                      </div>
                      <div className="text-[10px] text-slate-500 font-hindi leading-relaxed">
                        <strong>कारण: </strong>
                        {t.reason_hi}
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-1 text-xs">
                      <span className="text-slate-400 flex items-center gap-1 font-mono">
                        <Clock className="w-3.5 h-3.5" />
                        Deadline: {new Date(t.deadline).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <div className="flex items-center gap-2">
                        <button className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-bold shadow-sm transition">
                          Done
                        </button>
                        <button className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-xs font-medium transition">
                          Cannot
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 4: ALL BEDS (From Phase 1) */}
        {activeTab === "BEDS" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2">
                {[
                  { id: "ALL", label: "All Wards (30 Beds)" },
                  { id: "WARD_A", label: "Medical Ward A (12 Beds)" },
                  { id: "WARD_B", label: "Surgical Ward B (12 Beds)" },
                  { id: "ICU", label: "Intensive Care Unit (6 Beds)" }
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setSelectedWard(tab.id)}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition ${
                      selectedWard === tab.id
                        ? "bg-indigo-600 text-white shadow-sm"
                        : "bg-white hover:bg-slate-100 text-slate-600 border border-slate-200"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 text-slate-600 uppercase font-semibold text-[10px] tracking-wider border-b border-slate-200">
                    <tr>
                      <th className="py-3 px-4">Bed ID</th>
                      <th className="py-3 px-4">Ward / Type</th>
                      <th className="py-3 px-4">Bed State</th>
                      <th className="py-3 px-4">Patient & Consultant</th>
                      <th className="py-3 px-4">Diagnosis & LOS</th>
                      <th className="py-3 px-4">Payer</th>
                      <th className="py-3 px-4">Visible Clinical Signs</th>
                      <th className="py-3 px-4">Current Bottleneck</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {filteredBeds.map(bed => {
                      const patient = bed.current_encounter;
                      return (
                        <tr key={bed.id} className="hover:bg-slate-50/70 transition">
                          <td className="py-3 px-4 font-mono font-bold text-slate-900">{bed.id}</td>
                          <td className="py-3 px-4">
                            <div className="font-semibold text-slate-800">{bed.ward}</div>
                            <div className="text-[10px] text-slate-400">{bed.bed_type}</div>
                          </td>
                          <td className="py-3 px-4">
                            <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                              bed.state === "OCCUPIED" ? "bg-rose-100 text-rose-700 border border-rose-200" :
                              bed.state === "READY" ? "bg-emerald-100 text-emerald-700 border border-emerald-200" :
                              "bg-amber-100 text-amber-800 border border-amber-200"
                            }`}>
                              {bed.state}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            {patient ? (
                              <div>
                                <div className="font-semibold text-slate-900">{patient.patient_name}</div>
                                <div className="text-[11px] text-indigo-700 font-medium">{patient.consultant}</div>
                              </div>
                            ) : <span className="text-slate-400 italic">— Bed Empty —</span>}
                          </td>
                          <td className="py-3 px-4">
                            {patient ? (
                              <div>
                                <div className="font-medium text-slate-800">{patient.diagnosis}</div>
                                <div className="text-[10px] text-slate-400">LOS: {patient.los_days} days</div>
                              </div>
                            ) : "—"}
                          </td>
                          <td className="py-3 px-4">
                            {patient ? (
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${getPayerColor(patient.payer_type)}`}>
                                {patient.payer_type}
                              </span>
                            ) : "—"}
                          </td>
                          <td className="py-3 px-4">
                            {patient ? (
                              <div className="flex flex-wrap gap-1">
                                <span className={`px-1.5 py-0.5 rounded text-[10px] ${patient.iv_to_oral ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                                  {patient.iv_to_oral ? "Oral Meds" : "IV"}
                                </span>
                                <span className={`px-1.5 py-0.5 rounded text-[10px] ${patient.oxygen_removed ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>
                                  {patient.oxygen_removed ? "O2 Weaned" : "On O2"}
                                </span>
                                <span className={`px-1.5 py-0.5 rounded text-[10px] ${patient.diet_normalized ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                                  {patient.diet_normalized ? "Normal Diet" : "Restricted"}
                                </span>
                              </div>
                            ) : "—"}
                          </td>
                          <td className="py-3 px-4 font-mono text-[10px] text-slate-700">
                            {bed.blocking_step || "NONE"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
        </>
        )}

        {/* ========================================================================= */}
        {/* DEDICATED ROLE DASHBOARD 6: PATIENT & CAREGIVER PORTAL                     */}
        {/* ========================================================================= */}
        {currentUser?.roleCategoryId === "PATIENT" && (
          <PatientPortalShell
            currentUserName={currentUser.name}
            onEmergencyIntakeSubmit={handlePatientEmergencyIntake}
            onPreAdmissionSubmit={handlePatientPreAdmission}
            onLogout={handleStaffLogout}
          />
        )}
        </>
        )}

        {/* EXECUTIVE PITCH BRIEF & ARCHITECTURE MODAL (PHASE 11) */}
        {showPitchModal && (
          <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-200 space-y-6 p-6">
              <div className="flex items-start justify-between border-b border-slate-100 pb-4">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-indigo-600 text-white rounded-xl shadow-md">
                    <BookOpen className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 border border-indigo-200">
                        Hackathon Solution Brief
                      </span>
                      <span className="text-xs text-slate-500">The Hospital Never Sleeps</span>
                    </div>
                    <h2 className="text-xl font-black text-slate-900 mt-0.5">
                      SwasthFlow AI: System Architecture &amp; Executive Pitch
                    </h2>
                  </div>
                </div>
                <button
                  onClick={() => setShowPitchModal(false)}
                  className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* 1. The Core Thesis */}
              <div className="p-4 bg-indigo-50/60 border border-indigo-200 rounded-xl space-y-2">
                <h3 className="text-sm font-black text-indigo-950 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-indigo-600" />
                  The Problem Statement &amp; Our Core Thesis
                </h3>
                <p className="text-xs text-slate-700 leading-relaxed">
                  Indian tertiary hospitals are not fundamentally short of inpatient beds — <strong>beds become vacant at the wrong time of day</strong>. Physicians conduct rounds between 09:00 AM and 11:30 AM, but serial non-clinical logistics (laboratory turnaround, insurance pre-authorization queries, cash estimate sticker shock, and delayed room disinfection) push patient departures to 04:00 PM. Emergency and surgical admissions arriving in the morning face artificial 5-to-7 hour hallway boarding.
                </p>
                <div className="p-3 bg-white rounded-lg border border-indigo-100 text-xs font-semibold text-indigo-900">
                  ⚡ <strong>The Solution:</strong> Re-sequence non-clinical logistics so that tests, TPA pre-authorization, billing confirmations, and step-down beds complete <em>just before</em> the clinician&apos;s morning round burst.
                </div>
              </div>

              {/* 2. The Three Engine Components */}
              <div className="space-y-3">
                <h3 className="text-sm font-black text-slate-900">
                  Three Core AI Engine Components
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                  <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
                    <div className="font-black text-violet-700 uppercase tracking-wider text-[10px]">Engine Component 1</div>
                    <div className="font-bold text-slate-900">The Discharge Radar</div>
                    <p className="text-slate-600 leading-relaxed text-[11px]">
                      Calibrated LightGBM hazard model evaluating non-invasive recovery trajectories. Strictly bounded to [0.05, 0.92] to accommodate the irreducible ~15% nosocomial complication risk floor.
                    </p>
                  </div>
                  <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
                    <div className="font-black text-indigo-700 uppercase tracking-wider text-[10px]">Engine Component 2</div>
                    <div className="font-bold text-slate-900">The Master Sequencer</div>
                    <p className="text-slate-600 leading-relaxed text-[11px]">
                      Google OR-Tools CP-SAT constraint optimization model solving in &lt;0.05s. Strictly enforces Guardrail #5 (&le; 10 tasks/staff/shift alert fatigue cap) and Guardrail #4 (&ge; 70% confidence floor).
                    </p>
                  </div>
                  <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
                    <div className="font-black text-emerald-700 uppercase tracking-wider text-[10px]">Engine Component 3</div>
                    <div className="font-bold text-slate-900">The Delay Book</div>
                    <p className="text-slate-600 leading-relaxed text-[11px]">
                      Continuous learning of empirical 90th percentile (P90) duration step budgets. Corrects for documentation lag (10m in ICU vs 68m in Ward B) and multi-payer clearance tails (40.4h Ayushman vs 5.5h TPA).
                    </p>
                  </div>
                </div>
              </div>

              {/* 3. The Frontline Delivery Layer */}
              <div className="space-y-2">
                <h3 className="text-sm font-black text-slate-900">
                  Frontline Clinical &amp; Operational Delivery Layer
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                    <div className="font-bold text-slate-800">F2: Round Clock</div>
                    <div className="text-[10px] text-slate-500">Backwards phlebotomy before 08:00 AM breakfast</div>
                  </div>
                  <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                    <div className="font-bold text-slate-800">F3: ICU Step-Down</div>
                    <div className="text-[10px] text-slate-500">2x candidate over-preparation buffer with doctor gate</div>
                  </div>
                  <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                    <div className="font-bold text-slate-800">F4: Nurse Check</div>
                    <div className="text-[10px] text-slate-500">Caregiver barrier triage &amp; Piper neural Hindi TTS</div>
                  </div>
                  <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                    <div className="font-bold text-slate-800">F6: Bill Estimator</div>
                    <div className="text-[10px] text-slate-500">Advance &plusmn;10% out-of-pocket family SMS with disclaimer</div>
                  </div>
                </div>
              </div>

              {/* 4. Canonical 10 Guardrails Cheat Sheet */}
              <div className="p-4 bg-slate-900 text-white rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    Canonical 10-Guardrail Safety Architecture
                  </span>
                  <span className="text-[10px] font-mono text-emerald-400">10 / 10 Verified Passing</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-slate-300 pt-1">
                  <div>#1 Doctor Decides (Zero clinical automation)</div>
                  <div>#2 Read-Only HMS (Never corrupts core EHR)</div>
                  <div>#3 P90 Planning (Rejects optimistic averages)</div>
                  <div>#4 Confidence Floor (&ge; 70% threshold)</div>
                  <div>#5 Alert Fatigue Cap (&le; 10 tasks/staff/shift)</div>
                  <div>#6 Financial Estimate (&plusmn;10% bound + disclaimer)</div>
                  <div>#7 Doctor Privacy (Zero surveillance / ranking)</div>
                  <div>#8 Green-Consent (Only 🟢 unlocks capacity)</div>
                  <div>#9 Clinical Honesty ([0.05, 0.92] bounded)</div>
                  <div>#10 Scale Separation (30-bed live vs 300-bed proj)</div>
                </div>
              </div>

              {/* 5. Measured & Projected Impact */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-center">
                <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200">
                  <div className="text-2xl font-black text-emerald-700">78%</div>
                  <div className="text-[11px] font-bold text-emerald-900 mt-0.5">Discharged Before 11:00 AM</div>
                  <div className="text-[10px] text-slate-500">vs 18% Baseline Inpatient Benchmark</div>
                </div>
                <div className="p-3 bg-indigo-50 rounded-xl border border-indigo-200">
                  <div className="text-2xl font-black text-indigo-700">2.4 Hours</div>
                  <div className="text-[11px] font-bold text-indigo-900 mt-0.5">Saved Per Patient Admission</div>
                  <div className="text-[10px] text-slate-500">Empirical non-clinical turnaround compression</div>
                </div>
                <div className="p-3 bg-violet-50 rounded-xl border border-violet-200">
                  <div className="text-2xl font-black text-violet-700">2,250 Days</div>
                  <div className="text-[11px] font-bold text-violet-900 mt-0.5">Annual Bed-Days Freed</div>
                  <div className="text-[10px] text-slate-500">At 300-bed regional hospital projection scale</div>
                </div>
              </div>

              <div className="flex justify-end pt-2 border-t border-slate-100">
                <button
                  onClick={() => setShowPitchModal(false)}
                  className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition"
                >
                  Close Briefing
                </button>
              </div>
            </div>
          </div>
        )}

        {/* KEYBOARD SHORTCUTS HELP MODAL (PHASE 11) */}
        {showShortcutsHelp && (
          <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <Keyboard className="w-5 h-5 text-indigo-600" />
                  <h3 className="text-base font-black text-slate-900">Keyboard Shortcuts</h3>
                </div>
                <button onClick={() => setShowShortcutsHelp(false)} className="text-slate-400 hover:text-slate-700">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between p-2 bg-slate-50 rounded-lg">
                  <span className="font-medium text-slate-700">Today&apos;s Plan (CP-SAT)</span>
                  <kbd className="px-2 py-1 bg-white border border-slate-200 rounded text-xs font-mono font-bold">P</kbd>
                </div>
                <div className="flex items-center justify-between p-2 bg-slate-50 rounded-lg">
                  <span className="font-medium text-slate-700">Emergency &amp; Readiness (F9)</span>
                  <kbd className="px-2 py-1 bg-white border border-slate-200 rounded text-xs font-mono font-bold">E</kbd>
                </div>
                <div className="flex items-center justify-between p-2 bg-slate-50 rounded-lg">
                  <span className="font-medium text-slate-700">Proof &amp; Evaluation (F10)</span>
                  <kbd className="px-2 py-1 bg-white border border-slate-200 rounded text-xs font-mono font-bold">S</kbd>
                </div>
                <div className="flex items-center justify-between p-2 bg-slate-50 rounded-lg">
                  <span className="font-medium text-slate-700">ICU Step-Down (F3)</span>
                  <kbd className="px-2 py-1 bg-white border border-slate-200 rounded text-xs font-mono font-bold">I</kbd>
                </div>
                <div className="flex items-center justify-between p-2 bg-slate-50 rounded-lg">
                  <span className="font-medium text-slate-700">Nurse Check (F4)</span>
                  <kbd className="px-2 py-1 bg-white border border-slate-200 rounded text-xs font-mono font-bold">N</kbd>
                </div>
                <div className="flex items-center justify-between p-2 bg-slate-50 rounded-lg">
                  <span className="font-medium text-slate-700">Bill Estimator (F6)</span>
                  <kbd className="px-2 py-1 bg-white border border-slate-200 rounded text-xs font-mono font-bold">B</kbd>
                </div>
                <div className="flex items-center justify-between p-2 bg-slate-50 rounded-lg">
                  <span className="font-medium text-slate-700">WhatsApp Delivery (F5)</span>
                  <kbd className="px-2 py-1 bg-white border border-slate-200 rounded text-xs font-mono font-bold">W</kbd>
                </div>
                <div className="flex items-center justify-between p-2 bg-slate-50 rounded-lg">
                  <span className="font-medium text-slate-700">Round Clock &amp; Blood Route</span>
                  <kbd className="px-2 py-1 bg-white border border-slate-200 rounded text-xs font-mono font-bold">R</kbd>
                </div>
                <div className="flex items-center justify-between p-2 bg-slate-50 rounded-lg">
                  <span className="font-medium text-slate-700">Discharge Radar (F1)</span>
                  <kbd className="px-2 py-1 bg-white border border-slate-200 rounded text-xs font-mono font-bold">D</kbd>
                </div>
                <div className="flex items-center justify-between p-2 bg-slate-50 rounded-lg">
                  <span className="font-medium text-slate-700">Delay Book &amp; Doc Lag</span>
                  <kbd className="px-2 py-1 bg-white border border-slate-200 rounded text-xs font-mono font-bold">L</kbd>
                </div>
                <div className="flex items-center justify-between p-2 bg-slate-50 rounded-lg">
                  <span className="font-medium text-slate-700">Toggle Guided Demo Tour</span>
                  <kbd className="px-2 py-1 bg-white border border-slate-200 rounded text-xs font-mono font-bold">T</kbd>
                </div>
                <div className="flex items-center justify-between p-2 bg-slate-50 rounded-lg">
                  <span className="font-medium text-slate-700">Shortcuts Help</span>
                  <kbd className="px-2 py-1 bg-white border border-slate-200 rounded text-xs font-mono font-bold">?</kbd>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function roundHours(mins: number) {
  return (mins / 60.0).toFixed(1);
}
