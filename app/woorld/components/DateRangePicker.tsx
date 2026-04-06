"use client";
import { useState, useMemo } from "react";
import type { TripDay } from "../types";
import { DAY_COLORS } from "../types";

interface Props {
  open: boolean;
  onClose: () => void;
  onConfirm: (days: TripDay[]) => void;
  existingDays?: TripDay[];
}

function fmt(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function isSame(a: Date, b: Date): boolean {
  return fmt(a) === fmt(b);
}

function isBetween(d: Date, start: Date, end: Date): boolean {
  const t = d.getTime();
  return t >= start.getTime() && t <= end.getTime();
}

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

export default function DateRangePicker({ open, onClose, onConfirm, existingDays = [] }: Props) {
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [start, setStart] = useState<Date | null>(null);
  const [end, setEnd] = useState<Date | null>(null);
  const [hovering, setHovering] = useState<Date | null>(null);

  // Pre-fill from existing days
  const hasExisting = existingDays.length > 0 && existingDays[0].date;
  useState(() => {
    if (hasExisting) {
      const dates = existingDays
        .filter((d) => d.date)
        .map((d) => new Date(d.date!))
        .sort((a, b) => a.getTime() - b.getTime());
      if (dates.length > 0) {
        setStart(dates[0]);
        setEnd(dates[dates.length - 1]);
        setViewYear(dates[0].getFullYear());
        setViewMonth(dates[0].getMonth());
      }
    }
  });

  const calendarDays = useMemo(() => {
    const first = new Date(viewYear, viewMonth, 1);
    const startDay = first.getDay(); // 0=Sun
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

    const cells: (Date | null)[] = [];
    for (let i = 0; i < startDay; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push(new Date(viewYear, viewMonth, d));
    }
    return cells;
  }, [viewYear, viewMonth]);

  const handleClick = (d: Date) => {
    if (!start || (start && end)) {
      setStart(d);
      setEnd(null);
    } else {
      if (d.getTime() < start.getTime()) {
        setEnd(start);
        setStart(d);
      } else {
        setEnd(d);
      }
    }
  };

  const previewEnd = end ?? hovering;
  const rangeStart = start && previewEnd && previewEnd.getTime() < start.getTime() ? previewEnd : start;
  const rangeEnd = start && previewEnd && previewEnd.getTime() < start.getTime() ? start : previewEnd;

  const dayCount = start && rangeEnd
    ? Math.round((rangeEnd.getTime() - start.getTime()) / 86400000) + 1
    : 0;

  const prevMonth = () => {
    if (viewMonth === 0) { setViewYear(viewYear - 1); setViewMonth(11); }
    else setViewMonth(viewMonth - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewYear(viewYear + 1); setViewMonth(0); }
    else setViewMonth(viewMonth + 1);
  };

  const handleConfirm = () => {
    if (!start) return;
    const endDate = end ?? start;
    const count = Math.round((endDate.getTime() - start.getTime()) / 86400000) + 1;

    // Build a map of existing days by date for reuse
    const existingByDate = new Map<string, TripDay>();
    existingDays.forEach((d) => { if (d.date) existingByDate.set(d.date, d); });

    const days: TripDay[] = [];
    for (let i = 0; i < count; i++) {
      const date = addDays(start, i);
      const dateStr = fmt(date);
      const existing = existingByDate.get(dateStr);
      if (existing) {
        days.push({ ...existing, index: i });
      } else {
        days.push({
          id: crypto.randomUUID(),
          index: i,
          date: dateStr,
          label: `Day ${i + 1}`,
          area: "any",
          color: DAY_COLORS[i % DAY_COLORS.length],
        });
      }
    }
    onConfirm(days);
    onClose();
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center animate-fadeIn"
      style={{ background: "rgba(0,0,0,0.6)" }}
      onClick={onClose}
    >
      <div
        className="rounded-2xl p-5 w-full max-w-sm mx-4 animate-modalIn"
        style={{ background: "#16161e", border: "1px solid rgba(255,255,255,0.08)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Month nav */}
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={prevMonth}
            className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors hover:bg-white/[0.06]"
            style={{ color: "rgba(255,255,255,0.5)" }}
          >
            ‹
          </button>
          <span className="text-sm font-semibold" style={{ color: "#fff" }}>
            {viewYear}년 {viewMonth + 1}월
          </span>
          <button
            onClick={nextMonth}
            className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors hover:bg-white/[0.06]"
            style={{ color: "rgba(255,255,255,0.5)" }}
          >
            ›
          </button>
        </div>

        {/* Weekday headers */}
        <div className="grid grid-cols-7 mb-1">
          {WEEKDAYS.map((w, i) => (
            <div
              key={w}
              className="text-center text-[10px] py-1"
              style={{ color: i === 0 ? "rgba(239,68,68,0.5)" : i === 6 ? "rgba(96,165,250,0.5)" : "rgba(255,255,255,0.3)" }}
            >
              {w}
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="grid grid-cols-7 gap-0.5">
          {calendarDays.map((d, i) => {
            if (!d) return <div key={`e-${i}`} />;

            const isStart = start && isSame(d, start);
            const isEnd = rangeEnd && isSame(d, rangeEnd);
            const inRange = rangeStart && rangeEnd && isBetween(d, rangeStart, rangeEnd);
            const isToday = isSame(d, today);
            const dayOfWeek = d.getDay();

            let bg = "transparent";
            let textColor = "rgba(255,255,255,0.7)";
            let fontWeight = 400;
            let borderRadius = "6px";

            if (isStart || isEnd) {
              bg = "#6366f1";
              textColor = "#fff";
              fontWeight = 700;
              borderRadius = isStart && isEnd ? "6px" : isStart ? "6px 0 0 6px" : "0 6px 6px 0";
            } else if (inRange) {
              bg = "rgba(99,102,241,0.15)";
              textColor = "#a5b4fc";
              borderRadius = "0";
            }

            if (dayOfWeek === 0) textColor = isStart || isEnd ? "#fff" : inRange ? "#fca5a5" : "rgba(239,68,68,0.7)";
            if (dayOfWeek === 6) textColor = isStart || isEnd ? "#fff" : inRange ? "#93c5fd" : "rgba(96,165,250,0.7)";

            return (
              <button
                key={fmt(d)}
                onClick={() => handleClick(d)}
                onMouseEnter={() => { if (start && !end) setHovering(d); }}
                onMouseLeave={() => setHovering(null)}
                className="h-9 flex items-center justify-center text-xs transition-colors relative"
                style={{ background: bg, color: textColor, fontWeight, borderRadius }}
              >
                {d.getDate()}
                {isToday && !isStart && !isEnd && (
                  <span
                    className="absolute bottom-0.5 w-1 h-1 rounded-full"
                    style={{ background: "#6366f1" }}
                  />
                )}
              </button>
            );
          })}
        </div>

        {/* Selection info */}
        <div className="mt-4 text-center text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>
          {!start && "여행 시작일을 선택하세요"}
          {start && !end && !hovering && "종료일을 선택하세요"}
          {start && (end || hovering) && (
            <span style={{ color: "#a5b4fc" }}>
              {fmt(rangeStart!)} → {fmt(rangeEnd!)} ({dayCount}일)
            </span>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-2 mt-4">
          <button
            onClick={onClose}
            className="flex-1 py-2 rounded-lg text-sm"
            style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.5)" }}
          >
            취소
          </button>
          <button
            onClick={handleConfirm}
            disabled={!start}
            className="flex-1 py-2 rounded-lg text-sm font-medium transition-colors"
            style={{
              background: start ? "#fff" : "rgba(255,255,255,0.1)",
              color: start ? "#0a0a12" : "rgba(255,255,255,0.3)",
            }}
          >
            {start && end ? `${dayCount}일 설정` : start ? "1일 설정" : "설정"}
          </button>
        </div>
      </div>
    </div>
  );
}
