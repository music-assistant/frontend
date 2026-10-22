import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { copyProviderLink, shareProviderLink } from "./useProviderLinkSharing";

const { copyToClipboard, success, error } = vi.hoisted(() => ({
  copyToClipboard: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
}));
vi.mock("@/helpers/utils", () => ({ copyToClipboard }));
vi.mock("@/plugins/i18n", () => ({ $t: (key: string) => key }));
vi.mock("vue-sonner", () => ({ toast: { success, error } }));
const url = "https://music.youtube.com/watch?v=meuR1l4j-xs";

describe("provider link sharing", () => {
  afterEach(() => vi.unstubAllGlobals());
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("navigator", {});
  });

  it("opens native sharing with the public URL", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { share });
    await shareProviderLink(url, "Attention");
    expect(share).toHaveBeenCalledWith({ url, title: "Attention" });
    expect(copyToClipboard).not.toHaveBeenCalled();
  });

  it("copies the public URL when native sharing is unavailable", async () => {
    copyToClipboard.mockResolvedValue(true);
    await shareProviderLink(url, "Attention");
    expect(copyToClipboard).toHaveBeenCalledWith(url);
    expect(success).toHaveBeenCalledWith("provider_links.copied");
  });

  it("does not treat dismissing the share sheet as a failure", async () => {
    vi.stubGlobal("navigator", {
      share: vi
        .fn()
        .mockRejectedValue(new DOMException("Cancelled", "AbortError")),
    });
    await shareProviderLink(url, "Attention");
    expect(error).not.toHaveBeenCalled();
    expect(copyToClipboard).not.toHaveBeenCalled();
  });

  it("reports sharing and clipboard failures", async () => {
    vi.stubGlobal("navigator", {
      share: vi.fn().mockRejectedValue(new Error("Unavailable")),
    });
    await shareProviderLink(url, "Attention");
    expect(error).toHaveBeenCalledWith("provider_links.share_failed");
    copyToClipboard.mockResolvedValue(false);
    await copyProviderLink(url);
    expect(error).toHaveBeenCalledWith("provider_links.copy_failed");
  });
});
