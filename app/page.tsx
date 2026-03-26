"use client";
import Scene from "@/components/Scene";
import CommandPalette from "@/components/CommandPalette";
import HiddenNav from "@/components/HiddenNav";

const style = {
  label: {
    fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif',
    fontWeight: 300,
  } as React.CSSProperties,
};

export default function Home() {
  return (
    <main className="relative w-screen h-screen overflow-hidden bg-[#06060f]" style={{ position: "fixed", inset: 0, touchAction: "none" }}>
      <Scene />

      {/* Corner marks */}
      <div className="fixed inset-0 z-10 pointer-events-none select-none p-4 sm:p-8 md:p-12 flex flex-col justify-between">
        {/* Top */}
        <div className="flex justify-between items-start">
          <span
            style={{
              ...style.label,
              fontSize: "0.6rem",
              letterSpacing: "0.35em",
              color: "rgba(255,255,255,0.32)",
              textTransform: "lowercase",
            }}
          >
            woo kyung-min
          </span>

          <span
            style={{
              ...style.label,
              fontSize: "0.6rem",
              letterSpacing: "0.25em",
              color: "rgba(255,255,255,0.14)",
            }}
          >
            © 2026
          </span>
        </div>

        {/* Bottom */}
        <div className="flex justify-between items-end">
          <span
            style={{
              ...style.label,
              fontSize: "0.55rem",
              letterSpacing: "0.4em",
              color: "rgba(255,255,255,0.14)",
              textTransform: "uppercase",
            }}
          >
            Seoul
          </span>

          <span
            style={{
              fontFamily: '"Courier New", monospace',
              fontSize: "0.55rem",
              letterSpacing: "0.08em",
              color: "rgba(255,255,255,0.1)",
            }}
          >
            37.5665° N&nbsp;&nbsp;126.9780° E
          </span>
        </div>
      </div>

      {/* Command palette */}
      <CommandPalette />

      {/* Hidden nav — only shows when authed */}
      <HiddenNav />
    </main>
  );
}
