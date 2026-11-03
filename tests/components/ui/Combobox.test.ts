import {
  Combobox,
  ComboboxAnchor,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox";
import { enableAutoUnmount, flushPromises, mount } from "@vue/test-utils";
import type { AcceptableValue } from "reka-ui";
import { afterEach, describe, expect, it } from "vitest";
import { defineComponent, h, ref } from "vue";

enableAutoUnmount(afterEach);

function mountCombobox(multiple = false) {
  const model = ref<AcceptableValue | undefined>(multiple ? [] : undefined);
  const Harness = defineComponent(
    () => () =>
      h(
        Combobox,
        {
          modelValue: model.value,
          "onUpdate:modelValue": (value: AcceptableValue) => {
            model.value = value;
          },
          multiple,
          freeText: true,
        },
        () => [
          h(ComboboxAnchor, () => h(ComboboxInput)),
          h(ComboboxList, () =>
            h(ComboboxItem, { value: "jazz" }, () => "Jazz"),
          ),
        ],
      ),
  );
  mount(Harness, { attachTo: document.body });
  return model;
}

async function type(text: string) {
  const input = document.querySelector<HTMLInputElement>(
    "[data-slot='combobox-input']",
  )!;
  input.focus();
  input.value = text;
  input.dispatchEvent(new Event("input"));
  await flushPromises();
  return input;
}

describe("Combobox free text", () => {
  it("commits typed text that matches no item on Enter", async () => {
    const model = mountCombobox();
    const input = await type("ambient");

    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
    await flushPromises();

    expect(model.value).toBe("ambient");
  });

  it("commits typed text when leaving the field", async () => {
    const model = mountCombobox();
    const input = await type("ambient");

    input.dispatchEvent(new FocusEvent("blur"));
    await flushPromises();

    expect(model.value).toBe("ambient");
  });

  it("selects the highlighted item on Enter instead of the typed text", async () => {
    const model = mountCombobox();
    const input = await type("jaz");

    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
    await flushPromises();

    expect(model.value).toBe("jazz");
  });

  it("adds typed text to a multiple selection and clears the field", async () => {
    const model = mountCombobox(true);
    const input = await type("ambient");

    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
    await flushPromises();

    expect(model.value).toEqual(["ambient"]);
    expect(input.value).toBe("");
  });
});
