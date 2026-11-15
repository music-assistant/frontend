/**
 * Favourites are stored by preset name, so the list can name presets the
 * library no longer carries; the random-favourites entry only makes sense
 * while at least one of them still exists.
 */
import { dropdownMenuStubs } from "../fixtures/dropdownMenu";
import VisualizerMenuControl from "@/layouts/default/PlayerOSD/VisualizerMenuControl.vue";
import { flushPromises, mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";

const preferences = vi.hoisted(() => ({}) as Record<string, unknown>);

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

vi.mock("@/composables/visualizer/useVisualizer", async () => {
  const { ref } = await import("vue");
  return {
    useVisualizer: () => ({
      visualizerEnabledPref: ref(true),
      toggleVisualizer: vi.fn(),
    }),
  };
});

vi.mock("@/helpers/visualizer/presetLibrary", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  listPresetNames: vi.fn(async () => ["kept", "other"]),
}));

vi.mock("@/plugins/store", () => ({ store: { activePlayer: undefined } }));

async function mountMenu() {
  const wrapper = mount(VisualizerMenuControl, {
    global: { stubs: dropdownMenuStubs },
  });
  await flushPromises();
  await wrapper.get(".visualizer-menu__preset-header").trigger("click");
  return wrapper;
}

describe("VisualizerMenuControl random favourites entry", () => {
  beforeEach(() => {
    for (const key of Object.keys(preferences)) delete preferences[key];
  });

  it("is offered while a favourite is still in the library", async () => {
    preferences.visualizer_favorites = ["gone", "kept"];
    const wrapper = await mountMenu();

    expect(wrapper.text()).toContain("Random from favorites");
  });

  it("is hidden once no favourite is left in the library", async () => {
    preferences.visualizer_favorites = ["gone"];
    const wrapper = await mountMenu();

    expect(wrapper.text()).not.toContain("Random from favorites");
  });
});
