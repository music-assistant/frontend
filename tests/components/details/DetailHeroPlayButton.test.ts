import DetailHeroPlayButton from "@/components/details/DetailHeroPlayButton.vue";
import type { MediaItemType, Player } from "@/plugins/api/interfaces";
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
const screen = vi.hoisted(() => ({ isPhone: false }));
vi.mock("@/plugins/breakpoint", () => ({
  isPhoneSizedScreen: () => screen.isPhone,
}));
vi.mock("@/helpers/media_item_actions", () => ({
  handlePlayBtnClick: vi.fn(),
}));
vi.mock("@/plugins/i18n", () => ({
  $t: (key: string, values?: Record<string, string>) =>
    values ? `${key}:${JSON.stringify(values)}` : key,
}));

const MenuButtonStub = {
  props: ["text", "label"],
  template: '<button :label="label">{{ text }}</button>',
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
    screen.isPhone = false;
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

  it("shows only the player's name on a phone", () => {
    screen.isPhone = true;
    storeMock.activePlayer = player({ name: "Kitchen speaker" });

    const button = mountButton();
    expect(button.text()).toBe("Kitchen speaker");
    // the whole sentence stays for screen readers and the tooltip
    expect(button.find("button").attributes("label")).toBe(
      'play_on_player:{"player":"Kitchen speaker"}',
    );
  });

  it("calls the player of this device by that name on a phone", () => {
    screen.isPhone = true;
    storeMock.companionPlayerId = "kitchen";
    storeMock.activePlayer = player();

    expect(mountButton().text()).toBe("this_device");
  });

  it("still just plays on a phone without a player", () => {
    screen.isPhone = true;
    expect(mountButton().text()).toBe("play");
  });
});
