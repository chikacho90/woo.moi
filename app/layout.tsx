import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "woo.moi",
  description: "Woo Kyung Min",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
