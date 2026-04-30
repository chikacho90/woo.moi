import { NextResponse } from "next/server";

const FLEX_BASE = "https://flex.team/api/v3/time-tracking/users";

export const dynamic = "force-dynamic";

function getWeekRange(weekOf?: string): { from: string; to: string; weekFrom: string; weekTo: string } {
  let kst: Date;
  if (weekOf) {
    kst = new Date(weekOf + "T12:00:00+09:00");
  } else {
    const now = new Date();
    const kstMs = now.getTime() + 9 * 3600_000 + now.getTimezoneOffset() * 60_000;
    kst = new Date(kstMs);
  }
  const day = kst.getUTCDay(); // 0=Sun
  const diffToMon = day === 0 ? -6 : 1 - day;

  const monday = new Date(kst);
  monday.setUTCDate(kst.getUTCDate() + diffToMon);
  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);
  // flex.team 쿼리는 토~일 (여유 범위)
  const satBefore = new Date(monday);
  satBefore.setUTCDate(monday.getUTCDate() - 1);

  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  return { from: fmt(satBefore), to: fmt(sunday), weekFrom: fmt(monday), weekTo: fmt(sunday) };
}

function fmtOngoing(): string { return fmtCurrentHM(); }
function fmtCurrentHM(): string { const n = new Date(); const h = n.getUTCHours() + 9; const m = n.getUTCMinutes(); return `${String(h >= 24 ? h - 24 : h).padStart(2, "0")}:${String(m).padStart(2, "0")}`; }
function tsToHM(ts: number): string {
  const d = new Date(ts);
  const h = d.getUTCHours() + 9; // KST
  const m = d.getUTCMinutes();
  const hh = h >= 24 ? h - 24 : h;
  return `${String(hh).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

type FlexTimeBlock = {
  type: string;
  value: {
    startTimestamp?: { timestamp: number } | null;
    endTimestampExclusive?: { timestamp: number } | null;
    usedMinutes?: number;
    workFormId?: string;
    allDay?: boolean;
    timeOffRegisterUnit?: string;
  };
};

type FlexDaySchedule = {
  date: string;
  dayOffs: { type: string }[];
  timeBlocks: FlexTimeBlock[];
};

type FlexDateAttr = {
  date: string;
  usualWorkingMinutes: number;
  dayOffs: { type: string }[];
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const weekOf = searchParams.get("weekOf") || undefined;

  const flexAid = process.env.FLEX_AID;
  const flexUserId = process.env.FLEX_USER_ID;
  if (!flexAid || !flexUserId) {
    return NextResponse.json({ error: "flex credentials not configured" }, { status: 500 });
  }

  const { from, to, weekFrom, weekTo } = getWeekRange(weekOf);
  const params = `from=${from}&to=${to}&timezone=Asia%2FSeoul`;
  const headers: Record<string, string> = {
    accept: "application/json",
    cookie: `AID=${flexAid}`,
    "x-flex-aid": flexAid,
  };

  const CLOCK_BASE = "https://flex.team/api/v2/time-tracking/work-clock/users";

  const [schedRes, attrRes, clockRes] = await Promise.all([
    fetch(`${FLEX_BASE}/${flexUserId}/work-schedules?${params}`, { headers, cache: "no-store" }),
    fetch(`${FLEX_BASE}/${flexUserId}/work-schedules/date-attributes?${params}`, { headers, cache: "no-store" }),
    fetch(`${CLOCK_BASE}/${flexUserId}/current-status`, { headers, cache: "no-store" }),
  ]);

  if (!schedRes.ok || !attrRes.ok) {
    return NextResponse.json(
      { error: "flex API error", schedStatus: schedRes.status, attrStatus: attrRes.status },
      { status: 502 },
    );
  }

  const schedData = await schedRes.json();
  const attrData = await attrRes.json();

  // 진행 중 출근 데이터
  let ongoingClockIn: {
    date: string; startTs: number; formId: string;
    restRanges: { startTs: number; endTs: number }[];
  } | null = null;
  if (clockRes.ok) {
    try {
      const clockData = await clockRes.json();
      const pack = clockData?.onGoingRecordPack;
      if (pack?.onGoing && pack?.startRecord?.targetTime) {
        const rests: { startTs: number; endTs: number }[] = [];
        for (const r of pack.restRecords || []) {
          const rs = r.restStartRecord?.targetTime;
          const re = r.restStopRecord?.targetTime;
          if (rs && re) rests.push({ startTs: rs, endTs: re });
        }
        ongoingClockIn = {
          date: clockData.targetDate,
          startTs: pack.startRecord.targetTime,
          formId: pack.startRecord.customerWorkFormId || "409273",
          restRanges: rests,
        };
      }
    } catch {}
  }

  const schedByDate = new Map<string, FlexDaySchedule>(
    (schedData.dailySchedules as FlexDaySchedule[]).map((s) => [s.date, s]),
  );
  const attrByDate = new Map<string, FlexDateAttr>(
    (attrData.workingDayAttributes as FlexDateAttr[]).map((a) => [a.date, a]),
  );

  let requiredMin = 0;
  let actualMin = 0;
  let totalTimeOff = 0;

  const days = [];
  const start = new Date(weekFrom + "T00:00:00+09:00");
  const end = new Date(weekTo + "T00:00:00+09:00");

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const date = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
    const sched = schedByDate.get(date);
    const attr = attrByDate.get(date);

    // 공휴일/근로자의날 등은 dayOffs(attr 또는 sched)에 항목 있음 — 필수시간 0 처리
    const dayOffsAll = [
      ...(attr?.dayOffs || []),
      ...(sched?.dayOffs || []),
    ];
    const isHoliday = dayOffsAll.length > 0;
    requiredMin += isHoliday ? 0 : (attr?.usualWorkingMinutes || 0);
    const holidayName = dayOffsAll.find((o) => (o as { name?: string }).name)?.name as string | undefined;

    const workBlocks = sched?.timeBlocks?.filter((b) => b.type === "WORK") || [];
    const restBlocks = sched?.timeBlocks?.filter((b) => b.type === "REST") || [];
    const timeOffBlocks = sched?.timeBlocks?.filter((b) => b.type.includes("TIME_OFF")) || [];

    let clockIn: string | null = null;
    let clockOut: string | null = null;
    let grossMin = 0;
    let restMin = 0;
    let dayTimeOff = 0;
    let hasActual = false;
    let ongoing = false;

    // 진행 중 출근 데이터 주입 (work-schedules에 없는 경우)
    const isOngoingDay = ongoingClockIn && ongoingClockIn.date === date && workBlocks.length === 0;
    const ongoingRestRanges: { start: string; end: string }[] = [];
    if (isOngoingDay) {
      hasActual = true;
      ongoing = true;
      clockIn = tsToHM(ongoingClockIn!.startTs);
      grossMin = Math.round((Date.now() - ongoingClockIn!.startTs) / 60_000);
      // 휴게시간 처리
      for (const r of ongoingClockIn!.restRanges) {
        const now = Date.now();
        if (r.startTs < now) {
          const effectiveEnd = Math.min(r.endTs, now);
          restMin += Math.round((effectiveEnd - r.startTs) / 60_000);
          ongoingRestRanges.push({ start: tsToHM(r.startTs), end: tsToHM(effectiveEnd) });
        }
      }
    }

    const workRanges: { start: string; end: string; remote: boolean }[] = [];
    if (isOngoingDay) {
      workRanges.push({
        start: tsToHM(ongoingClockIn!.startTs),
        end: tsToHM(Date.now()),
        remote: ongoingClockIn!.formId !== "409273",
      });
    } else if (workBlocks.length > 0) {
      hasActual = true;
      // 전체 출퇴근 시간: 첫 블록의 시작 ~ 마지막 블록의 끝
      const firstTs = workBlocks[0].value.startTimestamp!.timestamp;
      clockIn = tsToHM(firstTs);

      const lastBlock = workBlocks[workBlocks.length - 1];
      const lastEndTs = lastBlock.value.endTimestampExclusive?.timestamp;
      if (lastEndTs) {
        clockOut = tsToHM(lastEndTs);
        grossMin = Math.round((lastEndTs - firstTs) / 60_000);
      } else {
        ongoing = true;
        grossMin = Math.round((Date.now() - firstTs) / 60_000);
      }

      // 개별 근무 블록 (외근 구분)
      for (const wb of workBlocks) {
        const s = wb.value.startTimestamp!.timestamp;
        const e = wb.value.endTimestampExclusive?.timestamp;
        const isRemote = wb.value.workFormId !== "409273";
        workRanges.push({
          start: tsToHM(s),
          end: e ? tsToHM(e) : fmtOngoing(),
          remote: isRemote,
        });
      }
    }

    const restRanges: { start: string; end: string }[] = [...ongoingRestRanges];
    for (const rb of restBlocks) {
      const rs = rb.value.startTimestamp!.timestamp;
      const re = rb.value.endTimestampExclusive?.timestamp;
      if (re) {
        restMin += Math.round((re - rs) / 60_000);
        restRanges.push({ start: tsToHM(rs), end: tsToHM(re) });
      }
    }

    const workMin = Math.max(0, grossMin - restMin);

    const timeOffRanges: { start: string; end: string }[] = [];
    for (const tb of timeOffBlocks) {
      dayTimeOff += tb.value.usedMinutes || 0;
      const ts = tb.value.startTimestamp?.timestamp;
      const te = tb.value.endTimestampExclusive?.timestamp;
      if (ts && te) {
        timeOffRanges.push({ start: tsToHM(ts), end: tsToHM(te) });
      } else if (tb.value.allDay || tb.value.timeOffRegisterUnit === "DAY") {
        // Flex는 사내행사/전일 휴가 같은 allDay 블록은 타임스탬프 없이 내려줌 → 기본 근무시간대(10:30~19:30)로 시각화
        timeOffRanges.push({ start: "10:30", end: "19:30" });
      }
    }
    if (dayTimeOff > 0) hasActual = true;

    if (hasActual) actualMin += workMin;
    totalTimeOff += dayTimeOff;

    // 일별 인정 근무시간: min(근무 + 휴가, 540=9h)
    const recognizedMin = Math.min(workMin + dayTimeOff, 540);

    days.push({
      date,
      weeklyHoliday: isHoliday,
      clockIn,
      clockOut,
      workMin,
      restMin,
      timeOffMin: dayTimeOff,
      recognizedMin,
      hasActual,
      ...(holidayName && { holidayName }),
      ...(ongoing && { ongoing: true }),
      ...(workRanges.length > 0 && { workRanges }),
      ...(restRanges.length > 0 && { restRanges }),
      ...(timeOffRanges.length > 0 && { timeOffRanges }),
    });
  }

  const doneMin = days.reduce((sum, d) => sum + d.recognizedMin, 0);

  return NextResponse.json({
    updatedAt: new Date().toISOString(),
    weekFrom,
    weekTo,
    requiredMin,
    doneMin,
    actualMin,
    timeOffMin: totalTimeOff,
    days,
  });
}
