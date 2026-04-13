"use client";

import { useEffect, useMemo, useState, useRef, useCallback } from "react";

type TimeRange = { start: string; end: string };
type WorkRange = { start: string; end: string; remote: boolean };
type DayRec = {
  date: string; weeklyHoliday?: boolean;
  clockIn: string | null; clockOut: string | null;
  workMin: number; restMin: number; timeOffMin: number;
  hasActual: boolean; ongoing?: boolean;
  workRanges?: WorkRange[];
  restRanges?: TimeRange[]; timeOffRanges?: TimeRange[];
};
type WorktimeData = {
  updatedAt: string; weekFrom: string; weekTo: string;
  requiredMin: number; doneMin: number; actualMin: number; timeOffMin: number;
  days: DayRec[];
};
type PlanDay = { clockIn?: string; clockOut?: string; timeOffMin?: number };
type PlanStore = Record<string, PlanDay>;

const STORAGE_KEY = "worktime-plans";
const WORK_CAP_MIN = 540;
const DAILY_TARGET_MIN = 480;
const WEEK_REQUIRED_MIN = 2400;
const WEEK_MAX_MIN = 3120;
const REST_START = 12 * 60 + 30;
const REST_END = 13 * 60 + 30;
const SNAP_MIN = 1;
const TL_START = 0;
const TL_END = 24 * 60;
const TL_RANGE = TL_END - TL_START;
const TL_WIDTH = 1600;
const TL_HOURS = Array.from({ length: 25 }, (_, i) => i);

function tlPct(min: number) { return Math.max(0, Math.min(100, ((min - TL_START) / TL_RANGE) * 100)); }
function tlPx(min: number) { return (tlPct(min) / 100) * TL_WIDTH; }
function restOverlap(ci: number, co: number): number { return Math.max(0, Math.min(co, REST_END) - Math.max(ci, REST_START)); }
const DOW_KO = ["일", "월", "화", "수", "목", "금", "토"];
function readPlans(): PlanStore { if (typeof window === "undefined") return {}; try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}"); } catch { return {}; } }
function writePlans(p: PlanStore) { localStorage.setItem(STORAGE_KEY, JSON.stringify(p)); }
function parseHM(s: string | null | undefined): number | null { if (!s) return null; const m = s.match(/^(\d{1,2}):(\d{2})$/); return m ? parseInt(m[1], 10) * 60 + parseInt(m[2], 10) : null; }
function fmtHM(t: number | null): string { if (t == null) return ""; return `${String(Math.floor(t / 60) % 24).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`; }
function fmtAmPm(hm: string): string { const m = parseHM(hm); if (m == null) return hm; const h = Math.floor(m / 60), min = m % 60; return `${h < 12 ? "오전" : "오후"} ${h === 0 ? 12 : h > 12 ? h - 12 : h}:${String(min).padStart(2, "0")}`; }
function fmtDur(t: number | null): string { if (t == null) return "-"; const s = t < 0 ? "-" : ""; t = Math.abs(t); return `${s}${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`; }
function getDow(d: string) { return DOW_KO[new Date(d + "T00:00:00+09:00").getDay()]; }
function dateNum(d: string) { return parseInt(d.slice(8, 10), 10); }
function snap(m: number) { return Math.round(m / SNAP_MIN) * SNAP_MIN; }
function fmtWeekRange(f: string, t: string) { const a = new Date(f + "T00:00:00+09:00"), b = new Date(t + "T00:00:00+09:00"); return `${a.getFullYear()}. ${a.getMonth() + 1}. ${a.getDate()} – ${b.getMonth() + 1}. ${b.getDate()}`; }

type MergedDay = {
  date: string; weeklyHoliday: boolean;
  clockIn: string | null; clockOut: string | null;
  workMin: number; restMin: number; timeOffMin: number;
  hasActual: boolean; ongoing?: boolean;
  source: "actual" | "plan" | "empty";
  workRanges?: WorkRange[];
  restRanges?: TimeRange[]; timeOffRanges?: TimeRange[];
};

function mergeDay(actual: DayRec | undefined, plan: PlanDay | undefined, date: string): MergedDay {
  if (actual && actual.hasActual) return { date, weeklyHoliday: actual.weeklyHoliday || false, clockIn: actual.clockIn, clockOut: actual.clockOut, workMin: actual.workMin, restMin: actual.restMin, timeOffMin: actual.timeOffMin, hasActual: true, ongoing: actual.ongoing, source: "actual", workRanges: actual.workRanges, restRanges: actual.restRanges, timeOffRanges: actual.timeOffRanges };
  const ci = plan?.clockIn || null, co = plan?.clockOut || null, ciM = parseHM(ci), coM = parseHM(co);
  let workMin = 0, restMin = 0;
  if (ciM != null && coM != null) { restMin = restOverlap(ciM, coM); workMin = Math.max(0, coM - ciM - restMin); }
  return { date, weeklyHoliday: actual?.weeklyHoliday || false, clockIn: ci, clockOut: co, workMin, restMin, timeOffMin: plan?.timeOffMin || 0, hasActual: false, source: plan && (ci || co || plan.timeOffMin) ? "plan" : "empty" };
}
function recMin(d: MergedDay) { return Math.min(d.workMin || 0, WORK_CAP_MIN) + (d.timeOffMin || 0); }
function isFinal(d: MergedDay) { if (d.source !== "actual") return false; if (!d.ongoing) return true; return d.date < new Date().toISOString().slice(0, 10); }
function weekDates(f: string, t: string) { const out: string[] = []; const s = new Date(f + "T00:00:00+09:00"), e = new Date(t + "T00:00:00+09:00"); for (let d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) out.push(new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10)); return out; }
function otStartMin(ci: number, rest: number, off: number) { return ci + Math.max(0, DAILY_TARGET_MIN - off) + rest; }

// ─── Calendar Popup ───
function CalendarPopup({ weekFrom, onSelect, onClose }: { weekFrom: string; onSelect: (date: string) => void; onClose: () => void }) {
  const base = new Date(weekFrom + "T00:00:00+09:00");
  const [year, setYear] = useState(base.getFullYear());
  const [month, setMonth] = useState(base.getMonth());
  const today = new Date().toISOString().slice(0, 10);

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = Array(firstDay).fill(null).concat(Array.from({ length: daysInMonth }, (_, i) => i + 1));
  while (cells.length % 7 !== 0) cells.push(null);

  const wfDate = new Date(weekFrom + "T00:00:00+09:00");
  const weDate = new Date(wfDate); weDate.setDate(wfDate.getDate() + 6);

  function isInWeek(d: number) {
    const date = new Date(year, month, d);
    return date >= wfDate && date <= weDate;
  }
  function isToday(d: number) {
    const s = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    return s === today;
  }

  return (
    <div className="absolute top-full left-0 mt-1 bg-white rounded-xl shadow-xl border border-gray-200 p-4 z-50 w-[280px]" onClick={(e) => e.stopPropagation()}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-semibold text-gray-800">{year}년 {month + 1}월</span>
        <div className="flex gap-1">
          <button onClick={() => { if (month === 0) { setYear(year - 1); setMonth(11); } else setMonth(month - 1); }} className="w-6 h-6 flex items-center justify-center rounded hover:bg-gray-100 text-gray-400 text-sm">‹</button>
          <button onClick={() => { if (month === 11) { setYear(year + 1); setMonth(0); } else setMonth(month + 1); }} className="w-6 h-6 flex items-center justify-center rounded hover:bg-gray-100 text-gray-400 text-sm">›</button>
        </div>
      </div>
      <div className="grid grid-cols-7 text-[10px] text-gray-400 mb-1">
        {["일", "월", "화", "수", "목", "금", "토"].map((d) => <div key={d} className="text-center py-1">{d}</div>)}
      </div>
      <div className="grid grid-cols-7">
        {cells.map((d, i) => d ? (
          <button key={i} onClick={() => { const s = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`; onSelect(s); onClose(); }}
            className={`text-xs py-1.5 text-center rounded-md transition-colors
              ${isToday(d) ? "bg-green-500 text-white font-bold" : isInWeek(d) ? "bg-green-100 text-green-800" : "text-gray-700 hover:bg-gray-100"}
              ${i % 7 === 0 ? "text-red-400" : ""}`}>
            {d}
          </button>
        ) : <div key={i} />)}
      </div>
    </div>
  );
}

// ─── Editable Timeline ───
type DragMode = "move" | "resizeStart" | "resizeEnd" | "create" | null;
type DragState = { mode: DragMode; startX: number; origCi: number; origCo: number; barEl: HTMLElement | null };

function EditableTimeline({ day, onChange, onClear }: { day: MergedDay; onChange: (ci: number, co: number) => void; onClear: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [tCi, setTCi] = useState<number | null>(null);
  const [tCo, setTCo] = useState<number | null>(null);
  const ci = tCi ?? parseHM(day.clockIn), co = tCo ?? parseHM(day.clockOut);
  const x2m = useCallback((x: number) => { const el = ref.current; if (!el) return 0; const r = el.getBoundingClientRect(); return snap(TL_START + (Math.max(0, Math.min(r.width, x - r.left)) / r.width) * TL_RANGE); }, []);
  function start(mode: DragMode, e: React.PointerEvent) { e.stopPropagation(); e.preventDefault(); const el = e.currentTarget as HTMLElement; el.setPointerCapture(e.pointerId); let oci = ci ?? 600, oco = co ?? 1140; if (mode === "create") { const t = x2m(e.clientX); oci = t; oco = Math.min(TL_END, t + 540); setTCi(oci); setTCo(oco); } setDrag({ mode, startX: e.clientX, origCi: oci, origCo: oco, barEl: el }); }
  function move(e: React.PointerEvent) { if (!drag) return; const dx = e.clientX - drag.startX, w = ref.current?.getBoundingClientRect().width || 1, dm = snap((dx / w) * TL_RANGE); if (drag.mode === "move" || drag.mode === "create") { let a = drag.origCi + (drag.mode === "move" ? dm : 0), b = drag.origCo + (drag.mode === "move" ? dm : 0); if (drag.mode === "create") { const n = x2m(e.clientX); if (n >= drag.origCi) { a = drag.origCi; b = Math.max(a + 1, n); } else { a = n; b = drag.origCi; } } if (drag.mode === "move") { const d = drag.origCo - drag.origCi; if (a < 0) { a = 0; b = d; } if (b > TL_END) { b = TL_END; a = b - d; } } setTCi(a); setTCo(b); } else if (drag.mode === "resizeStart") { setTCi(Math.max(0, Math.min(drag.origCo - 1, drag.origCi + dm))); setTCo(drag.origCo); } else if (drag.mode === "resizeEnd") { setTCi(drag.origCi); setTCo(Math.max(drag.origCi + 1, Math.min(TL_END, drag.origCo + dm))); } }
  function end(e: React.PointerEvent) { if (!drag) return; if (drag.barEl) try { drag.barEl.releasePointerCapture(e.pointerId); } catch {} if (tCi != null && tCo != null) onChange(tCi, tCo); setDrag(null); setTimeout(() => { setTCi(null); setTCo(null); }, 50); }
  const has = ci != null && co != null;
  return (
    <div ref={ref} className="group relative h-full select-none touch-none" onPointerDown={(e) => { if (!has) start("create", e); }} onPointerMove={move} onPointerUp={end} onPointerCancel={end}>
      {has && ci != null && co != null && (
        <div className="group/b absolute top-0 bottom-0 bg-blue-300/50 hover:bg-blue-300/70 rounded cursor-grab active:cursor-grabbing" style={{ left: `${tlPct(ci)}%`, width: `${Math.max(0.5, tlPct(co) - tlPct(ci))}%` }} onPointerDown={(e) => start("move", e)} onPointerMove={move} onPointerUp={end} onPointerCancel={end}>
          <div className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize rounded-l" onPointerDown={(e) => start("resizeStart", e)} />
          <div className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize rounded-r" onPointerDown={(e) => start("resizeEnd", e)} />
          <button onPointerDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); onClear(); }} className="hidden group-hover/b:flex absolute -top-2 -right-2 w-4 h-4 rounded-full bg-white border border-gray-300 text-gray-400 hover:bg-red-500 hover:text-white items-center justify-center text-[9px] z-10">✕</button>
        </div>
      )}
      {!has && <div className="absolute inset-0 flex items-center justify-center text-[10px] text-gray-300 pointer-events-none">드래그해서 계획</div>}
    </div>
  );
}

// ─── Readonly Timeline ───
function ReadonlyTimeline({ day }: { day: MergedDay }) {
  const ci = parseHM(day.clockIn), co = parseHM(day.clockOut);
  const now = new Date().getHours() * 60 + new Date().getMinutes();
  const end = co != null ? co : day.ongoing ? now : null;
  const ot = ci != null ? otStartMin(ci, day.restMin, day.timeOffMin) : null;
  const hasOt = ot != null && end != null && end > ot;
  return (
    <div className="relative h-full">
      {/* 개별 근무 블록 — 외근: 핑크, 사무실: amber */}
      {day.workRanges && day.workRanges.length > 0 ? day.workRanges.map((wr, i) => {
        const ws = parseHM(wr.start), we = parseHM(wr.end);
        if (ws == null || we == null) return null;
        return <div key={`w${i}`} className={`absolute top-0 bottom-0 rounded ${wr.remote ? "bg-pink-300" : day.ongoing ? "bg-amber-300/80 animate-pulse" : "bg-amber-300"}`}
          style={{ left: `${tlPct(ws)}%`, width: `${Math.max(0.3, tlPct(we) - tlPct(ws))}%` }} />;
      }) : ci != null && end != null && (
        <div className={`absolute top-0 bottom-0 rounded ${day.ongoing ? "bg-amber-300/80 animate-pulse" : "bg-amber-300"}`}
          style={{ left: `${tlPct(ci)}%`, width: `${Math.max(0.3, tlPct(end) - tlPct(ci))}%` }} />
      )}
      {/* 초과 근무 — 노란 바 상단 빨간 라인 */}
      {hasOt && ot != null && end != null && (
        <div className="absolute top-0 h-[3px] bg-red-400 rounded-t"
          style={{ left: `${tlPct(ot)}%`, width: `${Math.max(0.2, tlPct(end) - tlPct(ot))}%` }} />
      )}
      {/* 휴게 */}
      {day.restRanges?.map((r, i) => {
        const s = parseHM(r.start), e = parseHM(r.end);
        return s != null && e != null ? <div key={`r${i}`} className="absolute top-0 bottom-0 bg-white/50 rounded" style={{ left: `${tlPct(s)}%`, width: `${Math.max(0.2, tlPct(e) - tlPct(s))}%` }} /> : null;
      })}
      {/* 휴가 */}
      {day.timeOffRanges?.map((r, i) => {
        const s = parseHM(r.start), e = parseHM(r.end);
        return s != null && e != null ? <div key={`t${i}`} className="absolute top-0 bottom-0 bg-purple-300/80 rounded" style={{ left: `${tlPct(s)}%`, width: `${Math.max(0.3, tlPct(e) - tlPct(s))}%` }} /> : null;
      })}
    </div>
  );
}

// ─── Main ───
export default function WorktimePage() {
  const [data, setData] = useState<WorktimeData | null>(null);
  const [plans, setPlansState] = useState<PlanStore>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [weekOffset, setWeekOffset] = useState(0);
  const [calOpen, setCalOpen] = useState(false);
  const [todayClockIn, setTodayClockIn] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // 오늘 출근시간 localStorage 관리
  useEffect(() => {
    const stored = localStorage.getItem("worktime-today-clockin");
    if (stored) {
      try {
        const { date, time } = JSON.parse(stored);
        const today = new Date().toISOString().slice(0, 10);
        if (date === today) setTodayClockIn(time);
        else localStorage.removeItem("worktime-today-clockin");
      } catch { localStorage.removeItem("worktime-today-clockin"); }
    }
  }, []);

  function setClockIn(time: string) {
    const today = new Date().toISOString().slice(0, 10);
    localStorage.setItem("worktime-today-clockin", JSON.stringify({ date: today, time }));
    setTodayClockIn(time);
  }

  const weekOfDate = useMemo(() => { const d = new Date(); d.setDate(d.getDate() + weekOffset * 7); return d.toISOString().slice(0, 10); }, [weekOffset]);
  const refresh = useCallback(async () => { try { setLoading(true); const r = await fetch(`/api/worktime?weekOf=${weekOfDate}`, { cache: "no-store" }); if (!r.ok) throw new Error(`${r.status}`); setData(await r.json()); setError(null); } catch (e) { setError((e as Error).message); } finally { setLoading(false); } }, [weekOfDate]);
  useEffect(() => { setPlansState(readPlans()); refresh(); const id = setInterval(refresh, 60_000); return () => clearInterval(id); }, [refresh]);
  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollLeft = tlPx(8 * 60); }, [data]);

  function goToDate(dateStr: string) {
    const target = new Date(dateStr + "T00:00:00+09:00");
    const now = new Date();
    const diff = Math.round((target.getTime() - now.getTime()) / (7 * 86400000));
    setWeekOffset(diff);
  }

  function updatePlan(date: string, ci: number, co: number) { const n = { ...plans, [date]: { ...(plans[date] || {}), clockIn: fmtHM(ci), clockOut: fmtHM(co) } }; writePlans(n); setPlansState(n); }
  function clearPlan(date: string) { const n = { ...plans }; delete n[date]; writePlans(n); setPlansState(n); }

  const dates = useMemo(() => data ? weekDates(data.weekFrom, data.weekTo) : [], [data]);
  const byDate = useMemo(() => data ? new Map(data.days.map((d) => [d.date, d])) : new Map<string, DayRec>(), [data]);
  const merged = useMemo(() => data ? dates.map((dt) => mergeDay(byDate.get(dt), plans[dt], dt)) : [], [data, dates, plans, byDate]);
  const totals = useMemo(() => { let r = 0; for (const d of merged) if (d.source === "actual") r += recMin(d); return { rec: r, remT: Math.max(0, WEEK_REQUIRED_MIN - r), remM: Math.max(0, WEEK_MAX_MIN - r) }; }, [merged]);

  const todayStr = new Date().toISOString().slice(0, 10);
  const nowMin = new Date().getHours() * 60 + new Date().getMinutes();
  const isCur = weekOffset === 0;

  return (
    <div className="min-h-screen bg-white text-gray-900" onClick={() => calOpen && setCalOpen(false)}>
      <div className="max-w-[100vw] mx-auto">

        {/* ─── Header ─── */}
        <div className="flex items-center px-4 py-2.5 sticky top-0 bg-white z-20 border-b border-gray-100">
          {/* Week selector — 하나의 pill 안에 화살표+날짜 */}
          <div className="relative flex items-center border border-gray-200 rounded-full overflow-hidden">
            <button onClick={() => setWeekOffset(weekOffset - 1)} className="w-9 h-9 flex items-center justify-center text-gray-400 hover:bg-gray-50 hover:text-gray-600 text-lg border-r border-gray-200">‹</button>
            <button onClick={(e) => { e.stopPropagation(); setCalOpen(!calOpen); }}
              className="text-sm text-gray-700 px-5 py-2 hover:bg-gray-50 font-medium min-w-[150px] text-center">
              {data ? fmtWeekRange(data.weekFrom, data.weekTo) : "..."}
            </button>
            <button onClick={() => setWeekOffset(weekOffset + 1)} className="w-9 h-9 flex items-center justify-center text-gray-400 hover:bg-gray-50 hover:text-gray-600 text-lg border-l border-gray-200">›</button>
            {calOpen && data && <CalendarPopup weekFrom={data.weekFrom} onSelect={goToDate} onClose={() => setCalOpen(false)} />}
          </div>
          <button onClick={() => setWeekOffset(0)} className="ml-3 text-[13px] text-gray-500 hover:text-gray-800">오늘</button>
        </div>

        {error && <div className="mx-4 my-2 p-2 bg-red-50 text-red-500 rounded text-xs border border-red-100">{error}</div>}

        {/* ─── Timeline ─── */}
        <div ref={scrollRef} className="overflow-x-auto hide-scrollbar">
          <div style={{ width: `${TL_WIDTH + 160}px`, minWidth: "100%" }}>

            {/* Hour header */}
            <div className="flex">
              <div className="w-[160px] shrink-0" />
              <div className="relative h-6 border-b border-gray-100" style={{ width: `${TL_WIDTH}px` }}>
                {TL_HOURS.map((h) => (
                  <div key={h} className="absolute text-[10px] text-gray-300 -translate-x-1/2" style={{ left: `${tlPct(h * 60)}%`, bottom: "2px" }}>
                    {h === 0 || h === 24 ? "" : h === 12 ? <span className="text-gray-400">정오<br/><span className="text-[9px]">12</span></span> : h > 12 ? h - 12 : h}
                  </div>
                ))}
                {isCur && <div className="absolute text-[10px] font-mono text-red-400 -translate-x-1/2 font-semibold" style={{ left: `${tlPct(nowMin)}%`, bottom: "2px" }}>{fmtAmPm(fmtHM(nowMin))}</div>}
              </div>
            </div>

            {/* Day rows */}
            {dates.map((dt, i) => {
              const d = merged[i]; if (!d) return null;
              const ad = byDate.get(dt), pd = plans[dt];
              const rec = recMin(d);
              const isT = dt === todayStr, dow = getDow(dt);
              const di = new Date(dt + "T00:00:00+09:00").getDay();
              const isWe = di === 0 || di === 6;
              const hasA = ad?.hasActual || false, fin = isFinal(d), ong = hasA && !fin;
              const isOt = rec > DAILY_TARGET_MIN;
              let pm = mergeDay(undefined, pd, dt);
              // 오늘 + actual 출근시간이 있으면 계획 시작시간을 actual에 맞춤
              if (isT && hasA && ad!.clockIn && pm.clockIn) {
                const actualCi = parseHM(ad!.clockIn);
                const planCi = parseHM(pm.clockIn);
                const planCo = parseHM(pm.clockOut);
                if (actualCi != null && planCi != null && actualCi !== planCi && planCo != null) {
                  const dur = planCo - planCi;
                  const newCo = actualCi + dur;
                  const newPlan = { ...pd, clockIn: fmtHM(actualCi), clockOut: fmtHM(Math.min(newCo, TL_END)) };
                  pm = mergeDay(undefined, newPlan, dt);
                }
              }
              const am: MergedDay | null = hasA ? { date: dt, weeklyHoliday: ad!.weeklyHoliday || false, clockIn: ad!.clockIn, clockOut: ad!.clockOut, workMin: ad!.workMin, restMin: ad!.restMin, timeOffMin: ad!.timeOffMin, hasActual: true, ongoing: ong, source: "actual", workRanges: ad!.workRanges, restRanges: ad!.restRanges, timeOffRanges: ad!.timeOffRanges } : null;

              return (
                <div key={dt} className={`flex ${isT ? "bg-green-50/40" : ""}`} style={{ borderBottom: "1px solid #f5f5f5" }}>
                  {/* Left — sticky with right shadow mask */}
                  <div className="w-[160px] shrink-0 flex items-center gap-3 py-4 pl-4 pr-2 sticky left-0 z-[5]"
                    style={{ backgroundColor: isT ? "#f0fdf4" : "white", boxShadow: "6px 0 12px 0px rgba(0,0,0,0.06)" }}>
                    <div className="flex items-baseline gap-1 min-w-[40px]">
                      {isT
                        ? <span className="w-6 h-6 rounded-full bg-green-500 text-white text-[11px] font-bold flex items-center justify-center">{dateNum(dt)}</span>
                        : <span className={`text-[15px] font-medium ${isWe ? "text-red-400" : "text-gray-800"}`}>{dateNum(dt)}</span>}
                      <span className={`text-[12px] ${isT ? "text-green-600" : isWe ? "text-red-400" : "text-gray-400"}`}>{dow}</span>
                    </div>
                    {/* 오늘 + actual 없음: 출근시간 입력 가능 */}
                    {isT && !hasA ? (
                      <button
                        onClick={() => {
                          const input = prompt("출근 시간 입력 (예: 10:30)", todayClockIn || "");
                          if (input && /^\d{1,2}:\d{2}$/.test(input.trim())) setClockIn(input.trim());
                        }}
                        className={`text-[12px] font-mono whitespace-nowrap rounded-md px-1.5 py-0.5 ${todayClockIn ? "bg-amber-50 text-amber-600 border border-amber-200" : "border border-dashed border-gray-300 text-gray-400"}`}
                      >
                        {todayClockIn ? fmtDur(Math.max(0, nowMin - parseHM(todayClockIn)! - (nowMin > REST_START && parseHM(todayClockIn)! < REST_END ? Math.min(60, nowMin - REST_START) : 0))) : "출근 입력"}
                      </button>
                    ) : (
                      <span className={`text-[12px] font-mono whitespace-nowrap rounded-md px-1.5 py-0.5 ${isOt ? "bg-red-50 text-red-500 font-semibold" : rec > 0 ? "text-gray-600" : "border border-gray-200 text-gray-400"}`}>
                        {fmtDur(rec)}{isOt ? " 🔥" : ""}
                      </span>
                    )}
                  </div>

                  {/* Timeline area */}
                  <div className="relative py-3" style={{ width: `${TL_WIDTH}px`, minHeight: "68px" }}>
                    {TL_HOURS.map((h) => (
                      <div key={h} className={`absolute top-0 bottom-0 ${h === 12 ? "border-l border-dashed border-gray-200" : "border-l border-gray-50"}`} style={{ left: `${tlPct(h * 60)}%` }} />
                    ))}
                    {isCur && <div className="absolute top-0 bottom-0 w-[1.5px] bg-red-400 z-[4]" style={{ left: `${tlPct(nowMin)}%` }} />}

                    <div className="relative" style={{ height: "30px", marginTop: "2px" }}>
                      {fin ? <ReadonlyTimeline day={am!} /> : (
                        <>
                          <div className={hasA ? "opacity-25 h-full" : "h-full"}>
                            <EditableTimeline day={pm} onChange={(a, b) => updatePlan(dt, a, b)} onClear={() => clearPlan(dt)} />
                          </div>
                          {am && <div className="absolute inset-0 pointer-events-none"><ReadonlyTimeline day={am} /></div>}
                          {/* 오늘 + actual 없음 + 출근시간 있음 → 출근~현재 진행중 바 */}
                          {isT && !hasA && (() => {
                            const ci = todayClockIn ? parseHM(todayClockIn) : (pm.clockIn ? parseHM(pm.clockIn) : null);
                            if (ci == null || nowMin <= ci) return null;
                            return <div className="absolute inset-0 pointer-events-none">
                              <div className="relative h-full">
                                <div className="absolute top-0 bottom-0 rounded bg-amber-300/70 animate-pulse"
                                  style={{ left: `${tlPct(ci)}%`, width: `${Math.max(0.3, tlPct(nowMin) - tlPct(ci))}%` }} />
                              </div>
                            </div>;
                          })()}
                        </>
                      )}
                    </div>

                    {/* 라벨: 한 줄에 actual + plan 합침 */}
                    <div className="relative text-[10px] mt-0.5 h-4">
                      {/* actual 라벨 */}
                      {hasA && (
                        <>
                          {ad!.workRanges ? ad!.workRanges.map((wr, j) => {
                            const ws = parseHM(wr.start);
                            if (ws == null) return null;
                            return <span key={`ws${j}`} className="absolute whitespace-nowrap text-gray-400" style={{ left: `${tlPct(ws)}%` }}>
                              {fmtAmPm(wr.start)}
                              {j === 0 && ad!.restRanges && ad!.restRanges.length > 0 && <span className="text-gray-300 ml-1">휴게 {ad!.restRanges.length}건</span>}
                            </span>;
                          }) : ad!.clockIn && <span className="absolute whitespace-nowrap text-gray-400" style={{ left: `${tlPct(parseHM(ad!.clockIn)!)}%` }}>{fmtAmPm(ad!.clockIn)}{ad!.restRanges && ad!.restRanges.length > 0 && <span className="text-gray-300 ml-1">휴게 {ad!.restRanges.length}건</span>}</span>}
                          {ad!.clockOut && <span className={`absolute whitespace-nowrap text-gray-400 ${ong ? "text-red-500" : ""}`} style={{ left: `${tlPct(parseHM(ad!.clockOut)!)}%`, transform: "translateX(-100%)" }}>{fmtAmPm(ad!.clockOut)}</span>}
                          {ad!.timeOffRanges?.map((r, j) => <span key={`to${j}`} className="absolute whitespace-nowrap text-purple-400" style={{ left: `${tlPct(parseHM(r.start)!)}%` }}>{fmtAmPm(r.start)}</span>)}
                          {ad!.timeOffRanges?.map((r, j) => { const e = parseHM(r.end); return e != null ? <span key={`te${j}`} className="absolute whitespace-nowrap text-purple-400" style={{ left: `${tlPct(e)}%`, transform: "translateX(-100%)" }}>{fmtAmPm(r.end)}</span> : null; })}
                        </>
                      )}
                      {/* plan 라벨 — actual과 겹치지 않는 시간만 */}
                      {!fin && pm.clockIn && pm.clockOut && (() => {
                        const planCiSame = hasA && ad!.clockIn === pm.clockIn;
                        const planCoSame = hasA && ad!.clockOut === pm.clockOut;
                        if (planCiSame && planCoSame) return null;
                        return <>
                          {!planCiSame && !hasA && <span className="absolute whitespace-nowrap text-blue-400" style={{ left: `${tlPct(parseHM(pm.clockIn)!)}%` }}>{fmtAmPm(pm.clockIn!)}</span>}
                          <span className="absolute whitespace-nowrap text-blue-400" style={{ left: `${tlPct(parseHM(pm.clockOut)!)}%`, transform: "translateX(-100%)" }}>{fmtAmPm(pm.clockOut!)}</span>
                        </>;
                      })()}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Weekly summary */}
        {data && (
          <div className="flex flex-col items-center py-6 gap-1">
            <div className="flex items-center justify-center gap-1.5 text-[11px] font-mono text-gray-400">
              <span>-{fmtDur(totals.remT)}</span>
              <span className="text-gray-300">⚑</span>
              <span className="text-gray-300">-{fmtDur(totals.remM)}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-2xl font-bold font-mono text-gray-500 tracking-tight leading-none">{fmtDur(totals.rec)}</span>
              <div className="w-48 relative">
                <div className="h-[7px] bg-gray-100 rounded-full">
                  <div className="h-full bg-teal-400/80 rounded-full transition-all" style={{ width: `${Math.min(100, (totals.rec / WEEK_MAX_MIN) * 100)}%` }} />
                </div>
                <div className="absolute top-[-2px] bottom-[-2px] w-[2px] bg-gray-300" style={{ left: `${(WEEK_REQUIRED_MIN / WEEK_MAX_MIN) * 100}%` }} />
              </div>
            </div>
          </div>
        )}

        {/* Legend */}
        <div className="px-4 py-3 flex items-center justify-between text-[10px] text-gray-400">
          <div className="flex gap-3">
            <span className="flex items-center gap-1"><span className="w-2 h-2 bg-amber-300 rounded-full" />근무</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 bg-pink-300 rounded-full" />외근</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 bg-red-400 rounded-full" />초과</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 bg-purple-300 rounded-full" />휴가</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 bg-blue-300/50 rounded-full" />계획</span>
          </div>
          <button onClick={() => { if (confirm("계획 전부 지울까요?")) { writePlans({}); setPlansState({}); } }} className="text-gray-300 hover:text-red-400">계획 리셋</button>
        </div>
      </div>
    </div>
  );
}
