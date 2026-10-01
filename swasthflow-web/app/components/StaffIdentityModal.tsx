"use client";

import React, { useState, useMemo } from "react";
import { UserCheck, X, Search, CheckCircle2 } from "lucide-react";

export interface MockStaffMember {
  id: string;
  name: string;
  role: "Nurse" | "Doctor" | "Coordinator" | "Support Staff" | "Patient";
  systemRole: "NURSE" | "DOCTOR" | "OPERATIONS" | "CLEANER";
  ward: string;
}

export const MOCK_STAFF_DATABASE: MockStaffMember[] = [
  // Nurses
  { id: 'N001', name: 'Sister Sunita Kumar', role: 'Nurse', systemRole: 'NURSE', ward: 'ICU' },
  { id: 'N002', name: 'Nurse Priya Sharma', role: 'Nurse', systemRole: 'NURSE', ward: 'Medical Ward A' },
  { id: 'N003', name: 'Nurse Amit Patel', role: 'Nurse', systemRole: 'NURSE', ward: 'Emergency Room' },
  { id: 'N004', name: 'Nurse Rajesh Gupta', role: 'Nurse', systemRole: 'NURSE', ward: 'Surgical Ward B' },
  { id: 'N005', name: 'Nurse Anjali Desai', role: 'Nurse', systemRole: 'NURSE', ward: 'Pediatrics' },
  
  // Doctors
  { id: 'D001', name: 'Dr. Sunita Rao', role: 'Doctor', systemRole: 'DOCTOR', ward: 'General & Trauma Surgery' },
  { id: 'D002', name: 'Dr. Vikram Singh', role: 'Doctor', systemRole: 'DOCTOR', ward: 'Emergency Medicine' },
  { id: 'D003', name: 'Dr. Meera Joshi', role: 'Doctor', systemRole: 'DOCTOR', ward: 'Critical Care / ICU' },
  { id: 'D004', name: 'Dr. Arjun Verma', role: 'Doctor', systemRole: 'DOCTOR', ward: 'Orthopedics & Post-Op' },
  
  // Coordinators
  { id: 'C001', name: 'Coordinator Anil Reddy', role: 'Coordinator', systemRole: 'OPERATIONS', ward: 'Central Operations Command' },
  { id: 'C002', name: 'Coordinator Neha Mishra', role: 'Coordinator', systemRole: 'OPERATIONS', ward: 'Capacity & Bed Logistics' },
  
  // Support Staff
  { id: 'S001', name: 'Phlebotomist Hari Das', role: 'Support Staff', systemRole: 'CLEANER', ward: 'Central Pathology & Blood Lab' },
  { id: 'S002', name: 'Cleaner Ramesh Kumar', role: 'Support Staff', systemRole: 'CLEANER', ward: 'Terminal Disinfection & Turnover' },
  { id: 'S003', name: 'Porter Kavi Reddy', role: 'Support Staff', systemRole: 'CLEANER', ward: 'Patient Transport & Stretchers' },

  // Patients & Caregivers
  { id: 'P001', name: 'Rajesh Verma (Caregiver)', role: 'Patient', systemRole: 'OPERATIONS', ward: 'Bed 105 Family' },
  { id: 'P002', name: 'Priya Sharma (Patient)', role: 'Patient', systemRole: 'OPERATIONS', ward: 'Bed 102 Medical Ward' }
];

export interface RoleCategoryDefinition {
  id: "NURSE" | "DOCTOR" | "COORDINATOR" | "SUPPORT" | "PATIENT";
  mappedSystemRole: "NURSE" | "DOCTOR" | "OPERATIONS" | "CLEANER";
  label: string;
  title: string;
  category: string;
  badge: string;
  accentColor: string;
  borderColor: string;
  btnBg: string;
  iconEmoji: string;
  defaultIdPrefix: string;
  placeholder: string;
  defaultName: string;
  systemScope: string;
}

interface StaffIdentityModalProps {
  role: RoleCategoryDefinition;
  onClose: () => void;
  onConfirm: (staffId: string, staffName: string, roleDef: RoleCategoryDefinition) => void;
  authLoading: boolean;
}

export function StaffIdentityModal({ role, onClose, onConfirm, authLoading }: StaffIdentityModalProps) {
  const [query, setQuery] = useState("");
  const [selectedStaff, setSelectedStaff] = useState<MockStaffMember | null>(null);

  // Filter mock database by the active role category
  const roleMatches = useMemo(() => {
    return MOCK_STAFF_DATABASE.filter(m => {
      if (role.id === "NURSE") return m.role === "Nurse";
      if (role.id === "DOCTOR") return m.role === "Doctor";
      if (role.id === "COORDINATOR") return m.role === "Coordinator";
      if (role.id === "SUPPORT") return m.role === "Support Staff";
      if (role.id === "PATIENT") return m.role === "Patient";
      return false;
    });
  }, [role.id]);

  // Autocomplete matching
  const suggestions = useMemo(() => {
    if (!query.trim()) return roleMatches;
    const q = query.toLowerCase();
    return roleMatches.filter(m => 
      m.name.toLowerCase().includes(q) || 
      m.id.toLowerCase().includes(q) ||
      m.ward.toLowerCase().includes(q)
    );
  }, [roleMatches, query]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedStaff) {
      onConfirm(selectedStaff.id, selectedStaff.name, role);
    } else {
      const trimmed = query.trim();
      const enteredName = trimmed || `${role.defaultName} (${role.label})`;
      const generatedId = trimmed.startsWith(role.defaultIdPrefix)
        ? trimmed
        : `${role.defaultIdPrefix}${Math.floor(100 + Math.random() * 900)}`;
      onConfirm(generatedId, enteredName, role);
    }
  };

  const handleSelectSuggestion = (staff: MockStaffMember) => {
    setSelectedStaff(staff);
    setQuery(staff.name);
  };

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-fade-in">
      <div
        className="bg-[#0a0a0a] border border-white/15 max-w-lg w-full p-6 space-y-5 animate-hero-heading relative overflow-hidden text-slate-300"
      >
        {/* Modal Header */}
        <div className="flex items-start justify-between relative z-10">
          <div className="flex items-center gap-3.5">
            <div
              className="w-12 h-12 flex items-center justify-center text-2xl bg-[#fb923c]/15 border border-[#fb923c]/30"
            >
              {role.iconEmoji}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span
                  className="px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wider bg-[#fb923c] text-[#0a0a0a]"
                >
                  {role.badge}
                </span>
                <span className="text-[10px] font-mono text-slate-500 normal-case">
                  Hospital Directory
                </span>
              </div>
              <h3 className="text-base font-bold text-white uppercase tracking-tight mt-1">
                Clock In: {role.label}
              </h3>
              <p className="text-[11px] text-slate-400 normal-case">
                {role.title}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1.5 hover:bg-white/10 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Single-Field Form with Autocomplete */}
        <form onSubmit={handleSubmit} className="space-y-4 relative z-10">
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-slate-300 uppercase tracking-wider flex items-center justify-between">
              <span>Enter your Name or Staff ID</span>
              <span className="text-[9px] text-slate-500 font-normal normal-case">
                Type to search or choose below
              </span>
            </label>
            <div className="relative">
              <input
                type="text"
                autoFocus
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setSelectedStaff(null);
                }}
                placeholder={role.placeholder}
                className="w-full px-4 py-3 pl-10 bg-white/5 border border-white/15 text-white text-sm font-medium focus:outline-none focus:border-[#fb923c] transition placeholder:text-slate-500"
              />
              <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
            </div>
          </div>

          {/* Autocomplete Suggestions Dropdown / Quick Select */}
          <div className="space-y-1.5">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
              <span>Verified Directory ({suggestions.length})</span>
              <span className="text-slate-500 font-mono normal-case">1-Tap Select</span>
            </div>

            <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
              {suggestions.map((member) => {
                const isSelected = selectedStaff?.id === member.id;
                return (
                  <button
                    key={member.id}
                    type="button"
                    onClick={() => handleSelectSuggestion(member)}
                    className={`w-full p-2.5 border text-left transition flex items-center justify-between group ${
                      isSelected
                        ? "bg-[#fb923c]/10 border-[#fb923c]"
                        : "bg-white/5 hover:bg-white/10 border-white/10"
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="w-2 h-2 bg-[#fb923c]" />
                      <div>
                        <div className="text-xs font-bold text-white group-hover:text-[#fb923c] transition normal-case">
                          {member.name}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono normal-case">
                          ID: <strong className="text-slate-200">{member.id}</strong> • 📍 {member.ward}
                        </div>
                      </div>
                    </div>

                    {isSelected ? (
                      <CheckCircle2 className="w-4 h-4 text-[#fb923c] shrink-0" />
                    ) : (
                      <span className="text-[10px] font-mono text-slate-500 group-hover:text-white transition normal-case">
                        Select ➔
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Clinical Scope Summary */}
          <div className="p-3.5 bg-white/5 border border-white/10 text-[11px] text-slate-400 space-y-1">
            <div className="font-bold text-white flex items-center gap-1.5 uppercase tracking-wider text-[10px]">
              <span>🛡️</span> Duty Station Scope
            </div>
            <p className="leading-relaxed text-slate-400 normal-case">{role.systemScope}</p>
          </div>

          {/* Action Buttons */}
          <div className="pt-2 flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="w-1/3 py-2.5 text-[10px] font-bold uppercase tracking-wider text-slate-300 hover:text-white hover:bg-white/10 border border-white/15 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={authLoading}
              className="w-2/3 py-2.5 text-[10px] font-bold uppercase tracking-wider text-[#0a0a0a] bg-[#fb923c] hover:bg-white transition flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <UserCheck className="w-4 h-4" />
              {authLoading ? "Clocking In..." : `Enter ${role.label} Workspace ➔`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
