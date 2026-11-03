import {
  MediaType,
  ProviderFeature,
  type QueueItem,
} from "@/plugins/api/interfaces";
import { authManager } from "@/plugins/auth";
import { flushPromises, mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { defineComponent, nextTick, ref } from "vue";
import { toast } from "vue-sonner";
import { providerInstance } from "../../tests/fixtures/providerInstance";
import { BUILTIN_ROLE_SCOPES, scopeChecker } from "../../tests/fixtures/scopes";
import {
  newBookmarkOfPlayingItem,
  useBookmarkActions,
  useBookmarks,
  usePlayingPodcastLibraryCheck,
} from "./useBookmarks";

const ABS = "audiobookshelf--1";

const { apiMock, storeMock, elapsed } = vi.hoisted(() => ({
  apiMock: {
    providers: {} as Record<string, unknown>,
    getBookmarks: vi.fn(),
    getLibraryItem: vi.fn(),
    setBookmark: vi.fn(),
    subscribe: vi.fn(() => () => {}),
    subscribe_multi: vi.fn(() => () => {}),
    state: { value: "initialized" },
  },
  storeMock: { curQueueItem: undefined as unknown },
  elapsed: { value: 754.6 as number | undefined },
}));

vi.mock("@/plugins/api", () => ({
  api: apiMock,
  default: apiMock,
  ConnectionState: { INITIALIZED: "initialized" },
}));
vi.mock("vue-sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/plugins/auth", () => ({ authManager: { hasScope: vi.fn() } }));
vi.mock("@/plugins/store", () => ({ store: storeMock }));
vi.mock("@/helpers/activeElapsedTime", () => ({
  resolveActiveElapsedTime: () => elapsed.value,
}));

// runs a composable inside a mounted component, as it is used
const Harness = defineComponent({
  props: { setup: { type: Function, required: true } },
  setup(props) {
    props.setup();
    return () => null;
  },
});
const mountWith = (setup: () => void) => mount(Harness, { props: { setup } });

function playing(
  media_type: MediaType,
  streamdetails = true,
  inLibrary = true,
) {
  storeMock.curQueueItem = {
    // in the library, where Music Assistant keeps the bookmarks the provider does not
    media_item: {
      media_type,
      provider: inLibrary ? "library" : ABS,
      provider_mappings: [{ provider_instance: ABS, item_id: "book_1" }],
      podcast: { provider: inLibrary ? "library" : ABS },
    },
    streamdetails: streamdetails
      ? { provider: ABS, item_id: "book_1" }
      : undefined,
  } as unknown as QueueItem;
}

describe("newBookmarkOfPlayingItem", () => {
  beforeEach(() => {
    elapsed.value = 754.6;
    vi.mocked(authManager.hasScope).mockImplementation(
      scopeChecker(BUILTIN_ROLE_SCOPES.user),
    );
    apiMock.providers = {
      [ABS]: providerInstance({
        name: "Audiobookshelf",
        instance_id: ABS,
        supported_features: [ProviderFeature.AUDIOBOOK_BOOKMARKS_EDIT],
      }),
    };
  });

  // the provider keeps the bookmarks of the media types it can edit
  it.each([
    [MediaType.AUDIOBOOK, "Audiobookshelf"],
    [MediaType.PODCAST_EPISODE, "Music Assistant"],
  ])("takes the playing copy at the whole second", (mediaType, storedIn) => {
    playing(mediaType);

    expect(newBookmarkOfPlayingItem()).toEqual({
      mediaType,
      providerInstanceId: ABS,
      providerItemId: "book_1",
      storedIn,
      start: 754,
    });
  });

  it.each([
    ["a track", MediaType.TRACK, true, BUILTIN_ROLE_SCOPES.user],
    [
      "no copy chosen yet",
      MediaType.AUDIOBOOK,
      false,
      BUILTIN_ROLE_SCOPES.user,
    ],
    ["a guest", MediaType.AUDIOBOOK, true, BUILTIN_ROLE_SCOPES.guest],
  ])("takes none for %s", (_case, mediaType, streamdetails, scopes) => {
    vi.mocked(authManager.hasScope).mockImplementation(scopeChecker(scopes));
    playing(mediaType, streamdetails);

    expect(newBookmarkOfPlayingItem()).toBeUndefined();
  });

  it("takes none before the position is known, but one at zero", () => {
    playing(MediaType.AUDIOBOOK);

    elapsed.value = undefined;
    expect(newBookmarkOfPlayingItem()).toBeUndefined();
    elapsed.value = 0;
    expect(newBookmarkOfPlayingItem()?.start).toBe(0);
  });

  // a queued RSS episode refers to its podcast on the provider, also once it is in the library
  it.each([
    ["in the library", { item_id: "7" }, true],
    ["not in the library", null, false],
  ])(
    "looks up whether the episode's podcast is %s",
    async (_case, libraryPodcast, offered) => {
      const podcastId = `pod_${offered}`;
      storeMock.curQueueItem = {
        media_item: {
          media_type: MediaType.PODCAST_EPISODE,
          provider: ABS,
          provider_mappings: [],
          podcast: { provider: ABS, item_id: podcastId },
        },
        streamdetails: { provider: ABS, item_id: "episode_1" },
      } as unknown as QueueItem;
      apiMock.providers = {};
      apiMock.getLibraryItem.mockResolvedValue(libraryPodcast);
      mountWith(usePlayingPodcastLibraryCheck);
      // unknown until the library answers
      expect(newBookmarkOfPlayingItem()).toBeUndefined();

      await flushPromises();

      expect(apiMock.getLibraryItem).toHaveBeenCalledWith(
        MediaType.PODCAST,
        podcastId,
        ABS,
      );
      expect(newBookmarkOfPlayingItem()?.storedIn).toBe(
        offered ? "Music Assistant" : undefined,
      );
    },
  );

  // the answer is kept per podcast, until the library changes
  it("asks again once a podcast is added to the library", async () => {
    storeMock.curQueueItem = {
      media_item: {
        media_type: MediaType.PODCAST_EPISODE,
        provider: ABS,
        provider_mappings: [],
        podcast: { provider: ABS, item_id: "pod_added" },
      },
      streamdetails: { provider: ABS, item_id: "episode_1" },
    } as unknown as QueueItem;
    apiMock.providers = {};
    apiMock.subscribe_multi.mockClear();
    apiMock.getLibraryItem.mockResolvedValue(null);
    mountWith(usePlayingPodcastLibraryCheck);
    await flushPromises();
    expect(newBookmarkOfPlayingItem()).toBeUndefined();

    apiMock.getLibraryItem.mockResolvedValue({ item_id: "8" });
    const [, onLibraryChange] = apiMock.subscribe_multi.mock
      .calls[0] as unknown as [unknown, (evt: { data: unknown }) => void];
    onLibraryChange({ data: { media_type: MediaType.PODCAST } });
    await flushPromises();

    expect(newBookmarkOfPlayingItem()?.storedIn).toBe("Music Assistant");
  });

  // Music Assistant keeps them for library copies only, the server refuses others
  it("takes none Music Assistant would keep for a copy outside the library", () => {
    playing(MediaType.PODCAST_EPISODE, true, false);

    expect(newBookmarkOfPlayingItem()).toBeUndefined();
  });
});

const bookmark = (name: string) => ({
  name,
  start: 30,
  provider_instance: ABS,
  item_id: "book_1",
  stored_by_music_assistant: false,
});

describe("useBookmarks", () => {
  function mountBookmarks() {
    let result!: ReturnType<typeof useBookmarks>;
    mountWith(() => {
      result = useBookmarks(() => ({
        mediaType: MediaType.AUDIOBOOK,
        itemId: "1",
        provider: "library",
        uri: "library://audiobook/1",
        copyUris: [`${ABS}://audiobook/book_1`],
      }));
    });
    return result;
  }

  beforeEach(() => {
    apiMock.getBookmarks.mockReset();
    apiMock.subscribe.mockReset().mockReturnValue(() => {});
  });

  // e.g. the first load still in flight when a rename elsewhere reloads them
  it("keeps the newest answer when an older one arrives last", async () => {
    const answers: ((value: unknown) => void)[] = [];
    apiMock.getBookmarks.mockImplementation(
      () => new Promise((resolve) => answers.push(resolve)),
    );
    const { bookmarks } = mountBookmarks();
    const [, onUpdated] = apiMock.subscribe.mock.calls[0] as unknown as [
      unknown,
      (evt: { object_id: string }) => void,
    ];
    onUpdated({ object_id: `${ABS}://audiobook/book_1` });

    answers[1]([bookmark("Renamed")]);
    answers[0]([bookmark("Old name")]);
    await flushPromises();

    expect(bookmarks.value.map((x) => x.name)).toEqual(["Renamed"]);
  });

  it("reloads them once the connection is back", async () => {
    const state = ref("initialized");
    apiMock.state = state;
    apiMock.getBookmarks.mockResolvedValue([]);
    mountBookmarks();
    await flushPromises();
    expect(apiMock.getBookmarks).toHaveBeenCalledTimes(1);

    state.value = "disconnected";
    await nextTick();
    state.value = "initialized";
    await flushPromises();

    expect(apiMock.getBookmarks).toHaveBeenCalledTimes(2);
  });
});

describe("useBookmarkActions", () => {
  // the full screen queue may move to another item while the dialog is open
  it("renames with the media type of when the dialog opened", async () => {
    apiMock.setBookmark.mockResolvedValue(undefined);
    let mediaType = MediaType.AUDIOBOOK;
    const actions = useBookmarkActions(() => mediaType);

    actions.renameClicked(bookmark("Old name"));
    mediaType = MediaType.TRACK;
    await actions.renameSaved("New name");

    expect(apiMock.setBookmark).toHaveBeenCalledWith(
      MediaType.AUDIOBOOK,
      ABS,
      "book_1",
      30,
      "New name",
    );
  });

  it("says so, and why, when the rename fails", async () => {
    apiMock.setBookmark.mockRejectedValue(new Error("offline"));
    const actions = useBookmarkActions(() => MediaType.AUDIOBOOK);

    actions.renameClicked(bookmark("Old name"));
    await actions.renameSaved("New name");

    // with the server's reason, e.g. an account only its owner may write to
    expect(toast.error).toHaveBeenCalledWith("Could not rename the bookmark", {
      description: "offline",
    });
  });
});
