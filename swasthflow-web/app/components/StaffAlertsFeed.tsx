"use client";

import React, { useState, useEffect } from "react";
import { 
  Bell, 
  CheckCheck, 
  Filter, 
  MessageSquare, 
  X, 
  Clock, 
  FileText,
  ShieldCheck,
  Droplet,
  Bed
} from "lucide-react";
import { getSMSMessages } from "../services/smsService";

export interface StaffAlertNotification {
  id: string;
  recipient_role: "NURSE" | "DOCTOR" | "COORDINATOR" | "SUPPORT" | "PATIENT" | "ALL";
  recipient_name: string;
  recipient_phone?: string;
  alert_type: "PHLEBOTOMY" | "DISCHARGE_GATE" | "BED_TURNOVER" | "TPA_PREAUTH" | "ICU_STEPDOWN" | "ALERT_CAP" | "BLOOD_SHORTAGE" | "ICU_CAPACITY";
  severity: "CRITICAL" | "HIGH" | "ROUTINE";
  title: string;
  message_body: string;
  timestamp: string;
  status: "DELIVERED" | "READ";
  guardrail_tag: string;
  channel?: "WHATSAPP" | "SMS";
  action_tab?: string;
  action_section?: "blood" | "beds";
}

const INITIAL_ALERTS: StaffAlertNotification[] = [
  {
    id: "ALT-006",
    recipient_role: "COORDINATOR",
    recipient_name: "Operations Coordinator",
    recipient_phone: "+91 98222 33445",
    alert_type: "BLOOD_SHORTAGE",
    severity: "CRITICAL",
    title: "Regional Blood Deficit: O-negative Critical",
    message_body: "🩸 Critical Blood Shortage: SwasthAI Central has only 3 units of O-negative left (< 5 unit safety floor). Metro General Hospital (7.4 km) has 14 units available. View Regional Map →",
    timestamp: "07:45 AM",
    status: "DELIVERED",
    guardrail_tag: "Regional Balancing • Human Courier Gate",
    channel: "WHATSAPP",
    action_tab: "BLOOD_INVENTORY",
    action_section: "blood"
  },
  {
    id: "ALT-007",
    recipient_role: "COORDINATOR",
    recipient_name: "Emergency Bed Coordinator",
    recipient_phone: "+91 98222 33445",
    alert_type: "ICU_CAPACITY",
    severity: "CRITICAL",
    title: "ICU Bed Capacity Overflow (0 Available)",
    message_body: "⚠ ICU at capacity — no beds available. Regional network shows options nearby. Priority #1: Metro General Hospital (6 ICU beds free, 7.4 km away). View Regional Map →",
    timestamp: "08:05 AM",
    status: "DELIVERED",
    guardrail_tag: "Regional Bed Coordination • Human Approval Gate",
    channel: "SMS",
    action_tab: "BLOOD_INVENTORY",
    action_section: "beds"
  },
  {
    id: "ALT-001",
    recipient_role: "SUPPORT",
    recipient_name: "Hari Das (Phlebotomy)",
    recipient_phone: "+91 98765 43210",
    alert_type: "PHLEBOTOMY",
    severity: "HIGH",
    title: "Morning Fasting Draw Deadline",
    message_body: "Morning Fasting Phlebotomy for Bed 102 (Priya S.) backwards-scheduled before 08:00 AM breakfast deadline. Learned Lab P90 turnaround is 140 min so results will be ready for Dr. Rao's 09:15 AM surgical round.",
    timestamp: "06:25 AM",
    status: "DELIVERED",
    guardrail_tag: "Guardrail #3 (P90 Budgeting) & #4 (70% Confidence)",
    channel: "WHATSAPP"
  },
  {
    id: "ALT-002",
    recipient_role: "DOCTOR",
    recipient_name: "Dr. Sunita Rao",
    recipient_phone: "+91 98111 22334",
    alert_type: "DISCHARGE_GATE",
    severity: "CRITICAL",
    title: "Clinical Discharge Authorization Pending",
    message_body: "Patient Rajesh Verma (Bed 105) has completed oral antibiotic switch and vitals are stable for 18h. Discharge Radar p_discharge is 0.88. Awaiting your 1-tap clinical authorization to initiate pharmacy and TPA clearance.",
    timestamp: "07:10 AM",
    status: "DELIVERED",
    guardrail_tag: "Guardrail #1 (Doctor Decides Exclusively)",
    channel: "SMS"
  },
  {
    id: "ALT-003",
    recipient_role: "COORDINATOR",
    recipient_name: "Operations Coordinator",
    recipient_phone: "+91 98222 33445",
    alert_type: "TPA_PREAUTH",
    severity: "HIGH",
    title: "Early TPA Pre-Authorization Dispatch",
    message_body: "Medi Assist clearance for Bed 204 submitted prior to 10:00 AM. Learned P90 approval is 210 min. Early submission prevents afternoon billing counter bottlenecks.",
    timestamp: "07:35 AM",
    status: "DELIVERED",
    guardrail_tag: "Guardrail #3 (Learned Multi-Payer P90 Lead Times)",
    channel: "WHATSAPP"
  },
  {
    id: "ALT-004",
    recipient_role: "SUPPORT",
    recipient_name: "Ramesh Kumar (Housekeeping)",
    recipient_phone: "+91 98333 44556",
    alert_type: "BED_TURNOVER",
    severity: "ROUTINE",
    title: "Terminal Bed Sanitization Dispatched",
    message_body: "Bed 106 vacated by departed patient. Status: DIRTY. Sanitization team assigned. 30-minute turnaround clock started to prepare bed for incoming ER admission.",
    timestamp: "08:15 AM",
    status: "DELIVERED",
    guardrail_tag: "Guardrail #5 (Staff Alert Fatigue Cap: 4/10 tasks)",
    channel: "SMS"
  },
  {
    id: "ALT-005",
    recipient_role: "NURSE",
    recipient_name: "Staff Nurse In-Charge",
    recipient_phone: "+91 98444 55667",
    alert_type: "ICU_STEPDOWN",
    severity: "HIGH",
    title: "ICU Stepdown Family Consent Completed",
    message_body: "Caregiver for Bed ICU-02 signed GREEN stepdown consent following bilingual explanation script. Ward A Bed 108 reserved for transfer at 10:30 AM.",
    timestamp: "08:40 AM",
    status: "DELIVERED",
    guardrail_tag: "Guardrail #8 (Only GREEN Confirmed Enters Capacity)",
    channel: "WHATSAPP"
  }
];

interface StaffAlertsProps {
  currentRole: string;
  currentStaffName: string;
  onNavigateTab?: (tab: string, section?: "blood" | "beds") => void;
  icuAtCapacity?: boolean;
}

export function StaffAlertsDrawer({ currentRole, currentStaffName, onNavigateTab, icuAtCapacity }: StaffAlertsProps) {
  const [alerts, setAlerts] = useState<StaffAlertNotification[]>(INITIAL_ALERTS);
  const [isOpen, setIsOpen] = useState(false);
  const [showFullLog, setShowFullLog] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState<string>("ALL");
  const [channelFilter, setChannelFilter] = useState<"ALL" | "WHATSAPP" | "SMS">("ALL");

  const syncAlerts = () => {
    try {
      const stored = localStorage.getItem("swasthai_staff_alerts");
      const baseAlerts: StaffAlertNotification[] = stored ? JSON.parse(stored) : INITIAL_ALERTS;

      // Merge simulated SMS logs
      const smsLogs = getSMSMessages();
      const mappedSms: StaffAlertNotification[] = smsLogs.map(sms => ({
        id: sms.id,
        recipient_role: (sms.recipient_role as StaffAlertNotification["recipient_role"]) || "SUPPORT",
        recipient_name: sms.recipient_name,
        recipient_phone: sms.recipient,
        alert_type: "ALERT_CAP",
        severity: "HIGH",
        title: sms.title || "SMS Alert Dispatch",
        message_body: sms.body,
        timestamp: sms.timestamp,
        status: "DELIVERED",
        guardrail_tag: sms.guardrail_tag || "Guardrail #5 (Alert Fatigue Cap)",
        channel: "SMS"
      }));

      // Combine by ID deduplication
      const combined = [...baseAlerts];
      for (const m of mappedSms) {
        if (!combined.some(a => a.id === m.id)) {
          combined.unshift(m);
        }
      }

      setAlerts(combined);
      localStorage.setItem("swasthai_staff_alerts", JSON.stringify(combined));
    } catch {
      // Fallback
    }
  };

  useEffect(() => {
    syncAlerts();

    const handleSmsSent = () => {
      syncAlerts();
    };

    window.addEventListener("swasthai_sms_sent", handleSmsSent);
    return () => window.removeEventListener("swasthai_sms_sent", handleSmsSent);
  }, []);

  // Check for active blood and ICU capacity alerts
  const hasBloodAlert = alerts.some(a => a.alert_type === "BLOOD_SHORTAGE" && a.status === "DELIVERED");
  const hasIcuAlert = alerts.some(a => a.alert_type === "ICU_CAPACITY" && a.status === "DELIVERED") || icuAtCapacity;

  const unreadCount = alerts.filter(a => a.status === "DELIVERED").length;

  const handleMarkAllRead = () => {
    const updated = alerts.map(a => ({ ...a, status: "READ" as const }));
    setAlerts(updated);
    try {
      localStorage.setItem("swasthai_staff_alerts", JSON.stringify(updated));
    } catch {
      // Ignore
    }
  };

  const handleNavigate = (tab: string, section: "blood" | "beds") => {
    setIsOpen(false);
    setShowFullLog(false);
    if (onNavigateTab) {
      onNavigateTab(tab, section);
    }
    window.dispatchEvent(new CustomEvent("swasthai_navigate_regional_map", { detail: { section } }));
  };

  const filteredAlerts = alerts.filter(a => {
    const matchCategory = selectedFilter === "ALL" || a.alert_type === selectedFilter;
    const matchChannel = channelFilter === "ALL" || (a.channel || "WHATSAPP") === channelFilter;
    return matchCategory && matchChannel;
  });

  return (
    <>
      {/* Alert Bell Button with Distinct Red Droplet and Amber Bed Badges */}
      <div className="relative">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="relative px-3 py-1.5 rounded-full bg-white/90 hover:bg-white border border-slate-200 text-slate-700 shadow-sm transition flex items-center gap-1.5"
          title="Staff Alerts & Message Feed (WhatsApp & SMS)"
        >
          <Bell className="w-4 h-4 text-slate-600" />
          <span className="text-xs font-bold hidden sm:inline text-slate-700">Alerts</span>

          {/* Distinct Visual Indicator 1: Blood Shortage (Red Droplet) */}
          {hasBloodAlert && (
            <span 
              className="w-4 h-4 rounded-full bg-rose-600 text-white flex items-center justify-center p-0.5 shadow-xs"
              title="Active Alert: Blood Inventory Shortage"
            >
              <Droplet className="w-2.5 h-2.5 fill-white" />
            </span>
          )}

          {/* Distinct Visual Indicator 2: ICU Capacity Overflow (Amber Bed) */}
          {hasIcuAlert && (
            <span 
              className="w-4 h-4 rounded-full bg-amber-500 text-slate-950 flex items-center justify-center p-0.5 shadow-xs"
              title="Active Alert: ICU Bed Capacity Overflow"
            >
              <Bed className="w-2.5 h-2.5" />
            </span>
          )}

          {unreadCount > 0 && !hasBloodAlert && !hasIcuAlert && (
            <span className="px-1.5 py-0.5 bg-rose-500 text-white text-[10px] font-bold rounded-full shadow-sm min-w-[18px] text-center">
              {unreadCount}
            </span>
          )}
        </button>

        {/* Dropdown Notification Feed */}
        {isOpen && (
          <div className="absolute right-0 mt-2 w-96 max-w-[92vw] bg-white rounded-2xl shadow-2xl border border-slate-200 z-50 overflow-hidden animate-fade-in text-slate-900">
            {/* Header */}
            <div className="bg-[#5b7b94] text-white px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-white/20 flex items-center justify-center text-white">
                  <MessageSquare className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h4 className="text-xs font-black tracking-wide flex items-center gap-1.5 text-white">
                    SWASTHAI DISPATCH
                    <span className="text-[9px] bg-white/20 text-white px-1.5 py-0.2 rounded font-mono">
                      WHATSAPP &amp; SMS
                    </span>
                  </h4>
                  <p className="text-[10px] text-slate-100">
                    Frontline operational alert dispatch • {currentStaffName} ({currentRole})
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setIsOpen(false)}
                className="text-white/80 hover:text-white p-1 rounded hover:bg-white/10 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Channel filter tabs */}
            <div className="px-3.5 py-2 bg-slate-100 border-b border-slate-200 flex items-center gap-1.5 text-xs">
              <span className="text-[10px] font-bold uppercase text-slate-500 mr-1">Channel:</span>
              <button
                onClick={() => setChannelFilter("ALL")}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition ${
                  channelFilter === "ALL" ? "bg-white text-slate-900 shadow-xs" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                All ({alerts.length})
              </button>
              <button
                onClick={() => setChannelFilter("WHATSAPP")}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition flex items-center gap-1 ${
                  channelFilter === "WHATSAPP" ? "bg-emerald-600 text-white shadow-xs" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                💬 WhatsApp
              </button>
              <button
                onClick={() => setChannelFilter("SMS")}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition flex items-center gap-1 ${
                  channelFilter === "SMS" ? "bg-indigo-600 text-white shadow-xs" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                📱 Carrier SMS
              </button>
            </div>

            {/* Quick Actions Bar */}
            <div className="px-3.5 py-1.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-[11px] text-slate-600">
              <span className="font-mono text-[10px] text-slate-500">
                {unreadCount} unread notification{unreadCount === 1 ? "" : "s"}
              </span>
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllRead}
                  className="text-xs text-[#5b7b94] hover:underline font-semibold flex items-center gap-1"
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  Mark all as read
                </button>
              )}
            </div>

            {/* Message List */}
            <div className="max-h-[380px] overflow-y-auto p-3 space-y-2.5 bg-slate-50/50">
              {filteredAlerts.slice(0, 5).map((alert) => {
                const isBloodAlert = alert.alert_type === "BLOOD_SHORTAGE";
                const isIcuAlert = alert.alert_type === "ICU_CAPACITY";

                return (
                  <div 
                    key={alert.id}
                    className={`bg-white border rounded-xl p-3 shadow-sm transition text-slate-800 relative ${
                      isBloodAlert 
                        ? "border-rose-300 ring-1 ring-rose-200/60" 
                        : isIcuAlert 
                        ? "border-amber-300 ring-1 ring-amber-200/60" 
                        : "border-slate-200 hover:border-slate-300"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="text-[10px] font-black uppercase tracking-wider text-slate-900 flex items-center gap-1">
                        {isBloodAlert ? (
                          <span className="w-4 h-4 rounded-full bg-rose-600 text-white flex items-center justify-center p-0.5">
                            <Droplet className="w-2.5 h-2.5 fill-white" />
                          </span>
                        ) : isIcuAlert ? (
                          <span className="w-4 h-4 rounded-full bg-amber-500 text-slate-950 flex items-center justify-center p-0.5">
                            <Bed className="w-2.5 h-2.5" />
                          </span>
                        ) : (
                          <span className={`w-1.5 h-1.5 rounded-full ${alert.channel === "SMS" ? "bg-indigo-600" : "bg-emerald-600"}`}></span>
                        )}
                        {alert.title}
                      </span>
                      <span className="text-[9px] font-mono text-slate-400">
                        {alert.timestamp}
                      </span>
                    </div>

                    <p className="text-xs text-slate-600 leading-relaxed font-sans">
                      {alert.message_body}
                    </p>

                    {/* Guided Navigation Action Buttons for Blood and ICU triggers */}
                    {isBloodAlert && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleNavigate("BLOOD_INVENTORY", "blood");
                        }}
                        className="mt-2 w-full py-1.5 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5 shadow-xs"
                      >
                        <Droplet className="w-3.5 h-3.5 fill-white" />
                        <span>View Blood Deficit on Regional Map ➔</span>
                      </button>
                    )}

                    {isIcuAlert && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleNavigate("BLOOD_INVENTORY", "beds");
                        }}
                        className="mt-2 w-full py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black rounded-xl transition flex items-center justify-center gap-1.5 shadow-xs"
                      >
                        <Bed className="w-3.5 h-3.5" />
                        <span>View Nearby Bed Options on Regional Map ➔</span>
                      </button>
                    )}

                    <div className="mt-2 pt-1.5 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-500">
                      <span className={`px-1.5 py-0.2 rounded font-mono font-bold text-[9px] ${
                        alert.channel === "SMS" ? "bg-indigo-50 text-indigo-700 border border-indigo-200" : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                      }`}>
                        {alert.channel === "SMS" ? "📱 Carrier SMS (Twilio Ready)" : "💬 WhatsApp Audio"}
                      </span>
                      <span className="flex items-center gap-1 font-mono text-[9px] text-[#5b7b94] font-bold">
                        ✓✓ Delivered
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Footer / Message Log Trigger */}
            <div className="p-3 bg-white border-t border-slate-200 flex items-center justify-between">
              <button
                onClick={() => {
                  setIsOpen(false);
                  setShowFullLog(true);
                }}
                className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5 shadow-sm"
              >
                <FileText className="w-3.5 h-3.5 text-white" />
                View Full Alert Audit Log ({alerts.length}) ➔
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Full Message Log Modal */}
      {showFullLog && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-3xl max-w-3xl w-full max-h-[85vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden text-slate-900">
            {/* Modal Header */}
            <div className="bg-[#5b7b94] text-white px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center text-white">
                  <MessageSquare className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-base font-black tracking-wide uppercase flex items-center gap-2 text-white">
                    Staff Notification Audit Log
                    <span className="text-[10px] bg-white/20 text-white px-2 py-0.5 rounded-full font-mono">
                      WHATSAPP &amp; SMS
                    </span>
                  </h3>
                  <p className="text-xs text-slate-200">
                    Chronological audit trail of all automated operational alerts
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowFullLog(false)}
                className="text-white/80 hover:text-white p-2 rounded-xl hover:bg-white/10 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Filter Pills */}
            <div className="px-6 py-3 bg-slate-50 border-b border-slate-200 space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1">
                  <Filter className="w-3.5 h-3.5" />
                  Filter Category:
                </span>
              </div>
              <div className="flex items-center gap-1.5 flex-wrap">
                {[
                  { id: "ALL", label: "All Alerts" },
                  { id: "BLOOD_SHORTAGE", label: "🩸 Blood Shortage" },
                  { id: "ICU_CAPACITY", label: "🛏️ ICU Capacity" },
                  { id: "PHLEBOTOMY", label: "Phlebotomy" },
                  { id: "DISCHARGE_GATE", label: "Discharge Gates" },
                  { id: "BED_TURNOVER", label: "Bed Turnover" },
                  { id: "TPA_PREAUTH", label: "TPA Pre-Auth" },
                  { id: "ICU_STEPDOWN", label: "ICU Stepdown" },
                  { id: "ALERT_CAP", label: "SMS Dispatches" }
                ].map(f => (
                  <button
                    key={f.id}
                    onClick={() => setSelectedFilter(f.id)}
                    className={`px-3 py-1 rounded-full text-xs font-bold transition ${
                      selectedFilter === f.id
                        ? "bg-[#5b7b94] text-white shadow-xs"
                        : "bg-white text-slate-500 hover:bg-slate-100 border border-slate-200"
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Table / Message Log Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-3 bg-slate-50/50">
              {filteredAlerts.length === 0 ? (
                <div className="text-center py-12 text-slate-400 text-sm font-sans">
                  No notifications recorded for this filter category.
                </div>
              ) : (
                filteredAlerts.map(alert => {
                  const isBlood = alert.alert_type === "BLOOD_SHORTAGE";
                  const isIcu = alert.alert_type === "ICU_CAPACITY";

                  return (
                    <div
                      key={alert.id}
                      className={`bg-white rounded-xl p-4 border transition space-y-2 ${
                        isBlood ? "border-rose-300 ring-1 ring-rose-200/50" :
                        isIcu ? "border-amber-300 ring-1 ring-amber-200/50" :
                        "border-slate-200 hover:border-slate-300 shadow-sm"
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                            isBlood ? "bg-rose-100 text-rose-800 border border-rose-300" :
                            isIcu ? "bg-amber-100 text-amber-900 border border-amber-300" :
                            alert.channel === "SMS" 
                              ? "bg-indigo-50 text-indigo-700 border border-indigo-200"
                              : "bg-[#eef4f8] text-[#5b7b94] border border-[#5b7b94]/20"
                          }`}>
                            {isBlood ? "🩸 BLOOD DEFICIT" : isIcu ? "🛏️ ICU OVERFLOW" : alert.channel === "SMS" ? "📱 CARRIER SMS" : alert.alert_type}
                          </span>
                          <h4 className="text-sm font-bold text-slate-900">{alert.title}</h4>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-slate-400 font-mono">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          <span>{alert.timestamp}</span>
                        </div>
                      </div>

                      <p className="text-xs text-slate-600 leading-relaxed">
                        {alert.message_body}
                      </p>

                      {/* Modal Navigation Buttons */}
                      {isBlood && (
                        <button
                          onClick={() => handleNavigate("BLOOD_INVENTORY", "blood")}
                          className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-xl transition inline-flex items-center gap-1.5 shadow-xs"
                        >
                          <Droplet className="w-3.5 h-3.5 fill-white" />
                          View Blood Deficit on Regional Map ➔
                        </button>
                      )}

                      {isIcu && (
                        <button
                          onClick={() => handleNavigate("BLOOD_INVENTORY", "beds")}
                          className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black rounded-xl transition inline-flex items-center gap-1.5 shadow-xs"
                        >
                          <Bed className="w-3.5 h-3.5" />
                          View Nearby Bed Options on Regional Map ➔
                        </button>
                      )}

                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-slate-100 text-[11px] text-slate-500">
                        <span className="font-semibold text-slate-700 flex items-center gap-1">
                          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                          {alert.guardrail_tag}
                        </span>
                        <div className="flex items-center gap-3">
                          <span className="font-mono text-[10px] text-slate-500">
                            To: <strong className="text-slate-800">{alert.recipient_name}</strong> {alert.recipient_phone && `(${alert.recipient_phone})`}
                          </span>
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-800 border border-slate-200">
                            {alert.severity}
                          </span>
                          <span className="text-[10px] font-bold text-emerald-700 font-mono">
                            ✓ Delivered
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 bg-white border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <span className="text-xs text-slate-500">
                Audited via <strong>SwasthAI Notification Engine</strong> • Simulated provider swappable with Twilio
              </span>
              <button
                onClick={() => setShowFullLog(false)}
                className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-full text-xs font-bold transition shadow-sm self-end"
              >
                Close Audit Log
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
