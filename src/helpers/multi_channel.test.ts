import type { ConfigEntryUI } from "@/helpers/config_entry_ui";
import {
  getChannelSwap,
  getComposableProtocol,
  getSpeakerCandidates,
  groupSpeakerEntries,
  suggestMultiChannelName,
} from "@/helpers/multi_channel";
import {
  ConfigEntryType,
  type OutputProtocol,
  type Player,
  type PlayerProtocolInfo,
  PlayerType,
  ProtocolRole,
  ProviderFeature,
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

describe("getComposableProtocol", () => {
  it("offers the protocol behind an output of a provider that combines speakers", () => {
    const sendspin = protocol("sendspin", { role: ProtocolRole.NATIVE });

    expect(
      getComposableProtocol(
        speaker({ protocols: [sendspin] }),
        output("sendspin", { output_protocol_id: "native", is_native: true }),
      ),
    ).toBe(sendspin);
  });

  it("offers nothing for an output of a provider that can not combine speakers", () => {
    expect(
      getComposableProtocol(
        speaker({ protocols: [protocol("airplay")] }),
        output("airplay"),
      ),
    ).toBeUndefined();
  });

  it("offers nothing for an output that rides on another protocol", () => {
    expect(
      getComposableProtocol(
        speaker({ protocols: [protocol("airplay"), protocol("sendspin")] }),
        output("sendspin", { derived_from: "airplay" }),
      ),
    ).toBeUndefined();
  });

  it("offers nothing for the output of a multi-channel player", () => {
    expect(
      getComposableProtocol(
        speaker({
          type: PlayerType.MULTI_CHANNEL,
          protocols: [protocol("sendspin")],
        }),
        output("sendspin"),
      ),
    ).toBeUndefined();
  });

  it("offers nothing for a web player or a protocol without a device", () => {
    expect(
      getComposableProtocol(
        speaker({ private: true, protocols: [protocol("sendspin")] }),
        output("sendspin"),
      ),
    ).toBeUndefined();
    expect(
      getComposableProtocol(
        speaker({
          protocols: [protocol("sendspin", { role: ProtocolRole.VIRTUAL })],
        }),
        output("sendspin"),
      ),
    ).toBeUndefined();
  });
});

describe("getSpeakerCandidates", () => {
  it("offers the other available speakers with an output of their own on the provider", () => {
    const players = [
      speaker({ player_id: "studio-left" }),
      speaker({ player_id: "studio-right" }),
      speaker({ player_id: "office" }),
      speaker({ player_id: "away", available: false }),
      speaker({ player_id: "pairing", needs_setup: true }),
      speaker({
        player_id: "output-away",
        protocols: [protocol("sendspin", { available: false })],
      }),
      speaker({ player_id: "web", private: true }),
      speaker({ player_id: "set", type: PlayerType.MULTI_CHANNEL }),
      speaker({
        player_id: "airplay-only",
        protocols: [protocol("airplay")],
        output_protocols: [output("airplay")],
      }),
      speaker({
        player_id: "bridge",
        protocols: [protocol("airplay"), protocol("sendspin")],
        output_protocols: [
          output("airplay"),
          output("sendspin", { derived_from: "airplay" }),
        ],
      }),
      speaker({
        player_id: "other-instance",
        protocols: [protocol("sendspin", { provider: "sendspin--2" })],
      }),
    ];

    expect(
      getSpeakerCandidates("studio-left", "sendspin", players).map(
        (player) => player.player_id,
      ),
    ).toEqual(["studio-right", "office"]);
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
});

describe("groupSpeakerEntries", () => {
  it("leaves the entries of a protocol that holds no multi-channel player alone", () => {
    const entries = [
      entry("speaker_1_channel", { value: "front_left" }),
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
    // an online speaker shows that in its row, an offline one also says what it means
    expect(speakers[0].entries.map((e) => e.key)).toEqual([
      "speaker_2_state",
      "speaker_2_channel",
      "speaker_2_output_delay",
    ]);
    expect(speakers[1].entries.map((e) => e.key)).toEqual([
      "speaker_1_channel",
      "speaker_1_output_delay",
    ]);
    expect(speakers[1].channel?.key).toBe("speaker_1_channel");
  });

  it("follows a channel picked but not saved yet", () => {
    const record = setRecord();
    record.entries.find((e) => e.key === "speaker_1_channel")!.value =
      "front_left";
    record.entries.find((e) => e.key === "speaker_2_channel")!.value =
      "front_right";

    expect(
      groupSpeakerEntries(record.entries, record.visible).speakers.map(
        (s) => s.number,
      ),
    ).toEqual([1, 2]);
  });

  it("names a speaker after its client id while the record has no name for it", () => {
    const entries = [
      entry("multi_channel_group_id", { hidden: true }),
      entry("speaker_1_client_id", { hidden: true, value: "client-1" }),
    ];

    expect(groupSpeakerEntries(entries, []).speakers[0].name).toBe("client-1");
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
    entry("multi_channel_group_id", { hidden: true, value: "group" }),
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
    entry(`speaker_${number}_client_id`, { hidden: true, value: `c${number}` }),
    entry(`speaker_${number}_name`, { hidden: true, value: name }),
    entry(`speaker_${number}_channel`, { value: channel, options }),
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
