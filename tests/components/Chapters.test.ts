import Chapters from "@/components/Chapters.vue";
import {
  EventType,
  MediaType,
  ProviderFeature,
  type Audiobook,
  type EventMessage,
  type MediaItemBookmark,
  type PodcastEpisode,
} from "@/plugins/api/interfaces";
import {
  eventbus,
  type DeleteConfirmationDialogEvent,
} from "@/plugins/eventbus";
import { flushPromises, mount, type VueWrapper } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createVuetify } from "vuetify";
import * as components from "vuetify/components";
import * as directives from "vuetify/directives";
import { providerInstance } from "../fixtures/providerInstance";
import { providerMapping } from "../fixtures/providerMapping";

const ABS = "audiobookshelf--1";
const AUDIBLE = "audible--1";
const LOCAL = "filesystem_local--1";

const { apiMock } = vi.hoisted(() => ({
  apiMock: {
    providers: {} as Record<string, unknown>,
    getBookmarks: vi.fn(),
    removeBookmark: vi.fn(),
    playMedia: vi.fn(),
    subscribe: vi.fn(
      (_event: EventType, _callback: (evt: EventMessage) => void) => () => {},
    ),
  },
}));

// the server's word that the user's bookmarks of a copy changed
async function bookmarksUpdated(
  provider_instance_id: string,
  provider_item_id: string,
) {
  for (const [event, callback] of apiMock.subscribe.mock.calls) {
    if (event !== EventType.BOOKMARKS_UPDATED) continue;
    callback({
      event,
      object_id: "",
      data: {
        media_type: MediaType.AUDIOBOOK,
        provider_instance_id,
        provider_item_id,
        user_id: "user1",
      },
    } as EventMessage);
  }
  await flushPromises();
}

vi.mock("@/plugins/api", () => ({ api: apiMock, default: apiMock }));
vi.mock("@/components/Toolbar.vue", () => ({
  default: {
    name: "Toolbar",
    props: ["title"],
    template: '<div class="toolbar">{{ title }}</div>',
  },
}));
vi.mock("@/components/ProviderIcon.vue", () => ({
  default: {
    name: "ProviderIcon",
    props: ["domain"],
    template: '<span class="provider">{{ domain }}</span>',
  },
}));
vi.mock("@/components/BookmarkDialog.vue", () => ({
  default: { name: "BookmarkDialog", template: "<div />" },
}));

const book = {
  item_id: "1",
  provider: "library",
  media_type: MediaType.AUDIOBOOK,
  uri: "library://audiobook/1",
  provider_mappings: [providerMapping({ provider_instance: LOCAL })],
  metadata: {
    chapters: [
      { position: 1, name: "First", start: 0, end: 60 },
      { position: 2, name: "Second", start: 60, end: 120 },
    ],
  },
} as unknown as Audiobook;

const episode = {
  ...book,
  item_id: "episode1",
  provider: ABS,
  media_type: MediaType.PODCAST_EPISODE,
  uri: "audiobookshelf--1://podcast_episode/episode1",
} as unknown as PodcastEpisode;

function bookmark(
  provider_instance_id: string,
  name: string,
  start: number,
  stored_by_music_assistant: boolean,
): MediaItemBookmark {
  return {
    name,
    start,
    provider_instance_id,
    provider_item_id: "book1",
    stored_by_music_assistant,
  };
}

async function mountChapters(
  bookmarks: MediaItemBookmark[],
  item: Audiobook | PodcastEpisode = book,
) {
  apiMock.getBookmarks.mockResolvedValue(bookmarks);
  const wrapper = mount(Chapters, {
    props: { itemDetails: item },
    global: {
      plugins: [createVuetify({ components, directives })],
      mocks: { $t: (key: string) => key },
    },
  });
  await flushPromises();
  return wrapper;
}

async function showTab(wrapper: VueWrapper, label: string) {
  await wrapper
    .findAll('[role="tab"]')
    .find((x) => x.text() === label)!
    .trigger("mousedown");
  await flushPromises();
}

const rowTexts = (wrapper: VueWrapper) =>
  wrapper
    .findAll(".v-list-item")
    .map((row) => [
      row.get(".v-list-item-title").text(),
      row.find(".v-list-item__append").exists()
        ? row.get(".v-list-item__append").text()
        : null,
    ]);

describe("Chapters", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiMock.providers = {
      [ABS]: providerInstance({
        domain: "audiobookshelf",
        instance_id: ABS,
        supported_features: [
          ProviderFeature.AUDIOBOOK_BOOKMARKS,
          ProviderFeature.AUDIOBOOK_BOOKMARKS_EDIT,
        ],
      }),
      [AUDIBLE]: providerInstance({
        domain: "audible",
        instance_id: AUDIBLE,
        supported_features: [ProviderFeature.AUDIOBOOK_BOOKMARKS],
      }),
      [LOCAL]: providerInstance({
        domain: "filesystem_local",
        instance_id: LOCAL,
      }),
    };
  });

  // a single tab says no more than the header, so there is none
  it.each([
    [book, [], "Chapters", []],
    [
      book,
      [bookmark(LOCAL, "Local file", 30, true)],
      "Chapters & Bookmarks",
      ["Chapters", "Bookmarks", "All"],
    ],
    [
      { ...book, metadata: {} },
      [bookmark(LOCAL, "Local file", 30, true)],
      "Bookmarks",
      [],
    ],
  ])(
    "names the list and its tabs after what it holds",
    async (item, bookmarks, title, tabs) => {
      const wrapper = await mountChapters(bookmarks, item as Audiobook);

      expect(wrapper.get(".toolbar").text()).toBe(title);
      expect(wrapper.findAll('[role="tab"]').map((x) => x.text())).toEqual(
        tabs,
      );
    },
  );

  // a position shows only where no chapter durations share the column
  it("lists the chapters first and the bookmarks with their position apart", async () => {
    const wrapper = await mountChapters([
      bookmark(LOCAL, "Later", 754, true),
      bookmark(ABS, "Earlier", 30, false),
    ]);
    expect(rowTexts(wrapper)).toEqual([
      ["First", "01:00"],
      ["Second", "01:00"],
    ]);

    await showTab(wrapper, "Bookmarks");

    expect(rowTexts(wrapper)).toEqual([
      ["Earlier", "00:30"],
      ["Later", "12:34"],
    ]);
  });

  // edits only where somebody can make them
  it("lists each bookmark under its chapter with where it is kept", async () => {
    const wrapper = await mountChapters([
      bookmark(LOCAL, "Local file", 100, true),
      bookmark(ABS, "On the provider", 30, false),
      bookmark(AUDIBLE, "Read only", 90, false),
      bookmark(AUDIBLE, "Kept by MA", 95, true),
    ]);
    await showTab(wrapper, "All");

    expect(
      wrapper.findAll(".v-list-item").map((row) => [
        row.get(".v-list-item-title").text(),
        row.find(".provider").exists()
          ? row.get(".provider").text()
          : row.find("img").exists()
            ? row.get("img").attributes("alt")
            : null,
        row.findAll(".v-list-item-title button").length,
        // a chapter shows its duration, a bookmark no time at all
        row.find(".v-list-item__append").exists()
          ? row.get(".v-list-item__append").text()
          : null,
      ]),
    ).toEqual([
      ["First", null, 0, "01:00"],
      ["On the provider", "audiobookshelf", 2, null],
      ["Second", null, 0, "01:00"],
      ["Read only", "audible", 0, null],
      ["Kept by MA", "Music Assistant", 2, null],
      ["Local file", "Music Assistant", 2, null],
    ]);
  });

  // an episode is played on its own, so its chapters start at a position too
  it.each([
    [book, "audiobookshelf--1://audiobook/book1", { start_item: "2" }],
    [
      episode,
      "audiobookshelf--1://podcast_episode/book1",
      { start_position: 60 },
    ],
  ])(
    "plays the copy the bookmark was made on, at its start",
    async (item, bookmarkUri, chapterOptions) => {
      const wrapper = await mountChapters(
        [bookmark(ABS, "Arrakis", 30, false)],
        item,
      );
      await showTab(wrapper, "All");

      await wrapper.findAll(".v-list-item")[1].trigger("click");
      await wrapper.findAll(".v-list-item")[2].trigger("click");

      expect(apiMock.getBookmarks).toHaveBeenCalledWith(
        item.media_type,
        item.item_id,
        item.provider,
      );
      expect(apiMock.playMedia.mock.calls).toEqual([
        [bookmarkUri, undefined, { start_position: 30 }],
        [item.uri, undefined, chapterOptions],
      ]);
    },
  );

  it("deletes only once confirmed, and follows changes made elsewhere", async () => {
    const wrapper = await mountChapters([
      bookmark(LOCAL, "Local file", 30, true),
    ]);
    const confirmations: DeleteConfirmationDialogEvent[] = [];
    const onConfirmation = (evt: DeleteConfirmationDialogEvent) =>
      confirmations.push(evt);
    eventbus.on("deleteConfirmationDialog", onConfirmation);
    await showTab(wrapper, "Bookmarks");

    await wrapper.findAll(".v-list-item-title button")[1].trigger("click");
    expect(apiMock.removeBookmark).not.toHaveBeenCalled();

    apiMock.getBookmarks.mockResolvedValue([]);
    await confirmations[0].onConfirm();
    await flushPromises();
    expect(apiMock.removeBookmark).toHaveBeenCalledWith(
      MediaType.AUDIOBOOK,
      LOCAL,
      "book1",
      30,
    );
    // the list follows the server's event, for a copy of this item only
    await bookmarksUpdated(ABS, "other-book");
    expect(rowTexts(wrapper)).toEqual([["Local file", "00:30"]]);
    await bookmarksUpdated(LOCAL, "item-1");
    // without bookmarks the chapters show, until some are back
    expect(rowTexts(wrapper)).toEqual([
      ["First", "01:00"],
      ["Second", "01:00"],
    ]);

    // e.g. a bookmark added in the full screen player or on another device
    apiMock.getBookmarks.mockResolvedValue([
      bookmark(LOCAL, "Added in the player", 30, true),
    ]);
    await bookmarksUpdated(LOCAL, "item-1");
    expect(rowTexts(wrapper)).toEqual([["Added in the player", "00:30"]]);

    eventbus.off("deleteConfirmationDialog", onConfirmation);
    wrapper.unmount();
  });

  // the episode page steps to the next item while the last one may still load
  it("keeps a late answer for the previous item off the next one", async () => {
    let answerFirst!: (bookmarks: MediaItemBookmark[]) => void;
    apiMock.getBookmarks.mockReturnValueOnce(
      new Promise<MediaItemBookmark[]>((resolve) => (answerFirst = resolve)),
    );
    const wrapper = await mountChapters(
      [bookmark(ABS, "Of the episode", 30, false)],
      { ...book, metadata: {} } as Audiobook,
    );
    expect(rowTexts(wrapper)).toEqual([]);

    await wrapper.setProps({ itemDetails: { ...episode, metadata: {} } });
    await flushPromises();
    expect(rowTexts(wrapper)).toEqual([["Of the episode", "00:30"]]);

    answerFirst([bookmark(LOCAL, "Of the book", 90, true)]);
    await flushPromises();
    expect(rowTexts(wrapper)).toEqual([["Of the episode", "00:30"]]);
  });
});
