// Minimal typings for the untyped butterchurn UMD packages.

declare module "butterchurn" {
  export interface ButterchurnAudioLevels {
    timeByteArray: Uint8Array;
    timeByteArrayL: Uint8Array;
    timeByteArrayR: Uint8Array;
  }

  export interface ButterchurnVisualizer {
    render(opts?: { audioLevels?: ButterchurnAudioLevels }): void;
    loadPreset(preset: object, blendTimeSec?: number): Promise<void>;
    // present from fork release ma.3; callers optional-call it
    setMaxBlurPasses?(passes: number): void;
    // present from the gpu-pipeline fork builds; null when unsupported
    getGpuTimings?(): Record<string, number> | null;
    // clamp on custom shape instances (gpu-pipeline fork builds)
    setMaxShapeInstances?(maxInstances: number): void;
    // engine-side artwork tint (gpu-pipeline fork builds)
    setTint?(rgb: readonly [number, number, number] | null): void;
    setRendererSize(
      width: number,
      height: number,
      opts?: { pixelRatio?: number },
    ): void;
    connectAudio(node: AudioNode): void;
  }

  export interface ButterchurnStatic {
    // fork builds that blend the artwork tint in their own output pass
    supportsEngineTint?: boolean;
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
