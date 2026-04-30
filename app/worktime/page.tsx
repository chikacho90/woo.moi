"use client";

import { useEffect, useMemo, useState, useRef, useCallback } from "react";

type TimeRange = { start: string; end: string };
type WorkRange = { start: string; end: string; remote: boolean };
type DayRec = {
  date: string; weeklyHoliday?: boolean; holidayName?: string;
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
type PlanTimeOffType = "am-quarter" | "am-half" | "pm-quarter" | "pm-half" | "full";
type PlanDay = { clockIn?: string; clockOut?: string; timeOffMin?: number; timeOffType?: PlanTimeOffType };
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
// 모바일: 7시~23시 범위
const ML_START = 7 * 60, ML_END = 23 * 60, ML_RANGE = ML_END - ML_START;
function mlPct(min: number) { return Math.max(0, Math.min(100, ((min - ML_START) / ML_RANGE) * 100)); }
const ML_HOURS = [7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22];
function tlPx(min: number) { return (tlPct(min) / 100) * TL_WIDTH; }
function restOverlap(ci: number, co: number): number { return Math.max(0, Math.min(co, REST_END) - Math.max(ci, REST_START)); }
function planToMin(t: PlanTimeOffType): number { return t === "full" ? 480 : t === "am-half" || t === "pm-half" ? 240 : 120; }
const PLAN_TO_LABELS: Record<PlanTimeOffType, string> = { "am-quarter": "오전반반차", "am-half": "오전반차", "pm-quarter": "오후반반차", "pm-half": "오후반차", "full": "연차" };
const DOW_KO = ["일", "월", "화", "수", "목", "금", "토"];
function readPlans(): PlanStore { if (typeof window === "undefined") return {}; try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}"); } catch { return {}; } }
function writePlans(p: PlanStore) { localStorage.setItem(STORAGE_KEY, JSON.stringify(p)); }
function parseHM(s: string | null | undefined): number | null { if (!s) return null; const m = s.match(/^(\d{1,2}):(\d{2})$/); return m ? parseInt(m[1], 10) * 60 + parseInt(m[2], 10) : null; }
function fmtHM(t: number | null): string { if (t == null) return ""; return `${String(Math.floor(t / 60) % 24).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`; }
function fmtAmPm(hm: string): string { const m = parseHM(hm); if (m == null) return hm; const h = Math.floor(m / 60), min = m % 60; return `${h < 12 ? "오전" : "오후"} ${h === 0 ? 12 : h > 12 ? h - 12 : h}:${String(min).padStart(2, "0")}`; }
function fmtDur(t: number | null): string { if (t == null) return "-"; const s = t < 0 ? "-" : ""; t = Math.abs(t); return `${s}${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`; }
function fmtDurKo(t: number): string { const h = Math.floor(t / 60), m = t % 60; if (h === 0) return `${m}분`; if (m === 0) return `${h}시간`; return `${h}시간 ${m}분`; }
function fmtDiff(rec: number): string | null { const diff = rec - DAILY_TARGET_MIN; if (diff === 0) return null; const abs = Math.abs(diff); return `${diff > 0 ? "+" : "-"} ${fmtDurKo(abs)}`; }
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
  const toType = plan?.timeOffType;
  if (toType === "full") return { date, weeklyHoliday: actual?.weeklyHoliday || false, clockIn: null, clockOut: null, workMin: 0, restMin: 0, timeOffMin: 480, hasActual: false, source: "plan" };
  const ci = plan?.clockIn || null, co = plan?.clockOut || null, ciM = parseHM(ci), coM = parseHM(co);
  let workMin = 0, restMin = 0, timeOffMin = 0;
  const timeOffRanges: TimeRange[] = [];
  if (ciM != null && coM != null) { restMin = restOverlap(ciM, coM); workMin = Math.max(0, coM - ciM - restMin); }
  if (toType) {
    timeOffMin = planToMin(toType);
    if (toType.startsWith("am") && ciM != null) timeOffRanges.push({ start: fmtHM(ciM - timeOffMin), end: ci! });
    else if (toType.startsWith("pm") && coM != null) timeOffRanges.push({ start: co!, end: fmtHM(coM + timeOffMin) });
  } else { timeOffMin = plan?.timeOffMin || 0; }
  return { date, weeklyHoliday: actual?.weeklyHoliday || false, clockIn: ci, clockOut: co, workMin, restMin, timeOffMin, hasActual: false, source: plan && (ci || co || plan.timeOffMin || toType) ? "plan" : "empty", timeOffRanges: timeOffRanges.length > 0 ? timeOffRanges : undefined };
}
function recMin(d: MergedDay) {
  return Math.min((d.workMin || 0) + (d.timeOffMin || 0), WORK_CAP_MIN);
}
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
    <div className="absolute top-full left-0 mt-1 bg-white dark:bg-neutral-900 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 p-4 z-50 w-[280px]" onClick={(e) => e.stopPropagation()}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">{year}년 {month + 1}월</span>
        <div className="flex gap-1">
          <button onClick={() => { if (month === 0) { setYear(year - 1); setMonth(11); } else setMonth(month - 1); }} className="w-6 h-6 flex items-center justify-center rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 dark:text-gray-500 text-sm">‹</button>
          <button onClick={() => { if (month === 11) { setYear(year + 1); setMonth(0); } else setMonth(month + 1); }} className="w-6 h-6 flex items-center justify-center rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 dark:text-gray-500 text-sm">›</button>
        </div>
      </div>
      <div className="grid grid-cols-7 text-[10px] text-gray-400 dark:text-gray-500 mb-1">
        {["일", "월", "화", "수", "목", "금", "토"].map((d) => <div key={d} className="text-center py-1">{d}</div>)}
      </div>
      <div className="grid grid-cols-7">
        {cells.map((d, i) => d ? (
          <button key={i} onClick={() => { const s = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`; onSelect(s); onClose(); }}
            className={`text-xs py-1.5 text-center rounded-md transition-colors
              ${isToday(d) ? "bg-green-500 text-white font-bold" : isInWeek(d) ? "bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200" : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"}
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
        <div className="group/b absolute top-0 bottom-0 bg-amber-300/60 dark:bg-amber-300/60 hover:bg-amber-300/80 rounded cursor-grab active:cursor-grabbing" style={{ left: `${tlPct(ci)}%`, width: `${Math.max(0.5, tlPct(co) - tlPct(ci))}%` }} onPointerDown={(e) => start("move", e)} onPointerMove={move} onPointerUp={end} onPointerCancel={end}>
          <div className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize rounded-l" onPointerDown={(e) => start("resizeStart", e)} />
          <div className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize rounded-r" onPointerDown={(e) => start("resizeEnd", e)} />
          <button onPointerDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); onClear(); }} className="hidden group-hover/b:flex absolute -top-2 -right-2 w-4 h-4 rounded-full bg-white dark:bg-neutral-800 border border-gray-300 dark:border-gray-600 text-gray-400 dark:text-gray-500 hover:bg-red-500 hover:text-white items-center justify-center text-[9px] z-10">✕</button>
        </div>
      )}
      {!has && <div className="absolute inset-0 flex items-center justify-center text-[10px] text-gray-300 dark:text-gray-500 pointer-events-none">드래그해서 계획</div>}
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
        return s != null && e != null ? <div key={`r${i}`} className="absolute top-0 bottom-0 bg-white/50 dark:bg-neutral-950/50 rounded" style={{ left: `${tlPct(s)}%`, width: `${Math.max(0.2, tlPct(e) - tlPct(s))}%` }} /> : null;
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

  const [weekOfDate, setWeekOfDate] = useState("");
  useEffect(() => { const d = new Date(); d.setDate(d.getDate() + weekOffset * 7); setWeekOfDate(d.toISOString().slice(0, 10)); }, [weekOffset]);
  const refresh = useCallback(async () => { try { setLoading(true); const r = await fetch(`/api/worktime?weekOf=${weekOfDate}`, { cache: "no-store" }); if (!r.ok) throw new Error(`${r.status}`); setData(await r.json()); setError(null); } catch (e) { setError((e as Error).message); } finally { setLoading(false); } }, [weekOfDate]);
  useEffect(() => { setPlansState(readPlans()); refresh(); const id = setInterval(refresh, 60_000); return () => clearInterval(id); }, [refresh]);
  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollLeft = tlPx(8 * 60); }, [data]);

  function goToDate(dateStr: string) {
    const target = new Date(dateStr + "T00:00:00+09:00");
    const now = new Date();
    const diff = Math.round((target.getTime() - now.getTime()) / (7 * 86400000));
    setWeekOffset(diff);
  }

  function updatePlan(date: string, ci: number, co: number, timeOffType?: PlanTimeOffType) { const n = { ...plans, [date]: { ...(plans[date] || {}), clockIn: fmtHM(ci), clockOut: fmtHM(co), timeOffType } }; writePlans(n); setPlansState(n); }
  function updatePlanTimeOff(date: string, timeOffType?: PlanTimeOffType) { if (timeOffType === "full") { const n = { ...plans, [date]: { timeOffType: "full" as const } }; writePlans(n); setPlansState(n); } else if (timeOffType) { const n = { ...plans, [date]: { ...(plans[date] || {}), timeOffType } }; writePlans(n); setPlansState(n); } else { const n = { ...plans, [date]: { ...(plans[date] || {}) } }; delete n[date].timeOffType; writePlans(n); setPlansState(n); } }
  function clearPlan(date: string) { const n = { ...plans }; delete n[date]; writePlans(n); setPlansState(n); }

  const dates = useMemo(() => data ? weekDates(data.weekFrom, data.weekTo) : [], [data]);
  const byDate = useMemo(() => data ? new Map(data.days.map((d) => [d.date, d])) : new Map<string, DayRec>(), [data]);
  const merged = useMemo(() => data ? dates.map((dt) => mergeDay(byDate.get(dt), plans[dt], dt)) : [], [data, dates, plans, byDate]);
  const totals = useMemo(() => {
    let actual = 0, planProjected = 0;
    let aRec = 0, pRec = 0;
    for (let i = 0; i < merged.length; i++) {
      const d = merged[i], dt = dates[i], pd = plans[dt], ad = byDate.get(dt);
      if (d.source === "actual") {
        const r = recMin(d);
        actual += r;
        aRec += r;
        if (isFinal(d)) {
          planProjected += r;
        } else if (d.ongoing && pd) {
          const planDay = mergeDay(undefined, pd, dt);
          const planCi = parseHM(pd.clockIn);
          const actualCi = ad ? parseHM(ad.clockIn) : null;
          const planBase = recMin(planDay);
          const lateDiff = (actualCi != null && planCi != null && actualCi > planCi) ? (actualCi - planCi) : 0;
          const planRem = Math.max(0, planBase - lateDiff - r);
          planProjected += r + planRem;
          pRec += planRem;
        } else {
          planProjected += r;
        }
      } else if (d.source === "plan") {
        const r = recMin(d);
        planProjected += r;
        pRec += r;
      }
    }
    const required = data?.requiredMin ?? WEEK_REQUIRED_MIN;
    const planDiff = planProjected - required;
    return { rec: actual, recRem: Math.max(0, required - actual), planProjected, planDiff, aRec, pRec, required };
  }, [merged, plans, dates, byDate, data]);

  // 빈 요일 평균 필요시간 + 퇴근 예상시간 계산
  const { hints: dayHints, avgPerDay: avgNeedPerDay } = useMemo(() => {
    const hints: Record<string, { type: "avg"; min: number } | { type: "exit"; leaveMin: number }> = {};
    // 확정(settled): 최종 확정 또는 계획이 있는 날 → 시간 고정
    // 미확정(unsettled): 빈 날 또는 ongoing인데 계획 없는 날 → 평균 배분 대상
    let settledTotal = 0;
    const unsettledDays: { dt: string; idx: number; ci: number | null }[] = [];
    for (let i = 0; i < merged.length; i++) {
      const d = merged[i], dt = dates[i], ad = byDate.get(dt), pd = plans[dt];
      const di = new Date(dt + "T00:00:00+09:00").getDay();
      const isWe = di === 0 || di === 6;
      if (isWe || d.weeklyHoliday) continue;
      const settled = isFinal(d) || (d.source === "plan") || (d.source === "actual" && d.ongoing && pd);
      if (settled) {
        if (d.source === "actual" && d.ongoing && pd) {
          // ongoing+계획: 계획 recMin 기준, 늦은 만큼 깎음
          const planDay = mergeDay(undefined, pd, dt);
          const planCi = parseHM(pd.clockIn);
          const actualCi = ad ? parseHM(ad.clockIn) : null;
          const planBase = recMin(planDay);
          const lateDiff = (actualCi != null && planCi != null && actualCi > planCi) ? (actualCi - planCi) : 0;
          settledTotal += Math.max(0, planBase - lateDiff);
        } else {
          settledTotal += recMin(d);
        }
      } else {
        // 미확정: 빈 날이거나 ongoing인데 계획 없는 날
        let ci: number | null = null;
        if (ad?.hasActual && ad.clockIn) ci = parseHM(ad.clockIn);
        unsettledDays.push({ dt, idx: i, ci });
      }
    }
    const required = data?.requiredMin ?? WEEK_REQUIRED_MIN;
    const remaining = Math.max(0, required - settledTotal);
    const avgPerDay = unsettledDays.length > 0 ? Math.ceil(remaining / unsettledDays.length) : 0;
    for (const { dt, ci } of unsettledDays) {
      const ad = byDate.get(dt);
      // 출근 시각이 확정된 ongoing 날 → 정확한 퇴근 가능 시각 계산
      if (ad?.hasActual && ci != null) {
        const todayWorkNeeded = Math.min(avgPerDay, WORK_CAP_MIN);
        const breakMin = Math.max(60, ad.restMin || 0); // 기본 1h 휴게 가정, 실제 더 썼으면 그만큼
        const leaveMin = ci + todayWorkNeeded + breakMin;
        hints[dt] = { type: "exit", leaveMin };
      } else {
        hints[dt] = { type: "avg", min: avgPerDay };
      }
    }
    return { hints, avgPerDay };
  }, [merged, dates, byDate, plans, data]);

  const todayStr = new Date().toISOString().slice(0, 10);
  const nowMin = new Date().getHours() * 60 + new Date().getMinutes();
  const isCur = weekOffset === 0;

  // 모바일 감지
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check(); window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // 모바일 바텀시트
  const [sheet, setSheet] = useState<{ date: string; ci: number; co: number; timeOffType?: PlanTimeOffType; lockedCi?: boolean; suggestedCo?: boolean } | null>(null);

  // 테마 모드: light → dark → system → light
  const [themeMode, setThemeMode] = useState<"light" | "dark" | "system">("light");
  useEffect(() => {
    const saved = localStorage.getItem("worktime-theme") as "light" | "dark" | "system" | null;
    if (saved) setThemeMode(saved);
  }, []);
  useEffect(() => {
    localStorage.setItem("worktime-theme", themeMode);
    const root = document.documentElement;
    if (themeMode === "dark") root.classList.add("dark");
    else if (themeMode === "light") root.classList.remove("dark");
    else {
      if (window.matchMedia("(prefers-color-scheme: dark)").matches) root.classList.add("dark");
      else root.classList.remove("dark");
    }
  }, [themeMode]);
  function cycleTheme() {
    setThemeMode((m) => m === "light" ? "dark" : m === "dark" ? "system" : "light");
  }
  const themeIcon = themeMode === "light" ? "☀️" : themeMode === "dark" ? "🌙" : "💻";

  return (
    <div className="h-[100dvh] overflow-hidden bg-white dark:bg-neutral-950 text-gray-900 dark:text-gray-100 transition-colors" onClick={() => calOpen && setCalOpen(false)}>
      <div className="max-w-[100vw] mx-auto h-full overflow-hidden">

        {/* ─── Title ─── */}
        <div className="px-4 py-1.5 border-b border-gray-100 dark:border-gray-800 text-center">
          <h1 className="text-sm font-semibold">Weekly Work Plan</h1>
        </div>

        {/* ─── Nav ─── */}
        <div className="relative flex items-center justify-center px-4 py-1.5 sticky top-0 bg-white dark:bg-neutral-950 z-20 border-b border-gray-100 dark:border-gray-800">
          {/* 오늘 — 왼쪽 고정 */}
          <button onClick={() => setWeekOffset(0)} className="absolute left-4 text-[13px] text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 border border-gray-200 dark:border-gray-700 rounded px-2.5 py-1">오늘</button>
          {/* Week selector — 가운데 */}
          <div className="relative flex items-center border border-gray-200 dark:border-gray-700 rounded-full overflow-hidden">
            <button onClick={() => setWeekOffset(weekOffset - 1)} className="w-9 h-9 flex items-center justify-center text-gray-400 dark:text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-600 dark:hover:text-gray-300 text-lg border-r border-gray-200 dark:border-gray-700">‹</button>
            <button onClick={(e) => { e.stopPropagation(); setCalOpen(!calOpen); }}
              className="text-sm text-gray-700 dark:text-gray-300 px-5 py-2 hover:bg-gray-50 dark:hover:bg-gray-800 font-medium min-w-[150px] text-center">
              {data ? fmtWeekRange(data.weekFrom, data.weekTo) : "..."}
            </button>
            <button onClick={() => setWeekOffset(weekOffset + 1)} className="w-9 h-9 flex items-center justify-center text-gray-400 dark:text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-600 dark:hover:text-gray-300 text-lg border-l border-gray-200 dark:border-gray-700">›</button>
            {calOpen && data && <CalendarPopup weekFrom={data.weekFrom} onSelect={goToDate} onClose={() => setCalOpen(false)} />}
          </div>
          {/* 테마 토글 — 오른쪽 고정 */}
          <button onClick={cycleTheme} className="absolute right-4 text-sm" title={themeMode}>{themeIcon}</button>
        </div>

        {error && <div className="mx-4 my-2 p-2 bg-red-50 dark:bg-red-950/30 text-red-500 rounded text-xs border border-red-100 dark:border-red-800">{error}</div>}

        {/* ─── Mobile Layout ─── */}
        {isMobile && (
          <div className="px-3 pb-2">
            {/* 시간 헤더 */}
            <div className="relative h-5 mb-1">
              {ML_HOURS.filter((_, i) => i % 2 === 0).map((h) => (
                <div key={h} className="absolute text-[9px] text-gray-300 dark:text-gray-500 -translate-x-1/2" style={{ left: `${mlPct(h * 60)}%`, top: "2px" }}>
                  {h === 12 ? "정오" : h > 12 ? h - 12 : h}
                </div>
              ))}
              {isCur && <div className="absolute text-[9px] font-mono text-red-400 -translate-x-1/2 font-semibold" style={{ left: `${mlPct(nowMin)}%`, top: "2px" }}>{fmtAmPm(fmtHM(nowMin))}</div>}
            </div>

            {dates.map((dt, i) => {
              const d = merged[i]; if (!d) return null;
              const ad = byDate.get(dt), pd = plans[dt];
              const rec = recMin(d);
              const isT = dt === todayStr, dow = getDow(dt);
              const di = new Date(dt + "T00:00:00+09:00").getDay();
              const isWe = di === 0 || di === 6;
              const hasA = ad?.hasActual || false, fin = isFinal(d), ong = hasA && !fin;
              let pm = mergeDay(undefined, pd, dt);
              if (isT && hasA && ad!.clockIn && pm.clockIn) {
                const aci = parseHM(ad!.clockIn), pci = parseHM(pm.clockIn), pco = parseHM(pm.clockOut);
                if (aci != null && pci != null && aci !== pci && pco != null) pm = mergeDay(undefined, { ...pd, clockIn: fmtHM(aci), clockOut: fmtHM(Math.min(aci + (pco - pci), TL_END)) }, dt);
              }
              const am: MergedDay | null = hasA ? { date: dt, weeklyHoliday: ad!.weeklyHoliday || false, clockIn: ad!.clockIn, clockOut: ad!.clockOut, workMin: ad!.workMin, restMin: ad!.restMin, timeOffMin: ad!.timeOffMin, hasActual: true, ongoing: ong, source: "actual", workRanges: ad!.workRanges, restRanges: ad!.restRanges, timeOffRanges: ad!.timeOffRanges } : null;
              const pci = parseHM(pm.clockIn), pco = parseHM(pm.clockOut);
              const aci = am ? parseHM(am.clockIn) : null;
              const aco = am ? parseHM(am.clockOut) : null;
              const aEnd = aco != null ? aco : ong ? nowMin : null;
              const otS = aci != null ? otStartMin(aci, d.restMin, d.timeOffMin) : null;
              const hasOt = otS != null && aEnd != null && aEnd > otS;

              return (
                <div key={dt} className={`py-1 border-b border-gray-100 dark:border-neutral-800 ${isT ? "bg-green-50/40 dark:bg-emerald-950/30 -mx-3 px-3 rounded-lg" : ""}`}>
                  {/* 날짜 + 시간 */}
                  <div className="flex items-center gap-2 mb-0.5">
                    <div className="flex items-baseline gap-0.5">
                      {isT ? <span className="w-5 h-5 rounded-full bg-green-500 text-white text-[10px] font-bold flex items-center justify-center">{dateNum(dt)}</span>
                        : <span className={`text-sm font-medium ${isWe ? "text-red-400" : "text-gray-800 dark:text-gray-200"}`}>{dateNum(dt)}</span>}
                      <span className={`text-[11px] ${isT ? "text-green-600" : isWe ? "text-red-400" : "text-gray-400 dark:text-gray-500"}`}>{dow}</span>
                    </div>
                    {ad?.weeklyHoliday && (
                      <span className="text-[10px] rounded-full px-2 py-0.5 bg-red-100 dark:bg-red-950/40 text-red-600 dark:text-red-300">
                        {ad.holidayName || "휴일"}
                      </span>
                    )}
                    {isT && !hasA ? (
                      <button onClick={() => { const input = prompt("출근 시간 (예: 10:30)", todayClockIn || ""); if (input && /^\d{1,2}:\d{2}$/.test(input.trim())) setClockIn(input.trim()); }}
                        className={`text-[11px] font-mono rounded px-1 py-0.5 ${todayClockIn ? "bg-amber-50 dark:bg-amber-950/30 text-amber-600" : "border border-dashed border-gray-300 dark:border-gray-600 text-gray-400 dark:text-gray-500"}`}>
                        {todayClockIn ? fmtDur(Math.max(0, nowMin - parseHM(todayClockIn)!)) : "출근"}
                      </button>
                    ) : ad?.weeklyHoliday ? null : (() => {
                      const actualTotal = (d.workMin || 0) + (d.timeOffMin || 0);
                      const overCap = actualTotal > WORK_CAP_MIN;
                      return (
                        <span className={`text-[11px] font-mono rounded px-1 py-0.5 ${rec === 0 ? "border border-gray-200 dark:border-gray-700 text-gray-400 dark:text-gray-500" : rec >= DAILY_TARGET_MIN ? "text-green-500 font-semibold" : "text-red-500 font-semibold"}`}>
                          {overCap ? (
                            <>
                              <span className="opacity-60 font-normal">실 {fmtDur(actualTotal)} /</span> 인정 {fmtDur(rec)}
                            </>
                          ) : (
                            <>{fmtDur(rec)}{rec > 0 && fmtDiff(rec) ? ` ${fmtDiff(rec)}` : ""}</>
                          )}
                        </span>
                      );
                    })()}
                  </div>
                  {/* 타임라인 바 */}
                  <div className="relative" style={{ height: "18px" }}>
                    {ML_HOURS.map((h) => (
                      <div key={h} className={`absolute top-0 bottom-0 ${h === 12 ? "border-l border-dashed border-gray-200 dark:border-gray-700" : "border-l border-gray-50 dark:border-gray-800/50"}`} style={{ left: `${mlPct(h * 60)}%` }} />
                    ))}
                    {isCur && isT && <div className="absolute top-0 bottom-0 w-[1px] bg-red-400 z-[4]" style={{ left: `${mlPct(nowMin)}%` }} />}
                    {/* 공휴일/노동절 등 — 보라색 전일 블록 (휴가 색상 동일) */}
                    {ad?.weeklyHoliday && (
                      <div className="absolute top-0 bottom-0 bg-purple-300/80 rounded z-[2]" style={{ left: "0%", right: "0%" }} />
                    )}
                    {/* plan 바 — 탭하면 바텀시트 */}
                    {!fin && pci != null && pco != null && (
                      <div className="absolute top-0 bottom-0 bg-amber-300/60 rounded cursor-pointer z-[3]"
                        style={{ left: `${mlPct(pci)}%`, width: `${Math.max(0.5, mlPct(pco) - mlPct(pci))}%` }}
                        onClick={() => setSheet({ date: dt, ci: pci, co: pco, timeOffType: pd?.timeOffType, lockedCi: ong })} />
                    )}
                    {/* plan 연차 — 전체 보라색 */}
                    {!fin && !hasA && pd?.timeOffType === "full" && (
                      <div className="absolute top-0 bottom-0 bg-purple-300/60 rounded cursor-pointer z-[3]" style={{ left: "0%", right: "0%" }}
                        onClick={() => setSheet({ date: dt, ci: 10 * 60 + 30, co: 19 * 60 + 30, timeOffType: "full" })} />
                    )}
                    {/* plan 반차/반반차 timeOff 바 */}
                    {!fin && !hasA && pm.timeOffRanges?.map((r, j) => { const s = parseHM(r.start), e = parseHM(r.end); return s != null && e != null ? <div key={`pt${j}`} className="absolute top-0 bottom-0 bg-purple-300/60 rounded z-[2]" style={{ left: `${mlPct(s)}%`, width: `${Math.max(0.3, mlPct(e) - mlPct(s))}%` }} /> : null; })}
                    {/* plan 없을 때 — 탭하면 새 계획 바텀시트 (ongoing도 허용) */}
                    {!fin && (!hasA || ong) && pci == null && pd?.timeOffType !== "full" && (
                      <div className="absolute inset-0 cursor-pointer z-[1]"
                        onClick={() => { const ci0 = aci ?? (10 * 60 + 30); const co0 = aci ? ci0 + avgNeedPerDay + restOverlap(ci0, ci0 + avgNeedPerDay + 60) : (19 * 60 + 30); setSheet({ date: dt, ci: ci0, co: co0, timeOffType: pd?.timeOffType, lockedCi: ong, suggestedCo: true }); }} />
                    )}
                    {/* actual 휴가 — clockIn 없어도 렌더링 (사내행사 등 전일 휴가) */}
                    {hasA && am?.timeOffRanges?.map((r, j) => { const s = parseHM(r.start), e = parseHM(r.end); return s != null && e != null ? <div key={`t${j}`} className="absolute top-0 bottom-0 bg-purple-300/80 rounded" style={{ left: `${mlPct(s)}%`, width: `${Math.max(0.3, mlPct(e) - mlPct(s))}%` }} /> : null; })}
                    {/* actual 근무/휴게 바 */}
                    {hasA && am && aci != null && aEnd != null && (
                      <>
                        {am.workRanges && am.workRanges.length > 0 ? am.workRanges.map((wr, j) => {
                          const ws = parseHM(wr.start), we = parseHM(wr.end);
                          if (ws == null || we == null) return null;
                          return <div key={`w${j}`} className={`absolute top-0 bottom-0 rounded ${wr.remote ? "bg-pink-300" : ong ? "bg-amber-300/80 animate-pulse" : "bg-amber-300"}`}
                            style={{ left: `${mlPct(ws)}%`, width: `${Math.max(0.5, mlPct(we) - mlPct(ws))}%` }} />;
                        }) : (
                          <div className={`absolute top-0 bottom-0 rounded ${ong ? "bg-amber-300/80 animate-pulse" : "bg-amber-300"}`}
                            style={{ left: `${mlPct(aci)}%`, width: `${Math.max(0.5, mlPct(aEnd) - mlPct(aci))}%` }} />
                        )}
                        {hasOt && otS != null && <div className="absolute top-0 h-[3px] bg-red-400 rounded-t" style={{ left: `${mlPct(otS)}%`, width: `${Math.max(0.2, mlPct(aEnd) - mlPct(otS))}%` }} />}
                        {am.restRanges?.map((r, j) => { const s = parseHM(r.start), e = parseHM(r.end); return s != null && e != null ? <div key={`r${j}`} className="absolute top-0 bottom-0 bg-white/50 dark:bg-neutral-950/50 rounded" style={{ left: `${mlPct(s)}%`, width: `${Math.max(0.2, mlPct(e) - mlPct(s))}%` }} /> : null; })}
                      </>
                    )}
                    {/* 오늘 진행중 (actual 없을 때) */}
                    {isT && !hasA && (() => {
                      const ci = todayClockIn ? parseHM(todayClockIn) : (pm.clockIn ? parseHM(pm.clockIn) : null);
                      if (ci == null || nowMin <= ci) return null;
                      return <div className="absolute top-0 bottom-0 rounded bg-amber-300/70 animate-pulse" style={{ left: `${mlPct(ci)}%`, width: `${Math.max(0.3, mlPct(nowMin) - mlPct(ci))}%` }} />;
                    })()}
                    {/* 빈 요일 평균 / 퇴근 예상 힌트 */}
                    {dayHints[dt] && (() => {
                      const h = dayHints[dt];
                      if (h.type === "exit") {
                        const leftPct = mlPct(h.leaveMin);
                        return (
                          <>
                            <div className="absolute top-0 bottom-0 w-[1.5px] bg-emerald-500 z-[5]" style={{ left: `${leftPct}%` }} />
                            <span className="absolute text-[10px] font-mono text-emerald-600 dark:text-emerald-400 font-semibold pointer-events-none whitespace-nowrap" style={{ left: `${leftPct}%`, transform: "translate(-100%, -100%)", top: "0" }}>
                              ⏱ {fmtAmPm(fmtHM(h.leaveMin))}
                            </span>
                          </>
                        );
                      }
                      return <span className="absolute inset-0 flex items-center justify-center text-[10px] text-gray-300 dark:text-gray-500 pointer-events-none">{fmtDur(h.min)} 필요</span>;
                    })()}
                  </div>
                  {/* 라벨 */}
                  <div className="relative text-[9px] mt-0.5 h-3">
                    {hasA && ad!.clockIn && <span className="absolute text-gray-400 dark:text-gray-400 whitespace-nowrap" style={{ left: `${mlPct(parseHM(ad!.clockIn)!)}%` }}>{fmtAmPm(ad!.clockIn)}</span>}
                    {hasA && ad!.clockOut && <span className="absolute text-gray-400 dark:text-gray-400 whitespace-nowrap" style={{ left: `${mlPct(parseHM(ad!.clockOut)!)}%`, transform: "translateX(-100%)" }}>{fmtAmPm(ad!.clockOut)}</span>}
                    {!fin && pm.clockIn && !hasA && (
                      <span className="absolute text-amber-500 dark:text-amber-400 whitespace-nowrap" style={{ left: `${mlPct(parseHM(pm.clockIn)!)}%` }}>{fmtAmPm(pm.clockIn!)}</span>
                    )}
                    {!fin && pm.clockOut && !(hasA && ad!.clockOut === pm.clockOut) && (
                      <span className="absolute text-amber-500 dark:text-amber-400 whitespace-nowrap" style={{ left: `${mlPct(parseHM(pm.clockOut)!)}%`, transform: "translateX(-100%)" }}>{fmtAmPm(pm.clockOut!)}</span>
                    )}
                    {/* plan 휴가 라벨 */}
                    {!fin && !hasA && pm.timeOffRanges?.map((r, j) => { const s = parseHM(r.start), e = parseHM(r.end); const isAm = pd?.timeOffType?.startsWith("am"); const isPm = pd?.timeOffType?.startsWith("pm"); return s != null && e != null ? <span key={`ptl${j}`}>{!isPm && <span className="absolute text-purple-400 dark:text-purple-300 whitespace-nowrap" style={{ left: `${mlPct(s)}%` }}>{fmtAmPm(r.start)}</span>}{!isAm && <span className="absolute text-purple-400 dark:text-purple-300 whitespace-nowrap" style={{ left: `${mlPct(e)}%`, transform: "translateX(-100%)" }}>{fmtAmPm(r.end)}</span>}</span> : null; })}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ─── Desktop Timeline ─── */}
        {!isMobile && <div ref={scrollRef} className="overflow-x-auto hide-scrollbar">
          <div style={{ width: `${TL_WIDTH + 160}px`, minWidth: "100%" }}>

            {/* Hour header */}
            <div className="flex">
              <div className="w-[160px] shrink-0" />
              <div className="relative h-6 border-b border-gray-100 dark:border-gray-800" style={{ width: `${TL_WIDTH}px` }}>
                {TL_HOURS.map((h) => (
                  <div key={h} className="absolute text-[10px] text-gray-300 dark:text-gray-500 -translate-x-1/2" style={{ left: `${tlPct(h * 60)}%`, bottom: "2px" }}>
                    {h === 0 || h === 24 ? "" : h === 12 ? <span className="text-gray-400 dark:text-gray-500">정오<br/><span className="text-[9px]">12</span></span> : h > 12 ? h - 12 : h}
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
                <div key={dt} className={`flex border-b border-gray-100 dark:border-neutral-800 ${isT ? "bg-green-50/40 dark:bg-emerald-950/30" : ""}`}>
                  {/* Left — sticky with right shadow mask */}
                  <div className={`w-[160px] shrink-0 flex items-center gap-3 py-1.5 pl-4 pr-2 sticky left-0 z-[5] shadow-[6px_0_12px_0px_rgba(0,0,0,0.06)] dark:shadow-[6px_0_12px_0px_rgba(0,0,0,0.3)] ${isT ? "bg-green-50 dark:bg-emerald-950/40" : "bg-white dark:bg-neutral-950"}`}>
                    <div className="flex items-baseline gap-1 min-w-[40px]">
                      {isT
                        ? <span className="w-6 h-6 rounded-full bg-green-500 text-white text-[11px] font-bold flex items-center justify-center">{dateNum(dt)}</span>
                        : <span className={`text-[15px] font-medium ${isWe ? "text-red-400" : "text-gray-800 dark:text-gray-200"}`}>{dateNum(dt)}</span>}
                      <span className={`text-[12px] ${isT ? "text-green-600" : isWe ? "text-red-400" : "text-gray-400 dark:text-gray-500"}`}>{dow}</span>
                    </div>
                    {ad?.weeklyHoliday && (
                      <span className="text-[10px] rounded-full px-2 py-0.5 bg-red-100 dark:bg-red-950/40 text-red-600 dark:text-red-300 whitespace-nowrap">
                        {ad.holidayName || "휴일"}
                      </span>
                    )}
                    {/* 오늘 + actual 없음: 출근시간 입력 가능 */}
                    {isT && !hasA ? (
                      <button
                        onClick={() => {
                          const input = prompt("출근 시간 입력 (예: 10:30)", todayClockIn || "");
                          if (input && /^\d{1,2}:\d{2}$/.test(input.trim())) setClockIn(input.trim());
                        }}
                        className={`text-[12px] font-mono whitespace-nowrap rounded-md px-1.5 py-0.5 ${todayClockIn ? "bg-amber-50 dark:bg-amber-950/30 text-amber-600 border border-amber-200 dark:border-amber-700" : "border border-dashed border-gray-300 dark:border-gray-600 text-gray-400 dark:text-gray-500"}`}
                      >
                        {todayClockIn ? fmtDur(Math.max(0, nowMin - parseHM(todayClockIn)! - (nowMin > REST_START && parseHM(todayClockIn)! < REST_END ? Math.min(60, nowMin - REST_START) : 0))) : "출근 입력"}
                      </button>
                    ) : ad?.weeklyHoliday ? null : (() => {
                      const actualTotal = (d.workMin || 0) + (d.timeOffMin || 0);
                      const overCap = actualTotal > WORK_CAP_MIN;
                      return (
                        <span className={`text-[12px] font-mono whitespace-nowrap rounded-md px-1.5 py-0.5 ${pd?.timeOffType ? "text-gray-600 dark:text-gray-400" : rec === 0 ? "border border-gray-200 dark:border-gray-700 text-gray-400 dark:text-gray-500" : rec >= DAILY_TARGET_MIN ? "text-green-500 font-semibold" : "text-red-500 font-semibold"}`}>
                          {pd?.timeOffType ? (
                            PLAN_TO_LABELS[pd.timeOffType]
                          ) : overCap ? (
                            <>
                              <span className="opacity-60 font-normal">실 {fmtDur(actualTotal)} /</span> 인정 {fmtDur(rec)}
                            </>
                          ) : (
                            <>{fmtDur(rec)}{rec > 0 && fmtDiff(rec) ? ` ${fmtDiff(rec)}` : ""}</>
                          )}
                        </span>
                      );
                    })()}
                    {/* 휴가/계획 설정 버튼 — 확정 안 된 날 (ongoing 포함) */}
                    {!fin && (!hasA || ong) && (
                      <button onClick={() => { const aciReal = (ong && ad?.clockIn ? parseHM(ad.clockIn) : null) ?? parseHM(pm.clockIn); const ci0 = aciReal ?? (10 * 60 + 30); const hasPlan = pm.clockOut != null; const co0 = parseHM(pm.clockOut) ?? (aciReal ? (ci0 + avgNeedPerDay + restOverlap(ci0, ci0 + avgNeedPerDay + 60)) : (19 * 60 + 30)); setSheet({ date: dt, ci: ci0, co: co0, timeOffType: pd?.timeOffType, lockedCi: ong, suggestedCo: !hasPlan }); }}
                        className={`text-[10px] whitespace-nowrap rounded px-1 py-0.5 ${pd?.timeOffType ? "bg-purple-100 dark:bg-purple-950/30 text-purple-500 border border-purple-200 dark:border-purple-700" : "text-gray-300 dark:text-gray-600 hover:text-purple-400"}`}>
                        {pd?.timeOffType ? "휴" : "+휴"}
                      </button>
                    )}
                  </div>

                  {/* Timeline area */}
                  <div className="relative py-1" style={{ width: `${TL_WIDTH}px`, minHeight: "44px" }}>
                    {TL_HOURS.map((h) => (
                      <div key={h} className={`absolute top-0 bottom-0 ${h === 12 ? "border-l border-dashed border-gray-200 dark:border-gray-700" : "border-l border-gray-50 dark:border-gray-800/50"}`} style={{ left: `${tlPct(h * 60)}%` }} />
                    ))}
                    {isCur && <div className="absolute top-0 bottom-0 w-[1.5px] bg-red-400 z-[4]" style={{ left: `${tlPct(nowMin)}%` }} />}

                    <div className="relative" style={{ height: "22px", marginTop: "1px" }}>
                      {ad?.weeklyHoliday ? (
                        <div className="absolute inset-0 bg-purple-300/80 rounded flex items-center justify-center text-[10px] text-purple-700 dark:text-purple-200">{ad.holidayName || "휴일"}</div>
                      ) : fin ? <ReadonlyTimeline day={am!} /> : (
                        <>
                          {pd?.timeOffType === "full" ? (
                            <div className="absolute inset-0 bg-purple-300/60 rounded flex items-center justify-center text-[10px] text-purple-600 dark:text-purple-300 cursor-pointer" onClick={() => setSheet({ date: dt, ci: 10 * 60 + 30, co: 19 * 60 + 30, timeOffType: "full" })}>연차</div>
                          ) : (
                            <>
                              <div className={hasA ? "opacity-25 h-full" : "h-full"}>
                                <EditableTimeline day={pm} onChange={(a, b) => updatePlan(dt, a, b, pd?.timeOffType)} onClear={() => clearPlan(dt)} />
                              </div>
                              {/* plan timeOff 바 (반차/반반차) */}
                              {!hasA && pm.timeOffRanges?.map((r, j) => { const s = parseHM(r.start), e = parseHM(r.end); return s != null && e != null ? <div key={`pt${j}`} className="absolute top-0 bottom-0 bg-purple-300/60 rounded pointer-events-none" style={{ left: `${tlPct(s)}%`, width: `${Math.max(0.3, tlPct(e) - tlPct(s))}%` }} /> : null; })}
                            </>
                          )}
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
                      {/* 빈 요일 평균 / 퇴근 예상 힌트 */}
                      {dayHints[dt] && (() => {
                        const h = dayHints[dt];
                        if (h.type === "exit") {
                          const leftPct = tlPct(h.leaveMin);
                          return (
                            <>
                              <div className="absolute top-0 bottom-0 w-[1.5px] bg-emerald-500 z-[5]" style={{ left: `${leftPct}%` }} />
                              <span className="absolute text-[11px] font-mono text-emerald-600 dark:text-emerald-400 font-semibold pointer-events-none whitespace-nowrap" style={{ left: `${leftPct}%`, transform: "translate(-100%, -100%)", top: "0" }}>
                                ⏱ {fmtAmPm(fmtHM(h.leaveMin))}
                              </span>
                            </>
                          );
                        }
                        return <span className="absolute inset-0 flex items-center justify-center text-[11px] text-gray-300 dark:text-gray-500 pointer-events-none">{fmtDur(h.min)} 필요</span>;
                      })()}
                    </div>

                    {/* 라벨: 한 줄에 actual + plan 합침 */}
                    <div className="relative text-[9px] mt-0 h-3">
                      {/* actual 라벨 */}
                      {hasA && (
                        <>
                          {ad!.workRanges ? ad!.workRanges.map((wr, j) => {
                            const ws = parseHM(wr.start);
                            if (ws == null) return null;
                            return <span key={`ws${j}`} className="absolute whitespace-nowrap text-gray-400 dark:text-gray-400" style={{ left: `${tlPct(ws)}%` }}>
                              {fmtAmPm(wr.start)}
                              {j === 0 && ad!.restRanges && ad!.restRanges.length > 0 && <span className="text-gray-300 dark:text-gray-500 ml-1">휴게 {ad!.restRanges.length}건</span>}
                            </span>;
                          }) : ad!.clockIn && <span className="absolute whitespace-nowrap text-gray-400 dark:text-gray-400" style={{ left: `${tlPct(parseHM(ad!.clockIn)!)}%` }}>{fmtAmPm(ad!.clockIn)}{ad!.restRanges && ad!.restRanges.length > 0 && <span className="text-gray-300 dark:text-gray-500 ml-1">휴게 {ad!.restRanges.length}건</span>}</span>}
                          {ad!.clockOut && <span className={`absolute whitespace-nowrap text-gray-400 dark:text-gray-400 ${ong ? "text-red-500" : ""}`} style={{ left: `${tlPct(parseHM(ad!.clockOut)!)}%`, transform: "translateX(-100%)" }}>{fmtAmPm(ad!.clockOut)}</span>}
                          {ad!.timeOffRanges?.map((r, j) => { const isPm = ad!.clockOut && r.start === ad!.clockOut; return !isPm ? <span key={`to${j}`} className="absolute whitespace-nowrap text-purple-400 dark:text-purple-300" style={{ left: `${tlPct(parseHM(r.start)!)}%` }}>{fmtAmPm(r.start)}</span> : null; })}
                          {ad!.timeOffRanges?.map((r, j) => { const e = parseHM(r.end); const isAm = ad!.clockIn && r.end === ad!.clockIn; return e != null && !isAm ? <span key={`te${j}`} className="absolute whitespace-nowrap text-purple-400 dark:text-purple-300" style={{ left: `${tlPct(e)}%`, transform: "translateX(-100%)" }}>{fmtAmPm(r.end)}</span> : null; })}
                        </>
                      )}
                      {/* plan 라벨 — actual과 겹치지 않는 시간만 */}
                      {!fin && pm.clockIn && pm.clockOut && (() => {
                        const planCiSame = hasA && ad!.clockIn === pm.clockIn;
                        const planCoSame = hasA && ad!.clockOut === pm.clockOut;
                        if (planCiSame && planCoSame) return null;
                        return <>
                          {!planCiSame && !hasA && <span className="absolute whitespace-nowrap text-amber-500 dark:text-amber-400" style={{ left: `${tlPct(parseHM(pm.clockIn)!)}%` }}>{fmtAmPm(pm.clockIn!)}</span>}
                          <span className="absolute whitespace-nowrap text-amber-500 dark:text-amber-400" style={{ left: `${tlPct(parseHM(pm.clockOut)!)}%`, transform: "translateX(-100%)" }}>{fmtAmPm(pm.clockOut!)}</span>
                        </>;
                      })()}
                      {/* plan 휴가 라벨 */}
                      {!fin && !hasA && pm.timeOffRanges?.map((r, j) => { const s = parseHM(r.start), e = parseHM(r.end); const isAm = pd?.timeOffType?.startsWith("am"); const isPm = pd?.timeOffType?.startsWith("pm"); return s != null && e != null ? <span key={`ptl${j}`}>{!isPm && <span className="absolute whitespace-nowrap text-purple-400 dark:text-purple-300" style={{ left: `${tlPct(s)}%` }}>{fmtAmPm(r.start)}</span>}{!isAm && <span className="absolute whitespace-nowrap text-purple-400 dark:text-purple-300" style={{ left: `${tlPct(e)}%`, transform: "translateX(-100%)" }}>{fmtAmPm(r.end)}</span>}</span> : null; })}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>}

        {/* Legend */}
        <div className="px-4 py-1.5 flex items-center justify-between text-[10px] text-gray-400 dark:text-gray-400">
          <div className="flex gap-3">
            <span className="flex items-center gap-1"><span className="w-2 h-2 bg-amber-300 rounded-full" />근무</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 bg-pink-300 rounded-full" />외근</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 bg-red-400 rounded-full" />초과</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 bg-purple-300 rounded-full" />휴가</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 bg-amber-300/60 rounded-full" />계획</span>
          </div>
          <button onClick={() => { if (confirm("계획 전부 지울까요?")) { writePlans({}); setPlansState({}); } }} className="text-gray-300 dark:text-gray-500 hover:text-red-400">계획 리셋</button>
        </div>

        {/* Weekly summary — 실제+계획 통합 바 */}
        {data && (
          <div className="border-t border-gray-100 dark:border-gray-800 py-4 px-8 flex justify-center">
            <div className="w-full max-w-2xl">
              <div className="relative" style={{ paddingTop: "16px" }}>
                <span className="absolute text-[10px] font-mono text-gray-400 dark:text-gray-400 left-0 top-0">주간 {fmtDur(totals.planProjected)}</span>
                <span className={`absolute text-[10px] font-mono right-0 top-0 ${totals.planDiff >= 0 ? "text-green-500" : "text-red-400"}`}>
                  {totals.planDiff >= 0 ? "+" : "-"}{fmtDur(Math.abs(totals.planDiff))}
                </span>
                <div className="relative h-[18px] bg-gray-100 dark:bg-neutral-800 rounded overflow-hidden flex">
                  <div className="bg-amber-300 transition-all" style={{ width: `${Math.min(100, (totals.aRec / WEEK_MAX_MIN) * 100)}%` }} />
                  <div className="bg-amber-300/55 transition-all" style={{ width: `${Math.min(100, (totals.pRec / WEEK_MAX_MIN) * 100)}%` }} />
                </div>
                <div className="absolute bottom-0 w-[1.5px] bg-gray-300 dark:bg-gray-600" style={{ left: `${((data?.requiredMin ?? WEEK_REQUIRED_MIN) / WEEK_MAX_MIN) * 100}%`, height: "22px" }} />
              </div>
            </div>
          </div>
        )}

        {/* ─── 모바일 바텀시트 ─── */}
        {sheet && (
          <div className="fixed inset-0 z-50" onClick={() => setSheet(null)}>
            <div className="absolute inset-0 bg-black/20" />
            <div className="absolute bottom-0 left-0 right-0 bg-white dark:bg-neutral-900 rounded-t-2xl p-5 pb-8 shadow-xl" onClick={(e) => e.stopPropagation()}>
              <div className="w-10 h-1 bg-gray-200 dark:bg-neutral-700 rounded-full mx-auto mb-5" />
              <div className="text-sm text-gray-500 dark:text-gray-400 mb-4">{sheet.date} 계획</div>

              {/* 휴가 종류 선택 */}
              <div className="flex flex-wrap gap-1.5 mb-4">
                {([undefined, "am-quarter", "am-half", "pm-quarter", "pm-half", "full"] as (PlanTimeOffType | undefined)[]).map((t) => (
                  <button key={t || "none"} onClick={() => setSheet({ ...sheet, timeOffType: t })}
                    className={`text-[12px] rounded-lg px-2.5 py-1.5 border ${sheet.timeOffType === t ? "bg-purple-100 dark:bg-purple-950/40 text-purple-600 dark:text-purple-300 border-purple-300 dark:border-purple-600" : "border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400"}`}>
                    {t ? PLAN_TO_LABELS[t] : "없음"}
                  </button>
                ))}
              </div>

              {sheet.timeOffType !== "full" && (
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-gray-500 dark:text-gray-400 w-12">출근</span>
                    {sheet.lockedCi ? (
                      <span className="flex-1 text-sm text-gray-500 dark:text-gray-400 px-3 py-2">{fmtAmPm(fmtHM(sheet.ci))} (확정)</span>
                    ) : (
                      <input type="time" value={fmtHM(sheet.ci)}
                        className="flex-1 border border-gray-200 dark:border-gray-700 dark:bg-neutral-800 dark:text-gray-200 rounded-lg px-3 py-2 text-sm"
                        onChange={(e) => { const v = parseHM(e.target.value); if (v != null) { const rest = restOverlap(v, v + avgNeedPerDay + 60); setSheet({ ...sheet, ci: v, co: sheet.suggestedCo ? v + avgNeedPerDay + rest : sheet.co, suggestedCo: sheet.suggestedCo }); } }} />
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-gray-500 dark:text-gray-400 w-12">퇴근</span>
                    <input type="time" value={fmtHM(sheet.co)}
                      className="flex-1 border border-gray-200 dark:border-gray-700 dark:bg-neutral-800 dark:text-gray-200 rounded-lg px-3 py-2 text-sm"
                      onChange={(e) => { const v = parseHM(e.target.value); if (v != null) setSheet({ ...sheet, co: v, suggestedCo: false }); }} />
                    {sheet.suggestedCo && <span className="text-[11px] text-green-500 whitespace-nowrap">퇴근 가능</span>}
                  </div>
                </div>
              )}
              {sheet.timeOffType === "full" && (
                <div className="text-center text-sm text-purple-500 dark:text-purple-400 py-4">하루 전체 휴가 (8시간)</div>
              )}

              <div className="flex gap-2 mt-5">
                <button onClick={() => {
                  if (sheet.timeOffType === "full") { updatePlanTimeOff(sheet.date, "full"); }
                  else if (sheet.co > sheet.ci) { updatePlan(sheet.date, sheet.ci, sheet.co, sheet.timeOffType); }
                  setSheet(null);
                }}
                  className="flex-1 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 rounded-lg py-2.5 text-sm font-medium">저장</button>
                <button onClick={() => { clearPlan(sheet.date); setSheet(null); }}
                  className="px-4 border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 rounded-lg py-2.5 text-sm">삭제</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
