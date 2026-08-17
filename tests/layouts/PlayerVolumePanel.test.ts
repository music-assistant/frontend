import PlayerVolume from "@/layouts/default/PlayerOSD/PlayerVolume.vue";
import PlayerVolumePanel from "@/layouts/default/PlayerOSD/PlayerVolumePanel.vue";
import type { Player } from "@/plugins/api/interfaces";
import { store } from "@/plugins/store";
import { shallowMount, type VueWrapper } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { isPlayerGrouped } = vi.hoisted(() => ({
  isPlayerGrouped: vi.fn(() => true),
}));

vi.mock("@/plugins/api", async () => {
  const { reactive } = await vi.importActual<typeof import("vue")>("vue");
  const api = reactive({ players: {} as Record<string, Player> });
  return { api, default: api };
});

vi.mock("@/plugins/store", async () => {
  const { reactive } = await vi.importActual<typeof import("vue")>("vue");
  return { store: reactive({ mobileLayout: false }) };
});

vi.mock("@/helpers/players", () => ({ isPlayerGrouped }));

vi.mock("@/helpers/utils", () => ({
  getPlayerName: (player: Player) => player.name,
}));

const mockStore = store as unknown as { mobileLayout: boolean };

function createPlayer(overrides: Partial<Player> = {}): Player {
  return {
    player_id: "parent",
    name: "Kitchen",
    available: true,
    volume_control: "volume",
    group_members: ["parent", "child"],
    ...overrides,
  } as Player;
}

let wrapper: VueWrapper | undefined;

async function mountPanel(mobileLayout: boolean) {
  const { api } = await import("@/plugins/api");
  const parent = createPlayer();
  api.players = {
    parent,
    child: createPlayer({ player_id: "child", name: "Office" }),
  };
  mockStore.mobileLayout = mobileLayout;
  wrapper = shallowMount(PlayerVolumePanel, {
    props: { player: parent },
    global: { mocks: { $t: (key: string) => key } },
  });
  return wrapper;
}

describe("PlayerVolumePanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isPlayerGrouped.mockReturnValue(true);
  });

  afterEach(() => {
    wrapper?.unmount();
    wrapper = undefined;
  });

  it.each([
    { mobileLayout: true, expandOnTouch: true },
    { mobileLayout: false, expandOnTouch: false },
  ])(
    "grows its rows on touch when mobileLayout is $mobileLayout",
    async ({ mobileLayout, expandOnTouch }) => {
      // the same panel backs the desktop volume popout, where a pointer has no
      // trouble with the resting rail
      const panel = await mountPanel(mobileLayout);
      const sliders = panel.findAllComponents(PlayerVolume);

      expect(sliders.length).toBeGreaterThan(1);
      for (const slider of sliders) {
        expect(slider.props("expandOnTouch")).toBe(expandOnTouch);
      }
    },
  );

  it("covers the child rows as well as the grouped row", async () => {
    const panel = await mountPanel(true);
    const sliders = panel.findAllComponents(PlayerVolume);

    // the last slider is the grouped one; everything before it is a child
    expect(sliders).toHaveLength(3);
    expect(sliders.at(-1)!.props("preferGroupVolume")).toBe(true);
    expect(sliders.at(0)!.props("preferGroupVolume")).toBe(false);
  });
});
