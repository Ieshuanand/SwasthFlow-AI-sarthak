"use client";

import React, { useState } from "react";
import { 
  MessageSquare, 
  Volume2, 
  Smartphone, 
  CheckCircle2, 
  X, 
  AlertTriangle,
  Search,
  Lock,
  Send,
  UserCheck,
  ShieldCheck,
  Clock,
  ChevronRight,
  Info,
  Check
} from "lucide-react";
import { SMSMessage, sendSMS } from "../services/smsService";

export interface WhatsAppCard {
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

export type MessagePurpose = 
  | "Bill Estimate"
  | "Discharge Update"
  | "Transfer / Appointment Coordination"
  | "General Update"
  | "Document Request";

export interface PatientFamilyRecord {
  encounter_id: string;
  patient_name: string;
  bed_id: string;
  ward: string;
  diagnosis: string;
  consultant?: string;
  has_contact: boolean;
  contact_name?: string;
  relationship?: string; // e.g., "spouse", "son", "daughter", "brother", "husband"
  raw_phone?: string;
  masked_phone?: string; // "+91 98XXX-XX210"
  discharge_readiness_reason?: string;
  transfer_status_reason?: string;
  general_update_reason?: string;
  document_request_reason?: string;
  bill_estimate?: {
    accrued: number;
    projected_low: number;
    projected_high: number;
    out_of_pocket: number;
    uncertainty_percent: number;
  };
}

export interface SentPatientMessage {
  id: string;
  patient_name: string;
  bed_id: string;
  recipient_name: string;
  relationship: string;
  masked_phone: string;
  purpose: MessagePurpose;
  body: string;
  disclaimer: string | null;
  channel: "WhatsApp" | "SMS";
  timestamp: string;
  status: "Delivered (Simulated)" | "Dispatched";
  confirmation_line: string;
}

export const GUARDRAIL_G6_DISCLAIMER = 
  "Statutory notice under Guardrail #6: This is an automated preliminary estimate based on current clinical orders (±10% bounded). Final hospital bill depends on discharge medications and clinical orders authorized by your attending consultant.";

export const DEFAULT_PATIENT_ROSTER: PatientFamilyRecord[] = [
  {
    encounter_id: "ENC-1002",
    patient_name: "Rohan Verma",
    bed_id: "Bed 12",
    ward: "Medical Ward A",
    diagnosis: "Type 2 Diabetes Mellitus with Lower Limb Cellulitis",
    consultant: "Dr. Sharma",
    has_contact: true,
    contact_name: "Priya Sharma",
    relationship: "spouse",
    raw_phone: "+91 98765 43210",
    masked_phone: "+91 98XXX-XX210",
    discharge_readiness_reason: "Glycemic stability achieved on oral protocol. Cellulitis redness regressed by 70%. Attending round scheduled.",
    transfer_status_reason: "Patient is clinically stable in Medical Ward A. No intensive care transfer required.",
    general_update_reason: "Patient had a calm night and completed morning breakfast. Morning vitals are normal.",
    document_request_reason: "Please bring patient's Star Health TPA policy card and photo ID to the Ground Floor Coordinator Desk.",
    bill_estimate: {
      accrued: 24500,
      projected_low: 28000,
      projected_high: 34200,
      out_of_pocket: 4500,
      uncertainty_percent: 10
    }
  },
  {
    encounter_id: "ENC-1001",
    patient_name: "Priya Sundaram",
    bed_id: "Bed A-101",
    ward: "Medical Ward A",
    diagnosis: "Acute Calculous Cholecystitis",
    consultant: "Dr. Sharma",
    has_contact: true,
    contact_name: "Rajesh Sundaram",
    relationship: "husband",
    raw_phone: "+91 98451 22342",
    masked_phone: "+91 98XXX-XX342",
    discharge_readiness_reason: "Afebrile for 36h, oral antibiotics tolerated, surgical follow-up planned.",
    transfer_status_reason: "Scheduled for today's planned discharge; bed turnover queued.",
    general_update_reason: "Morning vitals are stable (BP 122/78, SpO2 99%). Routine morning evaluation completed.",
    document_request_reason: "Please verify pharmacy discharge medication receipts with the ward nurse.",
    bill_estimate: {
      accrued: 18400,
      projected_low: 21500,
      projected_high: 26200,
      out_of_pocket: 22800,
      uncertainty_percent: 10
    }
  },
  {
    encounter_id: "ENC-1003",
    patient_name: "Kavita Reddy",
    bed_id: "Bed B-203",
    ward: "Surgical Ward B",
    diagnosis: "Laparoscopic Appendectomy (Post-Op Day 2)",
    consultant: "Dr. Rao",
    has_contact: true,
    contact_name: "Suresh Reddy",
    relationship: "son",
    raw_phone: "+91 98450 12891",
    masked_phone: "+91 98XXX-XX891",
    discharge_readiness_reason: "Ambulating comfortably, surgical port incisions clean, surgical drain removed.",
    transfer_status_reason: "Surgical recovery on track in Ward B.",
    general_update_reason: "Surgeon Dr. Rao completed morning evaluation. Light oral diet tolerated.",
    document_request_reason: "Ayushman Bharat PM-JAY pre-auth requires signed family biometric slip.",
    bill_estimate: {
      accrued: 32000,
      projected_low: 35000,
      projected_high: 42000,
      out_of_pocket: 0,
      uncertainty_percent: 10
    }
  },
  {
    encounter_id: "ENC-1004",
    patient_name: "Manish Gupta",
    bed_id: "Bed ICU-02",
    ward: "Intensive Care Unit (ICU)",
    diagnosis: "Severe COPD Exacerbation with Respiratory Acidosis",
    consultant: "Dr. Sharma",
    has_contact: true,
    contact_name: "Sunita Gupta",
    relationship: "spouse",
    raw_phone: "+91 99123 45115",
    masked_phone: "+91 99XXX-XX115",
    discharge_readiness_reason: "Successfully weaned off non-invasive ventilation (BiPAP). Arterial blood gas normalized.",
    transfer_status_reason: "Approved by Intensivist for Step-Down to Medical Ward A under 2x Candidate Buffer.",
    general_update_reason: "Patient is conscious, alert, and speaking comfortably on room air nasal prong (2L).",
    document_request_reason: "Please submit CGHS pensioner card copy to ICU front desk.",
    bill_estimate: {
      accrued: 58000,
      projected_low: 62000,
      projected_high: 75000,
      out_of_pocket: 3200,
      uncertainty_percent: 10
    }
  },
  {
    encounter_id: "ENC-1005",
    patient_name: "Amit Patel",
    bed_id: "Bed A-105",
    ward: "Medical Ward A",
    diagnosis: "Pyrexia of Unknown Origin & Dehydration",
    consultant: "Dr. Sharma",
    has_contact: false, // NO CONTACT ON FILE
    discharge_readiness_reason: "Hydration normalized, awaiting repeat blood culture.",
    transfer_status_reason: "Medical Ward A observation."
  },
  {
    encounter_id: "ENC-1006",
    patient_name: "Deepa Nair",
    bed_id: "Bed B-201",
    ward: "Surgical Ward B",
    diagnosis: "Cesarean Section Post-Op Day 3",
    consultant: "Dr. Rao",
    has_contact: true,
    contact_name: "Vijay Nair",
    relationship: "brother",
    raw_phone: "+91 98220 19554",
    masked_phone: "+91 98XXX-XX554",
    discharge_readiness_reason: "Mother and baby vitals stable. Lactation established and pediatric check passed.",
    transfer_status_reason: "Post-natal ward care.",
    general_update_reason: "Both mother and baby are resting comfortably. Scheduled for afternoon discharge review.",
    document_request_reason: "Birth registration form requires father/family signature and ID copy.",
    bill_estimate: {
      accrued: 28500,
      projected_low: 31000,
      projected_high: 36000,
      out_of_pocket: 5500,
      uncertainty_percent: 10
    }
  },
  {
    encounter_id: "ENC-1007",
    patient_name: "Vikram Malhotra",
    bed_id: "Bed ICU-01",
    ward: "Intensive Care Unit (ICU)",
    diagnosis: "Acute Coronary Syndrome Post-Angioplasty",
    consultant: "Dr. Sharma",
    has_contact: true,
    contact_name: "Meera Malhotra",
    relationship: "daughter",
    raw_phone: "+91 94440 88776",
    masked_phone: "+91 94XXX-XX776",
    discharge_readiness_reason: "Cardiac telemetry stable for 36 hours. Femoral puncture site clean without hematoma.",
    transfer_status_reason: "Selected as Candidate #1 for Step-Down to Ward B.",
    general_update_reason: "Attending cardiologist Dr. Rao will confirm step-down transfer during 09:30 AM rounds.",
    document_request_reason: "Please verify Medi Assist pre-approval letter at billing desk.",
    bill_estimate: {
      accrued: 95000,
      projected_low: 105000,
      projected_high: 125000,
      out_of_pocket: 12000,
      uncertainty_percent: 10
    }
  },
  {
    encounter_id: "ENC-1008",
    patient_name: "Lakshmi Raman",
    bed_id: "Bed A-107",
    ward: "Medical Ward A",
    diagnosis: "Severe Osteoarthritis with Acute Joint Effusion",
    consultant: "Dr. Sharma",
    has_contact: false, // NO CONTACT ON FILE
    discharge_readiness_reason: "Joint aspiration complete, mobile with walker.",
    transfer_status_reason: "Orthopedic ward care."
  }
];

const INITIAL_SENT_MESSAGES: SentPatientMessage[] = [
  {
    id: "SENT-001",
    patient_name: "Rohan Verma",
    bed_id: "Bed 12",
    recipient_name: "Priya Sharma",
    relationship: "spouse",
    masked_phone: "+91 98XXX-XX210",
    purpose: "Bill Estimate",
    body: "Dear Priya Sharma, advance estimate for Rohan Verma (Bed 12 — Medical Ward A):\n• Current Accrued Charges: ₹24,500\n• Projected Final Range (±10% Bounded): ₹28,000 – ₹34,200\n• Estimated Out-Of-Pocket Balance: ₹4,500\n\nPlease confirm bank payment readiness to avoid discharge cashier bottlenecks during morning rounds.",
    disclaimer: GUARDRAIL_G6_DISCLAIMER,
    channel: "SMS",
    timestamp: "07:15 AM",
    status: "Delivered (Simulated)",
    confirmation_line: "Sending [Bill Estimate] to Priya Sharma (spouse of Bed 12 — Rohan Verma) via SMS."
  },
  {
    id: "SENT-002",
    patient_name: "Kavita Reddy",
    bed_id: "Bed B-203",
    recipient_name: "Suresh Reddy",
    relationship: "son",
    masked_phone: "+91 98XXX-XX891",
    purpose: "Discharge Update",
    body: "Dear Suresh Reddy, clinical discharge update for Kavita Reddy (Bed B-203):\nAmbulating comfortably, surgical port incisions clean, surgical drain removed.\n\nAttending surgeon Dr. Rao will review during morning rounds. Please ensure caregiver presence at bedside by 09:30 AM.",
    disclaimer: null,
    channel: "WhatsApp",
    timestamp: "06:45 AM",
    status: "Delivered (Simulated)",
    confirmation_line: "Sending [Discharge Update] to Suresh Reddy (son of Bed B-203 — Kavita Reddy) via WhatsApp."
  }
];

interface WhatsAppDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  whatsappMessages: WhatsAppCard[];
  smsLogs: SMSMessage[];
  onMarkDone: (taskId: string) => void;
  onCannotDo: (taskId: string, reason: string) => void;
  onOpenTestSmsModal: () => void;
}

export function WhatsAppDrawer({
  isOpen,
  onClose,
  whatsappMessages,
  smsLogs,
  onMarkDone,
  onCannotDo,
  onOpenTestSmsModal
}: WhatsAppDrawerProps) {
  // Drawer-level Tab: "A" = Staff Alerts, "B" = Patient & Family Messages
  const [drawerTab, setDrawerTab] = useState<"A" | "B">("B");

  // Tab A states (Staff Alerts)
  const [dispatchChannel, setDispatchChannel] = useState<"ALL" | "WHATSAPP" | "SMS">("ALL");
  const [selectedWhatsAppRole, setSelectedWhatsAppRole] = useState<string>("ALL");
  const [cannotModalTaskId, setCannotModalTaskId] = useState<string | null>(null);
  const [cannotReason, setCannotReason] = useState<string>("Patient not at bed (in diagnostic scan)");

  // Tab B states (Patient & Family Messages)
  const [composeSubView, setComposeSubView] = useState<"COMPOSE" | "SENT">("COMPOSE");
  const [rosterSearch, setRosterSearch] = useState<string>("");
  const [selectedPatientId, setSelectedPatientId] = useState<string>("ENC-1002"); // default Rohan Verma
  const [selectedPurpose, setSelectedPurpose] = useState<MessagePurpose>("Bill Estimate");
  const [messageBody, setMessageBody] = useState<string>("");
  const [selectedChannel, setSelectedChannel] = useState<"WhatsApp" | "SMS">("WhatsApp");
  const [confirmedByCoordinator, setConfirmedByCoordinator] = useState<boolean>(false);
  const [sentAuditLog, setSentAuditLog] = useState<SentPatientMessage[]>(INITIAL_SENT_MESSAGES);
  const [sendSuccessNotice, setSendSuccessNotice] = useState<string | null>(null);

  // Initialize or update message body when patient or purpose changes
  const selectedPatient = DEFAULT_PATIENT_ROSTER.find(p => p.encounter_id === selectedPatientId) || DEFAULT_PATIENT_ROSTER[0];

  const getTemplateForPatientAndPurpose = (patient: PatientFamilyRecord, purpose: MessagePurpose): string => {
    const cName = patient.contact_name || "Caregiver";
    const pName = patient.patient_name;
    const bId = patient.bed_id;
    const ward = patient.ward;

    switch (purpose) {
      case "Bill Estimate": {
        const est = patient.bill_estimate || {
          accrued: 24500,
          projected_low: 28000,
          projected_high: 34200,
          out_of_pocket: 4500
        };
        return `Dear ${cName}, advance estimate for ${pName} (${bId} — ${ward}):\n` +
          `• Current Accrued Hospital Charges: ₹${est.accrued.toLocaleString()}\n` +
          `• Projected Final Range (±10% Bounded): ₹${est.projected_low.toLocaleString()} – ₹${est.projected_high.toLocaleString()}\n` +
          `• Estimated Out-Of-Pocket Balance: ₹${est.out_of_pocket.toLocaleString()}\n\n` +
          `Please review and confirm bank payment readiness to avoid discharge cashier bottlenecks during morning doctor rounds.`;
      }
      case "Discharge Update":
        return `Dear ${cName}, clinical discharge update for ${pName} (${bId}):\n` +
          `${patient.discharge_readiness_reason || "Clinical vitals are stable and oral switch is complete."}\n\n` +
          `The attending consultant will review the case on morning rounds. Please ensure caregiver presence at the bedside by 09:30 AM.`;
      case "Transfer / Appointment Coordination":
        return `Dear ${cName}, care coordination update for ${pName} (${bId}):\n` +
          `${patient.transfer_status_reason || "Patient is reviewed for step-down care."}\n\n` +
          `Hospital operations is coordinating bed sanitization and porter transport. We will notify you once transfer is underway.`;
      case "General Update":
        return `Dear ${cName}, daily morning care update for ${pName} (${bId} — ${ward}):\n` +
          `${patient.general_update_reason || "Patient is resting comfortably with stable vital signs."}\n\n` +
          `Nursing team and duty medical officer are on station. Please contact operations if you need assistance.`;
      case "Document Request":
        return `Dear ${cName}, documentation notice for ${pName} (${bId}):\n` +
          `${patient.document_request_reason || "Please submit the patient's original photo ID and insurance policy card."}\n\n` +
          `Submitting documents before 08:30 AM avoids cashier queues and expedites discharge clearance.`;
    }
  };

  // Sync body whenever selected patient or purpose changes
  React.useEffect(() => {
    if (selectedPatient && selectedPatient.has_contact) {
      setMessageBody(getTemplateForPatientAndPurpose(selectedPatient, selectedPurpose));
      setConfirmedByCoordinator(false);
    }
  }, [selectedPatientId, selectedPurpose]);

  if (!isOpen) return null;

  const pendingCount = whatsappMessages.filter(m => m.status === "PENDING").length;

  // Filtered patients for searchable roster
  const filteredRoster = DEFAULT_PATIENT_ROSTER.filter(p => {
    const q = rosterSearch.toLowerCase().trim();
    if (!q) return true;
    return (
      p.patient_name.toLowerCase().includes(q) ||
      p.bed_id.toLowerCase().includes(q) ||
      p.ward.toLowerCase().includes(q) ||
      (p.contact_name && p.contact_name.toLowerCase().includes(q))
    );
  });

  // Explicit confirmation line required by specification:
  // "Sending [Bill Estimate] to Priya Sharma (spouse of Bed 12 — Rohan Verma) via WhatsApp."
  const explicitConfirmationLine = selectedPatient && selectedPatient.has_contact
    ? `Sending [${selectedPurpose}] to ${selectedPatient.contact_name} (${selectedPatient.relationship} of ${selectedPatient.bed_id} — ${selectedPatient.patient_name}) via ${selectedChannel}.`
    : "";

  const handleSimulatedSend = () => {
    if (!selectedPatient || !selectedPatient.has_contact) return;
    if (!confirmedByCoordinator) {
      alert("Please confirm the verification statement in Step 5 before sending.");
      return;
    }

    const newMsg: SentPatientMessage = {
      id: `SENT-${String(sentAuditLog.length + 1).padStart(3, "0")}`,
      patient_name: selectedPatient.patient_name,
      bed_id: selectedPatient.bed_id,
      recipient_name: selectedPatient.contact_name!,
      relationship: selectedPatient.relationship!,
      masked_phone: selectedPatient.masked_phone!,
      purpose: selectedPurpose,
      body: messageBody,
      disclaimer: selectedPurpose === "Bill Estimate" ? GUARDRAIL_G6_DISCLAIMER : null,
      channel: selectedChannel,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      status: "Delivered (Simulated)",
      confirmation_line: explicitConfirmationLine
    };

    // If channel is SMS, log through smsService as well
    if (selectedChannel === "SMS" && selectedPatient.raw_phone) {
      const fullSmsBody = selectedPurpose === "Bill Estimate"
        ? `${messageBody}\n\n${GUARDRAIL_G6_DISCLAIMER}`
        : messageBody;

      sendSMS(
        selectedPatient.raw_phone,
        fullSmsBody,
        {
          name: `${selectedPatient.contact_name} (${selectedPatient.relationship})`,
          role: "PATIENT_FAMILY",
          title: `${selectedPurpose} Notice`,
          tag: selectedPurpose === "Bill Estimate" ? "Guardrail #6 (Out-of-Pocket Transparency ±10%)" : "Guardrail #7 (Privacy & Verified Contacts)"
        }
      );
    }

    setSentAuditLog(prev => [newMsg, ...prev]);
    setSendSuccessNotice(`✓ Message successfully dispatched: ${explicitConfirmationLine}`);
    setConfirmedByCoordinator(false);
    setTimeout(() => setSendSuccessNotice(null), 7000);
    setComposeSubView("SENT");
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-950/70 backdrop-blur-sm flex justify-end animate-fade-in">
      <div className="w-full max-w-3xl bg-slate-100 h-full shadow-2xl flex flex-col border-l border-slate-300 transform transition-transform duration-300">
        
        {/* Drawer Header (WhatsApp Emerald Bar) */}
        <div className="bg-[#075E54] text-white p-5 flex items-center justify-between shadow-md flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-[#128C7E] rounded-xl text-white shadow-xs">
              <MessageSquare className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold tracking-tight">Operations WhatsApp &amp; Family Communications</h2>
                <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-emerald-400/20 text-emerald-200 border border-emerald-400/30">
                  COORDINATOR COMMAND
                </span>
              </div>
              <p className="text-xs text-emerald-100 mt-0.5">
                Frontline staff dispatch, patient bill estimates, and family coordination.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-emerald-100 hover:text-white hover:bg-[#128C7E] transition"
            title="Close Communications Drawer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Primary Drawer Tabs: Tab A (Staff Alerts) vs Tab B (Patient & Family Messages) */}
        <div className="bg-[#128C7E] px-4 pt-2 flex items-center gap-2 flex-shrink-0 border-b border-[#075E54]">
          <button
            onClick={() => setDrawerTab("B")}
            className={`px-4 py-2.5 rounded-t-xl text-xs font-bold transition flex items-center gap-2 ${
              drawerTab === "B"
                ? "bg-slate-100 text-slate-900 shadow-md font-extrabold"
                : "text-emerald-100 hover:text-white hover:bg-white/10"
            }`}
          >
            <UserCheck className="w-4 h-4 text-emerald-700" />
            <span>Tab B: Patient &amp; Family Messages</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-emerald-600 text-white font-mono">
              New
            </span>
          </button>

          <button
            onClick={() => setDrawerTab("A")}
            className={`px-4 py-2.5 rounded-t-xl text-xs font-bold transition flex items-center gap-2 ${
              drawerTab === "A"
                ? "bg-slate-100 text-slate-900 shadow-md font-extrabold"
                : "text-emerald-100 hover:text-white hover:bg-white/10"
            }`}
          >
            <Smartphone className="w-4 h-4 text-indigo-700" />
            <span>Tab A: Staff Alerts &amp; Hindi Audio</span>
            {pendingCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-amber-400 text-slate-950 font-mono">
                {pendingCount}
              </span>
            )}
          </button>
        </div>

        {/* TAB B: PATIENT & FAMILY MESSAGES (GUIDED 5-STEP COMPOSE FLOW) */}
        {drawerTab === "B" && (
          <div className="flex-1 overflow-y-auto flex flex-col">
            {/* Tab B Sub-header / Mode Switcher */}
            <div className="bg-white border-b border-slate-200 px-5 py-3 flex items-center justify-between gap-3 flex-shrink-0">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setComposeSubView("COMPOSE")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                    composeSubView === "COMPOSE"
                      ? "bg-slate-900 text-white shadow-xs"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  }`}
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Guided Compose (5 Steps)</span>
                </button>
                <button
                  onClick={() => setComposeSubView("SENT")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                    composeSubView === "SENT"
                      ? "bg-slate-900 text-white shadow-xs"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  }`}
                >
                  <Clock className="w-3.5 h-3.5" />
                  <span>Sent Audit Trail ({sentAuditLog.length})</span>
                </button>
              </div>

              <div className="text-[11px] font-mono text-slate-500 hidden sm:flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span>Guardrail #6 &amp; #7 Enforced</span>
              </div>
            </div>

            {/* Success notification banner */}
            {sendSuccessNotice && (
              <div className="m-4 p-3 bg-emerald-50 border border-emerald-300 rounded-xl text-xs text-emerald-900 font-medium flex items-center justify-between animate-fade-in shadow-xs">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                  <span>{sendSuccessNotice}</span>
                </div>
                <button
                  onClick={() => setSendSuccessNotice(null)}
                  className="text-emerald-700 hover:text-emerald-950 p-1"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* SUB-VIEW 1: GUIDED COMPOSE FLOW */}
            {composeSubView === "COMPOSE" && (
              <div className="p-5 space-y-6 flex-1">

                {/* STEP 1: RECIPIENT SELECTION (Searchable, not free-text) */}
                <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-slate-900 text-white font-bold text-xs flex items-center justify-center font-mono">
                        1
                      </span>
                      <h3 className="font-bold text-slate-900 text-sm">
                        Recipient (Required, Searchable Roster)
                      </h3>
                    </div>
                    <span className="text-[10px] text-slate-500 font-mono font-medium">
                      Select by Patient or Bed
                    </span>
                  </div>

                  {/* Search Bar */}
                  <div className="relative">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      placeholder="Search patient name (e.g. Rohan Verma) or bed (e.g. Bed 12, A-102)..."
                      value={rosterSearch}
                      onChange={(e) => setRosterSearch(e.target.value)}
                      className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-slate-900 text-slate-900 font-medium"
                    />
                    {rosterSearch && (
                      <button
                        onClick={() => setRosterSearch("")}
                        className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {/* Patient Selection Pills */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                      Select Patient from Roster:
                    </label>
                    <div className="flex items-center gap-2 flex-wrap max-h-36 overflow-y-auto p-1 bg-slate-50 rounded-xl border border-slate-200">
                      {filteredRoster.map(p => {
                        const isSelected = p.encounter_id === selectedPatientId;
                        return (
                          <button
                            key={p.encounter_id}
                            type="button"
                            onClick={() => setSelectedPatientId(p.encounter_id)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition flex items-center gap-1.5 ${
                              isSelected
                                ? "bg-slate-900 text-white font-bold shadow-xs"
                                : "bg-white text-slate-700 hover:bg-slate-100 border border-slate-200"
                            }`}
                          >
                            <span className="font-mono text-[10px] opacity-75">{p.bed_id}</span>
                            <span>{p.patient_name}</span>
                            {!p.has_contact && (
                              <span className="px-1 py-0.2 rounded text-[9px] bg-rose-100 text-rose-800 font-bold">
                                No Contact
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Recipient Details & Family Contact Card */}
                  {selectedPatient && (
                    <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-bold text-slate-900 text-sm flex items-center gap-2">
                            <span>{selectedPatient.patient_name}</span>
                            <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-200 text-slate-700">
                              {selectedPatient.bed_id}
                            </span>
                            <span className="text-xs text-slate-500 font-normal">
                              ({selectedPatient.ward})
                            </span>
                          </div>
                          <div className="text-xs text-slate-600 mt-0.5">
                            Diagnosis: <strong>{selectedPatient.diagnosis}</strong>
                          </div>
                        </div>

                        {selectedPatient.has_contact ? (
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1">
                            <Check className="w-3 h-3 text-emerald-600" />
                            Registered Contact On File
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-300 flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3 text-rose-600" />
                            No Registered Contact
                          </span>
                        )}
                      </div>

                      {/* Designated Family Contact Display */}
                      {selectedPatient.has_contact ? (
                        <div className="bg-white p-3 rounded-xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div className="space-y-0.5">
                            <div className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">
                              Designated Family Caregiver
                            </div>
                            <div className="text-xs font-bold text-slate-900 flex items-center gap-2">
                              <span>{selectedPatient.contact_name}</span>
                              <span className="text-[11px] font-normal text-slate-600 font-mono">
                                ({selectedPatient.relationship} of {selectedPatient.bed_id} — {selectedPatient.patient_name})
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold text-slate-500 uppercase">Phone:</span>
                            <span className="text-xs font-mono font-bold text-indigo-700 bg-indigo-50 px-2 py-1 rounded-lg border border-indigo-200">
                              {selectedPatient.masked_phone}
                            </span>
                          </div>
                        </div>
                      ) : (
                        /* Flow stops here when no contact on file */
                        <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl space-y-1 text-xs text-rose-900">
                          <div className="font-bold flex items-center gap-1.5 text-rose-950">
                            <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                            No contact on file for this patient
                          </div>
                          <p className="text-rose-800 text-[11px] leading-relaxed">
                            Under Guardrail #7 (Privacy &amp; Verified Caregiver Identity), messaging is strictly blocked until a designated family contact is registered at the admissions desk.
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* If patient has no contact, block remaining steps */}
                {!selectedPatient.has_contact ? (
                  <div className="p-6 text-center bg-white rounded-2xl border border-slate-200 text-xs text-slate-400 italic">
                    Select a patient with a verified family contact to proceed to Purpose, Message, and Channel selection.
                  </div>
                ) : (
                  <>
                    {/* STEP 2: PURPOSE SELECTION (Fixed list, not freeform) */}
                    <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3">
                      <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                        <div className="flex items-center gap-2">
                          <span className="w-6 h-6 rounded-full bg-slate-900 text-white font-bold text-xs flex items-center justify-center font-mono">
                            2
                          </span>
                          <h3 className="font-bold text-slate-900 text-sm">
                            Purpose (Required, Fixed Selection)
                          </h3>
                        </div>
                        <span className="text-[10px] text-slate-500 font-mono">
                          Drives Auto-Template &amp; Guardrails
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                        {(
                          [
                            "Bill Estimate",
                            "Discharge Update",
                            "Transfer / Appointment Coordination",
                            "General Update",
                            "Document Request"
                          ] as MessagePurpose[]
                        ).map((p) => {
                          const isSelected = selectedPurpose === p;
                          return (
                            <button
                              key={p}
                              type="button"
                              onClick={() => setSelectedPurpose(p)}
                              className={`p-3 rounded-xl border text-left transition flex flex-col justify-between space-y-1 ${
                                isSelected
                                  ? "bg-indigo-50 border-indigo-400 text-indigo-950 ring-2 ring-indigo-500/20 shadow-xs"
                                  : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-bold text-xs">{p}</span>
                                {isSelected && (
                                  <Check className="w-3.5 h-3.5 text-indigo-600 flex-shrink-0" />
                                )}
                              </div>
                              <span className="text-[10px] text-slate-500 font-normal">
                                {p === "Bill Estimate" && "±10% bound + G6 disclaimer"}
                                {p === "Discharge Update" && "Vitals & round review"}
                                {p === "Transfer / Appointment Coordination" && "Bed step-down & porter"}
                                {p === "General Update" && "Morning comfort & vitals"}
                                {p === "Document Request" && "ID & policy card request"}
                              </span>
                            </button>
                          );
                        })}
                      </div>

                      {/* Purpose Informational Banner */}
                      {selectedPurpose === "Bill Estimate" && selectedPatient.bill_estimate && (
                        <div className="p-3 bg-amber-50/80 border border-amber-200 rounded-xl text-xs space-y-1">
                          <div className="font-bold text-amber-900 flex items-center gap-1.5 text-[11px]">
                            <Lock className="w-3.5 h-3.5 text-amber-700" />
                            Auto-Attached Bounded Estimate Object &amp; Mandatory Guardrail G6 Disclaimer
                          </div>
                          <div className="text-[11px] text-amber-950 font-mono grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                            <div>Accrued: <strong>₹{selectedPatient.bill_estimate.accrued.toLocaleString()}</strong></div>
                            <div>Projected Min: <strong>₹{selectedPatient.bill_estimate.projected_low.toLocaleString()}</strong></div>
                            <div>Projected Max: <strong>₹{selectedPatient.bill_estimate.projected_high.toLocaleString()}</strong></div>
                            <div>Est. Out-of-Pocket: <strong>₹{selectedPatient.bill_estimate.out_of_pocket.toLocaleString()}</strong></div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* STEP 3: MESSAGE BODY (Editable note + Locked G6 Disclaimer if Bill Estimate) */}
                    <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3">
                      <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                        <div className="flex items-center gap-2">
                          <span className="w-6 h-6 rounded-full bg-slate-900 text-white font-bold text-xs flex items-center justify-center font-mono">
                            3
                          </span>
                          <h3 className="font-bold text-slate-900 text-sm">
                            Message Body (Pre-Filled from Purpose Template)
                          </h3>
                        </div>
                        <span className="text-[10px] text-slate-500 font-mono">
                          Coordinator Editable
                        </span>
                      </div>

                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                          Coordinator Message Notes (Editable):
                        </label>
                        <textarea
                          rows={4}
                          value={messageBody}
                          onChange={(e) => setMessageBody(e.target.value)}
                          className="w-full p-3 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 font-sans focus:outline-none focus:ring-2 focus:ring-slate-900 leading-relaxed"
                          placeholder="Type or edit message to patient family..."
                        />
                      </div>

                      {/* Locked Disclaimer Block for Bill Estimate (MANDATORY) */}
                      {selectedPurpose === "Bill Estimate" && (
                        <div className="p-3.5 bg-amber-50/90 rounded-xl border-2 border-amber-300/80 space-y-1.5 shadow-xs">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5 text-amber-900 font-bold text-[11px] uppercase tracking-wider">
                              <Lock className="w-3.5 h-3.5 text-amber-700" />
                              <span>Mandatory Guardrail G6 Disclaimer</span>
                            </div>
                            <span className="px-2 py-0.5 bg-amber-200/80 text-amber-900 rounded text-[9px] font-mono font-black">
                              🔒 LOCKED • CANNOT BE REMOVED
                            </span>
                          </div>
                          <p className="text-amber-950 font-serif italic text-xs leading-relaxed border-l-2 border-amber-500 pl-2.5 py-0.5">
                            &ldquo;{GUARDRAIL_G6_DISCLAIMER}&rdquo;
                          </p>
                          <div className="text-[10px] text-amber-700 font-medium">
                            * The coordinator cannot send a bill-purpose message without this statutory disclaimer present.
                          </div>
                        </div>
                      )}
                    </div>

                    {/* STEP 4: CHANNEL SELECTION (WhatsApp / SMS) */}
                    <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3">
                      <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                        <div className="flex items-center gap-2">
                          <span className="w-6 h-6 rounded-full bg-slate-900 text-white font-bold text-xs flex items-center justify-center font-mono">
                            4
                          </span>
                          <h3 className="font-bold text-slate-900 text-sm">
                            Channel Selection
                          </h3>
                        </div>
                        <span className="text-[10px] text-slate-500 font-mono">
                          Simulated Sending Engine
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <button
                          type="button"
                          onClick={() => setSelectedChannel("WhatsApp")}
                          className={`p-3.5 rounded-xl border text-left transition flex items-center justify-between ${
                            selectedChannel === "WhatsApp"
                              ? "bg-emerald-50 border-emerald-400 text-emerald-950 ring-2 ring-emerald-500/20 shadow-xs"
                              : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs">
                              💬
                            </div>
                            <div>
                              <div className="font-bold text-xs">WhatsApp Message</div>
                              <div className="text-[10px] text-slate-500">Official Hospital WhatsApp API</div>
                            </div>
                          </div>
                          {selectedChannel === "WhatsApp" && (
                            <Check className="w-4 h-4 text-emerald-600" />
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={() => setSelectedChannel("SMS")}
                          className={`p-3.5 rounded-xl border text-left transition flex items-center justify-between ${
                            selectedChannel === "SMS"
                              ? "bg-indigo-50 border-indigo-400 text-indigo-950 ring-2 ring-indigo-500/20 shadow-xs"
                              : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs">
                              📱
                            </div>
                            <div>
                              <div className="font-bold text-xs">Carrier SMS</div>
                              <div className="text-[10px] text-slate-500">Twilio / Telephony Gateway</div>
                            </div>
                          </div>
                          {selectedChannel === "SMS" && (
                            <Check className="w-4 h-4 text-indigo-600" />
                          )}
                        </button>
                      </div>
                    </div>

                    {/* STEP 5: CONFIRMATION SUMMARY (MANDATORY, shown before send) */}
                    <div className="bg-slate-900 text-white rounded-2xl border border-slate-800 p-5 shadow-lg space-y-4">
                      <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                        <div className="flex items-center gap-2">
                          <span className="w-6 h-6 rounded-full bg-emerald-500 text-slate-950 font-black text-xs flex items-center justify-center font-mono">
                            5
                          </span>
                          <h3 className="font-bold text-white text-sm">
                            Mandatory Confirmation Summary
                          </h3>
                        </div>
                        <span className="text-[10px] text-emerald-400 font-mono font-bold">
                          Step 5 of 5
                        </span>
                      </div>

                      {/* Explicit Single Confirmation Line */}
                      <div className="p-3.5 rounded-xl bg-slate-800/90 border border-slate-700/80 space-y-1.5">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                          <Info className="w-3.5 h-3.5 text-emerald-400" />
                          Exact Transmission Intent:
                        </div>
                        <p className="text-sm font-black text-white leading-relaxed">
                          {explicitConfirmationLine}
                        </p>
                      </div>

                      {/* Mandatory Checkbox Gate */}
                      <label className="flex items-start gap-2.5 cursor-pointer text-xs text-slate-200 pt-1">
                        <input
                          type="checkbox"
                          checked={confirmedByCoordinator}
                          onChange={(e) => setConfirmedByCoordinator(e.target.checked)}
                          className="mt-0.5 rounded border-slate-700 text-emerald-600 focus:ring-emerald-500"
                        />
                        <span>
                          I confirm that the recipient identity, relation, purpose tag, and channel have been verified for accuracy prior to transmission.
                        </span>
                      </label>

                      {/* Action Button */}
                      <div className="pt-2 flex items-center justify-between gap-3">
                        <div className="text-[11px] text-slate-400 font-mono">
                          Recipient: {selectedPatient.masked_phone}
                        </div>
                        <button
                          type="button"
                          onClick={handleSimulatedSend}
                          disabled={!confirmedByCoordinator}
                          className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold rounded-xl transition flex items-center gap-2 shadow-md"
                        >
                          <Send className="w-4 h-4" />
                          <span>Transmit via {selectedChannel}</span>
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* SUB-VIEW 2: SENT AUDIT TRAIL */}
            {composeSubView === "SENT" && (
              <div className="p-5 space-y-4 flex-1">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                    <Clock className="w-4 h-4 text-emerald-600" />
                    Patient &amp; Family Communications Audit Trail ({sentAuditLog.length})
                  </h3>
                  <button
                    onClick={() => setComposeSubView("COMPOSE")}
                    className="px-3 py-1 bg-slate-900 text-white rounded-lg text-xs font-bold hover:bg-slate-800 transition"
                  >
                    + Compose New
                  </button>
                </div>

                <div className="space-y-3">
                  {sentAuditLog.map((log) => (
                    <div
                      key={log.id}
                      className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs space-y-3"
                    >
                      <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                        <div className="flex items-center gap-2">
                          <div className={`w-7 h-7 rounded-full text-white font-bold text-xs flex items-center justify-center ${
                            log.channel === "WhatsApp" ? "bg-emerald-600" : "bg-indigo-600"
                          }`}>
                            {log.channel === "WhatsApp" ? "💬" : "📱"}
                          </div>
                          <div>
                            <div className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
                              <span>{log.recipient_name}</span>
                              <span className="text-[10px] text-slate-500 font-normal">
                                ({log.relationship} of {log.bed_id} — {log.patient_name})
                              </span>
                            </div>
                            <div className="text-[10px] text-slate-400 font-mono">
                              {log.masked_phone} • via {log.channel}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                            {log.purpose}
                          </span>
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-emerald-100 text-emerald-800">
                            ✓ {log.status}
                          </span>
                        </div>
                      </div>

                      <div className="bg-slate-50 rounded-xl p-3 border border-slate-200 text-xs text-slate-700 whitespace-pre-line leading-relaxed font-sans">
                        {log.body}
                      </div>

                      {log.disclaimer && (
                        <div className="p-2.5 bg-amber-50 rounded-lg border border-amber-200 text-[11px] text-amber-900 italic font-serif leading-relaxed">
                          🔒 {log.disclaimer}
                        </div>
                      )}

                      <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono pt-1">
                        <span>Dispatched at: <strong>{log.timestamp}</strong></span>
                        <span className="text-slate-500">{log.confirmation_line}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB A: STAFF ALERTS & HINDI AUDIO (UNCHANGED ARCHITECTURE) */}
        {drawerTab === "A" && (
          <div className="flex-1 overflow-y-auto flex flex-col">
            {/* Filter Toolbar */}
            <div className="bg-white border-b border-slate-200 p-3 space-y-2 flex-shrink-0">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[11px] font-bold text-slate-500 uppercase mr-1">Channel:</span>
                  <button
                    onClick={() => setDispatchChannel("ALL")}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition ${
                      dispatchChannel === "ALL"
                        ? "bg-[#075E54] text-white shadow-xs"
                        : "bg-slate-100 hover:bg-slate-200 text-slate-700"
                    }`}
                  >
                    All ({whatsappMessages.length + smsLogs.length})
                  </button>
                  <button
                    onClick={() => setDispatchChannel("WHATSAPP")}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1 ${
                      dispatchChannel === "WHATSAPP"
                        ? "bg-[#075E54] text-white shadow-xs"
                        : "bg-slate-100 hover:bg-slate-200 text-slate-700"
                    }`}
                  >
                    💬 WhatsApp ({whatsappMessages.length})
                  </button>
                  <button
                    onClick={() => setDispatchChannel("SMS")}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1 ${
                      dispatchChannel === "SMS"
                        ? "bg-[#075E54] text-white shadow-xs"
                        : "bg-slate-100 hover:bg-slate-200 text-slate-700"
                    }`}
                  >
                    📱 SMS ({smsLogs.length})
                  </button>
                </div>

                <button
                  onClick={onOpenTestSmsModal}
                  className="px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-bold flex items-center gap-1 transition"
                >
                  <Smartphone className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Dispatch Test SMS</span>
                </button>
              </div>

              <div className="flex items-center gap-1.5 flex-wrap pt-1 border-t border-slate-100">
                <span className="text-[11px] font-bold text-slate-500 uppercase mr-1">Role:</span>
                {["ALL", "PHLEBOTOMY", "BILLING", "HOUSEKEEPING", "PORTER"].map(r => (
                  <button
                    key={r}
                    onClick={() => setSelectedWhatsAppRole(r)}
                    className={`px-2 py-0.5 rounded text-[11px] font-semibold transition ${
                      selectedWhatsAppRole === r
                        ? "bg-slate-900 text-white"
                        : "bg-slate-100 hover:bg-slate-200 text-slate-600"
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>

            {/* Scrollable Feed Body */}
            <div className="p-4 space-y-4 flex-1">
              {/* Carrier SMS Cards */}
              {(dispatchChannel === "ALL" || dispatchChannel === "SMS") && smsLogs.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-2">
                      <Smartphone className="w-4 h-4 text-indigo-600" />
                      Simulated Carrier SMS Logs ({smsLogs.length})
                    </h3>
                    <span className="text-[10px] text-slate-500 font-mono">
                      Provider: <strong>Simulated Twilio</strong>
                    </span>
                  </div>

                  <div className="space-y-3">
                    {smsLogs
                      .filter(m => selectedWhatsAppRole === "ALL" || m.recipient_role === selectedWhatsAppRole || (selectedWhatsAppRole === "HOUSEKEEPING" && m.recipient_role === "SUPPORT"))
                      .map(sms => (
                        <div key={sms.id} className="bg-slate-900 text-white rounded-2xl border border-slate-800 p-4 shadow-sm space-y-2.5">
                          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 rounded-full bg-indigo-600 text-white font-bold text-xs flex items-center justify-center">
                                📱
                              </div>
                              <div>
                                <div className="font-bold text-xs text-white flex items-center gap-1.5">
                                  <span>{sms.recipient_name}</span>
                                  <span className="px-1.5 py-0.2 rounded text-[9px] font-mono bg-indigo-500/20 text-indigo-300 border border-indigo-400/30">
                                    SMS
                                  </span>
                                </div>
                                <div className="text-[10px] text-slate-400 font-mono">{sms.recipient} • {sms.recipient_role}</div>
                              </div>
                            </div>

                            <span className="px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-emerald-500/20 text-emerald-300">
                              ✓✓ SENT
                            </span>
                          </div>

                          <div className="bg-slate-800/90 rounded-xl p-3 border border-slate-700/80 space-y-1">
                            <div className="flex items-center justify-between text-[10px] text-slate-400">
                              <span className="font-bold text-slate-200">{sms.title || "Alert"}</span>
                              <span className="font-mono">{sms.timestamp}</span>
                            </div>
                            <p className="text-xs text-slate-300 leading-relaxed">
                              {sms.body}
                            </p>
                          </div>

                          <div className="pt-1 flex items-center justify-between text-[10px] text-slate-400">
                            <span className="text-indigo-300 font-mono">🛡️ {sms.guardrail_tag}</span>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {/* WhatsApp Cards Grid */}
              {(dispatchChannel === "ALL" || dispatchChannel === "WHATSAPP") && (
                <div className="space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-emerald-600" />
                    WhatsApp Task Cards ({whatsappMessages.length}) — Piper Neural Hindi TTS
                  </h3>

                  {whatsappMessages.length === 0 ? (
                    <div className="p-8 text-center bg-white rounded-2xl border border-slate-200 text-xs text-slate-500">
                      No active WhatsApp task notices for current filters.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {whatsappMessages
                        .filter(m => selectedWhatsAppRole === "ALL" || m.role === selectedWhatsAppRole || (selectedWhatsAppRole === "HOUSEKEEPING" && m.role === "CLEANING"))
                        .map(msg => (
                          <div key={msg.task_id} className="bg-[#EFEAE2] rounded-2xl border border-slate-300 p-4 shadow-sm space-y-3">
                            {/* Chat Header */}
                            <div className="flex items-center justify-between border-b border-slate-300/80 pb-2">
                              <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-full bg-[#128C7E] text-white font-bold text-xs flex items-center justify-center">
                                  {msg.role[0]}
                                </div>
                                <div>
                                  <div className="font-bold text-xs text-slate-900">{msg.recipient_name}</div>
                                  <div className="text-[10px] text-slate-500 font-mono">{msg.recipient_role} • {msg.recipient_phone}</div>
                                </div>
                              </div>

                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                msg.status === "DONE" ? "bg-emerald-100 text-emerald-800 border border-emerald-300" :
                                msg.status === "CANNOT" ? "bg-rose-100 text-rose-800 border border-rose-300" : "bg-amber-100 text-amber-800 border border-amber-300"
                              }`}>
                                {msg.status}
                              </span>
                            </div>

                            {/* Chat Bubble Card */}
                            <div className="bg-white rounded-2xl p-3.5 shadow-xs border border-slate-200/90 space-y-2.5">
                              <div className="flex items-start justify-between gap-2">
                                <div>
                                  <div className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider flex items-center gap-1">
                                    <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block animate-pulse" />
                                    {msg.role} • Ward: {msg.ward}
                                  </div>
                                  <h4 className="font-bold text-slate-900 text-sm mt-0.5">{msg.title_en}</h4>
                                  <div className="text-xs font-semibold text-slate-700 mt-0.5">{msg.title_hi}</div>
                                </div>
                                <span className="text-[10px] font-mono text-slate-400 flex-shrink-0">{msg.deadline_str}</span>
                              </div>

                              {/* Mandatory Non-Negotiable WHY */}
                              <div className="bg-[#DCF8C6]/50 border border-emerald-300/60 p-2.5 rounded-xl space-y-1 text-xs">
                                <div className="text-[10px] font-bold text-emerald-900 uppercase tracking-wider flex items-center gap-1">
                                  ⏱️ Mandatory Non-Negotiable WHY (Backwards-Scheduling Math):
                                </div>
                                <p className="text-slate-800 leading-snug">{msg.reason_en}</p>
                                <p className="text-slate-700 font-medium leading-snug">{msg.reason_hi}</p>
                              </div>

                              {/* Audio Voice Note Player */}
                              <div className="bg-slate-50 border border-slate-200 p-2 rounded-xl space-y-1">
                                <div className="flex items-center justify-between text-[10px] text-slate-600">
                                  <span className="font-bold flex items-center gap-1 text-[#075E54]">
                                    <Volume2 className="w-3.5 h-3.5" />
                                    Offline Piper Hindi Voice Note
                                  </span>
                                  <span className="font-mono text-slate-400">Air-gapped Local WAV</span>
                                </div>
                                <audio
                                  controls
                                  src={`http://localhost:8000${msg.audio_url}`}
                                  className="w-full h-8 mt-0.5"
                                />
                              </div>

                              {/* Status / Actions */}
                              {msg.status === "DONE" ? (
                                <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-2 rounded-xl text-xs flex items-center justify-between">
                                  <span className="font-bold flex items-center gap-1.5">
                                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                                    Completed by Frontline Staff ({msg.response})
                                  </span>
                                  <span className="text-[10px] font-mono text-emerald-700">{msg.responded_at}</span>
                                </div>
                              ) : msg.status === "CANNOT" ? (
                                <div className="bg-rose-50 border border-rose-200 text-rose-800 p-2 rounded-xl text-xs space-y-1">
                                  <div className="font-bold flex items-center gap-1.5 text-rose-950">
                                    <X className="w-4 h-4 text-rose-600" />
                                    Frontline Barrier Logged:
                                  </div>
                                  <p className="text-[11px] leading-tight text-rose-800">{msg.refusal_reason}</p>
                                </div>
                              ) : (
                                <div className="flex items-center gap-2 pt-1 border-t border-slate-100">
                                  <button
                                    onClick={() => onMarkDone(msg.task_id)}
                                    className="flex-1 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl transition flex items-center justify-center gap-1 shadow-xs"
                                  >
                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                    Mark Done
                                  </button>
                                  <button
                                    onClick={() => setCannotModalTaskId(msg.task_id)}
                                    className="px-3 py-1.5 bg-white hover:bg-rose-50 text-rose-700 border border-rose-300 font-bold text-xs rounded-xl transition flex items-center gap-1"
                                  >
                                    <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                                    Cannot Do
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Cannot Do Modal */}
      {cannotModalTaskId && (
        <div className="fixed inset-0 z-60 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-slate-200 space-y-3">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600" />
              Report Frontline Barrier
            </h3>
            <p className="text-xs text-slate-600">
              Select or describe why this task cannot be completed before the deadline:
            </p>
            <select
              value={cannotReason}
              onChange={(e) => setCannotReason(e.target.value)}
              className="w-full text-xs p-2 bg-slate-50 border border-slate-300 rounded-xl font-medium"
            >
              <option value="Patient not at bed (in diagnostic scan)">Patient not at bed (in diagnostic scan)</option>
              <option value="Caregiver not present / in transit">Caregiver not present / in transit</option>
              <option value="Stat lab specimen rejected / hemolyzed">Stat lab specimen rejected / hemolyzed</option>
              <option value="Awaiting attending surgeon verbal consent">Awaiting attending surgeon verbal consent</option>
            </select>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setCannotModalTaskId(null)}
                className="px-3 py-1.5 bg-slate-100 text-slate-700 text-xs font-bold rounded-xl"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  onCannotDo(cannotModalTaskId, cannotReason);
                  setCannotModalTaskId(null);
                }}
                className="px-3 py-1.5 bg-rose-600 text-white text-xs font-bold rounded-xl"
              >
                Log Barrier
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
