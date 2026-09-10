import Players from "@/views/settings/Players.vue";
import type { MusicAssistantApi } from "@/plugins/api";
import type { getPlayerSettingsMenuItems as buildPlayerSettingsMenuItems } from "@/helpers/player_settings_actions";
import { ProviderType, type PlayerConfig } from "@/plugins/api/interfaces";
import { flushPromises, mount } from "@vue/test-utils";
import { ref } from "vue";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { providerManifest } from "../fixtures/providerManifest";

const { apiMock, emitEvent, getPlayerSettingsMenuItems, routerPush } =
  vi.hoisted(() => ({
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
    getPlayerSettingsMenuItems: vi.fn<typeof buildPlayerSettingsMenuItems>(),
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

// the menu itself is covered where it is built; here it only has to arrive
vi.mock("@/helpers/player_settings_actions", () => ({
  getPlayerName: (config: PlayerConfig) => config.name ?? config.player_id,
  getPlayerSettingsMenuItems,
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

vi.mock("@/plugins/router", () => ({
  default: { push: vi.fn() },
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
  template: `
    <button
      class="player-list-item"
      @click="$emit('click')"
      @contextmenu="$emit('menu', $event)"
    />
  `,
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
    getPlayerSettingsMenuItems.mockReturnValue([{ label: "settings.delete" }]);
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

  it("opens the shared player menu with links to the settings sections", async () => {
    const wrapper = await mountPlayers("list");

    await wrapper.get(".player-list-item").trigger("contextmenu");

    expect(getPlayerSettingsMenuItems).toHaveBeenCalledWith(
      expect.objectContaining({ player_id: "kitchen" }),
      expect.objectContaining({ includeSections: true }),
    );
    expect(emitEvent).toHaveBeenCalledWith(
      "contextmenu",
      expect.objectContaining({ items: [{ label: "settings.delete" }] }),
    );
  });

  it("filters the list by player status", async () => {
    const wrapper = await mountPlayers("list");
    const filters = wrapper.findComponent({ name: "PlayerFilters" });

    filters.vm.$emit("update:statuses", ["needs_setup"]);
    await flushPromises();
    expect(wrapper.find(".player-list-item").exists()).toBe(true);

    filters.vm.$emit("update:statuses", ["available"]);
    await flushPromises();
    expect(wrapper.find(".player-list-item").exists()).toBe(false);
  });

  it("drops a deleted player from the list", async () => {
    const wrapper = await mountPlayers("list");
    await wrapper.get(".player-list-item").trigger("contextmenu");

    getPlayerSettingsMenuItems.mock.calls[0][1]!.onDeleted!();
    await flushPromises();

    expect(wrapper.find(".player-list-item").exists()).toBe(false);
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
