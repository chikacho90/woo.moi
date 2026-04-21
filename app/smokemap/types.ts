export type SpotStatus = "active" | "warning" | "nosmoking";

export type SmokerRating = "comfortable" | "ok" | "inappropriate";
export type ResidentReason = "smoke" | "butts" | "sensitive_area" | "other";

export type Amenities = {
  ashtray?: boolean;
  chair?: boolean;
  roof?: boolean;
  size?: "small" | "medium" | "large";
};

export type Spot = {
  id: number;
  lat: number;
  lng: number;
  address?: string;
  name?: string;
  amenities: Amenities;
  isOfficial: boolean;
  source: "user" | "public_data" | "admin";
  status: SpotStatus;
  smokerScore: number;
  residentScore: number;
  positiveCount: number;
  complaintCount: number;
};

export const SMOKER_RATING_WEIGHT: Record<SmokerRating, number> = {
  comfortable: 2,
  ok: 1,
  inappropriate: -2,
};

export const RESIDENT_REASON_WEIGHT: Record<ResidentReason, number> = {
  smoke: -2,
  butts: -1,
  sensitive_area: -3,
  other: -1,
};

export const STATUS_COLOR: Record<SpotStatus, string> = {
  active: "#22c55e",
  warning: "#eab308",
  nosmoking: "#ef4444",
};

export const STATUS_LABEL: Record<SpotStatus, string> = {
  active: "🟢 흡연 가능",
  warning: "🟡 주의",
  nosmoking: "🔴 비흡연 권장",
};
