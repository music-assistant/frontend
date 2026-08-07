import type {
  ConfigEntryUI,
  HassControlPickerEntry,
} from "@/helpers/config_entry_ui";
import { UI_ENTRY_TYPE } from "@/helpers/config_entry_ui";
import type { HassControlEntity } from "@/helpers/hass_controls";
import { ConfigEntryType } from "@/plugins/api/interfaces";
import HassControlPickerField from "@/views/settings/fields/HassControlPickerField.vue";
import HassControlsField from "@/views/settings/fields/HassControlsField.vue";
import { flushPromises, mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createVuetify } from "vuetify";
import * as components from "vuetify/components";
import * as directives from "vuetify/directives";

const { apiMock } = vi.hoisted(() => ({
  apiMock: {
    getProviderConfig: vi.fn(),
    saveProviderConfig: vi.fn(),
    savePlayerConfig: vi.fn(),
  },
}));

vi.mock("@/plugins/api", () => ({
  api: apiMock,
  default: apiMock,
}));

vi.mock("@/plugins/i18n", () => ({
  $t: (key: string) => key,
}));

const vuetify = createVuetify({ components, directives });

const PickerDialogStub = {
  name: "HassEntityPickerDialog",
  props: ["modelValue", "controlType", "addedEntityIds"],
  emits: ["pick", "update:modelValue"],
  template: "<div />",
};

const PICKED_ENTITY: HassControlEntity = {
  entity_id: "switch.living_room_amp",
  name: "Amplifier",
  power: true,
  volume: false,
  mute: false,
};

describe("HassControlPickerField", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiMock.getProviderConfig.mockResolvedValue({
      domain: "hass",
      instance_id: "hass--1",
      values: {
        power_controls: { key: "power_controls", value: ["switch.tv"] },
      },
    });
    apiMock.saveProviderConfig.mockResolvedValue({});
  });

  it("registers the picked entity with the Home Assistant provider and fills in the player entry", async () => {
    const wrapper = mountPickerField();

    wrapper.findComponent(PickerDialogStub).vm.$emit("pick", PICKED_ENTITY);
    await flushPromises();

    // only the affected control list is written back
    expect(apiMock.saveProviderConfig).toHaveBeenCalledWith(
      "hass",
      { power_controls: ["switch.tv", "switch.living_room_amp"] },
      "hass--1",
    );
    // the player entry is only filled in on the form; saving it is up to the user
    expect(apiMock.savePlayerConfig).not.toHaveBeenCalled();
    expect(wrapper.emitted("setEntryValue")).toEqual([
      ["power_control", "switch.living_room_amp"],
    ]);
  });

  it("leaves the player entry alone when the entity could not be registered", async () => {
    apiMock.saveProviderConfig.mockRejectedValue(new Error("write failed"));
    const wrapper = mountPickerField();

    wrapper.findComponent(PickerDialogStub).vm.$emit("pick", PICKED_ENTITY);
    await flushPromises();

    expect(wrapper.emitted("setEntryValue")).toBeUndefined();
  });

  it("opens the picker for the control role it sits under", () => {
    const wrapper = mountPickerField();

    expect(wrapper.findComponent(PickerDialogStub).props("controlType")).toBe(
      "power_controls",
    );
  });
});

describe("HassControlsField", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lists the selected entities without saving anything itself", async () => {
    const wrapper = mountControlsField(["switch.tv"]);

    expect(wrapper.text()).toContain("switch.tv");

    wrapper.findComponent(PickerDialogStub).vm.$emit("pick", PICKED_ENTITY);
    await flushPromises();

    expect(wrapper.emitted("update:value")).toEqual([
      [["switch.tv", "switch.living_room_amp"]],
    ]);
    expect(apiMock.saveProviderConfig).not.toHaveBeenCalled();
  });

  it("names a selected entity by the option title while the server still ships one", () => {
    const wrapper = mountControlsField(
      ["switch.tv"],
      [{ title: "Living room TV", value: "switch.tv" }],
    );

    expect(wrapper.text()).toContain("Living room TV");
  });

  it("removes a selected entity", async () => {
    const wrapper = mountControlsField(["switch.tv", "switch.amp"]);

    await wrapper.get(".v-chip__close").trigger("click");

    expect(wrapper.emitted("update:value")).toEqual([[["switch.amp"]]]);
  });

  it("keeps entities that are already selected out of a second pick", () => {
    const wrapper = mountControlsField(["switch.tv"]);

    expect(
      wrapper.findComponent(PickerDialogStub).props("addedEntityIds"),
    ).toEqual(["switch.tv"]);
  });
});

function pickerEntry(): HassControlPickerEntry {
  return {
    injected: true,
    key: "power_control_hass_control_picker",
    type: UI_ENTRY_TYPE.HASS_CONTROL_PICKER,
    category: "player_controls",
    label: "",
    required: false,
    default_value: null,
    hass_instance_id: "hass--1",
    hass_control_key: "power_controls",
    target_key: "power_control",
  };
}

function controlsEntry(
  value: string[],
  options?: { title: string; value: string }[],
): ConfigEntryUI {
  return {
    key: "power_controls",
    type: ConfigEntryType.STRING,
    multi_value: true,
    category: "player_controls",
    label: "Power controls",
    required: false,
    default_value: [],
    value,
    options,
  } as ConfigEntryUI;
}

function mountPickerField() {
  return mount(HassControlPickerField, {
    props: { entry: pickerEntry() },
    global: {
      stubs: { HassEntityPickerDialog: PickerDialogStub },
    },
  });
}

function mountControlsField(
  value: string[],
  options?: { title: string; value: string }[],
) {
  return mount(HassControlsField, {
    props: { entry: controlsEntry(value, options), label: "Power controls" },
    global: {
      plugins: [vuetify],
      stubs: { HassEntityPickerDialog: PickerDialogStub },
    },
  });
}
