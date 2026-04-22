import type { Viewport } from "next";
import MapView from "./components/MapView";

export const metadata = {
  title: "smokemap — 흡연자 × 주민이 함께 만드는 흡구맵",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#0a0a0a",
};

export default function SmokeMapPage() {
  return <MapView />;
}
