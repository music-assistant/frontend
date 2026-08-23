/**
 * The dialog body relies on reka-ui's Select and RadioGroup for the
 * destination and match-policy pickers, so those are stubbed with minimal
 * components that still forward v-model, letting the tests drive them
 * without needing floating-ui/portals in jsdom.
 */
import MigratePlaylistDialog from "@/layouts/default/MigratePlaylistDialog.vue";
import { PlaylistMigrationMatchPolicy } from "@/plugins/api/interfaces";
import { enableAutoUnmount, mount, type VueWrapper } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { playlist } from "../fixtures/playlist";

const { apiMock, eventHandlers } = vi.hoisted(() => ({
  apiMock: { migratePlaylist: vi.fn() },
  eventHandlers: {} as Record<string, (payload: unknown) => void>,
}));

vi.mock("@/plugins/api", () => ({ default: apiMock }));

vi.mock("@/plugins/api/helpers", () => ({
  getPlaylistMigrationProviders: vi.fn(() => [
    { instance_id: "builtin", domain: "builtin", name: "Music Assistant" },
    { instance_id: "spotify--1", domain: "spotify", name: "Spotify" },
  ]),
}));

vi.mock("@/plugins/eventbus", () => ({
  eventbus: {
    on: vi.fn((event: string, handler: (payload: unknown) => void) => {
      eventHandlers[event] = handler;
    }),
    off: vi.fn(),
  },
}));

vi.mock("@/plugins/i18n", () => ({ $t: (key: string) => key }));

vi.mock("@/plugins/store", () => ({ store: { dialogActive: false } }));

vi.mock("vue-sonner", () => ({ toast: { error: vi.fn() } }));

const selectStub = {
  name: "SelectStub",
  props: ["modelValue"],
  emits: ["update:modelValue"],
  template: "<div><slot /></div>",
};

const radioGroupStub = {
  name: "RadioGroupStub",
  props: ["modelValue"],
  emits: ["update:modelValue"],
  template: "<div><slot /></div>",
};

const passthrough = { template: "<div><slot /></div>" };

function mountDialog(): VueWrapper {
  return mount(MigratePlaylistDialog, {
    global: {
      stubs: {
        Dialog: passthrough,
        DialogContent: passthrough,
        DialogHeader: passthrough,
        DialogTitle: passthrough,
        DialogDescription: passthrough,
        DialogFooter: passthrough,
        ProviderIcon: true,
        Select: selectStub,
        SelectTrigger: true,
        SelectContent: true,
        SelectItem: true,
        SelectValue: true,
        RadioGroup: radioGroupStub,
        RadioGroupItem: true,
      },
    },
  });
}

function open(overrides: Parameters<typeof playlist>[0] = {}) {
  eventHandlers.migratePlaylistDialog({ playlist: playlist(overrides) });
}

function select(wrapper: VueWrapper) {
  return wrapper.findComponent({ name: "SelectStub" });
}

function radioGroup(wrapper: VueWrapper) {
  return wrapper.findComponent({ name: "RadioGroupStub" });
}

function submitButton(wrapper: VueWrapper) {
  const buttons = wrapper.findAll("button");
  return buttons[buttons.length - 1];
}

enableAutoUnmount(afterEach);

beforeEach(() => {
  vi.clearAllMocks();
  for (const key of Object.keys(eventHandlers)) delete eventHandlers[key];
});

describe("MigratePlaylistDialog", () => {
  it("defaults to the same-recording match policy, no destination, and the playlist's own name", async () => {
    const wrapper = mountDialog();
    open({ name: "My Playlist" });
    await wrapper.vm.$nextTick();

    expect(radioGroup(wrapper).props("modelValue")).toBe(
      PlaylistMigrationMatchPolicy.SAME_RECORDING,
    );
    expect(select(wrapper).props("modelValue")).toBe("");
    expect(
      wrapper.get<HTMLInputElement>("#migrate-playlist-name").element.value,
    ).toBe("My Playlist");
  });

  it("disables submit until a destination is chosen", async () => {
    const wrapper = mountDialog();
    open({ name: "My Playlist" });
    await wrapper.vm.$nextTick();

    expect(submitButton(wrapper).attributes("disabled")).toBe("");

    await select(wrapper).vm.$emit("update:modelValue", "builtin");
    expect(submitButton(wrapper).attributes("disabled")).toBeUndefined();
  });

  it("resets to its defaults each time it's reopened, even after edits", async () => {
    const wrapper = mountDialog();
    open({ name: "First playlist" });
    await wrapper.vm.$nextTick();

    await select(wrapper).vm.$emit("update:modelValue", "builtin");
    await radioGroup(wrapper).vm.$emit(
      "update:modelValue",
      PlaylistMigrationMatchPolicy.BEST_EFFORT,
    );
    await wrapper.get("#migrate-playlist-name").setValue("Edited name");

    open({ name: "Second playlist" });
    await wrapper.vm.$nextTick();

    expect(select(wrapper).props("modelValue")).toBe("");
    expect(radioGroup(wrapper).props("modelValue")).toBe(
      PlaylistMigrationMatchPolicy.SAME_RECORDING,
    );
    expect(
      wrapper.get<HTMLInputElement>("#migrate-playlist-name").element.value,
    ).toBe("Second playlist");
  });

  it("submits the chosen destination, trimmed name, and match policy", async () => {
    const wrapper = mountDialog();
    open({ item_id: "42", name: "My Playlist" });
    await wrapper.vm.$nextTick();

    await select(wrapper).vm.$emit("update:modelValue", "spotify--1");
    await radioGroup(wrapper).vm.$emit(
      "update:modelValue",
      PlaylistMigrationMatchPolicy.EXACT,
    );
    await wrapper.get("#migrate-playlist-name").setValue("  Renamed copy  ");

    await submitButton(wrapper).trigger("click");

    expect(apiMock.migratePlaylist).toHaveBeenCalledWith(
      "42",
      "spotify--1",
      PlaylistMigrationMatchPolicy.EXACT,
      "Renamed copy",
    );
  });
});
