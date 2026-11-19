import ConfiguredProviderItem from "@/components/onboarding/ConfiguredProviderItem.vue";
import type { ConfiguredProvider } from "@/composables/useOnboarding";
import { ProviderStatus } from "@/plugins/api/interfaces";
import { enableAutoUnmount, mount } from "@vue/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";
import { defineComponent, h } from "vue";

const { apiMock } = vi.hoisted(() => ({
  apiMock: {
    providerManifests: {} as Record<string, { has_setup_flow?: boolean }>,
  },
}));

vi.mock("@/plugins/api", () => ({ api: apiMock, default: apiMock }));

vi.mock("@/plugins/i18n", () => ({ $t: (key: string) => key }));

// the dialog is tested on its own; here it only has to say what it was asked
const SettingsDialogStub = defineComponent({
  name: "ProviderSettingsDialog",
  props: { open: Boolean, instanceId: { type: String, required: true } },
  setup: () => () => h("div"),
});

function provider(overrides: Partial<ConfiguredProvider> = {}) {
  return {
    instance_id: "airplay_receiver--1",
    name: "AirPlay Receiver",
    domain: "airplay_receiver",
    needsAttention: false,
    status: null,
    ...overrides,
  };
}

function mountItem(item: ConfiguredProvider) {
  return mount(ConfiguredProviderItem, {
    props: { provider: item },
    attrs: { "data-testid": "onboarding-configured-provider" },
    global: {
      mocks: { $t: (key: string) => key },
      stubs: {
        ProviderIcon: true,
        ProviderSettingsDialog: SettingsDialogStub,
      },
    },
  });
}

enableAutoUnmount(afterEach);

describe("ConfiguredProviderItem", () => {
  it("opens the settings of a working provider on top of the step", async () => {
    const wrapper = mountItem(provider());

    // what the step hands the row stays on the row, next to its dialog
    const row = wrapper.find("[data-testid=onboarding-configured-provider]");
    expect(row.element.tagName).toBe("BUTTON");
    expect(wrapper.findComponent(SettingsDialogStub).props("open")).toBe(false);

    await row.trigger("click");

    const dialog = wrapper.findComponent(SettingsDialogStub);
    expect(dialog.props("open")).toBe(true);
    expect(dialog.props("instanceId")).toBe("airplay_receiver--1");
  });

  it("leaves a provider that needs attention to its Reconfigure", async () => {
    apiMock.providerManifests = { spotify_connect: { has_setup_flow: true } };
    const wrapper = mountItem(
      provider({
        domain: "spotify_connect",
        needsAttention: true,
        status: ProviderStatus.AUTH_REQUIRED,
      }),
    );

    const row = wrapper.find("[data-testid=onboarding-configured-provider]");
    expect(row.element.tagName).not.toBe("BUTTON");
    expect(wrapper.findComponent(SettingsDialogStub).exists()).toBe(false);
    expect(
      wrapper.find("[data-testid=onboarding-provider-reconfigure]").exists(),
    ).toBe(true);
  });
});
