import ShareLinkDialog from "@/layouts/default/ShareLinkDialog.vue";
import { eventbus } from "@/plugins/eventbus";
import { flushPromises, mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";

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
    details?: string;
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
  const encoded = btoa(JSON.stringify({ type: "track", title }))
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
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
        DialogContent: { template: "<div><slot /></div>" },
        DialogDescription: { template: "<div><slot /></div>" },
        DialogTitle: { template: "<div><slot /></div>" },
        Button: {
          props: ["disabled"],
          emits: ["click"],
          template:
            '<button :disabled="disabled" @click="$emit(\'click\')"><slot /></button>',
        },
        ShareArtworkPreview: {
          emits: ["copy-share-link"],
          template:
            '<button data-testid="copy-share" @click="$emit(\'copy-share-link\')">Copy</button>',
        },
        ShareProviderLinkList: { template: "<div />" },
        Copy: true,
        LoaderCircle: true,
      },
    },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  storeMock.dialogActive = false;
  apiMock.generateShareLink.mockResolvedValue(shareUrl("Track"));
  copyToClipboardMock.mockResolvedValue(true);
});

describe("ShareLinkDialog clipboard request state", () => {
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
      await flushPromises();
      await wrapper.get('[data-testid="copy-share"]').trigger("click");
      await wrapper.get('[data-testid="close-dialog"]').trigger("click");

      openPreview("new-uri");
      await flushPromises();
      if (outcome === "resolve") pending.resolve(true);
      else pending.reject(new Error("clipboard failed"));
      await flushPromises();

      expect(wrapper.find('[data-testid="share-dialog"]').exists()).toBe(true);
      expect(toastSuccess).not.toHaveBeenCalled();
      expect(toastError).not.toHaveBeenCalled();
      wrapper.unmount();
    },
  );
});
