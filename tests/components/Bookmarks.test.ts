import Bookmarks from "@/components/Bookmarks.vue";
import {
  MediaType,
  ProviderFeature,
  type Audiobook,
  type MediaItemBookmark,
} from "@/plugins/api/interfaces";
import {
  eventbus,
  type DeleteConfirmationDialogEvent,
} from "@/plugins/eventbus";
import { flushPromises, mount } from "@vue/test-utils";
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
    getAudiobookBookmarks: vi.fn(),
    removeAudiobookBookmark: vi.fn(),
    playMedia: vi.fn(),
    subscribe: vi.fn(() => () => {}),
  },
}));

vi.mock("@/plugins/api", () => ({ api: apiMock, default: apiMock }));
vi.mock("@/components/Toolbar.vue", () => ({
  default: { name: "Toolbar", template: "<div />" },
}));
vi.mock("@/components/ProviderIcon.vue", () => ({
  default: { name: "ProviderIcon", template: "<span />" },
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
} as unknown as Audiobook;

function bookmark(
  provider_instance_id: string,
  name: string,
  stored_by_music_assistant: boolean,
): MediaItemBookmark {
  return {
    name,
    start: 754,
    provider_instance_id,
    provider_item_id: "book1",
    stored_by_music_assistant,
  };
}

async function mountBookmarks(bookmarks: MediaItemBookmark[]) {
  apiMock.getAudiobookBookmarks.mockResolvedValue(bookmarks);
  const wrapper = mount(Bookmarks, {
    props: { itemDetails: book },
    global: {
      plugins: [createVuetify({ components, directives })],
      mocks: { $t: (key: string) => key },
    },
  });
  await flushPromises();
  return wrapper;
}

describe("Bookmarks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiMock.providers = {
      [ABS]: providerInstance({
        domain: "audiobookshelf",
        name: "Audiobookshelf",
        instance_id: ABS,
        supported_features: [
          ProviderFeature.AUDIOBOOK_BOOKMARKS,
          ProviderFeature.AUDIOBOOK_BOOKMARKS_EDIT,
        ],
      }),
      [AUDIBLE]: providerInstance({
        domain: "audible",
        name: "Audible",
        instance_id: AUDIBLE,
        supported_features: [ProviderFeature.AUDIOBOOK_BOOKMARKS],
      }),
      [LOCAL]: providerInstance({
        domain: "filesystem_local",
        name: "Local files",
        instance_id: LOCAL,
      }),
    };
  });

  // a hint only where the provider keeps bookmarks itself, edits only where
  // somebody can make them
  it("groups per copy and offers edits where they can be made", async () => {
    const wrapper = await mountBookmarks([
      bookmark(ABS, "On the provider", false),
      bookmark(AUDIBLE, "Read only", false),
      bookmark(AUDIBLE, "Kept by MA", true),
      bookmark(LOCAL, "Local file", true),
    ]);

    expect(
      wrapper.findAll(".v-list-subheader").map((x) => x.text().trim()),
    ).toEqual(["Audiobookshelf", "Audible", "Local files"]);
    expect(
      wrapper
        .findAll(".v-list-item")
        .map((row) => [
          row.get(".v-list-item-title").text(),
          row.find(".v-list-item-subtitle").exists(),
          row.findAll(".v-list-item__append button").length,
        ]),
    ).toEqual([
      ["On the provider", false, 2],
      ["Read only", false, 0],
      ["Kept by MA", true, 2],
      ["Local file", false, 2],
    ]);
  });

  it("plays the copy the bookmark was made on, at its start", async () => {
    const wrapper = await mountBookmarks([bookmark(ABS, "Arrakis", false)]);

    await wrapper.get(".v-list-item").trigger("click");

    expect(apiMock.playMedia).toHaveBeenCalledWith(
      "audiobookshelf--1://audiobook/book1",
      undefined,
      { start_position: 754 },
    );
  });

  it("deletes only once confirmed, and follows changes made elsewhere", async () => {
    const wrapper = await mountBookmarks([bookmark(LOCAL, "Local file", true)]);
    const confirmations: DeleteConfirmationDialogEvent[] = [];
    const onConfirmation = (evt: DeleteConfirmationDialogEvent) =>
      confirmations.push(evt);
    eventbus.on("deleteConfirmationDialog", onConfirmation);

    await wrapper.findAll(".v-list-item__append button")[1].trigger("click");
    expect(apiMock.removeAudiobookBookmark).not.toHaveBeenCalled();

    apiMock.getAudiobookBookmarks.mockResolvedValue([]);
    await confirmations[0].onConfirm();
    await flushPromises();
    expect(apiMock.removeAudiobookBookmark).toHaveBeenCalledWith(
      LOCAL,
      "book1",
      754,
    );
    expect(wrapper.find(".v-list-item").exists()).toBe(false);

    // e.g. a bookmark added in the full screen player
    apiMock.getAudiobookBookmarks.mockResolvedValue([
      bookmark(LOCAL, "Added in the player", true),
    ]);
    eventbus.emit("bookmarksChanged");
    await flushPromises();
    expect(wrapper.get(".v-list-item-title").text()).toBe(
      "Added in the player",
    );

    eventbus.off("deleteConfirmationDialog", onConfirmation);
    wrapper.unmount();
  });
});
