"use client";

import { useEffect, useMemo, useState, useRef, useCallback } from "react";

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

type PlanDay = {
  clockIn?: string;
  clockOut?: string;
  timeOffMin?: number;
};
type PlanStore = Record<string, PlanDay>;

const STORAGE_KEY = "worktime-plans";
const WORK_CAP_MIN = 540;
const DAILY_TARGET_MIN = 480;
const WEEK_REQUIRED_MIN = 2400;
const WEEK_MAX_MIN = 3360; // 56시간
const REST_START = 12 * 60 + 30; // 12:30
const REST_END = 13 * 60 + 30;   // 13:30
const SNAP_MIN = 1;

function restOverlap(ciMin: number, coMin: number): number {
  const s = Math.max(ciMin, REST_START);
  const e = Math.min(coMin, REST_END);
  return Math.max(0, e - s);
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
  const d = new Date(dateStr + "T00:00:00+09:00");
  return DOW_KO[d.getDay()];
}
function dateLabel(dateStr: string): string {
  return `${parseInt(dateStr.slice(8, 10), 10)}`;
}
function snap(min: number): number {
  return Math.round(min / SNAP_MIN) * SNAP_MIN;
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
};

function mergeDay(actual: DayRec | undefined, plan: PlanDay | undefined, date: string): MergedDay {
  if (actual && actual.hasActual) {
    return {
      date,
      weeklyHoliday: actual.weeklyHoliday || false,
      clockIn: actual.clockIn,
      clockOut: actual.clockOut,
      workMin: actual.workMin,
      restMin: actual.restMin,
      timeOffMin: actual.timeOffMin,
      hasActual: true,
      ongoing: actual.ongoing,
      source: "actual",
    };
  }
  const ci = plan?.clockIn || null;
  const co = plan?.clockOut || null;
  const ciM = parseHM(ci);
  const coM = parseHM(co);
  let workMin = 0;
  let restMin = 0;
  if (ciM != null && coM != null) {
    restMin = restOverlap(ciM, coM);
    workMin = Math.max(0, coM - ciM - restMin);
  }
  return {
    date,
    weeklyHoliday: actual?.weeklyHoliday || false,
    clockIn: ci,
    clockOut: co,
    workMin,
    restMin,
    timeOffMin: plan?.timeOffMin || 0,
    hasActual: false,
    source: plan && (ci || co || plan.timeOffMin) ? "plan" : "empty",
  };
}

function recognizedMin(d: MergedDay): number {
  return Math.min(d.workMin || 0, WORK_CAP_MIN) + (d.timeOffMin || 0);
}
// 확정된(finalized) 일: 실제 데이터가 있고 진행중이 아닌 날
// 지난 날짜인데 ongoing으로 남아있으면 데이터 지연 → 확정 처리
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

// ─────── Editable Timeline (drag to plan) ───────
type DragMode = "move" | "resizeStart" | "resizeEnd" | "create" | null;
type DragState = {
  mode: DragMode;
  startX: number;
  origCi: number;
  origCo: number;
  barEl: HTMLElement | null;
};

function EditableTimeline({
  day,
  onChange,
  onClear,
}: {
  day: MergedDay;
  onChange: (ci: number, co: number) => void;
  onClear: () => void;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [tempCi, setTempCi] = useState<number | null>(null);
  const [tempCo, setTempCo] = useState<number | null>(null);

  const ciM = tempCi ?? parseHM(day.clockIn);
  const coM = tempCo ?? parseHM(day.clockOut);
  const isToday = day.date === new Date().toISOString().slice(0, 10);
  const nowMin = new Date().getHours() * 60 + new Date().getMinutes();
  const pct = (m: number) => Math.max(0, Math.min(100, (m / (24 * 60)) * 100));

  const xToMin = useCallback((clientX: number): number => {
    const el = trackRef.current;
    if (!el) return 0;
    const r = el.getBoundingClientRect();
    const x = Math.max(0, Math.min(r.width, clientX - r.left));
    return snap((x / r.width) * 24 * 60);
  }, []);

  function beginDrag(mode: DragMode, e: React.PointerEvent) {
    e.stopPropagation();
    e.preventDefault();
    const el = e.currentTarget as HTMLElement;
    el.setPointerCapture(e.pointerId);
    let origCi = ciM ?? 600;
    let origCo = coM ?? 1140;
    if (mode === "create") {
      const t = xToMin(e.clientX);
      // 새 바: 클릭 위치를 출근으로, +9h
      origCi = t;
      origCo = Math.min(24 * 60, t + 9 * 60);
      setTempCi(origCi);
      setTempCo(origCo);
    }
    setDrag({ mode, startX: e.clientX, origCi, origCo, barEl: el });
  }

  function handleMove(e: React.PointerEvent) {
    if (!drag) return;
    const dx = e.clientX - drag.startX;
    const trackW = trackRef.current?.getBoundingClientRect().width || 1;
    const deltaMin = snap((dx / trackW) * 24 * 60);
    if (drag.mode === "move" || drag.mode === "create") {
      let ci = drag.origCi + (drag.mode === "move" ? deltaMin : 0);
      let co = drag.origCo + (drag.mode === "move" ? deltaMin : 0);
      if (drag.mode === "create") {
        // create 모드: pointer를 따라 끝(퇴근)을 이동
        const now = xToMin(e.clientX);
        if (now >= drag.origCi) {
          ci = drag.origCi;
          co = Math.max(drag.origCi + SNAP_MIN, now);
        } else {
          ci = now;
          co = drag.origCi;
        }
      }
      if (drag.mode === "move") {
        const dur = drag.origCo - drag.origCi;
        if (ci < 0) { ci = 0; co = dur; }
        if (co > 24 * 60) { co = 24 * 60; ci = co - dur; }
      }
      setTempCi(ci);
      setTempCo(co);
    } else if (drag.mode === "resizeStart") {
      const ci = Math.max(0, Math.min(drag.origCo - SNAP_MIN, drag.origCi + deltaMin));
      setTempCi(ci);
      setTempCo(drag.origCo);
    } else if (drag.mode === "resizeEnd") {
      const co = Math.max(drag.origCi + SNAP_MIN, Math.min(24 * 60, drag.origCo + deltaMin));
      setTempCi(drag.origCi);
      setTempCo(co);
    }
  }

  function endDrag(e: React.PointerEvent) {
    if (!drag) return;
    const el = drag.barEl;
    if (el) try { el.releasePointerCapture(e.pointerId); } catch {}
    const ci = tempCi;
    const co = tempCo;
    setDrag(null);
    if (ci != null && co != null) onChange(ci, co);
    // keep temp until parent updates via plan
    setTimeout(() => { setTempCi(null); setTempCo(null); }, 50);
  }

  const hasBar = ciM != null && coM != null;

  return (
    <div
      ref={trackRef}
      className="group relative h-10 bg-white/5 rounded-lg overflow-visible select-none touch-none"
      onPointerDown={(e) => { if (!hasBar) beginDrag("create", e); }}
      onPointerMove={handleMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
    >
      {/* hour marks */}
      {[3, 6, 9, 12, 15, 18, 21].map((h) => (
        <div key={h} className="absolute top-0 bottom-0 border-l border-white/5 pointer-events-none"
          style={{ left: `${pct(h * 60)}%` }} />
      ))}
      {[6, 12, 18].map((h) => (
        <div key={h} className="absolute top-0 text-[9px] text-gray-500 pointer-events-none"
          style={{ left: `${pct(h * 60)}%`, transform: "translateX(2px)" }}>{h}</div>
      ))}

      {/* bar */}
      {hasBar && ciM != null && coM != null && (
        <div
          className="group/bar absolute top-1 bottom-1 bg-sky-500/60 hover:bg-sky-500/80 rounded cursor-grab active:cursor-grabbing"
          style={{ left: `${pct(ciM)}%`, width: `${Math.max(0.5, pct(coM) - pct(ciM))}%` }}
          onPointerDown={(e) => beginDrag("move", e)}
          onPointerMove={handleMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
        >
          <div
            className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-sky-300/40 rounded-l"
            onPointerDown={(e) => beginDrag("resizeStart", e)}
          />
          <div
            className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-sky-300/40 rounded-r"
            onPointerDown={(e) => beginDrag("resizeEnd", e)}
          />
          {/* hover X button */}
          <button
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); onClear(); }}
            className="hidden group-hover/bar:flex absolute -top-2 -right-2 w-5 h-5 rounded-full bg-gray-800 border border-gray-600 text-gray-200 hover:bg-red-500 hover:border-red-500 items-center justify-center text-[10px] z-10"
            aria-label="계획 지우기"
          >
            ✕
          </button>
        </div>
      )}

      {isToday && (
        <div className="absolute top-0 bottom-0 w-[2px] bg-red-500 pointer-events-none" style={{ left: `${pct(nowMin)}%` }} />
      )}

      {ciM != null && (
        <div className="absolute text-[10px] font-mono text-sky-400 -translate-x-1/2 pointer-events-none"
          style={{ left: `${pct(ciM)}%`, bottom: "-16px" }}>{fmtHM(ciM)}</div>
      )}
      {coM != null && (
        <div className="absolute text-[10px] font-mono text-sky-400 -translate-x-1/2 pointer-events-none"
          style={{ left: `${pct(coM)}%`, bottom: "-16px" }}>{fmtHM(coM)}</div>
      )}

      {!hasBar && (
        <div className="absolute inset-0 flex items-center justify-center text-[11px] text-gray-600 pointer-events-none">
          드래그해서 계획 추가
        </div>
      )}
    </div>
  );
}

// ─────── Readonly Timeline (actual data) ───────
function ReadonlyTimeline({ day }: { day: MergedDay }) {
  const ciM = parseHM(day.clockIn);
  const coM = parseHM(day.clockOut);
  const isToday = day.date === new Date().toISOString().slice(0, 10);
  const nowMin = new Date().getHours() * 60 + new Date().getMinutes();
  const pct = (m: number) => Math.max(0, Math.min(100, (m / (24 * 60)) * 100));
  const endM = coM != null ? coM : day.ongoing ? nowMin : null;

  return (
    <div className="relative h-10 bg-white/5 rounded-lg overflow-visible">
      {[3, 6, 9, 12, 15, 18, 21].map((h) => (
        <div key={h} className="absolute top-0 bottom-0 border-l border-white/5"
          style={{ left: `${pct(h * 60)}%` }} />
      ))}
      {ciM != null && endM != null && (
        <div className={`absolute top-1 bottom-1 rounded ${day.ongoing ? "bg-amber-400/70 animate-pulse" : "bg-amber-400/80"}`}
          style={{ left: `${pct(ciM)}%`, width: `${Math.max(0.5, pct(endM) - pct(ciM))}%` }} />
      )}
      {isToday && (
        <div className="absolute top-0 bottom-0 w-[2px] bg-red-500" style={{ left: `${pct(nowMin)}%` }} />
      )}
      {ciM != null && (
        <div className="absolute text-[10px] font-mono text-gray-400 -translate-x-1/2"
          style={{ left: `${pct(ciM)}%`, bottom: "-16px" }}>{day.clockIn}</div>
      )}
      {coM != null && (
        <div className="absolute text-[10px] font-mono text-gray-400 -translate-x-1/2"
          style={{ left: `${pct(coM)}%`, bottom: "-16px" }}>{day.clockOut}</div>
      )}
    </div>
  );
}

export default function WorktimePage() {
  const [data, setData] = useState<WorktimeData | null>(null);
  const [plans, setPlansState] = useState<PlanStore>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    try {
      setLoading(true);
      const r = await fetch("/api/worktime", { cache: "no-store" });
      if (!r.ok) throw new Error(`${r.status}`);
      setData(await r.json());
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setPlansState(readPlans());
    refresh();
    const id = setInterval(refresh, 60_000);
    return () => clearInterval(id);
  }, []);

  function updatePlanByMin(date: string, ciMin: number, coMin: number) {
    const next = { ...plans };
    next[date] = { ...(next[date] || {}), clockIn: fmtHM(ciMin), clockOut: fmtHM(coMin) };
    writePlans(next);
    setPlansState(next);
  }
  function clearPlan(date: string) {
    const next = { ...plans };
    delete next[date];
    writePlans(next);
    setPlansState(next);
  }

  const dates = useMemo(() => {
    if (!data) return [];
    return weekDates(data.weekFrom, data.weekTo).filter((dt) => {
      const dow = new Date(dt + "T00:00:00+09:00").getDay();
      return dow >= 1 && dow <= 5;
    });
  }, [data]);
  const byDate = useMemo(() => {
    if (!data) return new Map<string, DayRec>();
    return new Map(data.days.map((d) => [d.date, d]));
  }, [data]);
  const merged = useMemo(() => {
    if (!data) return [];
    return dates.map((dt) => mergeDay(byDate.get(dt), plans[dt], dt));
  }, [data, dates, plans, byDate]);

  // 실제 데이터 있는 모든 날 (확정 + 진행중) 통계
  const weekTotals = useMemo(() => {
    let recognized = 0;
    for (const d of merged) {
      if (d.source === "actual") recognized += recognizedMin(d);
    }
    const remainTarget = Math.max(0, WEEK_REQUIRED_MIN - recognized);
    const remainMax = Math.max(0, WEEK_MAX_MIN - recognized);
    return { recognized, remainTarget, remainMax };
  }, [merged]);

  const todayStr = new Date().toISOString().slice(0, 10);
  const canLeave = useMemo(() => {
    const today = merged.find((d) => d.date === todayStr);
    if (!today || !today.clockIn) return null;
    // 오늘을 제외한 actual 날들의 recognized + 오늘 휴가
    let others = 0;
    for (const d of merged) if (d.date !== todayStr && d.source === "actual") others += recognizedMin(d);
    const needToday = Math.max(0, WEEK_REQUIRED_MIN - others - (today.timeOffMin || 0));
    const workCap = Math.min(needToday, WORK_CAP_MIN);
    const ciM = parseHM(today.clockIn);
    if (ciM == null) return null;
    const tentativeOut = ciM + workCap;
    const rest = restOverlap(ciM, tentativeOut + 60);
    return { timeStr: fmtHM(ciM + workCap + rest), needToday };
  }, [merged, todayStr]);

  return (
    <div className="min-h-screen bg-neutral-950 text-gray-100">
      <div className="max-w-3xl mx-auto p-4 md:p-8">

        {error && (
          <div className="mb-4 p-3 bg-red-950/40 text-red-400 rounded-xl text-sm border border-red-900/50">
            불러오기 실패: {error}
          </div>
        )}

        {data && (
          <div className="mb-8">
            {/* 상단: 현재 시간 */}
            <div className="text-3xl font-bold font-mono mb-3">{fmtDuration(weekTotals.recognized)}</div>
            {/* 바 위 라벨: 깃발(목표) + 최대 잔여 — 같은 높이 */}
            <div className="relative flex items-end mb-1" style={{ height: "20px" }}>
              <div
                className="absolute flex items-baseline gap-1 pointer-events-none"
                style={{ left: `${(WEEK_REQUIRED_MIN / WEEK_MAX_MIN) * 100}%`, bottom: 0, transform: "translateX(-2px)" }}
              >
                <span className="text-gray-400 text-lg leading-none">⚑</span>
                <span className={`text-xs font-mono ${weekTotals.remainTarget > 0 ? "text-gray-400" : "text-emerald-400"}`}>
                  -{fmtDuration(weekTotals.remainTarget)}
                </span>
              </div>
              <div className="absolute right-0 text-xs font-mono text-gray-600" style={{ bottom: 0 }}>
                -{fmtDuration(weekTotals.remainMax)}
              </div>
            </div>
            {/* 프로그레스 바: 전체 = 최대시간, 마커 = 목표시간 */}
            <div className="relative h-2 bg-white/10 rounded-full">
              <div
                className="h-full bg-teal-400/70 rounded-full transition-all"
                style={{ width: `${Math.min(100, (weekTotals.recognized / WEEK_MAX_MIN) * 100)}%` }}
              />
              {/* 목표(40h) 마커 라인 */}
              <div
                className="absolute top-[-3px] bottom-[-3px] w-[2px] bg-gray-500"
                style={{ left: `${(WEEK_REQUIRED_MIN / WEEK_MAX_MIN) * 100}%` }}
              />
            </div>
          </div>
        )}

        {canLeave && (
          <div className="mb-6 p-4 bg-emerald-950/40 rounded-2xl border border-emerald-900/50">
            <div className="text-xs text-emerald-400 mb-1">오늘 퇴근 가능</div>
            <div className="text-3xl font-bold font-mono text-emerald-300">{canLeave.timeStr}</div>
          </div>
        )}

        {/* 날짜별 행 */}
        <div className="space-y-1">
          {dates.map((dt, i) => {
            const d = merged[i];
            if (!d) return null;
            const actualDay = byDate.get(dt);
            const planDay = plans[dt];
            const rec = recognizedMin(d);
            const isToday = dt === todayStr;
            const dow = getDow(dt);
            const isWeekend = dow === "토" || dow === "일";
            const hasActual = actualDay?.hasActual || false;
            const finalized = isFinalized(d);
            const ongoing = hasActual && !finalized;

            // 계획 레이어용 MergedDay (actual 무시)
            const planMerged = mergeDay(undefined, planDay, dt);
            // 실제 레이어용 MergedDay (ongoing 보정 포함)
            const actualMerged: MergedDay | null = hasActual ? {
              date: dt,
              weeklyHoliday: actualDay!.weeklyHoliday || false,
              clockIn: actualDay!.clockIn,
              clockOut: actualDay!.clockOut,
              workMin: actualDay!.workMin,
              restMin: actualDay!.restMin,
              timeOffMin: actualDay!.timeOffMin,
              hasActual: true,
              ongoing,
              source: "actual",
            } : null;

            const dimClass = finalized ? "opacity-50" : "";

            return (
              <div
                key={dt}
                className={`rounded-2xl px-3 pt-3 pb-6 ${isToday ? "bg-emerald-950/20" : ""} ${dimClass}`}
              >
                <div className="flex items-center gap-3">
                  {/* 왼쪽: 요일 + 날짜 */}
                  <div className="w-14 shrink-0 flex items-baseline gap-1.5">
                    <div className={`text-sm ${isToday ? "text-emerald-400" : isWeekend ? "text-red-400" : "text-gray-500"}`}>
                      {dow}
                    </div>
                    <div className={`text-lg font-semibold ${isToday ? "text-emerald-400" : isWeekend ? "text-red-400" : "text-gray-100"}`}>
                      {dateLabel(dt)}
                    </div>
                  </div>

                  {/* 가운데: 계획 + 실제 레이어 */}
                  <div className="flex-1 relative">
                    {finalized ? (
                      /* 확정일: 실제 타임라인만 */
                      <ReadonlyTimeline day={actualMerged!} />
                    ) : (
                      /* 미확정: 계획(base) + 실제(overlay) */
                      <>
                        <div className={hasActual ? "opacity-30" : ""}>
                          <EditableTimeline
                            day={planMerged}
                            onChange={(ci, co) => updatePlanByMin(dt, ci, co)}
                            onClear={() => clearPlan(dt)}
                          />
                        </div>
                        {actualMerged && (
                          <div className="absolute inset-0 pointer-events-none">
                            <ReadonlyTimeline day={actualMerged} />
                          </div>
                        )}
                      </>
                    )}
                  </div>

                  {/* 오른쪽: 근무시간 */}
                  <div className="w-14 shrink-0 text-right text-sm font-mono text-gray-300">
                    {fmtDuration(rec)}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-8 text-center">
          <button
            onClick={() => { if (confirm("계획 전부 지울까요?")) { writePlans({}); setPlansState({}); } }}
            className="text-xs text-gray-400 hover:text-red-500"
          >
            계획 전체 리셋
          </button>
        </div>

        <div className="mt-6 flex gap-4 justify-center text-[10px] text-gray-400">
          <span className="flex items-center gap-1"><span className="w-3 h-3 bg-amber-300 rounded-sm" />실제</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 bg-sky-200 rounded-sm" />계획</span>
          <span className="flex items-center gap-1"><span className="w-[2px] h-3 bg-red-500" />현재</span>
        </div>
      </div>
    </div>
  );
}
