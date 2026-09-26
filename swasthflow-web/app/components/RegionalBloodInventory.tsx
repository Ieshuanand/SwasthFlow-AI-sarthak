"use client";

import React, { useState, useEffect, useRef } from "react";
import { 
  Droplet, 
  AlertTriangle, 
  MapPin, 
  Building2, 
  CheckCircle2, 
  RefreshCw, 
  Send,
  Bed,
  Phone,
  PhoneCall,
  ShieldAlert,
  X
} from "lucide-react";

export interface RegionalHospital {
  id: string;
  name: string;
  tier: "primary" | "overflow_partner" | "secondary";
  tier_label: string;
  beds_total: number;
  beds_occupied: number;
  availableBeds: number;
  icu_beds_total: number;
  icu_beds_occupied: number;
  icu_beds_available: number;
  distanceKm: number;
  x_coord: number; // Percentage on canvas fallback
  y_coord: number;
  lat: number;
  lng: number;
  phone: string;
  transfer_desk_contact: string;
  inventory: {
    "O-": number;
    "O+": number;
    "A-": number;
    "A+": number;
    "B-": number;
    "B+": number;
    "AB-": number;
    "AB+": number;
  };
}

export const INITIAL_REGIONAL_HOSPITALS: RegionalHospital[] = [
  {
    id: "HOSP-01",
    name: "SwasthAI Central (SRM Global Base)",
    tier: "primary",
    tier_label: "Primary Command (Local)",
    beds_total: 300,
    beds_occupied: 298,
    availableBeds: 2,
    icu_beds_total: 30,
    icu_beds_occupied: 30,
    icu_beds_available: 0, // ⚠ ICU at full capacity! Pitch Trigger
    distanceKm: 0,
    x_coord: 48,
    y_coord: 46,
    lat: 12.823,
    lng: 80.045,
    phone: "+91 800-SWASTH (Ext. 101)",
    transfer_desk_contact: "Dr. Sunita Rao (Attending Command)",
    inventory: {
      "O-": 3,   // CRITICAL LOW! Pitch Moment
      "O+": 24,
      "A-": 8,
      "A+": 32,
      "B-": 6,
      "B+": 29,
      "AB-": 4,  // Also Low
      "AB+": 12
    }
  },
  {
    id: "HOSP-02",
    name: "Metro General Hospital",
    tier: "overflow_partner",
    tier_label: "Overflow Partner (Designated Tier A)",
    beds_total: 220,
    beds_occupied: 172,
    availableBeds: 48,
    icu_beds_total: 24,
    icu_beds_occupied: 18,
    icu_beds_available: 6, // Abundant ICU beds available!
    distanceKm: 7.4,
    x_coord: 76,
    y_coord: 32,
    lat: 13.082,
    lng: 80.270,
    phone: "+91 44 2855 4000 (ICU Direct: Ext. 402)",
    transfer_desk_contact: "Dr. Ramanathan (Emergency Transfer Desk)",
    inventory: {
      "O-": 14,  // Abundant O- available for transfer!
      "O+": 38,
      "A-": 11,
      "A+": 40,
      "B-": 16,
      "B+": 35,
      "AB-": 9,
      "AB+": 18
    }
  },
  {
    id: "HOSP-04",
    name: "Apex Trauma & Specialty",
    tier: "overflow_partner",
    tier_label: "Overflow Partner (Designated Tier A)",
    beds_total: 250,
    beds_occupied: 218,
    availableBeds: 32,
    icu_beds_total: 20,
    icu_beds_occupied: 16,
    icu_beds_available: 4,
    distanceKm: 8.8,
    x_coord: 68,
    y_coord: 78,
    lat: 12.980,
    lng: 80.218,
    phone: "+91 44 2661 1200 (Bed Bureau: Ext. 108)",
    transfer_desk_contact: "Dr. Meenakshi (Critical Care Lead)",
    inventory: {
      "O-": 9,
      "O+": 31,
      "A-": 7,
      "A+": 28,
      "B-": 12,
      "B+": 34,
      "AB-": 6,
      "AB+": 15
    }
  },
  {
    id: "HOSP-03",
    name: "City Care Medical Center",
    tier: "secondary",
    tier_label: "Regional Network (Tier B)",
    beds_total: 180,
    beds_occupied: 145,
    availableBeds: 35,
    icu_beds_total: 16,
    icu_beds_occupied: 13,
    icu_beds_available: 3,
    distanceKm: 11.2,
    x_coord: 24,
    y_coord: 68,
    lat: 13.040,
    lng: 80.170,
    phone: "+91 44 2499 5500",
    transfer_desk_contact: "Dr. Arvind (Operations Officer)",
    inventory: {
      "O-": 6,
      "O+": 19,
      "A-": 3,   // Critical low A-
      "A+": 22,
      "B-": 8,
      "B+": 26,
      "AB-": 5,
      "AB+": 11
    }
  },
  {
    id: "HOSP-05",
    name: "North District Charitable",
    tier: "secondary",
    tier_label: "Secondary Network (Tier B)",
    beds_total: 140,
    beds_occupied: 140, // 0 beds available! Disqualified
    availableBeds: 0,
    icu_beds_total: 12,
    icu_beds_occupied: 12,
    icu_beds_available: 0,
    distanceKm: 14.5,
    x_coord: 32,
    y_coord: 20,
    lat: 13.150,
    lng: 80.200,
    phone: "+91 44 2234 8800",
    transfer_desk_contact: "Emergency Desk (At Full Capacity)",
    inventory: {
      "O-": 2,   // Critical low O-
      "O+": 15,
      "A-": 4,   // Critical low A-
      "A+": 18,
      "B-": 5,
      "B+": 21,
      "AB-": 3,  // Critical low AB-
      "AB+": 8
    }
  }
];

const BLOOD_TYPES = ["O-", "O+", "A-", "A+", "B-", "B+", "AB-", "AB+"] as const;

/**
 * Mock priority score formula (Section 3):
 * Lower score is better (higher priority ranking).
 * Nearest, available, designated-partner hospitals surface first.
 * Full hospitals are penalized +1000 and pushed to the bottom.
 */
export function priorityScore(hospital: RegionalHospital): number {
  const distanceWeight = hospital.distanceKm * 1.0;
  const capacityPenalty = hospital.availableBeds === 0 ? 1000 : 0; // effectively disqualifies full hospitals
  const tierBonus = hospital.tier === "overflow_partner" ? 0 : 5; // prefer designated overflow partners slightly
  return distanceWeight + capacityPenalty + tierBonus;
}

interface RegionalMapProps {
  initialFocusSection?: "blood" | "beds" | "all";
}

export function RegionalBloodInventory({ initialFocusSection = "all" }: RegionalMapProps) {
  const [hospitals, setHospitals] = useState<RegionalHospital[]>(INITIAL_REGIONAL_HOSPITALS);
  const [activeSection, setActiveSection] = useState<"all" | "beds" | "blood">(initialFocusSection);
  const [criticalThreshold, setCriticalThreshold] = useState<number>(5);
  const [selectedHospitalId, setSelectedHospitalId] = useState<string>("HOSP-02"); // default to recommended partner
  const [transferSuccessMsg, setTransferSuccessMsg] = useState<string | null>(null);
  const [transferring, setTransferring] = useState<boolean>(false);
  const [contactModalHospital, setContactModalHospital] = useState<RegionalHospital | null>(null);
  const [coordinationNotes, setCoordinationNotes] = useState<string>("");
  const [coordinationSuccessMsg, setCoordinationSuccessMsg] = useState<string | null>(null);

  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<{ [key: string]: any }>({});

  // Initialize and update real Leaflet OpenStreetMap with dark tiles and custom markers
  useEffect(() => {
    let isMounted = true;

    const setupLeafletMap = async () => {
      if (!mapContainerRef.current) return;

      try {
        const L = (await import("leaflet")).default;
        if (!isMounted || !mapContainerRef.current) return;

        // If map already exists, remove it cleanly before re-init
        if (mapInstanceRef.current) {
          mapInstanceRef.current.remove();
          mapInstanceRef.current = null;
        }

        // Center on the Chennai metropolitan corridor (SRM Global Base: 12.823, 80.045 to Metro General: 13.082, 80.270)
        const map = L.map(mapContainerRef.current, {
          center: [12.98, 80.17],
          zoom: 11,
          zoomControl: true,
          attributionControl: false
        });

        // OpenStreetMap tile layer with CSS dark invert filter
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 18,
          className: "map-tiles-dark"
        }).addTo(map);

        // Add subtle dashed coordination transit vectors between SRM Local Base (HOSP-01) and partner facilities
        const localHosp = hospitals.find(h => h.id === "HOSP-01");
        if (localHosp) {
          hospitals.forEach(h => {
            if (h.id !== "HOSP-01") {
              L.polyline(
                [[localHosp.lat, localHosp.lng], [h.lat, h.lng]],
                {
                  color: h.tier === "overflow_partner" ? "#14b8a6" : "#6366f1",
                  weight: 2,
                  dashArray: "5, 8",
                  opacity: 0.55
                }
              ).addTo(map);
            }
          });
        }

        // Render custom interactive HTML badges for each hospital
        markersRef.current = {};
        hospitals.forEach(hosp => {
          const isSelected = hosp.id === selectedHospitalId;
          const isCriticalBlood = hosp.inventory["O-"] < criticalThreshold;
          const isFullBeds = hosp.availableBeds === 0;

          const badgeBg = hosp.tier === "primary" ? "#6366f1" : hosp.tier === "overflow_partner" ? "#0d9488" : "#475569";
          const borderStyle = isSelected
            ? "border: 2px solid #f59e0b; box-shadow: 0 0 16px rgba(245, 158, 11, 0.6); transform: scale(1.08);"
            : "border: 1px solid #334155; box-shadow: 0 4px 14px rgba(0,0,0,0.5);";

          const iconHtml = `
            <div style="cursor: pointer; background: rgba(15, 23, 42, 0.95); border-radius: 14px; padding: 6px 10px; display: flex; align-items: center; gap: 8px; color: #ffffff; ${borderStyle} transition: all 0.2s ease;">
              <div style="background-color: ${badgeBg}; width: 26px; height: 26px; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 10px; font-weight: 900; flex-shrink: 0;">
                ${hosp.tier === "primary" ? "HQ" : hosp.tier === "overflow_partner" ? "P1" : "T2"}
              </div>
              <div style="text-align: left; line-height: 1.15;">
                <div style="font-size: 11px; font-weight: 800; display: flex; align-items: center; gap: 4px; color: #ffffff; white-space: nowrap;">
                  <span>${hosp.name.split(" ")[0]}</span>
                  ${isCriticalBlood ? '<span style="width: 7px; height: 7px; border-radius: 50%; background: #f43f5e; display: inline-block;"></span>' : ''}
                  ${isFullBeds ? '<span style="width: 7px; height: 7px; border-radius: 50%; background: #f59e0b; display: inline-block;"></span>' : ''}
                </div>
                <div style="font-size: 9px; font-family: monospace; color: #94a3b8; display: flex; align-items: center; gap: 4px; margin-top: 2px;">
                  <span style="color: ${isFullBeds ? '#f59e0b; font-weight: bold;' : '#34d399;'}">${hosp.availableBeds} beds</span>
                  <span>•</span>
                  <span style="color: ${hosp.icu_beds_available === 0 ? '#f43f5e; font-weight: bold;' : '#e2e8f0;'}">${hosp.icu_beds_available} ICU</span>
                  <span>•</span>
                  <span style="color: #fb7185; font-weight: bold;">${hosp.inventory["O-"]}u O-</span>
                </div>
              </div>
            </div>
          `;

          const customIcon = L.divIcon({
            className: "custom-leaflet-marker",
            html: iconHtml,
            iconSize: [160, 48],
            iconAnchor: [80, 24]
          });

          const marker = L.marker([hosp.lat, hosp.lng], { icon: customIcon }).addTo(map);
          marker.on("click", () => {
            setSelectedHospitalId(hosp.id);
          });
          markersRef.current[hosp.id] = marker;
        });

        mapInstanceRef.current = map;
      } catch (err) {
        console.error("Leaflet map initialization failed:", err);
      }
    };

    setupLeafletMap();

    return () => {
      isMounted = false;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [hospitals, criticalThreshold, selectedHospitalId]);

  // Pan to selected hospital when clicked from ranking table or pitch alert
  useEffect(() => {
    if (mapInstanceRef.current && selectedHospitalId) {
      const hosp = hospitals.find(h => h.id === selectedHospitalId);
      if (hosp) {
        mapInstanceRef.current.panTo([hosp.lat, hosp.lng], { animate: true, duration: 0.5 });
      }
    }
  }, [selectedHospitalId, hospitals]);

  // Listen for navigation events from Alerts bell or elsewhere
  useEffect(() => {
    const handleNav = (e: Event) => {
      const customEvent = e as CustomEvent<{ section?: "blood" | "beds" | "all" }>;
      if (customEvent.detail?.section) {
        setActiveSection(customEvent.detail.section);
        setSelectedHospitalId("HOSP-02"); // Focus recommended partner Metro General
        if (mapInstanceRef.current) {
          mapInstanceRef.current.panTo([13.082, 80.270], { animate: true, duration: 0.5 });
        }
        const targetId = customEvent.detail.section === "blood" ? "blood-matrix-section" : "bed-priority-section";
        const el = document.getElementById(targetId);
        if (el) {
          el.scrollIntoView({ behavior: "smooth" });
        }
      }
    };

    window.addEventListener("swasthai_navigate_regional_map", handleNav);
    return () => window.removeEventListener("swasthai_navigate_regional_map", handleNav);
  }, []);

  const handleSimulateTransfer = () => {
    setTransferring(true);
    setTimeout(() => {
      setHospitals(prev => prev.map(h => {
        if (h.id === "HOSP-02") {
          // Transfer 6 units of O- from Metro General
          return {
            ...h,
            inventory: { ...h.inventory, "O-": Math.max(0, h.inventory["O-"] - 6) }
          };
        }
        if (h.id === "HOSP-01") {
          // Add 6 units of O- to SwasthAI Central
          return {
            ...h,
            inventory: { ...h.inventory, "O-": h.inventory["O-"] + 6 }
          };
        }
        return h;
      }));
      setTransferring(false);
      setTransferSuccessMsg("Inter-Hospital Transit Initiated: 6 units O- dispatched from Metro General to SwasthAI Central (ETA: 18 min).");
      setTimeout(() => setTransferSuccessMsg(null), 8000);
    }, 600);
  };

  const handleLogCoordinationCall = () => {
    if (!contactModalHospital) return;
    const msg = `Transfer coordination call logged with ${contactModalHospital.name} (${contactModalHospital.transfer_desk_contact}). Receiving bed status verified. Clinician authorization required before ambulance dispatch.`;
    setCoordinationSuccessMsg(msg);
    setContactModalHospital(null);
    setCoordinationNotes("");
    setTimeout(() => setCoordinationSuccessMsg(null), 8000);
  };

  const handleReset = () => {
    setHospitals(INITIAL_REGIONAL_HOSPITALS);
    setTransferSuccessMsg(null);
    setCoordinationSuccessMsg(null);
  };

  // Sort external hospitals by priority score ascending (exclude local hospital HOSP-01 from transfer target rankings)
  const rankedExternalHospitals = [...hospitals.filter(h => h.id !== "HOSP-01")].sort((a, b) => {
    return priorityScore(a) - priorityScore(b);
  });

  const selectedHosp = hospitals.find(h => h.id === selectedHospitalId) || hospitals[1];

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Pitch Moment Headline Banner: Dual Telemetry (Blood + ICU/Bed Capacity) */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-6 sm:p-7 rounded-3xl border border-indigo-500/30 shadow-2xl relative overflow-hidden">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-3">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-500/20 border border-rose-400/40 text-rose-300 text-xs font-bold font-mono">
                <Droplet className="w-3.5 h-3.5 fill-rose-400" />
                Condition 1: Blood Inventory Balancing
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/20 border border-amber-400/40 text-amber-300 text-xs font-bold font-mono">
                <Bed className="w-3.5 h-3.5" />
                Condition 2: ICU &amp; Bed Capacity Overflow
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-indigo-500/20 border border-indigo-400/30 text-indigo-300 text-xs font-semibold">
                🛡️ Human Clinical Gate (No Auto-Reroute)
              </span>
            </div>

            <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-white flex items-center gap-2">
              Regional Network Command: Bed Capacity &amp; Blood Inventory
            </h2>
            <p className="text-slate-300 text-xs sm:text-sm max-w-3xl leading-relaxed">
              Real-time regional coordination across 5 partner hospitals. When local ICU hits capacity or critical blood reserves fall below safety floors, SwasthFlow priority-scores nearby overflow facilities and provides 1-tap direct clinical coordination.
            </p>
          </div>

          {/* Dual Pitch Alert Callout Boxes */}
          <div className="flex flex-col sm:flex-row lg:flex-col gap-3 shrink-0 max-w-md w-full">
            {/* ICU Capacity Alert Pitch */}
            <div className="bg-amber-500/10 backdrop-blur-md p-3.5 rounded-2xl border border-amber-400/30 space-y-1.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-amber-300 font-bold uppercase tracking-wider text-[11px]">
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                  ICU Capacity State: 0 Beds
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/30 text-amber-200">
                  CRITICAL
                </span>
              </div>
              <p className="text-slate-200 text-xs leading-relaxed">
                SwasthAI Central ICU is <strong>100% full (30/30 occupied)</strong>. Metro General (7.4 km) has <strong>6 ICU beds free</strong> and ranks as Priority #1.
              </p>
              <button
                onClick={() => {
                  setActiveSection("beds");
                  setSelectedHospitalId("HOSP-02");
                  setContactModalHospital(hospitals.find(h => h.id === "HOSP-02") || null);
                }}
                className="w-full mt-1 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black rounded-xl transition flex items-center justify-center gap-1.5 shadow-sm"
              >
                <Phone className="w-3.5 h-3.5" />
                Contact Metro General to Coordinate Transfer ➔
              </button>
            </div>

            {/* Blood Pitch Alert */}
            <div className="bg-rose-500/10 backdrop-blur-md p-3.5 rounded-2xl border border-rose-400/30 space-y-1.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-rose-300 font-bold uppercase tracking-wider text-[11px]">
                  <Droplet className="w-4 h-4 text-rose-400 shrink-0" />
                  Blood Deficit: 3 Units O-
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/30 text-rose-200">
                  LOW SAFETY FLOOR
                </span>
              </div>
              <p className="text-slate-200 text-xs leading-relaxed">
                SwasthAI Central has <strong>only 3 units O-</strong> left. Metro General has <strong>14 units</strong> across town.
              </p>
              <button
                onClick={handleSimulateTransfer}
                disabled={transferring}
                className="w-full mt-1 py-1.5 bg-rose-600 hover:bg-rose-500 text-white text-xs font-black rounded-xl transition flex items-center justify-center gap-1.5 shadow-sm disabled:opacity-50"
              >
                <Send className="w-3.5 h-3.5" />
                {transferring ? "Dispatching Courier..." : "Redistribute 6 Units O- ➔"}
              </button>
            </div>
          </div>
        </div>

        {/* Global Action Toasts */}
        {transferSuccessMsg && (
          <div className="mt-4 p-3 bg-emerald-500/20 border border-emerald-400/40 rounded-xl text-emerald-200 text-xs font-bold flex items-center gap-2 animate-fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{transferSuccessMsg}</span>
          </div>
        )}

        {coordinationSuccessMsg && (
          <div className="mt-4 p-3 bg-indigo-500/20 border border-indigo-400/40 rounded-xl text-indigo-200 text-xs font-bold flex items-center gap-2 animate-fade-in">
            <PhoneCall className="w-4 h-4 text-indigo-300 shrink-0" />
            <span>{coordinationSuccessMsg}</span>
          </div>
        )}
      </div>

      {/* Dual-Mode View Switcher Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-bold uppercase text-slate-500 mr-1">Display View:</span>
          <button
            onClick={() => setActiveSection("all")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
              activeSection === "all"
                ? "bg-slate-900 text-white shadow-xs"
                : "bg-slate-100 hover:bg-slate-200 text-slate-700"
            }`}
          >
            <MapPin className="w-3.5 h-3.5" />
            Full Network Grid (Map + Beds + Blood)
          </button>
          <button
            onClick={() => setActiveSection("beds")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
              activeSection === "beds"
                ? "bg-amber-600 text-white shadow-xs"
                : "bg-slate-100 hover:bg-slate-200 text-slate-700"
            }`}
          >
            <Bed className="w-3.5 h-3.5 text-amber-500" />
            ICU &amp; Bed Capacity Routing (Priority Ranked)
            <span className="px-1.5 py-0.2 rounded font-mono text-[10px] bg-amber-500/20 text-amber-900 font-black">
              P1
            </span>
          </button>
          <button
            onClick={() => setActiveSection("blood")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
              activeSection === "blood"
                ? "bg-rose-600 text-white shadow-xs"
                : "bg-slate-100 hover:bg-slate-200 text-slate-700"
            }`}
          >
            <Droplet className="w-3.5 h-3.5 text-rose-500" />
            Blood-Type Inventory (8 Types)
            <span className="px-1.5 py-0.2 rounded font-mono text-[10px] bg-rose-500/20 text-rose-900 font-black">
              3u
            </span>
          </button>
        </div>

        <div className="flex items-center gap-3 text-xs text-slate-500">
          <span>Priority formula: <code className="bg-slate-100 px-1.5 py-0.5 rounded text-[11px] text-slate-700 font-mono">dist + penalty + tier</code></span>
          <button
            onClick={handleReset}
            className="text-indigo-600 hover:text-indigo-800 font-bold transition flex items-center gap-1"
          >
            <RefreshCw className="w-3 h-3" /> Reset Mock Data
          </button>
        </div>
      </div>

      {/* Grid: Map + Selected Hospital Live Telemetry Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Regional Hospital Map Canvas (Static Markers on Brand Canvas) */}
        <div className="lg:col-span-7 bg-white rounded-3xl border border-slate-200 p-6 shadow-sm flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-black text-slate-900 tracking-tight flex items-center gap-2">
                <MapPin className="w-4 h-4 text-indigo-600" />
                Regional Hospital Cluster Map (Static Telemetry)
              </h3>
              <p className="text-xs text-slate-500">
                Click any hospital marker to inspect unit counts, bed availability &amp; transit distance.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-semibold text-slate-500">Blood Safety Floor:</span>
              <select
                value={criticalThreshold}
                onChange={(e) => setCriticalThreshold(Number(e.target.value))}
                className="px-2 py-1 bg-slate-100 border border-slate-300 rounded-lg text-xs font-bold text-slate-800"
              >
                <option value={3}>&lt; 3 Units</option>
                <option value={5}>&lt; 5 Units (Standard)</option>
                <option value={8}>&lt; 8 Units (Trauma Alert)</option>
              </select>
            </div>
          </div>

          {/* Interactive OpenStreetMap Leaflet Map (Dark Inverted Tiles) */}
          <div className="relative w-full h-[360px] rounded-2xl bg-slate-950 border border-indigo-900/40 overflow-hidden shadow-inner flex flex-col">
            <div ref={mapContainerRef} className="w-full h-full min-h-[360px]" />

            {/* Floating Quick Action Map Controls */}
            <div className="absolute top-3 right-3 z-[400] flex items-center gap-1.5 bg-slate-900/90 backdrop-blur-md px-2.5 py-1.5 rounded-xl border border-white/10 text-xs text-white shadow-lg pointer-events-auto">
              <button
                onClick={() => {
                  if (mapInstanceRef.current) {
                    mapInstanceRef.current.setView([12.98, 80.17], 11, { animate: true });
                  }
                }}
                className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-[10px] font-bold transition flex items-center gap-1"
                title="Reset Map to Regional View"
              >
                <RefreshCw className="w-3 h-3" />
                Reset View
              </button>
              <button
                onClick={() => {
                  if (mapInstanceRef.current) {
                    mapInstanceRef.current.flyTo([12.823, 80.045], 13, { duration: 0.8 });
                    setSelectedHospitalId("HOSP-01");
                  }
                }}
                className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 rounded-lg text-[10px] font-bold text-slate-200 transition"
                title="Focus on SRM Global Base Command"
              >
                Focus SRM Base
              </button>
            </div>

            {/* Map Legend */}
            <div className="absolute bottom-3 left-3 z-[400] bg-slate-900/90 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/10 text-[10px] text-slate-300 flex items-center gap-3 shadow-lg pointer-events-auto flex-wrap">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-indigo-500"></span> Primary Command
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-teal-400"></span> Overflow Partner
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span> Blood Deficit (&lt;{criticalThreshold}u)
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span> 0 Beds Full
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
            <span>OpenStreetMap dark tile layer • Pan &amp; zoom enabled • Zero live GPS tracking risk</span>
            <span className="text-[11px] font-mono text-indigo-600 font-bold">
              {hospitals.length} Connected Facilities
            </span>
          </div>
        </div>

        {/* Selected Hospital Live Status Card */}
        <div className="lg:col-span-5 bg-white rounded-3xl border border-slate-200 p-6 shadow-sm flex flex-col justify-between space-y-4">
          <div className="space-y-3.5">
            <div className="flex items-center justify-between">
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                selectedHosp.tier === "primary" ? "bg-indigo-100 text-indigo-800 border-indigo-200" :
                selectedHosp.tier === "overflow_partner" ? "bg-teal-100 text-teal-800 border-teal-200" :
                "bg-slate-100 text-slate-800 border-slate-200"
              }`}>
                {selectedHosp.tier_label}
              </span>
              <span className="text-xs font-mono font-bold text-slate-500 flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-indigo-500" />
                {selectedHosp.distanceKm === 0 ? "Local Command Base" : `${selectedHosp.distanceKm} km away`}
              </span>
            </div>

            <div>
              <h3 className="text-lg font-black text-slate-900 tracking-tight">
                {selectedHosp.name}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Transfer Hotline: <strong className="text-slate-800 font-mono">{selectedHosp.phone}</strong>
              </p>
            </div>

            {/* Bed & ICU Capacity Status Pill Grid */}
            <div className="grid grid-cols-2 gap-3 pt-1">
              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 space-y-1">
                <div className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1">
                  <Bed className="w-3 h-3 text-indigo-600" />
                  Available Ward Beds
                </div>
                <div className="flex items-baseline gap-1.5">
                  <span className={`text-2xl font-black ${selectedHosp.availableBeds === 0 ? "text-rose-600" : "text-slate-900"}`}>
                    {selectedHosp.availableBeds}
                  </span>
                  <span className="text-[11px] text-slate-500">
                    / {selectedHosp.beds_total} total
                  </span>
                </div>
                <div className="text-[10px] font-semibold text-slate-500">
                  {selectedHosp.beds_occupied} occupied ({Math.round(selectedHosp.beds_occupied / selectedHosp.beds_total * 100)}%)
                </div>
              </div>

              <div className="p-3 bg-amber-50/60 rounded-2xl border border-amber-200/60 space-y-1">
                <div className="text-[10px] uppercase font-bold text-amber-800 flex items-center gap-1">
                  <ShieldAlert className="w-3 h-3 text-amber-600" />
                  Available ICU Beds
                </div>
                <div className="flex items-baseline gap-1.5">
                  <span className={`text-2xl font-black ${selectedHosp.icu_beds_available === 0 ? "text-rose-600" : "text-amber-900"}`}>
                    {selectedHosp.icu_beds_available}
                  </span>
                  <span className="text-[11px] text-amber-800">
                    / {selectedHosp.icu_beds_total} total
                  </span>
                </div>
                <div className="text-[10px] font-semibold text-amber-700">
                  {selectedHosp.icu_beds_available === 0 ? "⚠ No ICU capacity" : "✓ Immediate intake ready"}
                </div>
              </div>
            </div>

            {/* Quick 8-Blood Type Grid for Selected Hospital */}
            <div className="space-y-1.5 pt-1">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
                <span>Blood Reserves:</span>
                <span className="text-[10px] text-slate-500">Safety floor: {criticalThreshold}u</span>
              </div>
              <div className="grid grid-cols-4 gap-2">
                {BLOOD_TYPES.map((type) => {
                  const count = selectedHosp.inventory[type];
                  const isCritical = count < criticalThreshold;

                  return (
                    <div
                      key={type}
                      className={`p-2 rounded-xl border text-center transition ${
                        isCritical
                          ? "bg-rose-50 border-rose-300 text-rose-900"
                          : "bg-slate-50 border-slate-200 text-slate-800"
                      }`}
                    >
                      <div className="text-[10px] font-mono font-bold flex items-center justify-center gap-1">
                        <Droplet className={`w-3 h-3 ${isCritical ? "text-rose-600 fill-rose-600" : "text-indigo-600"}`} />
                        {type}
                      </div>
                      <div className="text-sm font-black mt-0.5">
                        {count} <span className="text-[8px] font-normal text-slate-500">u</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Section 4 Human Call to Action: Informational, NOT automatic transfer */}
          <div className="pt-2 border-t border-slate-100 space-y-2">
            {selectedHosp.id !== "HOSP-01" ? (
              <button
                onClick={() => setContactModalHospital(selectedHosp)}
                disabled={selectedHosp.availableBeds === 0}
                className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition flex items-center justify-center gap-2 shadow-sm disabled:opacity-50"
              >
                <PhoneCall className="w-3.5 h-3.5 text-amber-400" />
                <span>Contact {selectedHosp.name.split(" ")[0]} to coordinate transfer ➔</span>
              </button>
            ) : (
              <div className="p-2.5 bg-slate-100 rounded-xl text-center text-xs font-bold text-slate-600">
                Primary Facility Selected (Local Command)
              </div>
            )}
            <p className="text-[10px] text-slate-400 text-center italic">
              Informational decision support only. Bed transfers require attending physician sign-off.
            </p>
          </div>
        </div>
      </div>

      {/* SECTION 2 & 3: Priority Ranking Table for ICU/Bed Capacity Routing */}
      {(activeSection === "all" || activeSection === "beds") && (
        <div id="bed-priority-section" className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden space-y-0">
          <div className="p-6 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-gradient-to-r from-amber-50/50 via-white to-white">
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-amber-100 text-amber-900 border border-amber-300">
                  Priority Scored Routing (Condition 2)
                </span>
                <span className="text-xs font-mono text-slate-400">Mock Score Ascending</span>
              </div>
              <h3 className="text-base font-black text-slate-900 tracking-tight mt-1 flex items-center gap-2">
                <Bed className="w-5 h-5 text-amber-600" />
                Regional Bed Capacity Priority Ranking (Nearest + Available + Partner First)
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                When SwasthAI Central ICU/ward is full, nearby facilities are ranked by the objective function: <code className="font-mono text-indigo-700 bg-indigo-50 px-1 py-0.2 rounded">distanceKm * 1.0 + (availableBeds === 0 ? 1000 : 0) + (tier === &apos;overflow_partner&apos; ? 0 : 5)</code>.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-500">
                Local Status: <strong className="text-rose-600 font-mono">0 ICU Beds Available</strong>
              </span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-4">Priority Rank</th>
                  <th className="py-3 px-4">Hospital Facility</th>
                  <th className="py-3 px-3">Network Tier</th>
                  <th className="py-3 px-3">Distance</th>
                  <th className="py-3 px-3 text-center">Available Beds</th>
                  <th className="py-3 px-3 text-center">ICU Beds Free</th>
                  <th className="py-3 px-3 text-center">Priority Score</th>
                  <th className="py-3 px-4 text-right">Human Coordination Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-sans">
                {rankedExternalHospitals.map((hosp, idx) => {
                  const score = priorityScore(hosp);
                  const isTopChoice = idx === 0;
                  const isDisqualified = hosp.availableBeds === 0;
                  const isSelected = hosp.id === selectedHospitalId;

                  return (
                    <tr
                      key={hosp.id}
                      onClick={() => setSelectedHospitalId(hosp.id)}
                      className={`cursor-pointer hover:bg-amber-50/40 transition ${
                        isSelected ? "bg-amber-50/60 font-semibold" : ""
                      } ${isDisqualified ? "opacity-60 bg-slate-50/60" : ""}`}
                    >
                      <td className="py-3.5 px-4 font-mono font-bold">
                        {isDisqualified ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-200 text-slate-600">
                            Disqualified
                          </span>
                        ) : (
                          <span className={`px-2.5 py-1 rounded-lg text-xs font-black ${
                            isTopChoice ? "bg-emerald-600 text-white shadow-xs" : "bg-slate-100 text-slate-700"
                          }`}>
                            #{idx + 1} {isTopChoice && "★ Recommended"}
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 font-bold text-slate-900">
                        <div className="flex items-center gap-2">
                          <Building2 className="w-4 h-4 text-indigo-600 shrink-0" />
                          <span>{hosp.name}</span>
                        </div>
                        <div className="text-[10px] text-slate-500 font-normal pl-6">
                          Contact: {hosp.transfer_desk_contact}
                        </div>
                      </td>

                      <td className="py-3.5 px-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                          hosp.tier === "overflow_partner" ? "bg-teal-100 text-teal-800 border-teal-200" :
                          "bg-slate-100 text-slate-700 border-slate-200"
                        }`}>
                          {hosp.tier === "overflow_partner" ? "Overflow Partner (Tier Bonus: 0)" : "Secondary Network (Tier Bonus: +5)"}
                        </span>
                      </td>

                      <td className="py-3.5 px-3 font-mono text-slate-700 font-semibold">
                        {hosp.distanceKm} km
                      </td>

                      <td className="py-3.5 px-3 text-center">
                        <span className={`px-2 py-0.5 rounded font-mono font-bold text-xs ${
                          hosp.availableBeds === 0 ? "bg-rose-100 text-rose-700" : "bg-emerald-50 text-emerald-800"
                        }`}>
                          {hosp.availableBeds} beds
                        </span>
                      </td>

                      <td className="py-3.5 px-3 text-center">
                        <span className={`px-2 py-0.5 rounded font-mono font-bold text-xs ${
                          hosp.icu_beds_available === 0 ? "bg-rose-100 text-rose-700" : "bg-amber-100 text-amber-900 font-black"
                        }`}>
                          {hosp.icu_beds_available} ICU
                        </span>
                      </td>

                      <td className="py-3.5 px-3 text-center font-mono font-bold">
                        <span className={`px-2 py-0.5 rounded ${
                          score > 500 ? "text-rose-600 bg-rose-50" : isTopChoice ? "text-emerald-700 bg-emerald-50" : "text-slate-700"
                        }`}>
                          {score.toFixed(1)}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedHospitalId(hosp.id);
                            setContactModalHospital(hosp);
                          }}
                          disabled={isDisqualified}
                          className={`px-3 py-1.5 text-[11px] font-bold rounded-xl transition shadow-xs flex items-center gap-1.5 ml-auto ${
                            isDisqualified
                              ? "bg-slate-200 text-slate-400 cursor-not-allowed"
                              : isTopChoice
                              ? "bg-amber-600 hover:bg-amber-700 text-white"
                              : "bg-slate-900 hover:bg-slate-800 text-white"
                          }`}
                        >
                          <Phone className="w-3 h-3" />
                          <span>Contact {hosp.name.split(" ")[0]} to coordinate transfer</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="bg-slate-50 px-6 py-3 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-500">
            <span>
              🛡️ <strong>Approval Gate:</strong> Nearest available partner (<strong className="text-slate-800">Metro General, 7.4 km</strong>) surfaces first. Full hospitals (<strong className="text-slate-800">North District, 0 beds</strong>) penalized +1000 and pushed to bottom.
            </span>
            <span className="text-slate-400">Zero automated diversions • Human-authorized gate verified</span>
          </div>
        </div>
      )}

      {/* SECTION 1: Blood-Type Inventory Table & Critical-Low Highlighting */}
      {(activeSection === "all" || activeSection === "blood") && (
        <div id="blood-matrix-section" className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-gradient-to-r from-rose-50/40 via-white to-white">
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-rose-100 text-rose-900 border border-rose-300">
                  Inventory Balancing (Condition 1)
                </span>
                <span className="text-xs font-mono text-slate-400">8 Blood Groups</span>
              </div>
              <h3 className="text-base font-black text-slate-900 tracking-tight mt-1 flex items-center gap-2">
                <Droplet className="w-5 h-5 text-rose-600 fill-rose-600" />
                Regional Blood-Type Inventory Matrix (Static Verification)
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Highlighted red cells indicate blood groups strictly below the configured safety threshold (&lt; {criticalThreshold} units).
              </p>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-600">
                <span className="w-3.5 h-3.5 rounded bg-rose-100 border border-rose-300 inline-block"></span>
                <span>Critical Deficit (&lt;{criticalThreshold} units)</span>
              </div>
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-600">
                <span className="w-3.5 h-3.5 rounded bg-slate-50 border border-slate-200 inline-block"></span>
                <span>Sufficient Reserve</span>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-4">Hospital Facility</th>
                  <th className="py-3 px-3">Tier</th>
                  <th className="py-3 px-3">Census</th>
                  {BLOOD_TYPES.map(bt => (
                    <th key={bt} className="py-3 px-3 text-center">
                      {bt}
                    </th>
                  ))}
                  <th className="py-3 px-3 text-center">Total Units</th>
                  <th className="py-3 px-4 text-right">Emergency Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-sans">
                {hospitals.map((hosp) => {
                  const totalUnits = Object.values(hosp.inventory).reduce((a, b) => a + b, 0);
                  const isSelected = hosp.id === selectedHospitalId;

                  return (
                    <tr
                      key={hosp.id}
                      onClick={() => setSelectedHospitalId(hosp.id)}
                      className={`cursor-pointer hover:bg-indigo-50/40 transition ${
                        isSelected ? "bg-indigo-50/60 font-semibold" : ""
                      }`}
                    >
                      <td className="py-3.5 px-4 font-bold text-slate-900">
                        <div className="flex items-center gap-2">
                          <Building2 className="w-4 h-4 text-indigo-600 shrink-0" />
                          <span>{hosp.name}</span>
                        </div>
                      </td>

                      <td className="py-3.5 px-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                          hosp.tier === "primary" ? "bg-indigo-100 text-indigo-800 border-indigo-200" :
                          hosp.tier === "overflow_partner" ? "bg-teal-100 text-teal-800 border-teal-200" :
                          "bg-slate-100 text-slate-700 border-slate-200"
                        }`}>
                          {hosp.tier_label}
                        </span>
                      </td>

                      <td className="py-3.5 px-3 font-mono text-slate-600">
                        {hosp.beds_occupied}/{hosp.beds_total}
                      </td>

                      {BLOOD_TYPES.map(bt => {
                        const count = hosp.inventory[bt];
                        const isLow = count < criticalThreshold;

                        return (
                          <td
                            key={bt}
                            className={`py-3.5 px-3 text-center font-mono ${
                              isLow
                                ? "bg-rose-100/70 text-rose-900 font-black border-x border-rose-200"
                                : "text-slate-800 font-medium"
                            }`}
                          >
                            <div className="flex flex-col items-center">
                              <span>{count}</span>
                              {isLow && (
                                <span className="text-[8px] font-sans font-bold bg-rose-600 text-white px-1 rounded-sm leading-tight mt-0.5">
                                  LOW
                                </span>
                              )}
                            </div>
                          </td>
                        );
                      })}

                      <td className="py-3.5 px-3 text-center font-mono font-bold text-slate-900">
                        {totalUnits}
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        {hosp.inventory["O-"] < criticalThreshold ? (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSimulateTransfer();
                            }}
                            disabled={transferring}
                            className="px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-bold rounded-lg transition shadow-sm"
                          >
                            Request O- ➔
                          </button>
                        ) : (
                          <span className="text-slate-400 text-[11px] italic">Adequate</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* HUMAN COORDINATION MODAL (Section 4: Call to action is a human next step, NOT an automatic transfer) */}
      {contactModalHospital && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden space-y-0">
            {/* Modal Header */}
            <div className="bg-slate-900 text-white p-5 flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-amber-500 text-slate-950 rounded-2xl shadow-sm">
                  <PhoneCall className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-300 border border-amber-400/30">
                      Human Coordination Gate
                    </span>
                    <span className="text-xs text-slate-400">Step 1 of 2</span>
                  </div>
                  <h3 className="text-base font-bold text-white mt-0.5">
                    Coordinate Inter-Facility Transfer
                  </h3>
                </div>
              </div>
              <button
                onClick={() => setContactModalHospital(null)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4 text-xs">
              {/* Receiving Hospital Info Card */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900 text-sm">{contactModalHospital.name}</span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-teal-100 text-teal-800">
                    {contactModalHospital.distanceKm} km away
                  </span>
                </div>
                <div className="text-slate-600 space-y-1">
                  <div>
                    Transfer Desk Officer: <strong className="text-slate-900">{contactModalHospital.transfer_desk_contact}</strong>
                  </div>
                  <div>
                    Direct Telephone Line: <strong className="text-indigo-600 font-mono text-sm">{contactModalHospital.phone}</strong>
                  </div>
                  <div className="flex items-center gap-3 pt-1 text-slate-700">
                    <span>Available Inpatient: <strong>{contactModalHospital.availableBeds} beds</strong></span>
                    <span>•</span>
                    <span>ICU Capacity: <strong className="text-emerald-700">{contactModalHospital.icu_beds_available} beds free</strong></span>
                  </div>
                </div>
              </div>

              {/* Clinical Guardrail Box */}
              <div className="p-3.5 bg-amber-50 rounded-2xl border border-amber-200 text-amber-900 space-y-1">
                <div className="font-bold flex items-center gap-1.5 text-amber-950">
                  <ShieldAlert className="w-4 h-4 text-amber-700 shrink-0" />
                  Statutory Clinical Gate Notice
                </div>
                <p className="text-[11px] leading-relaxed text-amber-900/90">
                  SwasthFlow AI suggests destination priority to alleviate local ICU saturation. <strong>The system never executes automated patient diversion.</strong> Direct telephone verbal confirmation from the receiving coordinator and attending physician authorization are mandatory before ambulance transport.
                </p>
              </div>

              {/* Coordination Notes Input */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-700 block">
                  Coordinator Call Notes / Patient Triage Summary:
                </label>
                <textarea
                  value={coordinationNotes}
                  onChange={(e) => setCoordinationNotes(e.target.value)}
                  placeholder="e.g. Spoke with Dr. Ramanathan at Metro General. 1 ICU bed with ventilator tentatively reserved for incoming trauma transfer. ETA 20 mins."
                  rows={3}
                  className="w-full p-2.5 border border-slate-200 rounded-xl text-xs bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500/30"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  onClick={() => setContactModalHospital(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleLogCoordinationCall}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl transition flex items-center gap-1.5 shadow-sm"
                >
                  <PhoneCall className="w-3.5 h-3.5" />
                  Log Clinical Coordination Call (Completed)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Named alias for backward compatibility and semantic clarity
export const RegionalMap = RegionalBloodInventory;
