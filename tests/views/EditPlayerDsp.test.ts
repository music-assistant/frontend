import { flushPromises, shallowMount } from "@vue/test-utils";
import { nextTick, type Ref } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
  DSPConfig,
  DSPConfigPreset,
  ToneControlFilter,
} from "@/plugins/api/interfaces";
import { DSPFilterType, EventType } from "@/plugins/api/interfaces";
import EditPlayerDsp from "@/views/settings/EditPlayerDsp.vue";

const apiMock = vi.hoisted(() => ({
  applyDSPPreset: vi.fn(),
  getDSPConfig: vi.fn(),
  playerDSPCallback: undefined as
    | ((event: { data: DSPConfig }) => void)
    | undefined,
  players: { "player-1": {} },
  removeDSPPreset: vi.fn(),
  saveDSPConfig: vi.fn(),
  saveDSPPreset: vi.fn(),
  subscribe: vi.fn(),
  unsubscribe: vi.fn(),
}));
const registryMock = vi.hoisted(() => ({
  presets: undefined as Ref<DSPConfigPreset[]> | undefined,
}));

vi.mock("@/plugins/api", () => ({
  api: apiMock,
  default: apiMock,
}));
vi.mock("@/composables/useDSPPresets", async () => {
  const { ref } = await import("vue");
  registryMock.presets = ref<DSPConfigPreset[]>([]);
  return {
    useDSPPresets: () => ({
      getPresetName: (presetId: string | null | undefined) =>
        getPresets().value.find((preset) => preset.preset_id === presetId)
          ?.name,
      presets: getPresets(),
    }),
  };
});
vi.mock("@/helpers/utils", () => ({
  getPlayerName: () => "Test player",
}));
vi.mock("vue-i18n", async (importOriginal) => {
  const actual = await importOriginal<typeof import("vue-i18n")>();
  return {
    ...actual,
    useI18n: () => ({
      t: translate,
    }),
  };
});
vi.mock("vuetify", async () => {
  const { ref } = await import("vue");
  return {
    useDisplay: () => ({ mobile: ref(false) }),
    useTheme: () => ({
      global: { current: ref({ dark: false }) },
    }),
  };
});

const SwitchStub = {
  name: "VSwitch",
  props: ["modelValue"],
  emits: ["update:modelValue"],
  template:
    '<button class="dsp-switch" @click="$emit(\'update:modelValue\', !modelValue)" />',
};
const PipelineStub = {
  name: "DSPPipeline",
  emits: ["onSelect"],
  template: '<button class="select-filter" @click="$emit(\'onSelect\', 0)" />',
};
const ToneControlStub = {
  name: "DSPToneControl",
  props: ["modelValue"],
  emits: ["update:modelValue"],
  template:
    '<button class="nested-edit" @click="$emit(\'update:modelValue\', { ...modelValue, bass_level: 9 })" />',
};

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  apiMock.playerDSPCallback = undefined;
  apiMock.getDSPConfig.mockResolvedValue(makeConfig());
  apiMock.applyDSPPreset.mockResolvedValue(
    makeConfig({ preset_id: "preset-1" }),
  );
  apiMock.saveDSPConfig.mockResolvedValue(makeConfig());
  apiMock.saveDSPPreset.mockResolvedValue(makePreset());
  apiMock.removeDSPPreset.mockResolvedValue(undefined);
  apiMock.subscribe.mockImplementation(
    (event: EventType, callback: (event: { data: DSPConfig }) => void) => {
      if (event === EventType.PLAYER_DSP_CONFIG_UPDATED) {
        apiMock.playerDSPCallback = callback;
      }
      return apiMock.unsubscribe;
    },
  );
  getPresets().value = [makePreset()];
});

afterEach(() => {
  vi.useRealTimers();
});

describe("EditPlayerDsp preset identity", () => {
  it("applies a preset without echo-saving or sharing the cached config", async () => {
    const cachedPreset = getPresets().value[0];
    const wrapper = await mountEditor();

    await wrapper.get(".preset-item").trigger("click");
    await flushPromises();

    expect(apiMock.applyDSPPreset).toHaveBeenCalledWith("player-1", "preset-1");
    expect(selectedPresetLabel(wrapper)).toBe("Living room");
    await vi.advanceTimersByTimeAsync(2100);
    expect(apiMock.saveDSPConfig).not.toHaveBeenCalled();

    await wrapper.get(".select-filter").trigger("click");
    await nextTick();
    await wrapper.get(".nested-edit").trigger("click");
    await nextTick();

    expect(selectedPresetLabel(wrapper)).toBe("Load DSP Preset");
    expect(getToneControl(cachedPreset.config).bass_level).toBe(1);
    await vi.advanceTimersByTimeAsync(2100);
    expect(apiMock.saveDSPConfig).toHaveBeenCalledWith(
      "player-1",
      expect.objectContaining({
        preset_id: null,
        filters: [
          expect.objectContaining({
            bass_level: 9,
          }),
        ],
      }),
    );
  });

  it("clears preset identity immediately on a top-level manual edit", async () => {
    apiMock.getDSPConfig.mockResolvedValue(
      makeConfig({ preset_id: "preset-1" }),
    );
    const wrapper = await mountEditor();

    expect(selectedPresetLabel(wrapper)).toBe("Living room");
    await wrapper.get(".dsp-switch").trigger("click");
    await nextTick();

    expect(selectedPresetLabel(wrapper)).toBe("Load DSP Preset");
    await vi.advanceTimersByTimeAsync(2100);
    expect(apiMock.saveDSPConfig).toHaveBeenCalledWith(
      "player-1",
      expect.objectContaining({
        enabled: false,
        preset_id: null,
      }),
    );
  });

  it("retains server-provided identity without echo-saving", async () => {
    const wrapper = await mountEditor();
    apiMock.saveDSPConfig.mockClear();

    emitPlayerDSPUpdate(makeConfig({ preset_id: "preset-1" }));
    await nextTick();
    await vi.advanceTimersByTimeAsync(2100);

    expect(selectedPresetLabel(wrapper)).toBe("Living room");
    expect(apiMock.saveDSPConfig).not.toHaveBeenCalled();
  });

  it("discards a stale apply response and event after a manual edit", async () => {
    let resolveApply!: (config: DSPConfig) => void;
    apiMock.applyDSPPreset.mockReturnValueOnce(
      new Promise<DSPConfig>((resolve) => {
        resolveApply = resolve;
      }),
    );
    const wrapper = await mountEditor();

    await wrapper.get(".preset-item").trigger("click");
    await wrapper.get(".dsp-switch").trigger("click");
    await nextTick();
    emitPlayerDSPUpdate(makeConfig({ preset_id: "preset-1" }));
    resolveApply(makeConfig({ preset_id: "preset-1" }));
    await flushPromises();

    expect(selectedPresetLabel(wrapper)).toBe("Load DSP Preset");
    await vi.advanceTimersByTimeAsync(2100);
    expect(apiMock.saveDSPConfig).toHaveBeenCalledWith(
      "player-1",
      expect.objectContaining({
        enabled: false,
        preset_id: null,
      }),
    );
  });

  it("flushes a debounced save to its captured player before switching", async () => {
    const wrapper = await mountEditor();
    await wrapper.get(".dsp-switch").trigger("click");
    await nextTick();

    apiMock.getDSPConfig.mockResolvedValueOnce(makeConfig());
    await wrapper.setProps({ playerId: "player-2" });
    await flushPromises();
    await vi.advanceTimersByTimeAsync(2100);

    expect(apiMock.saveDSPConfig).toHaveBeenCalledWith(
      "player-1",
      expect.objectContaining({
        enabled: false,
        preset_id: null,
      }),
    );
    expect(apiMock.saveDSPConfig).not.toHaveBeenCalledWith(
      "player-2",
      expect.anything(),
    );
  });

  it("ignores an older save event while a newer edit is pending", async () => {
    let resolveFirstSave!: (config: DSPConfig) => void;
    apiMock.saveDSPConfig
      .mockReturnValueOnce(
        new Promise<DSPConfig>((resolve) => {
          resolveFirstSave = resolve;
        }),
      )
      .mockResolvedValueOnce(makeConfig());
    const wrapper = await mountEditor();

    await wrapper.get(".dsp-switch").trigger("click");
    await nextTick();
    await vi.advanceTimersByTimeAsync(2100);
    const firstSavedConfig = apiMock.saveDSPConfig.mock.calls[0][1];

    await wrapper.get(".dsp-switch").trigger("click");
    await nextTick();
    emitPlayerDSPUpdate(firstSavedConfig);
    await nextTick();

    expect(wrapper.getComponent(SwitchStub).props("modelValue")).toBe(true);
    await vi.advanceTimersByTimeAsync(2100);
    expect(apiMock.saveDSPConfig).toHaveBeenLastCalledWith(
      "player-1",
      expect.objectContaining({
        enabled: true,
        preset_id: null,
      }),
    );

    resolveFirstSave(firstSavedConfig);
    await flushPromises();
  });

  it("cancels a nearly due manual save before applying a preset", async () => {
    const wrapper = await mountEditor();
    await wrapper.get(".dsp-switch").trigger("click");
    await nextTick();
    await vi.advanceTimersByTimeAsync(1900);

    await wrapper.get(".preset-item").trigger("click");
    await flushPromises();
    await vi.advanceTimersByTimeAsync(2200);

    expect(apiMock.applyDSPPreset).toHaveBeenCalledWith("player-1", "preset-1");
    expect(apiMock.saveDSPConfig).not.toHaveBeenCalled();
    expect(selectedPresetLabel(wrapper)).toBe("Living room");
  });

  it("restores a canceled manual save when preset application fails", async () => {
    apiMock.applyDSPPreset.mockRejectedValueOnce(new Error("Apply failed"));
    const wrapper = await mountEditor();
    await wrapper.get(".dsp-switch").trigger("click");
    await nextTick();
    await vi.advanceTimersByTimeAsync(1900);

    await wrapper.get(".preset-item").trigger("click");
    await flushPromises();
    await vi.advanceTimersByTimeAsync(2100);

    expect(apiMock.saveDSPConfig).toHaveBeenCalledWith(
      "player-1",
      expect.objectContaining({
        enabled: false,
        preset_id: null,
      }),
    );
  });

  it("carries manual-save recovery across overlapping preset attempts", async () => {
    let resolveFirstApply!: (config: DSPConfig) => void;
    getPresets().value = [makePreset(), makePreset("preset-2", "Bedroom")];
    apiMock.applyDSPPreset
      .mockReturnValueOnce(
        new Promise<DSPConfig>((resolve) => {
          resolveFirstApply = resolve;
        }),
      )
      .mockRejectedValueOnce(new Error("Second apply failed"));
    const wrapper = await mountEditor();
    await wrapper.get(".dsp-switch").trigger("click");
    await nextTick();
    await vi.advanceTimersByTimeAsync(1900);

    const presetItems = wrapper.findAll(".preset-item");
    await presetItems[0].trigger("click");
    await presetItems[1].trigger("click");
    await flushPromises();
    emitPlayerDSPUpdate(makeConfig({ preset_id: "preset-1" }));
    await vi.advanceTimersByTimeAsync(2100);

    expect(apiMock.saveDSPConfig).toHaveBeenCalledWith(
      "player-1",
      expect.objectContaining({
        enabled: false,
        preset_id: null,
      }),
    );

    resolveFirstApply(makeConfig({ preset_id: "preset-1" }));
    await flushPromises();
  });

  it("reloads authoritative state after the latest overlapping apply fails", async () => {
    let resolveFirstApply!: (config: DSPConfig) => void;
    getPresets().value = [makePreset(), makePreset("preset-2", "Bedroom")];
    apiMock.applyDSPPreset
      .mockReturnValueOnce(
        new Promise<DSPConfig>((resolve) => {
          resolveFirstApply = resolve;
        }),
      )
      .mockRejectedValueOnce(new Error("Second apply failed"));
    const wrapper = await mountEditor();
    apiMock.getDSPConfig.mockResolvedValueOnce(
      makeConfig({ preset_id: "preset-1" }),
    );

    const presetItems = wrapper.findAll(".preset-item");
    await presetItems[0].trigger("click");
    await presetItems[1].trigger("click");
    await flushPromises();

    expect(selectedPresetLabel(wrapper)).toBe("Living room");

    resolveFirstApply(makeConfig({ preset_id: "preset-1" }));
    await flushPromises();
    emitPlayerDSPUpdate(makeConfig({ preset_id: "preset-2" }));
    await nextTick();
    expect(selectedPresetLabel(wrapper)).toBe("Bedroom");
  });

  it("hides the previous config while a new player config loads", async () => {
    let resolvePlayerConfig!: (config: DSPConfig) => void;
    apiMock.getDSPConfig
      .mockReset()
      .mockResolvedValueOnce(makeConfig())
      .mockReturnValueOnce(
        new Promise<DSPConfig>((resolve) => {
          resolvePlayerConfig = resolve;
        }),
      );
    const wrapper = await mountEditor();

    await wrapper.setProps({ playerId: "player-2" });
    await nextTick();

    expect(wrapper.find("section").exists()).toBe(false);
    expect(wrapper.find(".dsp-switch").exists()).toBe(false);

    resolvePlayerConfig(makeConfig({ preset_id: "preset-1" }));
    await flushPromises();
    expect(wrapper.find("section").exists()).toBe(true);
    expect(apiMock.saveDSPConfig).not.toHaveBeenCalled();
  });

  it("keeps a newer server event over a stale player config response", async () => {
    let resolvePlayerConfig!: (config: DSPConfig) => void;
    apiMock.getDSPConfig
      .mockReset()
      .mockResolvedValueOnce(makeConfig())
      .mockReturnValueOnce(
        new Promise<DSPConfig>((resolve) => {
          resolvePlayerConfig = resolve;
        }),
      );
    const wrapper = await mountEditor();

    await wrapper.setProps({ playerId: "player-2" });
    await nextTick();
    emitPlayerDSPUpdate(makeConfig({ preset_id: "preset-1" }));
    resolvePlayerConfig(makeConfig());
    await flushPromises();

    expect(selectedPresetLabel(wrapper)).toBe("Living room");
    expect(apiMock.saveDSPConfig).not.toHaveBeenCalled();
  });

  it("restores a canceled save to its player after unmount", async () => {
    let rejectApply!: (error: Error) => void;
    apiMock.applyDSPPreset.mockReturnValueOnce(
      new Promise<DSPConfig>((_resolve, reject) => {
        rejectApply = reject;
      }),
    );
    const wrapper = await mountEditor();
    await wrapper.get(".dsp-switch").trigger("click");
    await nextTick();
    await wrapper.get(".preset-item").trigger("click");

    wrapper.unmount();
    rejectApply(new Error("Apply failed"));
    await flushPromises();
    await vi.advanceTimersByTimeAsync(2100);

    expect(apiMock.saveDSPConfig).toHaveBeenCalledWith(
      "player-1",
      expect.objectContaining({
        enabled: false,
        preset_id: null,
      }),
    );
  });

  it("flushes a recent manual edit on unmount", async () => {
    const wrapper = await mountEditor();
    await wrapper.get(".dsp-switch").trigger("click");
    await nextTick();

    wrapper.unmount();
    await flushPromises();

    expect(apiMock.saveDSPConfig).toHaveBeenCalledWith(
      "player-1",
      expect.objectContaining({
        enabled: false,
        preset_id: null,
      }),
    );
  });

  it("keeps a newer server event over a failed-apply recovery fetch", async () => {
    let resolveRecovery!: (config: DSPConfig) => void;
    apiMock.getDSPConfig
      .mockReset()
      .mockResolvedValueOnce(makeConfig())
      .mockReturnValueOnce(
        new Promise<DSPConfig>((resolve) => {
          resolveRecovery = resolve;
        }),
      );
    apiMock.applyDSPPreset.mockRejectedValueOnce(new Error("Apply failed"));
    const wrapper = await mountEditor();

    await wrapper.get(".preset-item").trigger("click");
    await flushPromises();
    emitPlayerDSPUpdate(makeConfig({ preset_id: "preset-1" }));
    resolveRecovery(makeConfig());
    await flushPromises();

    expect(selectedPresetLabel(wrapper)).toBe("Living room");
  });

  it("keeps a newer server event over a pending apply response", async () => {
    let resolveApply!: (config: DSPConfig) => void;
    getPresets().value = [makePreset(), makePreset("preset-2", "Bedroom")];
    apiMock.applyDSPPreset.mockReturnValueOnce(
      new Promise<DSPConfig>((resolve) => {
        resolveApply = resolve;
      }),
    );
    const wrapper = await mountEditor();

    await wrapper.findAll(".preset-item")[0].trigger("click");
    emitPlayerDSPUpdate(makeConfig({ preset_id: "preset-2" }));
    resolveApply(makeConfig({ preset_id: "preset-1" }));
    await flushPromises();

    expect(selectedPresetLabel(wrapper)).toBe("Bedroom");
  });

  it("restores the newest edit across overlapping applies after unmount", async () => {
    let resolveFirstApply!: (config: DSPConfig) => void;
    let rejectSecondApply!: (error: Error) => void;
    getPresets().value = [makePreset(), makePreset("preset-2", "Bedroom")];
    apiMock.applyDSPPreset
      .mockReturnValueOnce(
        new Promise<DSPConfig>((resolve) => {
          resolveFirstApply = resolve;
        }),
      )
      .mockReturnValueOnce(
        new Promise<DSPConfig>((_resolve, reject) => {
          rejectSecondApply = reject;
        }),
      );
    const wrapper = await mountEditor();

    await wrapper.get(".dsp-switch").trigger("click");
    await nextTick();
    await wrapper.findAll(".preset-item")[0].trigger("click");
    await wrapper.get(".dsp-switch").trigger("click");
    await nextTick();
    await wrapper.findAll(".preset-item")[1].trigger("click");

    wrapper.unmount();
    rejectSecondApply(new Error("Second apply failed"));
    await flushPromises();

    expect(apiMock.saveDSPConfig).toHaveBeenCalledWith(
      "player-1",
      expect.objectContaining({
        enabled: true,
        preset_id: null,
      }),
    );

    resolveFirstApply(makeConfig({ preset_id: "preset-1" }));
    await flushPromises();
  });

  it("retains an in-flight save context when switching away and back", async () => {
    let resolveFirstSave!: (config: DSPConfig) => void;
    apiMock.getDSPConfig
      .mockReset()
      .mockResolvedValueOnce(makeConfig())
      .mockResolvedValueOnce(makeConfig())
      .mockResolvedValueOnce(makeConfig({ enabled: false }));
    apiMock.saveDSPConfig
      .mockReturnValueOnce(
        new Promise<DSPConfig>((resolve) => {
          resolveFirstSave = resolve;
        }),
      )
      .mockResolvedValueOnce(makeConfig({ enabled: true }));
    const wrapper = await mountEditor();

    await wrapper.get(".dsp-switch").trigger("click");
    await wrapper.setProps({ playerId: "player-2" });
    await flushPromises();
    const firstSavedConfig = apiMock.saveDSPConfig.mock.calls[0][1];

    await wrapper.setProps({ playerId: "player-1" });
    await flushPromises();
    await wrapper.get(".dsp-switch").trigger("click");
    await nextTick();
    emitPlayerDSPUpdate(firstSavedConfig);
    await nextTick();

    expect(wrapper.getComponent(SwitchStub).props("modelValue")).toBe(true);
    await vi.advanceTimersByTimeAsync(2100);
    expect(apiMock.saveDSPConfig).toHaveBeenLastCalledWith(
      "player-1",
      expect.objectContaining({ enabled: true }),
    );

    resolveFirstSave(firstSavedConfig);
    await flushPromises();
  });

  it("does not restore a timer canceled by a server update", async () => {
    apiMock.applyDSPPreset.mockRejectedValueOnce(new Error("Apply failed"));
    const wrapper = await mountEditor();
    await wrapper.get(".dsp-switch").trigger("click");
    await nextTick();
    emitPlayerDSPUpdate(makeConfig({ preset_id: "preset-1" }));
    await nextTick();

    await wrapper.get(".preset-item").trigger("click");
    await flushPromises();
    await vi.advanceTimersByTimeAsync(2100);

    expect(apiMock.saveDSPConfig).not.toHaveBeenCalled();
  });
});

async function mountEditor() {
  const wrapper = shallowMount(EditPlayerDsp, {
    props: { playerId: "player-1" },
    global: {
      mocks: {
        $t: translate,
        $vuetify: {
          theme: { current: { dark: false } },
        },
      },
      stubs: {
        DSPParametricEQ: true,
        DSPPipeline: PipelineStub,
        DSPSlider: true,
        DSPToneControl: ToneControlStub,
        VAlert: true,
        VBtn: { template: "<button><slot /></button>" },
        VCard: { template: "<div><slot /></div>" },
        VCardActions: { template: "<div><slot /></div>" },
        VCardText: { template: "<div><slot /></div>" },
        VCardTitle: { template: "<div><slot /></div>" },
        VCol: { template: "<div><slot /></div>" },
        VContainer: { template: "<div><slot /></div>" },
        VDialog: { template: "<div><slot /></div>" },
        VIcon: true,
        VList: { template: "<div><slot /></div>" },
        VListItem: {
          template:
            '<button class="preset-item"><slot /><slot name="append" /></button>',
        },
        VListItemTitle: { template: "<span><slot /></span>" },
        VMenu: {
          template: '<div><slot name="activator" :props="{}" /><slot /></div>',
        },
        VRow: { template: "<div><slot /></div>" },
        VSelect: { template: "<div />" },
        VSpacer: true,
        VSwitch: SwitchStub,
        VTextField: { template: "<div />" },
        VToolbar: { template: "<div><slot /></div>" },
        VToolbarTitle: { template: "<span><slot /></span>" },
      },
    },
  });
  await flushPromises();
  await nextTick();
  return wrapper;
}

function selectedPresetLabel(
  wrapper: Awaited<ReturnType<typeof mountEditor>>,
): string {
  return wrapper.get('[data-testid="selected-dsp-preset"]').text();
}

function emitPlayerDSPUpdate(config: DSPConfig): void {
  if (!apiMock.playerDSPCallback) {
    throw new Error("Player DSP callback was not registered");
  }
  apiMock.playerDSPCallback({ data: config });
}

function getPresets(): Ref<DSPConfigPreset[]> {
  if (!registryMock.presets) {
    throw new Error("Preset registry mock was not initialized");
  }
  return registryMock.presets;
}

function getToneControl(config: DSPConfig): ToneControlFilter {
  const filter = config.filters[0];
  if (filter.type !== DSPFilterType.TONE_CONTROL) {
    throw new Error("Expected tone control filter");
  }
  return filter;
}

function makeConfig(overrides: Partial<DSPConfig> = {}): DSPConfig {
  return {
    enabled: true,
    filters: [
      {
        type: DSPFilterType.TONE_CONTROL,
        enabled: true,
        bass_level: 1,
        mid_level: 0,
        treble_level: 0,
      },
    ],
    input_gain: 0,
    output_gain: 0,
    preset_id: null,
    ...overrides,
  };
}

function makePreset(
  presetId = "preset-1",
  name = "Living room",
): DSPConfigPreset {
  return {
    preset_id: presetId,
    name,
    config: makeConfig(),
  };
}

function translate(key: string): string {
  if (key === "settings.dsp.presets.load") return "Load DSP Preset";
  if (key === "settings.dsp.presets.custom") return "Custom";
  return key;
}
