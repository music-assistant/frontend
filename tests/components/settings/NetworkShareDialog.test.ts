import NetworkShareDialog from "@/components/settings/storage/NetworkShareDialog.vue";
import type { ManagedShareLocation } from "@/helpers/storage";
import type { MusicAssistantApi } from "@/plugins/api";
import { ApiCommandError } from "@/plugins/api/errors";
import { ShareType } from "@/plugins/api/interfaces";
import {
  enableAutoUnmount,
  flushPromises,
  mount,
  type VueWrapper,
} from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { managedShare } from "../../fixtures/storage";

const { apiMock, storeMock, toastMock } = vi.hoisted(() => ({
  apiMock: {
    addNetworkShare: vi.fn<MusicAssistantApi["addNetworkShare"]>(),
    updateNetworkShare: vi.fn<MusicAssistantApi["updateNetworkShare"]>(),
  },
  storeMock: { isTouchscreen: false },
  toastMock: { error: vi.fn(), success: vi.fn() },
}));

vi.mock("@/plugins/api", () => ({ api: apiMock, default: apiMock }));
vi.mock("@/plugins/store", () => ({ store: storeMock }));
vi.mock("@/plugins/i18n", () => ({
  $t: (key: string) => key,
  canonicalizeLocale: (locale: string) => locale,
}));
vi.mock("vue-i18n", async (importOriginal) => ({
  ...(await importOriginal<typeof import("vue-i18n")>()),
  useI18n: () => ({ t: (key: string) => key }),
}));
vi.mock("vue-sonner", () => ({ toast: toastMock }));

const share = managedShare();

// an open dialog keeps document-level focus trap listeners, so tear it down
// even when an assertion fails
enableAutoUnmount(afterEach);

beforeEach(() => {
  vi.clearAllMocks();
  apiMock.addNetworkShare.mockResolvedValue(share);
  apiMock.updateNetworkShare.mockResolvedValue(share);
  document.body.innerHTML = "";
});

describe("NetworkShareDialog", () => {
  it("adds an SMB share with its credentials", async () => {
    const wrapper = await openDialog();

    await type("share-server", "nas.local");
    await type("share-share", "music");
    await type("share-username", "marcel");
    await type("share-password", "secret");
    await submit();

    expect(apiMock.addNetworkShare).toHaveBeenCalledWith(ShareType.CIFS, {
      server: "nas.local",
      share: "music",
      username: "marcel",
      password: "secret",
      version: null,
      read_only: false,
    });
    expect(toastMock.success).toHaveBeenCalledWith(
      "settings.storage.share_added",
    );
    expect(wrapper.emitted("saved")).toHaveLength(1);
    expect(wrapper.emitted("update:open")).toEqual([[false]]);
  });

  it("asks for the server and the share before adding", async () => {
    const wrapper = await openDialog();

    await submit();

    expect(apiMock.addNetworkShare).not.toHaveBeenCalled();
    expect(document.querySelectorAll("[data-slot='field-error']")).toHaveLength(
      2,
    );
    expect(wrapper.emitted("update:open")).toBeUndefined();
  });

  it("asks an NFS share for its export and no credentials", async () => {
    await openDialog();

    await click(`[value="${ShareType.NFS}"]`);
    expect(field("share-username")).toBeNull();
    await type("share-server", "nas.local");
    await type("share-share", "/volume1/music");
    await submit();

    expect(apiMock.addNetworkShare).toHaveBeenCalledWith(ShareType.NFS, {
      server: "nas.local",
      share: "/volume1/music",
      username: null,
      version: null,
      read_only: false,
    });
  });

  it("offers a version behind the advanced toggle only where one can be chosen", async () => {
    await openDialog();

    expect(field("share-advanced")).not.toBeNull();

    await click(`[value="${ShareType.NFS}"]`);

    expect(field("share-advanced")).toBeNull();
  });

  it("offers a choice only between the share types this install can mount", async () => {
    await openDialog();

    expect(document.querySelectorAll("[role='radio']")).toHaveLength(2);
    expect(field("share-type")).toBeNull();
  });

  it("states the only share type this install can mount instead of offering it", async () => {
    await openDialog(null, [ShareType.CIFS]);

    expect(document.querySelectorAll("[role='radio']")).toHaveLength(0);
    expect(field("share-type")?.textContent?.trim()).toBe(
      "settings.storage.share_type.cifs",
    );
    // and preselects it
    expect(field("share-username")).not.toBeNull();
  });

  it("brings the revealed protocol version into view", async () => {
    const scrollIntoView = vi
      .spyOn(HTMLElement.prototype, "scrollIntoView")
      .mockImplementation(() => undefined);
    try {
      await openDialog();

      await click('[data-testid="share-advanced"]');

      expect(scrollIntoView).toHaveBeenCalledTimes(1);
      expect(scrollIntoView.mock.contexts[0]).toBe(
        document
          .getElementById(
            field("share-advanced")!.id.replace(/-advanced$/, "-version"),
          )
          ?.closest("[data-slot='field']"),
      );
    } finally {
      scrollIntoView.mockRestore();
    }
  });

  it("shows why the server refused the share and stays open", async () => {
    const reason = "Login failed for user marcel.";
    apiMock.addNetworkShare.mockRejectedValue(
      new ApiCommandError(reason, 1, reason),
    );
    const wrapper = await openDialog();

    await type("share-server", "nas.local");
    await type("share-share", "music");
    await submit();

    expect(
      document.querySelector("[data-testid='share-error']")?.textContent,
    ).toContain(reason);
    expect(wrapper.emitted("update:open")).toBeUndefined();
  });

  it("starts an edit from the share's settings, with an empty password", async () => {
    await openDialog(share);

    expect(field("share-server")?.value).toBe("nas.local");
    expect(field("share-share")?.value).toBe("music");
    expect(field("share-username")?.value).toBe("marcel");
    expect(field("share-password")?.value).toBe("");
    // the type of an existing share is fixed, so it is stated, not offered
    expect(document.querySelectorAll("[role='radio']")).toHaveLength(0);
    expect(field("share-type")?.textContent?.trim()).toBe(
      "settings.storage.share_type.cifs",
    );
  });

  it("replaces the settings of an existing share, keeping its password", async () => {
    const wrapper = await openDialog(share);

    await type("share-server", "192.168.1.10");
    await submit();

    expect(apiMock.updateNetworkShare).toHaveBeenCalledWith("nas_music", {
      server: "192.168.1.10",
      share: "music",
      username: "marcel",
      version: null,
      read_only: false,
    });
    expect(toastMock.success).toHaveBeenCalledWith(
      "settings.storage.share_saved",
    );
    expect(wrapper.emitted("saved")).toHaveLength(1);
  });

  it("closes without a call when nothing changed", async () => {
    const wrapper = await openDialog(share);

    await submit();

    expect(apiMock.updateNetworkShare).not.toHaveBeenCalled();
    expect(wrapper.emitted("saved")).toBeUndefined();
    expect(wrapper.emitted("update:open")).toEqual([[false]]);
  });
});

describe("NetworkShareDialog while it saves", () => {
  it("can not be closed or edited until the share is added, then closes once", async () => {
    const added = deferred<ManagedShareLocation>();
    apiMock.addNetworkShare.mockReturnValue(added.promise);
    const wrapper = await openDialog();
    await type("share-server", "nas.local");
    await type("share-share", "music");
    await submit();

    await pressEscape();
    expect(wrapper.emitted("update:open")).toBeUndefined();
    await click('[data-slot="dialog-close"]');
    expect(wrapper.emitted("update:open")).toBeUndefined();
    await click('[data-testid="share-cancel"]');
    expect(wrapper.emitted("update:open")).toBeUndefined();

    expect(isHeld(field("share-server"))).toBe(true);
    expect(isHeld(field("share-cancel"))).toBe(true);

    added.resolve(share);
    await flushPromises();

    expect(wrapper.emitted("update:open")).toEqual([[false]]);
  });

  it("stays open with the reason after a failed add and can then be closed", async () => {
    const added = deferred<ManagedShareLocation>();
    apiMock.addNetworkShare.mockReturnValue(added.promise);
    const wrapper = await openDialog();
    await type("share-server", "nas.local");
    await type("share-share", "music");
    await submit();

    added.reject(new ApiCommandError("Login failed.", 1, "Login failed."));
    await flushPromises();

    expect(wrapper.emitted("update:open")).toBeUndefined();
    expect(field("share-error")?.textContent).toContain("Login failed.");
    expect(isHeld(field("share-server"))).toBe(false);

    await pressEscape();

    expect(wrapper.emitted("update:open")).toEqual([[false]]);
  });
});

async function openDialog(
  location: ManagedShareLocation | null = null,
  shareTypes: ShareType[] = [ShareType.CIFS, ShareType.NFS],
): Promise<VueWrapper> {
  const wrapper = mount(NetworkShareDialog, {
    props: {
      open: false,
      location,
      shareTypes,
      shareVersions: {
        [ShareType.CIFS]: ["1.0", "2.0"],
        [ShareType.NFS]: [],
      },
    },
    attachTo: document.body,
    global: { mocks: { $t: (key: string) => key } },
  });
  await wrapper.setProps({ open: true });
  await flushPromises();
  return wrapper;
}

function field(testId: string) {
  return document.querySelector<HTMLInputElement>(`[data-testid="${testId}"]`);
}

async function type(testId: string, value: string) {
  const input = field(testId);
  if (!input) throw new Error(`No field ${testId}`);
  input.value = value;
  input.dispatchEvent(new Event("input"));
  await flushPromises();
}

async function click(selector: string) {
  const element = document.querySelector<HTMLElement>(selector);
  if (!element) throw new Error(`Nothing matches ${selector}`);
  element.click();
  await flushPromises();
}

async function submit() {
  document.querySelector("form")?.dispatchEvent(new Event("submit"));
  await flushPromises();
}

async function pressEscape() {
  document.activeElement?.dispatchEvent(
    new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
  );
  await flushPromises();
}

/** Whether a control takes no input, on its own or through a disabled fieldset. */
function isHeld(element: Element | null) {
  if (!element) throw new Error("No such control");
  return (
    element.hasAttribute("disabled") || !!element.closest("fieldset[disabled]")
  );
}

/** A promise the test settles by hand. */
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((settle, fail) => {
    resolve = settle;
    reject = fail;
  });
  return { promise, resolve, reject };
}
