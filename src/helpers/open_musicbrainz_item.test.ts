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

import { openMusicBrainzItem } from "@/helpers/open_musicbrainz_item";
import { ApiCommandError } from "@/plugins/api/errors";
import { toast } from "vue-sonner";
import { album } from "../../tests/fixtures/album";

const release = album({
  item_id: "rg-1",
  provider: "musicbrainz",
  provider_mappings: [],
});
// the same album on one of the user's music services
const resolvedAlbum = album({ item_id: "sp-1", provider: "spotify" });

beforeEach(() => {
  mockGetItem.mockReset();
  mockRouterPush.mockReset();
  mockCurrentRoute.value = { fullPath: "/artists/library/1" };
  vi.mocked(toast.error).mockClear();
});

describe("openMusicBrainzItem", () => {
  it("opens the page of the album it resolves to", async () => {
    mockGetItem.mockResolvedValue(resolvedAlbum);

    await openMusicBrainzItem(release);

    expect(mockGetItem).toHaveBeenCalledWith(
      release.media_type,
      "rg-1",
      "musicbrainz",
    );
    expect(mockRouterPush).toHaveBeenCalledWith({
      name: resolvedAlbum.media_type,
      params: { itemId: "sp-1", provider: "spotify" },
    });
  });

  it("stays put when none of the music services has it, leaving the server's toast", async () => {
    mockGetItem.mockRejectedValue(new ApiCommandError("Not found", 1));

    await openMusicBrainzItem(release);

    expect(mockRouterPush).not.toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("shows its own toast when the lookup fails without a server message", async () => {
    mockGetItem.mockRejectedValue(new Error("Connection lost"));

    await openMusicBrainzItem(release);

    expect(mockRouterPush).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith("open_item_failed");
  });

  it("can be opened again once a failed lookup settled", async () => {
    mockGetItem.mockRejectedValueOnce(new ApiCommandError("Not found", 1));
    await openMusicBrainzItem(release);

    mockGetItem.mockResolvedValue(resolvedAlbum);
    await openMusicBrainzItem(release);

    expect(mockGetItem).toHaveBeenCalledTimes(2);
    expect(mockRouterPush).toHaveBeenCalledTimes(1);
  });

  it("ignores a second request while the first one still resolves", async () => {
    let finish!: (value: typeof resolvedAlbum) => void;
    mockGetItem.mockReturnValue(new Promise((resolve) => (finish = resolve)));

    const first = openMusicBrainzItem(release);
    await openMusicBrainzItem(release);
    finish(resolvedAlbum);
    await first;

    expect(mockGetItem).toHaveBeenCalledTimes(1);
    expect(mockRouterPush).toHaveBeenCalledTimes(1);
  });

  it("does not move the user when they went to another page meanwhile", async () => {
    let finish!: (value: typeof resolvedAlbum) => void;
    mockGetItem.mockReturnValue(new Promise((resolve) => (finish = resolve)));

    const opening = openMusicBrainzItem(release);
    mockCurrentRoute.value = { fullPath: "/home" };
    finish(resolvedAlbum);
    await opening;

    expect(mockRouterPush).not.toHaveBeenCalled();
  });

  it("does not move the user when they left and came back meanwhile", async () => {
    let finish!: (value: typeof resolvedAlbum) => void;
    mockGetItem.mockReturnValue(new Promise((resolve) => (finish = resolve)));

    const opening = openMusicBrainzItem(release);
    mockCurrentRoute.value = { fullPath: "/home" };
    mockCurrentRoute.value = { fullPath: "/artists/library/1" };
    finish(resolvedAlbum);
    await opening;

    expect(mockRouterPush).not.toHaveBeenCalled();
  });
});
