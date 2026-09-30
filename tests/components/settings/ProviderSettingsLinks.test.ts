import ProviderSettingsLinks from "@/components/settings/providers/ProviderSettingsLinks.vue";
import type { getProviderSettingsSections as readProviderSettingsSections } from "@/helpers/provider_settings_actions";
import type { MusicAssistantApi } from "@/plugins/api";
import { EventType, type Player, ProviderType } from "@/plugins/api/interfaces";
import { enableAutoUnmount, flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { outputProtocol } from "../../fixtures/outputProtocol";
import { playerConfig } from "../../fixtures/playerConfig";
import { providerConfig } from "../../fixtures/providerConfig";
import { providerInstance } from "../../fixtures/providerInstance";

const { apiMock, getProviderSettingsSections, isProviderSyncing, unsubscribe } =
  vi.hoisted(() => ({
    apiMock: {
      getPlayerConfigs: vi.fn<MusicAssistantApi["getPlayerConfigs"]>(),
      getProvider: vi.fn<MusicAssistantApi["getProvider"]>(),
      players: {} as Record<string, Player>,
      startSync: vi.fn<MusicAssistantApi["startSync"]>(),
      subscribe_multi: vi.fn<MusicAssistantApi["subscribe_multi"]>(),
    },
    getProviderSettingsSections: vi.fn<typeof readProviderSettingsSections>(),
    isProviderSyncing: vi.fn<(instanceId: string) => boolean>(),
    unsubscribe: vi.fn(),
  }));

vi.mock("@/plugins/api", () => ({ api: apiMock, default: apiMock }));
vi.mock("@/plugins/i18n", () => ({ $t: (key: string) => key }));
vi.mock("@/helpers/utils", () => ({ isHiddenSendspinWebPlayer: () => false }));
// the rules deciding which sections apply to a source are covered where they live
vi.mock("@/helpers/provider_settings_actions", () => ({
  getProviderAccessLabel: () => "settings.source_access.action",
  getProviderSettingsSections,
}));
vi.mock("@/composables/background-tasks/useBackgroundTasks", () => ({
  useBackgroundTasks: () => ({ isProviderSyncing }),
}));

const RouterLinkStub = {
  props: ["to"],
  template: '<a :href="JSON.stringify(to)"><slot /></a>',
};

describe("ProviderSettingsLinks", () => {
  enableAutoUnmount(afterEach);
  // a console spy has to be let go even when its test fails
  afterEach(() => {
    vi.restoreAllMocks();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    apiMock.getProvider.mockImplementation((id) =>
      id === "sonos--1" || id === "sonos"
        ? providerInstance({ domain: "sonos", type: ProviderType.PLAYER })
        : providerInstance({ domain: "airplay", type: ProviderType.PLAYER }),
    );
    apiMock.getPlayerConfigs.mockResolvedValue([]);
    apiMock.players = {};
    apiMock.startSync.mockResolvedValue([]);
    apiMock.subscribe_multi.mockReturnValue(unsubscribe);
    getProviderSettingsSections.mockReturnValue({
      access: true,
      players: true,
      sync: true,
    });
    isProviderSyncing.mockReturnValue(false);
  });

  it("lists a row for every section the source has", () => {
    const wrapper = mountLinks();

    expect(rowLabels(wrapper)).toEqual([
      "settings.source_access.action",
      "settings.players",
      "settings.library_sync",
    ]);
  });

  it("leaves out the sections the source has nothing to show for", () => {
    getProviderSettingsSections.mockReturnValue({
      access: false,
      players: true,
      sync: false,
    });

    expect(rowLabels(mountLinks())).toEqual(["settings.players"]);
  });

  it("renders nothing when no section applies", () => {
    getProviderSettingsSections.mockReturnValue({
      access: false,
      players: false,
      sync: false,
    });

    expect(mountLinks().html()).not.toContain("provider-settings-link");
  });

  describe("access row", () => {
    it("shows the access summary and asks for the access dialog", async () => {
      const wrapper = mountLinks();
      const row = wrapper.get('[data-testid="provider-settings-link-access"]');

      expect(row.element.tagName).toBe("BUTTON");
      expect(row.text()).toContain("Marcel · Only me");

      await row.trigger("click");

      expect(wrapper.emitted("access")).toHaveLength(1);
    });
  });

  describe("players row", () => {
    it("opens the players list filtered to this provider", () => {
      const row = mountLinks().get(
        '[data-testid="provider-settings-link-players"]',
      );

      expect(JSON.parse(row.attributes("href") ?? "")).toEqual({
        name: "playersettings",
        query: { providers: "sonos--1" },
      });
    });

    it("counts the players the players list shows for this provider", async () => {
      apiMock.getPlayerConfigs.mockResolvedValue([
        playerConfig({ player_id: "own", provider: "sonos--1" }),
        // switched off, so only its config is left to count
        playerConfig({
          player_id: "off",
          provider: "sonos--1",
          enabled: false,
        }),
        // plays through a protocol this provider offers
        playerConfig({ player_id: "through", provider: "airplay--1" }),
        playerConfig({ player_id: "other", provider: "airplay--1" }),
      ]);
      apiMock.players = {
        through: player({
          output_protocols: [outputProtocol({ protocol_domain: "sonos" })],
        }),
      };

      const wrapper = mountLinks();
      await flushPromises();

      expect(playersState(wrapper)).toBe("3");
    });

    it("leaves the count out when the players do not load", async () => {
      apiMock.getPlayerConfigs.mockRejectedValue(new Error("refused"));
      vi.spyOn(console, "error").mockImplementation(() => {});

      const wrapper = mountLinks();
      await flushPromises();

      expect(
        wrapper
          .get('[data-testid="provider-settings-link-players"]')
          .find("span")
          .exists(),
      ).toBe(false);
    });

    it("follows the players the provider discovers or changes", async () => {
      const wrapper = mountLinks();
      await flushPromises();
      expect(playersState(wrapper)).toBe("0");

      apiMock.getPlayerConfigs.mockResolvedValue([
        playerConfig({ player_id: "own", provider: "sonos--1" }),
      ]);
      playersChanged();
      await flushPromises();

      expect(apiMock.subscribe_multi).toHaveBeenCalledWith(
        [EventType.PLAYER_ADDED, EventType.PLAYER_CONFIG_UPDATED],
        expect.any(Function),
      );
      expect(playersState(wrapper)).toBe("1");
    });

    it("stops following the players once the page closes", async () => {
      const wrapper = mountLinks();
      await flushPromises();

      wrapper.unmount();

      expect(unsubscribe).toHaveBeenCalledOnce();
    });

    it("asks nothing of the server for a provider without players", async () => {
      getProviderSettingsSections.mockReturnValue({
        access: true,
        players: false,
        sync: false,
      });

      mountLinks();
      await flushPromises();

      expect(apiMock.getPlayerConfigs).not.toHaveBeenCalled();
      expect(apiMock.subscribe_multi).not.toHaveBeenCalled();
    });
  });

  describe("library sync row", () => {
    it("syncs this source on the spot", async () => {
      const row = mountLinks().get(
        '[data-testid="provider-settings-link-sync"]',
      );

      expect(row.element.tagName).toBe("BUTTON");
      expect(row.get("span").text()).toBe("settings.sync");
      expect(row.find("svg.animate-spin").exists()).toBe(false);

      await row.trigger("click");
      await flushPromises();

      expect(apiMock.startSync).toHaveBeenCalledWith(undefined, ["sonos--1"]);
    });

    it("hands a failing sync to the app error handling", async () => {
      const failure = new Error("refused");
      apiMock.startSync.mockRejectedValue(failure);
      const errorHandler = vi.fn();

      await mountLinks({ errorHandler })
        .get('[data-testid="provider-settings-link-sync"]')
        .trigger("click");
      await flushPromises();

      expect(errorHandler).toHaveBeenCalledWith(
        failure,
        expect.anything(),
        expect.anything(),
      );
    });

    it("shows a sync that is running and does not start another", async () => {
      isProviderSyncing.mockImplementation((id) => id === "sonos--1");

      const row = mountLinks().get(
        '[data-testid="provider-settings-link-sync"]',
      );

      expect(row.get("span").text()).toBe("settings.sync_in_progress");
      expect(row.find("svg.animate-spin").exists()).toBe(true);
      expect(row.attributes("disabled")).toBeDefined();
    });
  });
});

type LinksWrapper = ReturnType<typeof mountLinks>;

function rowLabels(wrapper: LinksWrapper): string[] {
  return wrapper
    .findAll('[data-testid^="provider-settings-link-"]')
    .map((row) => row.get("div > div").text());
}

function playersState(wrapper: LinksWrapper): string {
  return wrapper
    .get('[data-testid="provider-settings-link-players"] span')
    .text();
}

function mountLinks({ errorHandler }: { errorHandler?: () => void } = {}) {
  return mount(ProviderSettingsLinks, {
    props: {
      config: providerConfig({ domain: "sonos", type: ProviderType.PLAYER }),
      accessSummary: "Marcel · Only me",
    },
    global: {
      config: { errorHandler },
      stubs: { RouterLink: RouterLinkStub },
    },
  });
}

/**
 * Deliver the player change the players row keeps up with.
 */
function playersChanged() {
  for (const [, callback] of apiMock.subscribe_multi.mock.calls) {
    callback();
  }
}

/**
 * A registered player, with only the fields the players count reads filled in.
 */
function player(overrides: Partial<Player> = {}): Player {
  return { output_protocols: [], ...overrides } as Player;
}
