import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { activateItemShare, getItemShareMenuItem } from "./useItemSharing";
import { track } from "../../tests/fixtures/track";
import { radio } from "../../tests/fixtures/radio";
import { user } from "../../tests/fixtures/user";
import type { ItemShareInfo } from "@/plugins/api/sharing";
import { store } from "@/plugins/store";

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
vi.mock("@/plugins/store", () => ({ store: {} }));
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
const shareResponses: { kind: string; info: ItemShareInfo }[] = [
  { kind: "URL", info: { title: "Song", text: null, links: [link] } },
  {
    kind: "text",
    info: { title: "Song", text: "Artist - Song", links: [] },
  },
  {
    kind: "provider choices",
    info: {
      title: "Song",
      text: null,
      links: [
        link,
        {
          provider_domain: "ytmusic",
          provider_instance: "ytmusic--1",
          url: "https://music.youtube.com/watch?v=id",
        },
      ],
    },
  },
];

beforeEach(() => {
  vi.resetAllMocks();
  device.mobile = false;
  api.state.value = "initialized";
  store.currentUser = user();
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
  it("hides an empty payload or failed preload silently and retries preparation", async () => {
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
    expect(menu.subItems).toBeUndefined();
    expect(toast.error).not.toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();
    expect(toast.info).not.toHaveBeenCalled();
    api.getItemShareInfo.mockResolvedValue({ title: "Song", links: [link] });
    await menu.prepare!();
    expect(api.getItemShareInfo).toHaveBeenCalledTimes(3);
    expect(menu.hide).toBe(false);
    expect(menu.disabled).toBe(false);
    await menu.action!();
    expect(copyToClipboard).toHaveBeenCalledWith(url);
  });
  it("guards read permission and connection availability", () => {
    hasScope.mockReturnValue(false);
    expect(getItemShareMenuItem(track())).toBeUndefined();
    hasScope.mockReturnValue(true);
    api.state.value = "disconnected";
    expect(getItemShareMenuItem(track())).toBeUndefined();
  });
  it.each(shareResponses)(
    "discards $kind returned after read access is revoked during preload",
    async ({ info }) => {
      const request = Promise.withResolvers<ItemShareInfo>();
      api.getItemShareInfo.mockReturnValue(request.promise);
      const menu = getItemShareMenuItem(track())!;
      const pending = menu.prepare!();
      hasScope.mockReturnValue(false);
      request.resolve(info);
      await pending;

      expect(menu.action).toBeUndefined();
      expect(menu.subItems).toBeUndefined();
      expect(menu.hide).toBe(true);
      expect(menu.disabled).toBe(true);
      expect(copyToClipboard).not.toHaveBeenCalled();
      expect(toast.success).not.toHaveBeenCalled();
      expect(toast.error).not.toHaveBeenCalled();
      expect(toast.info).not.toHaveBeenCalled();
      await menu.prepare!();
      expect(api.getItemShareInfo).toHaveBeenCalledOnce();
    },
  );
  describe.each([false, true])("revoked access on mobile=%s", (mobile) => {
    it.each(shareResponses)(
      "blocks retained $kind callbacks immediately after successful preload",
      async ({ info }) => {
        device.mobile = mobile;
        const share = vi.fn().mockResolvedValue(undefined);
        vi.stubGlobal("navigator", { share });
        api.getItemShareInfo.mockResolvedValue(info);
        const menu = getItemShareMenuItem(track())!;
        await menu.prepare!();
        const actions = menu.subItems
          ? menu.subItems.map((choice) => choice.action!)
          : [menu.action!];
        hasScope.mockReturnValue(false);

        for (const action of actions) {
          const pending = action();
          expect(share).not.toHaveBeenCalled();
          expect(copyToClipboard).not.toHaveBeenCalled();
          await pending;
        }
        expect(toast.success).not.toHaveBeenCalled();
        expect(toast.info).not.toHaveBeenCalled();
        expect(toast.error).toHaveBeenCalledTimes(actions.length);
        expect(toast.error).toHaveBeenCalledWith(
          mobile ? "provider_links.share_failed" : "provider_links.copy_failed",
        );
        expect(menu.hide).toBe(true);
        expect(menu.disabled).toBe(true);
        expect(menu.action).toBeUndefined();
        expect(menu.subItems).toBeUndefined();
        expect(api.getItemShareInfo).toHaveBeenCalledOnce();
      },
    );

    it("checks live access at the payload activation boundary", async () => {
      device.mobile = mobile;
      const share = vi.fn().mockResolvedValue(undefined);
      vi.stubGlobal("navigator", { share });
      hasScope.mockReturnValue(false);

      const pending = activateItemShare({ url });
      expect(share).not.toHaveBeenCalled();
      expect(copyToClipboard).not.toHaveBeenCalled();
      await pending;
      expect(toast.success).not.toHaveBeenCalled();
      expect(toast.error).toHaveBeenCalledWith(
        mobile ? "provider_links.share_failed" : "provider_links.copy_failed",
      );
    });
  });
  it.each(["connection", "user", "item"])(
    "invalidates a prepared payload when its %s context changes",
    async (context) => {
      const item = track();
      const menu = getItemShareMenuItem(item)!;
      await menu.prepare!();
      const action = menu.action!;
      if (context === "connection") api.state.value = "reconnecting";
      else if (context === "user") {
        store.currentUser = user({ provider_filter: ["different-provider"] });
      } else item.uri = "library://track/another";

      await action();
      expect(copyToClipboard).not.toHaveBeenCalled();
      expect(toast.success).not.toHaveBeenCalled();
      expect(toast.error).toHaveBeenCalledWith("provider_links.copy_failed");
      expect(menu.hide).toBe(true);
      expect(menu.disabled).toBe(true);
      expect(menu.action).toBeUndefined();
    },
  );
  it("rejects a retained callback from an earlier preparation without invalidating the new request", async () => {
    const menu = getItemShareMenuItem(track())!;
    await menu.prepare!();
    const oldAction = menu.action!;
    const request = Promise.withResolvers<ItemShareInfo>();
    api.getItemShareInfo.mockReturnValue(request.promise);
    const pending = menu.prepare!();

    await oldAction();
    expect(copyToClipboard).not.toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith("provider_links.copy_failed");
    request.resolve({ title: "Fresh", text: "Fresh text", links: [] });
    await pending;
    expect(menu.hide).toBe(false);
    expect(menu.disabled).toBe(false);
    await menu.action!();
    expect(copyToClipboard).toHaveBeenCalledExactlyOnceWith("Fresh text");
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
