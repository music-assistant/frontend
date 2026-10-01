import ProviderSettingsLinks from "@/components/settings/providers/ProviderSettingsLinks.vue";
import type { getProviderSettingsSections as readProviderSettingsSections } from "@/helpers/provider_settings_actions";
import type { MusicAssistantApi } from "@/plugins/api";
import {
  EventType,
  type Player,
  type PlayerConfig,
  ProviderType,
} from "@/plugins/api/interfaces";
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
      expect(rowState(wrapper, "access")).toBe("Marcel · Only me");

      await row.trigger("click");

      expect(wrapper.emitted("access")).toHaveLength(1);
    });

    it("keeps a long state beside the label from squeezing it, and moves it below on a phone", () => {
      const row = mountLinks().get(
        '[data-testid="provider-settings-link-access"]',
      );

      const beside = row.get('[data-testid="provider-settings-state"]');
      expect(beside.classes()).toEqual(
        expect.arrayContaining([
          "hidden",
          "sm:block",
          "max-w-[45%]",
          "truncate",
        ]),
      );
      // the full text for a state cut short
      expect(beside.attributes("title")).toBe("Marcel · Only me");
      expect(
        row.get('[data-testid="provider-settings-state-below"]').classes(),
      ).toContain("sm:hidden");
    });
  });

  describe("players row", () => {
    // player changes reach the row debounced; flushPromises still runs on setImmediate
    beforeEach(() => {
      vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    });
    afterEach(() => {
      vi.useRealTimers();
    });

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
          .find('[data-testid^="provider-settings-state"]')
          .exists(),
      ).toBe(false);
    });

    it("keeps the count of the latest refresh when responses cross", async () => {
      let resolveFirst: (configs: PlayerConfig[]) => void = () => {};
      const wrapper = mountLinks();
      await flushPromises();

      apiMock.getPlayerConfigs.mockReturnValueOnce(
        new Promise((resolve) => (resolveFirst = resolve)),
      );
      playersChanged();
      apiMock.getPlayerConfigs.mockResolvedValueOnce([
        playerConfig({ player_id: "own", provider: "sonos--1" }),
      ]);
      playersChanged();
      await flushPromises();
      expect(playersState(wrapper)).toBe("1");

      // the older request answers last, with a list that is out of date
      resolveFirst([]);
      await flushPromises();
      expect(playersState(wrapper)).toBe("1");
    });

    it("reloads the players once for a burst of player changes", async () => {
      mountLinks();
      await flushPromises();
      apiMock.getPlayerConfigs.mockClear();

      announcePlayerChange();
      announcePlayerChange();
      announcePlayerChange();
      vi.runAllTimers();
      await flushPromises();

      expect(apiMock.getPlayerConfigs).toHaveBeenCalledTimes(1);
    });

    it("drops a count it can no longer refresh", async () => {
      apiMock.getPlayerConfigs.mockResolvedValue([
        playerConfig({ player_id: "own", provider: "sonos--1" }),
      ]);
      const wrapper = mountLinks();
      await flushPromises();
      expect(playersState(wrapper)).toBe("1");

      apiMock.getPlayerConfigs.mockRejectedValue(new Error("refused"));
      vi.spyOn(console, "error").mockImplementation(() => {});
      playersChanged();
      await flushPromises();

      expect(
        wrapper
          .get('[data-testid="provider-settings-link-players"]')
          .find('[data-testid^="provider-settings-state"]')
          .exists(),
      ).toBe(false);
    });

    it("follows the players the provider discovers, changes or removes", async () => {
      const wrapper = mountLinks();
      await flushPromises();
      expect(playersState(wrapper)).toBe("0");

      apiMock.getPlayerConfigs.mockResolvedValue([
        playerConfig({ player_id: "own", provider: "sonos--1" }),
      ]);
      playersChanged();
      await flushPromises();

      expect(apiMock.subscribe_multi).toHaveBeenCalledWith(
        [
          EventType.PLAYER_ADDED,
          EventType.PLAYER_CONFIG_UPDATED,
          EventType.PLAYER_REMOVED,
        ],
        expect.any(Function),
      );
      expect(playersState(wrapper)).toBe("1");

      apiMock.getPlayerConfigs.mockResolvedValue([]);
      playersChanged();
      await flushPromises();

      expect(playersState(wrapper)).toBe("0");
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
      const wrapper = mountLinks();
      const row = wrapper.get('[data-testid="provider-settings-link-sync"]');

      expect(row.element.tagName).toBe("BUTTON");
      expect(rowState(wrapper, "sync")).toBe("settings.sync");
      // it reads as an action rather than as a state
      expect(
        row.get('[data-testid="provider-settings-state"]').classes(),
      ).toContain("text-primary");
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

      const wrapper = mountLinks();
      const row = wrapper.get('[data-testid="provider-settings-link-sync"]');

      expect(rowState(wrapper, "sync")).toBe("settings.sync_in_progress");
      expect(
        row.get('[data-testid="provider-settings-state"]').classes(),
      ).toContain("text-muted-foreground");
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
  return rowState(wrapper, "players");
}

/**
 * The state of a row, which it shows beside the label and, on a phone, below
 * it; the two have to agree.
 */
function rowState(wrapper: LinksWrapper, key: string): string {
  const row = wrapper.get(`[data-testid="provider-settings-link-${key}"]`);
  const beside = row.get('[data-testid="provider-settings-state"]').text();
  expect(row.get('[data-testid="provider-settings-state-below"]').text()).toBe(
    beside,
  );
  return beside;
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
 * Deliver the player change the players row keeps up with, once its debounce
 * has passed.
 */
function playersChanged() {
  announcePlayerChange();
  vi.runAllTimers();
}

function announcePlayerChange() {
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
