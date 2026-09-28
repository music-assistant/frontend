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
