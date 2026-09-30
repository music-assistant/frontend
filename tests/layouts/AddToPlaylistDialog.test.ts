/**
 * Creating a playlist from the add-to-playlist sheet asks for its name in the
 * app's own dialog, and adds the selected items to what it creates.
 */
import AddToPlaylistDialog from "@/layouts/default/AddToPlaylistDialog.vue";
import { MediaType, ProviderFeature } from "@/plugins/api/interfaces";
import { eventbus } from "@/plugins/eventbus";
import { enableAutoUnmount, flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { playlist } from "../fixtures/playlist";
import { track } from "../fixtures/track";

const { apiMock, storeMock } = vi.hoisted(() => ({
  apiMock: {
    providers: {} as Record<string, unknown>,
    addPlaylistTracks: vi.fn(),
    createPlaylist: vi.fn(),
    getLibraryPlaylists: vi.fn(),
    getProvider: vi.fn(),
  },
  storeMock: { dialogActive: false, currentUser: undefined },
}));

vi.mock("@/plugins/api", () => ({ api: apiMock, default: apiMock }));
vi.mock("@/plugins/auth", () => ({ authManager: { hasScope: () => true } }));
vi.mock("@/plugins/i18n", () => ({ $t: (key: string) => key }));
vi.mock("@/plugins/store", () => ({ store: storeMock }));
vi.mock("@/components/MediaItemThumb.vue", () => ({
  default: { name: "MediaItemThumb", template: "<div />" },
}));
vi.mock("@/components/ProviderIcon.vue", () => ({
  default: { name: "ProviderIcon", template: "<div />" },
}));

const builtin = {
  instance_id: "builtin--1",
  domain: "builtin",
  name: "Builtin",
  available: true,
  is_streaming_provider: false,
  supported_features: [
    ProviderFeature.PLAYLIST_CREATE,
    ProviderFeature.PLAYLIST_TRACKS_EDIT,
  ],
};

const nativePrompt = vi.fn();

enableAutoUnmount(afterEach);

beforeEach(() => {
  vi.clearAllMocks();
  apiMock.providers = { "builtin--1": builtin };
  apiMock.getLibraryPlaylists.mockResolvedValue([]);
  apiMock.getProvider.mockReturnValue(builtin);
  apiMock.createPlaylist.mockResolvedValue(playlist({ item_id: "42" }));
  nativePrompt.mockReset();
  // the test environment has no window.prompt, so a native popup would throw
  // here; the stub turns that into a readable assertion instead
  vi.stubGlobal("prompt", nativePrompt);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("AddToPlaylistDialog creating a playlist", () => {
  it("asks for the name in its own dialog and fills the new playlist", async () => {
    const wrapper = await openSheet();
    expect(wrapper.find(".name-dialog").exists()).toBe(false);

    await wrapper.get(".playlist-list button").trigger("click");

    expect(nativePrompt).not.toHaveBeenCalled();
    expect(wrapper.find(".name-dialog").exists()).toBe(true);
    // a playlist without a name cannot be created
    expect(createButton(wrapper)?.attributes("disabled")).toBeDefined();

    await wrapper.get(".name-dialog input").setValue("Road trip");
    expect(createButton(wrapper)?.attributes("disabled")).toBeUndefined();
    await wrapper.get("form").trigger("submit");
    await flushPromises();

    expect(apiMock.createPlaylist).toHaveBeenCalledWith(
      "Road trip",
      "builtin--1",
      [MediaType.TRACK],
    );
    expect(apiMock.addPlaylistTracks).toHaveBeenCalledWith("42", [
      "library://track/1",
    ]);
    // both the name dialog and the sheet behind it are done
    expect(wrapper.find(".name-dialog").exists()).toBe(false);
    expect(wrapper.find(".playlist-sheet").exists()).toBe(false);
  });

  it("creates nothing while the name is only whitespace", async () => {
    const wrapper = await openSheet();
    await wrapper.get(".playlist-list button").trigger("click");

    await wrapper.get(".name-dialog input").setValue("   ");
    await wrapper.get("form").trigger("submit");
    await flushPromises();

    expect(apiMock.createPlaylist).not.toHaveBeenCalled();
    expect(wrapper.find(".name-dialog").exists()).toBe(true);
  });
});

const passthroughStub = { template: "<div><slot /></div>" };
// the real dialog and sheet only mount their content while they are open, so
// the stubs do too
const openOnlyStub = (className: string) => ({
  props: ["open"],
  emits: ["update:open"],
  template: `<div v-if="open" class="${className}"><slot /></div>`,
});

async function openSheet() {
  const wrapper = mount(AddToPlaylistDialog, {
    global: {
      mocks: { $t: (key: string) => key },
      stubs: {
        Button: { template: "<button><slot /></button>" },
        Dialog: openOnlyStub("name-dialog"),
        DialogContent: passthroughStub,
        DialogFooter: passthroughStub,
        DialogHeader: passthroughStub,
        DialogTitle: passthroughStub,
        Input: {
          props: ["modelValue"],
          emits: ["update:modelValue"],
          template:
            '<input :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />',
        },
        ScrollArea: passthroughStub,
        Separator: true,
        Sheet: openOnlyStub("playlist-sheet"),
        SheetContent: passthroughStub,
        SheetDescription: passthroughStub,
        SheetHeader: passthroughStub,
        SheetTitle: passthroughStub,
      },
    },
  });
  eventbus.emit("playlistdialog", { items: [track({ item_id: "1" })] });
  await flushPromises();
  return wrapper;
}

function createButton(wrapper: Awaited<ReturnType<typeof openSheet>>) {
  return wrapper
    .findAll(".name-dialog button")
    .find((button) => button.text() === "create");
}
