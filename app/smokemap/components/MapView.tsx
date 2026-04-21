"use client";

import { useEffect, useRef, useState } from "react";
import Script from "next/script";
import { MOCK_SPOTS } from "../mock-data";
import type { Spot } from "../types";
import { STATUS_COLOR, STATUS_LABEL } from "../types";
import SpotSheet from "./SpotSheet";

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    kakao: any;
  }
}

const KAKAO_KEY = process.env.NEXT_PUBLIC_KAKAO_MAP_KEY;

export default function MapView() {
  const mapRef = useRef<HTMLDivElement>(null);
  const [sdkReady, setSdkReady] = useState(false);
  const [selected, setSelected] = useState<Spot | null>(null);

  useEffect(() => {
    if (!sdkReady || !mapRef.current || !window.kakao) return;

    window.kakao.maps.load(() => {
      const map = new window.kakao.maps.Map(mapRef.current, {
        center: new window.kakao.maps.LatLng(37.5665, 126.978),
        level: 5,
      });

      for (const spot of MOCK_SPOTS) {
        const position = new window.kakao.maps.LatLng(spot.lat, spot.lng);
        const color = STATUS_COLOR[spot.status];
        const content = `
          <div style="
            width: 20px; height: 20px;
            border-radius: 50%;
            background: ${color};
            border: 2px solid white;
            box-shadow: 0 2px 6px rgba(0,0,0,0.25);
            cursor: pointer;
          "></div>
        `;
        const overlay = new window.kakao.maps.CustomOverlay({
          position,
          content,
          yAnchor: 0.5,
          xAnchor: 0.5,
          clickable: true,
        });
        overlay.setMap(map);

        const marker = new window.kakao.maps.Marker({
          position,
          map,
          opacity: 0,
          clickable: true,
        });
        window.kakao.maps.event.addListener(marker, "click", () => setSelected(spot));
      }
    });
  }, [sdkReady]);

  if (!KAKAO_KEY) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 text-center bg-gray-50 dark:bg-neutral-950">
        <div className="max-w-md space-y-3">
          <h1 className="text-2xl font-bold">🚬 smokemap</h1>
          <p className="text-sm text-gray-500">흡연자 × 주민이 함께 만드는 흡구맵</p>
          <div className="mt-4 p-4 rounded-lg bg-yellow-50 dark:bg-yellow-950/30 text-sm text-left">
            <p className="font-semibold mb-2">⚙️ 설정 필요</p>
            <p>카카오맵 JavaScript 키가 필요해요.</p>
            <code className="block mt-2 p-2 bg-white dark:bg-neutral-900 rounded text-xs">
              NEXT_PUBLIC_KAKAO_MAP_KEY=...
            </code>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <Script
        src={`//dapi.kakao.com/v2/maps/sdk.js?appkey=${KAKAO_KEY}&autoload=false&libraries=services,clusterer`}
        strategy="afterInteractive"
        onLoad={() => setSdkReady(true)}
      />
      <div className="relative w-screen h-screen">
        <div ref={mapRef} className="w-full h-full" />

        {/* 상단 라벨 */}
        <div className="absolute top-4 left-4 right-4 z-10 flex items-center gap-2 pointer-events-none">
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

        {/* 우하단 플러스 버튼 (신규 등록) */}
        <button
          className="absolute bottom-6 right-6 z-10 w-14 h-14 rounded-full bg-emerald-500 text-white text-3xl shadow-lg hover:bg-emerald-600 active:scale-95 transition"
          onClick={() => alert("등록 기능은 아직 스캐폴드 단계예요. 곧 만들어요!")}
          aria-label="흡연구역 등록"
        >
          +
        </button>

        {selected && <SpotSheet spot={selected} onClose={() => setSelected(null)} />}
      </div>
    </>
  );
}
