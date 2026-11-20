// Where the settings offer to combine speakers into a multi-channel player, and how the
// settings page of such a player shows each of its speakers. Which speakers can be
// combined is the server's call: it lists them per provider.
import type { ConfigEntryUI } from "@/helpers/config_entry_ui";
import { api } from "@/plugins/api";
import {
  ChannelLayout,
  type ConfigValueType,
  type OutputProtocol,
  type Player,
  type PlayerProtocolInfo,
  ProviderFeature,
  SpeakerChannel,
} from "@/plugins/api/interfaces";

// the entries of a speaker of a multi-channel player: speaker_<number>_<field>
const SPEAKER_KEY = /^speaker_(\d+)_([a-z_]+)$/;
// the fields of a speaker; one with a state and a channel shows as a row of its own
const SPEAKER_STATE = "state";
const SPEAKER_CHANNEL = "channel_setting";
const SPEAKER_NAME = "display_name";
const SPEAKER_ONLINE = "online";

export interface MultiChannelSpeaker {
  // the number of the speaker in the entries of its player
  number: number;
  name: string;
  online: boolean;
  // the entry that holds the channel the speaker plays
  channel?: ConfigEntryUI;
  // the entries to show for the speaker, in the order the server gave them
  entries: ConfigEntryUI[];
}

export interface SpeakerEntries {
  speakers: MultiChannelSpeaker[];
  // the entries that belong to no speaker
  others: ConfigEntryUI[];
}

export interface ChannelChange {
  entry: ConfigEntryUI;
  value: ConfigValueType;
}

// the player ids that can be a speaker of a new multi-channel player, by provider (instance)
export type MultiChannelCandidates = Record<string, readonly string[]>;

// the layouts a provider combines speakers into, each with its channels in order, as the
// server lists them
export type MultiChannelLayouts = Partial<
  Record<ChannelLayout, readonly SpeakerChannel[]>
>;

// the player id of the speaker on each channel of a multi-channel player to be
export type ChannelSpeakers = Partial<Record<SpeakerChannel, string>>;

/** Whether a provider (instance) can combine its speakers into a multi-channel player. */
export const canCombineSpeakers = function (
  providerInstanceId: string,
): boolean {
  return !!api
    .getProvider(providerInstanceId)
    ?.supported_features.includes(ProviderFeature.CREATE_MULTI_CHANNEL_PLAYER);
};

/** The providers (instances) of the protocols of a player that can combine speakers. */
export const getCombiningProviders = function (
  player: Pick<Player, "protocols">,
): string[] {
  return [
    ...new Set(player.protocols.map((protocol) => protocol.provider)),
  ].filter(canCombineSpeakers);
};

/**
 * The protocol behind an output of a player that can start a multi-channel player: one of
 * a provider that combines speakers and lists the player as a candidate speaker. Undefined
 * for any other output.
 *
 * @param player The player the output belongs to.
 * @param output The output.
 * @param candidates The candidate speakers the server listed.
 */
export const getComposableProtocol = function (
  player: Pick<Player, "player_id" | "protocols">,
  output: Pick<OutputProtocol, "protocol_domain">,
  candidates: MultiChannelCandidates,
): PlayerProtocolInfo | undefined {
  // a player holds one protocol of each domain; the domain also finds the protocol of
  // the native output, whose id is "native" rather than that of its protocol
  const protocol = player.protocols.find(
    (candidate) => candidate.domain === output.protocol_domain,
  );
  return protocol &&
    canCombineSpeakers(protocol.provider) &&
    candidates[protocol.provider]?.includes(player.player_id)
    ? protocol
    : undefined;
};

/**
 * Whether an entry is the channel of a speaker of a multi-channel player.
 *
 * @param entry The entry.
 * @param entries Every entry of the settings of that player.
 */
export const isSpeakerChannelEntry = function (
  entry: Pick<ConfigEntryUI, "key" | "category">,
  entries: Pick<ConfigEntryUI, "key" | "category">[],
): boolean {
  const match = SPEAKER_KEY.exec(entry.key);
  if (match?.[2] !== SPEAKER_CHANNEL) return false;
  const sameProtocol = entries.filter((e) => e.category === entry.category);
  return getSpeakerNumbers(sameProtocol).has(Number(match[1]));
};

/**
 * The field of a speaker an entry of a multi-channel player holds, such as
 * "output_delay" for `speaker_1_output_delay`. Undefined for an entry of no speaker.
 */
export const getSpeakerField = function (key: string): string | undefined {
  return SPEAKER_KEY.exec(key)?.[2];
};

/**
 * A name for a player made of speakers: the words all their names start with, such as
 * "Studio" for "Studio left" and "Studio right". Empty when they share none.
 */
export const suggestMultiChannelName = function (...names: string[]): string {
  const [first = [], ...others] = names.map((name) => name.trim().split(/\s+/));
  const shared: string[] = [];
  for (const [index, word] of first.entries()) {
    const lower = word.toLocaleLowerCase();
    if (others.some((words) => words[index]?.toLocaleLowerCase() !== lower)) {
      break;
    }
    shared.push(word);
  }
  return shared.join(" ");
};

/**
 * The speakers on the channels after a speaker moves to a channel: the speaker that was on
 * that channel takes the one the moving speaker leaves, if it had one.
 *
 * @param speakers The speaker on each channel.
 * @param channel The channel the speaker moves to.
 * @param playerId The player id of the speaker.
 */
export const assignChannelSpeaker = function (
  speakers: ChannelSpeakers,
  channel: SpeakerChannel,
  playerId: string,
): ChannelSpeakers {
  const result = { ...speakers, [channel]: playerId };
  const left = (Object.keys(speakers) as SpeakerChannel[]).find(
    (candidate) => candidate !== channel && speakers[candidate] === playerId,
  );
  if (left) {
    if (speakers[channel] === undefined) delete result[left];
    else result[left] = speakers[channel];
  }
  return result;
};

/**
 * The speakers on the channels of another layout: each keeps its channel when the layout has
 * it, and the speaker that has to stay takes the first free channel, else the first one.
 *
 * @param speakers The speaker on each channel of the previous layout.
 * @param channels The channels of the new layout.
 * @param keep The player id of the speaker that has to stay.
 */
export const changeChannelLayout = function (
  speakers: ChannelSpeakers,
  channels: readonly SpeakerChannel[],
  keep: string,
): ChannelSpeakers {
  const result: ChannelSpeakers = {};
  for (const channel of channels) {
    if (speakers[channel] !== undefined) result[channel] = speakers[channel];
  }
  if (!Object.values(result).includes(keep)) {
    const free = channels.find((channel) => result[channel] === undefined);
    result[free ?? channels[0]] = keep;
  }
  return result;
};

/**
 * Whether a multi-channel player can take a subwoofer: one of the layouts of its provider has
 * the channels of the player and a subwoofer.
 *
 * @param layouts The layouts of the provider of the player.
 * @param layout The layout of the player.
 */
export const canAddSubwoofer = function (
  layouts: MultiChannelLayouts,
  layout: ChannelLayout,
): boolean {
  const channels = layouts[layout];
  return (
    !!channels &&
    !channels.includes(SpeakerChannel.LFE) &&
    isLayout(layouts, [...channels, SpeakerChannel.LFE])
  );
};

/**
 * Whether a multi-channel player can let its subwoofer go: one of the layouts of its provider
 * has the channels of the player without the subwoofer.
 *
 * @param layouts The layouts of the provider of the player.
 * @param layout The layout of the player.
 */
export const canRemoveSubwoofer = function (
  layouts: MultiChannelLayouts,
  layout: ChannelLayout,
): boolean {
  const channels = layouts[layout];
  return (
    !!channels?.includes(SpeakerChannel.LFE) &&
    isLayout(
      layouts,
      channels.filter((channel) => channel !== SpeakerChannel.LFE),
    )
  );
};

/**
 * The subwoofer of a multi-channel player: the speaker on the LFE channel. Undefined for a
 * player without one.
 *
 * @param entries Every entry of the config of the player.
 */
export const getSubwoofer = function (
  entries: ConfigEntryUI[],
): MultiChannelSpeaker | undefined {
  return groupSpeakerEntries(entries, entries).speakers.find(
    (speaker) => speaker.channel?.value === SpeakerChannel.LFE,
  );
};

/**
 * The speakers of a multi-channel player in the entries of its protocol, each with the
 * entries to show for it, in the order of their channels. A speaker is one the server
 * sends a state and a channel for; the other entries belong to no speaker.
 *
 * @param entries Every entry of the protocol, the hidden ones too.
 * @param visible The entries of the protocol that show.
 */
export const groupSpeakerEntries = function (
  entries: ConfigEntryUI[],
  visible: ConfigEntryUI[],
): SpeakerEntries {
  const valueOf = (number: number, field: string) =>
    entries.find((entry) => entry.key === `speaker_${number}_${field}`);
  const speakers = new Map<number, MultiChannelSpeaker>();
  for (const number of getSpeakerNumbers(entries)) {
    const state = valueOf(number, SPEAKER_STATE);
    speakers.set(number, {
      number,
      name: String(valueOf(number, SPEAKER_NAME)?.value ?? ""),
      online: (state?.value ?? state?.default_value) === SPEAKER_ONLINE,
      entries: [],
    });
  }
  const others: ConfigEntryUI[] = [];
  for (const entry of visible) {
    const match = SPEAKER_KEY.exec(entry.key);
    const speaker = match ? speakers.get(Number(match[1])) : undefined;
    if (!match || !speaker) {
      others.push(entry);
      continue;
    }
    const field = match[2];
    if (field === SPEAKER_CHANNEL) speaker.channel = entry;
    // the row names the speaker, and says it is online, which is all its state says then
    if (field === SPEAKER_NAME || (field === SPEAKER_STATE && speaker.online)) {
      continue;
    }
    speaker.entries.push(entry);
  }
  return {
    speakers: [...speakers.values()].sort(
      (a, b) => channelOrder(a) - channelOrder(b) || a.number - b.number,
    ),
    others,
  };
};

/**
 * The change that keeps every speaker on a channel of its own when one moves to a channel:
 * the speaker on that channel takes the one the other leaves. Undefined when the entry is
 * no channel of a speaker, or no other speaker is on that channel.
 *
 * @param speakers The speakers of the multi-channel player.
 * @param entry The channel entry of the speaker that moves, still holding its old value.
 * @param value The channel it moves to.
 */
export const getChannelSwap = function (
  speakers: MultiChannelSpeaker[],
  entry: ConfigEntryUI,
  value: ConfigValueType,
): ChannelChange | undefined {
  if (!speakers.some((speaker) => speaker.channel === entry)) return undefined;
  const other = speakers.find(
    (speaker) => speaker.channel !== entry && speaker.channel?.value === value,
  )?.channel;
  return other ? { entry: other, value: entry.value ?? null } : undefined;
};

/** Whether the channels are those of one of the layouts, in any order. */
function isLayout(
  layouts: MultiChannelLayouts,
  channels: readonly SpeakerChannel[],
): boolean {
  return Object.values(layouts).some(
    (other) =>
      other?.length === channels.length &&
      channels.every((channel) => other.includes(channel)),
  );
}

/** The numbers of the speakers in entries of one protocol: each with a state and a channel. */
function getSpeakerNumbers(entries: Pick<ConfigEntryUI, "key">[]): Set<number> {
  const fieldsByNumber = new Map<number, Set<string>>();
  for (const entry of entries) {
    const match = SPEAKER_KEY.exec(entry.key);
    if (!match) continue;
    const number = Number(match[1]);
    const fields = fieldsByNumber.get(number) ?? new Set<string>();
    fields.add(match[2]);
    fieldsByNumber.set(number, fields);
  }
  return new Set(
    [...fieldsByNumber]
      .filter(
        ([, fields]) =>
          fields.has(SPEAKER_STATE) && fields.has(SPEAKER_CHANNEL),
      )
      .map(([number]) => number),
  );
}

/** The place of the channel of a speaker among the channels it can have, unknown ones last. */
function channelOrder(speaker: MultiChannelSpeaker): number {
  const channel = speaker.channel;
  const index =
    channel?.options.findIndex((option) => option.value === channel.value) ??
    -1;
  return index === -1 ? Number.MAX_SAFE_INTEGER : index;
}
