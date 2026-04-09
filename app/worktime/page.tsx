"use client";

import { useEffect, useMemo, useState } from "react";

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
  clockIn?: string; // HH:mm
  clockOut?: string;
  timeOffMin?: number;
  isHoliday?: boolean;
};

type PlanStore = Record<string, PlanDay>; // date → plan

const STORAGE_KEY = "worktime-plans";
const WORK_CAP_MIN = 540; // 하루 인정시간 상한 9h
const DAILY_TARGET_MIN = 480; // 8h
const WEEK_REQUIRED_MIN = 2400; // 40h
const DEFAULT_REST_MIN = 60;

const DOW_KO = ["일", "월", "화", "수", "목", "금", "토"];

function readPlans(): PlanStore {
  if (typeof window === "undefined") return {};
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}"); } catch { return {}; }
}
function writePlans(p: PlanStore) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
}

function parseHM(s: string | null | undefined): number | null {
  if (!s) return null;
  const m = s.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
}
function fmtMin(total: number | null): string {
  if (total == null) return "-";
  const sign = total < 0 ? "-" : "";
  total = Math.abs(total);
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${sign}${h}h ${m}m`;
}

function getDow(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00+09:00");
  return DOW_KO[d.getDay()];
}

type MergedDay = DayRec & { source: "actual" | "plan" | "empty"; plan?: PlanDay };

function mergeDays(actuals: DayRec[], plans: PlanStore): MergedDay[] {
  const byDate: Record<string, DayRec> = {};
  for (const a of actuals) byDate[a.date] = a;
  const dates = new Set<string>([...Object.keys(byDate), ...Object.keys(plans)]);
  const sorted = [...dates].sort();
  return sorted.map((date) => {
    const a = byDate[date];
    const plan = plans[date];
    if (a && a.hasActual) {
      return { ...a, source: "actual", plan };
    }
    // 계획값 기반 합성
    const ci = plan?.clockIn || null;
    const co = plan?.clockOut || null;
    const ciM = parseHM(ci);
    const coM = parseHM(co);
    let workMin = 0;
    let restMin = ciM != null && coM != null ? DEFAULT_REST_MIN : 0;
    if (ciM != null && coM != null) {
      workMin = Math.max(0, coM - ciM - restMin);
    }
    return {
      date,
      weeklyHoliday: a?.weeklyHoliday || false,
      clockIn: ci,
      clockOut: co,
      workMin,
      restMin,
      timeOffMin: plan?.timeOffMin || 0,
      hasActual: false,
      source: plan ? "plan" : "empty",
      plan,
    };
  });
}

function recognizedMin(d: MergedDay): number {
  // 일당 인정시간 = min(workMin, 9h) + timeOff
  return Math.min(d.workMin || 0, WORK_CAP_MIN) + (d.timeOffMin || 0);
}

function getCurrentWeekDates(from: string, to: string): string[] {
  const out: string[] = [];
  const start = new Date(from + "T00:00:00+09:00");
  const end = new Date(to + "T00:00:00+09:00");
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    out.push(new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10));
  }
  return out;
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

  function updatePlan(date: string, patch: Partial<PlanDay>) {
    const next = { ...plans };
    const cur = { ...(next[date] || {}) };
    Object.assign(cur, patch);
    // strip empty
    if (!cur.clockIn && !cur.clockOut && !cur.timeOffMin && !cur.isHoliday) delete next[date];
    else next[date] = cur;
    writePlans(next);
    setPlansState(next);
  }

  const weekDates = useMemo(() => {
    if (!data) return [];
    return getCurrentWeekDates(data.weekFrom, data.weekTo);
  }, [data]);

  const merged = useMemo(() => {
    if (!data) return [];
    const base = mergeDays(data.days, plans);
    // ensure every day in week exists
    const map = new Map(base.map((d) => [d.date, d]));
    for (const dt of weekDates) {
      if (!map.has(dt)) {
        map.set(dt, {
          date: dt,
          clockIn: null,
          clockOut: null,
          workMin: 0,
          restMin: 0,
          timeOffMin: 0,
          hasActual: false,
          source: "empty",
        });
      }
    }
    return [...map.values()].filter((d) => weekDates.includes(d.date)).sort((a, b) => a.date.localeCompare(b.date));
  }, [data, plans, weekDates]);

  const totals = useMemo(() => {
    let recognized = 0;
    let accumulated = 0;
    for (const d of merged) {
      const r = recognizedMin(d);
      recognized += r;
      accumulated += r - DAILY_TARGET_MIN;
    }
    return { recognized, accumulated };
  }, [merged]);

  // 오늘 퇴근 가능 시각
  const todayStr = new Date().toISOString().slice(0, 10);
  const canLeaveInfo = useMemo(() => {
    if (!data) return null;
    const today = merged.find((d) => d.date === todayStr);
    if (!today || !today.clockIn) return null;
    // 나머지 요일들의 recognized + 오늘 timeOff 합
    let others = 0;
    for (const d of merged) {
      if (d.date === todayStr) continue;
      others += recognizedMin(d);
    }
    const needToday = Math.max(0, WEEK_REQUIRED_MIN - others - (today.timeOffMin || 0));
    const workCap = Math.min(needToday, WORK_CAP_MIN);
    const ciM = parseHM(today.clockIn);
    if (ciM == null) return null;
    const rest = today.restMin || DEFAULT_REST_MIN;
    const leaveMin = ciM + workCap + rest;
    const h = Math.floor(leaveMin / 60) % 24;
    const m = leaveMin % 60;
    return {
      canLeave: `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`,
      needToday,
    };
  }, [merged, data, todayStr]);

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-baseline justify-between mb-6">
          <h1 className="text-2xl font-semibold">주간 근무 계산</h1>
          <button onClick={refresh} className="text-sm text-gray-500 hover:text-gray-900">새로고침</button>
        </div>

        {error && <div className="mb-4 p-3 bg-red-50 text-red-600 rounded text-sm">불러오기 실패: {error}</div>}

        {data && (
          <div className="mb-4 text-xs text-gray-500">
            기간 {data.weekFrom} ~ {data.weekTo} · 업데이트 {new Date(data.updatedAt).toLocaleString("ko-KR")}
          </div>
        )}

        <div className="bg-white rounded-2xl overflow-hidden border border-gray-100">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs">
              <tr>
                <th className="px-3 py-2 text-left">요일</th>
                <th className="px-3 py-2 text-left">날짜</th>
                <th className="px-3 py-2 text-left">출근</th>
                <th className="px-3 py-2 text-left">퇴근</th>
                <th className="px-3 py-2 text-left">휴가(분)</th>
                <th className="px-3 py-2 text-left">인정</th>
                <th className="px-3 py-2 text-left">적립</th>
                <th className="px-3 py-2 text-left">상태</th>
              </tr>
            </thead>
            <tbody>
              {merged.map((d) => {
                const rec = recognizedMin(d);
                const acc = rec - DAILY_TARGET_MIN;
                const fixed = d.source === "actual";
                const isHoliday = d.weeklyHoliday;
                return (
                  <tr key={d.date} className={`border-t border-gray-100 ${isHoliday ? "bg-gray-50" : ""} ${d.date === todayStr ? "bg-blue-50/40" : ""}`}>
                    <td className="px-3 py-2 font-medium">{getDow(d.date)}</td>
                    <td className="px-3 py-2 text-gray-500">{d.date.slice(5)}</td>
                    <td className="px-3 py-2">
                      {fixed ? (
                        <span className="font-mono">{d.clockIn || "-"}</span>
                      ) : (
                        <input
                          type="time"
                          className="bg-transparent outline-none border-b border-dashed border-gray-300 w-20"
                          value={d.clockIn || ""}
                          onChange={(e) => updatePlan(d.date, { clockIn: e.target.value })}
                          disabled={isHoliday}
                        />
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {fixed ? (
                        <span className="font-mono">{d.clockOut || (d.ongoing ? "진행중" : "-")}</span>
                      ) : (
                        <input
                          type="time"
                          className="bg-transparent outline-none border-b border-dashed border-gray-300 w-20"
                          value={d.clockOut || ""}
                          onChange={(e) => updatePlan(d.date, { clockOut: e.target.value })}
                          disabled={isHoliday}
                        />
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {fixed ? (
                        <span className="font-mono">{d.timeOffMin || 0}</span>
                      ) : (
                        <input
                          type="number"
                          className="bg-transparent outline-none border-b border-dashed border-gray-300 w-16"
                          value={d.timeOffMin || 0}
                          onChange={(e) => updatePlan(d.date, { timeOffMin: parseInt(e.target.value, 10) || 0 })}
                          disabled={isHoliday}
                        />
                      )}
                    </td>
                    <td className="px-3 py-2 font-mono">{fmtMin(rec)}</td>
                    <td className={`px-3 py-2 font-mono ${acc >= 0 ? "text-emerald-600" : "text-orange-600"}`}>{acc >= 0 ? "+" : ""}{fmtMin(acc)}</td>
                    <td className="px-3 py-2 text-xs text-gray-400">
                      {isHoliday ? "휴일" : fixed ? (d.ongoing ? "🔴 진행중" : "🔒 실제") : d.source === "plan" ? "✏️ 계획" : "-"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-white p-4 rounded-xl border border-gray-100">
            <div className="text-xs text-gray-500">필수</div>
            <div className="text-lg font-semibold">{fmtMin(WEEK_REQUIRED_MIN)}</div>
          </div>
          <div className="bg-white p-4 rounded-xl border border-gray-100">
            <div className="text-xs text-gray-500">채움</div>
            <div className="text-lg font-semibold">{fmtMin(totals.recognized)}</div>
          </div>
          <div className="bg-white p-4 rounded-xl border border-gray-100">
            <div className="text-xs text-gray-500">남음</div>
            <div className="text-lg font-semibold">{fmtMin(Math.max(0, WEEK_REQUIRED_MIN - totals.recognized))}</div>
          </div>
          <div className="bg-white p-4 rounded-xl border border-gray-100">
            <div className="text-xs text-gray-500">주간 적립</div>
            <div className={`text-lg font-semibold ${totals.accumulated >= 0 ? "text-emerald-600" : "text-orange-600"}`}>
              {totals.accumulated >= 0 ? "+" : ""}{fmtMin(totals.accumulated)}
            </div>
          </div>
        </div>

        {canLeaveInfo && (
          <div className="mt-4 p-4 bg-emerald-50 rounded-xl border border-emerald-100 text-sm">
            <div className="text-xs text-emerald-700">오늘 퇴근 가능 시각</div>
            <div className="text-2xl font-bold text-emerald-700 font-mono mt-1">{canLeaveInfo.canLeave}</div>
            <div className="text-xs text-emerald-600 mt-1">남은 필요 {fmtMin(canLeaveInfo.needToday)}</div>
          </div>
        )}

        <div className="mt-6 flex gap-2 text-sm">
          <button
            onClick={() => { if (confirm("계획 전부 지울까요?")) { writePlans({}); setPlansState({}); } }}
            className="text-gray-500 hover:text-red-600"
          >
            계획 리셋
          </button>
        </div>

        {loading && <div className="mt-4 text-xs text-gray-400">동기화 중...</div>}
      </div>
    </div>
  );
}
