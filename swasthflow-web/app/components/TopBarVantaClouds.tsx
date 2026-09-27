"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import CLOUDS from "vanta/dist/vanta.clouds.min";

interface VantaEffect {
  destroy: () => void;
}

export function TopBarVantaClouds() {
  const vantaRef = useRef<HTMLDivElement>(null);
  const effectRef = useRef<VantaEffect | null>(null);

  useEffect(() => {
    if (!vantaRef.current) return;

    try {
      effectRef.current = CLOUDS({
        el: vantaRef.current,
        THREE,
        mouseControls: false, // Disable mouse for topbar
        touchControls: false,
        gyroControls: false,
        minHeight: 80.0,
        minWidth: 200.0,
        backgroundColor: 0x0a1428, // Dark navy
        skyColor: 0x1e3a8a, // Deep blue
        cloudColor: 0x059669, // Emerald tinted clouds (subtle)
        cloudShadowColor: 0x06b6d4, // Cyan shadows
        sunColor: 0xf97316, // Coral sun (subtle, emergency warmth)
        sunGlareColor: 0xfbbf24, // Soft amber glow
        sunlightColor: 0xfcd34d, // Light yellow
        speed: 0.3, // Very slow, ambient
      });
    } catch (err) {
      console.warn("Failed to initialize Vanta CLOUDS effect:", err);
    }

    return () => {
      if (effectRef.current) {
        try {
          effectRef.current.destroy();
        } catch (e) {
          console.warn("Error destroying Vanta CLOUDS instance:", e);
        }
        effectRef.current = null;
      }
    };
  }, []);

  return (
    <div
      ref={vantaRef}
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        zIndex: 0,
        overflow: "hidden",
        pointerEvents: "none",
      }}
    />
  );
}
