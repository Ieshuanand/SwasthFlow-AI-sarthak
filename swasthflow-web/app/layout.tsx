import type { Metadata } from "next";
import localFont from "next/font/local";
import Script from "next/script";
import "./globals.css";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});
const silkscreen = localFont({
  src: [
    { path: "../fonts/Silkscreen/Silkscreen-Regular.ttf", weight: "400", style: "normal" },
    { path: "../fonts/Silkscreen/Silkscreen-Bold.ttf", weight: "700", style: "normal" },
  ],
  variable: "--font-silkscreen",
});
const dotGothic = localFont({
  src: "../fonts/DotGothic16/DotGothic16-Regular.ttf",
  variable: "--font-dotgothic",
  weight: "400",
  display: "swap",
});

export const metadata: Metadata = {
  title: "SwasthAI — Predictive Hospital Operations & Capacity Platform",
  description: "Predict the need. Prepare the bed. Protect the moment that matters.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <Script
          src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r121/three.min.js"
          strategy="beforeInteractive"
        />
        <Script
          src="https://cdn.jsdelivr.net/npm/vanta@latest/dist/vanta.cells.min.js"
          strategy="beforeInteractive"
        />
        <Script
          src="https://cdnjs.cloudflare.com/ajax/libs/p5.js/1.1.9/p5.min.js"
          strategy="beforeInteractive"
        />
        <Script
          src="https://cdn.jsdelivr.net/npm/vanta@latest/dist/vanta.topology.min.js"
          strategy="beforeInteractive"
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${silkscreen.variable} ${dotGothic.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
