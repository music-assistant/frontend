import {
  getPlayerActionProvider,
  isRefusedActionUrl,
  showActionResult,
} from "@/helpers/action_result";
import {
  type ConfigActionResult,
  type Player,
  ProviderTier,
} from "@/plugins/api/interfaces";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { apiMock, toastMock } = vi.hoisted(() => ({
  apiMock: {
    baseUrl: "",
    serverInfo: { value: { internal_url: null as string | null } },
    getProviderManifest: vi.fn(),
  },
  toastMock: { success: vi.fn(), warning: vi.fn() },
}));

vi.mock("vue-sonner", () => ({ toast: toastMock }));
vi.mock("@/plugins/i18n", () => ({ $t: (key: string) => key }));
vi.mock("@/plugins/api", () => ({ api: apiMock }));

const HOME_ADDRESS = "http://192.168.1.3:8095";

describe("showActionResult", () => {
  let click: ReturnType<typeof vi.spyOn>;
  const opened = () =>
    click.mock.contexts.map((anchor: unknown) =>
      (anchor as HTMLAnchorElement).getAttribute("href"),
    );

  beforeEach(() => {
    vi.clearAllMocks();
    apiMock.baseUrl = window.location.origin;
    apiMock.serverInfo.value = { internal_url: HOME_ADDRESS };
    apiMock.getProviderManifest.mockReturnValue({ tier: ProviderTier.CORE });
    click = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("says the message and opens the url of a result", () => {
    showActionResult(result({ message: "Linked", open_url: "https://a/b" }));

    expect(toastMock.success).toHaveBeenCalledExactlyOnceWith("Linked");
    expect(opened()).toEqual(["https://a/b"]);
  });

  it("says the action is done for a result without a message", () => {
    showActionResult(result({ open_url: "https://example.org/a" }));

    expect(toastMock.success).toHaveBeenCalledWith("settings.action_completed");
    expect(opened()).toEqual(["https://example.org/a"]);
  });

  it("opens only a web address", () => {
    showActionResult(
      result({ message: "Hi", open_url: "javascript:alert(1)" }),
    );

    expect(opened()).toEqual([]);
    expect(toastMock.success).toHaveBeenCalledWith("Hi");
  });

  it("says the action is done when the action answers nothing", () => {
    showActionResult(null);

    expect(toastMock.success).toHaveBeenCalledExactlyOnceWith(
      "settings.action_completed",
    );
    expect(opened()).toEqual([]);
  });

  describe("a url on the app's own origin", () => {
    const ownUrl = () => `${window.location.origin}/raw_route`;

    it("is refused from a community provider", () => {
      apiMock.getProviderManifest.mockReturnValue({
        tier: ProviderTier.COMMUNITY,
      });

      showActionResult(result({ open_url: ownUrl() }), "community_demo");

      expect(apiMock.getProviderManifest).toHaveBeenCalledWith(
        "community_demo",
      );
      expect(opened()).toEqual([]);
      expect(toastMock.warning).toHaveBeenCalledExactlyOnceWith(
        "settings.action_completed",
        { description: "settings.action_link_refused" },
      );
      expect(toastMock.success).not.toHaveBeenCalled();
    });

    it("is refused from a community provider on the server's home address", () => {
      apiMock.getProviderManifest.mockReturnValue({
        tier: ProviderTier.COMMUNITY,
      });

      showActionResult(
        result({ open_url: `${HOME_ADDRESS}/raw_route` }),
        "community_demo",
      );

      expect(opened()).toEqual([]);
    });

    it("opens from a built-in provider", () => {
      showActionResult(result({ open_url: ownUrl() }), "fastmcp_server");

      expect(opened()).toEqual([ownUrl()]);
      expect(toastMock.success).toHaveBeenCalledOnce();
    });

    it("opens a community provider's url elsewhere", () => {
      apiMock.getProviderManifest.mockReturnValue({
        tier: ProviderTier.COMMUNITY,
      });

      showActionResult(
        result({ open_url: "https://example.org/x" }),
        "community_demo",
      );

      expect(opened()).toEqual(["https://example.org/x"]);
    });
  });
});

describe("isRefusedActionUrl", () => {
  beforeEach(() => {
    apiMock.baseUrl = "http://ma.local:8095";
    apiMock.serverInfo.value = { internal_url: HOME_ADDRESS };
    apiMock.getProviderManifest.mockReturnValue({
      tier: ProviderTier.COMMUNITY,
    });
  });

  it.each([
    ["the app's own origin", () => `${window.location.origin}/x`],
    ["the address the app talks to", () => "http://ma.local:8095/x"],
    ["the server's home address", () => `${HOME_ADDRESS}/x`],
  ])("refuses a community provider's link to %s", (_where, url) => {
    expect(isRefusedActionUrl(url(), "community_demo")).toBe(true);
  });

  it("allows a link elsewhere, or an unreadable one", () => {
    expect(isRefusedActionUrl("https://example.org/x", "community_demo")).toBe(
      false,
    );
    expect(isRefusedActionUrl("not a url", "community_demo")).toBe(false);
  });

  it("allows any link from a built-in provider, or without one named", () => {
    const own = `${window.location.origin}/x`;
    expect(isRefusedActionUrl(own)).toBe(false);
    apiMock.getProviderManifest.mockReturnValue({ tier: ProviderTier.CORE });
    expect(isRefusedActionUrl(own, "fastmcp_server")).toBe(false);
  });
});

describe("getPlayerActionProvider", () => {
  const player = {
    provider: "sonos--1",
    output_protocols: [
      { output_protocol_id: "ap_123", protocol_domain: "airplay" },
    ],
  } as unknown as Player;

  it("names the player's own provider for its own action", () => {
    expect(getPlayerActionProvider(player, "reset")).toBe("sonos--1");
  });

  it("names the protocol's provider for an action of that protocol", () => {
    expect(getPlayerActionProvider(player, "ap_123||protocol||pair")).toBe(
      "airplay",
    );
  });

  it("names nothing for an unknown protocol or player", () => {
    expect(getPlayerActionProvider(player, "x||protocol||pair")).toBe(
      undefined,
    );
    expect(getPlayerActionProvider(undefined, "reset")).toBe(undefined);
  });
});

function result(overrides: Partial<ConfigActionResult>): ConfigActionResult {
  return { message: null, open_url: null, ...overrides };
}
