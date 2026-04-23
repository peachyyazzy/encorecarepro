import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Encore Care — NEMT",
  description: "Non-emergency medical transportation for patients, families, and facilities.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50 text-slate-900">{children}</body>
    </html>
  );
}
