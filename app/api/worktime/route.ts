import { NextResponse } from "next/server";

const FLEX_BASE = "https://flex.team/api/v3/time-tracking/users";

export const dynamic = "force-dynamic";

function getWeekRange(): { from: string; to: string; weekFrom: string; weekTo: string } {
  const now = new Date();
  const kstMs = now.getTime() + 9 * 3600_000 + now.getTimezoneOffset() * 60_000;
  const kst = new Date(kstMs);
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
    startTimestamp: { timestamp: number };
    endTimestampExclusive?: { timestamp: number } | null;
    usedMinutes?: number;
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

export async function GET() {
  const flexAid = process.env.FLEX_AID;
  const flexUserId = process.env.FLEX_USER_ID;
  if (!flexAid || !flexUserId) {
    return NextResponse.json({ error: "flex credentials not configured" }, { status: 500 });
  }

  const { from, to, weekFrom, weekTo } = getWeekRange();
  const params = `from=${from}&to=${to}&timezone=Asia%2FSeoul`;
  const headers: Record<string, string> = {
    accept: "application/json",
    cookie: `AID=${flexAid}`,
    "x-flex-aid": flexAid,
  };

  const [schedRes, attrRes] = await Promise.all([
    fetch(`${FLEX_BASE}/${flexUserId}/work-schedules?${params}`, { headers, cache: "no-store" }),
    fetch(`${FLEX_BASE}/${flexUserId}/work-schedules/date-attributes?${params}`, { headers, cache: "no-store" }),
  ]);

  if (!schedRes.ok || !attrRes.ok) {
    return NextResponse.json(
      { error: "flex API error", schedStatus: schedRes.status, attrStatus: attrRes.status },
      { status: 502 },
    );
  }

  const schedData = await schedRes.json();
  const attrData = await attrRes.json();

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

    requiredMin += attr?.usualWorkingMinutes || 0;

    const isHoliday =
      sched?.dayOffs?.some((o) => o.type === "WEEKLY_HOLIDAY" || o.type === "REST_DAY") || false;

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

    if (workBlocks.length > 0) {
      hasActual = true;
      const wb = workBlocks[0];
      const ciTs = wb.value.startTimestamp.timestamp;
      clockIn = tsToHM(ciTs);

      const coTs = wb.value.endTimestampExclusive?.timestamp;
      if (coTs) {
        clockOut = tsToHM(coTs);
        grossMin = Math.round((coTs - ciTs) / 60_000);
      } else {
        ongoing = true;
        grossMin = Math.round((Date.now() - ciTs) / 60_000);
      }
    }

    const restRanges: { start: string; end: string }[] = [];
    for (const rb of restBlocks) {
      const rs = rb.value.startTimestamp.timestamp;
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
      }
    }

    if (hasActual) actualMin += workMin;
    totalTimeOff += dayTimeOff;

    days.push({
      date,
      weeklyHoliday: isHoliday,
      clockIn,
      clockOut,
      workMin,
      restMin,
      timeOffMin: dayTimeOff,
      hasActual,
      ...(ongoing && { ongoing: true }),
      ...(restRanges.length > 0 && { restRanges }),
      ...(timeOffRanges.length > 0 && { timeOffRanges }),
    });
  }

  const doneMin = days.reduce((sum, d) => sum + Math.min(d.workMin, 540) + d.timeOffMin, 0);

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
