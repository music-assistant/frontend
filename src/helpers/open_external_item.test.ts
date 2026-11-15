import type { MusicAssistantApi } from "@/plugins/api";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetItem, mockRouterPush, mockCurrentRoute } = vi.hoisted(() => ({
  mockGetItem: vi.fn<MusicAssistantApi["getItem"]>(),
  mockRouterPush: vi.fn(),
  mockCurrentRoute: { value: { fullPath: "" } },
}));

vi.mock("@/plugins/api", () => ({
  api: { getItem: mockGetItem },
}));

vi.mock("@/plugins/router", () => ({
  default: { push: mockRouterPush, currentRoute: mockCurrentRoute },
}));

vi.mock("@/plugins/i18n", () => ({
  $t: (key: string) => key,
}));

vi.mock("vue-sonner", () => ({
  toast: { error: vi.fn() },
}));

import { openExternalItem } from "@/helpers/open_external_item";
import { ApiCommandError } from "@/plugins/api/errors";
import { toast } from "vue-sonner";
import { album } from "../../tests/fixtures/album";
import { track } from "../../tests/fixtures/track";

// a discography release as the server lists it: known by its release group id
const release = album({
  item_id: "musicbrainz_releasegroupid:rg-1",
  provider: "external",
  provider_mappings: [],
  is_playable: false,
});
// the same album on one of the user's music services
const resolvedAlbum = album({ item_id: "sp-1", provider: "spotify" });

beforeEach(() => {
  mockGetItem.mockReset();
  mockRouterPush.mockReset();
  mockCurrentRoute.value = { fullPath: "/artists/library/1" };
  vi.mocked(toast.error).mockClear();
});

describe("openExternalItem", () => {
  it("opens the page of the album it is found as", async () => {
    mockGetItem.mockResolvedValue(resolvedAlbum);

    await openExternalItem(release);

    expect(mockGetItem).toHaveBeenCalledWith(
      release.media_type,
      "musicbrainz_releasegroupid:rg-1",
      "external",
    );
    expect(mockRouterPush).toHaveBeenCalledWith({
      name: resolvedAlbum.media_type,
      params: { itemId: "sp-1", provider: "spotify" },
    });
  });

  it("opens the page of the track it is found as", async () => {
    // a top track known by its MusicBrainz recording id
    const topTrack = track({
      item_id: "musicbrainz_recordingid:rec-1",
      provider: "external",
      provider_mappings: [],
    });
    mockGetItem.mockResolvedValue(track({ item_id: "5", provider: "library" }));

    await openExternalItem(topTrack);

    expect(mockGetItem).toHaveBeenCalledWith(
      topTrack.media_type,
      "musicbrainz_recordingid:rec-1",
      "external",
    );
    expect(mockRouterPush).toHaveBeenCalledWith({
      name: topTrack.media_type,
      params: { itemId: "5", provider: "library" },
    });
  });

  it("stays put when none of the music services has it, leaving the server's toast", async () => {
    mockGetItem.mockRejectedValue(new ApiCommandError("Not found", 1));

    await openExternalItem(release);

    expect(mockRouterPush).not.toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("shows its own toast when the lookup fails without a server message", async () => {
    mockGetItem.mockRejectedValue(new Error("Connection lost"));

    await openExternalItem(release);

    expect(mockRouterPush).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith("open_item_failed");
  });

  it("can be opened again once a failed lookup settled", async () => {
    mockGetItem.mockRejectedValueOnce(new ApiCommandError("Not found", 1));
    await openExternalItem(release);

    mockGetItem.mockResolvedValue(resolvedAlbum);
    await openExternalItem(release);

    expect(mockGetItem).toHaveBeenCalledTimes(2);
    expect(mockRouterPush).toHaveBeenCalledTimes(1);
  });

  it("ignores a second request while the first one is still looked up", async () => {
    let finish!: (value: typeof resolvedAlbum) => void;
    mockGetItem.mockReturnValue(new Promise((resolve) => (finish = resolve)));

    const first = openExternalItem(release);
    await openExternalItem(release);
    finish(resolvedAlbum);
    await first;

    expect(mockGetItem).toHaveBeenCalledTimes(1);
    expect(mockRouterPush).toHaveBeenCalledTimes(1);
  });

  it("does not move the user when they went to another page meanwhile", async () => {
    let finish!: (value: typeof resolvedAlbum) => void;
    mockGetItem.mockReturnValue(new Promise((resolve) => (finish = resolve)));

    const opening = openExternalItem(release);
    mockCurrentRoute.value = { fullPath: "/home" };
    finish(resolvedAlbum);
    await opening;

    expect(mockRouterPush).not.toHaveBeenCalled();
  });

  it("does not move the user when they left and came back meanwhile", async () => {
    let finish!: (value: typeof resolvedAlbum) => void;
    mockGetItem.mockReturnValue(new Promise((resolve) => (finish = resolve)));

    const opening = openExternalItem(release);
    mockCurrentRoute.value = { fullPath: "/home" };
    mockCurrentRoute.value = { fullPath: "/artists/library/1" };
    finish(resolvedAlbum);
    await opening;

    expect(mockRouterPush).not.toHaveBeenCalled();
  });
});
