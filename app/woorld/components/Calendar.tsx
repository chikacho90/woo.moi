"use client";

import { useState, useMemo } from "react";

interface Props {
  startDate: string | null;
  endDate: string | null;
  onSelect: (start: string, end: string | null) => void;
}

function toDateStr(d: Date): string {
  return d.toISOString().split("T")[0];
}

function parseDate(s: string): Date {
  return new Date(s + "T00:00:00");
}

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

export default function Calendar({ startDate, endDate, onSelect }: Props) {
  const today = useMemo(() => new Date(), []);
  const [viewYear, setViewYear] = useState(() => {
    if (startDate) return parseDate(startDate).getFullYear();
    return today.getFullYear();
  });
  const [viewMonth, setViewMonth] = useState(() => {
    if (startDate) return parseDate(startDate).getMonth();
    return today.getMonth();
  });

  const todayStr = toDateStr(today);

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDayOfWeek = new Date(viewYear, viewMonth, 1).getDay();

  const prevMonth = () => {
    if (viewMonth === 0) {
      setViewYear(viewYear - 1);
      setViewMonth(11);
    } else {
      setViewMonth(viewMonth - 1);
    }
  };

  const nextMonth = () => {
    if (viewMonth === 11) {
      setViewYear(viewYear + 1);
      setViewMonth(0);
    } else {
      setViewMonth(viewMonth + 1);
    }
  };

  const handleDayClick = (day: number) => {
    const dateStr = toDateStr(new Date(viewYear, viewMonth, day));
    if (!startDate || (startDate && endDate)) {
      // Start fresh selection
      onSelect(dateStr, null);
    } else {
      // Have start, set end
      if (dateStr < startDate) {
        onSelect(dateStr, startDate);
      } else if (dateStr === startDate) {
        // Same day = deselect
        onSelect(dateStr, null);
      } else {
        onSelect(startDate, dateStr);
      }
    }
  };

  const isInRange = (day: number): boolean => {
    if (!startDate || !endDate) return false;
    const dateStr = toDateStr(new Date(viewYear, viewMonth, day));
    return dateStr >= startDate && dateStr <= endDate;
  };

  const isStart = (day: number): boolean => {
    if (!startDate) return false;
    return toDateStr(new Date(viewYear, viewMonth, day)) === startDate;
  };

  const isEnd = (day: number): boolean => {
    if (!endDate) return false;
    return toDateStr(new Date(viewYear, viewMonth, day)) === endDate;
  };

  const isToday = (day: number): boolean => {
    return toDateStr(new Date(viewYear, viewMonth, day)) === todayStr;
  };

  const isPast = (day: number): boolean => {
    const dateStr = toDateStr(new Date(viewYear, viewMonth, day));
    return dateStr < todayStr;
  };

  // Calculate nights
  let nightsLabel = "";
  if (startDate && endDate) {
    const s = parseDate(startDate);
    const e = parseDate(endDate);
    const nights = Math.round((e.getTime() - s.getTime()) / 86400000);
    nightsLabel = `${nights}박 ${nights + 1}일`;
  }

  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDayOfWeek; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const monthLabel = `${viewYear}년 ${viewMonth + 1}월`;

  return (
    <div className="w-full max-w-xs mx-auto">
      {/* Month nav */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={prevMonth}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-100 transition-colors"
          aria-label="이전 달"
        >
          &larr;
        </button>
        <span className="text-sm font-semibold text-gray-700">{monthLabel}</span>
        <button
          onClick={nextMonth}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-100 transition-colors"
          aria-label="다음 달"
        >
          &rarr;
        </button>
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 mb-1">
        {WEEKDAYS.map(w => (
          <div key={w} className="text-center text-[10px] font-medium text-gray-400 py-1">
            {w}
          </div>
        ))}
      </div>

      {/* Day cells */}
      <div className="grid grid-cols-7">
        {cells.map((day, i) => {
          if (day === null) {
            return <div key={`empty-${i}`} className="h-9" />;
          }

          const start = isStart(day);
          const end = isEnd(day);
          const range = isInRange(day);
          const td = isToday(day);
          const past = isPast(day);
          const selected = start || end;

          return (
            <div key={day} className="relative h-9 flex items-center justify-center">
              {/* Range background */}
              {range && !selected && (
                <div className="absolute inset-y-0.5 inset-x-0 bg-gray-900/8" />
              )}
              {start && endDate && (
                <div className="absolute inset-y-0.5 left-1/2 right-0 bg-gray-900/8" />
              )}
              {end && (
                <div className="absolute inset-y-0.5 left-0 right-1/2 bg-gray-900/8" />
              )}
              <button
                onClick={() => handleDayClick(day)}
                disabled={past}
                className={`relative z-10 w-8 h-8 rounded-full text-xs font-medium transition-all ${
                  selected
                    ? "bg-gray-900 text-white"
                    : td
                      ? "text-gray-900 font-bold"
                      : past
                        ? "text-gray-200 cursor-default"
                        : "text-gray-600 hover:bg-gray-100 active:scale-90"
                }`}
                aria-label={`${viewMonth + 1}월 ${day}일`}
              >
                {day}
                {td && !selected && (
                  <div className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-gray-900" />
                )}
              </button>
            </div>
          );
        })}
      </div>

      {/* Selection info */}
      {(startDate || nightsLabel) && (
        <div className="mt-3 text-center">
          {startDate && !endDate && (
            <p className="text-xs text-gray-400">돌아오는 날짜를 선택하세요</p>
          )}
          {nightsLabel && (
            <p className="text-sm font-semibold text-gray-700">{nightsLabel}</p>
          )}
        </div>
      )}
    </div>
  );
}
