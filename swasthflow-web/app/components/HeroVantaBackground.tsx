"use client";

import { useEffect, useRef } from "react";

import type { VantaEffect } from "../types/vanta";

export function HeroVantaBackground() {
  const vantaRef = useRef<HTMLDivElement>(null);
  const effectRef = useRef<VantaEffect | null>(null);

  useEffect(() => {
    let isMounted = true;
    let pollInterval: ReturnType<typeof setInterval> | null = null;

    const loadScript = (src: string): Promise<void> => {
      return new Promise((resolve, reject) => {
        const existing = document.querySelector(`script[src="${src}"]`) as HTMLScriptElement | null;
        if (existing) {
          if (existing.getAttribute("data-loaded") === "true" || window.VANTA) {
            resolve();
            return;
          }
          existing.addEventListener("load", () => resolve());
          existing.addEventListener("error", (e) => reject(e));
          return;
        }

        const script = document.createElement("script");
        script.src = src;
        script.async = true;
        script.setAttribute("data-loaded", "false");
        script.onload = () => {
          script.setAttribute("data-loaded", "true");
          resolve();
        };
        script.onerror = (e) => reject(e);
        document.head.appendChild(script);
      });
    };

    const startVanta = (): boolean => {
      if (!isMounted || !vantaRef.current) return false;
      if (window.VANTA && typeof window.VANTA.CELLS === "function") {
        try {
          if (effectRef.current && typeof effectRef.current.destroy === "function") {
            effectRef.current.destroy();
          }
          effectRef.current = window.VANTA.CELLS({
            el: vantaRef.current,
            mouseControls: true,
            touchControls: true,
            gyroControls: false,
            minHeight: 200.0,
            minWidth: 200.0,
            scale: 1.0,
          });
          return true;
        } catch (err) {
          console.error("Vanta CELLS init error:", err);
          return false;
        }
      }
      return false;
    };

    const init = async () => {
      if (startVanta()) return;

      try {
        if (!window.THREE) {
          await loadScript("https://cdnjs.cloudflare.com/ajax/libs/three.js/r121/three.min.js");
        }
        if (!window.VANTA || !window.VANTA.CELLS) {
          await loadScript("https://cdn.jsdelivr.net/npm/vanta@latest/dist/vanta.cells.min.js");
        }

        if (startVanta()) return;

        let attempts = 0;
        pollInterval = setInterval(() => {
          attempts++;
          if (startVanta() || attempts > 30) {
            if (pollInterval) clearInterval(pollInterval);
          }
        }, 100);
      } catch (err) {
        console.warn("Failed to load Vanta scripts:", err);
      }
    };

    init();

    return () => {
      isMounted = false;
      if (pollInterval) clearInterval(pollInterval);
      if (effectRef.current && typeof effectRef.current.destroy === "function") {
        try {
          effectRef.current.destroy();
        } catch {
          // ignore
        }
        effectRef.current = null;
      }
    };
  }, []);

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 0,
        borderRadius: "inherit",
        overflow: "hidden",
        pointerEvents: "none",
      }}
    >
      <div
        ref={vantaRef}
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
        }}
      />
      {/* Subtle contrast overlay to keep all text razor-sharp over cells animation */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "rgba(15, 23, 42, 0.25)",
          pointerEvents: "none",
        }}
      />
    </div>
  );
}
