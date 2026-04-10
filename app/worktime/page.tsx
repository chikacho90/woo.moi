"use client";

import { useEffect, useMemo, useState, useRef, useCallback } from "react";

type TimeRange = { start: string; end: string };
type DayRec = {
  date: string; weeklyHoliday?: boolean;
  clockIn: string | null; clockOut: string | null;
  workMin: number; restMin: number; timeOffMin: number;
  hasActual: boolean; ongoing?: boolean;
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
function restOverlap(ciMin: number, coMin: number): number { return Math.max(0, Math.min(coMin, REST_END) - Math.max(ciMin, REST_START)); }
const DOW_KO = ["일", "월", "화", "수", "목", "금", "토"];
function readPlans(): PlanStore { if (typeof window === "undefined") return {}; try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}"); } catch { return {}; } }
function writePlans(p: PlanStore) { localStorage.setItem(STORAGE_KEY, JSON.stringify(p)); }
function parseHM(s: string | null | undefined): number | null { if (!s) return null; const m = s.match(/^(\d{1,2}):(\d{2})$/); return m ? parseInt(m[1], 10) * 60 + parseInt(m[2], 10) : null; }
function fmtHM(total: number | null): string { if (total == null) return ""; const h = Math.floor(total / 60) % 24, m = total % 60; return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`; }
function fmtAmPm(hm: string): string { const m = parseHM(hm); if (m == null) return hm; const h = Math.floor(m / 60), min = m % 60; return `${h < 12 ? "오전" : "오후"} ${h === 0 ? 12 : h > 12 ? h - 12 : h}:${String(min).padStart(2, "0")}`; }
function fmtDuration(total: number | null): string { if (total == null) return "-"; const sign = total < 0 ? "-" : ""; total = Math.abs(total); return `${sign}${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`; }
function getDow(dateStr: string): string { return DOW_KO[new Date(dateStr + "T00:00:00+09:00").getDay()]; }
function dateLabel(dateStr: string): string { return `${parseInt(dateStr.slice(8, 10), 10)}`; }
function snap(min: number): number { return Math.round(min / SNAP_MIN) * SNAP_MIN; }
function fmtWeekRange(from: string, to: string): string { const f = new Date(from + "T00:00:00+09:00"), t = new Date(to + "T00:00:00+09:00"); return `${f.getFullYear()}. ${f.getMonth() + 1}. ${f.getDate()} – ${t.getMonth() + 1}. ${t.getDate()}`; }

type MergedDay = {
  date: string; weeklyHoliday: boolean;
  clockIn: string | null; clockOut: string | null;
  workMin: number; restMin: number; timeOffMin: number;
  hasActual: boolean; ongoing?: boolean;
  source: "actual" | "plan" | "empty";
  restRanges?: TimeRange[]; timeOffRanges?: TimeRange[];
};

function mergeDay(actual: DayRec | undefined, plan: PlanDay | undefined, date: string): MergedDay {
  if (actual && actual.hasActual) return { date, weeklyHoliday: actual.weeklyHoliday || false, clockIn: actual.clockIn, clockOut: actual.clockOut, workMin: actual.workMin, restMin: actual.restMin, timeOffMin: actual.timeOffMin, hasActual: true, ongoing: actual.ongoing, source: "actual", restRanges: actual.restRanges, timeOffRanges: actual.timeOffRanges };
  const ci = plan?.clockIn || null, co = plan?.clockOut || null, ciM = parseHM(ci), coM = parseHM(co);
  let workMin = 0, restMin = 0;
  if (ciM != null && coM != null) { restMin = restOverlap(ciM, coM); workMin = Math.max(0, coM - ciM - restMin); }
  return { date, weeklyHoliday: actual?.weeklyHoliday || false, clockIn: ci, clockOut: co, workMin, restMin, timeOffMin: plan?.timeOffMin || 0, hasActual: false, source: plan && (ci || co || plan.timeOffMin) ? "plan" : "empty" };
}
function recognizedMin(d: MergedDay): number { return Math.min(d.workMin || 0, WORK_CAP_MIN) + (d.timeOffMin || 0); }
function isFinalized(d: MergedDay): boolean { if (d.source !== "actual") return false; if (!d.ongoing) return true; return d.date < new Date().toISOString().slice(0, 10); }
function weekDates(from: string, to: string): string[] { const out: string[] = []; const s = new Date(from + "T00:00:00+09:00"), e = new Date(to + "T00:00:00+09:00"); for (let d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) out.push(new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10)); return out; }
function overtimeStartMin(ciMin: number, restMin: number, timeOffMin: number): number { return ciMin + Math.max(0, DAILY_TARGET_MIN - timeOffMin) + restMin; }

// ─── Editable Timeline ───
type DragMode = "move" | "resizeStart" | "resizeEnd" | "create" | null;
type DragState = { mode: DragMode; startX: number; origCi: number; origCo: number; barEl: HTMLElement | null };

function EditableTimeline({ day, onChange, onClear }: { day: MergedDay; onChange: (ci: number, co: number) => void; onClear: () => void }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [tempCi, setTempCi] = useState<number | null>(null);
  const [tempCo, setTempCo] = useState<number | null>(null);
  const ciM = tempCi ?? parseHM(day.clockIn), coM = tempCo ?? parseHM(day.clockOut);
  const xToMin = useCallback((clientX: number): number => { const el = trackRef.current; if (!el) return 0; const r = el.getBoundingClientRect(); return snap(TL_START + (Math.max(0, Math.min(r.width, clientX - r.left)) / r.width) * TL_RANGE); }, []);
  function beginDrag(mode: DragMode, e: React.PointerEvent) { e.stopPropagation(); e.preventDefault(); const el = e.currentTarget as HTMLElement; el.setPointerCapture(e.pointerId); let origCi = ciM ?? 600, origCo = coM ?? 1140; if (mode === "create") { const t = xToMin(e.clientX); origCi = t; origCo = Math.min(TL_END, t + 540); setTempCi(origCi); setTempCo(origCo); } setDrag({ mode, startX: e.clientX, origCi, origCo, barEl: el }); }
  function handleMove(e: React.PointerEvent) { if (!drag) return; const dx = e.clientX - drag.startX, trackW = trackRef.current?.getBoundingClientRect().width || 1, deltaMin = snap((dx / trackW) * TL_RANGE); if (drag.mode === "move" || drag.mode === "create") { let ci = drag.origCi + (drag.mode === "move" ? deltaMin : 0), co = drag.origCo + (drag.mode === "move" ? deltaMin : 0); if (drag.mode === "create") { const now = xToMin(e.clientX); if (now >= drag.origCi) { ci = drag.origCi; co = Math.max(ci + SNAP_MIN, now); } else { ci = now; co = drag.origCi; } } if (drag.mode === "move") { const dur = drag.origCo - drag.origCi; if (ci < TL_START) { ci = TL_START; co = TL_START + dur; } if (co > TL_END) { co = TL_END; ci = co - dur; } } setTempCi(ci); setTempCo(co); } else if (drag.mode === "resizeStart") { setTempCi(Math.max(TL_START, Math.min(drag.origCo - SNAP_MIN, drag.origCi + deltaMin))); setTempCo(drag.origCo); } else if (drag.mode === "resizeEnd") { setTempCi(drag.origCi); setTempCo(Math.max(drag.origCi + SNAP_MIN, Math.min(TL_END, drag.origCo + deltaMin))); } }
  function endDrag(e: React.PointerEvent) { if (!drag) return; if (drag.barEl) try { drag.barEl.releasePointerCapture(e.pointerId); } catch {} if (tempCi != null && tempCo != null) onChange(tempCi, tempCo); setDrag(null); setTimeout(() => { setTempCi(null); setTempCo(null); }, 50); }
  const hasBar = ciM != null && coM != null;
  return (
    <div ref={trackRef} className="group relative h-full select-none touch-none" onPointerDown={(e) => { if (!hasBar) beginDrag("create", e); }} onPointerMove={handleMove} onPointerUp={endDrag} onPointerCancel={endDrag}>
      {hasBar && ciM != null && coM != null && (
        <div className="group/bar absolute top-0 bottom-0 bg-blue-400/60 hover:bg-blue-400/80 rounded cursor-grab active:cursor-grabbing" style={{ left: `${tlPct(ciM)}%`, width: `${Math.max(0.5, tlPct(coM) - tlPct(ciM))}%` }} onPointerDown={(e) => beginDrag("move", e)} onPointerMove={handleMove} onPointerUp={endDrag} onPointerCancel={endDrag}>
          <div className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-blue-300/40 rounded-l" onPointerDown={(e) => beginDrag("resizeStart", e)} />
          <div className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-blue-300/40 rounded-r" onPointerDown={(e) => beginDrag("resizeEnd", e)} />
          <button onPointerDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); onClear(); }} className="hidden group-hover/bar:flex absolute -top-2 -right-2 w-5 h-5 rounded-full bg-white border border-gray-300 text-gray-500 hover:bg-red-500 hover:border-red-500 hover:text-white items-center justify-center text-[10px] z-10">✕</button>
        </div>
      )}
      {!hasBar && <div className="absolute inset-0 flex items-center justify-center text-[11px] text-gray-400 pointer-events-none">드래그해서 계획</div>}
    </div>
  );
}

// ─── Readonly Timeline ───
function ReadonlyTimeline({ day }: { day: MergedDay }) {
  const ciM = parseHM(day.clockIn), coM = parseHM(day.clockOut);
  const nowMin = new Date().getHours() * 60 + new Date().getMinutes();
  const endM = coM != null ? coM : day.ongoing ? nowMin : null;
  const otStart = ciM != null ? overtimeStartMin(ciM, day.restMin, day.timeOffMin) : null;
  const hasOvertime = otStart != null && endM != null && endM > otStart;
  return (
    <div className="relative h-full">
      {ciM != null && endM != null && (
        <div className={`absolute top-0 bottom-0 rounded-l ${!hasOvertime ? "rounded-r" : ""} ${day.ongoing ? "bg-amber-300 animate-pulse" : "bg-amber-300"}`}
          style={{ left: `${tlPct(ciM)}%`, width: `${Math.max(0.3, tlPct(hasOvertime ? otStart! : endM) - tlPct(ciM))}%` }} />
      )}
      {hasOvertime && otStart != null && endM != null && (
        <div className={`absolute top-0 bottom-0 rounded-r bg-red-400 ${day.ongoing ? "animate-pulse" : ""}`}
          style={{ left: `${tlPct(otStart)}%`, width: `${Math.max(0.3, tlPct(endM) - tlPct(otStart))}%` }} />
      )}
      {day.restRanges?.map((r, i) => {
        const rs = parseHM(r.start), re = parseHM(r.end);
        if (rs == null || re == null) return null;
        return <div key={`r${i}`} className="absolute top-0 bottom-0 bg-white/50 rounded" style={{ left: `${tlPct(rs)}%`, width: `${Math.max(0.2, tlPct(re) - tlPct(rs))}%` }} />;
      })}
      {day.timeOffRanges?.map((r, i) => {
        const ts = parseHM(r.start), te = parseHM(r.end);
        if (ts == null || te == null) return null;
        return <div key={`t${i}`} className="absolute top-0 bottom-0 bg-purple-300 rounded" style={{ left: `${tlPct(ts)}%`, width: `${Math.max(0.3, tlPct(te) - tlPct(ts))}%` }} />;
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
  const scrollRef = useRef<HTMLDivElement>(null);

  const weekOfDate = useMemo(() => { const d = new Date(); d.setDate(d.getDate() + weekOffset * 7); return d.toISOString().slice(0, 10); }, [weekOffset]);
  const refresh = useCallback(async () => { try { setLoading(true); const r = await fetch(`/api/worktime?weekOf=${weekOfDate}`, { cache: "no-store" }); if (!r.ok) throw new Error(`${r.status}`); setData(await r.json()); setError(null); } catch (e) { setError((e as Error).message); } finally { setLoading(false); } }, [weekOfDate]);
  useEffect(() => { setPlansState(readPlans()); refresh(); const id = setInterval(refresh, 60_000); return () => clearInterval(id); }, [refresh]);
  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollLeft = tlPx(8 * 60); }, [data]);

  function updatePlanByMin(date: string, ciMin: number, coMin: number) { const next = { ...plans, [date]: { ...(plans[date] || {}), clockIn: fmtHM(ciMin), clockOut: fmtHM(coMin) } }; writePlans(next); setPlansState(next); }
  function clearPlan(date: string) { const next = { ...plans }; delete next[date]; writePlans(next); setPlansState(next); }

  const dates = useMemo(() => data ? weekDates(data.weekFrom, data.weekTo) : [], [data]);
  const byDate = useMemo(() => data ? new Map(data.days.map((d) => [d.date, d])) : new Map<string, DayRec>(), [data]);
  const merged = useMemo(() => data ? dates.map((dt) => mergeDay(byDate.get(dt), plans[dt], dt)) : [], [data, dates, plans, byDate]);
  const weekTotals = useMemo(() => { let r = 0; for (const d of merged) if (d.source === "actual") r += recognizedMin(d); return { recognized: r, remainTarget: Math.max(0, WEEK_REQUIRED_MIN - r), remainMax: Math.max(0, WEEK_MAX_MIN - r) }; }, [merged]);

  const todayStr = new Date().toISOString().slice(0, 10);
  const nowMin = new Date().getHours() * 60 + new Date().getMinutes();
  const isCurrentWeek = weekOffset === 0;

  return (
    <div className="min-h-screen bg-white text-gray-900">
      <div className="max-w-[100vw] mx-auto">

        {/* Header */}
        <div className="flex items-center gap-4 px-5 py-3 flex-wrap sticky top-0 bg-white/95 backdrop-blur z-20 border-b border-gray-200">
          <div className="flex items-center gap-1">
            <button onClick={() => setWeekOffset(weekOffset - 1)} className="w-7 h-7 flex items-center justify-center rounded hover:bg-gray-100 text-gray-400 text-lg">‹</button>
            <span className="text-sm font-medium text-gray-800 min-w-[140px] text-center">{data ? fmtWeekRange(data.weekFrom, data.weekTo) : "..."}</span>
            <button onClick={() => setWeekOffset(weekOffset + 1)} className="w-7 h-7 flex items-center justify-center rounded hover:bg-gray-100 text-gray-400 text-lg">›</button>
          </div>
          {!isCurrentWeek && <button onClick={() => setWeekOffset(0)} className="text-xs text-gray-500 hover:text-gray-900">오늘</button>}
          {data && (
            <div className="flex items-center gap-3 ml-auto">
              <span className="text-2xl font-bold font-mono text-gray-900">{fmtDuration(weekTotals.recognized)}</span>
              <div className="w-28 relative">
                <div className="h-2 bg-gray-200 rounded-full"><div className="h-full bg-teal-400 rounded-full transition-all" style={{ width: `${Math.min(100, (weekTotals.recognized / WEEK_MAX_MIN) * 100)}%` }} /></div>
                <div className="absolute top-[-3px] bottom-[-3px] w-[2px] bg-gray-400" style={{ left: `${(WEEK_REQUIRED_MIN / WEEK_MAX_MIN) * 100}%` }} />
              </div>
              <div className="flex items-center gap-2 text-xs font-mono text-gray-500">
                <span>-{fmtDuration(weekTotals.remainTarget)}</span>
                <span className="text-gray-400">⚑</span>
                <span className="text-gray-400">-{fmtDuration(weekTotals.remainMax)}</span>
              </div>
            </div>
          )}
        </div>

        {error && <div className="mx-5 my-2 p-3 bg-red-50 text-red-600 rounded-lg text-sm border border-red-200">불러오기 실패: {error}</div>}

        {/* Scrollable Timeline */}
        <div ref={scrollRef} className="overflow-x-auto">
          <div style={{ width: `${TL_WIDTH + 140}px`, minWidth: "100%" }}>

            {/* Hour header */}
            <div className="flex border-b border-gray-200">
              <div className="w-[140px] shrink-0" />
              <div className="relative h-8" style={{ width: `${TL_WIDTH}px` }}>
                {TL_HOURS.map((h) => (
                  <div key={h} className="absolute text-[11px] text-gray-400 -translate-x-1/2" style={{ left: `${tlPct(h * 60)}%`, top: "8px" }}>
                    {h === 0 || h === 24 ? "" : h === 12 ? <span className="text-gray-500">정오<br/><span className="text-[10px]">12</span></span> : h > 12 ? h - 12 : h}
                  </div>
                ))}
                {isCurrentWeek && (
                  <div className="absolute text-[10px] font-mono text-red-500 -translate-x-1/2 font-bold" style={{ left: `${tlPct(nowMin)}%`, top: "6px" }}>
                    {nowMin < 720 ? "오전" : "오후"} {fmtHM(nowMin)}
                  </div>
                )}
              </div>
            </div>

            {/* Day rows */}
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
              const isOvertime = rec > DAILY_TARGET_MIN;

              const planMerged = mergeDay(undefined, planDay, dt);
              const actualMerged: MergedDay | null = hasActual ? { date: dt, weeklyHoliday: actualDay!.weeklyHoliday || false, clockIn: actualDay!.clockIn, clockOut: actualDay!.clockOut, workMin: actualDay!.workMin, restMin: actualDay!.restMin, timeOffMin: actualDay!.timeOffMin, hasActual: true, ongoing, source: "actual", restRanges: actualDay!.restRanges, timeOffRanges: actualDay!.timeOffRanges } : null;

              return (
                <div key={dt} className={`flex border-b border-gray-100 ${isToday ? "bg-green-50/60" : ""}`}>
                  {/* Left panel */}
                  <div className="w-[140px] shrink-0 py-5 px-5 sticky left-0 z-[5] flex items-center gap-3" style={{ backgroundColor: isToday ? "rgb(240 253 244 / 0.6)" : "white" }}>
                    <div className="flex items-baseline gap-1 min-w-[42px]">
                      {isToday
                        ? <span className="w-7 h-7 rounded-full bg-green-500 text-white text-sm font-bold flex items-center justify-center shrink-0">{dateLabel(dt)}</span>
                        : <span className={`text-lg font-medium ${isWeekend ? "text-red-400" : "text-gray-800"}`}>{dateLabel(dt)}</span>
                      }
                      <span className={`text-sm ${isToday ? "text-green-600" : isWeekend ? "text-red-400" : "text-gray-400"}`}>{dow}</span>
                    </div>
                    <span className={`text-sm font-mono whitespace-nowrap px-1.5 py-0.5 rounded ${isOvertime ? "bg-red-100 text-red-600 font-semibold" : rec > 0 ? "bg-gray-100 text-gray-700" : "bg-gray-50 text-gray-400"}`}>
                      {fmtDuration(rec)}{isOvertime ? " 🔥" : ""}
                    </span>
                  </div>

                  {/* Timeline */}
                  <div className="relative py-3" style={{ width: `${TL_WIDTH}px`, minHeight: "80px" }}>
                    {TL_HOURS.map((h) => (
                      <div key={h} className={`absolute top-0 bottom-0 ${h === 12 ? "border-l border-gray-300 border-dashed" : "border-l border-gray-100"}`} style={{ left: `${tlPct(h * 60)}%` }} />
                    ))}
                    {isCurrentWeek && (
                      <div className="absolute top-0 bottom-0 w-[2px] bg-red-400 z-[4]" style={{ left: `${tlPct(nowMin)}%` }} />
                    )}

                    {/* Bars */}
                    <div className="relative" style={{ height: "32px", marginTop: "4px" }}>
                      {finalized ? (
                        <ReadonlyTimeline day={actualMerged!} />
                      ) : (
                        <>
                          <div className={hasActual ? "opacity-30 h-full" : "h-full"}>
                            <EditableTimeline day={planMerged} onChange={(ci, co) => updatePlanByMin(dt, ci, co)} onClear={() => clearPlan(dt)} />
                          </div>
                          {actualMerged && <div className="absolute inset-0 pointer-events-none"><ReadonlyTimeline day={actualMerged} /></div>}
                        </>
                      )}
                    </div>

                    {/* Labels */}
                    {hasActual && (
                      <div className="relative text-[10px] text-gray-500 mt-1 h-4">
                        {actualDay!.clockIn && (
                          <span className="absolute whitespace-nowrap" style={{ left: `${tlPct(parseHM(actualDay!.clockIn)!)}%` }}>
                            {fmtAmPm(actualDay!.clockIn)}
                            {actualDay!.restRanges && actualDay!.restRanges.length > 0 && <span className="text-gray-400 ml-1">휴게 {actualDay!.restRanges.length}건</span>}
                          </span>
                        )}
                        {actualDay!.clockOut && (
                          <span className={`absolute whitespace-nowrap ${ongoing ? "text-red-500 font-semibold" : ""}`} style={{ left: `${tlPct(parseHM(actualDay!.clockOut)!)}%`, transform: "translateX(-100%)" }}>
                            {fmtAmPm(actualDay!.clockOut)}
                          </span>
                        )}
                        {actualDay!.timeOffRanges?.map((r, j) => (
                          <span key={j} className="absolute whitespace-nowrap text-purple-500" style={{ left: `${tlPct(parseHM(r.start)!)}%` }}>
                            {fmtAmPm(r.start)}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Legend */}
        <div className="px-5 py-4 flex items-center justify-between text-[10px] text-gray-400 border-t border-gray-100">
          <div className="flex gap-3">
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 bg-amber-300 rounded-sm" />근무</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 bg-red-400 rounded-sm" />초과</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 bg-purple-300 rounded-sm" />휴가</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 bg-blue-400/60 rounded-sm" />계획</span>
            <span className="flex items-center gap-1"><span className="w-[2px] h-2.5 bg-red-400" />현재</span>
          </div>
          <button onClick={() => { if (confirm("계획 전부 지울까요?")) { writePlans({}); setPlansState({}); } }} className="text-gray-400 hover:text-red-500">계획 리셋</button>
        </div>
      </div>
    </div>
  );
}
