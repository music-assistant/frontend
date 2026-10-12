import DetailHeroPlayButton from "@/components/details/DetailHeroPlayButton.vue";
import type { MediaItemType, Player } from "@/plugins/api/interfaces";
import { handlePlayBtnClick } from "@/helpers/media_item_actions";
import { mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { apiMock, storeMock } = vi.hoisted(() => ({
  apiMock: {
    players: {} as Record<string, Player>,
    queues: {},
  },
  storeMock: {
    activePlayer: undefined as Player | undefined,
    companionPlayerId: undefined as string | undefined,
  },
}));

vi.mock("@/plugins/api", () => ({ api: apiMock, default: apiMock }));
vi.mock("@/plugins/store", () => ({ store: storeMock }));
vi.mock("@/plugins/breakpoint", () => ({ isPhoneSizedScreen: () => false }));
vi.mock("@/helpers/media_item_actions", () => ({
  handlePlayBtnClick: vi.fn(),
}));
vi.mock("@/plugins/i18n", () => ({
  $t: (key: string, values?: Record<string, string>) =>
    values ? `${key}:${JSON.stringify(values)}` : key,
}));

const MenuButtonStub = {
  props: ["text"],
  emits: ["click"],
  template: "<button @click=\"$emit('click')\">{{ text }}</button>",
};

function player(overrides: Partial<Player> = {}): Player {
  return {
    player_id: "kitchen",
    name: "Kitchen",
    group_members: [],
    output_protocols: [],
    ...overrides,
  } as unknown as Player;
}

function mountButton() {
  return mount(DetailHeroPlayButton, {
    props: { item: {} as MediaItemType },
    global: { stubs: { MenuButton: MenuButtonStub } },
  });
}

describe("DetailHeroPlayButton", () => {
  beforeEach(() => {
    apiMock.players = {};
    storeMock.activePlayer = undefined;
    storeMock.companionPlayerId = undefined;
  });

  it("plays without naming a player when none is selected", () => {
    expect(mountButton().text()).toBe("play");
  });

  it("names the selected player", () => {
    storeMock.activePlayer = player();

    expect(mountButton().text()).toBe('play_on_player:{"player":"Kitchen"}');
  });

  it("names the selected player with the players synced to it", () => {
    apiMock.players = {
      office: player({ player_id: "office", available: true }),
    };
    storeMock.activePlayer = player({ group_members: ["kitchen", "office"] });

    expect(mountButton().text()).toBe('play_on_player:{"player":"Kitchen +1"}');
  });

  it("uses its own sentence for the player of this device", () => {
    apiMock.players = {
      office: player({ player_id: "office", available: true }),
    };
    storeMock.companionPlayerId = "kitchen";
    storeMock.activePlayer = player({ group_members: ["kitchen", "office"] });

    expect(mountButton().text()).toBe("play_on_this_device");
  });

  it("plays in the order of the list the page shows", async () => {
    const item = {} as MediaItemType;
    const wrapper = mount(DetailHeroPlayButton, {
      props: { item, sortBy: "position_desc" },
      global: { stubs: { MenuButton: MenuButtonStub } },
    });

    await wrapper.find("button").trigger("click");

    expect(handlePlayBtnClick).toHaveBeenCalledWith(
      item,
      0,
      0,
      undefined,
      false,
      "position_desc",
    );
  });
});
