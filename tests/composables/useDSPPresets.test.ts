import { flushPromises, mount } from "@vue/test-utils";
import { defineComponent, nextTick } from "vue";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DSPConfigPreset } from "@/plugins/api/interfaces";

const apiMock = vi.hoisted(() => ({
  eventCallback: undefined as
    | ((event: { data: DSPConfigPreset[] }) => void)
    | undefined,
  getDSPPresets: vi.fn(),
  subscribe: vi.fn(),
  unsubscribe: vi.fn(),
}));

vi.mock("@/plugins/api", () => ({
  default: apiMock,
  api: apiMock,
}));

import { useDSPPresets } from "@/composables/useDSPPresets";

const RegistryHarness = defineComponent({
  props: {
    optional: Boolean,
  },
  setup(props) {
    return useDSPPresets({ optional: props.optional });
  },
  template: `
    <div data-testid="presets">{{ presets.map((preset) => preset.name).join(",") }}</div>
    <div data-testid="resolved">{{ getPresetName("preset-1") ?? "Custom" }}</div>
  `,
});

beforeEach(() => {
  vi.clearAllMocks();
  apiMock.eventCallback = undefined;
  apiMock.getDSPPresets.mockResolvedValue([makePreset("Original")]);
  apiMock.subscribe.mockImplementation(
    (
      _event: string,
      callback: (event: { data: DSPConfigPreset[] }) => void,
    ) => {
      apiMock.eventCallback = callback;
      return apiMock.unsubscribe;
    },
  );
});

describe("useDSPPresets", () => {
  it("loads presets and replaces the registry on rename and delete events", async () => {
    const wrapper = mount(RegistryHarness);
    await flushPromises();

    expect(apiMock.getDSPPresets).toHaveBeenCalledWith(false);
    expect(wrapper.get('[data-testid="resolved"]').text()).toBe("Original");

    emitPresetUpdate([makePreset("Renamed")]);
    await nextTick();
    expect(wrapper.get('[data-testid="resolved"]').text()).toBe("Renamed");

    emitPresetUpdate([]);
    await nextTick();
    expect(wrapper.get('[data-testid="resolved"]').text()).toBe("Custom");
    expect(wrapper.get('[data-testid="presets"]').text()).toBe("");

    wrapper.unmount();
    expect(apiMock.unsubscribe).toHaveBeenCalledOnce();
  });

  it("keeps the optional registry unavailable without exposing IDs", async () => {
    apiMock.getDSPPresets.mockRejectedValue(new Error("Forbidden"));
    const wrapper = mount(RegistryHarness, {
      props: { optional: true },
    });
    await flushPromises();

    expect(apiMock.getDSPPresets).toHaveBeenCalledWith(true);
    expect(wrapper.get('[data-testid="resolved"]').text()).toBe("Custom");
    expect(wrapper.get('[data-testid="presets"]').text()).toBe("");
  });

  it("keeps a newer event when an older fetch resolves later", async () => {
    let resolveFetch!: (presets: DSPConfigPreset[]) => void;
    apiMock.getDSPPresets.mockReturnValueOnce(
      new Promise<DSPConfigPreset[]>((resolve) => {
        resolveFetch = resolve;
      }),
    );
    const wrapper = mount(RegistryHarness);
    await nextTick();

    emitPresetUpdate([makePreset("Event name")]);
    resolveFetch([makePreset("Stale fetch name")]);
    await flushPromises();

    expect(wrapper.get('[data-testid="resolved"]').text()).toBe("Event name");
  });
});

function emitPresetUpdate(presets: DSPConfigPreset[]): void {
  if (!apiMock.eventCallback) {
    throw new Error("Preset event callback was not registered");
  }
  apiMock.eventCallback({ data: presets });
}

function makePreset(name: string): DSPConfigPreset {
  return {
    preset_id: "preset-1",
    name,
    config: {
      enabled: true,
      filters: [],
      input_gain: 0,
      output_gain: 0,
      preset_id: null,
    },
  };
}
