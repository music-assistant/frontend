import PartyQR from "@/components/party/PartyQR.vue";
import { flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  canShare: vi.fn(),
  copyToClipboard: vi.fn(),
  createInvitationFile: vi.fn(),
  partyConfig: { value: null as Record<string, unknown> | null },
  sendCommand: vi.fn(),
  share: vi.fn(),
  subscribe: vi.fn(),
  toastError: vi.fn(),
  toCanvas: vi.fn(),
}));

vi.mock("@/composables/usePartyConfig", () => ({
  usePartyConfig: () => ({ config: mocks.partyConfig }),
}));

vi.mock("@/helpers/invitation_share", () => ({
  createInvitationFile: mocks.createInvitationFile,
}));

vi.mock("@/helpers/utils", () => ({
  copyToClipboard: mocks.copyToClipboard,
}));

vi.mock("@/plugins/api", () => ({
  default: {
    providers: { party: { domain: "party" } },
    sendCommand: mocks.sendCommand,
    subscribe: mocks.subscribe,
  },
}));

vi.mock("@/plugins/i18n", () => ({
  $t: (key: string, values?: unknown[]) => {
    const translations: Record<string, string> = {
      "providers.party.copy_link": "Copy link",
      "providers.party.link_copy_fail": "Failed to copy link",
      "providers.party.link_copy_success": "Link copied!",
      "providers.party.more_share_options": "More sharing options",
      "providers.party.qr_default_text": "Scan to join",
      "providers.party.share_description": "Join the party",
      "providers.party.share_failed": "Couldn't share the invitation",
      "providers.party.share_invitation": "Share invitation",
      "providers.party.share_title": "Join the Music Assistant party",
    };
    if (key === "providers.party.share_named_title") {
      return `Join ${values?.[0]}`;
    }
    return translations[key] ?? key;
  },
}));

vi.mock("qrcode", () => ({
  default: {
    toCanvas: mocks.toCanvas,
  },
}));

vi.mock("vue-sonner", () => ({
  toast: {
    error: mocks.toastError,
  },
}));

const JOIN_LINK = "https://example.com/party?join=abc";
const originalShare = Object.getOwnPropertyDescriptor(navigator, "share");
const originalCanShare = Object.getOwnPropertyDescriptor(navigator, "canShare");

describe("PartyQR", () => {
  let invitationFile: File;

  beforeEach(() => {
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe() {}
        disconnect() {}
      },
    );
    setNavigatorProperty("share", mocks.share);
    setNavigatorProperty("canShare", mocks.canShare);

    invitationFile = new File(["image"], "music-assistant-invitation.png", {
      type: "image/png",
    });
    mocks.partyConfig.value = {
      party_name: "Friday party",
      qr_text: "Bring your requests",
    };
    mocks.canShare.mockReset().mockReturnValue(true);
    mocks.copyToClipboard.mockReset().mockResolvedValue(true);
    mocks.createInvitationFile.mockReset().mockResolvedValue(invitationFile);
    mocks.sendCommand.mockReset().mockResolvedValue(JOIN_LINK);
    mocks.share.mockReset().mockResolvedValue(undefined);
    mocks.subscribe.mockReset().mockReturnValue(vi.fn());
    mocks.toastError.mockReset();
    mocks.toCanvas.mockReset().mockResolvedValue(undefined);
  });

  afterEach(() => {
    restoreNavigatorProperty("share", originalShare);
    restoreNavigatorProperty("canShare", originalCanShare);
    vi.unstubAllGlobals();
  });

  it("shares a branded invitation when native file sharing is supported", async () => {
    const wrapper = mount(PartyQR);
    await flushPromises();

    expect(mocks.createInvitationFile).toHaveBeenCalledWith({
      description: "Bring your requests",
      joinLink: JOIN_LINK,
      logoUrl: expect.stringContaining("logo"),
      title: "Join Friday party",
    });

    await wrapper
      .get('[data-testid="invitation-share-primary"]')
      .trigger("click");
    await flushPromises();

    expect(mocks.share).toHaveBeenCalledWith({
      files: [invitationFile],
      text: "Bring your requests",
      title: "Join Friday party",
      url: JOIN_LINK,
    });
    expect(mocks.copyToClipboard).not.toHaveBeenCalled();
    wrapper.unmount();
  });

  it("keeps copy link available alongside native sharing", async () => {
    const wrapper = mount(PartyQR);
    await flushPromises();

    await wrapper.get('[data-testid="invitation-share-menu"]').trigger("click");
    await flushPromises();
    const copyAction = document.querySelector<HTMLElement>(
      '[data-testid="invitation-share-copy"]',
    );
    expect(copyAction).not.toBeNull();

    copyAction?.click();
    await flushPromises();

    expect(mocks.copyToClipboard).toHaveBeenCalledWith(JOIN_LINK);
    expect(mocks.share).not.toHaveBeenCalled();
    wrapper.unmount();
  });

  it("keeps the QR code itself as a copy shortcut", async () => {
    const wrapper = mount(PartyQR);
    await flushPromises();

    await wrapper.get(".qr-link").trigger("click");
    await flushPromises();

    expect(mocks.copyToClipboard).toHaveBeenCalledWith(JOIN_LINK);
    wrapper.unmount();
  });

  it("shares the title, description, and link when files are unsupported", async () => {
    mocks.canShare.mockReturnValue(false);
    const wrapper = mount(PartyQR);
    await flushPromises();

    expect(mocks.createInvitationFile).not.toHaveBeenCalled();
    await wrapper
      .get('[data-testid="invitation-share-primary"]')
      .trigger("click");
    await flushPromises();

    expect(mocks.share).toHaveBeenCalledWith({
      text: "Bring your requests",
      title: "Join Friday party",
      url: JOIN_LINK,
    });
    wrapper.unmount();
  });

  it("uses copy as the primary action when native sharing is unavailable", async () => {
    setNavigatorProperty("share", undefined);
    setNavigatorProperty("canShare", undefined);
    const wrapper = mount(PartyQR);
    await flushPromises();

    const action = wrapper.get('[data-testid="invitation-share-primary"]');
    expect(action.text()).toBe("Copy link");
    expect(wrapper.find('[data-testid="invitation-share-menu"]').exists()).toBe(
      false,
    );

    await action.trigger("click");

    expect(mocks.copyToClipboard).toHaveBeenCalledWith(JOIN_LINK);
    expect(mocks.share).not.toHaveBeenCalled();
    wrapper.unmount();
  });

  it("does not report closing the native share sheet as an error", async () => {
    const cancellation = new Error("Share cancelled");
    cancellation.name = "AbortError";
    mocks.share.mockRejectedValue(cancellation);
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    const wrapper = mount(PartyQR);
    await flushPromises();

    await wrapper
      .get('[data-testid="invitation-share-primary"]')
      .trigger("click");
    await flushPromises();

    expect(mocks.toastError).not.toHaveBeenCalled();
    expect(consoleError).not.toHaveBeenCalled();
    wrapper.unmount();
  });

  it("reports native sharing failures", async () => {
    const error = new Error("Sharing failed");
    mocks.share.mockRejectedValue(error);
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    const wrapper = mount(PartyQR);
    await flushPromises();

    await wrapper
      .get('[data-testid="invitation-share-primary"]')
      .trigger("click");
    await flushPromises();

    expect(consoleError).toHaveBeenCalledWith(
      "Failed to share invitation:",
      error,
    );
    expect(mocks.toastError).toHaveBeenCalledWith(
      "Couldn't share the invitation",
    );
    wrapper.unmount();
  });
});

function setNavigatorProperty(property: "share" | "canShare", value: unknown) {
  Object.defineProperty(navigator, property, {
    configurable: true,
    value,
  });
}

function restoreNavigatorProperty(
  property: "share" | "canShare",
  descriptor: PropertyDescriptor | undefined,
) {
  if (descriptor) {
    Object.defineProperty(navigator, property, descriptor);
  } else {
    Reflect.deleteProperty(navigator, property);
  }
}
