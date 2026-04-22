import type { Viewport } from "next";
import MapView from "./components/MapView";

export const metadata = {
  title: "smokemap — 흡연자 × 주민이 함께 만드는 흡구맵",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#10b981",
};

export default function SmokeMapPage() {
  return <MapView />;
}
