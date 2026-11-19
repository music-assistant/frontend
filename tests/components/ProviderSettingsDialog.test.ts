import ProviderSettingsDialog from "@/components/settings/providers/ProviderSettingsDialog.vue";
import { enableAutoUnmount, flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { defineComponent, h } from "vue";

const { apiMock, saveFailedMock, toastMock } = vi.hoisted(() => ({
  apiMock: {
    providers: {} as Record<string, { domain: string; name: string }>,
    providerManifests: {} as Record<
      string,
      { name: string; description: string }
    >,
    getProvider: vi.fn(),
    getProviderConfig: vi.fn(),
    saveProviderConfig: vi.fn(),
    invokeProviderConfigAction: vi.fn(),
  },
  saveFailedMock: vi.fn(),
  toastMock: { error: vi.fn(), success: vi.fn(), warning: vi.fn() },
}));

vi.mock("@/plugins/api", () => ({ api: apiMock, default: apiMock }));

vi.mock("@/plugins/i18n", () => ({ $t: (key: string) => key }));

vi.mock("vue-sonner", () => ({ toast: toastMock }));

const INSTANCE_ID = "airplay_receiver--1";

/** The settings as the server hands them back. */
function receiverConfig(enabled = true) {
  return {
    instance_id: INSTANCE_ID,
    domain: "airplay_receiver",
    enabled,
    values: {
      connected_players: {
        key: "connected_players",
        value: [],
        multi_value: true,
      },
    },
  };
}

// the settings form itself is tested on its own; here it only has to say what
// it was handed and send a save on the dialog's behalf
const EditConfigStub = defineComponent({
  name: "EditConfig",
  props: {
    configEntries: { type: Array, required: true },
    disabled: Boolean,
    providerDomain: { type: String, default: undefined },
    inlineSave: Boolean,
  },
  emits: ["submit", "action", "immediateApply"],
  setup(_props, { expose }) {
    expose({ saveFailed: saveFailedMock });
    return () => h("form", { "data-testid": "edit-config" });
  },
});

function mountDialog(open = true) {
  return mount(ProviderSettingsDialog, {
    props: { instanceId: INSTANCE_ID, open },
    global: {
      mocks: { $t: (key: string) => key },
      stubs: { EditConfig: EditConfigStub, ProviderIcon: true },
    },
  });
}

function form(wrapper: ReturnType<typeof mountDialog>) {
  return wrapper.findComponent(EditConfigStub);
}

enableAutoUnmount(afterEach);

describe("ProviderSettingsDialog", () => {
  beforeEach(() => {
    apiMock.providers = {
      [INSTANCE_ID]: { domain: "airplay_receiver", name: "AirPlay Receiver" },
    };
    apiMock.providerManifests = {
      airplay_receiver: {
        name: "AirPlay Receiver",
        description: "Play from Apple devices.",
      },
    };
    apiMock.getProvider.mockImplementation(
      (instanceId: string) => apiMock.providers[instanceId],
    );
    apiMock.getProviderConfig.mockReset();
    apiMock.getProviderConfig.mockResolvedValue(receiverConfig());
    apiMock.saveProviderConfig.mockReset();
    apiMock.saveProviderConfig.mockResolvedValue(receiverConfig());
    saveFailedMock.mockReset();
    toastMock.error.mockReset();
    toastMock.success.mockReset();
  });

  it("loads nothing while it is closed", async () => {
    mountDialog(false);
    await flushPromises();

    expect(apiMock.getProviderConfig).not.toHaveBeenCalled();
  });

  it("shows the provider's settings as the server has them", async () => {
    const wrapper = mountDialog();
    await flushPromises();

    expect(apiMock.getProviderConfig).toHaveBeenCalledWith(INSTANCE_ID);
    expect(form(wrapper).props("configEntries")).toEqual([
      receiverConfig().values.connected_players,
    ]);
    expect(form(wrapper).props("providerDomain")).toBe("airplay_receiver");
    expect(form(wrapper).props("disabled")).toBe(false);
    // the form sits in the dialog, so its Save does too
    expect(form(wrapper).props("inlineSave")).toBe(true);
    expect(document.body.textContent).toContain("AirPlay Receiver");
  });

  it("saves with the provider still switched on, then closes", async () => {
    const wrapper = mountDialog();
    await flushPromises();

    form(wrapper).vm.$emit("submit", { connected_players: ["player-a"] });
    await flushPromises();

    expect(apiMock.saveProviderConfig).toHaveBeenCalledWith(
      "airplay_receiver",
      { connected_players: ["player-a"], enabled: true },
      INSTANCE_ID,
      { suppressGlobalError: true },
    );
    expect(toastMock.success).toHaveBeenCalledWith("settings.provider_saved");
    expect(wrapper.emitted("update:open")).toEqual([[false]]);
  });

  it("stays open and says why when the save did not land", async () => {
    apiMock.saveProviderConfig.mockRejectedValue(new Error("refused"));

    const wrapper = mountDialog();
    await flushPromises();

    form(wrapper).vm.$emit("submit", { connected_players: ["player-a"] });
    await flushPromises();

    expect(toastMock.error).toHaveBeenCalledWith("Error: refused");
    // the form keeps its edits to try again with
    expect(saveFailedMock).toHaveBeenCalledOnce();
    expect(wrapper.emitted("update:open")).toBeUndefined();
  });

  it("closes and says why when the settings could not be loaded", async () => {
    apiMock.getProviderConfig.mockRejectedValue(new Error("gone"));

    const wrapper = mountDialog();
    await flushPromises();

    expect(toastMock.error).toHaveBeenCalledWith("Error: gone");
    expect(wrapper.emitted("update:open")).toEqual([[false]]);
  });
});
