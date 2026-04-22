"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import "leaflet/dist/leaflet.css";
import { MOCK_SPOTS } from "../mock-data";
import type { Spot } from "../types";
import { STATUS_COLOR, STATUS_LABEL } from "../types";
import SpotSheet from "./SpotSheet";
import AddSpotSheet from "./AddSpotSheet";

type AddMode = "choose" | "picking" | "form" | null;

export default function MapView() {
  const mapRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const leafletMapRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pickMarkerRef = useRef<any>(null);
  const [selected, setSelected] = useState<Spot | null>(null);
  const [spots, setSpots] = useState<Spot[]>([]);
  const [addMode, setAddMode] = useState<AddMode>(null);
  const [pending, setPending] = useState<{ lat: number; lng: number } | null>(null);

  const addModeRef = useRef<AddMode>(null);
  useEffect(() => { addModeRef.current = addMode; }, [addMode]);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/smokemap/spots", { cache: "no-store" });
      if (!res.ok) throw new Error(`${res.status}`);
      const data = await res.json();
      if (Array.isArray(data.spots) && data.spots.length > 0) {
        setSpots(data.spots);
      } else {
        setSpots(MOCK_SPOTS);
      }
    } catch {
      setSpots(MOCK_SPOTS);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  // 지도 초기화
  useEffect(() => {
    let cancelled = false;

    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !mapRef.current || leafletMapRef.current) return;

      const map = L.map(mapRef.current, { zoomControl: true }).setView(
        [37.5665, 126.978],
        12,
      );
      leafletMapRef.current = map;

      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: "© OpenStreetMap",
      }).addTo(map);

      // 지도 클릭: add 모드 'picking'일 때만 위치 캡처
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      map.on("click", (e: any) => {
        if (addModeRef.current !== "picking") return;
        const { lat, lng } = e.latlng;
        // 임시 마커
        if (pickMarkerRef.current) map.removeLayer(pickMarkerRef.current);
        const pickIcon = L.divIcon({
          className: "smokemap-pick",
          html: `<div style="width:22px;height:22px;border-radius:50%;background:#10b981;border:3px solid white;box-shadow:0 4px 10px rgba(0,0,0,0.3)"></div>`,
          iconSize: [22, 22],
          iconAnchor: [11, 11],
        });
        pickMarkerRef.current = L.marker([lat, lng], { icon: pickIcon }).addTo(map);
        setPending({ lat, lng });
        setAddMode("form");
      });
    })();

    return () => {
      cancelled = true;
      if (leafletMapRef.current) {
        leafletMapRef.current.remove();
        leafletMapRef.current = null;
      }
    };
  }, []);

  // spots 변경 시 마커 갱신
  useEffect(() => {
    if (!leafletMapRef.current || spots.length === 0) return;
    const map = leafletMapRef.current;
    let cancelled = false;

    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled) return;
      // 기존 spot 마커만 제거 (pickMarker 보존)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      map.eachLayer((layer: any) => {
        if (layer instanceof L.Marker && layer !== pickMarkerRef.current) {
          map.removeLayer(layer);
        }
      });
      for (const spot of spots) {
        const color = STATUS_COLOR[spot.status];
        const icon = L.divIcon({
          className: "smokemap-pin",
          html: `<div style="
            width: 18px; height: 18px;
            border-radius: 50%;
            background: ${color};
            border: 2px solid white;
            box-shadow: 0 2px 6px rgba(0,0,0,0.35);
          "></div>`,
          iconSize: [18, 18],
          iconAnchor: [9, 9],
        });
        const marker = L.marker([spot.lat, spot.lng], { icon }).addTo(map);
        marker.on("click", () => setSelected(spot));
      }
    })();
    return () => { cancelled = true; };
  }, [spots]);

  function cancelAdd() {
    setAddMode(null);
    setPending(null);
    if (pickMarkerRef.current && leafletMapRef.current) {
      leafletMapRef.current.removeLayer(pickMarkerRef.current);
      pickMarkerRef.current = null;
    }
  }

  async function useGPS() {
    if (!navigator.geolocation) {
      alert("이 브라우저는 GPS를 지원하지 않아요.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        const L = (await import("leaflet")).default;
        const map = leafletMapRef.current;
        if (map) {
          if (pickMarkerRef.current) map.removeLayer(pickMarkerRef.current);
          const pickIcon = L.divIcon({
            className: "smokemap-pick",
            html: `<div style="width:22px;height:22px;border-radius:50%;background:#10b981;border:3px solid white;box-shadow:0 4px 10px rgba(0,0,0,0.3)"></div>`,
            iconSize: [22, 22],
            iconAnchor: [11, 11],
          });
          pickMarkerRef.current = L.marker([lat, lng], { icon: pickIcon }).addTo(map);
          map.setView([lat, lng], 17);
        }
        setPending({ lat, lng });
        setAddMode("form");
      },
      (err) => {
        alert(`GPS 오류: ${err.message}`);
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  return (
    <div className="relative w-screen h-screen">
      <div ref={mapRef} className="w-full h-full z-0" />

      <div className="absolute top-4 left-4 right-4 z-[500] flex items-center gap-2 pointer-events-none">
        <div className="pointer-events-auto bg-white dark:bg-neutral-900 rounded-full px-4 py-2 shadow-md text-sm font-semibold">
          🚬 smokemap
        </div>
        <div className="flex gap-2 text-[11px] pointer-events-auto">
          {(["active", "warning", "nosmoking"] as const).map((s) => (
            <span
              key={s}
              className="bg-white dark:bg-neutral-900 rounded-full px-2 py-1 shadow-sm"
            >
              {STATUS_LABEL[s]}
            </span>
          ))}
        </div>
      </div>

      {/* 위치 지정 중 배너 */}
      {addMode === "picking" && (
        <div className="absolute top-20 left-4 right-4 z-[500] bg-emerald-500 text-white rounded-lg px-4 py-3 shadow-lg flex items-center justify-between gap-3">
          <span className="text-sm font-medium">📍 지도를 탭해서 위치를 선택</span>
          <button
            onClick={cancelAdd}
            className="text-xs bg-white/20 hover:bg-white/30 rounded-full px-3 py-1"
          >
            취소
          </button>
        </div>
      )}

      {/* 등록 버튼 */}
      <button
        className="absolute bottom-6 right-6 z-[500] w-14 h-14 rounded-full bg-emerald-500 text-white text-3xl shadow-lg hover:bg-emerald-600 active:scale-95 transition"
        onClick={() => setAddMode("choose")}
        aria-label="흡연구역 등록"
      >
        +
      </button>

      {/* 등록 방식 선택 시트 */}
      {addMode === "choose" && (
        <div className="fixed inset-0 z-20" onClick={cancelAdd}>
          <div className="absolute inset-0 bg-black/20" />
          <div
            className="absolute bottom-0 left-0 right-0 bg-white dark:bg-neutral-900 rounded-t-2xl shadow-xl p-5 pb-8"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-base font-semibold mb-4">📍 위치 지정</h2>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => {
                  setAddMode(null);
                  useGPS();
                }}
                className="py-4 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 text-sm hover:bg-emerald-200 transition"
              >
                🧭 현재 GPS 위치
              </button>
              <button
                onClick={() => setAddMode("picking")}
                className="py-4 rounded-lg bg-gray-100 dark:bg-neutral-800 text-gray-700 dark:text-gray-300 text-sm hover:bg-gray-200 transition"
              >
                🗺️ 지도 탭으로 선택
              </button>
            </div>
            <button
              onClick={cancelAdd}
              className="w-full mt-3 py-2 text-xs text-gray-400 hover:text-gray-600"
            >
              취소
            </button>
          </div>
        </div>
      )}

      {/* 등록 폼 */}
      {addMode === "form" && pending && (
        <AddSpotSheet
          lat={pending.lat}
          lng={pending.lng}
          onClose={cancelAdd}
          onSaved={() => {
            cancelAdd();
            refresh();
          }}
        />
      )}

      {selected && (
        <SpotSheet
          spot={selected}
          onClose={() => setSelected(null)}
          onAction={refresh}
        />
      )}
    </div>
  );
}
