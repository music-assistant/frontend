import { Scope } from "@/plugins/api/interfaces";
import { useShareLinkPreviewMenuItem } from "@/composables/useShareLinkPreviewMenuItem";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { album } from "../fixtures/album";
import { artist } from "../fixtures/artist";
import { playlist } from "../fixtures/playlist";
import { track } from "../fixtures/track";

const { authManagerMock, eventbusMock, itemIsAvailableMock, storeMock } =
  vi.hoisted(() => ({
    authManagerMock: { hasScope: vi.fn() },
    eventbusMock: { emit: vi.fn() },
    itemIsAvailableMock: vi.fn(),
    storeMock: { enabledPlugins: new Set<string>() },
  }));

vi.mock("@/plugins/api/helpers", () => ({
  itemIsAvailable: itemIsAvailableMock,
}));
vi.mock("@/plugins/auth", () => ({ authManager: authManagerMock }));
vi.mock("@/plugins/eventbus", () => ({ eventbus: eventbusMock }));
vi.mock("@/plugins/store", () => ({ store: storeMock }));

beforeEach(() => {
  vi.clearAllMocks();
  authManagerMock.hasScope.mockReturnValue(true);
  itemIsAvailableMock.mockReturnValue(true);
  storeMock.enabledPlugins = new Set(["share_provider"]);
});

describe("useShareLinkPreviewMenuItem", () => {
  it.each([
    ["track", track({ uri: "library://track/from-playlist" })],
    ["album", album({ uri: "library://album/1" })],
    ["artist", artist({ uri: "library://artist/1" })],
  ])("offers a share preview for a %s", (_type, item) => {
    expect(useShareLinkPreviewMenuItem(item)?.label).toBe("share.open_preview");
  });

  it("shares an individual track from a playlist", () => {
    const uri = "library://track/from-playlist";
    const menuItem = useShareLinkPreviewMenuItem(track({ uri }));

    menuItem?.action?.();

    expect(eventbusMock.emit).toHaveBeenCalledWith("shareLinkPreview", { uri });
  });

  it("does not offer embedded playlist links", () => {
    expect(
      useShareLinkPreviewMenuItem(playlist({ uri: "library://playlist/1" })),
    ).toBeUndefined();
  });

  it("requires the share plugin and library read access", () => {
    const item = track({ uri: "library://track/1" });
    storeMock.enabledPlugins.clear();
    expect(useShareLinkPreviewMenuItem(item)).toBeUndefined();

    storeMock.enabledPlugins.add("share_provider");
    authManagerMock.hasScope.mockImplementation(
      (scope) => scope !== Scope.LIBRARY_READ,
    );
    expect(useShareLinkPreviewMenuItem(item)).toBeUndefined();

    authManagerMock.hasScope.mockReturnValue(true);
    itemIsAvailableMock.mockReturnValue(false);
    expect(useShareLinkPreviewMenuItem(item)).toBeUndefined();
    expect(itemIsAvailableMock).toHaveBeenCalledWith(item);
  });
});
