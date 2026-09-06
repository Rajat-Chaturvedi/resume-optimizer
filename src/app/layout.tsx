import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Resume-to-JD Optimizer",
  description:
    "Upload a resume and a job description to get an ATS gap report, a rewritten FAANG-style resume, and PDF/DOCX exports.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
