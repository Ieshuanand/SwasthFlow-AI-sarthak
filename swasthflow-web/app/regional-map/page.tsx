"use client";

import React, { Suspense } from "react";
import Link from "next/link";
import { ArrowLeft, MapPin } from "lucide-react";
import { RegionalBloodInventory } from "../components/RegionalBloodInventory";

function RegionalMapPageContent() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-[#5b7b94]/30">
      {/* Top Header */}
      <header className="bg-slate-900/90 backdrop-blur-md border-b border-slate-800 sticky top-0 z-50 px-4 sm:px-6 py-3.5">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="px-3 py-1.5 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold transition flex items-center gap-1.5 shadow-sm"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Command Dashboard</span>
            </Link>
            <div className="h-4 w-px bg-slate-700 hidden sm:block"></div>
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center text-white">
                <MapPin className="w-4 h-4 text-white" />
              </div>
              <h1 className="text-sm sm:text-base font-black tracking-wide text-white">
                SwasthAI Regional Map &amp; Network Coordination
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="font-mono hidden sm:inline">5-Hospital Telemetry Live</span>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 flex-1 w-full space-y-6">
        <RegionalBloodInventory initialFocusSection="all" />
      </main>
    </div>
  );
}

export default function RegionalMapPage() {
  return (
    <Suspense fallback={<div className="p-12 text-center text-white">Loading Regional Map...</div>}>
      <RegionalMapPageContent />
    </Suspense>
  );
}
