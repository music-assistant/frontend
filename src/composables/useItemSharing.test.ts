import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { activateItemShare, getItemShareMenuItem } from "./useItemSharing";
import { track } from "../../tests/fixtures/track";
import { radio } from "../../tests/fixtures/radio";

const { api, copyToClipboard, toast, device, hasScope } = vi.hoisted(() => ({
  api: {
    state: { value: "initialized" },
    getItemShareInfo: vi.fn(),
    getProviderManifest: vi.fn(),
    getProvider: vi.fn(),
  },
  copyToClipboard: vi.fn(),
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
  device: { mobile: false },
  hasScope: vi.fn(),
}));
vi.mock("@/plugins/api", () => ({ default: api, api }));
vi.mock("@/plugins/auth", () => ({ authManager: { hasScope } }));
vi.mock("@/helpers/device", () => ({
  get IS_MOBILE_UA() {
    return device.mobile;
  },
}));
vi.mock("@/helpers/utils", () => ({ copyToClipboard }));
vi.mock("@/plugins/i18n", () => ({ $t: (key: string) => key }));
vi.mock("vue-sonner", () => ({ toast }));
const url = "https://open.spotify.com/track/example";
const link = {
  url,
  provider_domain: "spotify",
  provider_instance: "spotify--1",
};

beforeEach(() => {
  vi.resetAllMocks();
  device.mobile = false;
  api.state.value = "initialized";
  hasScope.mockReturnValue(true);
  copyToClipboard.mockResolvedValue(true);
  api.getItemShareInfo.mockResolvedValue({
    title: "Song",
    text: null,
    links: [link],
  });
  vi.stubGlobal("navigator", {});
});
afterEach(() => vi.unstubAllGlobals());

describe("server-backed sharing menu", () => {
  it("preloads at menu open and copies only the public link on the final click", async () => {
    const item = track();
    const menu = getItemShareMenuItem(item)!;
    expect(api.getItemShareInfo).not.toHaveBeenCalled();
    expect(menu.disabled).toBe(true);
    await menu.prepare!();
    expect(api.getItemShareInfo).toHaveBeenCalledWith(item.uri);
    expect(copyToClipboard).not.toHaveBeenCalled();
    await menu.action!();
    expect(copyToClipboard).toHaveBeenCalledWith(url);
  });
  it("shares natively on mobile with a URL and optional title only", async () => {
    device.mobile = true;
    const share = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { share });
    const menu = getItemShareMenuItem(track())!;
    await menu.prepare!();
    const calls = api.getItemShareInfo.mock.calls.length;
    const result = menu.action!();
    expect(share).toHaveBeenCalledWith({ url, title: "Song" });
    await result;
    expect(api.getItemShareInfo).toHaveBeenCalledTimes(calls);
    expect(toast.success).toHaveBeenCalledWith("provider_links.shared");
  });
  it("sends fallback text alone to the native share sheet", async () => {
    device.mobile = true;
    const share = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { share });
    api.getItemShareInfo.mockResolvedValue({
      title: "Song",
      text: "Artist - Song",
      links: [],
    });
    const menu = getItemShareMenuItem(track())!;
    await menu.prepare!();
    await menu.action!();
    expect(share).toHaveBeenCalledWith({ text: "Artist - Song" });
  });

  it("uses the existing submenu with friendly provider names", async () => {
    api.getProviderManifest.mockImplementation((domain: string) => ({
      name: domain === "spotify" ? "Spotify" : "YouTube Music",
    }));
    api.getItemShareInfo.mockResolvedValue({
      title: "Song",
      text: null,
      links: [
        link,
        {
          ...link,
          provider_domain: "ytmusic",
          url: "https://music.youtube.com/watch?v=id",
        },
      ],
    });
    const menu = getItemShareMenuItem(track())!;
    await menu.prepare!();
    expect(menu.subItems?.map((choice) => choice.labelArgs)).toEqual([
      { provider: "Spotify" },
      { provider: "YouTube Music" },
    ]);
    await menu.subItems![1].action!();
    expect(copyToClipboard).toHaveBeenCalledWith(
      "https://music.youtube.com/watch?v=id",
    );
  });
  it("shares local metadata alone and preserves radio station identity", async () => {
    const station = radio();
    api.getItemShareInfo.mockResolvedValue({
      title: "Station",
      text: "Station",
      links: [],
    });
    const menu = getItemShareMenuItem(station)!;
    await menu.prepare!();
    expect(api.getItemShareInfo).toHaveBeenCalledWith(station.uri);
    await menu.action!();
    expect(copyToClipboard).toHaveBeenCalledWith("Station");
  });
  it("hides an empty payload or failed lookup and reports failure", async () => {
    const menu = getItemShareMenuItem(track())!;
    api.getItemShareInfo.mockResolvedValue({
      title: "",
      text: null,
      links: [],
    });
    await menu.prepare!();
    expect(menu.hide).toBe(true);
    api.getItemShareInfo.mockRejectedValue(new Error("Unavailable"));
    await menu.prepare!();
    expect(menu.hide).toBe(true);
    expect(menu.action).toBeUndefined();
    expect(toast.error).toHaveBeenCalledWith("provider_links.load_failed");
  });
  it("guards read permission and connection availability", () => {
    hasScope.mockReturnValue(false);
    expect(getItemShareMenuItem(track())).toBeUndefined();
    hasScope.mockReturnValue(true);
    api.state.value = "disconnected";
    expect(getItemShareMenuItem(track())).toBeUndefined();
  });
  it("reports cancellation and native failure without copying", async () => {
    device.mobile = true;
    const share = vi
      .fn()
      .mockRejectedValue(new DOMException("Cancelled", "AbortError"));
    vi.stubGlobal("navigator", { share });
    await activateItemShare({ url });
    expect(toast.info).toHaveBeenCalledWith("provider_links.cancelled");
    share.mockRejectedValue(new Error("Failed"));
    await activateItemShare({ url });
    expect(toast.error).toHaveBeenCalledWith("provider_links.share_failed");
    expect(copyToClipboard).not.toHaveBeenCalled();
  });
  it.each([false, new Error("Denied")])(
    "reports clipboard failure: %s",
    async (failure) => {
      if (failure) copyToClipboard.mockRejectedValue(failure);
      else copyToClipboard.mockResolvedValue(false);
      await activateItemShare({ text: "Artist - Song" });
      expect(toast.error).toHaveBeenCalledWith("provider_links.copy_failed");
    },
  );
});
