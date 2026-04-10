"use client";

import { useEffect, useMemo, useState, useRef, useCallback } from "react";

type TimeRange = { start: string; end: string };

type DayRec = {
  date: string;
  weeklyHoliday?: boolean;
  clockIn: string | null;
  clockOut: string | null;
  workMin: number;
  restMin: number;
  timeOffMin: number;
  hasActual: boolean;
  ongoing?: boolean;
  restRanges?: TimeRange[];
  timeOffRanges?: TimeRange[];
};

type WorktimeData = {
  updatedAt: string;
  weekFrom: string;
  weekTo: string;
  requiredMin: number;
  doneMin: number;
  actualMin: number;
  timeOffMin: number;
  days: DayRec[];
};

type PlanDay = { clockIn?: string; clockOut?: string; timeOffMin?: number };
type PlanStore = Record<string, PlanDay>;

const STORAGE_KEY = "worktime-plans";
const WORK_CAP_MIN = 540;
const WEEK_REQUIRED_MIN = 2400;
const WEEK_MAX_MIN = 3120; // 52시간
const REST_START = 12 * 60 + 30;
const REST_END = 13 * 60 + 30;
const SNAP_MIN = 1;

// 타임라인 뷰포트: 8시~22시
const TL_START = 8 * 60;
const TL_END = 22 * 60;
const TL_RANGE = TL_END - TL_START;
const TL_HOURS = Array.from({ length: 15 }, (_, i) => i + 8); // 8~22

function tlPct(min: number) {
  return Math.max(0, Math.min(100, ((min - TL_START) / TL_RANGE) * 100));
}

function restOverlap(ciMin: number, coMin: number): number {
  return Math.max(0, Math.min(coMin, REST_END) - Math.max(ciMin, REST_START));
}

const DOW_KO = ["일", "월", "화", "수", "목", "금", "토"];

function readPlans(): PlanStore {
  if (typeof window === "undefined") return {};
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}"); } catch { return {}; }
}
function writePlans(p: PlanStore) { localStorage.setItem(STORAGE_KEY, JSON.stringify(p)); }

function parseHM(s: string | null | undefined): number | null {
  if (!s) return null;
  const m = s.match(/^(\d{1,2}):(\d{2})$/);
  return m ? parseInt(m[1], 10) * 60 + parseInt(m[2], 10) : null;
}
function fmtHM(total: number | null): string {
  if (total == null) return "";
  const h = Math.floor(total / 60) % 24;
  const m = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
function fmtDuration(total: number | null): string {
  if (total == null) return "-";
  const sign = total < 0 ? "-" : "";
  total = Math.abs(total);
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${sign}${h}:${String(m).padStart(2, "0")}`;
}
function getDow(dateStr: string): string {
  return DOW_KO[new Date(dateStr + "T00:00:00+09:00").getDay()];
}
function dateLabel(dateStr: string): string {
  return `${parseInt(dateStr.slice(8, 10), 10)}`;
}
function snap(min: number): number {
  return Math.round(min / SNAP_MIN) * SNAP_MIN;
}
function fmtWeekRange(from: string, to: string): string {
  const f = new Date(from + "T00:00:00+09:00");
  const t = new Date(to + "T00:00:00+09:00");
  return `${f.getFullYear()}. ${f.getMonth() + 1}. ${f.getDate()} – ${t.getMonth() + 1}. ${t.getDate()}`;
}

type MergedDay = {
  date: string;
  weeklyHoliday: boolean;
  clockIn: string | null;
  clockOut: string | null;
  workMin: number;
  restMin: number;
  timeOffMin: number;
  hasActual: boolean;
  ongoing?: boolean;
  source: "actual" | "plan" | "empty";
  restRanges?: TimeRange[];
  timeOffRanges?: TimeRange[];
};

function mergeDay(actual: DayRec | undefined, plan: PlanDay | undefined, date: string): MergedDay {
  if (actual && actual.hasActual) {
    return {
      date,
      weeklyHoliday: actual.weeklyHoliday || false,
      clockIn: actual.clockIn, clockOut: actual.clockOut,
      workMin: actual.workMin, restMin: actual.restMin, timeOffMin: actual.timeOffMin,
      hasActual: true, ongoing: actual.ongoing, source: "actual",
      restRanges: actual.restRanges, timeOffRanges: actual.timeOffRanges,
    };
  }
  const ci = plan?.clockIn || null;
  const co = plan?.clockOut || null;
  const ciM = parseHM(ci);
  const coM = parseHM(co);
  let workMin = 0, restMin = 0;
  if (ciM != null && coM != null) {
    restMin = restOverlap(ciM, coM);
    workMin = Math.max(0, coM - ciM - restMin);
  }
  return {
    date, weeklyHoliday: actual?.weeklyHoliday || false,
    clockIn: ci, clockOut: co, workMin, restMin,
    timeOffMin: plan?.timeOffMin || 0, hasActual: false,
    source: plan && (ci || co || plan.timeOffMin) ? "plan" : "empty",
  };
}

function recognizedMin(d: MergedDay): number {
  return Math.min(d.workMin || 0, WORK_CAP_MIN) + (d.timeOffMin || 0);
}

function isFinalized(d: MergedDay): boolean {
  if (d.source !== "actual") return false;
  if (!d.ongoing) return true;
  const today = new Date().toISOString().slice(0, 10);
  return d.date < today;
}

function weekDates(from: string, to: string): string[] {
  const out: string[] = [];
  const start = new Date(from + "T00:00:00+09:00");
  const end = new Date(to + "T00:00:00+09:00");
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    out.push(new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10));
  }
  return out;
}

// ─── Editable Timeline ───
type DragMode = "move" | "resizeStart" | "resizeEnd" | "create" | null;
type DragState = { mode: DragMode; startX: number; origCi: number; origCo: number; barEl: HTMLElement | null };

function EditableTimeline({ day, onChange, onClear }: {
  day: MergedDay; onChange: (ci: number, co: number) => void; onClear: () => void;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [tempCi, setTempCi] = useState<number | null>(null);
  const [tempCo, setTempCo] = useState<number | null>(null);

  const ciM = tempCi ?? parseHM(day.clockIn);
  const coM = tempCo ?? parseHM(day.clockOut);

  const xToMin = useCallback((clientX: number): number => {
    const el = trackRef.current;
    if (!el) return 0;
    const r = el.getBoundingClientRect();
    const x = Math.max(0, Math.min(r.width, clientX - r.left));
    return snap(TL_START + (x / r.width) * TL_RANGE);
  }, []);

  function beginDrag(mode: DragMode, e: React.PointerEvent) {
    e.stopPropagation(); e.preventDefault();
    const el = e.currentTarget as HTMLElement;
    el.setPointerCapture(e.pointerId);
    let origCi = ciM ?? 600, origCo = coM ?? 1140;
    if (mode === "create") {
      const t = xToMin(e.clientX);
      origCi = t; origCo = Math.min(TL_END, t + 9 * 60);
      setTempCi(origCi); setTempCo(origCo);
    }
    setDrag({ mode, startX: e.clientX, origCi, origCo, barEl: el });
  }

  function handleMove(e: React.PointerEvent) {
    if (!drag) return;
    const dx = e.clientX - drag.startX;
    const trackW = trackRef.current?.getBoundingClientRect().width || 1;
    const deltaMin = snap((dx / trackW) * TL_RANGE);
    if (drag.mode === "move" || drag.mode === "create") {
      let ci = drag.origCi + (drag.mode === "move" ? deltaMin : 0);
      let co = drag.origCo + (drag.mode === "move" ? deltaMin : 0);
      if (drag.mode === "create") {
        const now = xToMin(e.clientX);
        if (now >= drag.origCi) { ci = drag.origCi; co = Math.max(drag.origCi + SNAP_MIN, now); }
        else { ci = now; co = drag.origCi; }
      }
      if (drag.mode === "move") {
        const dur = drag.origCo - drag.origCi;
        if (ci < TL_START) { ci = TL_START; co = TL_START + dur; }
        if (co > TL_END) { co = TL_END; ci = co - dur; }
      }
      setTempCi(ci); setTempCo(co);
    } else if (drag.mode === "resizeStart") {
      setTempCi(Math.max(TL_START, Math.min(drag.origCo - SNAP_MIN, drag.origCi + deltaMin)));
      setTempCo(drag.origCo);
    } else if (drag.mode === "resizeEnd") {
      setTempCi(drag.origCi);
      setTempCo(Math.max(drag.origCi + SNAP_MIN, Math.min(TL_END, drag.origCo + deltaMin)));
    }
  }

  function endDrag(e: React.PointerEvent) {
    if (!drag) return;
    if (drag.barEl) try { drag.barEl.releasePointerCapture(e.pointerId); } catch {}
    const ci = tempCi, co = tempCo;
    setDrag(null);
    if (ci != null && co != null) onChange(ci, co);
    setTimeout(() => { setTempCi(null); setTempCo(null); }, 50);
  }

  const hasBar = ciM != null && coM != null;

  return (
    <div
      ref={trackRef}
      className="group relative h-full select-none touch-none"
      onPointerDown={(e) => { if (!hasBar) beginDrag("create", e); }}
      onPointerMove={handleMove} onPointerUp={endDrag} onPointerCancel={endDrag}
    >
      {hasBar && ciM != null && coM != null && (
        <div
          className="group/bar absolute top-1 bottom-1 bg-sky-500/50 hover:bg-sky-500/70 rounded cursor-grab active:cursor-grabbing"
          style={{ left: `${tlPct(ciM)}%`, width: `${Math.max(0.5, tlPct(coM) - tlPct(ciM))}%` }}
          onPointerDown={(e) => beginDrag("move", e)}
          onPointerMove={handleMove} onPointerUp={endDrag} onPointerCancel={endDrag}
        >
          <div className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-sky-300/40 rounded-l"
            onPointerDown={(e) => beginDrag("resizeStart", e)} />
          <div className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-sky-300/40 rounded-r"
            onPointerDown={(e) => beginDrag("resizeEnd", e)} />
          <button onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); onClear(); }}
            className="hidden group-hover/bar:flex absolute -top-2 -right-2 w-5 h-5 rounded-full bg-gray-800 border border-gray-600 text-gray-200 hover:bg-red-500 hover:border-red-500 items-center justify-center text-[10px] z-10"
          >✕</button>
        </div>
      )}
      {!hasBar && (
        <div className="absolute inset-0 flex items-center justify-center text-[11px] text-gray-600 pointer-events-none">
          드래그해서 계획
        </div>
      )}
    </div>
  );
}

// ─── Readonly Timeline ───
function ReadonlyTimeline({ day }: { day: MergedDay }) {
  const ciM = parseHM(day.clockIn);
  const coM = parseHM(day.clockOut);
  const nowMin = new Date().getHours() * 60 + new Date().getMinutes();
  const endM = coM != null ? coM : day.ongoing ? nowMin : null;

  return (
    <div className="relative h-full">
      {ciM != null && endM != null && (
        <div className={`absolute top-1 bottom-1 rounded ${day.ongoing ? "bg-amber-400/60 animate-pulse" : "bg-amber-400/70"}`}
          style={{ left: `${tlPct(ciM)}%`, width: `${Math.max(0.5, tlPct(endM) - tlPct(ciM))}%` }} />
      )}
      {day.restRanges?.map((r, i) => {
        const rs = parseHM(r.start), re = parseHM(r.end);
        if (rs == null || re == null) return null;
        return <div key={`r${i}`} className="absolute top-1 bottom-1 bg-neutral-950/60 rounded"
          style={{ left: `${tlPct(rs)}%`, width: `${Math.max(0.3, tlPct(re) - tlPct(rs))}%` }} />;
      })}
      {day.timeOffRanges?.map((r, i) => {
        const ts = parseHM(r.start), te = parseHM(r.end);
        if (ts == null || te == null) return null;
        return <div key={`t${i}`} className="absolute top-1 bottom-1 bg-violet-400/60 rounded"
          style={{ left: `${tlPct(ts)}%`, width: `${Math.max(0.3, tlPct(te) - tlPct(ts))}%` }} />;
      })}
    </div>
  );
}

// ─── Main Page ───
export default function WorktimePage() {
  const [data, setData] = useState<WorktimeData | null>(null);
  const [plans, setPlansState] = useState<PlanStore>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [weekOffset, setWeekOffset] = useState(0);

  const weekOfDate = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + weekOffset * 7);
    return d.toISOString().slice(0, 10);
  }, [weekOffset]);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      const r = await fetch(`/api/worktime?weekOf=${weekOfDate}`, { cache: "no-store" });
      if (!r.ok) throw new Error(`${r.status}`);
      setData(await r.json());
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [weekOfDate]);

  useEffect(() => {
    setPlansState(readPlans());
    refresh();
    const id = setInterval(refresh, 60_000);
    return () => clearInterval(id);
  }, [refresh]);

  function updatePlanByMin(date: string, ciMin: number, coMin: number) {
    const next = { ...plans, [date]: { ...(plans[date] || {}), clockIn: fmtHM(ciMin), clockOut: fmtHM(coMin) } };
    writePlans(next); setPlansState(next);
  }
  function clearPlan(date: string) {
    const next = { ...plans }; delete next[date];
    writePlans(next); setPlansState(next);
  }

  const dates = useMemo(() => {
    if (!data) return [];
    return weekDates(data.weekFrom, data.weekTo);
  }, [data]);

  const byDate = useMemo(() => {
    if (!data) return new Map<string, DayRec>();
    return new Map(data.days.map((d) => [d.date, d]));
  }, [data]);

  const merged = useMemo(() => {
    if (!data) return [];
    return dates.map((dt) => mergeDay(byDate.get(dt), plans[dt], dt));
  }, [data, dates, plans, byDate]);

  const weekTotals = useMemo(() => {
    let recognized = 0;
    for (const d of merged) if (d.source === "actual") recognized += recognizedMin(d);
    return { recognized, remainTarget: Math.max(0, WEEK_REQUIRED_MIN - recognized), remainMax: Math.max(0, WEEK_MAX_MIN - recognized) };
  }, [merged]);

  const todayStr = new Date().toISOString().slice(0, 10);
  const nowMin = new Date().getHours() * 60 + new Date().getMinutes();
  const isCurrentWeek = weekOffset === 0;

  const canLeave = useMemo(() => {
    if (!isCurrentWeek) return null;
    const today = merged.find((d) => d.date === todayStr);
    if (!today || !today.clockIn) return null;
    let others = 0;
    for (const d of merged) if (d.date !== todayStr && d.source === "actual") others += recognizedMin(d);
    const needToday = Math.max(0, WEEK_REQUIRED_MIN - others - (today.timeOffMin || 0));
    const workCap = Math.min(needToday, WORK_CAP_MIN);
    const ciM = parseHM(today.clockIn);
    if (ciM == null) return null;
    const tentativeOut = ciM + workCap;
    const rest = restOverlap(ciM, tentativeOut + 60);
    return { timeStr: fmtHM(ciM + workCap + rest) };
  }, [merged, todayStr, isCurrentWeek]);

  return (
    <div className="min-h-screen bg-neutral-950 text-gray-100">
      <div className="max-w-5xl mx-auto p-4 md:p-6">

        {/* ─── Header: 주 네비게이션 + 요약 ─── */}
        <div className="flex items-center gap-4 mb-4 flex-wrap">
          {/* 주 네비게이션 */}
          <div className="flex items-center gap-2">
            <button onClick={() => setWeekOffset(weekOffset - 1)}
              className="w-7 h-7 flex items-center justify-center rounded hover:bg-white/10 text-gray-400 hover:text-gray-100">‹</button>
            <span className="text-sm font-medium text-gray-300 min-w-[140px] text-center">
              {data ? fmtWeekRange(data.weekFrom, data.weekTo) : "..."}
            </span>
            <button onClick={() => setWeekOffset(weekOffset + 1)}
              className="w-7 h-7 flex items-center justify-center rounded hover:bg-white/10 text-gray-400 hover:text-gray-100">›</button>
          </div>
          {!isCurrentWeek && (
            <button onClick={() => setWeekOffset(0)}
              className="text-xs text-gray-500 hover:text-gray-100 border border-gray-700 rounded px-2 py-0.5">오늘</button>
          )}

          {/* 요약: 총 시간 + 프로그레스 */}
          {data && (
            <div className="flex items-center gap-3 ml-auto">
              <span className="text-2xl font-bold font-mono">{fmtDuration(weekTotals.recognized)}</span>
              <div className="w-32 relative">
                <div className="h-2 bg-white/10 rounded-full">
                  <div className="h-full bg-teal-400/70 rounded-full transition-all"
                    style={{ width: `${Math.min(100, (weekTotals.recognized / WEEK_MAX_MIN) * 100)}%` }} />
                </div>
                <div className="absolute top-[-3px] bottom-[-3px] w-[2px] bg-gray-500"
                  style={{ left: `${(WEEK_REQUIRED_MIN / WEEK_MAX_MIN) * 100}%` }} />
              </div>
              <div className="flex items-center gap-2 text-xs font-mono text-gray-400">
                <span>-{fmtDuration(weekTotals.remainTarget)}</span>
                <span className="text-gray-600">⚑</span>
                <span className="text-gray-600">-{fmtDuration(weekTotals.remainMax)}</span>
              </div>
            </div>
          )}
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-950/40 text-red-400 rounded-xl text-sm border border-red-900/50">
            불러오기 실패: {error}
          </div>
        )}

        {canLeave && (
          <div className="mb-4 p-3 bg-emerald-950/40 rounded-xl border border-emerald-900/50 flex items-center gap-3">
            <span className="text-xs text-emerald-400">오늘 퇴근 가능</span>
            <span className="text-lg font-bold font-mono text-emerald-300">{canLeave.timeStr}</span>
          </div>
        )}

        {/* ─── 시간 헤더 ─── */}
        <div className="flex">
          <div className="w-24 shrink-0" />
          <div className="flex-1 relative h-6">
            {TL_HOURS.map((h) => (
              <div key={h} className="absolute text-[10px] text-gray-600 -translate-x-1/2"
                style={{ left: `${tlPct(h * 60)}%`, top: 0 }}>
                {h === 12 ? "정오" : h > 12 ? h - 12 : h}
              </div>
            ))}
            {/* 현재 시각 */}
            {isCurrentWeek && nowMin >= TL_START && nowMin <= TL_END && (
              <div className="absolute text-[10px] font-mono text-red-400 -translate-x-1/2 font-bold"
                style={{ left: `${tlPct(nowMin)}%`, top: 0 }}>
                {nowMin < 720 ? "오전" : "오후"} {fmtHM(nowMin)}
              </div>
            )}
          </div>
        </div>

        {/* ─── 날짜별 행 ─── */}
        <div className="border-t border-white/5">
          {dates.map((dt, i) => {
            const d = merged[i];
            if (!d) return null;
            const actualDay = byDate.get(dt);
            const planDay = plans[dt];
            const rec = recognizedMin(d);
            const isToday = dt === todayStr;
            const dow = getDow(dt);
            const dayIdx = new Date(dt + "T00:00:00+09:00").getDay();
            const isWeekend = dayIdx === 0 || dayIdx === 6;
            const hasActual = actualDay?.hasActual || false;
            const finalized = isFinalized(d);
            const ongoing = hasActual && !finalized;

            const planMerged = mergeDay(undefined, planDay, dt);
            const actualMerged: MergedDay | null = hasActual ? {
              date: dt, weeklyHoliday: actualDay!.weeklyHoliday || false,
              clockIn: actualDay!.clockIn, clockOut: actualDay!.clockOut,
              workMin: actualDay!.workMin, restMin: actualDay!.restMin, timeOffMin: actualDay!.timeOffMin,
              hasActual: true, ongoing, source: "actual",
              restRanges: actualDay!.restRanges, timeOffRanges: actualDay!.timeOffRanges,
            } : null;

            return (
              <div key={dt} className={`flex border-b border-white/5 ${isToday ? "bg-emerald-950/15" : ""}`}>
                {/* 왼쪽: 날짜 + 근무시간 */}
                <div className="w-24 shrink-0 py-3 px-2 flex items-center gap-2">
                  <div className="flex items-center gap-1">
                    {isToday && <span className="w-6 h-6 rounded-full bg-emerald-500 text-neutral-950 text-xs font-bold flex items-center justify-center">{dateLabel(dt)}</span>}
                    {!isToday && <span className={`text-sm font-semibold ${isWeekend ? "text-red-400" : "text-gray-100"}`}>{dateLabel(dt)}</span>}
                    <span className={`text-xs ${isToday ? "text-emerald-400" : isWeekend ? "text-red-400" : "text-gray-500"}`}>{dow}</span>
                  </div>
                  <span className={`text-xs font-mono ${rec > 0 ? "text-gray-300" : "text-gray-600"}`}>
                    {fmtDuration(rec)}
                  </span>
                </div>

                {/* 타임라인 */}
                <div className="flex-1 relative py-2" style={{ minHeight: "48px" }}>
                  {/* 시간 격자 */}
                  {TL_HOURS.map((h) => (
                    <div key={h} className={`absolute top-0 bottom-0 border-l ${h === 12 ? "border-white/10" : "border-white/5"}`}
                      style={{ left: `${tlPct(h * 60)}%` }} />
                  ))}
                  {/* 현재 시각 라인 */}
                  {isCurrentWeek && nowMin >= TL_START && nowMin <= TL_END && (
                    <div className="absolute top-0 bottom-0 w-[2px] bg-red-500/70 z-10"
                      style={{ left: `${tlPct(nowMin)}%` }} />
                  )}

                  {/* 타임라인 바 */}
                  {finalized ? (
                    <ReadonlyTimeline day={actualMerged!} />
                  ) : (
                    <>
                      <div className={hasActual ? "opacity-30 h-full" : "h-full"}>
                        <EditableTimeline day={planMerged}
                          onChange={(ci, co) => updatePlanByMin(dt, ci, co)}
                          onClear={() => clearPlan(dt)} />
                      </div>
                      {actualMerged && (
                        <div className="absolute inset-0 pointer-events-none py-2">
                          <ReadonlyTimeline day={actualMerged} />
                        </div>
                      )}
                    </>
                  )}

                  {/* 라벨: 출근/퇴근 시간 + 휴게 */}
                  {hasActual && (
                    <div className="absolute bottom-0 left-0 right-0 flex items-center gap-2 text-[9px] text-gray-500 px-1">
                      {actualDay!.clockIn && (
                        <span style={{ marginLeft: `${tlPct(parseHM(actualDay!.clockIn)!)}%` }}>
                          {actualDay!.clockIn}
                        </span>
                      )}
                      {actualDay!.restRanges && actualDay!.restRanges.length > 0 && (
                        <span className="text-gray-600">휴게 {actualDay!.restRanges.length}건</span>
                      )}
                      <span className="ml-auto">
                        {actualDay!.clockOut && (
                          <span className={ongoing ? "text-red-400" : ""}>{actualDay!.clockOut}</span>
                        )}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* 범례 + 리셋 */}
        <div className="mt-6 flex items-center justify-between">
          <div className="flex gap-3 text-[10px] text-gray-500">
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 bg-amber-400/70 rounded-sm" />근무</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 bg-violet-400/60 rounded-sm" />휴가</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 bg-sky-500/50 rounded-sm" />계획</span>
            <span className="flex items-center gap-1"><span className="w-[2px] h-2.5 bg-red-500" />현재</span>
          </div>
          <button
            onClick={() => { if (confirm("계획 전부 지울까요?")) { writePlans({}); setPlansState({}); } }}
            className="text-[10px] text-gray-600 hover:text-red-400"
          >계획 리셋</button>
        </div>
      </div>
    </div>
  );
}
