// Minimal typings for the untyped butterchurn UMD packages.

declare module "butterchurn" {
  export interface ButterchurnAudioLevels {
    timeByteArray: Uint8Array;
    timeByteArrayL: Uint8Array;
    timeByteArrayR: Uint8Array;
  }

  export interface ButterchurnVisualizer {
    render(opts?: { audioLevels?: ButterchurnAudioLevels }): void;
    loadPreset(preset: object, blendTimeSec?: number): void;
    setRendererSize(
      width: number,
      height: number,
      opts?: { pixelRatio?: number },
    ): void;
    connectAudio(node: AudioNode): void;
  }

  export interface ButterchurnStatic {
    createVisualizer(
      context: AudioContext,
      canvas: HTMLCanvasElement,
      opts: {
        width: number;
        height: number;
        pixelRatio?: number;
        meshWidth?: number;
        meshHeight?: number;
        textureRatio?: number;
        outputFXAA?: boolean;
      },
    ): ButterchurnVisualizer;
  }

  const butterchurn: ButterchurnStatic & { default?: ButterchurnStatic };
  export default butterchurn;
}

declare module "butterchurn-presets" {
  const pack: {
    getPresets: () => Record<string, object>;
    default?: { getPresets: () => Record<string, object> };
  };
  export default pack;
}

declare module "butterchurn-presets/lib/butterchurnPresetsExtra.min.js" {
  const pack: {
    getPresets: () => Record<string, object>;
    default?: { getPresets: () => Record<string, object> };
  };
  export default pack;
}
