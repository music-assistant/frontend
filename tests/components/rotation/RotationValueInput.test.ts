import RotationValueInput from "@/components/rotation/RotationValueInput.vue";
import type { RotationFieldInfo } from "@/plugins/api/interfaces";
import { enableAutoUnmount, mount } from "@vue/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";
import { i18n } from "@/plugins/i18n";

vi.mock("@/plugins/api", () => ({
  default: { getItemByUri: vi.fn(async () => ({ name: "Die drei ???" })) },
}));

enableAutoUnmount(afterEach);

const ARTIST = {
  name: "artist",
  type: "ref",
  label: "Artist",
  operators: ["is", "contains"],
  sortable: true,
} as unknown as RotationFieldInfo;

function mountInput(op: string, modelValue: unknown) {
  return mount(RotationValueInput, {
    global: { plugins: [i18n] },
    props: { field: ARTIST, op, modelValue },
    attachTo: document.body,
  });
}

describe("RotationValueInput for a reference field", () => {
  it("shows a text input for contains and emits the typed text", async () => {
    const wrapper = mountInput("contains", "");
    const input = wrapper.find("input");
    expect(input.exists()).toBe(true);
    expect(wrapper.findComponent({ name: "RotationRefPicker" }).exists()).toBe(
      false,
    );
    await input.setValue("Fuchsbande");
    expect(wrapper.emitted("update:modelValue")?.at(-1)).toEqual([
      "Fuchsbande",
    ]);
  });

  it("keeps the picker for is", () => {
    const wrapper = mountInput("is", null);
    expect(wrapper.findComponent({ name: "RotationRefPicker" }).exists()).toBe(
      true,
    );
    expect(wrapper.find("input").exists()).toBe(false);
  });
});

describe("RotationValueInput words between inputs", () => {
  it("keeps the words between the range inputs small and grey", () => {
    const year = {
      name: "year",
      type: "number",
      label: "Year",
      operators: ["between"],
      sortable: true,
    } as unknown as RotationFieldInfo;
    const wrapper = mount(RotationValueInput, {
      global: { plugins: [i18n] },
      props: { field: year, op: "between", modelValue: [1990, 1999] },
    });
    const words = wrapper.find('[data-testid="rotation-value-words"]');
    expect(words.exists()).toBe(true);
    expect(words.classes()).toEqual(
      expect.arrayContaining(["text-sm", "text-muted-foreground"]),
    );
    expect(words.text()).toContain("and");
  });
});
