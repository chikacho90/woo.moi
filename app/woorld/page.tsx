"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getTrips, deleteTrip, migrateOldPlanner, type Trip } from "./store/trips";

const STYLE_LABELS: Record<string, string> = {
  food: "🍽 맛집",
  activity: "🏄 액티비티",
  relax: "🧘 힐링",
  sightseeing: "📸 관광",
  shopping: "🛍 쇼핑",
  nature: "🌿 자연",
  culture: "🎭 문화체험",
};

const COMPANION_LABELS: Record<string, string> = {
  solo: "혼자",
  couple: "커플",
  friends: "친구",
  family: "가족",
};

function TripCard({ trip, onDelete }: { trip: Trip; onDelete: (id: string) => void }) {
  const router = useRouter();
  const dateLabel = trip.startDate
    ? `${trip.startDate}${trip.endDate ? ` ~ ${trip.endDate}` : ""}`
    : null;
  const nightsLabel = trip.nights ? `${trip.nights}박` : null;

  return (
    <button
      onClick={() => router.push(`/woorld/${trip.id}`)}
      className="w-full text-left p-5 rounded-2xl border border-gray-100 hover:border-gray-200 hover:shadow-sm transition-all group relative"
      style={{ background: "#fff" }}
    >
      <button
        onClick={(e) => {
          e.stopPropagation();
          if (confirm("이 여행을 삭제할까요?")) onDelete(trip.id);
        }}
        className="absolute top-3 right-3 w-7 h-7 rounded-full flex items-center justify-center text-gray-300 hover:text-red-400 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-all text-xs"
      >
        ✕
      </button>
      <div className="flex items-start gap-3">
        <span className="text-2xl">{trip.destination ? "✈️" : "🗺"}</span>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-gray-900 text-base truncate">
            {trip.destination || "어딘가로..."}
          </h3>
          <div className="flex items-center gap-2 mt-1 text-xs text-gray-400">
            {dateLabel && <span>{dateLabel}</span>}
            {nightsLabel && <span>{nightsLabel}</span>}
            {!dateLabel && !nightsLabel && <span>날짜 미정</span>}
            <span>·</span>
            <span>{COMPANION_LABELS[trip.companions] || trip.companions}</span>
          </div>
          {trip.styles.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {trip.styles.map(s => (
                <span key={s} className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-gray-50 text-gray-500">
                  {STYLE_LABELS[s] || s}
                </span>
              ))}
            </div>
          )}
          <div className="flex gap-3 mt-2 text-[10px] text-gray-300">
            {trip.days.length > 0 && <span>📋 {trip.days.length}일</span>}
            {trip.cards.length > 0 && <span>🃏 {trip.cards.length}카드</span>}
            {trip.places.length > 0 && <span>📍 {trip.places.length}장소</span>}
          </div>
        </div>
      </div>
    </button>
  );
}

export default function WoorldLanding() {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loaded, setLoaded] = useState(false);
  const router = useRouter();

  useEffect(() => {
    // Migrate old planner data if exists
    migrateOldPlanner();
    setTrips(getTrips());
    setLoaded(true);
  }, []);

  const handleDelete = (id: string) => {
    deleteTrip(id);
    setTrips(getTrips());
  };

  if (!loaded) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#fafaf8" }}>
        <p className="text-sm text-gray-300 animate-pulse">loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: "#fafaf8", color: "#1a1a1a" }}>
      {/* Header */}
      <div className="max-w-lg mx-auto px-5 pt-12 pb-6">
        <div className="flex items-center gap-2 mb-1">
          <a href="/" className="text-xs text-gray-300 hover:text-gray-500 transition-colors">&larr;</a>
          <h1 className="text-2xl font-bold tracking-tight">woorld</h1>
        </div>
        <p className="text-sm text-gray-400">어디로 떠날까?</p>
      </div>

      {/* Content */}
      <div className="max-w-lg mx-auto px-5 pb-32">
        {trips.length === 0 ? (
          /* Empty state */
          <div className="text-center py-20">
            <span className="text-5xl block mb-4">🌍</span>
            <h2 className="text-lg font-semibold text-gray-700 mb-2">첫 여행을 계획해볼까요?</h2>
            <p className="text-sm text-gray-400 mb-8">목적지, 일정, 예산까지<br/>한 곳에서 관리해보세요</p>
            <button
              onClick={() => router.push("/woorld/new")}
              className="px-6 py-3 rounded-xl text-sm font-semibold bg-gray-900 text-white hover:bg-gray-800 transition-colors"
            >
              + 새 여행 만들기
            </button>
          </div>
        ) : (
          /* Trip list */
          <div className="space-y-3">
            {trips.map(t => (
              <TripCard key={t.id} trip={t} onDelete={handleDelete} />
            ))}
          </div>
        )}
      </div>

      {/* FAB */}
      {trips.length > 0 && (
        <div className="fixed bottom-6 right-6 z-40">
          <button
            onClick={() => router.push("/woorld/new")}
            className="w-14 h-14 rounded-full bg-gray-900 text-white text-2xl flex items-center justify-center shadow-lg hover:bg-gray-800 hover:scale-105 transition-all"
          >
            +
          </button>
        </div>
      )}
    </div>
  );
}
