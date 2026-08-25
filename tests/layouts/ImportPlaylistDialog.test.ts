/**
 * The dialog body relies on reka-ui's RadioGroup for the match-policy picker,
 * so it's stubbed with a minimal component that still forwards v-model,
 * letting the tests drive it without needing floating-ui/portals in jsdom.
 */
import ImportPlaylistDialog from "@/layouts/default/ImportPlaylistDialog.vue";
import { PlaylistMatchPolicy, ProviderType } from "@/plugins/api/interfaces";
import { enableAutoUnmount, mount, type VueWrapper } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const musicProvider = (instanceId: string, name: string, available = true) => ({
  instance_id: instanceId,
  domain: instanceId,
  name,
  type: ProviderType.MUSIC,
  supported_features: ["search"],
  available,
  is_streaming_provider: true,
});

const { apiMock, eventHandlers } = vi.hoisted(() => ({
  apiMock: {
    importPlaylist: vi.fn(),
    providers: {} as Record<string, unknown>,
    supportsPlaylistMatchPolicy: true,
  },
  eventHandlers: {} as Record<string, (payload: unknown) => void>,
}));

vi.mock("@/plugins/api", () => ({ default: apiMock }));

vi.mock("@/plugins/eventbus", () => ({
  eventbus: {
    on: vi.fn((event: string, handler: (payload: unknown) => void) => {
      eventHandlers[event] = handler;
    }),
    off: vi.fn(),
  },
}));

vi.mock("@/plugins/i18n", () => ({ $t: (key: string) => key }));

vi.mock("@/plugins/router", () => ({ default: { push: vi.fn() } }));

vi.mock("@/plugins/store", () => ({
  store: { dialogActive: false, showFullscreenPlayer: false },
}));

vi.mock("vue-sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const radioGroupStub = {
  name: "RadioGroupStub",
  props: ["modelValue"],
  emits: ["update:modelValue"],
  template: "<div><slot /></div>",
};

const checkboxStub = {
  name: "CheckboxStub",
  props: ["checked", "id"],
  emits: ["update:checked"],
  template:
    '<input type="checkbox" :id="id" :checked="checked" @change="$emit(\'update:checked\', !checked)" />',
};

const passthrough = { template: "<div><slot /></div>" };

function mountDialog(): VueWrapper {
  return mount(ImportPlaylistDialog, {
    global: {
      stubs: {
        Dialog: passthrough,
        DialogContent: passthrough,
        DialogHeader: passthrough,
        DialogTitle: passthrough,
        DialogDescription: passthrough,
        DialogFooter: passthrough,
        Checkbox: checkboxStub,
        RadioGroup: radioGroupStub,
        RadioGroupItem: true,
      },
    },
  });
}

function open(m3uData = "#EXTM3U", playlistName = "My Playlist") {
  eventHandlers.importPlaylistDialog({ m3uData, playlistName });
}

function radioGroup(wrapper: VueWrapper) {
  return wrapper.findComponent({ name: "RadioGroupStub" });
}

function providerCheckbox(wrapper: VueWrapper, instanceId: string) {
  return wrapper.get<HTMLInputElement>(`#provider-${instanceId}`);
}

function importButton(wrapper: VueWrapper) {
  const buttons = wrapper.findAll("button");
  return buttons[buttons.length - 1];
}

enableAutoUnmount(afterEach);

beforeEach(() => {
  vi.clearAllMocks();
  apiMock.supportsPlaylistMatchPolicy = true;
  apiMock.providers = {
    spotify: musicProvider("spotify--1", "Spotify"),
    tidal: musicProvider("tidal--1", "Tidal"),
  };
  for (const key of Object.keys(eventHandlers)) delete eventHandlers[key];
});

describe("ImportPlaylistDialog", () => {
  it("defaults to the same-recording match policy with all providers selected", async () => {
    const wrapper = mountDialog();
    open();
    await wrapper.vm.$nextTick();

    expect(radioGroup(wrapper).props("modelValue")).toBe(
      PlaylistMatchPolicy.SAME_RECORDING,
    );
    expect(providerCheckbox(wrapper, "spotify--1").element.checked).toBe(true);
    expect(providerCheckbox(wrapper, "tidal--1").element.checked).toBe(true);
  });

  it("hides the match policy picker when no providers are available", async () => {
    apiMock.providers = {};
    const wrapper = mountDialog();
    open();
    await wrapper.vm.$nextTick();

    expect(radioGroup(wrapper).exists()).toBe(false);
  });

  it("hides the match policy picker on servers older than schema 57", async () => {
    apiMock.supportsPlaylistMatchPolicy = false;
    const wrapper = mountDialog();
    open();
    await wrapper.vm.$nextTick();

    expect(radioGroup(wrapper).exists()).toBe(false);
  });

  it("resets provider selection and match policy each time it's reopened", async () => {
    const wrapper = mountDialog();
    open();
    await wrapper.vm.$nextTick();

    await providerCheckbox(wrapper, "tidal--1").trigger("change");
    await radioGroup(wrapper).vm.$emit(
      "update:modelValue",
      PlaylistMatchPolicy.BEST_EFFORT,
    );

    open();
    await wrapper.vm.$nextTick();

    expect(radioGroup(wrapper).props("modelValue")).toBe(
      PlaylistMatchPolicy.SAME_RECORDING,
    );
    expect(providerCheckbox(wrapper, "tidal--1").element.checked).toBe(true);
  });

  it("sends undefined match_providers when every provider stays selected, and the chosen policy", async () => {
    const wrapper = mountDialog();
    open("#EXTM3U data", "My Playlist");
    await wrapper.vm.$nextTick();

    await radioGroup(wrapper).vm.$emit(
      "update:modelValue",
      PlaylistMatchPolicy.EXACT,
    );
    await importButton(wrapper).trigger("click");

    expect(apiMock.importPlaylist).toHaveBeenCalledWith(
      "#EXTM3U data",
      true,
      undefined,
      PlaylistMatchPolicy.EXACT,
    );
  });

  it("sends only the deselected provider subset as match_providers", async () => {
    const wrapper = mountDialog();
    open();
    await wrapper.vm.$nextTick();

    await providerCheckbox(wrapper, "tidal--1").trigger("change");
    await importButton(wrapper).trigger("click");

    expect(apiMock.importPlaylist).toHaveBeenCalledWith(
      "#EXTM3U",
      true,
      ["spotify--1"],
      PlaylistMatchPolicy.SAME_RECORDING,
    );
  });

  it("omits match_policy on servers older than schema 57", async () => {
    apiMock.supportsPlaylistMatchPolicy = false;
    const wrapper = mountDialog();
    open();
    await wrapper.vm.$nextTick();

    await importButton(wrapper).trigger("click");

    expect(apiMock.importPlaylist).toHaveBeenCalledWith(
      "#EXTM3U",
      true,
      undefined,
      undefined,
    );
  });
});
