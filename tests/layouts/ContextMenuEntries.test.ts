import type { ContextMenuItem } from "@/helpers/context_menu_item";
import ContextMenuEntries from "@/layouts/default/ContextMenuEntries.vue";
import { mount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";
import { ref } from "vue";

const { isTouch } = vi.hoisted(() => ({ isTouch: { value: false } }));

vi.mock("@vueuse/core", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@vueuse/core")>()),
  useMediaQuery: () => ref(isTouch.value),
}));

vi.mock("@/plugins/i18n", () => ({ $t: (key: string) => key }));

const passthroughStub = { template: "<div><slot /></div>" };

function mountEntries(items: ContextMenuItem[]) {
  return mount(ContextMenuEntries, {
    props: { items },
    global: {
      mocks: { $t: (key: string) => key },
      stubs: {
        // the extra button stands in for reka opening the submenu
        DropdownMenuSub: {
          props: ["open"],
          emits: ["update:open"],
          template:
            '<div :data-open="open"><button data-open-sub @click="$emit(\'update:open\', true)" /><slot /></div>',
        },
        DropdownMenuSubTrigger: passthroughStub,
        DropdownMenuSubContent: passthroughStub,
        DropdownMenuSeparator: true,
        DropdownMenuItem: {
          emits: ["select"],
          template:
            '<button v-bind="$attrs" data-item @click="$emit(\'select\', $event)"><slot /></button>',
        },
      },
    },
  });
}

describe("ContextMenuEntries", () => {
  it("renders a submenu inside a submenu and reports its entry", async () => {
    isTouch.value = false;
    const wrapper = mountEntries([
      {
        label: "queue",
        subItems: [
          {
            label: "transfer_queue",
            subItems: [{ label: "kitchen" }],
          },
        ],
      },
    ]);

    await wrapper.get("[data-item]").trigger("click");

    expect(wrapper.text()).toContain("transfer_queue");
    expect(wrapper.emitted("select")?.[0][1]).toMatchObject({
      label: "kitchen",
    });
    // hover leaves a submenu on a desktop
    expect(wrapper.find('[aria-label="back"]').exists()).toBe(false);
  });

  it("closes only the submenu from its back row on a touch screen", async () => {
    isTouch.value = true;
    const wrapper = mountEntries([
      { label: "queue", subItems: [{ label: "queue_clear" }] },
    ]);
    const submenu = wrapper.get("[data-open]");

    await wrapper.get("[data-open-sub]").trigger("click");
    expect(submenu.attributes("data-open")).toBe("true");

    await wrapper.get('[aria-label="back"]').trigger("click");

    expect(submenu.attributes("data-open")).toBe("false");
    expect(wrapper.emitted("select")).toBeUndefined();
  });
});
