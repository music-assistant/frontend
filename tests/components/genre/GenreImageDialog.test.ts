import GenreImageDialog from "@/components/genre/GenreImageDialog.vue";
import { MAX_CUSTOM_IMAGE_BYTES } from "@/helpers/customImage";
import { ApiCommandError } from "@/plugins/api/errors";
import { eventbus } from "@/plugins/eventbus";
import { toast } from "vue-sonner";
import { enableAutoUnmount, flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { genre } from "../../fixtures/genre";
import { ImageType } from "@/plugins/api/interfaces";

const BASE64_DATA = "ZmFrZS1pbWFnZQ==";

const { apiMock, storeMock } = vi.hoisted(() => ({
  apiMock: {
    setGenreImage: vi.fn(),
    removeGenreImage: vi.fn(),
    baseUrl: "http://server",
    serverInfo: { value: { schema_version: 1 } },
  },
  storeMock: {
    isTouchscreen: false,
    dialogActive: false,
  },
}));

vi.mock("@/plugins/api", async () => {
  const { ApiCommandError } = await import("@/plugins/api/errors");
  return { api: apiMock, default: apiMock, ApiCommandError };
});
vi.mock("@/plugins/store", () => ({ store: storeMock }));
vi.mock("@/helpers/dspIR", () => ({
  readFileAsBase64: vi.fn(async () => "ZmFrZS1pbWFnZQ=="),
}));
vi.mock("vue-i18n", async (importOriginal) => ({
  ...(await importOriginal<typeof import("vue-i18n")>()),
  useI18n: () => ({ t: (key: string) => key }),
}));
vi.mock("vue-router", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("vue-sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

// an open dialog keeps document-level focus trap listeners, so tear it down
// even when an assertion fails
enableAutoUnmount(afterEach);

const originalCreateObjectURL = URL.createObjectURL;
const originalRevokeObjectURL = URL.revokeObjectURL;

beforeEach(() => {
  vi.clearAllMocks();
  storeMock.dialogActive = false;
  apiMock.setGenreImage.mockResolvedValue(genre());
  apiMock.removeGenreImage.mockResolvedValue(genre());
  // jsdom implements neither
  URL.createObjectURL = vi.fn(() => "blob:preview");
  URL.revokeObjectURL = vi.fn();
  document.body.innerHTML = "";
});

afterEach(() => {
  URL.createObjectURL = originalCreateObjectURL;
  URL.revokeObjectURL = originalRevokeObjectURL;
});

describe("GenreImageDialog", () => {
  it("refuses a file over the size limit before uploading", async () => {
    await openDialog(genre());

    await pickFile(oversizedFile());

    expect(errorText()).toBe("image_too_large");
    expect(apiMock.setGenreImage).not.toHaveBeenCalled();
  });

  it("uploads the picked file and closes the dialog", async () => {
    await openDialog(genre({ item_id: "7" }));

    await pickFile(new File(["x"], "cover.png"));
    await findButton("settings.save")!.click();
    await flushPromises();

    expect(apiMock.setGenreImage).toHaveBeenCalledWith(
      "7",
      BASE64_DATA,
      "cover.png",
    );
    expect(toast.success).toHaveBeenCalledWith("custom_image_updated");
    expect(dialog()).toBeNull();
  });

  it("shows the server's details inline when the upload is rejected", async () => {
    apiMock.setGenreImage.mockRejectedValue(
      new ApiCommandError(
        "Image exceeds the size limit",
        123,
        "Image exceeds the size limit",
      ),
    );
    await openDialog(genre());

    await pickFile(new File(["x"], "cover.png"));
    await findButton("settings.save")!.click();
    await flushPromises();

    expect(errorText()).toBe("Image exceeds the size limit");
    expect(dialog()).not.toBeNull();
  });

  it("falls back to the localized message when the rejection has no details", async () => {
    apiMock.setGenreImage.mockRejectedValue(new ApiCommandError("123", 123));
    await openDialog(genre());

    await pickFile(new File(["x"], "cover.png"));
    await findButton("settings.save")!.click();
    await flushPromises();

    expect(errorText()).toBe("custom_image_upload_failed");
  });

  it("removes the custom image of a genre that has one", async () => {
    await openDialog(
      genre({
        item_id: "5",
        metadata: {
          images: [
            {
              provider: "builtin",
              path: "custom_images/genre.1.x.png",
              type: ImageType.THUMB,
              remotely_accessible: false,
            },
          ],
        },
      }),
    );

    const remove = findButton("remove_custom_image");
    expect(remove).toBeDefined();
    await remove!.click();
    await flushPromises();

    expect(apiMock.removeGenreImage).toHaveBeenCalledWith("5");
    expect(toast.success).toHaveBeenCalledWith("custom_image_removed");
  });

  it("offers no remove button for a genre without a custom image", async () => {
    await openDialog(genre());

    expect(findButton("remove_custom_image")).toBeUndefined();
  });
});

function oversizedFile(): File {
  const file = new File([new Uint8Array(1)], "big.jpg");
  Object.defineProperty(file, "size", { value: MAX_CUSTOM_IMAGE_BYTES + 1 });
  return file;
}

function dialog() {
  return document.querySelector("[role='dialog']");
}

function errorText() {
  return document.querySelector("[role='alert']")?.textContent?.trim();
}

function findButton(text: string) {
  return Array.from(document.querySelectorAll("button")).find(
    (button) => button.textContent?.trim() === text,
  );
}

async function openDialog(item: ReturnType<typeof genre>) {
  const wrapper = mount(GenreImageDialog, {
    attachTo: document.body,
    global: { mocks: { $t: (key: string) => key } },
  });
  eventbus.emit("genreImageDialog", { genre: item });
  await flushPromises();
  return wrapper;
}

async function pickFile(file: File) {
  const input = document.querySelector<HTMLInputElement>("input[type='file']")!;
  Object.defineProperty(input, "files", { value: [file], configurable: true });
  input.dispatchEvent(new Event("change"));
  await flushPromises();
}
