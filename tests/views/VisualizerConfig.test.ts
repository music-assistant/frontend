import { Slider } from "@/components/ui/slider";
import VisualizerConfig from "@/views/settings/VisualizerConfig.vue";
import { flushPromises, mount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";

const preferences: Record<string, unknown> = {
  visualizer_preset_mode: "fixed",
  visualizer_beat_switch: true,
};

vi.mock("@/composables/userPreferences", async () => {
  const { ref } = await import("vue");
  return {
    useUserPreferences: () => ({
      getPreference: (key: string, fallback: unknown) =>
        ref(key in preferences ? preferences[key] : fallback),
      setPreference: vi.fn(),
    }),
  };
});
vi.mock("@/helpers/expert_mode", () => ({ expertModeSetting: () => true }));
vi.mock("@/helpers/visualizer/presetLibrary", () => ({
  listPresetNames: vi.fn(async () => ["kept"]),
}));
vi.mock("@/plugins/visualizer-relay", () => ({
  visualizerProviderAvailable: () => true,
}));
vi.mock("@/plugins/i18n", () => ({ $t: (key: string) => key }));

describe("VisualizerConfig accessible names", () => {
  it("names every switch, select trigger and slider thumb", async () => {
    const wrapper = mount(VisualizerConfig);
    await flushPromises();

    const controls = wrapper.findAll(
      "button[role='switch'], button[role='combobox']",
    );
    const sliders = wrapper.findAllComponents(Slider);

    expect(controls).toHaveLength(6);
    expect(sliders).toHaveLength(4);
    for (const control of controls) {
      expect(control.attributes("aria-label")).toBeTruthy();
    }
    for (const slider of sliders) {
      expect(slider.props("thumbLabel")).toBeTruthy();
    }
  });
});
