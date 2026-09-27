/**
 * SwasthAI — SMS Notification Subsystem
 *
 * Simulated-first architecture structured for seamless drop-in of real SMS providers (e.g. Twilio)
 * without requiring any architectural changes.
 */

export interface SMSMessage {
  id: string;
  recipient: string;
  recipient_name: string;
  recipient_role: string;
  body: string;
  timestamp: string;
  status: "sent" | "delivered" | "failed";
  provider: "simulated" | "twilio";
  channel: "SMS";
  guardrail_tag: string;
  title?: string;
  sent_at?: string;
}

const INITIAL_SMS_LOGS: SMSMessage[] = [
  {
    id: "SMS-001",
    recipient: "+91 98765 43210",
    recipient_name: "Hari Das (Phlebotomist)",
    recipient_role: "SUPPORT",
    title: "Morning Fasting Draw Deadline",
    body: "Morning Fasting Phlebotomy for Bed 102 (Priya S.) backwards-scheduled before 08:00 AM breakfast deadline. Learned Lab P90 turnaround is 140 min so results will be ready for Dr. Rao's 09:15 AM surgical round.",
    timestamp: "06:25 AM",
    status: "delivered",
    provider: "simulated",
    channel: "SMS",
    guardrail_tag: "Guardrail #3 (P90 Budgeting) & #4 (70% Confidence)",
    sent_at: "2026-09-26T06:25:00Z"
  },
  {
    id: "SMS-002",
    recipient: "+91 98111 22334",
    recipient_name: "Dr. Sunita Rao",
    recipient_role: "DOCTOR",
    title: "Clinical Discharge Authorization Pending",
    body: "Patient Rajesh Verma (Bed 105) has completed oral antibiotic switch and vitals are stable for 18h. Discharge Radar p_discharge is 0.88. Awaiting your 1-tap clinical authorization to initiate pharmacy and TPA clearance.",
    timestamp: "07:10 AM",
    status: "delivered",
    provider: "simulated",
    channel: "SMS",
    guardrail_tag: "Guardrail #1 (Doctor Decides Exclusively)",
    sent_at: "2026-09-26T07:10:00Z"
  },
  {
    id: "SMS-003",
    recipient: "+91 98222 33445",
    recipient_name: "Coordinator Anil Reddy",
    recipient_role: "COORDINATOR",
    title: "Early TPA Pre-Authorization Dispatch",
    body: "Medi Assist clearance for Bed 204 submitted prior to 10:00 AM. Learned P90 approval is 210 min. Early submission prevents afternoon billing counter bottlenecks.",
    timestamp: "07:35 AM",
    status: "delivered",
    provider: "simulated",
    channel: "SMS",
    guardrail_tag: "Guardrail #3 (Learned Multi-Payer P90 Lead Times)",
    sent_at: "2026-09-26T07:35:00Z"
  },
  {
    id: "SMS-004",
    recipient: "+91 98333 44556",
    recipient_name: "Ramesh Kumar (Housekeeping)",
    recipient_role: "SUPPORT",
    title: "Terminal Bed Sanitization Dispatched",
    body: "Bed 106 vacated by departed patient. Status: DIRTY. Sanitization team assigned. 30-minute turnaround clock started to prepare bed for incoming ER admission.",
    timestamp: "08:15 AM",
    status: "delivered",
    provider: "simulated",
    channel: "SMS",
    guardrail_tag: "Guardrail #5 (Staff Alert Fatigue Cap: 4/10 tasks)",
    sent_at: "2026-09-26T08:15:00Z"
  }
];

const STORAGE_KEY = "swasthai_sms_messages";

/**
 * Retrieves the persisted SMS message log from localStorage.
 */
export function getSMSMessages(): SMSMessage[] {
  if (typeof window === "undefined") return INITIAL_SMS_LOGS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_SMS_LOGS));
    return INITIAL_SMS_LOGS;
  } catch {
    return INITIAL_SMS_LOGS;
  }
}

/**
 * Logs a message to the persistent audit log.
 */
export async function logMessage(message: SMSMessage): Promise<void> {
  if (typeof window === "undefined") return;
  try {
    const current = getSMSMessages();
    const updated = [message, ...current.filter(m => m.id !== message.id)];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));

    // Also dispatch custom event for real-time reactivity in UI components
    window.dispatchEvent(new CustomEvent("swasthai_sms_sent", { detail: message }));
  } catch (err) {
    console.warn("Failed to log SMS message:", err);
  }
}

/**
 * Single swappable interface for sending SMS notifications.
 *
 * Current Milestone: Simulated implementation (logs message object with status: 'delivered').
 * Future Provider: Replace internal logic with Twilio REST API client:
 *   const client = twilio(accountSid, authToken);
 *   await client.messages.create({ to: recipient, from: twilioNumber, body });
 */
export async function sendSMS(
  recipient: string,
  body: string,
  meta?: {
    name?: string;
    role?: string;
    tag?: string;
    title?: string;
  }
): Promise<SMSMessage> {
  const message: SMSMessage = {
    id: `SMS-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    recipient,
    recipient_name: meta?.name || "Frontline Healthcare Worker",
    recipient_role: meta?.role || "STAFF",
    title: meta?.title || "Operational Alert Dispatch",
    body,
    timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    status: "delivered",
    provider: "simulated",
    channel: "SMS",
    guardrail_tag: meta?.tag || "Guardrail #5 (Alert Fatigue Cap: <= 10 Tasks)",
    sent_at: new Date().toISOString()
  };

  await logMessage(message);
  return message;
}
