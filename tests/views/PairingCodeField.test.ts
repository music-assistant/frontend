import {
  enableAutoUnmount,
  mount,
  type DOMWrapper,
  type VueWrapper,
} from "@vue/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";
import { nextTick } from "vue";
import { createVuetify } from "vuetify";
import * as components from "vuetify/components";
import * as directives from "vuetify/directives";
import { ConfigEntryType, type ConfigEntry } from "@/plugins/api/interfaces";
import type { ConfigEntryUI } from "@/helpers/config_entry_ui";
import PairingCodeField from "@/views/settings/fields/PairingCodeField.vue";

vi.mock("@/plugins/i18n", () => ({
  $t: (key: string) => key,
}));

const vuetify = createVuetify({ components, directives });

// the field moves real focus between its boxes, so it needs to live in the document
enableAutoUnmount(afterEach);

describe("PairingCodeField", () => {
  it("renders a box per code character and the separator", () => {
    const wrapper = mountField();

    expect(boxes(wrapper)).toHaveLength(6);
    expect(wrapper.find(".pairing-code-separator").text()).toBe("-");
  });

  it("emits null until the last digit completes the code", async () => {
    const wrapper = mountField();

    await typeCode(wrapper, "123456");

    expect(wrapper.emitted("update:value")).toEqual([
      [null],
      [null],
      [null],
      [null],
      [null],
      ["123456"],
    ]);
  });

  it("drops a letter typed into a digit box", async () => {
    const wrapper = mountField();
    const first = boxes(wrapper)[0];
    (first.element as HTMLInputElement).focus();

    await first.setValue("a");
    await nextTick();

    expect(boxValues(wrapper)[0]).toBe("");
    expect(document.activeElement).toBe(first.element);
    expect(wrapper.emitted("update:value")).toEqual([[null]]);
  });

  it("uppercases letters in an alphanumeric format", async () => {
    const wrapper = mountField({ format: "XXXX-XXXX" });

    await typeCode(wrapper, "abcd1234");

    expect(boxValues(wrapper).join("")).toBe("ABCD1234");
    expect(wrapper.emitted("update:value")!.at(-1)).toEqual(["ABCD1234"]);
  });

  it("moves to and clears the previous box on backspace in an empty box", async () => {
    const wrapper = mountField();
    await typeCode(wrapper, "123");

    await boxes(wrapper)[3].trigger("keydown", { key: "Backspace" });
    await nextTick();

    expect(boxValues(wrapper)).toEqual(["1", "2", "", "", "", ""]);
    expect(document.activeElement).toBe(boxes(wrapper)[2].element);
  });

  it.each(["123-456", " 123 456 "])(
    "fills every box from a paste of '%s' into the first box",
    async (text) => {
      const wrapper = mountField();

      await paste(wrapper, 0, text);

      expect(boxValues(wrapper)).toEqual(["1", "2", "3", "4", "5", "6"]);
      expect(wrapper.emitted("update:value")).toEqual([["123456"]]);
    },
  );

  // mobile keyboards and OTP autofill can deliver the whole code in one input event
  it("fills every box from a single input event carrying the full code", async () => {
    const wrapper = mountField();

    await boxes(wrapper)[0].setValue("123456");
    await nextTick();

    expect(boxValues(wrapper)).toEqual(["1", "2", "3", "4", "5", "6"]);
    expect(wrapper.emitted("update:value")).toEqual([["123456"]]);
  });

  it("emits null again when a character is cleared after completion", async () => {
    const wrapper = mountField();
    await typeCode(wrapper, "123456");

    await boxes(wrapper)[5].trigger("keydown", { key: "Backspace" });

    expect(wrapper.emitted("update:value")!.at(-1)).toEqual([null]);
  });

  it("disables every box", () => {
    const states = (disabled: boolean) =>
      boxes(mountField({}, disabled)).map(
        (box) => box.attributes("disabled") !== undefined,
      );

    expect(states(false)).toEqual(Array.from({ length: 6 }, () => false));
    expect(states(true)).toEqual(Array.from({ length: 6 }, () => true));
  });

  it("renders any non-slot character as a literal separator", () => {
    const wrapper = mountField({ format: "##:##" });

    expect(boxes(wrapper)).toHaveLength(4);
    expect(wrapper.find(".pairing-code-separator").text()).toBe(":");
  });

  // "?!" holds no code slot at all, which is the only way a non-empty format is invalid
  it.each([null, "?!"])(
    "falls back to a plain text field for format %s",
    (format) => {
      const wrapper = mountField({ format });

      expect(boxes(wrapper)).toHaveLength(0);
      expect(wrapper.find("input.pairing-code-fallback").exists()).toBe(true);
    },
  );

  it("uses the numeric keyboard only when every slot is a digit", () => {
    const inputmodes = (wrapper: VueWrapper) =>
      boxes(wrapper).map((box) => box.attributes("inputmode"));

    expect(inputmodes(mountField())).toEqual(
      Array.from({ length: 6 }, () => "numeric"),
    );
    expect(inputmodes(mountField({ format: "##XX" }))).toEqual(
      Array.from({ length: 4 }, () => "text"),
    );
  });

  it("resyncs the boxes when the entry value changes externally", async () => {
    const wrapper = mountField();
    await typeCode(wrapper, "111111");

    await wrapper.setProps({ entry: pairingEntry({ value: "654321" }) });
    await nextTick();

    expect(boxValues(wrapper)).toEqual(["6", "5", "4", "3", "2", "1"]);
  });

  it.each([
    ["12345", 5],
    ["9", 1],
  ])(
    "focuses the first box left empty by an external value of '%s'",
    async (value, expected) => {
      const wrapper = mountField();
      await typeCode(wrapper, "123456");

      await wrapper.setProps({ entry: pairingEntry({ value }) });
      await nextTick();

      expect(document.activeElement).toBe(boxes(wrapper)[expected].element);
    },
  );

  it("keeps typed boxes when the parent echoes the null emission back", async () => {
    const wrapper = mountField();
    await typeCode(wrapper, "123456");
    // the parent writes the completed code back to entry.value...
    await wrapper.setProps({ entry: pairingEntry({ value: "123456" }) });

    await boxes(wrapper)[5].trigger("keydown", { key: "Backspace" });
    // ...and echoes the null emission back as the (null) default_value
    await wrapper.setProps({ entry: pairingEntry({ value: null }) });
    await nextTick();

    expect(boxValues(wrapper)).toEqual(["1", "2", "3", "4", "5", ""]);
  });
});

function pairingEntry(overrides: Partial<ConfigEntry> = {}): ConfigEntryUI {
  const base: ConfigEntry = {
    key: "pin",
    type: ConfigEntryType.PAIRING_CODE,
    label: "pin",
    category: "generic",
    default_value: null,
    required: true,
    options: [],
    value: null,
    format: "###-###",
  };
  return { ...base, ...overrides };
}

function mountField(overrides: Partial<ConfigEntry> = {}, disabled = false) {
  return mount(PairingCodeField, {
    props: { entry: pairingEntry(overrides), label: "Pairing code", disabled },
    attachTo: document.body,
    global: { plugins: [vuetify] },
  });
}

function boxes(wrapper: VueWrapper): DOMWrapper<Element>[] {
  return wrapper.findAll("input.pairing-code-input");
}

function boxValues(wrapper: VueWrapper): string[] {
  return boxes(wrapper).map((box) => (box.element as HTMLInputElement).value);
}

async function typeCode(wrapper: VueWrapper, code: string) {
  const inputs = boxes(wrapper);
  for (let i = 0; i < code.length; i++) {
    await inputs[i].setValue(code[i]);
  }
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
}
