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
// jsdom does no layout, so the probe measures 0px wide: any room fits it
const row = vi.hoisted(() => ({ room: 0 }));
vi.mock("@/helpers/room_in_row", () => ({ roomInRow: () => row.room }));
vi.mock("@/helpers/media_item_actions", () => ({
  handlePlayBtnClick: vi.fn(),
}));
vi.mock("@/plugins/i18n", () => ({
  $t: (key: string, values?: Record<string, string>) =>
    values ? `${key}:${JSON.stringify(values)}` : key,
}));

const MenuButtonStub = {
  props: { text: String, label: String, truncate: Boolean },
  template:
    '<button :label="label" :data-truncate="String(truncate)">{{ text }}</button>',
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

/** The button people see; the other one only measures the sentence. */
const visible = (wrapper: ReturnType<typeof mountButton>) =>
  wrapper.findAll("button")[0];

describe("DetailHeroPlayButton", () => {
  beforeEach(() => {
    apiMock.players = {};
    storeMock.activePlayer = undefined;
    storeMock.companionPlayerId = undefined;
    row.room = 0;
  });

  it("plays without naming a player when none is selected", () => {
    expect(visible(mountButton()).text()).toBe("play");
  });

  it("names the selected player when the sentence fits", () => {
    storeMock.activePlayer = player();

    expect(visible(mountButton()).text()).toBe(
      'play_on_player:{"player":"Kitchen"}',
    );
  });

  it("names the selected player with the players synced to it", () => {
    apiMock.players = {
      office: player({ player_id: "office", available: true }),
    };
    storeMock.activePlayer = player({ group_members: ["kitchen", "office"] });

    expect(visible(mountButton()).text()).toBe(
      'play_on_player:{"player":"Kitchen +1"}',
    );
  });

  it("uses its own sentence for the player of this device", () => {
    storeMock.companionPlayerId = "kitchen";
    storeMock.activePlayer = player();

    expect(visible(mountButton()).text()).toBe("play_on_this_device");
  });

  it("keeps a long player's name whole in the sentence", () => {
    storeMock.activePlayer = player({ name: "Kitchen ceiling speaker left" });

    expect(visible(mountButton()).text()).toBe(
      'play_on_player:{"player":"Kitchen ceiling speaker left"}',
    );
  });

  it("shows only the player's name when the row has no room for the sentence", async () => {
    row.room = -1;
    storeMock.activePlayer = player({ name: "Kitchen ceiling speaker left" });
    const wrapper = mountButton();
    await wrapper.vm.$nextTick();

    expect(visible(wrapper).text()).toBe("Kitchen ceiling speaker left");
    // the whole sentence stays for screen readers and the tooltip
    expect(visible(wrapper).attributes("label")).toBe(
      'play_on_player:{"player":"Kitchen ceiling speaker left"}',
    );
  });

  it("calls the player of this device by that name when space is short", async () => {
    row.room = -1;
    storeMock.companionPlayerId = "kitchen";
    storeMock.activePlayer = player();
    const wrapper = mountButton();
    await wrapper.vm.$nextTick();

    expect(visible(wrapper).text()).toBe("this_device");
  });

  it("holds the button to the room the row leaves it", async () => {
    row.room = 180;
    storeMock.activePlayer = player();
    const wrapper = mountButton();
    await wrapper.vm.$nextTick();

    expect(wrapper.get("div").attributes("style")).toContain(
      "max-width: 180px",
    );
  });

  it("measures the sentence with the same sizing as the button people see", () => {
    const buttons = mountButton().findAll("button");

    expect(buttons[0].attributes("data-truncate")).toBe("true");
    expect(buttons[1].attributes("data-truncate")).toBe("true");
  });
});
