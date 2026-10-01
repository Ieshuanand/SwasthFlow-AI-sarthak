"use client";

import React, { useState } from "react";
import {
  HeartPulse,
  Activity,
  Clock,
  User,
  CheckCircle2,
  Receipt,
  ShieldCheck,
  Ambulance,
  Bed,
  Download,
  Stethoscope,
  Info,
  Phone,
  ArrowRight,
} from "lucide-react";
import {
  DashShell,
  DashHeadline,
  DialGauge,
  DashSectionTitle,
  SquareIconButton,
  TodayRow,
  DateTile,
  TaskList,
  StatWidget,
  Badge,
  KpiStrip,
  TabDeck,
  BarChart,
  OK,
  MUTED,
  ACCENT,
  type DashNavItem,
} from "./RoleDashboardShell";

type PatientTab = "JOURNEY" | "CARE" | "INTAKE" | "BILL";

interface PatientPortalShellProps {
  currentUserName: string;
  onEmergencyIntakeSubmit: (data: {
    name: string;
    age: number;
    gender: string;
    triage: "RED" | "YELLOW" | "GREEN";
    complaint: string;
    payer: string;
    eta: string;
  }) => string;
  onPreAdmissionSubmit: (data: {
    name: string;
    phone: string;
    procedure: string;
    ward_type: string;
    admission_date: string;
    doctor: string;
    preauth_no: string;
  }) => string;
  onLogout: () => void;
}

export function PatientPortalShell({
  currentUserName,
  onEmergencyIntakeSubmit,
  onPreAdmissionSubmit,
  onLogout
}: PatientPortalShellProps) {
  const [activeTab, setActiveTab] = useState<PatientTab>("JOURNEY");

  // Emergency Intake Form State
  const [erName, setErName] = useState("Kavita Rao");
  const [erAge, setErAge] = useState("54");
  const [erGender, setErGender] = useState("Female");
  const [erTriage, setErTriage] = useState<"RED" | "YELLOW" | "GREEN">("YELLOW");
  const [erComplaint, setErComplaint] = useState("Acute shortness of breath and chest tightness since 2 hours");
  const [erPayer, setErPayer] = useState("Star Health TPA");
  const [erEta, setErEta] = useState("10 mins (In Transit)");
  const [lastErTicket, setLastErTicket] = useState<string | null>(null);

  // Scheduled Admission Form State
  const [admName, setAdmName] = useState("Rameshwar Verma");
  const [admPhone, setAdmPhone] = useState("+91 98401 55678");
  const [admProcedure, setAdmProcedure] = useState("Elective Laparoscopic Cholecystectomy");
  const [admWard, setAdmWard] = useState("Ward A (Semi-Private)");
  const [admDate, setAdmDate] = useState("Tomorrow, 08:30 AM");
  const [admDoctor, setAdmDoctor] = useState("Dr. Anand Sharma");
  const [admPreauth, setAdmPreauth] = useState("TPA-PREAUTH-77391");
  const [lastAdmTicket, setLastAdmTicket] = useState<string | null>(null);

  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const handleERSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!erName.trim()) return;
    const ticketId = onEmergencyIntakeSubmit({
      name: erName,
      age: parseInt(erAge) || 45,
      gender: erGender,
      triage: erTriage,
      complaint: erComplaint,
      payer: erPayer,
      eta: erEta,
    });
    setLastErTicket(ticketId);
    setToastMsg(`Emergency Intake ticket ${ticketId} dispatched to Hospital ER Triage.`);
  };

  const handleAdmSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!admName.trim()) return;
    const ticketId = onPreAdmissionSubmit({
      name: admName,
      phone: admPhone,
      procedure: admProcedure,
      ward_type: admWard,
      admission_date: admDate,
      doctor: admDoctor,
      preauth_no: admPreauth,
    });
    setLastAdmTicket(ticketId);
    setToastMsg(`Pre-Admission ticket ${ticketId} registered. Bed staging reserved.`);
  };

  // Shared input styling for the dark terminal theme
  const inputCls =
    "w-full px-3 py-2 bg-white/5 border border-white/15 text-white text-xs focus:outline-none focus:border-[#fb923c] transition placeholder:text-slate-600 normal-case";
  const labelCls = "block text-slate-400 font-bold mb-1 uppercase tracking-wider text-[10px]";

  const nav: DashNavItem[] = [
    { id: "JOURNEY", label: "Recovery Journey", Icon: Activity },
    { id: "CARE", label: "Care Team & Checklist", Icon: Stethoscope },
    { id: "INTAKE", label: "Emergency & Admission", Icon: Ambulance, badge: lastErTicket || lastAdmTicket ? "✓" : undefined },
    { id: "BILL", label: "Bill Estimate", Icon: Receipt, badge: "#6" },
  ];
  const goTab = (id: string) => setActiveTab(id as PatientTab);

  return (
    <DashShell
      brandTitle="SwasthAI"
      BrandIcon={HeartPulse}
      identity={{ name: currentUserName, sub: "Patient & Caregiver", emoji: "🧑‍🤝‍🧑" }}
      nav={nav}
      activeId={activeTab}
      onSelect={goTab}
      searchPlaceholder="Find a section..."
      searchIndex={[
        { label: "Recovery milestones", sub: "Vitals, oral meds, doctor round", tab: "JOURNEY" },
        { label: "Dr. Anand Sharma", sub: "Attending consultant", tab: "CARE" },
        { label: "Sister Sunita K.", sub: "Ward sister", tab: "CARE" },
        { label: "Discharge checklist", sub: "What the family needs to do", tab: "CARE" },
        { label: "Emergency intake", sub: "Alert the ER before arrival", tab: "INTAKE" },
        { label: "Pre-admission", sub: "Reserve a bed for a planned stay", tab: "INTAKE" },
        { label: "Bill estimate", sub: "Itemized costs and insurance", tab: "BILL" },
        { label: "Download statement", sub: "PDF of the estimate", tab: "BILL" },
      ]}
      groups={[
        {
          title: "Get Help",
          items: [
            { id: "call", label: "Call Hospital", Icon: Phone, hint: "+91 800-SWASTH", onClick: () => { window.location.href = "tel:+91800792784"; } },
            { id: "er", label: "Emergency Intake", Icon: Ambulance, hint: "Alert the ER team", onClick: () => setActiveTab("INTAKE") },
            { id: "statement", label: "Get Statement", Icon: Download, hint: "Send the bill estimate to your phone", onClick: () => { setActiveTab("BILL"); setToastMsg("Itemized estimate statement generated and sent to registered mobile."); } },
          ],
        },
      ]}
      sidebarFooter={
        <button
          onClick={onLogout}
          className="w-full h-11 flex items-center justify-center gap-2 border border-white/15 text-slate-300 hover:text-black hover:bg-rose-500 hover:border-rose-500 text-xs font-bold uppercase tracking-wider transition"
        >
          <User className="w-4 h-4" /> Switch Role / Logout
        </button>
      }
      breadcrumb={["Home", "Patient", nav.find(n => n.id === activeTab)?.label ?? ""]}
      headerRight={
        <div className="flex items-center gap-2 flex-wrap">
          <span className="px-2.5 h-8 inline-flex items-center text-[10px] font-bold uppercase tracking-wider bg-emerald-400/10 text-emerald-400 border border-emerald-400/30">
            ● Live Inpatient Episode
          </span>
          <span className="px-2.5 h-8 inline-flex items-center text-[11px] font-mono bg-white/5 text-slate-400 border border-white/10 normal-case">
            Hospital ID: #SRM-PT-2026-904
          </span>
        </div>
      }
    >
      {/* Toast Notification */}
      {toastMsg && (
        <div className="bg-emerald-400/10 border border-emerald-400/30 text-emerald-300 px-4 py-3 flex items-center justify-between text-sm animate-fade-in normal-case">
          <div className="flex items-center gap-2 font-medium">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
            {toastMsg}
          </div>
          <button
            onClick={() => setToastMsg(null)}
            className="text-emerald-400 hover:text-white text-[10px] font-bold uppercase tracking-wider"
          >
            Dismiss
          </button>
        </div>
      )}

      <div className="space-y-3">
        <DashHeadline
          line1="Welcome,"
          line2={<span className="text-slate-300 font-bold">{currentUserName}</span>}
          line3="Home Tomorrow 11:30"
          aside={<DialGauge value={0.92} label="Discharge Readiness" color={OK} />}
        />
        <p className="text-sm text-slate-400 max-w-2xl leading-relaxed normal-case">
          Real-time recovery tracking, pre-admission staging, and transparent price estimations eliminating discharge anxiety.
        </p>
      </div>

      <div>
        <DashSectionTitle title="Before Going Home" count={3} total={4}>
          <SquareIconButton Icon={Receipt} label="Open bill estimate" onClick={() => setActiveTab("BILL")} />
          <SquareIconButton Icon={ArrowRight} label="Open care team and checklist" onClick={() => setActiveTab("CARE")} />
        </DashSectionTitle>
        <TodayRow>
          <DateTile />
          <TaskList
            tasks={[
              { id: "vehicle", label: "Arrange transport", meta: "Family car or transit vehicle for 11:45 AM", onOpen: () => setActiveTab("CARE") },
              { id: "id", label: "ID proof verified", meta: "Original government ID at reception", done: true, onOpen: () => setActiveTab("CARE") },
              { id: "tpa", label: "Insurance approved", meta: "Star Health pre-auth ₹35,000", done: true, onOpen: () => setActiveTab("BILL") },
            ]}
          />
          <StatWidget
            title="Estimated Bill"
            onOpen={() => setActiveTab("BILL")}
            chart={
              <BarChart
                height={90}
                data={[
                  { label: "Low", value: 38.5, color: MUTED, hint: "Lower bound (P10): ₹38,500" },
                  { label: "Likely", value: 42.2, color: ACCENT, hint: "Projected estimate: ₹42,200" },
                  { label: "High", value: 46.8, color: MUTED, hint: "Upper bound (P90): ₹46,800" },
                ]}
                unit="k"
              />
            }
            badge={<Badge tone="ok">₹7,200 to pay at discharge</Badge>}
          />
        </TodayRow>
      </div>

      {/* Quick Patient Snapshot */}
      <KpiStrip
        items={[
          { label: "Patient", value: <span className="text-lg normal-case">Sunita Devi</span>, sub: "52y / F" },
          { label: "Bed & Ward", value: <span className="text-lg normal-case">B-104</span>, sub: "Ward A" },
          { label: "Consultant", value: <span className="text-lg normal-case">Dr. Sharma</span>, sub: "Medicine" },
          { label: "Discharge", value: <span className="text-lg normal-case">Tomorrow</span>, sub: "11:30 AM", color: OK },
        ]}
      />

      <TabDeck tabs={nav} active={activeTab} onChange={goTab}>
      {/* TAB 1: RECOVERY JOURNEY & MILESTONES */}
      {activeTab === "JOURNEY" && (
        <div className="p-5 sm:p-6 space-y-6">
          {/* Recovery Progress Bar */}
          <div className="bg-[#0a0a0a] p-6 border border-white/10 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-bold text-white flex items-center gap-2 uppercase tracking-tight">
                  <Activity className="w-5 h-5 text-[#fb923c]" />
                  Clinical Recovery Trajectory (Day 3 of Inpatient Stay)
                </h2>
                <p className="text-xs text-slate-500 mt-0.5 normal-case">
                  Diagnosis: Acute Exacerbation of Bronchial Asthma &bull; Continuous multiparameter telemetry monitoring
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Discharge Readiness:</span>
                <span className="px-2.5 py-1 text-xs font-bold bg-emerald-400/10 text-emerald-400 border border-emerald-400/30">
                  92% Ready
                </span>
              </div>
            </div>

            {/* Stepper Timeline */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-2">
              <div className="p-4 border border-emerald-400/30 bg-emerald-400/5 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">Step 1 &bull; Complete</span>
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                </div>
                <h3 className="font-bold text-white text-sm uppercase tracking-tight">Vitals Normalization</h3>
                <p className="text-xs text-slate-400 normal-case">
                  BP: 120/80 mmHg &bull; SpO2: 98% room air &bull; Pulse: 72 bpm steady.
                </p>
              </div>

              <div className="p-4 border border-emerald-400/30 bg-emerald-400/5 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">Step 2 &bull; Complete</span>
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                </div>
                <h3 className="font-bold text-white text-sm uppercase tracking-tight">Oral Step-Down</h3>
                <p className="text-xs text-slate-400 normal-case">
                  IV bronchodilators stopped. Oral maintenance medication tolerated well.
                </p>
              </div>

              <div className="p-4 border border-[#fb923c]/40 bg-[#fb923c]/5 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#fb923c]">Step 3 &bull; In Progress</span>
                  <Activity className="w-4 h-4 text-[#fb923c] animate-pulse" />
                </div>
                <h3 className="font-bold text-white text-sm uppercase tracking-tight">Doctor Bedside Round</h3>
                <p className="text-xs text-slate-400 normal-case">
                  Dr. Anand Sharma bedside round scheduled at 10:30 AM today for clinical review.
                </p>
              </div>

              <div className="p-4 border border-white/10 bg-white/5 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Step 4 &bull; Pending</span>
                  <Clock className="w-4 h-4 text-slate-500" />
                </div>
                <h3 className="font-bold text-white text-sm uppercase tracking-tight">Discharge Summary &amp; Bill</h3>
                <p className="text-xs text-slate-400 normal-case">
                  Cashier billing queue eliminated. TPA approval initiated prior to rounds.
                </p>
              </div>
            </div>
          </div>

        </div>
      )}

      {/* TAB 2: CARE TEAM & FAMILY DISCHARGE CHECKLIST */}
      {activeTab === "CARE" && (
        <div className="p-5 sm:p-6 space-y-6">
          {/* Caregiver Advice & Support Card */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-[#0a0a0a] p-5 border border-white/10 space-y-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2 uppercase tracking-tight">
                <Stethoscope className="w-4 h-4 text-[#fb923c]" />
                Attending Clinical Team
              </h3>
              <div className="space-y-3 text-xs">
                <div className="flex items-center justify-between p-3 bg-white/5 border border-white/10">
                  <div>
                    <div className="font-bold text-white normal-case">Dr. Anand Sharma, MD</div>
                    <div className="text-slate-400 normal-case">Chief Consultant Physician &bull; Internal Medicine</div>
                  </div>
                  <span className="px-2 py-0.5 bg-[#fb923c]/10 text-[#fb923c] border border-[#fb923c]/30 text-[10px] font-bold uppercase tracking-wider">On Duty</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-white/5 border border-white/10">
                  <div>
                    <div className="font-bold text-white normal-case">Sister Sunita K. (RN)</div>
                    <div className="text-slate-400 normal-case">Primary Ward Sister &bull; Ward A Station</div>
                  </div>
                  <span className="px-2 py-0.5 bg-emerald-400/10 text-emerald-400 border border-emerald-400/30 text-[10px] font-bold uppercase tracking-wider">Stationed</span>
                </div>
              </div>
            </div>

            <div className="bg-[#0a0a0a] p-5 border border-white/10 space-y-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2 uppercase tracking-tight">
                <Info className="w-4 h-4 text-[#fb923c]" />
                Discharge Preparation Checklist for Family
              </h3>
              <ul className="text-xs text-slate-400 space-y-2 normal-case">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                  <span>Original government ID proof verified at reception.</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                  <span>Star Health Insurance pre-authorization approved for ₹35,000.</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                  <span>Take-home inhaler and oral medication instructions demonstrated by nursing.</span>
                </li>
                <li className="flex items-center gap-2 text-slate-200 font-semibold">
                  <Clock className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                  <span>Family car or patient transit vehicle scheduled for 11:45 AM.</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: EMERGENCY INTAKE & SCHEDULED PRE-ADMISSION */}
      {activeTab === "INTAKE" && (
        <div className="p-5 sm:p-6 space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* SUBMISSION FORM 1: RAPID EMERGENCY INTAKE */}
            <div className="bg-[#0a0a0a] p-6 border border-white/10 space-y-4">
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-rose-500/10 text-rose-400 border border-rose-500/30">
                    <Ambulance className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-white uppercase tracking-tight">Rapid Emergency Intake</h2>
                    <p className="text-[11px] text-slate-500 normal-case">Alerts ER Triage &amp; Bed Allocator before arrival</p>
                  </div>
                </div>
                <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-rose-500/10 text-rose-400 border border-rose-500/30">
                  Direct to ER
                </span>
              </div>

              {lastErTicket && (
                <div className="p-3 bg-emerald-400/5 border border-emerald-400/30 text-xs text-emerald-300 flex items-center justify-between normal-case">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>Active Ticket: <strong>{lastErTicket}</strong> &bull; Priority ER Team Notified</span>
                  </div>
                  <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider bg-emerald-400/10 px-2 py-0.5">Queued</span>
                </div>
              )}

              <form onSubmit={handleERSubmit} className="space-y-3 text-xs">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>Patient Name</label>
                    <input
                      type="text"
                      value={erName}
                      onChange={e => setErName(e.target.value)}
                      required
                      className={inputCls}
                      placeholder="e.g. Kavita Rao"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className={labelCls}>Age</label>
                      <input
                        type="number"
                        value={erAge}
                        onChange={e => setErAge(e.target.value)}
                        className={inputCls}
                      />
                    </div>
                    <div>
                      <label className={labelCls}>Gender</label>
                      <select
                        value={erGender}
                        onChange={e => setErGender(e.target.value)}
                        className={inputCls}
                      >
                        <option>Female</option>
                        <option>Male</option>
                        <option>Other</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div>
                  <label className={labelCls}>Triage Severity</label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setErTriage("RED")}
                      className={`p-2 border text-center font-bold text-[11px] uppercase tracking-wider transition ${
                        erTriage === "RED"
                          ? "bg-rose-500 text-[#0a0a0a] border-rose-500"
                          : "bg-rose-500/5 text-rose-400 border-rose-500/30 hover:bg-rose-500/10"
                      }`}
                    >
                      🔴 Red (Critical)
                    </button>
                    <button
                      type="button"
                      onClick={() => setErTriage("YELLOW")}
                      className={`p-2 border text-center font-bold text-[11px] uppercase tracking-wider transition ${
                        erTriage === "YELLOW"
                          ? "bg-amber-400 text-[#0a0a0a] border-amber-400"
                          : "bg-amber-400/5 text-amber-400 border-amber-400/30 hover:bg-amber-400/10"
                      }`}
                    >
                      🟡 Yellow (Urgent)
                    </button>
                    <button
                      type="button"
                      onClick={() => setErTriage("GREEN")}
                      className={`p-2 border text-center font-bold text-[11px] uppercase tracking-wider transition ${
                        erTriage === "GREEN"
                          ? "bg-emerald-500 text-[#0a0a0a] border-emerald-500"
                          : "bg-emerald-400/5 text-emerald-400 border-emerald-400/30 hover:bg-emerald-400/10"
                      }`}
                    >
                      🟢 Green (Mild)
                    </button>
                  </div>
                </div>

                <div>
                  <label className={labelCls}>Primary Symptoms / Chief Complaint</label>
                  <textarea
                    rows={2}
                    value={erComplaint}
                    onChange={e => setErComplaint(e.target.value)}
                    required
                    className={inputCls}
                    placeholder="Describe main emergency symptoms..."
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>Insurance / Payer</label>
                    <select
                      value={erPayer}
                      onChange={e => setErPayer(e.target.value)}
                      className={inputCls}
                    >
                      <option>Star Health TPA</option>
                      <option>Ayushman Bharat (PM-JAY)</option>
                      <option>HDFC ERGO Health</option>
                      <option>Direct Cash / Self-Pay</option>
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Estimated Arrival</label>
                    <select
                      value={erEta}
                      onChange={e => setErEta(e.target.value)}
                      className={inputCls}
                    >
                      <option>Arrived at Triage Desk</option>
                      <option>10 mins (In Transit)</option>
                      <option>20 mins (In Transit)</option>
                      <option>30+ mins (In Transit)</option>
                    </select>
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 px-4 bg-rose-500 hover:bg-white text-[#0a0a0a] font-bold text-[11px] uppercase tracking-wider transition flex items-center justify-center gap-2 mt-2"
                >
                  <Ambulance className="w-4 h-4" />
                  <span>Submit Emergency Intake to ER Staff Queue</span>
                </button>
              </form>
            </div>

            {/* SUBMISSION FORM 2: SCHEDULED PRE-ADMISSION */}
            <div className="bg-[#0a0a0a] p-6 border border-white/10 space-y-4">
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-[#fb923c]/10 text-[#fb923c] border border-[#fb923c]/30">
                    <Bed className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-white uppercase tracking-tight">Scheduled Admission Pre-Registration</h2>
                    <p className="text-[11px] text-slate-500 normal-case">Reserves bed staging &amp; pre-authorizes insurance</p>
                  </div>
                </div>
                <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-[#fb923c]/10 text-[#fb923c] border border-[#fb923c]/30">
                  Elective Flow
                </span>
              </div>

              {lastAdmTicket && (
                <div className="p-3 bg-emerald-400/5 border border-emerald-400/30 text-xs text-emerald-300 flex items-center justify-between normal-case">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>Booking: <strong>{lastAdmTicket}</strong> &bull; Bed Reserved in Ward A</span>
                  </div>
                  <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider bg-emerald-400/10 px-2 py-0.5">Reserved</span>
                </div>
              )}

              <form onSubmit={handleAdmSubmit} className="space-y-3 text-xs">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>Patient Full Name</label>
                    <input
                      type="text"
                      value={admName}
                      onChange={e => setAdmName(e.target.value)}
                      required
                      className={inputCls}
                      placeholder="e.g. Rameshwar Verma"
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Contact Phone</label>
                    <input
                      type="text"
                      value={admPhone}
                      onChange={e => setAdmPhone(e.target.value)}
                      required
                      className={inputCls}
                    />
                  </div>
                </div>

                <div>
                  <label className={labelCls}>Planned Procedure / Specialty</label>
                  <input
                    type="text"
                    value={admProcedure}
                    onChange={e => setAdmProcedure(e.target.value)}
                    required
                    className={inputCls}
                    placeholder="e.g. Laparoscopic Surgery, Angiogram"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>Preferred Accommodation</label>
                    <select
                      value={admWard}
                      onChange={e => setAdmWard(e.target.value)}
                      className={inputCls}
                    >
                      <option>Ward A (Semi-Private)</option>
                      <option>Ward B (General Inpatient)</option>
                      <option>Private Deluxe Suite</option>
                      <option>ICU Post-Operative Bed</option>
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Admission Target Time</label>
                    <input
                      type="text"
                      value={admDate}
                      onChange={e => setAdmDate(e.target.value)}
                      className={inputCls}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>Attending Consultant</label>
                    <select
                      value={admDoctor}
                      onChange={e => setAdmDoctor(e.target.value)}
                      className={inputCls}
                    >
                      <option>Dr. Anand Sharma</option>
                      <option>Dr. S. Rao (Cardio)</option>
                      <option>Dr. K. Patel (Ortho)</option>
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Pre-Auth / Policy Number</label>
                    <input
                      type="text"
                      value={admPreauth}
                      onChange={e => setAdmPreauth(e.target.value)}
                      className={inputCls}
                      placeholder="e.g. TPA-PREAUTH-77391"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 px-4 bg-[#fb923c] hover:bg-white text-[#0a0a0a] font-bold text-[11px] uppercase tracking-wider transition flex items-center justify-center gap-2 mt-2"
                >
                  <Bed className="w-4 h-4" />
                  <span>Pre-Register Admission &amp; Reserve Bed Staging</span>
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: FINANCIAL TRANSPARENCY & GUARDRAIL #6 BILL ESTIMATE */}
      {activeTab === "BILL" && (
        <div className="p-5 sm:p-6 space-y-6">
          <div className="bg-[#0a0a0a] p-6 border border-white/10 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <Receipt className="w-5 h-5 text-[#fb923c]" />
                  <h2 className="text-sm font-bold text-white uppercase tracking-tight">
                    Transparent Inpatient Price Estimation
                  </h2>
                  <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-[#fb923c]/10 text-[#fb923c] border border-[#fb923c]/30">
                    🛡️ Guardrail #6: &plusmn;10% Empirical Bounded
                  </span>
                </div>
                <p className="text-xs text-slate-500 normal-case">
                  Eliminating afternoon cashier queues with proactive, itemized price transparency before discharge rounds.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setToastMsg("Itemized estimate statement generated and sent to registered mobile.")}
                className="px-4 py-2 bg-[#fb923c] hover:bg-white text-[#0a0a0a] text-[11px] font-bold uppercase tracking-wider transition flex items-center gap-2 flex-shrink-0"
              >
                <Download className="w-4 h-4" />
                <span>Download Statement (PDF)</span>
              </button>
            </div>

            {/* Bounded Envelope Highlight */}
            <div className="bg-white/5 p-5 border border-white/10 grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
              <div className="bg-[#111] p-4 border border-white/10">
                <span className="text-[10px] font-bold text-slate-500 block uppercase tracking-wider">Lower Bound (P10)</span>
                <span className="text-xl font-bold text-slate-300">₹38,500</span>
                <span className="text-[10px] text-slate-500 block mt-0.5 normal-case">Minimal medication scenario</span>
              </div>
              <div className="bg-[#111] p-4 border border-[#fb923c]/40">
                <span className="text-[10px] font-bold text-[#fb923c] block uppercase tracking-wider">Projected Point Estimate</span>
                <span className="text-2xl font-bold text-white">₹42,200</span>
                <span className="text-[10px] text-emerald-400 font-bold block mt-0.5 normal-case">Empirical Median Expected</span>
              </div>
              <div className="bg-[#111] p-4 border border-white/10">
                <span className="text-[10px] font-bold text-slate-500 block uppercase tracking-wider">Upper Bound (P90)</span>
                <span className="text-xl font-bold text-slate-300">₹46,800</span>
                <span className="text-[10px] text-slate-500 block mt-0.5 normal-case">Max expected pharmacy usage</span>
              </div>
            </div>

            {/* Where the money goes — chart of the itemized categories */}
            <div className="space-y-3">
              <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Where The Money Goes (₹ thousands)
              </h3>
              <BarChart
                height={150}
                unit="k"
                data={[
                  { label: "Room", value: 10.5, hint: "Room & Nursing: ₹10,500" },
                  { label: "Doctor", value: 4.5, hint: "Consultant rounds: ₹4,500" },
                  { label: "Lab", value: 6.2, hint: "Laboratory & phlebotomy: ₹6,200" },
                  { label: "Pharmacy", value: 14.2, hint: "Pharmacy & nebulization: ₹14,200" },
                  { label: "Sanitation", value: 3.6, hint: "Sanitization & bio-safety: ₹3,600" },
                ]}
              />
            </div>

            {/* Itemized Table Breakdown */}
            <div className="space-y-3">
              <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Itemized Cost Breakdown (As of Day 3 of Stay)
              </h3>
              <div className="border border-white/10 overflow-hidden text-xs">
                <table className="w-full text-left">
                  <thead className="bg-white/5 text-slate-400 border-b border-white/10 font-bold uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="py-2.5 px-4">Service Category</th>
                      <th className="py-2.5 px-4">Unit / Details</th>
                      <th className="py-2.5 px-4 text-right">Incurred Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/10 text-slate-300 normal-case">
                    <tr>
                      <td className="py-2.5 px-4 font-semibold text-white">Room &amp; Nursing Charges</td>
                      <td className="py-2.5 px-4 text-slate-400">3 Nights &bull; Semi-Private Ward A</td>
                      <td className="py-2.5 px-4 text-right font-mono">₹10,500</td>
                    </tr>
                    <tr>
                      <td className="py-2.5 px-4 font-semibold text-white">Attending Consultant Bedside Rounds</td>
                      <td className="py-2.5 px-4 text-slate-400">3 Daily Physician Assessments (Dr. Sharma)</td>
                      <td className="py-2.5 px-4 text-right font-mono">₹4,500</td>
                    </tr>
                    <tr>
                      <td className="py-2.5 px-4 font-semibold text-white">Diagnostic Laboratory &amp; Phlebotomy</td>
                      <td className="py-2.5 px-4 text-slate-400">CBC, Electrolytes, Arterial Blood Gas, CRP</td>
                      <td className="py-2.5 px-4 text-right font-mono">₹6,200</td>
                    </tr>
                    <tr>
                      <td className="py-2.5 px-4 font-semibold text-white">Inpatient Pharmacy &amp; Nebulization</td>
                      <td className="py-2.5 px-4 text-slate-400">IV Corticosteroids, Bronchodilators &amp; Saline</td>
                      <td className="py-2.5 px-4 text-right font-mono">₹14,200</td>
                    </tr>
                    <tr>
                      <td className="py-2.5 px-4 font-semibold text-white">Facility Sanitization &amp; Bio-Safety</td>
                      <td className="py-2.5 px-4 text-slate-400">Terminal Disinfection &amp; PPE consumables</td>
                      <td className="py-2.5 px-4 text-right font-mono">₹3,600</td>
                    </tr>
                    <tr className="bg-white/5 font-bold text-white">
                      <td className="py-2.5 px-4" colSpan={2}>Gross Inpatient Subtotal</td>
                      <td className="py-2.5 px-4 text-right font-mono">₹39,000</td>
                    </tr>
                    <tr className="text-emerald-400 bg-emerald-400/5">
                      <td className="py-2.5 px-4 font-semibold" colSpan={2}>
                        Less: Star Health TPA Approved Cashless Pre-Auth
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono font-bold">-₹35,000</td>
                    </tr>
                    <tr className="bg-[#fb923c] text-[#0a0a0a] font-bold">
                      <td className="py-3 px-4" colSpan={2}>
                        Estimated Out-of-Pocket Balance Payable at Discharge
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-sm">₹7,200</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Guardrail #6 Statutory Clinical Disclaimer */}
            <div className="bg-amber-400/5 border border-amber-400/30 p-4 text-xs text-amber-200 space-y-1">
              <div className="flex items-center gap-2 font-bold text-amber-300 uppercase tracking-wider text-[11px]">
                <ShieldCheck className="w-4 h-4 text-amber-400 flex-shrink-0" />
                Statutory Financial Disclaimer (Mandatory Regulatory Disclosure &bull; Guardrail #6)
              </div>
              <p className="text-[11px] text-amber-200/80 leading-relaxed normal-case">
                Notice: Estimates are calculated strictly within bounded empirical percentiles (P10 - P90) pursuant to the Clinical Establishments Act and IRDAI hospital price transparency directives. Actual final billing may adjust based on final doctor rounds, real-time pharmacy administration, or unforeseen emergency interventions. No unitemized administrative charges are levied.
              </p>
            </div>
          </div>
        </div>
      )}
      </TabDeck>
    </DashShell>
  );
}
