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
    getPlayerSettingsSections.mockReturnValue(sections());
  });

  it("lists a row for every section the player has", async () => {
    const wrapper = await mountLinks();

    expect(rowLabels(wrapper)).toEqual([
      "settings.playback.title",
      "settings.category.dsp",
      "settings.category.options",
      "settings.category.protocol_settings",
      "settings.category.player_controls",
    ]);
  });

  it("leaves out the sections the player has nothing to show for", async () => {
    getPlayerSettingsSections.mockReturnValue(
      sections({ queue: false, options: false }),
    );

    const wrapper = await mountLinks({ hasControls: false });

    expect(rowLabels(wrapper)).toEqual([
      "settings.category.dsp",
      "settings.category.protocol_settings",
    ]);
  });

  it("renders nothing when the player has no other settings", async () => {
    getPlayerSettingsSections.mockReturnValue(
      sections({ queue: false, dsp: false, options: false }),
    );

    const wrapper = await mountLinks({ hasOutputs: false, hasControls: false });

    expect(wrapper.find("a").exists()).toBe(false);
  });

  it.each([
    ["queue", "/settings/editqueue/kitchen"],
    ["dsp", "/settings/editplayer/kitchen/dsp"],
    ["options", "/settings/editplayer/kitchen/options"],
    ["outputs", "/settings/editplayer/kitchen/outputs"],
    ["controls", "/settings/editplayer/kitchen/controls"],
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
type Sections = ReturnType<typeof readPlayerSettingsSections>;

/**
 * The sections of a player that has every one of them, but for the given ones.
 */
function sections(overrides: Partial<Sections> = {}): Sections {
  return {
    player: true,
    queue: true,
    dsp: true,
    options: true,
    ...overrides,
  };
}

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

/**
 * Mount the rows of a player whose outputs and player controls have entries to show,
 * but for the given ones.
 */
async function mountLinks({ hasOutputs = true, hasControls = true } = {}) {
  const wrapper = mount(PlayerSettingsLinks, {
    props: { playerId: "kitchen", hasOutputs, hasControls },
    global: {
      stubs: { RouterLink: RouterLinkStub },
    },
  });
  await flushPromises();
  return wrapper;
}
