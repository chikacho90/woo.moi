/* ─── Trip Store — localStorage CRUD ─── */

import type { Trip, Card, TripDay } from "../types";
import { genId, DAY_COLORS, calcNights, addDays } from "../types";
import { findDestination } from "../data/destinations";

const STORAGE_KEY = "woorld-trips";

function readAll(): Trip[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as Trip[];
  } catch {}
  return [];
}

function writeAll(trips: Trip[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(trips));
}

export function getTrips(): Trip[] {
  return readAll().sort((a, b) => b.createdAt - a.createdAt);
}

export function getTrip(id: string): Trip | null {
  return readAll().find(t => t.id === id) ?? null;
}

export function createTrip(partial: Partial<Trip> = {}): Trip {
  const trip: Trip = {
    id: genId(),
    createdAt: Date.now(),
    companions: "couple",
    styles: [],
    days: [],
    cards: [],
    placements: [],
    places: [],
    memos: [],
    budgetItems: [],
    ...partial,
  };

  // Auto-generate days from date range
  if (trip.startDate && trip.endDate && trip.days.length === 0) {
    const nights = calcNights(trip.startDate, trip.endDate);
    const totalDays = nights + 1;
    for (let i = 0; i < totalDays; i++) {
      trip.days.push({
        id: genId(),
        index: i,
        date: addDays(trip.startDate, i),
        label: `Day ${i + 1}`,
        area: "any",
        color: DAY_COLORS[i % DAY_COLORS.length],
      });
    }
    trip.nights = nights;
  }

  // Auto-generate cards from destination DB
  if (trip.destinationId && trip.cards.length === 0) {
    trip.cards = generateCardsFromDestination(trip.destinationId, trip.styles);
  }

  const all = readAll();
  all.push(trip);
  writeAll(all);
  return trip;
}

export function updateTrip(id: string, partial: Partial<Trip>): Trip | null {
  const all = readAll();
  const idx = all.findIndex(t => t.id === id);
  if (idx === -1) return null;
  all[idx] = { ...all[idx], ...partial };
  writeAll(all);
  return all[idx];
}

export function deleteTrip(id: string): boolean {
  const all = readAll();
  const filtered = all.filter(t => t.id !== id);
  if (filtered.length === all.length) return false;
  writeAll(filtered);
  return true;
}

// Migrate old single-planner data to a trip
export function migrateOldPlanner(): Trip | null {
  if (typeof window === "undefined") return null;
  const OLD_KEY = "woorld-planner-state";
  try {
    const raw = localStorage.getItem(OLD_KEY);
    if (!raw) return null;
    const old = JSON.parse(raw);
    if (old.days?.length || old.cards?.length) {
      const trip = createTrip({
        destination: "기존 여행",
        days: old.days || [],
        cards: old.cards || [],
        placements: old.placements || [],
      });
      localStorage.removeItem(OLD_KEY);
      return trip;
    }
  } catch {}
  return null;
}

// Migrate old budget format { min, max } → number
export function migrateOldBudgetFormat(): void {
  if (typeof window === "undefined") return;
  try {
    const all = readAll();
    let changed = false;
    for (const trip of all) {
      if (trip.budget && typeof trip.budget === "object" && "min" in (trip.budget as object)) {
        const old = trip.budget as unknown as { min: number; max: number };
        (trip as Trip).budget = old.max || old.min || null;
        changed = true;
      }
    }
    if (changed) writeAll(all);
  } catch {}
}

function generateCardsFromDestination(destinationId: string, styles: string[]): Card[] {
  const dest = findDestination(destinationId);
  if (!dest) return [];

  const cards: Card[] = [];
  const spots = dest.spots;

  // Filter by travel styles if provided, otherwise take all
  let filtered = styles.length > 0
    ? spots.filter(s => styles.includes(s.style))
    : spots;

  // If too few after filtering, add more
  if (filtered.length < 5) {
    const remaining = spots.filter(s => !filtered.includes(s));
    filtered = [...filtered, ...remaining.slice(0, 5 - filtered.length)];
  }

  // Take up to 8 spots
  for (const spot of filtered.slice(0, 8)) {
    cards.push({
      id: genId(),
      emoji: spot.emoji,
      name: spot.name,
      description: spot.description,
      category: spot.category,
      tags: [],
      compatibleSlots: spot.slots,
      compatibleAreas: ["any"],
      estimatedMinutes: spot.estimatedMinutes,
    });
  }

  // Add transport card for international trips
  if (dest.country !== "한국") {
    cards.unshift({
      id: genId(),
      emoji: "✈️",
      name: `${dest.name} 도착`,
      description: "공항 → 숙소 이동",
      category: "transport",
      tags: [],
      compatibleSlots: ["오전", "오후"],
      compatibleAreas: ["any"],
      estimatedMinutes: 60,
    });
  }

  // Add accommodation card
  cards.push({
    id: genId(),
    emoji: "🏨",
    name: "숙소 체크인",
    description: "숙소 도착 및 짐 정리",
    category: "accommodation",
    tags: [],
    compatibleSlots: ["오후", "저녁"],
    compatibleAreas: ["any"],
    estimatedMinutes: 30,
  });

  return cards;
}
