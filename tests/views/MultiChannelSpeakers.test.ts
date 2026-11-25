import type { ConfigEntryUI } from "@/helpers/config_entry_ui";
import type { MultiChannelSpeaker } from "@/helpers/multi_channel";
import { ConfigEntryType } from "@/plugins/api/interfaces";
import MultiChannelSpeakers from "@/views/settings/MultiChannelSpeakers.vue";
import { mount, type VueWrapper } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";
import { toRaw } from "vue";

vi.mock("@/plugins/i18n", () => ({
  $t: (key: string) => key,
}));

const CHANNEL_OPTIONS = [
  { title: "Left", value: "front_left" },
  { title: "Right", value: "front_right" },
];

describe("MultiChannelSpeakers", () => {
  it("shows a row per speaker with its channel, name and state", () => {
    const wrapper = mountSpeakers([
      speaker(1, "Studio left", "front_left", true),
      speaker(2, "Studio right", "front_right", false),
    ]);

    expect(rows(wrapper)).toEqual([
      ["Left", "Studio left", "settings.multi_channel.speaker_online"],
      ["Right", "Studio right", "settings.multi_channel.speaker_offline"],
    ]);
  });

  it("opens a row to the entries of its speaker", async () => {
    const wrapper = mountSpeakers([
      speaker(1, "Studio left", "front_left", true),
      speaker(2, "Studio right", "front_right", false),
    ]);

    const row = wrapper.findAll('[data-testid="multi-channel-speaker-row"]')[1];
    await row.get('[data-slot="accordion-trigger"]').trigger("click");

    // only the row that is open shows its entries
    expect(
      wrapper
        .findAllComponents({ name: "ConfigEntryRow" })
        .map((entryRow) => (entryRow.props("confEntry") as ConfigEntryUI).key),
    ).toEqual(["speaker_2_channel_setting", "speaker_2_output_delay"]);
  });

  it("names the fields of a speaker plainly, and only for these rows", async () => {
    const speakers = [speaker(1, "Studio left", "front_left", false)];
    const state = entry("speaker_1_state", {
      type: ConfigEntryType.LABEL,
      label: "Studio left is offline.",
    });
    speakers[0].entries.unshift(state);
    const wrapper = mountSpeakers(speakers);
    await wrapper.get('[data-slot="accordion-trigger"]').trigger("click");

    expect(
      wrapper.findAllComponents({ name: "ConfigEntryRow" }).map((entryRow) => {
        const shown = entryRow.props("confEntry") as ConfigEntryUI;
        return [shown.label, shown.default_value];
      }),
    ).toEqual([
      ["Studio left is offline.", null],
      ["settings.multi_channel.channel", null],
      ["settings.multi_channel.output_delay", 0],
    ]);
    // every other form shows the entries as the server sent them
    expect(speakers[0].channel).toMatchObject({
      label: "speaker_1_channel_setting",
      default_value: "front_left",
    });
  });

  it("keeps the channel of a speaker set", async () => {
    const speakers = [speaker(1, "Studio left", "front_left", true)];
    const wrapper = mountSpeakers(speakers);
    await wrapper.get('[data-slot="accordion-trigger"]').trigger("click");

    // only the channel goes without a clear button
    expect(
      entryRow(wrapper, "speaker_1_channel_setting").props("clearable"),
    ).toBe(false);
    expect(entryRow(wrapper, "speaker_1_output_delay").props("clearable")).toBe(
      true,
    );
    // and an empty choice never reaches the form, while a channel does
    entryRow(wrapper, "speaker_1_channel_setting").vm.$emit(
      "update:value",
      null,
    );
    entryRow(wrapper, "speaker_1_channel_setting").vm.$emit("update:value", "");
    expect(wrapper.emitted("update:value")).toBeUndefined();
    entryRow(wrapper, "speaker_1_channel_setting").vm.$emit(
      "update:value",
      "front_right",
    );
    expect(wrapper.emitted("update:value")).toHaveLength(1);
  });

  it("follows a channel picked but not saved yet", async () => {
    const speakers = [speaker(1, "Studio left", "front_left", true)];
    const wrapper = mountSpeakers(speakers);

    speakers[0].channel!.value = "front_right";
    await wrapper.setProps({ speakers: [...speakers] });

    expect(rows(wrapper)[0][0]).toBe("Right");
  });

  it("moves the other speaker to the channel a speaker leaves", async () => {
    const speakers = [
      speaker(1, "Studio left", "front_left", true),
      speaker(2, "Studio right", "front_right", true),
    ];
    const wrapper = mountSpeakers(speakers);
    await wrapper.get('[data-slot="accordion-trigger"]').trigger("click");

    entryRow(wrapper, "speaker_1_channel_setting").vm.$emit(
      "update:value",
      "front_right",
    );
    entryRow(wrapper, "speaker_1_output_delay").vm.$emit("update:value", 40);

    // the changes go to the entries of the form, not to what the rows show
    const changes = wrapper.emitted("update:value")!;
    expect(changes.map(([changed]) => changed)).toEqual([
      speakers[0].channel,
      speakers[1].channel,
      speakers[0].entries[1],
    ]);
    expect(toRaw(changes[0][0])).toBe(speakers[0].channel);
    expect(toRaw(changes[2][0])).toBe(speakers[0].entries[1]);
    expect(changes.map(([, value]) => value)).toEqual([
      "front_right",
      "front_left",
      40,
    ]);
  });
});

function mountSpeakers(speakers: MultiChannelSpeaker[]) {
  return mount(MultiChannelSpeakers, {
    props: {
      speakers,
      showPasswordValues: false,
      isDisabled: () => false,
    },
    global: {
      mocks: { $t: (key: string) => key },
      stubs: { ConfigEntryRow: true },
    },
  });
}

/** The channel, name and state each row shows. */
function rows(wrapper: VueWrapper): string[][] {
  return wrapper
    .findAll('[data-testid="multi-channel-speaker-row"]')
    .map((row) => [
      row.get('[data-testid="multi-channel-speaker-channel"]').text(),
      row.get('[data-testid="multi-channel-speaker-name"]').text(),
      row.get('[data-testid="multi-channel-speaker-state"]').text(),
    ]);
}

function entryRow(wrapper: VueWrapper, key: string) {
  const found = wrapper
    .findAllComponents({ name: "ConfigEntryRow" })
    .find(
      (candidate) =>
        (candidate.props("confEntry") as ConfigEntryUI).key === key,
    );
  if (!found) throw new Error(`Entry row ${key} not rendered`);
  return found;
}

function speaker(
  number: number,
  name: string,
  channel: string,
  online: boolean,
): MultiChannelSpeaker {
  // the server makes the channel stored the default of the entry
  const channelEntry = entry(`speaker_${number}_channel_setting`, {
    value: channel,
    default_value: channel,
    options: CHANNEL_OPTIONS,
  });
  return {
    number,
    name,
    online,
    channel: channelEntry,
    entries: [
      channelEntry,
      entry(`speaker_${number}_output_delay`, {
        type: ConfigEntryType.INTEGER,
        value: 0,
        default_value: 0,
      }),
    ],
  };
}

function entry(key: string, overrides: Partial<ConfigEntryUI> = {}) {
  return {
    key,
    type: ConfigEntryType.STRING,
    label: key,
    default_value: null,
    required: false,
    options: [],
    category: "protocol_sendspin",
    ...overrides,
  } as ConfigEntryUI;
}
