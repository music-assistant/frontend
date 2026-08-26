import { mount, type DOMWrapper, type VueWrapper } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";
import { createVuetify } from "vuetify";
import * as components from "vuetify/components";
import * as directives from "vuetify/directives";
import { ConfigEntryType, type ConfigEntry } from "@/plugins/api/interfaces";
import {
  NON_INTERACTIVE_ENTRY_TYPES,
  type ConfigEntryUI,
  type ConfigEntryUIType,
  type InjectedConfigEntry,
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

// Third element: text the field only renders on the branch under test. An entry that
// matches no branch still renders a text input that honours the disabled state — so
// without this the options button row would keep passing after losing its branch.
const INTERACTIVE_ENTRIES: [string, ConfigEntryUI, string?][] = [
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

  it.each(INTERACTIVE_ENTRIES)(
    "disables %s",
    (_label, confEntry, branchText) => {
      const wrapper = mountField(confEntry);

      if (branchText) expect(wrapper.text()).toContain(branchText);
      expect(controlStates(wrapper)).toEqual([false]);
      expect(controlStates(mountField(confEntry, true))).toEqual([true]);
    },
  );

  // these types take no disabled binding; a form hides them while their dependency is unmet
  it.each(NON_INTERACTIVE_ENTRY_TYPES)(
    "renders a %s entry with no control to disable",
    (type) => {
      // value is what the image branch renders; the other three ignore it
      const wrapper = mountField(
        entry({
          key: "status",
          type,
          label: "Nothing to configure",
          value: IMAGE_DATA_URI,
        }),
        true,
      );

      expect(wrapper.html()).toContain("Nothing to configure");
      expect(controlStates(wrapper)).toEqual([]);
    },
  );

  it("offers the entity picker for a Home Assistant control list", () => {
    const wrapper = mountField(hassControlsEntry(), false, "hass");

    expect(wrapper.findComponent({ name: "HassControlsField" }).exists()).toBe(
      true,
    );
    expect(wrapper.find(".v-select").exists()).toBe(false);
  });

  it("leaves the same key on another provider as a plain dropdown", () => {
    const wrapper = mountField(hassControlsEntry(), false, "snapcast");

    expect(wrapper.findComponent({ name: "HassControlsField" }).exists()).toBe(
      false,
    );
    expect(wrapper.find(".v-select").exists()).toBe(true);
  });

  it("shows a value the options do not list yet", () => {
    const wrapper = mountField(
      entry({
        key: "power_control",
        type: ConfigEntryType.STRING,
        options: [{ title: "None", value: "none" }],
        value: "switch.registered_moments_ago",
      }),
    );

    expect(wrapper.get(".v-select").text()).toContain(
      "switch.registered_moments_ago",
    );
  });

  it("expands the options of an expanded_options entry, descriptions and all", () => {
    const wrapper = mountField(expandedOptionsEntry());

    expect(wrapper.find(".v-select").exists()).toBe(false);
    expect(optionButtons(wrapper)).toHaveLength(2);
    // the whole point of the branch: no option (or its description) is hidden behind a click
    expect(wrapper.text()).toContain("FLAC");
    expect(wrapper.text()).toContain("Lossless, at a higher bitrate.");
    expect(wrapper.text()).toContain("Not supported by this player.");
  });

  it("emits the value of the option behind the pressed button", async () => {
    const wrapper = mountField(expandedOptionsEntry());

    await optionButtons(wrapper)[0].trigger("click");

    expect(wrapper.emitted("update:value")).toEqual([["flac"]]);
  });

  // the options sit inside the setup flow's form, where a default-type button submits it
  it("keeps option buttons out of the form's submit path", () => {
    const wrapper = mountField(expandedOptionsEntry());

    expect(optionButtons(wrapper).map((el) => el.attributes("type"))).toEqual([
      "button",
      "button",
    ]);
  });

  it("keeps a multi_value entry on the dropdown", () => {
    const wrapper = mountField({
      ...expandedOptionsEntry(),
      multi_value: true,
      value: [],
    });

    expect(wrapper.find(".v-select").exists()).toBe(true);
    expect(optionButtons(wrapper)).toHaveLength(0);
  });

  it("disables every option button with the form", () => {
    expect(controlStates(mountField(expandedOptionsEntry(), true))).toEqual([
      true,
      true,
    ]);
  });

  it("disables a read_only entry while the form itself is enabled", () => {
    const confEntry = entry({
      key: "server_id",
      type: ConfigEntryType.STRING,
      read_only: true,
    });

    expect(controlStates(mountField(confEntry))).toEqual([true]);
  });

  it("renders a pairing code entry as one box per code character", () => {
    const wrapper = mountField(pairingCodeEntry());

    expect(wrapper.findComponent({ name: "PairingCodeField" }).exists()).toBe(
      true,
    );
    expect(wrapper.findAll("input.pairing-code-input")).toHaveLength(6);
  });

  // not part of INTERACTIVE_ENTRIES: that matrix expects exactly one control per entry
  it("disables every pairing code box", () => {
    const states = (disabled: boolean) =>
      controlStates(mountField(pairingCodeEntry(), disabled));

    expect(states(false)).toEqual(Array.from({ length: 6 }, () => false));
    expect(states(true)).toEqual(Array.from({ length: 6 }, () => true));
  });

  it("keeps a pairing code entry without a format usable as a text input", () => {
    const wrapper = mountField(pairingCodeEntry(null));

    expect(wrapper.findAll("input.pairing-code-input")).toHaveLength(0);
    expect(wrapper.find("input.pairing-code-fallback").exists()).toBe(true);
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
  overrides: Partial<InjectedConfigEntry> & {
    key: string;
    type: ConfigEntryUIType;
  },
): ConfigEntryUI {
  // typed without key/type so the defaults stay checked against the server
  // model, while the cast only covers the UI-only entry types
  const base: Omit<ConfigEntry, "key" | "type"> = {
    category: "generic",
    default_value: null,
    label: overrides.key,
    required: false,
    options: [],
    value: null,
  };
  return { ...base, ...overrides } as ConfigEntryUI;
}

function rangedEntry(type: ConfigEntryType): ConfigEntryUI {
  return entry({ key: "crossfade_duration", type, range: [0, 10], value: 5 });
}

function expandedOptionsEntry(): ConfigEntryUI {
  return entry({
    key: "output_codec",
    type: ConfigEntryType.STRING,
    required: true,
    expanded_options: true,
    options: [
      {
        title: "FLAC",
        value: "flac",
        description: "Lossless, at a higher bitrate.",
      },
      {
        title: "MP3",
        value: "mp3",
        disabled: true,
        disabled_reason: "Not supported by this player.",
      },
    ],
  });
}

function pairingCodeEntry(format: string | null = "###-###"): ConfigEntryUI {
  return entry({ key: "pin", type: ConfigEntryType.PAIRING_CODE, format });
}

function hassControlsEntry(): ConfigEntryUI {
  return entry({
    key: "power_controls",
    type: ConfigEntryType.STRING,
    multi_value: true,
    options: [{ title: "Living room TV", value: "switch.tv" }],
    value: ["switch.tv"],
  });
}

function mountField(
  confEntry: ConfigEntryUI,
  disabled = false,
  providerDomain?: string,
) {
  return mount(ConfigEntryField, {
    props: { confEntry, showPasswordValues: false, disabled, providerDomain },
    global: { plugins: [vuetify] },
  });
}

/**
 * The disabled state of every control the field rendered, in document order.
 *
 * Elements carrying the `hidden` attribute are left out, since a v-select mirrors its
 * value into a hidden native select that no user can reach. Everything else counts, so
 * a control that escapes the field's disabled state fails the assertion rather than
 * being filtered away.
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

function optionButtons(wrapper: VueWrapper): DOMWrapper<Element>[] {
  return wrapper.findAll('[data-testid="option-button"]');
}

function isDisabled(el: Pick<DOMWrapper<Element>, "attributes">): boolean {
  return el.attributes("disabled") !== undefined;
}
