import type { SpotStatus } from "@/app/smokemap/types";
import {
  SMOKER_RATING_WEIGHT,
  RESIDENT_REASON_WEIGHT,
} from "@/app/smokemap/types";

type SmokerCounts = { comfortable: number; ok: number; inappropriate: number };
type ResidentCounts = { smoke: number; butts: number; sensitive_area: number; other: number };

export type SpotScores = {
  smokerScore: number;
  residentScore: number;
  netScore: number;
  positiveCount: number;
  complaintCount: number;
  status: SpotStatus;
};

/**
 * 상태 전환 알고리즘:
 * - 공식 지정(is_official=true)은 절대 🔴 전환 불허
 * - smoker + resident 합산 및 개별 임계치로 판정
 */
export function computeScores(
  smoker: SmokerCounts,
  resident: ResidentCounts,
  isOfficial: boolean,
): SpotScores {
  const smokerScore =
    smoker.comfortable * SMOKER_RATING_WEIGHT.comfortable +
    smoker.ok * SMOKER_RATING_WEIGHT.ok +
    smoker.inappropriate * SMOKER_RATING_WEIGHT.inappropriate;

  const residentScore =
    resident.smoke * RESIDENT_REASON_WEIGHT.smoke +
    resident.butts * RESIDENT_REASON_WEIGHT.butts +
    resident.sensitive_area * RESIDENT_REASON_WEIGHT.sensitive_area +
    resident.other * RESIDENT_REASON_WEIGHT.other;

  const net = smokerScore + residentScore;
  const positiveCount = smoker.comfortable + smoker.ok;
  const complaintCount =
    resident.smoke + resident.butts + resident.sensitive_area + resident.other;

  let status: SpotStatus;
  if (isOfficial) {
    // 공식 지정은 항상 active 유지 (불편 카운트는 표시하되 숨김은 안 함)
    status = "active";
  } else if (net >= 3 && residentScore > -3) {
    status = "active";
  } else if (net <= -3 || residentScore <= -5) {
    status = "nosmoking";
  } else {
    status = "warning";
  }

  return {
    smokerScore,
    residentScore,
    netScore: net,
    positiveCount,
    complaintCount,
    status,
  };
}
