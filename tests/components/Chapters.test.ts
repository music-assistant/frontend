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
import { authManager } from "@/plugins/auth";
import { flushPromises, mount, type VueWrapper } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "vue-sonner";
import { createVuetify } from "vuetify";
import * as components from "vuetify/components";
import * as directives from "vuetify/directives";
import { providerInstance } from "../fixtures/providerInstance";
import { providerMapping } from "../fixtures/providerMapping";
import { BUILTIN_ROLE_SCOPES, scopeChecker } from "../fixtures/scopes";

const ABS = "audiobookshelf--1";
const AUDIBLE = "audible--1";
const LOCAL = "filesystem_local--1";

const { apiMock } = vi.hoisted(() => ({
  apiMock: {
    providers: {} as Record<string, unknown>,
    getBookmarks: vi.fn(),
    removeBookmark: vi.fn(),
    setBookmark: vi.fn(),
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
      object_id: `${provider_instance_id}://audiobook/${provider_item_id}`,
      data: "user1",
    } as EventMessage);
  }
  await flushPromises();
}

vi.mock("@/plugins/api", () => ({ api: apiMock, default: apiMock }));
vi.mock("@/plugins/auth", () => ({ authManager: { hasScope: vi.fn() } }));
vi.mock("vue-sonner", () => ({ toast: { success: vi.fn() } }));
vi.mock("@/components/BookmarkDialog.vue", () => ({
  default: {
    name: "BookmarkDialog",
    props: ["open", "title", "initialName", "storedIn"],
    emits: ["save", "update:open"],
    template: "<div />",
  },
}));
vi.mock("@/components/details/DetailSectionTitle.vue", () => ({
  default: {
    name: "DetailSectionTitle",
    props: ["title"],
    template: '<h2 class="section-title">{{ title }}</h2>',
  },
}));
// the row menu rendered in place, so its items can be clicked
vi.mock("@/components/ui/dropdown-menu", () => {
  const passthrough = { template: "<div><slot /></div>" };
  return {
    DropdownMenu: passthrough,
    DropdownMenuTrigger: passthrough,
    DropdownMenuContent: passthrough,
    DropdownMenuSeparator: passthrough,
    DropdownMenuItem: {
      emits: ["click"],
      template:
        '<button type="button" @click="$emit(\'click\')"><slot /></button>',
    },
  };
});

const book = {
  item_id: "1",
  provider: "library",
  media_type: MediaType.AUDIOBOOK,
  uri: "library://audiobook/1",
  provider_mappings: [
    providerMapping({ provider_instance: LOCAL }),
    // the copy the provider's bookmarks are made on
    providerMapping({ provider_instance: ABS, item_id: "book1" }),
  ],
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
  provider_instance: string,
  name: string,
  start: number,
  stored_by_music_assistant: boolean,
): MediaItemBookmark {
  return {
    name,
    start,
    provider_instance,
    item_id: "book1",
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

// chapters and bookmarks in the order they show
const listRows = (wrapper: VueWrapper) =>
  wrapper.findAll('[data-testid="chapter-row"], [data-testid="bookmark-row"]');

const isBookmark = (row: ReturnType<typeof listRows>[number]) =>
  row.attributes("data-testid") === "bookmark-row";

// a chapter with its duration, a bookmark with its position
const rowTexts = (wrapper: VueWrapper) =>
  listRows(wrapper).map((row) =>
    isBookmark(row)
      ? [
          row.get('[data-testid="bookmark-name"]').text(),
          row.get('[data-testid="bookmark-position"]').text(),
        ]
      : [
          row.get('[data-testid="chapter-name"]').text(),
          row.find('[data-testid="chapter-duration"]').exists()
            ? row.get('[data-testid="chapter-duration"]').text()
            : null,
        ],
  );

describe("Chapters", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(authManager.hasScope).mockImplementation(
      scopeChecker(BUILTIN_ROLE_SCOPES.user),
    );
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

      expect(wrapper.get(".section-title").text()).toBe(title);
      expect(wrapper.findAll('[role="tab"]').map((x) => x.text())).toEqual(
        tabs,
      );
    },
  );

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

  // edits only where somebody can make them, a guest makes none
  it.each([
    [BUILTIN_ROLE_SCOPES.user, 2],
    [BUILTIN_ROLE_SCOPES.guest, 0],
  ])(
    "lists each bookmark under its chapter, editable where it is kept",
    async (scopes, editButtons) => {
      vi.mocked(authManager.hasScope).mockImplementation(scopeChecker(scopes));
      const wrapper = await mountChapters([
        bookmark(LOCAL, "Local file", 100, true),
        bookmark(ABS, "On the provider", 30, false),
        bookmark(AUDIBLE, "Read only", 90, false),
        bookmark(AUDIBLE, "Kept by MA", 95, true),
      ]);
      await showTab(wrapper, "All");

      expect(
        listRows(wrapper).map((row) =>
          isBookmark(row)
            ? [
                row.get('[data-testid="bookmark-name"]').text(),
                row.findAll(
                  '[data-testid="bookmark-rename"], [data-testid="bookmark-delete"]',
                ).length,
                row.get('[data-testid="bookmark-position"]').text(),
              ]
            : [row.get('[data-testid="chapter-name"]').text(), 0, null],
        ),
      ).toEqual([
        ["First", 0, null],
        ["On the provider", editButtons, "00:30"],
        ["Second", 0, null],
        ["Read only", 0, "01:30"],
        ["Kept by MA", editButtons, "01:35"],
        ["Local file", editButtons, "01:40"],
      ]);
    },
  );

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

      await wrapper.get('[data-testid="bookmark-play"]').trigger("click");
      await wrapper.findAll('[data-testid="chapter-row"]')[1].trigger("click");

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

    await wrapper.get('[data-testid="bookmark-delete"]').trigger("click");
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
    expect(toast.success).toHaveBeenCalledWith("Bookmark deleted");
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

  it("renames a bookmark in a dialog that says where it is kept", async () => {
    const wrapper = await mountChapters([
      bookmark(ABS, "On the provider", 30, false),
    ]);
    await showTab(wrapper, "Bookmarks");
    const dialog = () => wrapper.findComponent({ name: "BookmarkDialog" });
    expect(dialog().props("open")).toBe(false);

    await wrapper.get('[data-testid="bookmark-rename"]').trigger("click");
    expect(dialog().props()).toMatchObject({
      open: true,
      initialName: "On the provider",
      // the provider's name, as the user knows it
      storedIn: (apiMock.providers[ABS] as { name: string }).name,
    });

    dialog().vm.$emit("save", "Renamed");
    await flushPromises();
    expect(apiMock.setBookmark).toHaveBeenCalledWith(
      MediaType.AUDIOBOOK,
      ABS,
      "book1",
      30,
      "Renamed",
    );
    expect(toast.success).toHaveBeenCalledWith("Bookmark renamed");
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
