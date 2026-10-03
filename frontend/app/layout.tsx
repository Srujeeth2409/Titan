import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Titan — Document Intelligence",
  description:
    "Your knowledge is scattered across a hundred documents. Titan reads them all, finds the answer, and shows you exactly where it came from — every time.",
};

export const viewport: Viewport = {
  themeColor: "#FFFEFB",
  colorScheme: "light",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
