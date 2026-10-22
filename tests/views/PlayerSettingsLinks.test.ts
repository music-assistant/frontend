import type { getPlayerSettingsSections as readPlayerSettingsSections } from "@/helpers/player_settings_actions";
import type { MusicAssistantApi } from "@/plugins/api";
import { EventType } from "@/plugins/api/interfaces";
import PlayerSettingsLinks from "@/views/settings/PlayerSettingsLinks.vue";
import { enableAutoUnmount, flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { apiMock, getPlayerSettingsSections } = vi.hoisted(() => ({
  apiMock: {
    getDSPConfig: vi.fn<MusicAssistantApi["getDSPConfig"]>(),
    subscribe: vi.fn(),
  },
  getPlayerSettingsSections: vi.fn<typeof readPlayerSettingsSections>(),
}));

vi.mock("@/plugins/api", () => ({
  api: apiMock,
  default: apiMock,
}));

vi.mock("@/plugins/i18n", () => ({
  $t: (key: string) => key,
}));

// the rules deciding what applies to a player are covered where they live
vi.mock("@/helpers/player_settings_actions", () => ({
  getPlayerSettingsSections,
}));

const RouterLinkStub = {
  props: ["to"],
  template: '<a :href="to"><slot /></a>',
};

describe("PlayerSettingsLinks", () => {
  // the api mock is a module singleton, so a component left mounted keeps
  // answering the next test's events
  enableAutoUnmount(afterEach);

  beforeEach(() => {
    vi.clearAllMocks();
    apiMock.subscribe.mockReturnValue(vi.fn());
    apiMock.getDSPConfig.mockResolvedValue(dspConfig());
    getPlayerSettingsSections.mockReturnValue({
      player: true,
      queue: true,
      dsp: true,
      options: true,
    });
  });

  it("lists a row for every section the player has", async () => {
    const wrapper = await mountLinks();

    expect(rowLabels(wrapper)).toEqual([
      "settings.queue_settings",
      "settings.category.dsp",
      "settings.category.options",
    ]);
  });

  it("leaves out the sections the player has nothing to show for", async () => {
    getPlayerSettingsSections.mockReturnValue({
      player: true,
      queue: false,
      dsp: true,
      options: false,
    });

    const wrapper = await mountLinks();

    expect(rowLabels(wrapper)).toEqual(["settings.category.dsp"]);
  });

  it("renders nothing when the player has no other settings", async () => {
    getPlayerSettingsSections.mockReturnValue({
      player: true,
      queue: false,
      dsp: false,
      options: false,
    });

    const wrapper = await mountLinks();

    expect(wrapper.find("a").exists()).toBe(false);
  });

  it.each([
    ["queue", "/settings/editqueue/kitchen"],
    ["dsp", "/settings/editplayer/kitchen/dsp"],
    ["options", "/settings/editplayer/kitchen/options"],
  ])("opens the %s settings on their own page", async (key, path) => {
    const wrapper = await mountLinks();

    expect(
      wrapper.get(`[data-testid="player-settings-link-${key}"]`).attributes()
        .href,
    ).toBe(path);
  });

  it("reports the DSP the server has on record", async () => {
    apiMock.getDSPConfig.mockResolvedValue(dspConfig({ enabled: true }));

    const wrapper = await mountLinks();

    expect(dspState(wrapper)).toBe("on");
  });

  it("follows the DSP being switched on and off", async () => {
    const wrapper = await mountLinks();
    expect(dspState(wrapper)).toBe("off");

    dspConfigUpdated(true);
    await flushPromises();
    expect(dspState(wrapper)).toBe("on");

    dspConfigUpdated(false);
    await flushPromises();
    expect(dspState(wrapper)).toBe("off");
  });

  it("listens for the DSP of this player only", async () => {
    await mountLinks();

    expect(apiMock.subscribe).toHaveBeenCalledWith(
      EventType.PLAYER_DSP_CONFIG_UPDATED,
      expect.any(Function),
      "kitchen",
    );
  });
});

type LinksWrapper = Awaited<ReturnType<typeof mountLinks>>;

function rowLabels(wrapper: LinksWrapper): string[] {
  return wrapper.findAll("a").map((row) => row.get("div > div").text());
}

/**
 * The trailing state, which only the DSP row carries.
 */
function dspState(wrapper: LinksWrapper): string {
  return wrapper.get('[data-testid="player-settings-link-dsp"] span').text();
}

function dspConfig({ enabled = false }: { enabled?: boolean } = {}) {
  return { enabled, filters: [], input_gain: 0, output_gain: 0 };
}

/**
 * Deliver the DSP change the row keeps up with.
 */
function dspConfigUpdated(enabled: boolean) {
  for (const [eventType, callback] of apiMock.subscribe.mock.calls) {
    if (eventType === EventType.PLAYER_DSP_CONFIG_UPDATED) {
      callback({ data: dspConfig({ enabled }) });
    }
  }
}

async function mountLinks(playerId = "kitchen") {
  const wrapper = mount(PlayerSettingsLinks, {
    props: { playerId },
    global: {
      stubs: { RouterLink: RouterLinkStub },
    },
  });
  await flushPromises();
  return wrapper;
}
