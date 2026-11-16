/**
 * The preview owns one engine: it recolours from the synthetic palette through
 * the user's palette settings and releases the engine on unmount.
 */
import PresetPreviewCanvas from "@/components/PresetPreviewCanvas.vue";
import { SYNTHETIC_PALETTE } from "@/helpers/visualizer/syntheticPalette";
import { flushPromises, mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";

const engineMock = vi.hoisted(() => ({
  loadPresetByName: vi.fn(async () => "preset"),
  setPaused: vi.fn(),
  setPaletteColors: vi.fn(),
  setPaletteRamp: vi.fn(),
  destroy: vi.fn(),
}));
const createVisualizerEngine = vi.hoisted(() => vi.fn(async () => engineMock));
vi.mock("@/composables/visualizer/useVisualizerEngine", () => ({
  createVisualizerEngine,
}));

const prefs = vi.hoisted(
  () =>
    ({
      visualizer_palette_colors: true,
      visualizer_palette_ramp: 50,
    }) as Record<string, unknown>,
);
vi.mock("@/composables/userPreferences", () => ({
  useUserPreferences: () => ({
    getPreference: (key: string, fallback: unknown) => ({
      get value() {
        return prefs[key] ?? fallback;
      },
    }),
  }),
}));

vi.mock("@/composables/useThemePreference", () => ({
  isDark: { value: false },
}));

describe("PresetPreviewCanvas", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads the preset instantly and applies the user's palette settings to the synthetic palette", async () => {
    const wrapper = mount(PresetPreviewCanvas, {
      props: { preset: "Some preset" },
    });
    await flushPromises();

    expect(engineMock.loadPresetByName).toHaveBeenCalledWith("Some preset", 0);
    const [ramp, strength] = engineMock.setPaletteRamp.mock.calls.at(-1)!;
    expect(strength).toBe(0.5);
    expect(ramp).toContainEqual(SYNTHETIC_PALETTE.primary);
    expect(engineMock.setPaletteColors.mock.calls.at(-1)![0]).toContainEqual(
      SYNTHETIC_PALETTE.primary,
    );
    wrapper.unmount();
  });

  it("creates the engine once across preset changes", async () => {
    const wrapper = mount(PresetPreviewCanvas, { props: { preset: "A" } });
    await flushPromises();
    await wrapper.setProps({ preset: "B" });
    await flushPromises();

    expect(createVisualizerEngine).toHaveBeenCalledTimes(1);
    expect(engineMock.loadPresetByName).toHaveBeenLastCalledWith("B", 0);
    wrapper.unmount();
  });

  it("pauses without a preset and destroys the engine on unmount", async () => {
    const wrapper = mount(PresetPreviewCanvas, { props: { preset: "A" } });
    await flushPromises();
    await wrapper.setProps({ preset: null });
    expect(engineMock.setPaused).toHaveBeenLastCalledWith(true, false);

    wrapper.unmount();
    expect(engineMock.destroy).toHaveBeenCalledTimes(1);
  });

  it("destroys an engine that finished creating after unmount", async () => {
    let resolveCreate: (engine: typeof engineMock) => void = () => {};
    createVisualizerEngine.mockReturnValueOnce(
      new Promise((resolve) => (resolveCreate = resolve)),
    );
    const wrapper = mount(PresetPreviewCanvas, { props: { preset: "A" } });
    await flushPromises();
    wrapper.unmount();
    resolveCreate(engineMock);
    await flushPromises();

    expect(engineMock.destroy).toHaveBeenCalledTimes(1);
    expect(engineMock.loadPresetByName).not.toHaveBeenCalled();
  });
});
