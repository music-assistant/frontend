import type { MusicAssistantApi } from "@/plugins/api";
import type { Player, PlayerConfig } from "@/plugins/api/interfaces";
import { mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { apiMock } = vi.hoisted(() => ({
  apiMock: {
    players: {} as Record<string, Partial<Player>>,
    getProviderManifest: vi.fn<MusicAssistantApi["getProviderManifest"]>(),
  },
}));

vi.mock("@/plugins/api", () => ({
  api: apiMock,
}));

import SettingsPlayerCard from "@/components/SettingsPlayerCard.vue";

const playerConfig = {
  enabled: true,
  name: "Kitchen",
  default_name: null,
  player_id: "kitchen",
  provider: "test",
  values: {},
} as PlayerConfig;

const passthroughStub = { template: "<div><slot /></div>" };

function mountCard(configOverrides: Partial<PlayerConfig> = {}) {
  return mount(SettingsPlayerCard, {
    props: { playerConfig: { ...playerConfig, ...configOverrides } },
    global: {
      mocks: { $t: (key: string) => key },
      stubs: {
        PlayerIcon: true,
        ProtocolChip: true,
        VCard: passthroughStub,
        VIcon: true,
        VBtn: true,
      },
    },
  });
}

describe("SettingsPlayerCard", () => {
  beforeEach(() => {
    apiMock.getProviderManifest.mockReturnValue(undefined);
  });

  it("relays PlayerSetupWarning's click through to its own setup event", async () => {
    apiMock.players = {
      kitchen: { available: false, needs_setup: true, output_protocols: [] },
    };
    const wrapper = mountCard();

    const setupButton = wrapper
      .findAll("button")
      .find((b) => b.text() === "settings.start_setup");
    expect(setupButton).toBeTruthy();

    await setupButton!.trigger("click");

    expect(wrapper.emitted("setup")).toEqual([[playerConfig]]);
  });

  it("bubbles a click on the warning badge up to its own click event", async () => {
    apiMock.players = {
      kitchen: { available: false, needs_setup: true, output_protocols: [] },
    };
    const wrapper = mountCard();

    await wrapper.find('[data-slot="badge"]').trigger("click");

    expect(wrapper.emitted("click")).toEqual([[playerConfig]]);
  });

  it("does not dim a needs-setup card the way it dims a merely unavailable one", () => {
    apiMock.players = {
      kitchen: { available: false, needs_setup: true, output_protocols: [] },
    };
    const wrapper = mountCard();

    expect(wrapper.classes()).not.toContain("player-unavailable");
  });

  it("dims a card that is unavailable without needing setup", () => {
    apiMock.players = {
      kitchen: { available: false, needs_setup: false, output_protocols: [] },
    };
    const wrapper = mountCard();

    expect(wrapper.classes()).toContain("player-unavailable");
  });

  it("dims a disabled card even when the player is available", () => {
    apiMock.players = {
      kitchen: { available: true, needs_setup: false, output_protocols: [] },
    };
    const wrapper = mountCard({ enabled: false });

    expect(wrapper.classes()).toContain("player-disabled");
  });
});
