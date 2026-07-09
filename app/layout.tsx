import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Job Scanner",
  description: "Daily job scan, tailored resumes, one dashboard per person."
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
