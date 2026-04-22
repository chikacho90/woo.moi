"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MOCK_SPOTS } from "../mock-data";
import type { Spot } from "../types";
import { STATUS_COLOR, STATUS_LABEL } from "../types";
import { NONSMOKE_ZONES, CATEGORY_COLOR } from "../nonsmoke-data";
import SpotSheet from "./SpotSheet";
import AddSpotSheet from "./AddSpotSheet";

type AddMode = "choose" | "picking" | "form" | null;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare global { interface Window { naver?: any } }

const NAVER_SCRIPT_ID = "naver-map-sdk";
function loadNaverSdk(clientId: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined") return reject(new Error("no window"));
    if (window.naver?.maps) return resolve();
    const existing = document.getElementById(NAVER_SCRIPT_ID) as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("naver sdk load failed")));
      return;
    }
    const s = document.createElement("script");
    s.id = NAVER_SCRIPT_ID;
    s.src = `https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=${clientId}`;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("naver sdk load failed"));
    document.head.appendChild(s);
  });
}

export default function MapView() {
  const mapRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapInstanceRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pickMarkerRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const userMarkerRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const spotMarkersRef = useRef<any[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const nonSmokeOverlaysRef = useRef<any[]>([]);

  const [selected, setSelected] = useState<Spot | null>(null);
  const [spots, setSpots] = useState<Spot[]>([]);
  const [addMode, setAddMode] = useState<AddMode>(null);
  const [pending, setPending] = useState<{ lat: number; lng: number } | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [showNonSmoke, setShowNonSmoke] = useState(true);

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
    const clientId = process.env.NEXT_PUBLIC_NAVER_MAP_CLIENT_ID;
    if (!clientId) {
      console.error("NEXT_PUBLIC_NAVER_MAP_CLIENT_ID missing");
      return;
    }
    let cancelled = false;

    (async () => {
      try {
        await loadNaverSdk(clientId);
      } catch (e) {
        console.error(e);
        return;
      }
      if (cancelled || !mapRef.current || mapInstanceRef.current) return;
      const naver = window.naver;

      const map = new naver.maps.Map(mapRef.current, {
        center: new naver.maps.LatLng(37.5665, 126.978),
        zoom: 12,
        zoomControl: false,
      });
      mapInstanceRef.current = map;
      setMapReady(true);

      // 지도 클릭 → add 모드 picking 일 때만 위치 캡처
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      naver.maps.Event.addListener(map, "click", (e: any) => {
        if (addModeRef.current !== "picking") return;
        const coord = e.coord;
        const lat = coord.lat();
        const lng = coord.lng();
        if (pickMarkerRef.current) pickMarkerRef.current.setMap(null);
        pickMarkerRef.current = new naver.maps.Marker({
          position: new naver.maps.LatLng(lat, lng),
          map,
          icon: {
            content: `<div style="width:22px;height:22px;border-radius:50%;background:#10b981;border:3px solid white;box-shadow:0 4px 10px rgba(0,0,0,0.3)"></div>`,
            anchor: new naver.maps.Point(11, 11),
          },
        });
        setPending({ lat, lng });
        setAddMode("form");
      });

      // 현재 위치 센터링 + 유저 마커
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            if (cancelled || !mapInstanceRef.current) return;
            const { latitude: lat, longitude: lng } = pos.coords;
            userMarkerRef.current = new naver.maps.Marker({
              position: new naver.maps.LatLng(lat, lng),
              map,
              clickable: false,
              icon: {
                content: `<div style="position:relative;width:20px;height:20px">
                  <div style="position:absolute;inset:0;border-radius:50%;background:#3b82f6;opacity:0.25;transform:scale(2.2)"></div>
                  <div style="position:absolute;inset:0;border-radius:50%;background:#3b82f6;border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.35)"></div>
                </div>`,
                anchor: new naver.maps.Point(10, 10),
              },
            });
            map.setCenter(new naver.maps.LatLng(lat, lng));
            map.setZoom(16);
          },
          () => {},
          { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 },
        );
      }
    })();

    return () => {
      cancelled = true;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.destroy?.();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // 금연구역 오버레이 (토글에 따라 표시/제거)
  useEffect(() => {
    if (!mapReady || !mapInstanceRef.current) return;
    const naver = window.naver;
    if (!naver) return;
    const map = mapInstanceRef.current;

    for (const o of nonSmokeOverlaysRef.current) o.setMap(null);
    nonSmokeOverlaysRef.current = [];

    if (!showNonSmoke) return;

    for (const z of NONSMOKE_ZONES) {
      const color = CATEGORY_COLOR[z.category];
      const circle = new naver.maps.Circle({
        map,
        center: new naver.maps.LatLng(z.lat, z.lng),
        radius: z.radiusM,
        strokeColor: color,
        strokeOpacity: 0.6,
        strokeWeight: 1,
        fillColor: color,
        fillOpacity: 0.18,
        clickable: false,
      });
      nonSmokeOverlaysRef.current.push(circle);
    }
  }, [showNonSmoke, mapReady]);

  // spots 변경 시 마커 갱신
  useEffect(() => {
    if (!mapReady || !mapInstanceRef.current) return;
    const naver = window.naver;
    if (!naver) return;
    const map = mapInstanceRef.current;

    // 기존 spot 마커 제거
    for (const m of spotMarkersRef.current) m.setMap(null);
    spotMarkersRef.current = [];

    for (const spot of spots) {
      const color = STATUS_COLOR[spot.status];
      const label = STATUS_LABEL[spot.status];
      const marker = new naver.maps.Marker({
        position: new naver.maps.LatLng(spot.lat, spot.lng),
        map,
        title: spot.name || label,
        icon: {
          content: `<div style="
            width: 18px; height: 18px;
            border-radius: 50%;
            background: ${color};
            border: 2px solid white;
            box-shadow: 0 2px 6px rgba(0,0,0,0.35);
          "></div>`,
          anchor: new naver.maps.Point(9, 9),
        },
      });
      naver.maps.Event.addListener(marker, "click", () => setSelected(spot));
      spotMarkersRef.current.push(marker);
    }
  }, [spots, mapReady]);

  function cancelAdd() {
    setAddMode(null);
    setPending(null);
    if (pickMarkerRef.current) {
      pickMarkerRef.current.setMap(null);
      pickMarkerRef.current = null;
    }
  }

  async function useGPS() {
    if (!navigator.geolocation) {
      alert("이 브라우저는 GPS를 지원하지 않아요.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const naver = window.naver;
        const map = mapInstanceRef.current;
        if (!naver || !map) return;
        const { latitude: lat, longitude: lng } = pos.coords;
        if (pickMarkerRef.current) pickMarkerRef.current.setMap(null);
        pickMarkerRef.current = new naver.maps.Marker({
          position: new naver.maps.LatLng(lat, lng),
          map,
          icon: {
            content: `<div style="width:22px;height:22px;border-radius:50%;background:#10b981;border:3px solid white;box-shadow:0 4px 10px rgba(0,0,0,0.3)"></div>`,
            anchor: new naver.maps.Point(11, 11),
          },
        });
        map.setCenter(new naver.maps.LatLng(lat, lng));
        map.setZoom(17);
        setPending({ lat, lng });
        setAddMode("form");
      },
      (err) => alert(`GPS 오류: ${err.message}`),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  return (
    <div className="relative w-screen h-screen overflow-hidden">
      <div
        ref={mapRef}
        className="w-full h-full"
        style={{ minHeight: "100vh", background: "#e7eaf0" }}
      />

      {/* 상단 브랜드 — safe area 고려, 시트 열렸을 땐 숨김 */}
      {!selected && !addMode && (
        <div
          className="absolute left-4 z-[500] pointer-events-none"
          style={{ top: "calc(env(safe-area-inset-top, 0px) + 16px)" }}
        >
          <div className="pointer-events-auto bg-white/95 dark:bg-neutral-900/95 backdrop-blur rounded-full px-4 py-2 shadow-md text-sm font-semibold">
            🚬 smokemap
          </div>
        </div>
      )}

      {addMode === "picking" && (
        <div
          className="absolute left-4 right-4 z-[500] bg-emerald-500 text-white rounded-lg px-4 py-3 shadow-lg flex items-center justify-between gap-3"
          style={{ top: "calc(env(safe-area-inset-top, 0px) + 72px)" }}
        >
          <span className="text-sm font-medium">📍 지도를 탭해서 위치를 선택</span>
          <button
            onClick={cancelAdd}
            className="text-xs bg-white/20 hover:bg-white/30 rounded-full px-3 py-1"
          >
            취소
          </button>
        </div>
      )}

      {!selected && !addMode && (
        <>
          {/* 금연구역 토글 */}
          <button
            onClick={() => setShowNonSmoke((v) => !v)}
            className="absolute right-6 z-[500] px-3 py-2 rounded-full bg-white dark:bg-neutral-900 shadow-lg text-xs font-medium flex items-center gap-1.5 hover:bg-gray-50 dark:hover:bg-neutral-800 transition"
            style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 92px)" }}
          >
            <span>🚭 금연구역</span>
            <span
              className={`inline-block w-8 h-4 rounded-full relative transition ${
                showNonSmoke ? "bg-emerald-500" : "bg-gray-300"
              }`}
            >
              <span
                className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all ${
                  showNonSmoke ? "left-4" : "left-0.5"
                }`}
              />
            </span>
          </button>

          <button
            className="absolute right-6 z-[500] w-14 h-14 rounded-full bg-emerald-500 text-white text-3xl shadow-lg hover:bg-emerald-600 active:scale-95 transition flex items-center justify-center"
            style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 24px)" }}
            onClick={() => setAddMode("choose")}
            aria-label="흡연구역 등록"
          >
            +
          </button>
        </>
      )}

      {addMode === "choose" && (
        <div className="fixed inset-0 z-[9000]" onClick={cancelAdd}>
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

      {addMode === "form" && pending && (
        <AddSpotSheet
          lat={pending.lat}
          lng={pending.lng}
          onClose={cancelAdd}
          onSaved={() => { cancelAdd(); refresh(); }}
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
