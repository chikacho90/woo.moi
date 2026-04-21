"use client";

import { useEffect, useRef, useState } from "react";
import "leaflet/dist/leaflet.css";
import { MOCK_SPOTS } from "../mock-data";
import type { Spot } from "../types";
import { STATUS_COLOR, STATUS_LABEL } from "../types";
import SpotSheet from "./SpotSheet";

export default function MapView() {
  const mapRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const leafletMapRef = useRef<any>(null);
  const [selected, setSelected] = useState<Spot | null>(null);

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

      for (const spot of MOCK_SPOTS) {
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

    return () => {
      cancelled = true;
      if (leafletMapRef.current) {
        leafletMapRef.current.remove();
        leafletMapRef.current = null;
      }
    };
  }, []);

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

      <button
        className="absolute bottom-6 right-6 z-[500] w-14 h-14 rounded-full bg-emerald-500 text-white text-3xl shadow-lg hover:bg-emerald-600 active:scale-95 transition"
        onClick={() =>
          alert("등록 기능은 아직 스캐폴드 단계예요. 곧 만들어요!")
        }
        aria-label="흡연구역 등록"
      >
        +
      </button>

      {selected && <SpotSheet spot={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
