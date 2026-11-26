import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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
import { store } from "@/plugins/store";
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

async function mountGenres(item: MediaItemType = artist(), genres = [ROCK]) {
  mockGetGenres.mockResolvedValue(genres);
  const wrapper = mount(DetailHeroGenres, {
    props: { item },
    attachTo: document.body,
    global: {
      mocks: {
        $t: (key: string, values?: { count: number }) =>
          values ? `${key}:${values.count}` : key,
      },
      directives: { hold },
    },
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

  // as on a native button: holding Space down must not open it over and over
  it("opens the genre when Space is released", async () => {
    const wrapper = await mountGenres();
    const name = wrapper.find(".detail-hero-genres__genre");

    await name.trigger("keydown", { key: " " });
    expect(handleMediaItemClick).not.toHaveBeenCalled();

    await name.trigger("keyup", { key: " " });
    expect(handleMediaItemClick).toHaveBeenCalledTimes(1);
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

  describe("past two lines", () => {
    const many = Array.from({ length: 20 }, (_, index) =>
      genre({ item_id: String(index), name: `Genre ${index}` }),
    );

    // jsdom lays nothing out, so the list reports itself taller than it shows
    beforeEach(() => {
      vi.spyOn(HTMLElement.prototype, "scrollHeight", "get").mockReturnValue(
        100,
      );
    });
    afterEach(() => vi.restoreAllMocks());

    async function openAll() {
      const wrapper = await mountGenres(artist(), many);
      await wrapper.find(".detail-hero-genres__all").trigger("click");
      await flushPromises();
      return wrapper;
    }
    const dialogGenres = () =>
      [...document.querySelectorAll(".detail-hero-genres-dialog__genre")].map(
        (button) => button.textContent?.trim(),
      );

    it("lists every genre in a dialog", async () => {
      const wrapper = await openAll();

      expect(wrapper.find(".detail-hero-genres__all").text()).toBe(
        "all_genres:20",
      );
      expect(dialogGenres()).toHaveLength(20);
      wrapper.unmount();
    });

    it("narrows the dialog to the genres matching the search", async () => {
      const wrapper = await openAll();
      const search = document.querySelector<HTMLInputElement>(
        "[role=dialog] input",
      )!;

      search.value = "genre 1";
      search.dispatchEvent(new Event("input"));
      await flushPromises();

      expect(dialogGenres()).toEqual([
        "Genre 1",
        ...Array.from({ length: 10 }, (_, index) => `Genre ${10 + index}`),
      ]);
      wrapper.unmount();
    });
    it("says so when no genre matches the search", async () => {
      const wrapper = await openAll();
      const search = document.querySelector<HTMLInputElement>(
        "[role=dialog] input",
      )!;

      search.value = "jazz";
      search.dispatchEvent(new Event("input"));
      await flushPromises();

      expect(dialogGenres()).toEqual([]);
      expect(
        document
          .querySelector("[role=dialog] [role=status]")
          ?.textContent?.trim(),
      ).toBe("No items found.");
      wrapper.unmount();
    });

    // the long press that opened a menu earlier must not eat a later pick
    it("opens a genre picked in the dialog after a long press", async () => {
      const wrapper = await mountGenres(artist(), many);
      await wrapper.find(".detail-hero-genres__genre").trigger("hold");
      await wrapper.find(".detail-hero-genres__all").trigger("click");
      await flushPromises();

      document
        .querySelector<HTMLButtonElement>(".detail-hero-genres-dialog__genre")!
        .click();

      expect(handleMediaItemClick).toHaveBeenCalledWith(
        expect.objectContaining({ item_id: "0" }),
        expect.any(Number),
        expect.any(Number),
      );
      wrapper.unmount();
    });

    // the app's back gesture and shortcuts hold off while a dialog is open
    it("marks a dialog open while it shows", async () => {
      store.dialogActive = false;
      const wrapper = await openAll();
      expect(store.dialogActive).toBe(true);

      document
        .querySelector<HTMLButtonElement>("[data-slot=dialog-close]")!
        .click();
      await flushPromises();
      expect(store.dialogActive).toBe(false);
      wrapper.unmount();
    });

    // music, podcasts and audiobooks each have their own genres
    it("tells apart the genres that share a name", async () => {
      const wrapper = await mountGenres(artist(), [
        ...many,
        genre({ item_id: "a", name: "History" }),
        genre({
          item_id: "b",
          name: "History",
          content_type: MediaType.PODCAST,
        }),
      ]);
      await wrapper.find(".detail-hero-genres__all").trigger("click");
      await flushPromises();

      expect(dialogGenres()).toContain("History · Music");
      expect(dialogGenres()).toContain("History · Podcasts");
      wrapper.unmount();
    });

    // the clamped names are out of sight, so they must be out of reach too
    it("takes the genres past the clamp out of the tab order", async () => {
      const LINE_HEIGHT = 10;
      vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue(
        new DOMRect(0, 0, 100, 2 * LINE_HEIGHT),
      );
      vi.spyOn(HTMLElement.prototype, "getClientRects").mockImplementation(
        function (this: HTMLElement) {
          const index = Number(this.textContent?.replace("Genre ", ""));
          // two genres on each line
          const top = Math.floor(index / 2) * LINE_HEIGHT;
          return [
            new DOMRect(0, top, 10, LINE_HEIGHT),
          ] as unknown as DOMRectList;
        },
      );
      const wrapper = await mountGenres(artist(), many);

      const reachable = wrapper
        .findAll(".detail-hero-genres__genre")
        .filter((name) => name.attributes("inert") === undefined);
      expect(reachable.map((name) => name.text())).toEqual([
        "Genre 0",
        "Genre 1",
        "Genre 2",
        "Genre 3",
      ]);
      wrapper.unmount();
    });
  });

  it("offers no full list when every genre fits", async () => {
    const wrapper = await mountGenres();

    expect(wrapper.find(".detail-hero-genres__all").exists()).toBe(false);
  });
});
