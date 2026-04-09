"use client";

import { useEffect, useMemo, useState, useRef } from "react";

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
const DEFAULT_REST_MIN = 60;
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
function fmtDuration(total: number | null): string {
  if (total == null) return "-";
  const sign = total < 0 ? "-" : "";
  total = Math.abs(total);
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${sign}${h}:${String(m).padStart(2, "0")}`;
}
function fmtHM(total: number | null): string {
  if (total == null) return "";
  const h = Math.floor(total / 60) % 24;
  const m = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
function getDow(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00+09:00");
  return DOW_KO[d.getDay()];
}
function dateLabel(dateStr: string): string {
  return `${parseInt(dateStr.slice(8, 10), 10)}`;
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
  let restMin = ciM != null && coM != null ? DEFAULT_REST_MIN : 0;
  if (ciM != null && coM != null) workMin = Math.max(0, coM - ciM - restMin);
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

function weekDates(from: string, to: string): string[] {
  const out: string[] = [];
  const start = new Date(from + "T00:00:00+09:00");
  const end = new Date(to + "T00:00:00+09:00");
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    out.push(new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10));
  }
  return out;
}

// ───── 일 편집 모달 ─────
function DayEditor({ day, onSave, onClose }: { day: MergedDay; onSave: (p: PlanDay) => void; onClose: () => void }) {
  const [ci, setCi] = useState(day.clockIn || "");
  const [co, setCo] = useState(day.clockOut || "");
  const [toff, setToff] = useState(String(day.timeOffMin || 0));

  function save() {
    onSave({
      clockIn: ci || undefined,
      clockOut: co || undefined,
      timeOffMin: parseInt(toff, 10) || 0,
    });
    onClose();
  }
  function clear() {
    onSave({ clockIn: undefined, clockOut: undefined, timeOffMin: 0 });
    onClose();
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-end md:items-center justify-center p-0 md:p-4" onClick={onClose}>
      <div className="bg-white w-full md:max-w-md rounded-t-3xl md:rounded-3xl p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="text-sm text-gray-500 mb-1">{day.date} ({getDow(day.date)})</div>
        <div className="text-lg font-semibold mb-5">계획 수정</div>

        <label className="block text-xs text-gray-500 mb-1">출근 시각</label>
        <input type="time" value={ci} onChange={(e) => setCi(e.target.value)}
          className="w-full text-xl font-mono p-3 mb-4 border border-gray-200 rounded-xl" />

        <label className="block text-xs text-gray-500 mb-1">퇴근 시각</label>
        <input type="time" value={co} onChange={(e) => setCo(e.target.value)}
          className="w-full text-xl font-mono p-3 mb-4 border border-gray-200 rounded-xl" />

        <label className="block text-xs text-gray-500 mb-1">휴가 사용(분)</label>
        <input type="number" value={toff} onChange={(e) => setToff(e.target.value)}
          className="w-full text-xl font-mono p-3 mb-6 border border-gray-200 rounded-xl" />

        <div className="flex gap-2">
          <button onClick={clear} className="flex-1 py-3 rounded-xl text-sm text-gray-500 hover:bg-gray-100">지우기</button>
          <button onClick={onClose} className="flex-1 py-3 rounded-xl text-sm text-gray-700 bg-gray-100 hover:bg-gray-200">취소</button>
          <button onClick={save} className="flex-[2] py-3 rounded-xl text-sm text-white bg-gray-900 hover:bg-black">저장</button>
        </div>
      </div>
    </div>
  );
}

// ───── 타임라인 바 ─────
function TimelineBar({ day }: { day: MergedDay }) {
  const ciM = parseHM(day.clockIn);
  const coM = parseHM(day.clockOut);
  const dayStart = 0;
  const dayEnd = 24 * 60;
  const pct = (m: number) => ((m - dayStart) / (dayEnd - dayStart)) * 100;

  const hasBar = ciM != null && (coM != null || day.ongoing);
  const endM = coM != null ? coM : day.ongoing ? (new Date().getHours() * 60 + new Date().getMinutes()) : null;

  const isToday = day.date === new Date().toISOString().slice(0, 10);
  const nowMin = new Date().getHours() * 60 + new Date().getMinutes();

  return (
    <div className="relative h-9 bg-gray-50 rounded-lg overflow-hidden">
      {/* 시간 마크 — 주요 시점 */}
      {[6, 9, 12, 15, 18, 21].map((h) => (
        <div key={h} className="absolute top-0 bottom-0 border-l border-gray-200/60"
          style={{ left: `${pct(h * 60)}%` }} />
      ))}

      {/* 작업 바 */}
      {hasBar && ciM != null && endM != null && (
        <div className={`absolute top-1 bottom-1 rounded ${day.source === "actual" ? (day.ongoing ? "bg-amber-300/70 animate-pulse" : "bg-amber-300") : "bg-sky-200"}`}
          style={{ left: `${pct(ciM)}%`, width: `${Math.max(0, pct(endM) - pct(ciM))}%` }} />
      )}

      {/* 현재시각 라인 */}
      {isToday && (
        <div className="absolute top-0 bottom-0 w-[2px] bg-red-500 z-10"
          style={{ left: `${pct(nowMin)}%` }} />
      )}

      {/* 출근/퇴근 라벨 */}
      {ciM != null && (
        <div className="absolute text-[10px] font-mono text-gray-600 bottom-0 -translate-x-1/2" style={{ left: `${pct(ciM)}%`, bottom: "-16px" }}>{day.clockIn}</div>
      )}
      {coM != null && (
        <div className="absolute text-[10px] font-mono text-gray-600 bottom-0 -translate-x-1/2" style={{ left: `${pct(coM)}%`, bottom: "-16px" }}>{day.clockOut}</div>
      )}
    </div>
  );
}

export default function WorktimePage() {
  const [data, setData] = useState<WorktimeData | null>(null);
  const [plans, setPlansState] = useState<PlanStore>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingDate, setEditingDate] = useState<string | null>(null);

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

  function updatePlan(date: string, p: PlanDay) {
    const next = { ...plans };
    if (!p.clockIn && !p.clockOut && !p.timeOffMin) delete next[date];
    else next[date] = p;
    writePlans(next);
    setPlansState(next);
  }

  const dates = useMemo(() => data ? weekDates(data.weekFrom, data.weekTo) : [], [data]);

  const merged = useMemo(() => {
    if (!data) return [];
    const byDate = new Map(data.days.map((d) => [d.date, d]));
    return dates.map((dt) => mergeDay(byDate.get(dt), plans[dt], dt));
  }, [data, dates, plans]);

  const totals = useMemo(() => {
    let recognized = 0;
    for (const d of merged) recognized += recognizedMin(d);
    const remaining = Math.max(0, WEEK_REQUIRED_MIN - recognized);
    const accumulated = recognized - DAILY_TARGET_MIN * dates.length;
    return { recognized, remaining, accumulated };
  }, [merged, dates]);

  const todayStr = new Date().toISOString().slice(0, 10);
  const canLeave = useMemo(() => {
    const today = merged.find((d) => d.date === todayStr);
    if (!today || !today.clockIn || today.ongoing !== true && !today.hasActual) return null;
    if (!today.clockIn) return null;
    let others = 0;
    for (const d of merged) if (d.date !== todayStr) others += recognizedMin(d);
    const needToday = Math.max(0, WEEK_REQUIRED_MIN - others - (today.timeOffMin || 0));
    const workCap = Math.min(needToday, WORK_CAP_MIN);
    const ciM = parseHM(today.clockIn);
    if (ciM == null) return null;
    return { timeStr: fmtHM(ciM + workCap + (today.restMin || DEFAULT_REST_MIN)), needToday };
  }, [merged, todayStr]);

  const progressPct = Math.min(100, (totals.recognized / WEEK_REQUIRED_MIN) * 100);
  const editingDay = editingDate ? merged.find((d) => d.date === editingDate) : null;

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-3xl mx-auto p-4 md:p-8">
        {/* 헤더 */}
        <div className="flex items-baseline justify-between mb-1">
          <h1 className="text-2xl font-bold tracking-tight">내 근무</h1>
          <button onClick={refresh} className="text-xs text-gray-400 hover:text-gray-900">
            {loading ? "↻" : "새로고침"}
          </button>
        </div>
        {data && (
          <div className="text-xs text-gray-400 mb-6">
            {data.weekFrom.replaceAll("-", ".")} ~ {data.weekTo.slice(5).replaceAll("-", ".")}
            {" · "}
            {new Date(data.updatedAt).toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })} 업데이트
          </div>
        )}

        {error && (
          <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-xl text-sm">
            불러오기 실패: {error}
            {error === "401" && (
              <div className="mt-1 text-xs">로그인이 필요합니다. <a href="/" className="underline">홈에서 로그인</a></div>
            )}
          </div>
        )}

        {/* 진행률 */}
        {data && (
          <div className="mb-8">
            <div className="flex items-baseline justify-between mb-2">
              <div className="text-3xl font-bold font-mono">{fmtDuration(totals.recognized)}</div>
              <div className="text-sm text-gray-500">/ {fmtDuration(WEEK_REQUIRED_MIN)}</div>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden mb-2">
              <div className="h-full bg-emerald-500 rounded-full transition-all"
                style={{ width: `${progressPct}%` }} />
            </div>
            <div className="flex justify-between text-xs text-gray-400">
              <span>남음 {fmtDuration(totals.remaining)}</span>
              <span className={totals.accumulated >= 0 ? "text-emerald-600" : "text-orange-500"}>
                적립 {totals.accumulated >= 0 ? "+" : ""}{fmtDuration(totals.accumulated)}
              </span>
            </div>
          </div>
        )}

        {/* 오늘 퇴근 가능 */}
        {canLeave && (
          <div className="mb-6 p-4 bg-emerald-50 rounded-2xl border border-emerald-100">
            <div className="text-xs text-emerald-700 mb-1">오늘 퇴근 가능</div>
            <div className="text-3xl font-bold font-mono text-emerald-700">{canLeave.timeStr}</div>
          </div>
        )}

        {/* 날짜별 타임라인 */}
        <div className="space-y-1">
          {merged.map((d) => {
            const rec = recognizedMin(d);
            const isToday = d.date === todayStr;
            const dow = getDow(d.date);
            const isWeekend = dow === "토" || dow === "일";
            const clickable = !d.hasActual && !d.weeklyHoliday;

            return (
              <div
                key={d.date}
                onClick={() => { if (clickable) setEditingDate(d.date); }}
                className={`rounded-2xl px-4 py-3 transition ${isToday ? "bg-emerald-50/40" : "hover:bg-gray-50"} ${clickable ? "cursor-pointer" : ""}`}
              >
                <div className="flex items-center gap-3 mb-2">
                  <div className={`w-8 text-center font-semibold ${isToday ? "text-emerald-600" : isWeekend ? "text-red-400" : "text-gray-900"}`}>
                    {dateLabel(d.date)}
                  </div>
                  <div className={`text-sm ${isToday ? "text-emerald-600 font-semibold" : isWeekend ? "text-red-400" : "text-gray-500"}`}>
                    {dow}
                  </div>
                  <div className="flex-1" />
                  <div className="text-sm font-mono text-gray-700">{fmtDuration(rec)}</div>
                  <div className="text-[10px] text-gray-400 min-w-[3rem] text-right">
                    {d.source === "actual" ? (d.ongoing ? "🔴 진행" : "🔒 실제") : d.source === "plan" ? "✏️ 계획" : d.weeklyHoliday ? "휴일" : "—"}
                  </div>
                </div>
                <div className="pb-5">
                  <TimelineBar day={d} />
                </div>
              </div>
            );
          })}
        </div>

        {/* 리셋 */}
        <div className="mt-8 text-center">
          <button
            onClick={() => { if (confirm("계획 전부 지울까요?")) { writePlans({}); setPlansState({}); } }}
            className="text-xs text-gray-400 hover:text-red-500"
          >
            계획 전체 리셋
          </button>
        </div>

        {/* 범례 */}
        <div className="mt-6 flex gap-4 justify-center text-[10px] text-gray-400">
          <span className="flex items-center gap-1"><span className="w-3 h-3 bg-amber-300 rounded-sm" />실제</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 bg-sky-200 rounded-sm" />계획</span>
          <span className="flex items-center gap-1"><span className="w-[2px] h-3 bg-red-500" />현재</span>
        </div>
      </div>

      {editingDay && (
        <DayEditor
          day={editingDay}
          onSave={(p) => updatePlan(editingDay.date, p)}
          onClose={() => setEditingDate(null)}
        />
      )}
    </div>
  );
}
