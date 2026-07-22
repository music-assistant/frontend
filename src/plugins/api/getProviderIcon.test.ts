import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { api } from "./index";
import { ProviderIconVariant } from "./interfaces";

describe("getProviderIcon", () => {
  beforeEach(() => {
    // reset cache between tests
    Object.keys(api.providerIcons).forEach(
      (k) => delete api.providerIcons[k],
    );
  });

  afterEach(() => {
    // restore spies so call counts don't accumulate across tests
    vi.restoreAllMocks();
  });

  it("fetches, returns and caches a data uri", async () => {
    const spy = vi
      .spyOn(api, "sendCommand")
      .mockResolvedValue("data:image/svg+xml;base64,PHN2Zy8+");
    const first = await api.getProviderIcon(
      "spotify",
      ProviderIconVariant.DEFAULT,
    );
    const second = await api.getProviderIcon(
      "spotify",
      ProviderIconVariant.DEFAULT,
    );
    expect(first).toBe("data:image/svg+xml;base64,PHN2Zy8+");
    expect(second).toBe(first);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith("providers/icon", {
      provider: "spotify",
      variant: ProviderIconVariant.DEFAULT,
    });
  });

  it("dedups concurrent requests for the same key", async () => {
    const spy = vi
      .spyOn(api, "sendCommand")
      .mockResolvedValue("data:image/png;base64,AAAA");
    const [a, b] = await Promise.all([
      api.getProviderIcon("tidal", ProviderIconVariant.DARK),
      api.getProviderIcon("tidal", ProviderIconVariant.DARK),
    ]);
    expect(a).toBe(b);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("caches null for a missing icon", async () => {
    const spy = vi.spyOn(api, "sendCommand").mockResolvedValue(null);
    const first = await api.getProviderIcon(
      "gone",
      ProviderIconVariant.DEFAULT,
    );
    const second = await api.getProviderIcon(
      "gone",
      ProviderIconVariant.DEFAULT,
    );
    expect(first).toBeNull();
    expect(second).toBeNull();
    expect(spy).toHaveBeenCalledTimes(1);
  });
});
