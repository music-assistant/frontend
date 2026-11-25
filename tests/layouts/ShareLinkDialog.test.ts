import ShareLinkDialog from "@/layouts/default/ShareLinkDialog.vue";
import { eventbus } from "@/plugins/eventbus";
import { flushPromises, mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { deflateRawSync } from "node:zlib";
import * as shareLinks from "@/helpers/share_links";
import { ApiCommandError } from "@/plugins/api";

const { apiMock, copyToClipboardMock, storeMock, toastError, toastSuccess } =
  vi.hoisted(() => ({
    apiMock: {
      generateShareLink: vi.fn(),
      getProviderName: vi.fn((domain: string) => domain),
    },
    copyToClipboardMock: vi.fn(),
    storeMock: { dialogActive: false },
    toastError: vi.fn(),
    toastSuccess: vi.fn(),
  }));

vi.mock("@/plugins/api", () => ({
  default: apiMock,
  ApiCommandError: class ApiCommandError extends Error {
    constructor(
      message: string,
      _errorCode: number,
      public readonly details?: string,
    ) {
      super(message);
    }
  },
}));
vi.mock("@/helpers/utils", () => ({ copyToClipboard: copyToClipboardMock }));
vi.mock("@/plugins/eventbus", () => ({
  eventbus: { on: vi.fn(), off: vi.fn() },
}));
vi.mock("@/plugins/i18n", () => ({ $t: (key: string) => key }));
vi.mock("@/plugins/store", () => ({ store: storeMock }));
vi.mock("vue-sonner", () => ({
  toast: { error: toastError, success: toastSuccess },
}));

const dialogStub = {
  props: ["open"],
  emits: ["update:open"],
  template:
    '<div v-if="open" data-testid="share-dialog"><button data-testid="close-dialog" @click="$emit(\'update:open\', false)">Close</button><slot /></div>',
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((complete, fail) => {
    resolve = complete;
    reject = fail;
  });
  return { promise, resolve, reject };
}

function shareUrl(title: string): string {
  const encoded = `1${deflateRawSync(Buffer.from(JSON.stringify({ type: "track", title }))).toString("base64url")}`;
  return `https://share.music-assistant.io/#${encoded}`;
}

function openPreview(uri: string): void {
  const handler = vi.mocked(eventbus.on).mock.calls[0]?.[1] as unknown as
    ((event: { uri: string }) => void) | undefined;
  if (!handler) throw new Error("Share preview handler was not registered");
  handler({ uri });
}

function mountDialog() {
  return mount(ShareLinkDialog, {
    global: {
      stubs: {
        Dialog: dialogStub,
        DialogContent: {
          inheritAttrs: false,
          props: ["overlayClass"],
          template:
            '<div data-testid="dialog-content" :class="$attrs.class" :data-overlay-class="overlayClass"><slot /></div>',
        },
        DialogDescription: { template: "<div><slot /></div>" },
        DialogTitle: { template: "<div><slot /></div>" },
        Button: {
          props: ["disabled"],
          emits: ["click"],
          template:
            '<button :disabled="disabled" @click="$emit(\'click\')"><slot /></button>',
        },
        ShareArtworkPreview: {
          props: ["title"],
          emits: ["copy-share-link"],
          template:
            '<button data-testid="copy-share" :data-title="title" @click="$emit(\'copy-share-link\')">Copy</button>',
        },
        ShareProviderLinkList: { template: "<div />" },
        Copy: true,
        LoaderCircle: true,
      },
    },
  });
}

beforeEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
  apiMock.generateShareLink.mockReset();
  copyToClipboardMock.mockReset();
  storeMock.dialogActive = false;
  apiMock.generateShareLink.mockResolvedValue(shareUrl("Track"));
  copyToClipboardMock.mockResolvedValue(true);
});

describe("ShareLinkDialog clipboard request state", () => {
  it.each(["details", "fallback"] as const)(
    "closes and reports a generation failure with %s",
    async (kind) => {
      const error = new ApiCommandError(
        "Generation failed",
        1,
        kind === "details" ? "Provider unavailable" : undefined,
      );
      apiMock.generateShareLink.mockRejectedValueOnce(error);
      const wrapper = mountDialog();
      openPreview("uri");
      await flushPromises();

      expect(wrapper.find('[data-testid="share-dialog"]').exists()).toBe(false);
      expect(toastError).toHaveBeenCalledExactlyOnceWith(
        kind === "details" ? "Provider unavailable" : "share.preview_failed",
      );
      wrapper.unmount();
    },
  );

  it("copies the share link, reports success and closes the dialog", async () => {
    const wrapper = mountDialog();
    openPreview("uri");
    await vi.waitFor(() =>
      expect(wrapper.find('[data-testid="copy-share"]').exists()).toBe(true),
    );
    await wrapper.get('[data-testid="copy-share"]').trigger("click");
    await flushPromises();

    expect(copyToClipboardMock).toHaveBeenCalledExactlyOnceWith(
      shareUrl("Track"),
    );
    expect(toastSuccess).toHaveBeenCalledExactlyOnceWith("share.link_copied");
    expect(wrapper.find('[data-testid="share-dialog"]').exists()).toBe(false);
    wrapper.unmount();
  });

  it.each(["false", "rejection"] as const)(
    "reports a clipboard %s and keeps the dialog open",
    async (outcome) => {
      if (outcome === "false") copyToClipboardMock.mockResolvedValueOnce(false);
      else
        copyToClipboardMock.mockRejectedValueOnce(
          new Error("Clipboard failed"),
        );
      const wrapper = mountDialog();
      openPreview("uri");
      await vi.waitFor(() =>
        expect(wrapper.find('[data-testid="copy-share"]').exists()).toBe(true),
      );
      await wrapper.get('[data-testid="copy-share"]').trigger("click");
      await flushPromises();

      expect(toastError).toHaveBeenCalledExactlyOnceWith(
        "share.link_copy_failed",
      );
      expect(toastSuccess).not.toHaveBeenCalled();
      expect(wrapper.find('[data-testid="share-dialog"]').exists()).toBe(true);
      wrapper.unmount();
    },
  );

  it("copies the MA link and all provider links as text", async () => {
    vi.spyOn(shareLinks, "decodeSharePreview").mockResolvedValueOnce({
      title: "Track",
      links: [
        {
          domain: "spotify",
          name: "Spotify",
          url: "https://open.spotify.com/track/1",
        },
        { domain: "tidal", name: "Tidal", url: "https://tidal.com/track/2" },
      ],
    });
    const wrapper = mountDialog();
    openPreview("uri");
    await flushPromises();
    const copyAll = wrapper
      .findAll("button")
      .find((button) => button.text().includes("share.copy_all"));
    expect(copyAll).toBeDefined();
    await copyAll!.trigger("click");
    await flushPromises();

    expect(copyToClipboardMock).toHaveBeenCalledExactlyOnceWith(
      `share.title: ${shareUrl("Track")}\nSpotify: https://open.spotify.com/track/1\nTidal: https://tidal.com/track/2`,
    );
    expect(toastSuccess).toHaveBeenCalledExactlyOnceWith("share.link_copied");
    expect(wrapper.find('[data-testid="share-dialog"]').exists()).toBe(false);
    wrapper.unmount();
  });

  it("layers the preview and backdrop above the mobile sidebar", async () => {
    const wrapper = mountDialog();
    openPreview("uri");
    await flushPromises();

    const dialogContent = wrapper.get('[data-testid="dialog-content"]');
    expect(dialogContent.classes()).toContain("z-[100001]");
    expect(dialogContent.attributes("data-overlay-class")).toBe("z-[100001]");
    wrapper.unmount();
  });

  it.each(["resolve", "reject"] as const)(
    "ignores a stale generation %s after the dialog closes",
    async (outcome) => {
      const pending = deferred<string>();
      apiMock.generateShareLink.mockReturnValueOnce(pending.promise);
      const wrapper = mountDialog();
      openPreview("pending-uri");
      await flushPromises();
      await wrapper.get('[data-testid="close-dialog"]').trigger("click");

      if (outcome === "resolve") pending.resolve(shareUrl("Old track"));
      else pending.reject(new Error("server unavailable"));
      await flushPromises();

      expect(wrapper.find('[data-testid="share-dialog"]').exists()).toBe(false);
      expect(toastError).not.toHaveBeenCalled();
      wrapper.unmount();
    },
  );

  it("restores an already active background dialog when Share closes", async () => {
    storeMock.dialogActive = true;
    const wrapper = mountDialog();
    openPreview("uri");
    await flushPromises();

    await wrapper.get('[data-testid="close-dialog"]').trigger("click");

    expect(storeMock.dialogActive).toBe(true);
    wrapper.unmount();
    expect(storeMock.dialogActive).toBe(true);
    storeMock.dialogActive = false;
  });

  it("clears its active state when unmounted while open", async () => {
    const wrapper = mountDialog();
    openPreview("uri");
    await flushPromises();

    expect(storeMock.dialogActive).toBe(true);
    wrapper.unmount();
    expect(storeMock.dialogActive).toBe(false);
  });

  it.each(["resolve", "reject"] as const)(
    "ignores a stale clipboard %s after a newer preview opens",
    async (outcome) => {
      const pending = deferred<boolean>();
      copyToClipboardMock.mockReturnValueOnce(pending.promise);
      const wrapper = mountDialog();
      openPreview("old-uri");
      await vi.waitFor(() =>
        expect(wrapper.find('[data-testid="copy-share"]').exists()).toBe(true),
      );
      await wrapper.get('[data-testid="copy-share"]').trigger("click");
      await wrapper.get('[data-testid="close-dialog"]').trigger("click");

      openPreview("new-uri");
      await vi.waitFor(() =>
        expect(wrapper.find('[data-testid="copy-share"]').exists()).toBe(true),
      );
      if (outcome === "resolve") pending.resolve(true);
      else pending.reject(new Error("clipboard failed"));
      await flushPromises();

      expect(wrapper.find('[data-testid="share-dialog"]').exists()).toBe(true);
      expect(toastSuccess).not.toHaveBeenCalled();
      expect(toastError).not.toHaveBeenCalled();
      wrapper.unmount();
    },
  );

  it.each(["resolve", "reject"] as const)(
    "ignores a stale preview decode %s after a newer preview opens",
    async (outcome) => {
      const pending = deferred<shareLinks.SharePreview>();
      apiMock.generateShareLink
        .mockResolvedValueOnce(shareUrl("Old"))
        .mockResolvedValueOnce(shareUrl("New"));
      vi.spyOn(shareLinks, "decodeSharePreview")
        .mockReturnValueOnce(pending.promise)
        .mockResolvedValueOnce({ title: "New", links: [] });
      const wrapper = mountDialog();
      openPreview("old-uri");
      await flushPromises();
      openPreview("new-uri");
      await flushPromises();
      if (outcome === "resolve") pending.resolve({ title: "Old", links: [] });
      else pending.reject(new Error("Invalid"));
      await flushPromises();
      expect(wrapper.find('[data-testid="copy-share"]').exists()).toBe(true);
      expect(
        wrapper.get('[data-testid="copy-share"]').attributes("data-title"),
      ).toBe("New");
      expect(toastError).not.toHaveBeenCalled();
      await wrapper.get('[data-testid="copy-share"]').trigger("click");
      expect(copyToClipboardMock).toHaveBeenCalledWith(shareUrl("New"));
      wrapper.unmount();
    },
  );

  it.each(["close", "unmount"] as const)(
    "ignores a preview decode after %s",
    async (action) => {
      const pending = deferred<shareLinks.SharePreview>();
      vi.spyOn(shareLinks, "decodeSharePreview").mockReturnValueOnce(
        pending.promise,
      );
      const wrapper = mountDialog();
      openPreview("uri");
      await flushPromises();
      if (action === "close")
        await wrapper.get('[data-testid="close-dialog"]').trigger("click");
      else wrapper.unmount();
      pending.reject(new Error("Invalid"));
      await flushPromises();
      expect(toastError).not.toHaveBeenCalled();
      if (action === "close") wrapper.unmount();
    },
  );
});
