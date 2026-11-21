import SettingsFoldRow from "@/components/settings/SettingsFoldRow.vue";
import SettingsFoldRows from "@/components/settings/SettingsFoldRows.vue";
import { ChevronDown, Settings2, TriangleAlert } from "@lucide/vue";
import { enableAutoUnmount, mount } from "@vue/test-utils";
import { afterEach, describe, expect, it } from "vitest";
import { defineComponent, markRaw, ref } from "vue";

enableAutoUnmount(afterEach);

const ROW = (value: string) => `[data-testid="settings-fold-${value}"]`;

describe("SettingsFoldRows", () => {
  it("shows each row closed at first, as its icon, label and description", () => {
    const wrapper = mountRows();

    for (const value of ["settings", "failures"]) {
      expect(isOpen(wrapper, value)).toBe(false);
    }
    const trigger = wrapper.get(ROW("settings")).get("button");
    expect(trigger.text()).toContain("Settings");
    expect(
      trigger.get('[data-testid="settings-fold-description"]').text(),
    ).toBe("How many tracks run at once");
    expect(trigger.findComponent(Settings2).exists()).toBe(true);
  });

  it("opens and closes a row from its header", async () => {
    const wrapper = mountRows();
    const trigger = wrapper.get(ROW("settings")).get("button");

    await trigger.trigger("click");
    expect(isOpen(wrapper, "settings")).toBe(true);
    expect(isOpen(wrapper, "failures")).toBe(false);
    expect(wrapper.vm.open).toEqual(["settings"]);

    await trigger.trigger("click");
    expect(isOpen(wrapper, "settings")).toBe(false);
    expect(wrapper.vm.open).toEqual([]);
  });

  it("opens several rows at once", async () => {
    const wrapper = mountRows();

    await wrapper.get(ROW("settings")).get("button").trigger("click");
    await wrapper.get(ROW("failures")).get("button").trigger("click");

    expect(wrapper.vm.open).toEqual(["settings", "failures"]);
  });

  it("opens the rows its model names", async () => {
    const wrapper = mountRows();

    wrapper.vm.open = ["failures"];
    await wrapper.vm.$nextTick();

    expect(isOpen(wrapper, "failures")).toBe(true);
    expect(isOpen(wrapper, "settings")).toBe(false);
  });

  it("keeps the content of a closed row mounted", async () => {
    const wrapper = mountRows();
    const trigger = wrapper.get(ROW("settings")).get("button");

    expect(wrapper.find('[data-testid="settings-body"]').exists()).toBe(true);
    await trigger.trigger("click");
    await wrapper.get('[data-testid="settings-body"]').setValue("4");
    await trigger.trigger("click");

    const body = wrapper.get<HTMLInputElement>('[data-testid="settings-body"]');
    expect(isOpen(wrapper, "settings")).toBe(false);
    expect(body.element.value).toBe("4");
  });

  it("opens a row from its content", async () => {
    const wrapper = mountRows();

    await wrapper.get('[data-testid="failures-open"]').trigger("click");
    expect(isOpen(wrapper, "failures")).toBe(true);

    // opening an open row keeps it open
    await wrapper.get('[data-testid="failures-open"]').trigger("click");
    expect(isOpen(wrapper, "failures")).toBe(true);
  });

  it("turns only the chevron of an open row", () => {
    const trigger = mountRows().get(ROW("settings")).get("button");

    // the trigger turns each svg directly in it when the row is open
    const svgs = trigger.element.querySelectorAll(":scope > svg");
    expect(svgs).toHaveLength(1);
    expect(trigger.getComponent(ChevronDown).element).toBe(svgs[0]);
  });

  it("shows the state of a row at its end, and on a line of its own on a phone", () => {
    const row = mountRows().get(ROW("failures"));

    expect(row.get('[data-testid="settings-fold-state"]').text()).toBe("32");
    expect(row.get('[data-testid="settings-fold-state-below"]').text()).toBe(
      "32",
    );
  });

  it.each([
    [{ warning: true }, "text-warning"],
    [{ error: true }, "text-destructive"],
    [{}, "text-muted-foreground"],
  ])("colours the state of a row with %o as %s", (flags, colour) => {
    const state = mountRows(flags)
      .get(ROW("failures"))
      .get('[data-testid="settings-fold-state"]');

    expect(state.classes()).toContain(colour);
  });

  it("leaves the state out of a row without one", () => {
    const row = mountRows().get(ROW("settings"));

    expect(row.find('[data-testid="settings-fold-state"]').exists()).toBe(
      false,
    );
  });
});

function isOpen(wrapper: ReturnType<typeof mountRows>, value: string) {
  return wrapper.get(ROW(value)).attributes("data-state") === "open";
}

// a card of two rows, the second with a state in the given colour flags
function mountRows(flags: { warning?: boolean; error?: boolean } = {}) {
  return mount(
    defineComponent({
      components: { SettingsFoldRow, SettingsFoldRows },
      setup() {
        return {
          open: ref<string[]>([]),
          flags,
          settingsIcon: markRaw(Settings2),
          failuresIcon: markRaw(TriangleAlert),
        };
      },
      template: `
        <SettingsFoldRows v-model="open">
          <SettingsFoldRow
            value="settings"
            :icon="settingsIcon"
            label="Settings"
            description="How many tracks run at once"
          >
            <input data-testid="settings-body" />
          </SettingsFoldRow>
          <SettingsFoldRow
            v-slot="{ open: openRow }"
            value="failures"
            :icon="failuresIcon"
            label="Failed tracks"
            description="Tracks the analysis skips"
            state="32"
            v-bind="flags"
          >
            <button data-testid="failures-open" @click="openRow">Open</button>
          </SettingsFoldRow>
        </SettingsFoldRows>
      `,
    }),
    { attachTo: document.body },
  );
}
