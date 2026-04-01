/* ─── Trip Store — localStorage CRUD ─── */

import type { Card, TripDay, Placement } from "../types";
import { genId } from "../types";

export type CompanionType = "solo" | "couple" | "friends" | "family";
export type TravelStyle = "food" | "activity" | "relax" | "sightseeing" | "shopping" | "nature" | "culture";

export interface Place {
  id: string;
  name: string;
  category: string;
  note?: string;
  url?: string;
  addedAt: number;
}

export interface Memo {
  id: string;
  content: string;
  updatedAt: number;
}

export interface BudgetItem {
  id: string;
  label: string;
  amount: number;
  currency: string;
  category: string;
  date?: string;
  note?: string;
}

export interface Trip {
  id: string;
  createdAt: number;
  // Onboarding (all optional)
  destination?: string;
  startDate?: string | null;
  endDate?: string | null;
  nights?: number | null;
  companions: CompanionType;
  budget?: { min: number; max: number } | null;
  styles: TravelStyle[];
  // Planner
  days: TripDay[];
  cards: Card[];
  placements: Placement[];
  // Tabs
  places: Place[];
  memos: Memo[];
  budgetItems: BudgetItem[];
}

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
