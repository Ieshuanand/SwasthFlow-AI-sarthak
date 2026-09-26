"use client";

import { useEffect, useRef } from "react";

import type { VantaEffect } from "../types/vanta";

export function PageTopologyBackground() {
  const vantaRef = useRef<HTMLDivElement>(null);
  const effectRef = useRef<VantaEffect | null>(null);

  useEffect(() => {
    let isMounted = true;
    let pollInterval: ReturnType<typeof setInterval> | null = null;

    const loadScript = (src: string): Promise<void> => {
      return new Promise((resolve, reject) => {
        const existing = document.querySelector(`script[src="${src}"]`) as HTMLScriptElement | null;
        if (existing) {
          if (existing.getAttribute("data-loaded") === "true" || (window as unknown as { p5?: unknown }).p5) {
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

    const startTopology = (): boolean => {
      if (!isMounted || !vantaRef.current) return false;
      if (window.VANTA && typeof window.VANTA.TOPOLOGY === "function") {
        try {
          if (effectRef.current && typeof effectRef.current.destroy === "function") {
            effectRef.current.destroy();
          }
          effectRef.current = window.VANTA.TOPOLOGY({
            el: vantaRef.current,
            mouseControls: true,
            touchControls: true,
            gyroControls: false,
            minHeight: 200.0,
            minWidth: 200.0,
            scale: 1.0,
            scaleMobile: 1.0,
          });
          return true;
        } catch (err) {
          console.error("Vanta TOPOLOGY init error:", err);
          return false;
        }
      }
      return false;
    };

    const init = async () => {
      if (startTopology()) return;

      try {
        if (!window.p5) {
          await loadScript("https://cdnjs.cloudflare.com/ajax/libs/p5.js/1.1.9/p5.min.js");
        }
        if (!window.VANTA || !window.VANTA.TOPOLOGY) {
          await loadScript("https://cdn.jsdelivr.net/npm/vanta@latest/dist/vanta.topology.min.js");
        }

        if (startTopology()) return;

        let attempts = 0;
        pollInterval = setInterval(() => {
          attempts++;
          if (startTopology() || attempts > 30) {
            if (pollInterval) clearInterval(pollInterval);
          }
        }, 100);
      } catch (err) {
        console.warn("Failed to load Vanta Topology scripts:", err);
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
          // ignore cleanup errors
        }
        effectRef.current = null;
      }
    };
  }, []);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        width: "100vw",
        height: "100vh",
        zIndex: 0,
        pointerEvents: "none",
        overflow: "hidden",
      }}
      aria-hidden="true"
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
    </div>
  );
}
