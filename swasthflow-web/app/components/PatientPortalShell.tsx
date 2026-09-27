"use client";

import React, { useState } from "react";
import {
  HeartPulse,
  Activity,
  Calendar,
  Clock,
  User,
  FileText,
  CheckCircle2,
  AlertTriangle,
  Receipt,
  ShieldCheck,
  Ambulance,
  Bed,
  Download,
  Phone,
  Stethoscope,
  Sparkles,
  ChevronRight,
  Info,
  ArrowRight
} from "lucide-react";

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
  const [activeTab, setActiveTab] = useState<"JOURNEY" | "INTAKE" | "BILL">("JOURNEY");

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

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Toast Notification */}
      {toastMsg && (
        <div className="bg-emerald-50 border border-emerald-300 text-emerald-900 px-4 py-3 rounded-xl flex items-center justify-between text-sm shadow-sm animate-fade-in">
          <div className="flex items-center gap-2 font-medium">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
            {toastMsg}
          </div>
          <button
            onClick={() => setToastMsg(null)}
            className="text-emerald-700 hover:text-emerald-900 text-xs font-bold"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Patient Hero Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-3xl p-6 sm:p-8 shadow-xl border border-indigo-800/40 relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 flex items-center gap-1.5">
                <HeartPulse className="w-3.5 h-3.5 text-rose-400" />
                Patient &amp; Caregiver Portal
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                ● Live Inpatient Episode
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-white/10 text-slate-300">
                Hospital ID: #SRM-PT-2026-904
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
              Welcome, {currentUserName}
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed">
              Real-time recovery tracking, pre-admission staging, and transparent price estimations eliminating discharge anxiety.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <button
              onClick={onLogout}
              className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-white text-xs font-bold transition flex items-center justify-center gap-2"
            >
              <User className="w-3.5 h-3.5" />
              <span>Switch Role / Logout</span>
            </button>
          </div>
        </div>

        {/* Quick Patient Snapshot Cards */}
        <div className="mt-6 pt-6 border-t border-white/10 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div className="bg-white/5 rounded-xl p-3 border border-white/10">
            <span className="text-slate-400 block text-[11px]">Patient Name</span>
            <span className="text-white font-bold text-sm">Sunita Devi (52y / F)</span>
          </div>
          <div className="bg-white/5 rounded-xl p-3 border border-white/10">
            <span className="text-slate-400 block text-[11px]">Bed &amp; Ward</span>
            <span className="text-white font-bold text-sm">Bed B-104 &bull; Ward A</span>
          </div>
          <div className="bg-white/5 rounded-xl p-3 border border-white/10">
            <span className="text-slate-400 block text-[11px]">Attending Consultant</span>
            <span className="text-white font-bold text-sm">Dr. Anand Sharma (Med)</span>
          </div>
          <div className="bg-white/5 rounded-xl p-3 border border-white/10">
            <span className="text-slate-400 block text-[11px]">Anticipated Discharge</span>
            <span className="text-emerald-300 font-bold text-sm">Tomorrow &bull; 11:30 AM</span>
          </div>
        </div>
      </div>

      {/* Internal Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => setActiveTab("JOURNEY")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
            activeTab === "JOURNEY"
              ? "bg-slate-900 text-white shadow-sm"
              : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
          }`}
        >
          <Activity className="w-4 h-4 text-emerald-500" />
          <span>Recovery Journey &amp; Milestones</span>
        </button>

        <button
          onClick={() => setActiveTab("INTAKE")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
            activeTab === "INTAKE"
              ? "bg-slate-900 text-white shadow-sm"
              : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
          }`}
        >
          <Ambulance className="w-4 h-4 text-rose-500" />
          <span>Emergency Intake &amp; Pre-Admission</span>
          {(lastErTicket || lastAdmTicket) && (
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
          )}
        </button>

        <button
          onClick={() => setActiveTab("BILL")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
            activeTab === "BILL"
              ? "bg-slate-900 text-white shadow-sm"
              : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
          }`}
        >
          <Receipt className="w-4 h-4 text-indigo-500" />
          <span>Financial Transparency &amp; Bill Estimate</span>
          <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-amber-100 text-amber-800">
            Guardrail #6
          </span>
        </button>
      </div>

      {/* TAB 1: RECOVERY JOURNEY & MILESTONES */}
      {activeTab === "JOURNEY" && (
        <div className="space-y-6">
          {/* Recovery Progress Bar */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Activity className="w-5 h-5 text-indigo-600" />
                  Clinical Recovery Trajectory (Day 3 of Inpatient Stay)
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Diagnosis: Acute Exacerbation of Bronchial Asthma &bull; Continuous multiparameter telemetry monitoring
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-700">Discharge Readiness:</span>
                <span className="px-2.5 py-1 rounded-full text-xs font-black bg-emerald-100 text-emerald-800 border border-emerald-300">
                  92% Ready
                </span>
              </div>
            </div>

            {/* Stepper Timeline */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-2">
              <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/50 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">Step 1 &bull; Complete</span>
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                </div>
                <h3 className="font-bold text-slate-900 text-sm">Vitals Normalization</h3>
                <p className="text-xs text-slate-600">
                  BP: 120/80 mmHg &bull; SpO2: 98% room air &bull; Pulse: 72 bpm steady.
                </p>
              </div>

              <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/50 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">Step 2 &bull; Complete</span>
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                </div>
                <h3 className="font-bold text-slate-900 text-sm">Oral Step-Down</h3>
                <p className="text-xs text-slate-600">
                  IV bronchodilators stopped. Oral maintenance medication tolerated well.
                </p>
              </div>

              <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/50 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">Step 3 &bull; In Progress</span>
                  <Activity className="w-4 h-4 text-indigo-600 animate-pulse" />
                </div>
                <h3 className="font-bold text-slate-900 text-sm">Doctor Bedside Round</h3>
                <p className="text-xs text-slate-600">
                  Dr. Anand Sharma bedside round scheduled at 10:30 AM today for clinical review.
                </p>
              </div>

              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Step 4 &bull; Pending</span>
                  <Clock className="w-4 h-4 text-slate-400" />
                </div>
                <h3 className="font-bold text-slate-900 text-sm">Discharge Summary &amp; Bill</h3>
                <p className="text-xs text-slate-600">
                  Cashier billing queue eliminated. TPA approval initiated prior to rounds.
                </p>
              </div>
            </div>
          </div>

          {/* Caregiver Advice & Support Card */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Stethoscope className="w-4 h-4 text-indigo-600" />
                Attending Clinical Team
              </h3>
              <div className="space-y-3 text-xs">
                <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <div>
                    <div className="font-bold text-slate-900">Dr. Anand Sharma, MD</div>
                    <div className="text-slate-500">Chief Consultant Physician &bull; Internal Medicine</div>
                  </div>
                  <span className="px-2 py-0.5 rounded bg-indigo-100 text-indigo-800 text-[10px] font-bold">On Duty</span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <div>
                    <div className="font-bold text-slate-900">Sister Sunita K. (RN)</div>
                    <div className="text-slate-500">Primary Ward Sister &bull; Ward A Station</div>
                  </div>
                  <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-bold">Stationed</span>
                </div>
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Info className="w-4 h-4 text-indigo-600" />
                Discharge Preparation Checklist for Family
              </h3>
              <ul className="text-xs text-slate-600 space-y-2">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                  <span>Original government ID proof verified at reception.</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                  <span>Star Health Insurance pre-authorization approved for ₹35,000.</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                  <span>Take-home inhaler and oral medication instructions demonstrated by nursing.</span>
                </li>
                <li className="flex items-center gap-2 text-slate-700 font-semibold">
                  <Clock className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
                  <span>Family car or patient transit vehicle scheduled for 11:45 AM.</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: EMERGENCY INTAKE & SCHEDULED PRE-ADMISSION */}
      {activeTab === "INTAKE" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* SUBMISSION FORM 1: RAPID EMERGENCY INTAKE */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-rose-50 text-rose-600 border border-rose-200">
                    <Ambulance className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-slate-900">Rapid Emergency Intake</h2>
                    <p className="text-[11px] text-slate-500">Alerts ER Triage &amp; Bed Allocator before arrival</p>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800">
                  Direct to ER
                </span>
              </div>

              {lastErTicket && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Active Ticket: <strong>{lastErTicket}</strong> &bull; Priority ER Team Notified</span>
                  </div>
                  <span className="text-[10px] font-bold text-emerald-700 uppercase bg-emerald-100 px-2 py-0.5 rounded">Queued</span>
                </div>
              )}

              <form onSubmit={handleERSubmit} className="space-y-3 text-xs">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-600 font-semibold mb-1">Patient Name</label>
                    <input
                      type="text"
                      value={erName}
                      onChange={e => setErName(e.target.value)}
                      required
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-rose-500/20 text-xs"
                      placeholder="e.g. Kavita Rao"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-slate-600 font-semibold mb-1">Age</label>
                      <input
                        type="number"
                        value={erAge}
                        onChange={e => setErAge(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-rose-500/20 text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-600 font-semibold mb-1">Gender</label>
                      <select
                        value={erGender}
                        onChange={e => setErGender(e.target.value)}
                        className="w-full px-2 py-2 rounded-lg border border-slate-200 text-xs"
                      >
                        <option>Female</option>
                        <option>Male</option>
                        <option>Other</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-slate-600 font-semibold mb-1">Triage Severity</label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setErTriage("RED")}
                      className={`p-2 rounded-lg border text-center font-bold text-xs transition ${
                        erTriage === "RED"
                          ? "bg-rose-600 text-white border-rose-700 shadow-xs"
                          : "bg-rose-50 text-rose-800 border-rose-200 hover:bg-rose-100"
                      }`}
                    >
                      🔴 Red (Critical)
                    </button>
                    <button
                      type="button"
                      onClick={() => setErTriage("YELLOW")}
                      className={`p-2 rounded-lg border text-center font-bold text-xs transition ${
                        erTriage === "YELLOW"
                          ? "bg-amber-500 text-white border-amber-600 shadow-xs"
                          : "bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100"
                      }`}
                    >
                      🟡 Yellow (Urgent)
                    </button>
                    <button
                      type="button"
                      onClick={() => setErTriage("GREEN")}
                      className={`p-2 rounded-lg border text-center font-bold text-xs transition ${
                        erTriage === "GREEN"
                          ? "bg-emerald-600 text-white border-emerald-700 shadow-xs"
                          : "bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100"
                      }`}
                    >
                      🟢 Green (Mild)
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-slate-600 font-semibold mb-1">Primary Symptoms / Chief Complaint</label>
                  <textarea
                    rows={2}
                    value={erComplaint}
                    onChange={e => setErComplaint(e.target.value)}
                    required
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-rose-500/20 text-xs"
                    placeholder="Describe main emergency symptoms..."
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-600 font-semibold mb-1">Insurance / Payer</label>
                    <select
                      value={erPayer}
                      onChange={e => setErPayer(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs"
                    >
                      <option>Star Health TPA</option>
                      <option>Ayushman Bharat (PM-JAY)</option>
                      <option>HDFC ERGO Health</option>
                      <option>Direct Cash / Self-Pay</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-slate-600 font-semibold mb-1">Estimated Arrival</label>
                    <select
                      value={erEta}
                      onChange={e => setErEta(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs"
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
                  className="w-full py-2.5 px-4 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl shadow-sm transition flex items-center justify-center gap-2 mt-2"
                >
                  <Ambulance className="w-4 h-4" />
                  <span>Submit Emergency Intake to ER Staff Queue</span>
                </button>
              </form>
            </div>

            {/* SUBMISSION FORM 2: SCHEDULED PRE-ADMISSION */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-200">
                    <Bed className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-slate-900">Scheduled Admission Pre-Registration</h2>
                    <p className="text-[11px] text-slate-500">Reserves bed staging &amp; pre-authorizes insurance</p>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-100 text-indigo-800">
                  Elective Flow
                </span>
              </div>

              {lastAdmTicket && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Booking: <strong>{lastAdmTicket}</strong> &bull; Bed Reserved in Ward A</span>
                  </div>
                  <span className="text-[10px] font-bold text-emerald-700 uppercase bg-emerald-100 px-2 py-0.5 rounded">Reserved</span>
                </div>
              )}

              <form onSubmit={handleAdmSubmit} className="space-y-3 text-xs">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-600 font-semibold mb-1">Patient Full Name</label>
                    <input
                      type="text"
                      value={admName}
                      onChange={e => setAdmName(e.target.value)}
                      required
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-xs"
                      placeholder="e.g. Rameshwar Verma"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 font-semibold mb-1">Contact Phone</label>
                    <input
                      type="text"
                      value={admPhone}
                      onChange={e => setAdmPhone(e.target.value)}
                      required
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-xs"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-slate-600 font-semibold mb-1">Planned Procedure / Specialty</label>
                  <input
                    type="text"
                    value={admProcedure}
                    onChange={e => setAdmProcedure(e.target.value)}
                    required
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-xs"
                    placeholder="e.g. Laparoscopic Surgery, Angiogram"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-600 font-semibold mb-1">Preferred Accommodation</label>
                    <select
                      value={admWard}
                      onChange={e => setAdmWard(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs"
                    >
                      <option>Ward A (Semi-Private)</option>
                      <option>Ward B (General Inpatient)</option>
                      <option>Private Deluxe Suite</option>
                      <option>ICU Post-Operative Bed</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-slate-600 font-semibold mb-1">Admission Target Time</label>
                    <input
                      type="text"
                      value={admDate}
                      onChange={e => setAdmDate(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-600 font-semibold mb-1">Attending Consultant</label>
                    <select
                      value={admDoctor}
                      onChange={e => setAdmDoctor(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs"
                    >
                      <option>Dr. Anand Sharma</option>
                      <option>Dr. S. Rao (Cardio)</option>
                      <option>Dr. K. Patel (Ortho)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-slate-600 font-semibold mb-1">Pre-Auth / Policy Number</label>
                    <input
                      type="text"
                      value={admPreauth}
                      onChange={e => setAdmPreauth(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs"
                      placeholder="e.g. TPA-PREAUTH-77391"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl shadow-sm transition flex items-center justify-center gap-2 mt-2"
                >
                  <Bed className="w-4 h-4 text-indigo-400" />
                  <span>Pre-Register Admission &amp; Reserve Bed Staging</span>
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: FINANCIAL TRANSPARENCY & GUARDRAIL #6 BILL ESTIMATE */}
      {activeTab === "BILL" && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Receipt className="w-5 h-5 text-indigo-600" />
                  <h2 className="text-base font-bold text-slate-900">
                    Transparent Inpatient Price Estimation
                  </h2>
                  <span className="px-2 py-0.5 rounded text-[10px] font-black bg-indigo-100 text-indigo-800 border border-indigo-200">
                    🛡️ Guardrail #6: &plusmn;10% Empirical Bounded
                  </span>
                </div>
                <p className="text-xs text-slate-500">
                  Eliminating afternoon cashier queues with proactive, itemized price transparency before discharge rounds.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setToastMsg("Itemized estimate statement generated and sent to registered mobile.")}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition flex items-center gap-2 flex-shrink-0"
              >
                <Download className="w-4 h-4 text-emerald-400" />
                <span>Download Statement (PDF)</span>
              </button>
            </div>

            {/* Bounded Envelope Highlight */}
            <div className="bg-gradient-to-r from-indigo-50 via-slate-50 to-blue-50 p-5 rounded-2xl border border-indigo-100 grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
                <span className="text-[11px] font-semibold text-slate-500 block uppercase">Lower Bound (P10)</span>
                <span className="text-xl font-bold text-slate-700">₹38,500</span>
                <span className="text-[10px] text-slate-400 block mt-0.5">Minimal medication scenario</span>
              </div>
              <div className="bg-white p-4 rounded-xl border border-indigo-300 shadow-sm ring-2 ring-indigo-500/20">
                <span className="text-[11px] font-bold text-indigo-600 block uppercase">Projected Point Estimate</span>
                <span className="text-2xl font-black text-slate-900">₹42,200</span>
                <span className="text-[10px] text-emerald-600 font-bold block mt-0.5">Empirical Median Expected</span>
              </div>
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
                <span className="text-[11px] font-semibold text-slate-500 block uppercase">Upper Bound (P90)</span>
                <span className="text-xl font-bold text-slate-700">₹46,800</span>
                <span className="text-[10px] text-slate-400 block mt-0.5">Max expected pharmacy usage</span>
              </div>
            </div>

            {/* Itemized Table Breakdown */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Itemized Cost Breakdown (As of Day 3 of Stay)
              </h3>
              <div className="border border-slate-200 rounded-xl overflow-hidden text-xs">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 font-bold">
                    <tr>
                      <th className="py-2.5 px-4">Service Category</th>
                      <th className="py-2.5 px-4">Unit / Details</th>
                      <th className="py-2.5 px-4 text-right">Incurred Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    <tr>
                      <td className="py-2.5 px-4 font-semibold text-slate-900">Room &amp; Nursing Charges</td>
                      <td className="py-2.5 px-4 text-slate-500">3 Nights &bull; Semi-Private Ward A</td>
                      <td className="py-2.5 px-4 text-right font-mono">₹10,500</td>
                    </tr>
                    <tr>
                      <td className="py-2.5 px-4 font-semibold text-slate-900">Attending Consultant Bedside Rounds</td>
                      <td className="py-2.5 px-4 text-slate-500">3 Daily Physician Assessments (Dr. Sharma)</td>
                      <td className="py-2.5 px-4 text-right font-mono">₹4,500</td>
                    </tr>
                    <tr>
                      <td className="py-2.5 px-4 font-semibold text-slate-900">Diagnostic Laboratory &amp; Phlebotomy</td>
                      <td className="py-2.5 px-4 text-slate-500">CBC, Electrolytes, Arterial Blood Gas, CRP</td>
                      <td className="py-2.5 px-4 text-right font-mono">₹6,200</td>
                    </tr>
                    <tr>
                      <td className="py-2.5 px-4 font-semibold text-slate-900">Inpatient Pharmacy &amp; Nebulization</td>
                      <td className="py-2.5 px-4 text-slate-500">IV Corticosteroids, Bronchodilators &amp; Saline</td>
                      <td className="py-2.5 px-4 text-right font-mono">₹14,200</td>
                    </tr>
                    <tr>
                      <td className="py-2.5 px-4 font-semibold text-slate-900">Facility Sanitization &amp; Bio-Safety</td>
                      <td className="py-2.5 px-4 text-slate-500">Terminal Disinfection &amp; PPE consumables</td>
                      <td className="py-2.5 px-4 text-right font-mono">₹3,600</td>
                    </tr>
                    <tr className="bg-slate-50/80 font-bold text-slate-900">
                      <td className="py-2.5 px-4" colSpan={2}>Gross Inpatient Subtotal</td>
                      <td className="py-2.5 px-4 text-right font-mono">₹39,000</td>
                    </tr>
                    <tr className="text-emerald-700 bg-emerald-50/50">
                      <td className="py-2.5 px-4 font-semibold" colSpan={2}>
                        Less: Star Health TPA Approved Cashless Pre-Auth
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono font-bold">-₹35,000</td>
                    </tr>
                    <tr className="bg-slate-900 text-white font-bold">
                      <td className="py-3 px-4" colSpan={2}>
                        Estimated Out-of-Pocket Balance Payable at Discharge
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-emerald-400 text-sm">₹7,200</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Guardrail #6 Statutory Clinical Disclaimer */}
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-xs text-amber-900 space-y-1">
              <div className="flex items-center gap-2 font-bold text-amber-800">
                <ShieldCheck className="w-4 h-4 text-amber-600 flex-shrink-0" />
                Statutory Financial Disclaimer (Mandatory Regulatory Disclosure &bull; Guardrail #6)
              </div>
              <p className="text-[11px] text-amber-800/90 leading-relaxed">
                Notice: Estimates are calculated strictly within bounded empirical percentiles (P10 - P90) pursuant to the Clinical Establishments Act and IRDAI hospital price transparency directives. Actual final billing may adjust based on final doctor rounds, real-time pharmacy administration, or unforeseen emergency interventions. No unitemized administrative charges are levied.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
