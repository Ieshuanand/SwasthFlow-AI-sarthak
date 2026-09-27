import React from "react";

export function LandingPageBackground() {
  return (
    <div
      className="absolute inset-0 pointer-events-none opacity-40 z-0 overflow-hidden"
      style={{
        backgroundImage: `radial-gradient(circle at 20% 20%, rgba(255, 255, 255, 0.25) 0%, transparent 40%), radial-gradient(circle at 80% 80%, rgba(255, 255, 255, 0.15) 0%, transparent 40%)`,
      }}
    />
  );
}
