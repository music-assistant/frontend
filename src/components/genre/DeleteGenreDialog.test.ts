import { flushPromises, mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { nextTick } from "vue";
import DeleteGenreDialog from "./DeleteGenreDialog.vue";
import { ApiCommandError } from "@/plugins/api/errors";

const {
  removeGenreFromLibrary,
  emit,
  on,
  off,
  success,
  error,
  backFromMediaDetails,
} = vi.hoisted(() => ({
  removeGenreFromLibrary: vi.fn(),
  emit: vi.fn(),
  on: vi.fn(),
  off: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
  backFromMediaDetails: vi.fn(),
}));
vi.mock("@/plugins/api", async () => ({
  ApiCommandError: (await import("@/plugins/api/errors")).ApiCommandError,
  api: { removeGenreFromLibrary },
}));
vi.mock("@/plugins/eventbus", () => ({ eventbus: { emit, on, off } }));
vi.mock("@/plugins/store", () => ({ store: { dialogActive: false } }));
vi.mock("@/helpers/navigation", () => ({ backFromMediaDetails }));
vi.mock("vue-router", () => ({ useRouter: () => ({}) }));
vi.mock("vue-i18n", async (importOriginal) => ({
  ...(await importOriginal<typeof import("vue-i18n")>()),
  useI18n: () => ({
    t: (key: string, args?: number[]) => `${key}${args ? `:${args[0]}` : ""}`,
  }),
}));
vi.mock("vue-sonner", () => ({ toast: { success, error } }));

function deferred() {
  let resolve!: () => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<void>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function mountDialog() {
  return mount(DeleteGenreDialog, {
    global: {
      mocks: {
        $t: (key: string, args?: number[]) =>
          `${key}${args ? `:${args[0]}` : ""}`,
      },
      stubs: {
        Dialog: {
          name: "Dialog",
          props: ["open"],
          emits: ["update:open"],
          template: '<div data-test="dialog" :data-open="open"><slot /></div>',
        },
        DialogContent: {
          name: "DialogContent",
          props: ["showCloseButton"],
          emits: ["escapeKeyDown", "interactOutside"],
          template:
            '<div data-test="content" :data-close-button="showCloseButton"><slot /></div>',
        },
        DialogHeader: { template: "<div><slot /></div>" },
        DialogTitle: { template: "<div><slot /></div>" },
        DialogFooter: { template: "<div><slot /></div>" },
        Button: {
          props: ["disabled"],
          template: '<button :disabled="disabled"><slot /></button>',
        },
      },
    },
  });
}

type DialogWrapper = ReturnType<typeof mountDialog>;

function openDialog(ids: string[], navigateBack = false) {
  const callback = on.mock.calls.find(
    ([event]) => event === "deleteGenreDialog",
  )?.[1];
  expect(callback).toBeTypeOf("function");
  callback({ genreIds: ids, navigateBack });
}

async function confirm(wrapper: DialogWrapper) {
  const deleteButton = wrapper.findAll("button")[1];
  await deleteButton.trigger("click");
  expect(wrapper.text()).toContain("confirm_delete_genre_2");
  await deleteButton.trigger("click");
}

describe("DeleteGenreDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    removeGenreFromLibrary.mockReset();
  });

  it("requires two confirmations and waits for deletion before success or navigation", async () => {
    const pending = deferred();
    removeGenreFromLibrary.mockReturnValue(pending.promise);
    const wrapper = mountDialog();
    try {
      openDialog(["genre-1"], true);
      await nextTick();
      const deleteButton = wrapper.findAll("button")[1];
      await deleteButton.trigger("click");
      expect(removeGenreFromLibrary).not.toHaveBeenCalled();
      await deleteButton.trigger("click");
      await deleteButton.trigger("click");
      expect(removeGenreFromLibrary).toHaveBeenCalledExactlyOnceWith("genre-1");
      expect(deleteButton.attributes("disabled")).toBeDefined();
      expect(success).not.toHaveBeenCalled();
      expect(backFromMediaDetails).not.toHaveBeenCalled();
      pending.resolve();
      await flushPromises();
      expect(success).toHaveBeenCalledExactlyOnceWith("genre_deleted");
      expect(backFromMediaDetails).toHaveBeenCalledTimes(1);
      expect(emit).toHaveBeenCalledWith("clearSelection");
      expect(wrapper.find('[data-test="dialog"]').attributes("data-open")).toBe(
        "false",
      );
    } finally {
      wrapper.unmount();
    }
  });

  it("keeps the current batch open despite Cancel, Escape, outside click, close update, or a new open event", async () => {
    const pending = deferred();
    removeGenreFromLibrary
      .mockReturnValueOnce(pending.promise)
      .mockResolvedValue(undefined);
    const wrapper = mountDialog();
    try {
      openDialog(["old-1", "old-2"], true);
      await nextTick();
      await confirm(wrapper);
      const cancel = wrapper.findAll("button")[0];
      const content = wrapper.findComponent({ name: "DialogContent" });
      const dialog = wrapper.findComponent({ name: "Dialog" });
      expect(cancel.attributes("disabled")).toBeDefined();
      expect(content.attributes("data-close-button")).toBe("false");
      await cancel.trigger("click");
      for (const eventName of ["escapeKeyDown", "interactOutside"]) {
        const event = { preventDefault: vi.fn() };
        content.vm.$emit(eventName, event);
        expect(event.preventDefault).toHaveBeenCalledTimes(1);
      }
      dialog.vm.$emit("update:open", false);
      openDialog(["new-1"]);
      await nextTick();
      expect(wrapper.find('[data-test="dialog"]').attributes("data-open")).toBe(
        "true",
      );
      expect(wrapper.text()).toContain("delete_genres:2");
      expect(removeGenreFromLibrary.mock.calls.map(([id]) => id)).toEqual([
        "old-1",
      ]);
      pending.resolve();
      await flushPromises();
      expect(removeGenreFromLibrary.mock.calls.map(([id]) => id)).toEqual([
        "old-1",
        "old-2",
      ]);
      expect(success).toHaveBeenCalledExactlyOnceWith("genres_deleted:2");
      expect(backFromMediaDetails).toHaveBeenCalledTimes(1);
      expect(emit).toHaveBeenCalledWith("clearSelection");
    } finally {
      wrapper.unmount();
    }
  });

  it("allows normal cancellation and resets confirmation on the next opening", async () => {
    const wrapper = mountDialog();
    try {
      openDialog(["old-1"]);
      await nextTick();
      await wrapper.findAll("button")[1].trigger("click");
      await wrapper.findAll("button")[0].trigger("click");
      await nextTick();
      expect(wrapper.find('[data-test="dialog"]').attributes("data-open")).toBe(
        "false",
      );
      openDialog(["new-1", "new-2"]);
      await nextTick();
      expect(wrapper.text()).toContain("confirm_delete_genres:2");
      await wrapper.findAll("button")[1].trigger("click");
      expect(removeGenreFromLibrary).not.toHaveBeenCalled();
    } finally {
      wrapper.unmount();
    }
  });

  it("reports acknowledged partial success and retries only remaining IDs", async () => {
    removeGenreFromLibrary
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error("network"))
      .mockResolvedValue(undefined);
    const wrapper = mountDialog();
    try {
      openDialog(["genre-1", "genre-2", "genre-3"], true);
      await nextTick();
      await confirm(wrapper);
      await flushPromises();
      expect(success).toHaveBeenCalledExactlyOnceWith("genre_deleted");
      expect(error).toHaveBeenCalledExactlyOnceWith("delete_genres_failed");
      expect(wrapper.text()).toContain("delete_genres:2");
      expect(wrapper.find('[data-test="dialog"]').attributes("data-open")).toBe(
        "true",
      );
      expect(backFromMediaDetails).not.toHaveBeenCalled();
      expect(emit).not.toHaveBeenCalledWith("clearSelection");
      await wrapper.findAll("button")[1].trigger("click");
      await flushPromises();
      expect(removeGenreFromLibrary.mock.calls.map(([id]) => id)).toEqual([
        "genre-1",
        "genre-2",
        "genre-2",
        "genre-3",
      ]);
      expect(success).toHaveBeenLastCalledWith("genres_deleted:2");
      expect(backFromMediaDetails).toHaveBeenCalledTimes(1);
      expect(emit).toHaveBeenCalledWith("clearSelection");
    } finally {
      wrapper.unmount();
    }
  });

  it.each([
    {
      failure: new ApiCommandError("No permission", 1, "No permission"),
      localToast: false,
    },
    { failure: new Error("network"), localToast: true },
  ])(
    "does not duplicate API command error feedback ($localToast)",
    async ({ failure, localToast }) => {
      removeGenreFromLibrary.mockRejectedValueOnce(failure);
      const wrapper = mountDialog();
      try {
        openDialog(["genre-1"]);
        await nextTick();
        await confirm(wrapper);
        await flushPromises();
        expect(error).toHaveBeenCalledTimes(localToast ? 1 : 0);
        if (localToast)
          expect(error).toHaveBeenCalledWith("delete_genre_failed");
        expect(success).not.toHaveBeenCalled();
        expect(wrapper.text()).toContain("confirm_delete_genre_2");
      } finally {
        wrapper.unmount();
      }
    },
  );

  it("stops after an in-flight removal settles on unmount without stale UI, toast, or navigation", async () => {
    const pending = deferred();
    removeGenreFromLibrary.mockReturnValueOnce(pending.promise);
    const wrapper = mountDialog();
    openDialog(["genre-1", "genre-2"], true);
    await nextTick();
    await confirm(wrapper);
    wrapper.unmount();
    pending.resolve();
    await flushPromises();
    expect(removeGenreFromLibrary).toHaveBeenCalledExactlyOnceWith("genre-1");
    expect(success).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
    expect(backFromMediaDetails).not.toHaveBeenCalled();
    expect(emit).not.toHaveBeenCalledWith("clearSelection");
    expect(off).toHaveBeenCalledWith("deleteGenreDialog");
  });

  it("does not report an in-flight rejection after unmount", async () => {
    const pending = deferred();
    removeGenreFromLibrary.mockReturnValueOnce(pending.promise);
    const wrapper = mountDialog();
    openDialog(["genre-1"]);
    await nextTick();
    await confirm(wrapper);
    wrapper.unmount();
    pending.reject(new Error("network"));
    await flushPromises();
    expect(error).not.toHaveBeenCalled();
    expect(success).not.toHaveBeenCalled();
  });
});
