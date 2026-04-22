"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MOCK_SPOTS } from "../mock-data";
import type { Spot } from "../types";
import { STATUS_COLOR, STATUS_LABEL } from "../types";
import { CATEGORY_COLOR, type NonSmokeCategory } from "../nonsmoke-data";
import SpotSheet from "./SpotSheet";
import AddSpotSheet from "./AddSpotSheet";

type NonSmokeZone = {
  id: number;
  name: string | null;
  category: NonSmokeCategory;
  lat: number;
  lng: number;
  radius_m: number;
  geometry: [number, number][] | null;
};

type AddMode = "choose" | "picking" | "form" | "correcting" | null;

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
  const [nonSmokeZones, setNonSmokeZones] = useState<NonSmokeZone[]>([]);
  const [correctingSpot, setCorrectingSpot] = useState<Spot | null>(null);
  const [correctionBusy, setCorrectionBusy] = useState(false);

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

      // iOS Safari에서 뷰포트 변화(URL바 표시/숨김) 대응 — 맵 크기 재계산
      const refresh = () => {
        try { naver.maps.Event.trigger(map, "resize"); } catch {}
      };
      setTimeout(refresh, 50);
      setTimeout(refresh, 500);
      window.addEventListener("resize", refresh);
      window.addEventListener("orientationchange", refresh);

      // 지도 탭 리스너 제거 — 중앙 핀 드래그 방식으로 전환

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

  // 지도 이동 시 현재 bbox로 금연구역 fetch (debounced)
  // 퍼포먼스 보호: 줌 15 미만이면 조회·렌더 건너뜀 (화면에 너무 많은 폴리곤 쌓이는 것 방지)
  useEffect(() => {
    if (!mapReady || !mapInstanceRef.current) return;
    if (!showNonSmoke) { setNonSmokeZones([]); return; }
    const naver = window.naver;
    if (!naver) return;
    const map = mapInstanceRef.current;

    const MIN_ZOOM = 15;

    let timer: ReturnType<typeof setTimeout> | null = null;
    const fetchZones = async () => {
      try {
        const zoom = map.getZoom();
        if (zoom < MIN_ZOOM) {
          setNonSmokeZones([]);
          return;
        }
        const bounds = map.getBounds();
        const sw = bounds.getSW();
        const ne = bounds.getNE();
        const res = await fetch(
          `/api/smokemap/nonsmoke?sw=${sw.lat()},${sw.lng()}&ne=${ne.lat()},${ne.lng()}`,
          { cache: "no-store" },
        );
        if (!res.ok) return;
        const data = await res.json();
        if (Array.isArray(data.zones)) setNonSmokeZones(data.zones);
      } catch {}
    };
    const schedule = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(fetchZones, 350);
    };
    schedule();
    const listener = naver.maps.Event.addListener(map, "idle", schedule);
    return () => {
      if (timer) clearTimeout(timer);
      naver.maps.Event.removeListener(listener);
    };
  }, [showNonSmoke, mapReady]);

  // 금연구역 오버레이 렌더
  useEffect(() => {
    if (!mapReady || !mapInstanceRef.current) return;
    const naver = window.naver;
    if (!naver) return;
    const map = mapInstanceRef.current;

    for (const o of nonSmokeOverlaysRef.current) o.setMap(null);
    nonSmokeOverlaysRef.current = [];

    if (!showNonSmoke) return;

    for (const z of nonSmokeZones) {
      const color = CATEGORY_COLOR[z.category];
      const hasGeom = Array.isArray(z.geometry) && z.geometry.length >= 2;

      if (hasGeom && z.geometry!.length >= 3) {
        // 건물·공원 등 폴리곤 — 중복 누적으로 진해지지 않게 fill 낮춤
        const paths = z.geometry!.map(([lat, lng]) => new naver.maps.LatLng(lat, lng));
        const polygon = new naver.maps.Polygon({
          map,
          paths: [paths],
          strokeColor: color,
          strokeOpacity: 0.35,
          strokeWeight: 1,
          fillColor: color,
          fillOpacity: 0.12,
          clickable: false,
        });
        nonSmokeOverlaysRef.current.push(polygon);
      } else {
        // 폴백 — 노드(점) 기반 시설
        const circle = new naver.maps.Circle({
          map,
          center: new naver.maps.LatLng(z.lat, z.lng),
          radius: z.radius_m,
          strokeColor: color,
          strokeOpacity: 0.35,
          strokeWeight: 1,
          fillColor: color,
          fillOpacity: 0.1,
          clickable: false,
        });
        nonSmokeOverlaysRef.current.push(circle);
      }
    }
  }, [nonSmokeZones, showNonSmoke, mapReady]);

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

  function confirmCenterLocation() {
    const naver = window.naver;
    const map = mapInstanceRef.current;
    if (!naver || !map) return;
    const center = map.getCenter();
    setPending({ lat: center.lat(), lng: center.lng() });
    setAddMode("form");
  }

  function startCorrection(spot: Spot) {
    const naver = window.naver;
    const map = mapInstanceRef.current;
    if (!naver || !map) return;
    setSelected(null);
    setCorrectingSpot(spot);
    setAddMode("correcting");
    map.setCenter(new naver.maps.LatLng(spot.lat, spot.lng));
    map.setZoom(18);
  }

  async function submitCorrection() {
    if (correctionBusy || !correctingSpot) return;
    const naver = window.naver;
    const map = mapInstanceRef.current;
    if (!naver || !map) return;
    setCorrectionBusy(true);
    try {
      const center = map.getCenter();
      const res = await fetch(`/api/smokemap/spots/${correctingSpot.id}/correct`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lat: center.lat(), lng: center.lng() }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(`실패: ${data.error || res.status}`);
        return;
      }
      const data = await res.json();
      alert(
        data.total_corrections === 1
          ? "위치 수정 제보 완료 — 바로 반영됐어요!"
          : `위치 수정 제보 완료 (총 ${data.total_corrections}명의 제보 중 ${data.used_count}명 평균값으로 보정)`,
      );
      setCorrectingSpot(null);
      setAddMode(null);
      refresh();
    } catch (e) {
      alert(`오류: ${(e as Error).message}`);
    } finally {
      setCorrectionBusy(false);
    }
  }

  function cancelCorrection() {
    setCorrectingSpot(null);
    setAddMode(null);
  }

  function useGPS() {
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
        map.setCenter(new naver.maps.LatLng(lat, lng));
        map.setZoom(17);
      },
      (err) => alert(`GPS 오류: ${err.message}`),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  return (
    <div className="fixed inset-0 overflow-hidden">
      <div
        ref={mapRef}
        style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, width: "100%", height: "100%", background: "#e7eaf0" }}
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
        <>
          {/* 중앙 고정 핀 (당근 스타일) */}
          <div
            className="absolute left-1/2 top-1/2 z-[600] pointer-events-none"
            style={{ transform: "translate(-50%, -100%)" }}
          >
            <svg width="40" height="52" viewBox="0 0 40 52" fill="none">
              <path
                d="M20 0C9 0 0 8.8 0 19.6C0 34 20 52 20 52C20 52 40 34 40 19.6C40 8.8 31 0 20 0Z"
                fill="#10b981"
              />
              <circle cx="20" cy="19" r="7" fill="white" />
            </svg>
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-700 mx-auto -mt-1 opacity-60" />
          </div>

          {/* 상단 안내 배너 */}
          <div
            className="absolute left-4 right-4 z-[700] bg-white dark:bg-neutral-900 rounded-xl px-4 py-3 shadow-lg flex items-center justify-between gap-3"
            style={{ top: "calc(env(safe-area-inset-top, 0px) + 16px)" }}
          >
            <span className="text-sm font-medium">
              📍 지도를 움직여 위치를 맞춰주세요
            </span>
            <button
              onClick={cancelAdd}
              className="text-xs text-gray-500 hover:text-gray-700 shrink-0"
            >
              취소
            </button>
          </div>

          {/* 하단 확정 CTA */}
          <div
            className="absolute left-4 right-4 z-[700]"
            style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 24px)" }}
          >
            <button
              onClick={confirmCenterLocation}
              className="w-full py-3.5 rounded-xl bg-emerald-500 text-white text-sm font-semibold shadow-lg hover:bg-emerald-600 active:scale-[0.99] transition"
            >
              이 위치로 설정
            </button>
          </div>
        </>
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
            <h2 className="text-base font-semibold mb-1">📍 위치 지정 방식</h2>
            <p className="text-xs text-gray-500 mb-4">지도를 움직여 중앙 핀으로 정확한 위치를 맞춰주세요.</p>
            <div className="grid grid-cols-1 gap-2">
              <button
                onClick={() => { setAddMode("picking"); useGPS(); }}
                className="py-3.5 rounded-lg bg-emerald-500 text-white text-sm font-medium hover:bg-emerald-600 transition"
              >
                🧭 GPS 위치에서 시작
              </button>
              <button
                onClick={() => setAddMode("picking")}
                className="py-3.5 rounded-lg bg-gray-100 dark:bg-neutral-800 text-gray-700 dark:text-gray-300 text-sm hover:bg-gray-200 transition"
              >
                🗺️ 현재 보이는 지도에서 시작
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
          onRequestCorrect={startCorrection}
        />
      )}

      {addMode === "correcting" && correctingSpot && (
        <>
          <div
            className="absolute left-1/2 top-1/2 z-[600] pointer-events-none"
            style={{ transform: "translate(-50%, -100%)" }}
          >
            <svg width="40" height="52" viewBox="0 0 40 52" fill="none">
              <path
                d="M20 0C9 0 0 8.8 0 19.6C0 34 20 52 20 52C20 52 40 34 40 19.6C40 8.8 31 0 20 0Z"
                fill="#3b82f6"
              />
              <circle cx="20" cy="19" r="7" fill="white" />
            </svg>
            <div className="w-1.5 h-1.5 rounded-full bg-blue-700 mx-auto -mt-1 opacity-60" />
          </div>

          <div
            className="absolute left-4 right-4 z-[700] bg-white dark:bg-neutral-900 rounded-xl px-4 py-3 shadow-lg"
            style={{ top: "calc(env(safe-area-inset-top, 0px) + 16px)" }}
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium">📍 정확한 위치로 맞춰주세요</p>
                <p className="text-[11px] text-gray-500 mt-0.5">
                  대상: {correctingSpot.name || "등록된 흡연구역"}
                </p>
              </div>
              <button
                onClick={cancelCorrection}
                className="text-xs text-gray-500 hover:text-gray-700 shrink-0"
              >
                취소
              </button>
            </div>
          </div>

          <div
            className="absolute left-4 right-4 z-[700]"
            style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 24px)" }}
          >
            <button
              onClick={submitCorrection}
              disabled={correctionBusy}
              className="w-full py-3.5 rounded-xl bg-blue-500 text-white text-sm font-semibold shadow-lg hover:bg-blue-600 disabled:opacity-50 active:scale-[0.99] transition"
            >
              {correctionBusy ? "처리 중..." : "이 위치로 수정 제보"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
