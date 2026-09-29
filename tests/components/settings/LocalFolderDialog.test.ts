import LocalFolderDialog from "@/components/settings/storage/LocalFolderDialog.vue";
import type { MusicAssistantApi } from "@/plugins/api";
import { ApiCommandError } from "@/plugins/api/errors";
import {
  enableAutoUnmount,
  flushPromises,
  mount,
  type VueWrapper,
} from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { StorageLocation } from "@/plugins/api/interfaces";
import { storageLocation } from "../../fixtures/storage";

const { apiMock, storeMock, toastMock } = vi.hoisted(() => ({
  apiMock: {
    addLocalFolder: vi.fn<MusicAssistantApi["addLocalFolder"]>(),
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

// an open dialog keeps document-level focus trap listeners, so tear it down
// even when an assertion fails
enableAutoUnmount(afterEach);

beforeEach(() => {
  vi.clearAllMocks();
  apiMock.addLocalFolder.mockResolvedValue(
    storageLocation({ path: "/home/me/Music" }),
  );
  document.body.innerHTML = "";
});

describe("LocalFolderDialog", () => {
  it("adds the folder at the path typed", async () => {
    const wrapper = await openDialog();

    await typePath("  /home/me/Music ");
    await submit();

    expect(apiMock.addLocalFolder).toHaveBeenCalledWith("/home/me/Music");
    expect(toastMock.success).toHaveBeenCalledWith(
      "settings.storage.folder_added",
    );
    expect(wrapper.emitted("added")).toHaveLength(1);
    expect(wrapper.emitted("update:open")).toEqual([[false]]);
  });

  it("asks for a path before adding", async () => {
    await openDialog();

    await submit();

    expect(apiMock.addLocalFolder).not.toHaveBeenCalled();
    expect(
      document.querySelector("[data-slot='field-error']")?.textContent?.trim(),
    ).toBe("auth.field_required");
  });

  it("shows why the server refused the folder under the path", async () => {
    const reason = "The folder does not exist.";
    apiMock.addLocalFolder.mockRejectedValue(
      new ApiCommandError(reason, 1, reason),
    );
    const wrapper = await openDialog();

    await typePath("/nope");
    await submit();

    expect(
      document.querySelector("[data-testid='folder-error']")?.textContent,
    ).toContain(reason);
    expect(wrapper.emitted("update:open")).toBeUndefined();

    // typing another path drops the reason that belonged to the previous one
    await typePath("/home/me/Music");
    expect(document.querySelector("[data-testid='folder-error']")).toBeNull();
  });
});

describe("LocalFolderDialog while it saves", () => {
  it("can not be closed or edited until the folder is added, then closes once", async () => {
    const added = deferred<StorageLocation>();
    apiMock.addLocalFolder.mockReturnValue(added.promise);
    const wrapper = await openDialog();
    await typePath("/home/me/Music");
    await submit();

    await pressEscape();
    expect(wrapper.emitted("update:open")).toBeUndefined();
    await click('[data-slot="dialog-close"]');
    expect(wrapper.emitted("update:open")).toBeUndefined();
    await click('[data-testid="folder-cancel"]');
    expect(wrapper.emitted("update:open")).toBeUndefined();

    expect(pathField().disabled).toBe(true);
    expect(
      document
        .querySelector('[data-testid="folder-cancel"]')
        ?.hasAttribute("disabled"),
    ).toBe(true);

    added.resolve(storageLocation({ path: "/home/me/Music" }));
    await flushPromises();

    expect(wrapper.emitted("update:open")).toEqual([[false]]);
  });

  it("stays open with the reason after a failed add and can then be closed", async () => {
    const added = deferred<StorageLocation>();
    apiMock.addLocalFolder.mockReturnValue(added.promise);
    const wrapper = await openDialog();
    await typePath("/nope");
    await submit();

    added.reject(
      new ApiCommandError(
        "The folder does not exist.",
        1,
        "The folder does not exist.",
      ),
    );
    await flushPromises();

    expect(wrapper.emitted("update:open")).toBeUndefined();
    expect(
      document.querySelector("[data-testid='folder-error']")?.textContent,
    ).toContain("The folder does not exist.");
    expect(pathField().disabled).toBe(false);

    await pressEscape();

    expect(wrapper.emitted("update:open")).toEqual([[false]]);
  });
});

async function openDialog(): Promise<VueWrapper> {
  const wrapper = mount(LocalFolderDialog, {
    props: { open: false },
    attachTo: document.body,
    global: { mocks: { $t: (key: string) => key } },
  });
  await wrapper.setProps({ open: true });
  await flushPromises();
  return wrapper;
}

async function typePath(value: string) {
  const input = document.querySelector<HTMLInputElement>(
    '[data-testid="folder-path"]',
  );
  if (!input) throw new Error("No path field");
  input.value = value;
  input.dispatchEvent(new Event("input"));
  await flushPromises();
}

async function submit() {
  document.querySelector("form")?.dispatchEvent(new Event("submit"));
  await flushPromises();
}

async function click(selector: string) {
  const element = document.querySelector<HTMLElement>(selector);
  if (!element) throw new Error(`Nothing matches ${selector}`);
  element.click();
  await flushPromises();
}

function pathField() {
  const input = document.querySelector<HTMLInputElement>(
    '[data-testid="folder-path"]',
  );
  if (!input) throw new Error("No path field");
  return input;
}

async function pressEscape() {
  document.activeElement?.dispatchEvent(
    new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
  );
  await flushPromises();
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
