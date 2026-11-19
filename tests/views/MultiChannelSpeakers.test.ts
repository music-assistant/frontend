import type { ConfigEntryUI } from "@/helpers/config_entry_ui";
import type { MultiChannelSpeaker } from "@/helpers/multi_channel";
import { ConfigEntryType } from "@/plugins/api/interfaces";
import MultiChannelSpeakers from "@/views/settings/MultiChannelSpeakers.vue";
import { mount, type VueWrapper } from "@vue/test-utils";
import { describe, expect, it } from "vitest";

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
    ).toEqual(["speaker_2_channel", "speaker_2_output_delay"]);
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

    entryRow(wrapper, "speaker_1_channel").vm.$emit(
      "update:value",
      "front_right",
    );
    entryRow(wrapper, "speaker_1_output_delay").vm.$emit("update:value", 40);

    expect(wrapper.emitted("update:value")).toEqual([
      [speakers[0].channel, "front_right"],
      [speakers[1].channel, "front_left"],
      [speakers[0].entries[1], 40],
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
      row.get(".truncate").text(),
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
  const channelEntry = entry(`speaker_${number}_channel`, {
    value: channel,
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
