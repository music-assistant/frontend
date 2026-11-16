import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetGenres, mockExcludeGenre, mockHasScope } = vi.hoisted(() => ({
  mockGetGenres: vi.fn(),
  mockExcludeGenre: vi.fn(),
  mockHasScope: vi.fn(),
}));

vi.mock("@/plugins/api", () => ({
  api: {
    getGenresForMediaItem: mockGetGenres,
    excludeGenreFromItem: mockExcludeGenre,
  },
}));

vi.mock("@/plugins/auth", () => ({
  authManager: { hasScope: mockHasScope },
}));

// the click handler reaches for the app-wide item menu, which drags in the
// router and the whole context menu
vi.mock("@/helpers/media_item_actions", () => ({
  handleMediaItemClick: vi.fn(),
}));

import DetailHeroGenres from "@/components/details/DetailHeroGenres.vue";
import { handleMediaItemClick } from "@/helpers/media_item_actions";
import { MediaType, type MediaItemType } from "@/plugins/api/interfaces";
import { eventbus, type ContextMenuDialogEvent } from "@/plugins/eventbus";
import { flushPromises, mount } from "@vue/test-utils";
import type { DirectiveBinding } from "vue";
import { artist } from "../../fixtures/artist";
import { genre } from "../../fixtures/genre";

const ROCK = genre({ item_id: "7", name: "Rock" });

// stands in for the app's long-press directive, which is registered by a
// plugin the test skips: a "hold" event is the finger held down
const hold = {
  mounted(el: HTMLElement, binding: DirectiveBinding<(evt: Event) => void>) {
    el.addEventListener("hold", binding.value);
  },
};

async function mountGenres(item: MediaItemType = artist()) {
  mockGetGenres.mockResolvedValue([ROCK]);
  const wrapper = mount(DetailHeroGenres, {
    props: { item },
    global: { mocks: { $t: (key: string) => key }, directives: { hold } },
  });
  await flushPromises();
  return wrapper;
}

/** The menus opened through the app-wide context menu event. */
function openedMenus() {
  const menus: ContextMenuDialogEvent[] = [];
  eventbus.on("contextmenu", (event) => menus.push(event));
  return menus;
}

describe("DetailHeroGenres", () => {
  beforeEach(() => {
    eventbus.all.clear();
    mockGetGenres.mockReset();
    mockExcludeGenre.mockReset();
    mockExcludeGenre.mockResolvedValue(undefined);
    mockHasScope.mockReturnValue(true);
    vi.mocked(handleMediaItemClick).mockClear();
  });

  it("offers to exclude the genre from the item", async () => {
    const menus = openedMenus();
    const wrapper = await mountGenres();

    await wrapper.find(".detail-hero-genres__genre").trigger("contextmenu");

    expect(menus).toHaveLength(1);
    expect(menus[0].items.map((item) => item.label)).toEqual(["exclude_genre"]);
  });

  it("drops the genre it excluded", async () => {
    const menus = openedMenus();
    const excluded = vi.fn();
    eventbus.on("genreExcluded", excluded);
    const wrapper = await mountGenres();

    await wrapper.find(".detail-hero-genres__genre").trigger("contextmenu");
    await menus[0].items[0].action?.();
    await flushPromises();

    expect(mockExcludeGenre).toHaveBeenCalledWith("7", MediaType.ARTIST, "1");
    expect(wrapper.find(".detail-hero-genres__genre").exists()).toBe(false);
    expect(excluded).toHaveBeenCalled();
  });

  // on touch there is no contextmenu event: the menu comes from the long-press,
  // and the click the lifted finger fires must not also open the genre
  it("opens the menu on a long press instead of the genre", async () => {
    const menus = openedMenus();
    const wrapper = await mountGenres();
    const chip = wrapper.find(".detail-hero-genres__genre");

    await chip.trigger("hold");
    await chip.trigger("click");

    expect(menus).toHaveLength(1);
    expect(handleMediaItemClick).not.toHaveBeenCalled();
  });

  it("opens the genre on a plain click", async () => {
    const wrapper = await mountGenres();

    await wrapper.find(".detail-hero-genres__genre").trigger("click");

    expect(handleMediaItemClick).toHaveBeenCalledWith(
      expect.objectContaining({ item_id: "7" }),
      expect.any(Number),
      expect.any(Number),
    );
  });

  it("opens no menu for a role that cannot manage the library", async () => {
    mockHasScope.mockReturnValue(false);
    const menus = openedMenus();
    const wrapper = await mountGenres();

    await wrapper.find(".detail-hero-genres__genre").trigger("contextmenu");

    expect(menus).toHaveLength(0);
  });

  // the genres of a provider item are not the library's to change
  it("opens no menu for an item outside the library", async () => {
    const menus = openedMenus();
    const wrapper = await mountGenres(artist({ provider: "spotify--1" }));

    await wrapper.find(".detail-hero-genres__genre").trigger("contextmenu");

    expect(menus).toHaveLength(0);
  });
});
