import type { ConfigEntryUI } from "@/helpers/config_entry_ui";
import {
  assignChannelSpeaker,
  canAddSubwoofer,
  canRemoveSubwoofer,
  changeChannelLayout,
  getChannelSwap,
  getCombiningProviders,
  getComposableProtocol,
  getSpeakerField,
  getSubwoofer,
  groupSpeakerEntries,
  isSpeakerChannelEntry,
  suggestMultiChannelName,
} from "@/helpers/multi_channel";
import {
  ChannelLayout,
  ConfigEntryType,
  type OutputProtocol,
  type Player,
  type PlayerProtocolInfo,
  PlayerType,
  ProtocolRole,
  ProviderFeature,
  SpeakerChannel,
} from "@/plugins/api/interfaces";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { outputProtocol } from "../../tests/fixtures/outputProtocol";

const { apiMock } = vi.hoisted(() => ({
  apiMock: { getProvider: vi.fn() },
}));

vi.mock("@/plugins/api", () => ({
  api: apiMock,
  default: apiMock,
}));

// the Sendspin provider combines speakers, the AirPlay provider does not
beforeEach(() => {
  apiMock.getProvider.mockImplementation((instanceId: string) => ({
    instance_id: instanceId,
    supported_features:
      instanceId === "sendspin"
        ? [ProviderFeature.CREATE_MULTI_CHANNEL_PLAYER]
        : [ProviderFeature.SYNC_PLAYERS],
  }));
});

describe("getCombiningProviders", () => {
  it("lists each provider of the player that combines speakers once", () => {
    expect(
      getCombiningProviders(
        speaker({
          protocols: [
            protocol("sendspin"),
            protocol("airplay"),
            protocol("sendspin", { protocol_id: "second" }),
          ],
        }),
      ),
    ).toEqual(["sendspin"]);
  });
});

describe("getComposableProtocol", () => {
  const native = () =>
    output("sendspin", { output_protocol_id: "native", is_native: true });

  it("offers the protocol behind an output when the server lists the player", () => {
    const sendspin = protocol("sendspin", { role: ProtocolRole.NATIVE });

    expect(
      getComposableProtocol(speaker({ protocols: [sendspin] }), native(), {
        sendspin: ["studio-right", "studio-left"],
      }),
    ).toBe(sendspin);
  });

  it("offers nothing when the server does not list the player for that provider", () => {
    const player = speaker();

    expect(
      getComposableProtocol(player, native(), { sendspin: ["studio-right"] }),
    ).toBeUndefined();
    expect(
      getComposableProtocol(player, native(), { airplay: ["studio-left"] }),
    ).toBeUndefined();
    expect(getComposableProtocol(player, native(), {})).toBeUndefined();
  });

  it("offers nothing on a provider that can not combine speakers, whatever is listed", () => {
    expect(
      getComposableProtocol(
        speaker({ protocols: [protocol("airplay")] }),
        output("airplay"),
        { airplay: ["studio-left"] },
      ),
    ).toBeUndefined();
  });
});

describe("isSpeakerChannelEntry", () => {
  it("knows the channel of a speaker of a multi-channel player", () => {
    const record = setRecord().entries;
    const keys = record
      .filter((e) => isSpeakerChannelEntry(e, record))
      .map((e) => e.key);

    expect(keys).toEqual([
      "speaker_1_channel_setting",
      "speaker_2_channel_setting",
    ]);
  });

  it("knows no channel without the state of its speaker, or on another protocol", () => {
    const channel = entry("speaker_1_channel_setting");
    const elsewhere = entry("speaker_1_state", { category: "protocol_other" });

    expect(isSpeakerChannelEntry(channel, [channel])).toBe(false);
    expect(isSpeakerChannelEntry(channel, [channel, elsewhere])).toBe(false);
  });
});

describe("getSpeakerField", () => {
  it("names the field a speaker entry holds", () => {
    expect(getSpeakerField("speaker_2_output_delay")).toBe("output_delay");
    expect(getSpeakerField("multi_channel_group_id")).toBeUndefined();
  });
});

describe("suggestMultiChannelName", () => {
  it("names the pair after the words both speakers start with", () => {
    expect(suggestMultiChannelName("Studio left", "studio Right")).toBe(
      "Studio",
    );
    expect(
      suggestMultiChannelName("Attic speaker one", "Attic speaker 2"),
    ).toBe("Attic speaker");
  });

  it("suggests nothing for speakers that share no first word", () => {
    expect(suggestMultiChannelName("Left speaker", "Right speaker")).toBe("");
  });

  it("takes the words every speaker starts with, or the name of a single one", () => {
    expect(
      suggestMultiChannelName("Studio left", "Studio right", "Studio sub"),
    ).toBe("Studio");
    expect(
      suggestMultiChannelName("Studio left", "Studio right", "Subwoofer"),
    ).toBe("");
    expect(suggestMultiChannelName("  Desk   speaker ")).toBe("Desk speaker");
    expect(suggestMultiChannelName()).toBe("");
  });
});

describe("assignChannelSpeaker", () => {
  const { FRONT_LEFT, FRONT_RIGHT, LFE } = SpeakerChannel;

  it("puts a speaker on a free channel", () => {
    expect(assignChannelSpeaker({ [FRONT_LEFT]: "a" }, LFE, "b")).toEqual({
      [FRONT_LEFT]: "a",
      [LFE]: "b",
    });
  });

  it("swaps a speaker with the one on the channel it moves to", () => {
    expect(
      assignChannelSpeaker(
        { [FRONT_LEFT]: "a", [FRONT_RIGHT]: "b" },
        FRONT_RIGHT,
        "a",
      ),
    ).toEqual({ [FRONT_LEFT]: "b", [FRONT_RIGHT]: "a" });
  });

  it("leaves the channel of a speaker that moves to a free one empty", () => {
    const speakers = assignChannelSpeaker({ [FRONT_LEFT]: "a" }, LFE, "a");
    expect(speakers[FRONT_LEFT]).toBeUndefined();
    expect(speakers[LFE]).toBe("a");
  });
});

describe("changeChannelLayout", () => {
  const { FRONT_CENTER, FRONT_LEFT, FRONT_RIGHT, LFE } = SpeakerChannel;
  const STEREO = [FRONT_LEFT, FRONT_RIGHT];
  const SPEAKER_SUB = [FRONT_CENTER, LFE];
  const STEREO_SUB = [FRONT_LEFT, FRONT_RIGHT, LFE];

  it("keeps every speaker on a channel the new layout has", () => {
    expect(
      changeChannelLayout(
        { [FRONT_LEFT]: "a", [FRONT_RIGHT]: "b" },
        STEREO_SUB,
        "a",
      ),
    ).toEqual({ [FRONT_LEFT]: "a", [FRONT_RIGHT]: "b" });
  });

  it("puts the speaker that stays on the first free channel", () => {
    expect(
      changeChannelLayout(
        { [FRONT_LEFT]: "a", [FRONT_RIGHT]: "b", [LFE]: "c" },
        SPEAKER_SUB,
        "b",
      ),
    ).toEqual({ [FRONT_CENTER]: "b", [LFE]: "c" });
  });

  it("puts the speaker that stays on the first channel when none is free", () => {
    expect(
      changeChannelLayout(
        { [FRONT_LEFT]: "a", [FRONT_RIGHT]: "b", [LFE]: "c" },
        STEREO,
        "c",
      ),
    ).toEqual({ [FRONT_LEFT]: "c", [FRONT_RIGHT]: "b" });
  });
});

describe("canAddSubwoofer and canRemoveSubwoofer", () => {
  const { FRONT_CENTER, FRONT_LEFT, FRONT_RIGHT, LFE } = SpeakerChannel;
  const LAYOUTS = {
    [ChannelLayout.STEREO]: [FRONT_LEFT, FRONT_RIGHT],
    [ChannelLayout.LAYOUT_2_1]: [FRONT_LEFT, FRONT_RIGHT, LFE],
    [ChannelLayout.LAYOUT_1_1]: [FRONT_CENTER, LFE],
  };

  it("adds a subwoofer to a layout the provider offers with one", () => {
    expect(canAddSubwoofer(LAYOUTS, ChannelLayout.STEREO)).toBe(true);
    expect(canAddSubwoofer(LAYOUTS, ChannelLayout.LAYOUT_2_1)).toBe(false);
    expect(canAddSubwoofer(LAYOUTS, ChannelLayout.LAYOUT_1_1)).toBe(false);
  });

  it("removes a subwoofer from a layout the provider offers without one", () => {
    expect(canRemoveSubwoofer(LAYOUTS, ChannelLayout.LAYOUT_2_1)).toBe(true);
    expect(canRemoveSubwoofer(LAYOUTS, ChannelLayout.STEREO)).toBe(false);
    // one speaker alone is no layout: taking the player apart is the way
    expect(canRemoveSubwoofer(LAYOUTS, ChannelLayout.LAYOUT_1_1)).toBe(false);
  });

  it("offers neither for a layout the provider does not list", () => {
    const stereoOnly = { [ChannelLayout.STEREO]: [FRONT_LEFT, FRONT_RIGHT] };

    expect(canAddSubwoofer(stereoOnly, ChannelLayout.STEREO)).toBe(false);
    expect(canAddSubwoofer({}, ChannelLayout.STEREO)).toBe(false);
    expect(canRemoveSubwoofer(LAYOUTS, ChannelLayout.LAYOUT_5_1)).toBe(false);
  });
});

describe("getSubwoofer", () => {
  it("finds the speaker on the subwoofer channel", () => {
    const entries = [
      ...setRecord().entries,
      ...speakerEntries(3, "Studio sub", "lfe", "online"),
    ];

    expect(getSubwoofer(entries)).toMatchObject({
      number: 3,
      name: "Studio sub",
    });
  });

  it("finds none in a set without one", () => {
    expect(getSubwoofer(setRecord().entries)).toBeUndefined();
  });
});

describe("groupSpeakerEntries", () => {
  it("leaves out a speaker the server sends no state or no channel for", () => {
    const entries = [
      entry("speaker_1_state", { type: ConfigEntryType.LABEL }),
      entry("speaker_1_output_delay"),
      entry("speaker_2_channel_setting", { value: "front_left" }),
      entry("buffer"),
    ];

    expect(groupSpeakerEntries(entries, entries)).toEqual({
      speakers: [],
      others: entries,
    });
  });

  it("groups the entries of each speaker in the order of their channels", () => {
    const record = setRecord();

    const { speakers, others } = groupSpeakerEntries(
      record.entries,
      record.visible,
    );

    expect(others.map((e) => e.key)).toEqual(["note"]);
    expect(
      speakers.map(({ number, name, online }) => ({ number, name, online })),
    ).toEqual([
      { number: 2, name: "Studio left", online: false },
      { number: 1, name: "Studio right", online: true },
    ]);
    // the row names the speaker and says it is online; an offline one says what it means
    expect(speakers[0].entries.map((e) => e.key)).toEqual([
      "speaker_2_state",
      "speaker_2_channel_setting",
      "speaker_2_output_delay",
    ]);
    expect(speakers[1].entries.map((e) => e.key)).toEqual([
      "speaker_1_channel_setting",
      "speaker_1_output_delay",
    ]);
    expect(speakers[1].channel?.key).toBe("speaker_1_channel_setting");
  });

  it("follows a channel picked but not saved yet", () => {
    const record = setRecord();
    record.entries.find((e) => e.key === "speaker_1_channel_setting")!.value =
      "front_left";
    record.entries.find((e) => e.key === "speaker_2_channel_setting")!.value =
      "front_right";

    expect(
      groupSpeakerEntries(record.entries, record.visible).speakers.map(
        (s) => s.number,
      ),
    ).toEqual([1, 2]);
  });

  it("leaves the name empty while the server sends none", () => {
    const entries = [
      entry("speaker_1_state", { type: ConfigEntryType.LABEL }),
      entry("speaker_1_channel_setting", { value: "front_left" }),
    ];

    expect(groupSpeakerEntries(entries, entries).speakers[0].name).toBe("");
  });
});

describe("getChannelSwap", () => {
  it("moves the speaker on the channel picked to the channel left behind", () => {
    const record = setRecord();
    const { speakers } = groupSpeakerEntries(record.entries, record.visible);
    const [onLeft, onRight] = speakers;

    expect(getChannelSwap(speakers, onRight.channel!, "front_left")).toEqual({
      entry: onLeft.channel,
      value: "front_right",
    });
  });

  it("changes nothing for another entry or a channel no other speaker has", () => {
    const record = setRecord();
    const { speakers } = groupSpeakerEntries(record.entries, record.visible);
    const delay = record.entries.find(
      (e) => e.key === "speaker_1_output_delay",
    )!;

    expect(getChannelSwap(speakers, delay, 100)).toBeUndefined();
    expect(
      getChannelSwap(speakers, speakers[0].channel!, "front_left"),
    ).toBeUndefined();
  });
});

/**
 * The entries of the protocol of a stereo pair: speaker 1 on the right and online,
 * speaker 2 on the left and offline, and one entry of the protocol itself.
 */
function setRecord(): { entries: ConfigEntryUI[]; visible: ConfigEntryUI[] } {
  const entries = [
    entry("note", { type: ConfigEntryType.LABEL }),
    ...speakerEntries(1, "Studio right", "front_right", "online"),
    ...speakerEntries(2, "Studio left", "front_left", "offline"),
  ];
  return { entries, visible: entries.filter((e) => !e.hidden) };
}

function speakerEntries(
  number: number,
  name: string,
  channel: string,
  state: string,
): ConfigEntryUI[] {
  const options = [
    { title: "Left", value: "front_left" },
    { title: "Right", value: "front_right" },
  ];
  return [
    entry(`speaker_${number}_state`, {
      type: ConfigEntryType.LABEL,
      default_value: state,
    }),
    entry(`speaker_${number}_display_name`, {
      type: ConfigEntryType.LABEL,
      label: "Speaker",
      value: name,
    }),
    entry(`speaker_${number}_channel_setting`, {
      value: channel,
      default_value: channel,
      options,
    }),
    entry(`speaker_${number}_output_delay`, {
      type: ConfigEntryType.INTEGER,
      value: 0,
    }),
  ];
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

function speaker(overrides: Partial<Player> = {}): Player {
  return {
    player_id: "studio-left",
    type: PlayerType.PLAYER,
    available: true,
    needs_setup: false,
    private: false,
    protocols: [protocol("sendspin", { role: ProtocolRole.NATIVE })],
    output_protocols: [
      output("sendspin", { output_protocol_id: "native", is_native: true }),
    ],
    ...overrides,
  } as Player;
}

function protocol(
  domain: string,
  overrides: Partial<PlayerProtocolInfo> = {},
): PlayerProtocolInfo {
  return {
    protocol_id: `${domain}-id`,
    domain,
    provider: domain,
    role: ProtocolRole.AUDIO,
    available: true,
    active: false,
    ...overrides,
  };
}

function output(
  domain: string,
  overrides: Partial<OutputProtocol> = {},
): OutputProtocol {
  return outputProtocol({
    output_protocol_id: domain,
    name: domain,
    protocol_domain: domain,
    ...overrides,
  });
}
