"use client";

import React, { useEffect, useMemo, useState } from "react";
import type { LucideIcon } from "lucide-react";
import { Search, ChevronDown, Check, ArrowUpRight, MoreHorizontal, X } from "lucide-react";

/*
 * Retro-terminal dashboard shell shared by the role workspaces
 * (Nurse, Doctor, Housekeeping, Phlebotomy, Patient). The Coordinator
 * command centre intentionally does not use it.
 *
 * Layout: tile sidebar | breadcrumb → headline + dial → today row → KPIs → tab deck.
 * Everything is sized for comfortable reading (≥12px, 40px+ hit targets).
 */

export const ACCENT = "#fb923c";
export const OK = "#34d399";
export const WARN = "#fbbf24";
export const BAD = "#f43f5e";
export const MUTED = "#475569";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export interface DashNavItem {
  id: string;
  label: string;
  Icon: LucideIcon;
  badge?: number | string;
}

export interface DashLink {
  id: string;
  label: string;
  Icon: LucideIcon;
  onClick: () => void;
  hint?: string;
}

export interface DashLinkGroup {
  title: string;
  items: DashLink[];
  defaultOpen?: boolean;
}

export interface DashSearchEntry {
  label: string;
  sub?: string;
  tab: string;
}

/* ------------------------------------------------------------------ */
/* Shell                                                               */
/* ------------------------------------------------------------------ */

interface DashShellProps {
  brandTitle: string;
  BrandIcon: LucideIcon;
  identity?: { name: string; sub: string; id?: string; emoji?: string };
  nav: DashNavItem[];
  activeId: string;
  onSelect: (id: string) => void;
  groups?: DashLinkGroup[];
  searchIndex?: DashSearchEntry[];
  searchPlaceholder?: string;
  sidebarFooter?: React.ReactNode;
  breadcrumb: string[];
  headerRight?: React.ReactNode;
  children: React.ReactNode;
}

export function DashShell({
  brandTitle,
  BrandIcon,
  identity,
  nav,
  activeId,
  onSelect,
  groups = [],
  searchIndex = [],
  searchPlaceholder = "Search...",
  sidebarFooter,
  breadcrumb,
  headerRight,
  children,
}: DashShellProps) {
  const [query, setQuery] = useState("");
  const extras = <ShellExtras groups={groups} sidebarFooter={sidebarFooter} />;

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return searchIndex
      .filter(e => e.label.toLowerCase().includes(q) || e.sub?.toLowerCase().includes(q))
      .slice(0, 6);
  }, [query, searchIndex]);

  const select = (id: string) => {
    onSelect(id);
    setQuery("");
    if (typeof window !== "undefined") {
      document.getElementById("dash-deck")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <div className="dash-readable flex flex-col lg:flex-row border border-white/10 bg-black min-h-[calc(100vh-9rem)] animate-fade-in">
      {/* ---------------- SIDEBAR ---------------- */}
      <aside className="lg:w-64 shrink-0 bg-black border-b lg:border-b-0 lg:border-r border-white/10">
        <div className="pt-7 pb-6 flex flex-col">
          {/* Brand */}
          <div className="hidden lg:flex px-6 mb-6 items-center gap-3">
            <BrandIcon className="w-6 h-6 text-[#fb923c] shrink-0" />
            <h1 className="text-xl font-bold uppercase tracking-tighter text-slate-100 leading-none">{brandTitle}</h1>
          </div>

          {/* Identity */}
          {identity && (
            <div className="hidden lg:flex mx-4 mb-6 p-3 border border-white/10 bg-[#0a0a0a] items-center gap-3">
              <div className="w-10 h-10 shrink-0 bg-[#fb923c]/15 border border-[#fb923c]/30 flex items-center justify-center text-xl">
                {identity.emoji ?? "👤"}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-emerald-400">
                  <span className="w-1.5 h-1.5 bg-emerald-400 animate-pulse" />
                  On Duty
                </div>
                <div className="text-sm font-bold text-white truncate normal-case" title={identity.name}>{identity.name}</div>
                <div className="text-[11px] text-slate-500 truncate normal-case" title={identity.sub}>
                  {identity.id ? `${identity.id} · ` : ""}{identity.sub}
                </div>
              </div>
            </div>
          )}

          {/* Search */}
          {searchIndex.length > 0 && (
            <div className="px-6 mb-6 relative">
              <label className="flex items-center text-slate-400 border-b border-white/20 focus-within:border-[#fb923c] pb-1.5 transition-colors">
                <Search className="w-4 h-4 mr-3 shrink-0" />
                <input
                  type="text"
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && results[0]) select(results[0].tab); if (e.key === "Escape") setQuery(""); }}
                  placeholder={searchPlaceholder}
                  aria-label="Search this dashboard"
                  className="bg-transparent border-none outline-none text-sm w-full placeholder-slate-600 text-slate-200"
                />
                {query && (
                  <button onClick={() => setQuery("")} aria-label="Clear search" className="text-slate-500 hover:text-white">
                    <X className="w-4 h-4" />
                  </button>
                )}
              </label>
              {query.trim() && (
                <div className="absolute left-4 right-4 top-full mt-1 z-30 bg-[#0a0a0a] border border-white/15 shadow-2xl">
                  {results.length === 0 ? (
                    <div className="px-3 py-3 text-xs text-slate-500 normal-case">No matches for “{query}”.</div>
                  ) : (
                    results.map((r, i) => (
                      <button
                        key={`${r.tab}-${r.label}-${i}`}
                        onClick={() => select(r.tab)}
                        className="w-full text-left px-3 py-2.5 hover:bg-white/5 border-b border-white/5 last:border-b-0 group"
                      >
                        <div className="text-sm text-white group-hover:text-[#fb923c] normal-case truncate">{r.label}</div>
                        {r.sub && <div className="text-[11px] text-slate-500 normal-case truncate">{r.sub}</div>}
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          )}

          {/* Tile grid */}
          <nav aria-label="Dashboard sections" className="mx-4 grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-2 gap-px bg-white/10 border border-white/10 mb-7">
            {nav.map((item, i) => {
              const active = item.id === activeId;
              const spanLast = nav.length % 2 === 1 && i === nav.length - 1;
              return (
                <button
                  key={item.id}
                  onClick={() => select(item.id)}
                  aria-current={active ? "page" : undefined}
                  className={`relative flex flex-col items-center justify-center gap-2 p-3 min-h-[92px] transition-colors group ${
                    spanLast ? "lg:col-span-2" : ""
                  } ${
                    active
                      ? "bg-[#0a0a0a] outline outline-1 -outline-offset-1 outline-[#fb923c] z-10"
                      : "bg-black hover:bg-[#0a0a0a]"
                  }`}
                >
                  {active && <span className="absolute top-0 right-0 w-1.5 h-1.5 bg-[#fb923c]" />}
                  {item.badge !== undefined && item.badge !== 0 && (
                    <span className={`absolute top-1.5 left-1.5 min-w-[20px] h-5 px-1 text-[10px] font-bold flex items-center justify-center ${
                      active ? "bg-[#fb923c] text-black" : "bg-white/10 text-slate-300"
                    }`}>
                      {item.badge}
                    </span>
                  )}
                  <item.Icon className={`w-5 h-5 transition-colors ${active ? "text-[#fb923c]" : "text-slate-400 group-hover:text-[#fb923c]"}`} />
                  <span className={`text-[11px] font-bold uppercase tracking-tight text-center leading-tight ${
                    active ? "text-[#fb923c]" : "text-slate-400 group-hover:text-slate-200"
                  }`}>
                    {item.label}
                  </span>
                </button>
              );
            })}
          </nav>

          {/* Link groups + footer: here on desktop, below the content on small screens */}
          <div className="hidden lg:block">{extras}</div>
        </div>
      </aside>

      {/* ---------------- MAIN ---------------- */}
      <section className="flex-1 min-w-0 bg-[#0a0a0a] px-5 sm:px-8 lg:px-10 pt-7 pb-12 space-y-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <nav aria-label="Breadcrumb" className="text-slate-500 text-sm font-bold uppercase tracking-tight">
            {breadcrumb.map((b, i) => (
              <span key={i}>
                {i > 0 && <span className="mx-2">/</span>}
                <span className={i === breadcrumb.length - 1 ? "text-slate-300" : ""}>{b}</span>
              </span>
            ))}
          </nav>
          {headerRight}
        </div>
        {children}
        <div className="lg:hidden -mx-4 pt-6 border-t border-white/10">{extras}</div>
      </section>
    </div>
  );
}

function ShellExtras({
  groups,
  sidebarFooter,
}: {
  groups: DashLinkGroup[];
  sidebarFooter?: React.ReactNode;
}) {
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(groups.map(g => [g.title, g.defaultOpen ?? true]))
  );
  return (
    <>
          <div className="px-4 space-y-5">
            {groups.map(g => {
              const open = openGroups[g.title] ?? true;
              return (
                <div key={g.title}>
                  <button
                    onClick={() => setOpenGroups(s => ({ ...s, [g.title]: !open }))}
                    aria-expanded={open}
                    className="w-full flex items-center text-slate-300 hover:text-white text-sm font-bold uppercase tracking-tight mb-3 px-2"
                  >
                    <ChevronDown className={`w-3.5 h-3.5 mr-2 transition-transform ${open ? "" : "-rotate-90"}`} />
                    {g.title}
                  </button>
                  {open && (
                    <div className="space-y-2">
                      {g.items.map(it => (
                        <button
                          key={it.id}
                          onClick={it.onClick}
                          title={it.hint}
                          className="w-full flex items-center justify-between p-3 min-h-[44px] bg-[#0a0a0a] hover:bg-[#151515] transition-colors border border-transparent hover:border-white/10 group text-left"
                        >
                          <span className="flex items-center gap-3 min-w-0">
                            <it.Icon className="w-4 h-4 shrink-0 text-slate-400 group-hover:text-[#fb923c]" />
                            <span className="text-sm text-slate-300 font-bold uppercase tracking-tight truncate">{it.label}</span>
                          </span>
                          <MoreHorizontal className="w-4 h-4 text-slate-600 group-hover:text-slate-300 shrink-0" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {sidebarFooter && <div className="px-4 mt-6 pt-5 border-t border-white/10">{sidebarFooter}</div>}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Headline + dial                                                     */
/* ------------------------------------------------------------------ */

export function DashHeadline({
  line1,
  line2,
  line3,
  aside,
}: {
  line1: React.ReactNode;
  line2?: React.ReactNode;
  line3?: React.ReactNode;
  aside?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-8">
      <h2 className="text-3xl sm:text-4xl xl:text-5xl font-bold uppercase tracking-tighter text-slate-100 leading-[1.1] max-w-3xl">
        {line1}
        {line2 && <span className="block font-normal text-slate-500 mt-2">{line2}</span>}
        {line3 && <span className="block text-emerald-400 mt-2">{line3}</span>}
      </h2>
      {aside && <div className="shrink-0">{aside}</div>}
    </div>
  );
}

/** Semi-circular retro dial. value is 0..1. */
export function DialGauge({
  value,
  label,
  display,
  color = ACCENT,
  size = 220,
}: {
  value: number;
  label: string;
  display?: string;
  color?: string;
  size?: number;
}) {
  const v = Math.max(0, Math.min(1, isFinite(value) ? value : 0));
  const w = size;
  const h = size / 2 + 18;
  const cx = w / 2;
  const cy = size / 2 + 4;
  const r = size / 2 - 14;
  const theta = Math.PI * (1 - v);
  const nx = cx + (r - 18) * Math.cos(theta);
  const ny = cy - (r - 18) * Math.sin(theta);
  const arc = `M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`;

  return (
    <figure className="flex flex-col items-center" aria-label={`${label}: ${display ?? Math.round(v * 100) + "%"}`}>
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} role="img">
        <path d={arc} fill="none" stroke="#334155" strokeWidth={4} />
        <path d={`M ${cx - r + 14} ${cy} A ${r - 14} ${r - 14} 0 0 1 ${cx + r - 14} ${cy}`} fill="none" stroke="#1e293b" strokeWidth={14} />
        <path
          d={`M ${cx - r + 14} ${cy} A ${r - 14} ${r - 14} 0 0 1 ${cx + r - 14} ${cy}`}
          fill="none"
          stroke={color}
          strokeWidth={14}
          pathLength={100}
          strokeDasharray={`${v * 100} 100`}
          style={{ transition: "stroke-dasharray 0.6s ease" }}
        />
        {Array.from({ length: 11 }).map((_, i) => {
          const a = Math.PI * (1 - i / 10);
          const x1 = cx + (r + 2) * Math.cos(a);
          const y1 = cy - (r + 2) * Math.sin(a);
          const x2 = cx + (r + (i % 5 === 0 ? 10 : 6)) * Math.cos(a);
          const y2 = cy - (r + (i % 5 === 0 ? 10 : 6)) * Math.sin(a);
          return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#64748b" strokeWidth={i % 5 === 0 ? 2 : 1} />;
        })}
        <line x1={cx} y1={cy} x2={nx} y2={ny} stroke={color} strokeWidth={2} style={{ transition: "all 0.6s ease" }} />
        <circle cx={nx} cy={ny} r={5} fill="#000" stroke={color} strokeWidth={2} />
        <rect x={cx - 4} y={cy - 4} width={8} height={8} fill={color} />
      </svg>
      <figcaption className="-mt-1 text-center">
        <div className="text-2xl font-bold text-white leading-none">{display ?? `${Math.round(v * 100)}%`}</div>
        <div className="text-[11px] font-bold uppercase tracking-widest text-slate-500 mt-1.5">{label}</div>
      </figcaption>
    </figure>
  );
}

/* ------------------------------------------------------------------ */
/* Section title + square icon buttons                                 */
/* ------------------------------------------------------------------ */

export function DashSectionTitle({
  title,
  count,
  total,
  children,
}: {
  title: string;
  count?: number;
  total?: number;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-5 mb-6">
      <h3 className="text-xl sm:text-2xl font-bold uppercase tracking-tight text-slate-200">
        {title}
        {count !== undefined && (
          <>
            <span className="text-[#fb923c] text-lg ml-3">{count}</span>
            {total !== undefined && <span className="text-slate-500 text-sm">/{total}</span>}
          </>
        )}
      </h3>
      {children && <div className="flex gap-2">{children}</div>}
    </div>
  );
}

export function SquareIconButton({ Icon, label, onClick }: { Icon: LucideIcon; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      className="w-11 h-11 flex items-center justify-center bg-black border border-white/10 hover:border-[#fb923c] text-slate-400 hover:text-[#fb923c] transition-all"
    >
      <Icon className="w-4 h-4" />
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Today row: date tile · task list · stat widget                     */
/* ------------------------------------------------------------------ */

export function TodayRow({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 md:grid-cols-[12rem_1fr] xl:grid-cols-[12rem_1fr_17rem] gap-6 items-start">{children}</div>;
}

/** Shows the hospital (simulated) date when `clock` carries one, else today's date. */
export function DateTile({ clock }: { clock?: string }) {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => setNow(new Date()), []);

  // e.g. "Thursday, 10 Sep 2026, 06:00 AM"
  const sim = clock?.match(/(\d{1,2})\s+([A-Za-z]{3,})\s+(\d{4})/);
  const simDate = sim ? new Date(`${sim[2]} ${sim[1]}, ${sim[3]}`) : null;
  const date = simDate && !isNaN(simDate.getTime()) ? simDate : now;
  const time = clock?.match(/\d{1,2}:\d{2}\s*(AM|PM)?/i)?.[0];

  const day = date ? date.getDate() : "--";
  const month = date ? date.toLocaleString("en-US", { month: "long" }) : "";
  const weekday = date ? date.toLocaleString("en-US", { weekday: "long" }) : "";

  return (
    <div
      className="w-full md:w-48 h-48 p-6 flex flex-col justify-between relative overflow-hidden group border border-white/10 hover:border-slate-500 transition-colors"
      style={{ background: "radial-gradient(circle at 80% 80%, rgba(255,255,255,0.14) 0%, transparent 60%), #111" }}
    >
      <div className="absolute top-0 right-0 w-2 h-2 bg-slate-500 m-2 group-hover:bg-[#fb923c] transition-colors" />
      <div>
        <div className="text-6xl font-normal text-slate-100 tracking-tighter leading-none">{day}</div>
        <div className="text-lg text-slate-400 mt-1 uppercase tracking-tight font-bold">{month}</div>
      </div>
      <div className="flex items-end justify-between gap-2">
        <span className="text-sm text-slate-500 uppercase tracking-widest font-bold">{weekday}</span>
        {time && <span className="text-sm font-mono font-bold text-[#fb923c] normal-case" title={`Hospital clock: ${clock}`}>{time}</span>}
      </div>
    </div>
  );
}

export interface DashTask {
  id: string;
  label: string;
  meta?: string;
  done?: boolean;
  onCheck?: () => void;
  checkLabel?: string;
  onOpen?: () => void;
  busy?: boolean;
}

export function TaskList({ tasks, emptyText = "Nothing pending. All clear." }: { tasks: DashTask[]; emptyText?: string }) {
  const activeIdx = tasks.findIndex(t => !t.done);
  if (tasks.length === 0) {
    return (
      <div className="min-h-[3.5rem] flex items-center gap-3 px-4 border border-emerald-400/30 bg-emerald-400/5 text-emerald-300 text-sm normal-case">
        <Check className="w-4 h-4 shrink-0" /> {emptyText}
      </div>
    );
  }
  return (
    <ul className="flex flex-col gap-3 min-w-0">
      {tasks.map((t, i) => {
        const active = i === activeIdx;
        return (
          <li
            key={t.id}
            className={`flex items-stretch border transition-colors ${
              active ? "bg-[#fb923c] border-[#fb923c]" : "bg-[#1a1a1a] border-white/10 hover:border-white/30"
            }`}
          >
            <button
              onClick={t.onCheck}
              disabled={!t.onCheck || t.done || t.busy}
              title={t.done ? "Completed" : t.checkLabel ?? "Mark as done"}
              aria-label={t.done ? `${t.label} completed` : t.checkLabel ?? `Mark ${t.label} as done`}
              className={`w-14 shrink-0 min-h-[3.5rem] flex items-center justify-center border-r group/chk ${
                active ? "bg-black border-[#fb923c]" : "bg-black border-white/10"
              } ${t.onCheck && !t.done ? "cursor-pointer" : "cursor-default"}`}
            >
              {t.done ? (
                <Check className="w-5 h-5 text-emerald-400" />
              ) : t.busy ? (
                <span className="w-3 h-3 bg-[#fb923c] animate-pulse" />
              ) : t.onCheck ? (
                <Check className={`w-5 h-5 transition-opacity ${active ? "text-slate-300 opacity-60" : "text-slate-500 opacity-0"} group-hover/chk:opacity-100`} />
              ) : null}
            </button>
            <button
              onClick={t.onOpen}
              disabled={!t.onOpen}
              className="flex-1 min-w-0 flex items-center justify-between gap-3 px-4 py-2 text-left"
            >
              <span className="min-w-0">
                <span className={`block font-bold uppercase tracking-tight text-sm truncate ${
                  active ? "text-black" : t.done ? "text-slate-600 line-through" : "text-slate-300"
                }`}>
                  {t.label}
                </span>
                {t.meta && (
                  <span className={`block text-xs truncate normal-case ${active ? "text-black/70" : "text-slate-500"}`}>{t.meta}</span>
                )}
              </span>
              {t.onOpen && <ArrowUpRight className={`w-4 h-4 shrink-0 ${active ? "text-black" : "text-slate-500"}`} />}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

export function StatWidget({
  title,
  legend,
  chart,
  badge,
  onOpen,
}: {
  title: string;
  legend?: { label: string; color: string; value?: React.ReactNode }[];
  chart?: React.ReactNode;
  badge?: React.ReactNode;
  onOpen?: () => void;
}) {
  return (
    <div className="bg-black border border-white/10 p-5 relative min-h-48 flex flex-col gap-4 md:col-span-2 xl:col-span-1">
      <div className="flex justify-between items-start gap-2">
        <div className="text-sm text-slate-200 font-bold uppercase tracking-tight">{title}</div>
        {onOpen && (
          <button
            onClick={onOpen}
            title="Open details"
            aria-label={`Open ${title} details`}
            className="w-9 h-9 shrink-0 flex items-center justify-center border border-white/10 hover:border-[#fb923c] text-slate-400 hover:text-[#fb923c] transition-all"
          >
            <ArrowUpRight className="w-4 h-4" />
          </button>
        )}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-4 flex-1">
        {legend && (
          <ul className="space-y-2 text-xs uppercase tracking-wider font-bold">
            {legend.map(l => (
              <li key={l.label} className="flex items-center gap-2 text-slate-400">
                <span className="w-2 h-2 shrink-0" style={{ background: l.color }} />
                <span>{l.label}</span>
                {l.value !== undefined && <span className="text-slate-200 ml-1">{l.value}</span>}
              </li>
            ))}
          </ul>
        )}
        {chart}
      </div>
      {badge && <div>{badge}</div>}
    </div>
  );
}

export function Badge({ children, tone = "accent" }: { children: React.ReactNode; tone?: "accent" | "ok" | "warn" | "bad" }) {
  const cls = {
    accent: "bg-[#fb923c] text-black border-[#fb923c]",
    ok: "bg-emerald-400 text-black border-emerald-400",
    warn: "bg-amber-400 text-black border-amber-400",
    bad: "bg-rose-500 text-black border-rose-500",
  }[tone];
  return <span className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-1 border ${cls}`}>{children}</span>;
}

/* ------------------------------------------------------------------ */
/* KPI strip                                                           */
/* ------------------------------------------------------------------ */

export function KpiStrip({
  items,
}: {
  items: { label: string; value: React.ReactNode; sub?: React.ReactNode; color?: string }[];
}) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-white/10 border border-white/10">
      {items.map(k => (
        <div key={k.label} className="bg-black p-5 relative group hover:bg-[#111] transition-colors">
          <div className="absolute top-0 right-0 w-1.5 h-1.5 m-2 bg-slate-600 group-hover:bg-[#fb923c] transition-colors" />
          <div className="text-[11px] uppercase tracking-wider font-bold text-slate-500">{k.label}</div>
          <div className="text-3xl font-bold mt-2 leading-none" style={{ color: k.color ?? "#f1f5f9" }}>
            {k.value}
            {k.sub && <span className="text-xs font-normal text-slate-500 ml-1.5 normal-case">{k.sub}</span>}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Tab deck                                                            */
/* ------------------------------------------------------------------ */

export function TabDeck({
  tabs,
  active,
  onChange,
  children,
}: {
  tabs: DashNavItem[];
  active: string;
  onChange: (id: string) => void;
  children: React.ReactNode;
}) {
  return (
    <div id="dash-deck" className="border border-white/10 bg-black scroll-mt-24">
      <div role="tablist" className="flex w-full overflow-x-auto border-b border-white/10">
        {tabs.map(t => {
          const on = t.id === active;
          return (
            <button
              key={t.id}
              role="tab"
              aria-selected={on}
              onClick={() => onChange(t.id)}
              className={`px-5 sm:px-6 py-4 border-r border-white/10 font-bold uppercase tracking-tight text-sm whitespace-nowrap flex items-center gap-2 transition-colors ${
                on
                  ? "bg-[#0a0a0a] text-slate-100 shadow-[inset_0_-2px_0_#fb923c]"
                  : "bg-[#111] text-slate-500 hover:text-slate-300 hover:bg-[#0a0a0a]"
              }`}
            >
              <t.Icon className={`w-4 h-4 ${on ? "text-[#fb923c]" : ""}`} />
              {t.label}
              {t.badge !== undefined && t.badge !== 0 && (
                <span className={`text-[10px] px-1.5 py-0.5 ${on ? "bg-[#fb923c] text-black" : "bg-white/10 text-slate-400"}`}>{t.badge}</span>
              )}
            </button>
          );
        })}
        <div className="flex-1 bg-[#111]" />
      </div>
      {/* Child panels bring their own padding; drop their outer border inside the deck */}
      <div role="tabpanel" className="bg-[#0a0a0a] [&>div]:border-0">{children}</div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Charts (pure SVG / CSS, no dependencies)                            */
/* ------------------------------------------------------------------ */

export function Donut({
  segments,
  size = 104,
  thickness = 16,
  center,
}: {
  segments: { label: string; value: number; color: string }[];
  size?: number;
  thickness?: number;
  center?: React.ReactNode;
}) {
  const total = segments.reduce((s, x) => s + x.value, 0);
  const r = (size - thickness) / 2;
  let offset = 0;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" role="img"
        aria-label={segments.map(s => `${s.label} ${s.value}`).join(", ")}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#1e293b" strokeWidth={thickness} />
        {total > 0 && segments.map(s => {
          const len = (s.value / total) * 100;
          const el = (
            <circle
              key={s.label}
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={s.color}
              strokeWidth={thickness}
              pathLength={100}
              strokeDasharray={`${len} ${100 - len}`}
              strokeDashoffset={-offset}
            >
              <title>{`${s.label}: ${s.value}`}</title>
            </circle>
          );
          offset += len;
          return el;
        })}
      </svg>
      {center && <div className="absolute inset-0 flex items-center justify-center text-center">{center}</div>}
    </div>
  );
}

export function BarChart({
  data,
  height = 140,
  unit = "",
  max,
  refLine,
}: {
  data: { label: string; value: number; color?: string; hint?: string }[];
  height?: number;
  unit?: string;
  max?: number;
  refLine?: { value: number; label: string };
}) {
  const top = Math.max(max ?? 0, ...data.map(d => d.value), refLine?.value ?? 0, 1);
  return (
    <div className="w-full">
      <div className="relative flex items-end gap-2 sm:gap-3 border-b border-l border-white/15 pl-2" style={{ height }}>
        {refLine && (
          <div
            className="absolute left-0 right-0 border-t border-dashed border-[#fb923c]/70 pointer-events-none"
            style={{ bottom: `${(refLine.value / top) * 100}%` }}
          >
            <span className="absolute right-0 -top-5 text-[10px] font-bold uppercase tracking-wider text-[#fb923c]">{refLine.label}</span>
          </div>
        )}
        {data.map(d => (
          <div key={d.label} className="flex-1 min-w-0 h-full flex flex-col justify-end items-center group" title={d.hint ?? `${d.label}: ${d.value}${unit}`}>
            <span className="text-xs font-bold text-slate-200 mb-1">{d.value}{unit}</span>
            <div
              className="w-full max-w-[56px] transition-all duration-500 group-hover:brightness-125"
              style={{ height: `${(d.value / top) * 100}%`, minHeight: d.value > 0 ? 3 : 0, background: d.color ?? ACCENT }}
            />
          </div>
        ))}
      </div>
      <div className="flex gap-2 sm:gap-3 pl-2 mt-2">
        {data.map(d => (
          <div key={d.label} className="flex-1 min-w-0 text-center text-[11px] font-bold uppercase tracking-tight text-slate-500 truncate" title={d.label}>
            {d.label}
          </div>
        ))}
      </div>
    </div>
  );
}

export function HBarList({
  data,
  max = 1,
  format = v => `${Math.round(v * 100)}%`,
}: {
  data: { label: string; value: number; color?: string; sub?: string }[];
  max?: number;
  format?: (v: number) => string;
}) {
  return (
    <ul className="space-y-3 w-full">
      {data.map(d => (
        <li key={d.label}>
          <div className="flex justify-between gap-3 text-xs mb-1">
            <span className="text-slate-300 font-bold truncate normal-case">
              {d.label}
              {d.sub && <span className="text-slate-500 font-normal ml-2">{d.sub}</span>}
            </span>
            <span className="text-slate-200 font-bold shrink-0">{format(d.value)}</span>
          </div>
          <div className="h-2.5 bg-white/5 border border-white/10">
            <div
              className="h-full transition-all duration-500"
              style={{ width: `${Math.max(0, Math.min(1, d.value / max)) * 100}%`, background: d.color ?? ACCENT }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Horizontal time axis with per-row markers and an optional cutoff line. Times are minutes since midnight. */
export function ScheduleTimeline({
  start,
  end,
  rows,
  cutoff,
}: {
  start: number;
  end: number;
  rows: { label: string; points: { t: number; color: string; label: string }[] }[];
  cutoff?: { t: number; label: string };
}) {
  const pct = (t: number) => `${((Math.max(start, Math.min(end, t)) - start) / (end - start)) * 100}%`;
  const hours: number[] = [];
  for (let m = Math.ceil(start / 60) * 60; m <= end; m += 60) hours.push(m);
  const fmt = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

  return (
    <div className="w-full">
      <div className="grid grid-cols-[7rem_1fr] sm:grid-cols-[9rem_1fr] gap-x-3">
        <div />
        <div className="relative h-6 border-b border-white/15">
          {hours.map(h => (
            <span key={h} className="absolute -translate-x-1/2 text-[11px] font-mono text-slate-500" style={{ left: pct(h) }}>{fmt(h)}</span>
          ))}
        </div>
        {rows.map(r => (
          <React.Fragment key={r.label}>
            <div className="text-xs font-bold text-slate-300 truncate py-2.5 normal-case" title={r.label}>{r.label}</div>
            <div className="relative border-b border-white/5">
              {hours.map(h => (
                <span key={h} className="absolute top-0 bottom-0 w-px bg-white/5" style={{ left: pct(h) }} />
              ))}
              {cutoff && <span className="absolute top-0 bottom-0 w-0.5 bg-[#fb923c]/70" style={{ left: pct(cutoff.t) }} />}
              {r.points.length > 1 && (
                <span
                  className="absolute top-1/2 h-px bg-white/25"
                  style={{ left: pct(Math.min(...r.points.map(p => p.t))), width: `calc(${pct(Math.max(...r.points.map(p => p.t)))} - ${pct(Math.min(...r.points.map(p => p.t)))})` }}
                />
              )}
              {r.points.map(p => (
                <span
                  key={p.label}
                  title={`${p.label} · ${fmt(p.t)}`}
                  className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-3 border border-black"
                  style={{ left: pct(p.t), background: p.color }}
                />
              ))}
            </div>
          </React.Fragment>
        ))}
      </div>
      {cutoff && (
        <div className="mt-3 text-[11px] font-bold uppercase tracking-wider text-[#fb923c]">
          ▎ {cutoff.label} ({fmt(cutoff.t)})
        </div>
      )}
    </div>
  );
}

/** Grid of small squares, one per bed, coloured by state. */
export function BedGrid({ beds, colorFor }: { beds: { id: string; state: string }[]; colorFor: (state: string) => string }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {beds.map(b => (
        <span
          key={b.id}
          title={`${b.id} · ${b.state}`}
          className="w-9 h-9 flex items-center justify-center text-[9px] font-mono font-bold text-black"
          style={{ background: colorFor(b.state) }}
        >
          {b.id.replace(/^[A-Z]+-?/, "").slice(-3)}
        </span>
      ))}
    </div>
  );
}
