import DialogDeleteConfirmation from "@/components/DialogDeleteConfirmation.vue";
import {
  eventbus,
  type DeleteConfirmationDialogEvent,
} from "@/plugins/eventbus";
import { enableAutoUnmount, flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { storeMock } = vi.hoisted(() => ({
  storeMock: {
    dialogActive: false,
  },
}));

vi.mock("@/plugins/store", () => ({
  store: storeMock,
}));

vi.mock("vue-i18n", async (importOriginal) => ({
  ...(await importOriginal<typeof import("vue-i18n")>()),
  useI18n: () => ({
    t: (key: string) => key,
  }),
}));

const passthroughStub = { template: "<div><slot /></div>" };
// the real dialog only mounts its content while it is open, so the stub does too
const DialogStub = {
  props: ["open"],
  emits: ["update:open"],
  template: '<div v-if="open"><slot /></div>',
};

function mountDialog() {
  return mount(DialogDeleteConfirmation, {
    global: {
      mocks: {
        $t: (key: string) => key,
      },
      stubs: {
        Button: {
          props: ["disabled"],
          template:
            '<button v-bind="$attrs" :disabled="disabled"><slot /></button>',
        },
        Dialog: DialogStub,
        DialogContent: passthroughStub,
        DialogFooter: passthroughStub,
        DialogHeader: passthroughStub,
        DialogTitle: passthroughStub,
      },
    },
  });
}

async function openDialog(
  overrides: Partial<DeleteConfirmationDialogEvent> = {},
) {
  const event: DeleteConfirmationDialogEvent = {
    message: "Remove it?",
    onConfirm: vi.fn(),
    ...overrides,
  };
  eventbus.emit("deleteConfirmationDialog", event);
  await flushPromises();
  return event;
}

describe("DialogDeleteConfirmation", () => {
  enableAutoUnmount(afterEach);

  beforeEach(() => {
    storeMock.dialogActive = false;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("keeps confirm disabled until the acknowledgement is ticked", async () => {
    const wrapper = mountDialog();
    const event = await openDialog({ acknowledgement: "I understand" });

    const confirm = wrapper.get('[data-testid="delete-confirmation-confirm"]');
    const checkbox = wrapper.get(
      '[data-testid="delete-confirmation-acknowledge"]',
    );
    expect(wrapper.text()).toContain("I understand");
    // the label is associated with the checkbox, so it can be clicked too
    expect(
      wrapper.get(`label[for="${checkbox.attributes("id")}"]`).text(),
    ).toBe("I understand");
    expect(confirm.attributes("disabled")).toBeDefined();

    await checkbox.trigger("click");
    expect(confirm.attributes("disabled")).toBeUndefined();

    await confirm.trigger("click");
    await flushPromises();
    expect(event.onConfirm).toHaveBeenCalledOnce();
  });

  it("enables confirm right away without an acknowledgement", async () => {
    const wrapper = mountDialog();
    const event = await openDialog();

    expect(
      wrapper.find('[data-testid="delete-confirmation-acknowledge"]').exists(),
    ).toBe(false);
    const confirm = wrapper.get('[data-testid="delete-confirmation-confirm"]');
    expect(confirm.attributes("disabled")).toBeUndefined();

    await confirm.trigger("click");
    await flushPromises();
    expect(event.onConfirm).toHaveBeenCalledOnce();
  });

  it("starts a later acknowledgement unticked", async () => {
    vi.useFakeTimers();
    const wrapper = mountDialog();
    await openDialog({ acknowledgement: "I understand" });
    await wrapper
      .get('[data-testid="delete-confirmation-acknowledge"]')
      .trigger("click");
    await wrapper
      .get('[data-testid="delete-confirmation-confirm"]')
      .trigger("click");
    await flushPromises();
    // the state is reset once the close animation has finished
    vi.advanceTimersByTime(200);

    await openDialog({ acknowledgement: "I understand" });

    expect(
      wrapper
        .get('[data-testid="delete-confirmation-acknowledge"]')
        .attributes("data-state"),
    ).toBe("unchecked");
    expect(
      wrapper
        .get('[data-testid="delete-confirmation-confirm"]')
        .attributes("disabled"),
    ).toBeDefined();
  });
});
