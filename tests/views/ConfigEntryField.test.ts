import { mount, type DOMWrapper, type VueWrapper } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";
import { createVuetify } from "vuetify";
import * as components from "vuetify/components";
import * as directives from "vuetify/directives";
import {
  ConfigEntryType,
  type ConfigEntry,
  type ConfigValueType,
} from "@/plugins/api/interfaces";
import {
  NON_INTERACTIVE_ENTRY_TYPES,
  type ConfigEntryUI,
} from "@/helpers/config_entry_ui";
import ConfigEntryField from "@/views/settings/ConfigEntryField.vue";

vi.mock("@/plugins/i18n", () => ({
  $t: (key: string) => key,
}));

// A `disabled` binding only proves anything once it reaches a rendered control, so this
// suite mounts the real Vuetify and reka-ui controls instead of stubbing them.
const vuetify = createVuetify({ components, directives });

const IMAGE_DATA_URI =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAAAAAA6fptVAAAACklEQVR4nGMAAQAABQABDQottAAAAABJRU5ErkJggg==";

const INTERACTIVE_ENTRIES: [string, ConfigEntry][] = [
  ["a text input", entry({ key: "name", type: ConfigEntryType.STRING })],
  [
    "a password input",
    entry({ key: "password", type: ConfigEntryType.SECURE_STRING }),
  ],
  ["a checkbox", entry({ key: "flow_mode", type: ConfigEntryType.BOOLEAN })],
  ["an icon picker", entry({ key: "icon", type: ConfigEntryType.ICON })],
  [
    "a dropdown",
    entry({
      key: "output_codec",
      type: ConfigEntryType.STRING,
      options: [
        { title: "FLAC", value: "flac" },
        { title: "MP3", value: "mp3" },
      ],
      value: "flac",
    }),
  ],
  [
    "an action button",
    entry({
      key: "authenticate",
      type: ConfigEntryType.ACTION,
      action: "authenticate",
    }),
  ],
  [
    "a number input without a range",
    entry({ key: "port", type: ConfigEntryType.INTEGER, value: 8095 }),
  ],
  [
    "a multi-value combobox",
    entry({
      key: "manual_discovery_ips",
      type: ConfigEntryType.STRING,
      multi_value: true,
      value: ["192.168.1.10"],
    }),
  ],
];

describe("ConfigEntryField", () => {
  it.each([ConfigEntryType.INTEGER, ConfigEntryType.FLOAT])(
    "disables the slider and the number input of a ranged %s entry together",
    (type) => {
      expect(sliderRowStates(mountField(rangedEntry(type)))).toEqual({
        slider: false,
        input: false,
        decrement: false,
        increment: false,
      });

      expect(sliderRowStates(mountField(rangedEntry(type), true))).toEqual({
        slider: true,
        input: true,
        decrement: true,
        increment: true,
      });
    },
  );

  it.each(INTERACTIVE_ENTRIES)("disables %s", (_label, confEntry) => {
    expect(controlStates(mountField(confEntry))).toEqual([false]);
    expect(controlStates(mountField(confEntry, true))).toEqual([true]);
  });

  // these types take no disabled binding; a form hides them while their dependency is unmet
  it.each(NON_INTERACTIVE_ENTRY_TYPES)(
    "renders a %s entry with no control to disable",
    (type) => {
      // value is what the image branch renders; the other three ignore it
      const wrapper = mountField(
        entry({
          key: "status",
          type: type as ConfigEntryType,
          label: "Nothing to configure",
          value: IMAGE_DATA_URI,
        }),
        true,
      );

      expect(wrapper.html()).toContain("Nothing to configure");
      expect(controlStates(wrapper)).toEqual([]);
    },
  );

  it("disables a read_only entry while the form itself is enabled", () => {
    const confEntry = entry({
      key: "server_id",
      type: ConfigEntryType.STRING,
      read_only: true,
    });

    expect(controlStates(mountField(confEntry))).toEqual([true]);
  });

  it("disables a read_only ranged entry while the form itself is enabled", () => {
    const confEntry = {
      ...rangedEntry(ConfigEntryType.INTEGER),
      read_only: true,
    };

    expect(sliderRowStates(mountField(confEntry))).toEqual({
      slider: true,
      input: true,
      decrement: true,
      increment: true,
    });
  });
});

function entry(
  overrides: Partial<ConfigEntry> & { key: string; type: ConfigEntryType },
): ConfigEntry {
  return {
    category: "generic",
    default_value: null,
    label: overrides.key,
    required: false,
    value: null as ConfigValueType,
    ...overrides,
  } as ConfigEntry;
}

function rangedEntry(type: ConfigEntryType): ConfigEntry {
  return entry({ key: "crossfade_duration", type, range: [0, 10], value: 5 });
}

function mountField(confEntry: ConfigEntryUI, disabled = false) {
  return mount(ConfigEntryField, {
    props: { confEntry, showPasswordValues: false, disabled },
    global: { plugins: [vuetify] },
  });
}

/**
 * The disabled state of every control the field rendered, in document order.
 *
 * A v-select mirrors its value into a hidden native select that no user can reach,
 * so hidden elements are left out.
 */
function controlStates(wrapper: VueWrapper): boolean[] {
  return wrapper
    .findAll("input, button, textarea, select")
    .filter((el) => el.attributes("hidden") === undefined)
    .map(isDisabled);
}

/**
 * The disabled state of each control in the slider row: the value input Vuetify renders
 * for the slider, plus the number field's own input and its two step buttons.
 */
function sliderRowStates(wrapper: VueWrapper): Record<string, boolean> {
  const numberFieldParts = wrapper
    .findAll(".config-slider-input [data-slot]")
    .map((el) => [el.attributes("data-slot") as string, isDisabled(el)]);

  return {
    slider: isDisabled(wrapper.get(".config-slider input")),
    ...Object.fromEntries(numberFieldParts),
  };
}

function isDisabled(el: Pick<DOMWrapper<Element>, "attributes">): boolean {
  return el.attributes("disabled") !== undefined;
}
