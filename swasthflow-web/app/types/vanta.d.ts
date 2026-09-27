export interface VantaEffect {
  destroy: () => void;
  [key: string]: unknown;
}

export interface VantaCellsOptions {
  el: HTMLElement;
  mouseControls?: boolean;
  touchControls?: boolean;
  gyroControls?: boolean;
  minHeight?: number;
  minWidth?: number;
  scale?: number;
  [key: string]: unknown;
}

export interface VantaTopologyOptions {
  el: HTMLElement;
  mouseControls?: boolean;
  touchControls?: boolean;
  gyroControls?: boolean;
  minHeight?: number;
  minWidth?: number;
  scale?: number;
  scaleMobile?: number;
  [key: string]: unknown;
}

declare global {
  interface Window {
    THREE?: unknown;
    p5?: unknown;
    VANTA?: {
      CELLS?: (options: VantaCellsOptions) => VantaEffect;
      TOPOLOGY?: (options: VantaTopologyOptions) => VantaEffect;
      [key: string]: unknown;
    };
  }
}
