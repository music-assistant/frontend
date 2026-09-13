import MediaRowList, {
  type Props,
} from "@/components/details/MediaRowList.vue";
import { MediaType, PlaybackState } from "@/plugins/api/interfaces";
import { mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { album } from "../../fixtures/album";
import { artist } from "../../fixtures/artist";
import { track } from "../../fixtures/track";

const {
  mockToggleFavorite,
  mockHandleMediaItemClick,
  mockHandleMenuBtnClick,
  mockItemIsAvailable,
  mockHasScope,
  storeMock,
} = vi.hoisted(() => ({
  mockToggleFavorite: vi.fn(),
  mockHasScope: vi.fn(() => true),
  mockHandleMediaItemClick: vi.fn(),
  mockHandleMenuBtnClick: vi.fn(),
  mockItemIsAvailable: vi.fn<(item: { item_id: string }) => boolean>(
    () => true,
  ),
  storeMock: {
    activePlayer: undefined as { playback_state: PlaybackState } | undefined,
    curQueueItem: undefined as { media_item: unknown } | undefined,
  },
}));

vi.mock("@/plugins/api", () => {
  const api = { toggleFavorite: mockToggleFavorite, providers: {} };
  return { api, default: api };
});

vi.mock("@/plugins/api/helpers", () => ({
  itemIsAvailable: mockItemIsAvailable,
}));

vi.mock("@/helpers/media_item_actions", () => ({
  handleMediaItemClick: mockHandleMediaItemClick,
  handleMenuBtnClick: mockHandleMenuBtnClick,
}));

vi.mock("@/plugins/store", () => ({ store: storeMock }));

vi.mock("@/plugins/auth", () => ({
  authManager: { hasScope: mockHasScope },
}));

// the subtitle and labels are translated in the component, so the keys are
// what the assertions read and they stay independent of en.json
vi.mock("@/plugins/i18n", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/plugins/i18n")>()),
  $t: (key: string) => key,
}));

vi.mock("@/components/MediaItemThumb.vue", () => ({
  default: {
    name: "MediaItemThumb",
    props: ["item"],
    template: '<img class="thumb" :alt="item.name" />',
  },
}));

const RouterLinkStub = {
  props: ["to"],
  template: '<a class="router-link"><slot /></a>',
};

const PARENT = track({ item_id: "parent", name: "Parent" });

const TRACKS = [
  track({
    item_id: "1",
    name: "One",
    artists: [artist({ name: "Vera Lund" })],
    duration: 125,
  }),
  track({ item_id: "2", name: "Two", version: "Live", duration: 61 }),
  track({ item_id: "3", name: "Three", favorite: true }),
];

function mountList(props: Partial<Props> = {}, slots = {}) {
  return mount(MediaRowList, {
    props: { title: "Appears on", ...props },
    slots,
    global: {
      directives: { hold: () => undefined },
      mocks: { $t: (key: string) => key },
      stubs: { RouterLink: RouterLinkStub },
    },
  });
}

describe("MediaRowList", () => {
  beforeEach(() => {
    mockToggleFavorite.mockClear();
    mockHandleMediaItemClick.mockClear();
    mockHandleMenuBtnClick.mockClear();
    mockItemIsAvailable.mockReset().mockReturnValue(true);
    storeMock.activePlayer = undefined;
    storeMock.curQueueItem = undefined;
  });

  it("renders a row per item with its name, artists and duration", () => {
    const wrapper = mountList({ items: TRACKS, meta: "3" });

    expect(wrapper.get("h2").text()).toBe("Appears on");
    expect(wrapper.get(".media-rows__meta").text()).toBe("3");
    const rows = wrapper.findAll(".media-rows__row[role=button]");
    expect(rows).toHaveLength(3);
    expect(rows[0].get(".media-rows__name").text()).toBe("One");
    expect(rows[0].get(".media-rows__subtitle").text()).toBe("Vera Lund");
    expect(rows[0].get(".media-rows__duration").text()).toBe("02:05");
    // the version follows the name, like the other track lists
    expect(rows[1].get(".media-rows__version").text()).toBe("(Live)");
  });

  it("describes a release by its type and year when it has no artists", () => {
    const wrapper = mountList({
      items: [album({ year: 2025 })],
    });
    expect(wrapper.get(".media-rows__subtitle").text()).toBe(
      "album_type.album · 2025",
    );
  });

  it("shows only the first `limit` rows", () => {
    const wrapper = mountList({ items: TRACKS, limit: 2 });
    expect(wrapper.findAll(".media-rows__row[role=button]")).toHaveLength(2);
  });

  it("shows skeleton rows while the items are still loading", () => {
    const wrapper = mountList({ items: undefined, skeletonCount: 4 });
    expect(wrapper.findAll(".media-rows__row[aria-hidden]")).toHaveLength(4);
    expect(wrapper.findAll(".thumb")).toHaveLength(0);
  });

  it("toggles the favorite through the api", async () => {
    const wrapper = mountList({ items: TRACKS, showFavorite: true });
    const hearts = wrapper.findAll("button[aria-label='tooltip.favorite']");
    expect(hearts).toHaveLength(3);
    expect(hearts[2].classes()).toContain("media-rows__button--favorite");
    expect(hearts[0].classes()).not.toContain("media-rows__button--favorite");

    await hearts[0].trigger("click");
    expect(mockToggleFavorite).toHaveBeenCalledWith(TRACKS[0]);
    // the heart must not also open the row
    expect(mockHandleMediaItemClick).not.toHaveBeenCalled();
  });

  it("has no heart buttons unless asked for", () => {
    const wrapper = mountList({ items: TRACKS });
    expect(wrapper.findAll("button[aria-label='tooltip.favorite']")).toEqual(
      [],
    );
  });

  it("hides the hearts from a role that cannot change the library", () => {
    mockHasScope.mockReturnValue(false);
    const wrapper = mountList({ items: TRACKS, showFavorite: true });
    expect(wrapper.findAll("button[aria-label='tooltip.favorite']")).toEqual(
      [],
    );
    mockHasScope.mockReturnValue(true);
  });

  it("opens the menu with the parent item from the menu button", async () => {
    const wrapper = mountList({ items: TRACKS, parentItem: PARENT });
    await wrapper
      .get("button[aria-label='more_options: Two']")
      .trigger("click");
    expect(mockHandleMenuBtnClick).toHaveBeenCalledWith(
      TRACKS[1],
      0,
      0,
      PARENT,
      true,
    );
    expect(mockHandleMediaItemClick).not.toHaveBeenCalled();
  });

  it("opens the item with the parent item when a row is clicked", async () => {
    const wrapper = mountList({ items: TRACKS, parentItem: PARENT });
    await wrapper.findAll(".media-rows__row[role=button]")[0].trigger("click");
    expect(mockHandleMediaItemClick).toHaveBeenCalledWith(
      TRACKS[0],
      0,
      0,
      PARENT,
    );
  });

  it("opens the item from the keyboard with Enter or Space", async () => {
    const wrapper = mountList({ items: TRACKS, parentItem: PARENT });
    const row = wrapper.findAll(".media-rows__row[role=button]")[0];
    await row.trigger("keydown", { key: "Enter" });
    await row.trigger("keydown", { key: " " });
    expect(mockHandleMediaItemClick).toHaveBeenCalledTimes(2);
    expect(mockHandleMediaItemClick).toHaveBeenLastCalledWith(
      TRACKS[0],
      0,
      0,
      PARENT,
    );
  });

  it("opens the menu with the parent item from a right click", async () => {
    const wrapper = mountList({ items: TRACKS, parentItem: PARENT });
    await wrapper
      .findAll(".media-rows__row[role=button]")[1]
      .trigger("contextmenu");
    expect(mockHandleMenuBtnClick).toHaveBeenCalledWith(
      TRACKS[1],
      0,
      0,
      PARENT,
      true,
    );
    expect(mockHandleMediaItemClick).not.toHaveBeenCalled();
  });

  it("links to the full listing only when given one", () => {
    const withLink = mountList({
      items: TRACKS,
      viewAllTo: { name: "tracklisting" },
    });
    expect(withLink.get(".router-link").text()).toBe("view_all");

    const withoutLink = mountList({ items: TRACKS });
    expect(withoutLink.find(".router-link").exists()).toBe(false);
  });

  it("dims the art of an unavailable item", () => {
    mockItemIsAvailable.mockImplementation((item) => item.item_id !== "2");
    const wrapper = mountList({ items: TRACKS });
    const arts = wrapper.findAll(".media-rows__art");
    expect(arts[1].classes()).toContain("media-rows__art--unavailable");
    expect(arts[0].classes()).not.toContain("media-rows__art--unavailable");
  });

  it("marks the track that is playing", () => {
    storeMock.activePlayer = { playback_state: PlaybackState.PLAYING };
    storeMock.curQueueItem = {
      media_item: { item_id: "3", media_type: MediaType.TRACK },
    };
    const wrapper = mountList({ items: TRACKS });
    const rows = wrapper.findAll(".media-rows__row[role=button]");
    expect(rows[2].classes()).toContain("media-rows__row--playing");
    expect(rows[0].classes()).not.toContain("media-rows__row--playing");
  });

  it("lets the consumer replace the subtitle and add a tag", () => {
    const wrapper = mountList(
      { items: TRACKS.slice(0, 1) },
      {
        subtitle: ({ item }: { item: { name: string } }) => `from ${item.name}`,
        tag: () => "FLAC 24/96",
      },
    );
    expect(wrapper.get(".media-rows__subtitle").text()).toBe("from One");
    expect(wrapper.get(".media-rows__tag").text()).toBe("FLAC 24/96");
  });
});
