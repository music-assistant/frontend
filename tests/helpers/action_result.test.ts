import { beforeEach, describe, expect, it, vi } from "vitest";
import { isRefusedActionUrl } from "@/helpers/action_result";
import { ProviderTier } from "@/plugins/api/interfaces";

const { apiMock } = vi.hoisted(() => ({
  apiMock: {
    baseUrl: "http://192.168.1.10:8095",
    serverInfo: {
      value: {
        internal_url: "http://192.168.1.10:8095",
        external_url: "https://music.example.com",
      },
    },
    getProviderManifest: vi.fn(),
  },
}));

vi.mock("@/plugins/api", () => ({ api: apiMock }));

vi.mock("@/plugins/i18n", () => ({
  $t: (key: string) => key,
}));

vi.mock("vue-sonner", () => ({
  toast: { success: vi.fn(), warning: vi.fn() },
}));

describe("isRefusedActionUrl", () => {
  beforeEach(() => {
    apiMock.getProviderManifest.mockReturnValue({
      tier: ProviderTier.COMMUNITY,
    });
  });

  it.each([
    ["the app's own address", `${window.location.origin}/raw_route`],
    ["the server's address", "http://192.168.1.10:8095/raw_route"],
    ["the server's external address", "https://music.example.com/raw_route"],
  ])("refuses a community provider's link to %s", (_name, url) => {
    expect(isRefusedActionUrl(url, "community_demo")).toBe(true);
  });

  it("opens a community provider's link elsewhere", () => {
    expect(
      isRefusedActionUrl("https://example.com/auth", "community_demo"),
    ).toBe(false);
  });

  it("opens a built-in provider's link to the server's external address", () => {
    apiMock.getProviderManifest.mockReturnValue({ tier: ProviderTier.CORE });

    expect(
      isRefusedActionUrl("https://music.example.com/raw_route", "spotify"),
    ).toBe(false);
  });
});
