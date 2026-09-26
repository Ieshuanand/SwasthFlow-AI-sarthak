declare module "vanta/dist/vanta.cells.min" {
  export interface VantaConfig {
    el: HTMLElement | null;
    THREE: unknown;
    mouseControls?: boolean;
    touchControls?: boolean;
    gyroControls?: boolean;
    minHeight?: number;
    minWidth?: number;
    scale?: number;
    color1?: number;
    color2?: number;
    size?: number;
    speed?: number;
    [key: string]: unknown;
  }

  export interface VantaEffect {
    destroy: () => void;
  }

  export default function CELLS(config: VantaConfig): VantaEffect;
}
