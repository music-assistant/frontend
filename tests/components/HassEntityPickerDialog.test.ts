import HassEntityPickerDialog from "@/components/HassEntityPickerDialog.vue";
import type {
  HassControlEntity,
  HassControlEntityGroup,
} from "@/helpers/hass_controls";
import { flushPromises, mount, type VueWrapper } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { apiMock } = vi.hoisted(() => ({
  apiMock: {
    sendCommand: vi.fn(),
  },
}));

vi.mock("@/plugins/api", () => ({
  api: apiMock,
  default: apiMock,
}));

vi.mock("@/plugins/i18n", () => ({
  $t: (key: string) => key,
}));

const SEARCH_THROTTLE_MS = 400;

const LIVING_ROOM_GROUP: HassControlEntityGroup = {
  device_id: "device-1",
  device_name: "Living room amplifier",
  area_name: "Living room",
  entities: [
    entity({ entity_id: "media_player.amp", name: "Amplifier", volume: true }),
  ],
};

const ORPHAN_GROUP: HassControlEntityGroup = {
  device_id: null,
  device_name: null,
  area_name: null,
  entities: [entity({ entity_id: "switch.relay", name: "Relay" })],
};

describe("HassEntityPickerDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiMock.sendCommand.mockResolvedValue({ groups: [], truncated: false });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders the results grouped by device and area", async () => {
    const wrapper = await openPicker([LIVING_ROOM_GROUP, ORPHAN_GROUP]);

    const groupTexts = wrapper
      .findAll(".entity-group")
      .map((group) => group.text());
    expect(groupTexts).toHaveLength(2);
    expect(groupTexts[0]).toContain("Living room amplifier");
    expect(groupTexts[0]).toContain("Living room");
    expect(groupTexts[0]).toContain("Amplifier");
    expect(groupTexts[0]).toContain("media_player.amp");
    // the role the picker was opened for holds for every result; the others are badged
    expect(groupTexts[0]).toContain("settings.hass_controls.role.volume");
    expect(groupTexts[0]).not.toContain("settings.hass_controls.role.power");
    // a null device or area is named by a translated label, not by the component
    expect(groupTexts[1]).toContain("settings.hass_controls.no_device");
    expect(groupTexts[1]).toContain("settings.hass_controls.no_area");
    expect(groupTexts[1]).toContain("Relay");
  });

  it("searches for the requested control type as soon as it opens", async () => {
    await openPicker([]);

    expect(apiMock.sendCommand).toHaveBeenCalledOnce();
    expect(apiMock.sendCommand.mock.calls[0][0]).toBe(
      "hass/search_control_entities",
    );
    expect(apiMock.sendCommand.mock.calls[0][1]).toMatchObject({
      control_type: "power_controls",
      search: "",
    });
  });

  it("searches once for a burst of keystrokes", async () => {
    vi.useFakeTimers();
    const wrapper = await openPicker([]);
    expect(apiMock.sendCommand).toHaveBeenCalledOnce();

    await wrapper.get("input").setValue("kit");
    await wrapper.get("input").setValue("kitchen");
    vi.advanceTimersByTime(SEARCH_THROTTLE_MS - 1);
    await flushPromises();

    expect(apiMock.sendCommand).toHaveBeenCalledOnce();

    vi.advanceTimersByTime(1);
    await flushPromises();

    expect(apiMock.sendCommand).toHaveBeenCalledTimes(2);
    expect(apiMock.sendCommand.mock.calls[1][1]).toMatchObject({
      search: "kitchen",
    });
  });

  it("tells the user to narrow a truncated search", async () => {
    const wrapper = await openPicker([LIVING_ROOM_GROUP], true);

    expect(wrapper.text()).toContain("settings.hass_controls.truncated");
  });

  it("keeps the truncation hint away from a complete result", async () => {
    const wrapper = await openPicker([LIVING_ROOM_GROUP]);

    expect(wrapper.text()).not.toContain("settings.hass_controls.truncated");
  });

  it("reports a search that failed instead of letting it escape", async () => {
    apiMock.sendCommand.mockRejectedValue(new Error("provider unavailable"));
    const wrapper = mountPicker();

    await wrapper.setProps({ modelValue: true });
    await flushPromises();

    expect(wrapper.text()).toContain("settings.hass_controls.search_failed");
  });

  it("shows nothing to pick when no entity matches", async () => {
    const wrapper = await openPicker([]);

    expect(wrapper.text()).toContain("settings.hass_controls.no_results");
  });

  it("emits the picked entity and closes", async () => {
    const wrapper = await openPicker([LIVING_ROOM_GROUP]);

    await wrapper.get(".entity-option").trigger("click");

    expect(wrapper.emitted("pick")).toEqual([[LIVING_ROOM_GROUP.entities[0]]]);
    expect(wrapper.emitted("update:modelValue")?.at(-1)).toEqual([false]);
  });

  it("offers an entity that is already added, but not for picking again", async () => {
    const wrapper = await openPicker([LIVING_ROOM_GROUP], false, [
      "media_player.amp",
    ]);

    const entityButton = wrapper.get(".entity-option");
    expect(entityButton.text()).toContain(
      "settings.hass_controls.already_added",
    );
    expect(entityButton.attributes("disabled")).toBeDefined();
  });
});

function entity(overrides: Partial<HassControlEntity>): HassControlEntity {
  return {
    entity_id: "switch.example",
    name: "Example",
    power: true,
    volume: false,
    mute: false,
    ...overrides,
  };
}

function mountPicker(addedEntityIds?: string[]) {
  const passthrough = { template: "<div><slot /></div>" };
  return mount(HassEntityPickerDialog, {
    props: {
      modelValue: false,
      controlType: "power_controls" as const,
      addedEntityIds,
    },
    global: {
      stubs: {
        Dialog: passthrough,
        DialogContent: passthrough,
        DialogHeader: passthrough,
        DialogTitle: passthrough,
        DialogFooter: passthrough,
      },
    },
  });
}

async function openPicker(
  groups: HassControlEntityGroup[],
  truncated = false,
  addedEntityIds?: string[],
): Promise<VueWrapper> {
  apiMock.sendCommand.mockResolvedValue({ groups, truncated });
  const wrapper = mountPicker(addedEntityIds);
  await wrapper.setProps({ modelValue: true });
  await flushPromises();
  return wrapper;
}
