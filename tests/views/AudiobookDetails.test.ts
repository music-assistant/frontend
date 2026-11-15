import type { MusicAssistantApi } from "@/plugins/api";
import {
  EventType,
  MediaType,
  type Audiobook,
  type EventMessage,
} from "@/plugins/api/interfaces";
import AudiobookDetails from "@/views/AudiobookDetails.vue";
import { flushPromises, mount, type VueWrapper } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { audiobook } from "../fixtures/audiobook";

const { getAudiobook, subscribe, storeMock } = vi.hoisted(() => ({
  getAudiobook: vi.fn<MusicAssistantApi["getAudiobook"]>(),
  subscribe:
    vi.fn<
      (event: EventType, callback: (event: EventMessage) => void) => () => void
    >(),
  storeMock: {
    currentUser: { user_id: "me", preferences: {} as Record<string, unknown> },
  },
}));
vi.mock("@/plugins/api", () => ({ api: { getAudiobook, subscribe } }));
vi.mock("@/plugins/store", () => ({ store: storeMock }));
vi.mock("@/components/audiobook/AudiobookHero.vue", () => ({
  default: {
    name: "AudiobookHero",
    props: ["item"],
    emits: ["edit-rows"],
    template: "<div />",
  },
}));
vi.mock("@/components/Chapters.vue", () => ({
  default: {
    name: "Chapters",
    props: ["itemDetails"],
    template: '<div data-row="chapters" />',
  },
}));
vi.mock("@/components/details/DetailAdminCard.vue", () => ({
  default: { template: '<div data-row="provider_mappings"><slot /></div>' },
}));
vi.mock("@/components/ProviderDetails.vue", () => ({
  default: {
    name: "ProviderDetails",
    props: ["itemDetails"],
    template: "<div />",
  },
}));
vi.mock("@/components/details/DetailTextRow.vue", () => ({
  default: {
    name: "DetailTextRow",
    emits: ["edit-rows"],
    template: '<div data-row="about" />',
  },
}));
vi.mock("@/components/details/RowsEditor.vue", () => ({
  default: {
    name: "RowsEditor",
    props: ["open", "availableIds", "registry", "subtitle"],
    emits: ["update:open"],
    template: "<div />",
  },
}));

const book = audiobook({
  metadata: {
    description: "Description",
    chapters: [{ position: 1, name: "Chapter", start: 0, end: 300 }],
  },
});
const wrappers: VueWrapper[] = [];
const listeners = new Map<EventType, (event: EventMessage) => void>();
const unsubs: ReturnType<typeof vi.fn>[] = [];

async function mountDetails() {
  const wrapper = mount(AudiobookDetails, {
    props: { itemId: "1", provider: "library" },
    global: { mocks: { $t: (key: string) => key } },
  });
  wrappers.push(wrapper);
  await flushPromises();
  return wrapper;
}

function shownBook(wrapper: VueWrapper): Audiobook | undefined {
  return wrapper.findComponent({ name: "AudiobookHero" }).props("item");
}
function rows(wrapper: VueWrapper) {
  return wrapper.findAll("[data-row]").map((row) => row.attributes("data-row"));
}
function playlog(overrides: Record<string, unknown> = {}) {
  listeners.get(EventType.PLAYLOG_UPDATED)!({
    data: {
      uri: book.uri,
      media_type: MediaType.AUDIOBOOK,
      fully_played: false,
      seconds_played: 900,
      userid: "me",
      ...overrides,
    },
  } as EventMessage);
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => (resolve = res));
  return { promise, resolve };
}

describe("AudiobookDetails", () => {
  beforeEach(() => {
    getAudiobook.mockReset().mockResolvedValue(book);
    storeMock.currentUser.preferences = {};
    listeners.clear();
    unsubs.length = 0;
    subscribe.mockReset().mockImplementation((event, callback) => {
      listeners.set(event as EventType, callback);
      const unsub = vi.fn();
      unsubs.push(unsub);
      return unsub;
    });
  });
  afterEach(() => {
    for (const wrapper of wrappers.splice(0)) wrapper.unmount();
    vi.useRealTimers();
  });

  it("renders default rows and reuses the existing chapters component", async () => {
    const wrapper = await mountDetails();
    expect(rows(wrapper)).toEqual(["about", "chapters", "provider_mappings"]);
    expect(
      wrapper.findComponent({ name: "Chapters" }).props("itemDetails"),
    ).toEqual(book);
  });

  it("follows saved row visibility and ordering", async () => {
    storeMock.currentUser.preferences["audiobook.rows"] = {
      hidden: ["about"],
      order: ["provider_mappings", "chapters", "about"],
    };
    expect(rows(await mountDetails())).toEqual([
      "provider_mappings",
      "chapters",
    ]);
  });

  it("mounts chapters for bookmarks even without chapter metadata", async () => {
    const bookWithoutChapters = audiobook();
    getAudiobook.mockResolvedValue(bookWithoutChapters);
    const wrapper = await mountDetails();
    expect(rows(wrapper)).toEqual(["chapters", "provider_mappings"]);
    expect(
      wrapper.findComponent({ name: "Chapters" }).props("itemDetails"),
    ).toEqual(bookWithoutChapters);
    expect(
      wrapper.findComponent({ name: "RowsEditor" }).props("availableIds"),
    ).toEqual(["about", "chapters", "provider_mappings"]);
  });

  it("does not mount chapters and bookmarks when their row is hidden", async () => {
    storeMock.currentUser.preferences["audiobook.rows"] = {
      hidden: ["chapters"],
    };
    const wrapper = await mountDetails();
    expect(wrapper.findComponent({ name: "Chapters" }).exists()).toBe(false);
    expect(rows(wrapper)).toEqual(["about", "provider_mappings"]);
  });

  it("keeps the existing copyright fallback when no description is available", async () => {
    getAudiobook.mockResolvedValue(
      audiobook({ metadata: { copyright: "Copyright" } }),
    );
    expect(rows(await mountDetails())).toEqual([
      "about",
      "chapters",
      "provider_mappings",
    ]);
  });

  it("opens the editor from the hero and description", async () => {
    const wrapper = await mountDetails();
    const editor = wrapper.findComponent({ name: "RowsEditor" });
    wrapper.findComponent({ name: "AudiobookHero" }).vm.$emit("edit-rows");
    await flushPromises();
    expect(editor.props("open")).toBe(true);
    editor.vm.$emit("update:open", false);
    await flushPromises();
    wrapper.findComponent({ name: "DetailTextRow" }).vm.$emit("edit-rows");
    await flushPromises();
    expect(editor.props("open")).toBe(true);
  });

  it("clears the actionable book and reloads when only the provider changes", async () => {
    const wrapper = await mountDetails();
    const pending = deferred<Audiobook>();
    getAudiobook.mockReturnValueOnce(pending.promise);
    await wrapper.setProps({ provider: "other" });
    expect(shownBook(wrapper)).toBeUndefined();
    expect(getAudiobook).toHaveBeenLastCalledWith("1", "other");
    pending.resolve(audiobook({ provider: "other" }));
    await flushPromises();
    expect(shownBook(wrapper)?.provider).toBe("other");
  });

  it("rejects stale responses including navigation away and back to the same route", async () => {
    const first = deferred<Audiobook>();
    getAudiobook.mockReturnValueOnce(first.promise);
    const wrapper = await mountDetails();
    await wrapper.setProps({ itemId: "2" });
    await wrapper.setProps({ itemId: "1" });
    await flushPromises();
    first.resolve(audiobook({ name: "Old response" }));
    await flushPromises();
    expect(shownBook(wrapper)?.name).toBe("Audiobook");
  });

  it("updates progress and completion from this user's playlog", async () => {
    const wrapper = await mountDetails();
    playlog();
    await flushPromises();
    expect(shownBook(wrapper)?.resume_position_ms).toBe(900000);
    playlog({ fully_played: true, seconds_played: 3600 });
    await flushPromises();
    expect(shownBook(wrapper)?.fully_played).toBe(true);
  });

  it("applies the signed-in user's likes, dislikes and neutral state", async () => {
    const wrapper = await mountDetails();
    for (const favorite of [true, false, null]) {
      listeners.get(EventType.FAVORITE_UPDATED)!({
        data: {
          uri: book.uri,
          media_type: MediaType.AUDIOBOOK,
          user_id: "me",
          favorite,
        },
      } as EventMessage);
      await flushPromises();
      expect(shownBook(wrapper)?.favorite).toBe(favorite);
    }
  });

  it("keeps personal favorites across general metadata updates and ignores other users", async () => {
    getAudiobook.mockResolvedValue(audiobook({ favorite: false }));
    const wrapper = await mountDetails();
    listeners.get(EventType.FAVORITE_UPDATED)!({
      data: {
        uri: book.uri,
        media_type: MediaType.AUDIOBOOK,
        user_id: "other",
        favorite: true,
      },
    } as EventMessage);
    vi.useFakeTimers();
    listeners.get(EventType.MEDIA_ITEM_UPDATED)!({
      data: { ...book, favorite: true },
    } as EventMessage);
    await vi.advanceTimersByTimeAsync(2000);
    expect(shownBook(wrapper)?.favorite).toBe(false);
  });

  it("ignores other users, other books and other media types", async () => {
    const wrapper = await mountDetails();
    playlog({ userid: "someone-else" });
    playlog({ uri: "library://audiobook/other" });
    playlog({ media_type: MediaType.TRACK });
    await flushPromises();
    expect(shownBook(wrapper)?.resume_position_ms).toBe(0);
    playlog({ userid: null });
    await flushPromises();
    expect(shownBook(wrapper)?.resume_position_ms).toBe(900000);
  });

  it("keeps progress received before the initial response", async () => {
    const pending = deferred<Audiobook>();
    getAudiobook.mockReturnValueOnce(pending.promise);
    const wrapper = await mountDetails();
    playlog();
    pending.resolve(book);
    await flushPromises();
    expect(shownBook(wrapper)?.resume_position_ms).toBe(900000);
  });

  it("does not let a metadata update erase newer personal progress", async () => {
    const wrapper = await mountDetails();
    vi.useFakeTimers();
    playlog();
    getAudiobook.mockResolvedValue({ ...book, resume_position_ms: 900000 });
    listeners.get(EventType.MEDIA_ITEM_UPDATED)!({
      data: { ...book, name: "Updated metadata", resume_position_ms: null },
    } as EventMessage);
    await vi.advanceTimersByTimeAsync(2000);
    expect(shownBook(wrapper)?.name).toBe("Updated metadata");
    expect(shownBook(wrapper)?.resume_position_ms).toBe(900000);
  });

  it("keeps loaded personal progress when another user's metadata event arrives", async () => {
    getAudiobook.mockResolvedValue(audiobook({ resume_position_ms: 600000 }));
    const wrapper = await mountDetails();
    vi.useFakeTimers();
    listeners.get(EventType.MEDIA_ITEM_UPDATED)!({
      data: {
        ...book,
        name: "New metadata",
        fully_played: true,
        resume_position_ms: 3600000,
      },
    } as EventMessage);
    await vi.advanceTimersByTimeAsync(2000);
    expect(shownBook(wrapper)?.name).toBe("New metadata");
    expect(shownBook(wrapper)?.fully_played).toBe(false);
    expect(shownBook(wrapper)?.resume_position_ms).toBe(600000);
  });

  it("ends subscriptions when the page is unmounted", async () => {
    const wrapper = await mountDetails();
    wrapper.unmount();
    for (const unsub of unsubs) expect(unsub).toHaveBeenCalledOnce();
  });
});
