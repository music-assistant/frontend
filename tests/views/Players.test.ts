import Players from "@/views/settings/Players.vue";
import type { MusicAssistantApi } from "@/plugins/api";
import { ProviderType } from "@/plugins/api/interfaces";
import { flushPromises, mount } from "@vue/test-utils";
import { ref } from "vue";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { providerManifest } from "../fixtures/providerManifest";

const { apiMock, emitEvent, routerPush } = vi.hoisted(() => ({
  apiMock: {
    getPlayerConfigs: vi.fn<MusicAssistantApi["getPlayerConfigs"]>(),
    getProvider: vi.fn<MusicAssistantApi["getProvider"]>(),
    getProviderManifest: vi.fn<MusicAssistantApi["getProviderManifest"]>(),
    playerManifests: {},
    players: {} as Record<
      string,
      {
        available: boolean;
        needs_setup: boolean;
        output_protocols: [];
      }
    >,
    providerManifests: {},
    providers: {},
    subscribe_multi: vi.fn(),
  },
  emitEvent: vi.fn(),
  routerPush: vi.fn(),
}));

vi.mock("@/plugins/api", () => ({
  api: apiMock,
  default: apiMock,
}));

vi.mock("@/plugins/eventbus", () => ({
  eventbus: {
    emit: emitEvent,
  },
}));

vi.mock("@/helpers/player_menu_items", () => ({
  getPlayerSetupMenuItem: () => undefined,
}));

vi.mock("@/helpers/utils", () => ({
  isHiddenSendspinWebPlayer: () => false,
  openLinkInNewTab: vi.fn(),
}));

vi.mock("@/views/settings/AddPlayerGroupDialog.vue", () => ({
  default: {
    template: "<div />",
  },
}));

vi.mock("vue-router", () => ({
  useRouter: () => ({
    push: routerPush,
  }),
}));

const playerConfig = {
  enabled: true,
  name: "Kitchen",
  default_name: null,
  player_id: "kitchen",
  provider: "test",
  values: {},
};

const ListItemStub = {
  emits: ["click", "menu"],
  template: `<button class="player-list-item" @click="$emit('click')" />`,
};

const SettingsPlayerCardStub = {
  props: ["playerConfig"],
  emits: ["click", "menu", "setup"],
  template: `
    <button
      class="settings-player-card"
      @click="$emit('click', playerConfig)"
    />
  `,
};

const passthroughStub = {
  template: "<div><slot /></div>",
};

describe("Players", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    playerConfig.enabled = true;
    apiMock.players = {
      kitchen: {
        available: false,
        needs_setup: true,
        output_protocols: [],
      },
    };
    apiMock.getPlayerConfigs.mockResolvedValue([playerConfig]);
    apiMock.getProvider.mockReturnValue({
      type: ProviderType.PLAYER,
      domain: "test",
      name: "Test",
      instance_id: "test",
      supported_features: [],
      available: true,
      is_streaming_provider: null,
    });
    apiMock.getProviderManifest.mockReturnValue(providerManifest());
    apiMock.subscribe_multi.mockReturnValue(vi.fn());
  });

  it.each([
    ["list", ".player-list-item"],
    ["card", ".settings-player-card"],
  ] as const)(
    "starts setup when clicking a setup-required player in %s view",
    async (viewMode, selector) => {
      const wrapper = await mountPlayers(viewMode);

      await wrapper.get(selector).trigger("click");

      expect(routerPush).not.toHaveBeenCalled();
      expect(emitEvent).toHaveBeenCalledWith("setupFlowDialog", {
        kind: "player",
        playerId: "kitchen",
      });
    },
  );

  it("opens settings when clicking a configured player", async () => {
    apiMock.players.kitchen.needs_setup = false;
    apiMock.players.kitchen.available = true;
    const wrapper = await mountPlayers("list");

    await wrapper.get(".player-list-item").trigger("click");

    expect(emitEvent).not.toHaveBeenCalledWith(
      "setupFlowDialog",
      expect.anything(),
    );
    expect(routerPush).toHaveBeenCalledWith("/settings/editplayer/kitchen");
  });

  it("opens settings when a setup-required player is disabled", async () => {
    playerConfig.enabled = false;
    const wrapper = await mountPlayers("list");

    await wrapper.get(".player-list-item").trigger("click");

    expect(emitEvent).not.toHaveBeenCalledWith(
      "setupFlowDialog",
      expect.anything(),
    );
    expect(routerPush).toHaveBeenCalledWith("/settings/editplayer/kitchen");
  });
});

async function mountPlayers(viewMode: "list" | "card") {
  const wrapper = mount(Players, {
    global: {
      mocks: {
        $t: (key: string) => key,
      },
      provide: {
        playersViewMode: {
          toggleViewMode: vi.fn(),
          viewMode: ref(viewMode),
        },
      },
      stubs: {
        AddPlayerGroupDialog: true,
        Button: true,
        Container: passthroughStub,
        ListItem: ListItemStub,
        PlayerFilters: true,
        PlayerIcon: true,
        ProviderIcon: true,
        RouterLink: true,
        SettingsPlayerCard: SettingsPlayerCardStub,
        VCol: passthroughStub,
        VIcon: true,
        VList: passthroughStub,
        VRow: passthroughStub,
      },
    },
  });
  await flushPromises();
  return wrapper;
}
