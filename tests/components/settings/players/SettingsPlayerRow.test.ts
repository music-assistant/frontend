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

import SettingsPlayerRow from "@/components/settings/players/SettingsPlayerRow.vue";

const playerConfig = {
  enabled: true,
  name: "Kitchen",
  default_name: null,
  player_id: "kitchen",
  provider: "test",
  values: {},
} as PlayerConfig;

function mountRow() {
  return mount(SettingsPlayerRow, {
    props: { playerConfig },
    global: {
      mocks: { $t: (key: string) => key },
      directives: { hold: {} },
      stubs: { PlayerIcon: true, ProtocolChip: true },
    },
  });
}

const statusIcons = (wrapper: ReturnType<typeof mountRow>) =>
  wrapper.findAll('[data-slot="item-actions"] > svg');

describe("SettingsPlayerRow", () => {
  beforeEach(() => {
    apiMock.getProviderManifest.mockReturnValue(undefined);
  });

  it("shows only the setup warning, no status icon, for a player that needs setup", () => {
    apiMock.players = {
      kitchen: {
        player_id: "kitchen",
        available: false,
        needs_setup: true,
        setup_reason: "pairing_required",
        output_protocols: [],
      },
    };
    const wrapper = mountRow();

    expect(wrapper.text()).toContain("settings.start_setup");
    expect(statusIcons(wrapper)).toHaveLength(0);
  });

  it("wraps the setup warning within the width of the row's content", () => {
    apiMock.players = {
      kitchen: {
        player_id: "kitchen",
        available: false,
        needs_setup: true,
        output_protocols: [],
      },
    };
    const wrapper = mountRow();
    const warning = wrapper.get('[data-slot="item-content"] > div:last-child');

    expect(warning.text()).toContain("settings.start_setup");
    // the button moves under the reason when the two do not fit side by side
    expect(warning.classes()).toEqual(
      expect.arrayContaining(["max-w-full", "flex-wrap"]),
    );
  });

  it("shows the status icon of a player that is unavailable", () => {
    apiMock.players = {
      kitchen: {
        player_id: "kitchen",
        available: false,
        needs_setup: false,
        output_protocols: [],
      },
    };
    const wrapper = mountRow();

    expect(statusIcons(wrapper)).toHaveLength(1);
    expect(statusIcons(wrapper)[0].attributes("aria-label")).toBe(
      "This player is not (yet) available",
    );
  });
});
