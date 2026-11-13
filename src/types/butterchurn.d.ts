// Minimal typings for the untyped butterchurn UMD packages.

declare module "butterchurn" {
  export interface ButterchurnAudioLevels {
    timeByteArray: Uint8Array;
    timeByteArrayL: Uint8Array;
    timeByteArrayR: Uint8Array;
  }

  export interface ButterchurnVisualizer {
    render(opts?: { audioLevels?: ButterchurnAudioLevels }): void;
    // false when the preset failed to compile, a newer load superseded it, or
    // it cannot run without the JS interpreter
    loadPreset(preset: object, blendTimeSec?: number): Promise<boolean>;
    setRendererSize(
      width: number,
      height: number,
      opts?: { pixelRatio?: number },
    ): void;
    connectAudio(node: AudioNode): void;
    // releases the internal OffscreenCanvas' WebGL2 context; the visualizer is
    // unusable afterwards
    loseGLContext(): void;
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
        onlyUseWASM?: boolean;
      },
    ): ButterchurnVisualizer;
  }

  const butterchurn: ButterchurnStatic & { default?: ButterchurnStatic };
  export default butterchurn;
}

declare module "butterchurn-presets" {
  const pack: Record<string, object>;
  export default pack;
}

declare module "butterchurn-presets/dist/extra.min.js" {
  const pack: Record<string, object>;
  export default pack;
}
