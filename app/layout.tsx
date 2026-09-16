import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Drought Forecast / Vojvodina",
  description: "Explore Vojvodina rainfall and temperature outlooks from one to 30 days, recent precipitation versus normal, and seven-day weather pressure.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
