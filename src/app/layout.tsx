import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Northbridge Taste Concierge",
  description:
    "Household agent for Avery & Morgan — Qloo-grounded itineraries across dining, film, music, and travel. Built for the Qloo Agentic Hackathon.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
