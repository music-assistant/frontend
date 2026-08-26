import SegmentedCodeInput from "@/components/SegmentedCodeInput.vue";
import {
  enableAutoUnmount,
  mount,
  type DOMWrapper,
  type VueWrapper,
} from "@vue/test-utils";
import { afterEach, describe, expect, it } from "vitest";
import { nextTick } from "vue";

// the per-character mode is exercised through the PairingCodeField suite; this
// suite covers the multi-character (grouped) mode and the readonly display
const GROUP_LAYOUT = [{ length: 4 }, { length: 3 }, { length: 4 }];

// the component moves real focus and carets, so it needs to live in the document
enableAutoUnmount(afterEach);

describe("SegmentedCodeInput (grouped boxes)", () => {
  it("caps each box at its length via the maxlength attribute", () => {
    const wrapper = mountInput();

    expect(boxes(wrapper).map((box) => box.attributes("maxlength"))).toEqual([
      "4",
      "3",
      "4",
    ]);
  });

  it("sanitizes typed input to bare uppercase characters", async () => {
    const wrapper = mountInput();

    await boxes(wrapper)[0].setValue("ab-c");
    await nextTick();

    expect(boxValues(wrapper)).toEqual(["ABC", "", ""]);
    expect(document.activeElement).not.toBe(boxes(wrapper)[1].element);
  });

  it("advances to the next box when one is typed full", async () => {
    const wrapper = mountInput();

    await boxes(wrapper)[0].setValue("abcd");
    await nextTick();

    expect(boxValues(wrapper)).toEqual(["ABCD", "", ""]);
    expect(document.activeElement).toBe(boxes(wrapper)[1].element);
  });

  it("spills overflowing input into the next box", async () => {
    const wrapper = mountInput();

    await boxes(wrapper)[0].setValue("abcdef");
    await nextTick();

    expect(boxValues(wrapper)).toEqual(["ABCD", "EF", ""]);
    const second = boxes(wrapper)[1].element as HTMLInputElement;
    expect(document.activeElement).toBe(second);
    expect(second.selectionStart).toBe(2);
  });

  it("fills every box from a paste of a separated code into the first box", async () => {
    const wrapper = mountInput();

    await paste(wrapper, 0, " abcd-efg-hijk ");

    expect(boxValues(wrapper)).toEqual(["ABCD", "EFG", "HIJK"]);
    expect(wrapper.emitted("update:modelValue")).toHaveLength(1);
    const last = boxes(wrapper)[2].element as HTMLInputElement;
    expect(document.activeElement).toBe(last);
    expect(last.selectionStart).toBe(4);
  });

  it("replaces everything when a full code is pasted into a later box", async () => {
    const wrapper = mountInput({ modelValue: ["ZZZZ", "ZZZ", "ZZZZ"] });

    await paste(wrapper, 1, "ABCD-EFG-HIJK");

    expect(boxValues(wrapper)).toEqual(["ABCD", "EFG", "HIJK"]);
  });

  it("distributes a partial paste from the box it lands in", async () => {
    const wrapper = mountInput({ modelValue: ["ABCD", "", ""] });

    await paste(wrapper, 1, "xy");

    expect(boxValues(wrapper)).toEqual(["ABCD", "XY", ""]);
  });

  it("moves the caret to the end of the previous box on backspace at the start", async () => {
    const wrapper = mountInput({ modelValue: ["ABCD", "EFG", ""] });
    const second = boxes(wrapper)[1].element as HTMLInputElement;
    second.focus();
    second.setSelectionRange(0, 0);

    await boxes(wrapper)[1].trigger("keydown", { key: "Backspace" });
    await nextTick();

    const first = boxes(wrapper)[0].element as HTMLInputElement;
    expect(document.activeElement).toBe(first);
    expect(first.selectionStart).toBe(4);
    // moving the caret must not delete anything
    expect(boxValues(wrapper)).toEqual(["ABCD", "EFG", ""]);
    expect(wrapper.emitted("update:modelValue")).toBeUndefined();
  });

  it("emits submit on Enter", async () => {
    const wrapper = mountInput();

    await boxes(wrapper)[0].trigger("keydown", { key: "Enter" });

    expect(wrapper.emitted("submit")).toHaveLength(1);
  });

  it("renders an externally set value (e.g. a scanned or stored code)", async () => {
    const wrapper = mountInput();

    await wrapper.setProps({ modelValue: ["ABCD", "EFG", "HIJK"] });

    expect(boxValues(wrapper)).toEqual(["ABCD", "EFG", "HIJK"]);
  });

  it("renders static boxes without inputs in readonly mode", () => {
    const wrapper = mount(SegmentedCodeInput, {
      props: {
        modelValue: ["ABCD", "EFG", "HIJK"],
        layout: GROUP_LAYOUT,
        readonly: true,
      },
    });

    expect(wrapper.findAll("input")).toHaveLength(0);
    expect(wrapper.find("[role='group']").exists()).toBe(false);
    expect(wrapper.text()).toContain("ABCD");
    expect(wrapper.text()).toContain("HIJK");
  });
});

function mountInput(props: Record<string, unknown> = {}): VueWrapper {
  const wrapper: VueWrapper = mount(SegmentedCodeInput, {
    props: {
      modelValue: ["", "", ""],
      layout: GROUP_LAYOUT,
      // write emissions back so the component behaves controlled, as in the app
      "onUpdate:modelValue": (value: string[]) => {
        wrapper.setProps({ modelValue: value });
      },
      ...props,
    },
    attachTo: document.body,
  });
  return wrapper;
}

function boxes(wrapper: VueWrapper): DOMWrapper<Element>[] {
  return wrapper.findAll("input");
}

function boxValues(wrapper: VueWrapper): string[] {
  return boxes(wrapper).map((box) => (box.element as HTMLInputElement).value);
}

/**
 * Dispatches a paste of `text` on the given box. Built by hand because the
 * ClipboardEvent constructor offers no way to carry clipboard data in tests.
 */
async function paste(wrapper: VueWrapper, index: number, text: string) {
  const event = new Event("paste", { bubbles: true, cancelable: true });
  Object.assign(event, { clipboardData: { getData: () => text } });
  boxes(wrapper)[index].element.dispatchEvent(event);
  await nextTick();
  await nextTick();
}
