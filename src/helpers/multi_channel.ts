// Where the settings offer to combine speakers into a multi-channel player, and how the
// settings page of such a player shows each of its speakers. Which speakers can be
// combined is the server's call: it lists them per provider.
import type { ConfigEntryUI } from "@/helpers/config_entry_ui";
import { api } from "@/plugins/api";
import {
  type ConfigValueType,
  type OutputProtocol,
  type Player,
  type PlayerProtocolInfo,
  ProviderFeature,
} from "@/plugins/api/interfaces";

// the entry that marks the settings of a protocol as the record of a multi-channel player
const GROUP_ID_KEY = "multi_channel_group_id";
// the entries of a speaker in that record: speaker_<number>_<field>
const SPEAKER_KEY = /^speaker_(\d+)_([a-z_]+)$/;
const SPEAKER_ONLINE = "online";

export interface MultiChannelSpeaker {
  // the number of the speaker in the record of its player
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
 * Whether an entry belongs to the record of a multi-channel player: its group id, or an
 * entry of one of its speakers.
 *
 * @param entry The entry.
 * @param entries Every entry of the form it is on.
 */
export const isMultiChannelRecordEntry = function (
  entry: Pick<ConfigEntryUI, "key" | "category">,
  entries: Pick<ConfigEntryUI, "key" | "category">[],
): boolean {
  if (entry.key === GROUP_ID_KEY) return true;
  return (
    SPEAKER_KEY.test(entry.key) &&
    entries.some(
      (other) =>
        other.key === GROUP_ID_KEY && other.category === entry.category,
    )
  );
};

/**
 * The field of a speaker an entry of a multi-channel player holds, such as "channel" for
 * `speaker_1_channel`. Undefined for an entry of no speaker.
 */
export const getSpeakerField = function (key: string): string | undefined {
  return SPEAKER_KEY.exec(key)?.[2];
};

/**
 * A name for a player made of two speakers: the words both their names start with, such
 * as "Studio" for "Studio left" and "Studio right". Empty when they share none.
 */
export const suggestMultiChannelName = function (
  first: string,
  second: string,
): string {
  const firstWords = first.trim().split(/\s+/);
  const secondWords = second.trim().split(/\s+/);
  const shared: string[] = [];
  for (const [index, word] of firstWords.entries()) {
    if (word.toLocaleLowerCase() !== secondWords[index]?.toLocaleLowerCase()) {
      break;
    }
    shared.push(word);
  }
  return shared.join(" ");
};

/**
 * The speakers of a multi-channel player in the entries of one protocol, each with the
 * entries to show for it, in the order of their channels. Without the record of a
 * multi-channel player the protocol has no speakers, and every entry belongs to no
 * speaker.
 *
 * @param entries Every entry of the protocol, the hidden ones too.
 * @param visible The entries of the protocol that show.
 */
export const groupSpeakerEntries = function (
  entries: ConfigEntryUI[],
  visible: ConfigEntryUI[],
): SpeakerEntries {
  if (!entries.some((entry) => entry.key === GROUP_ID_KEY)) {
    return { speakers: [], others: visible };
  }
  const valueOf = (number: number, field: string) =>
    entries.find((entry) => entry.key === `speaker_${number}_${field}`)?.value;
  const speakers = new Map<number, MultiChannelSpeaker>();
  // every speaker in the record has a client id, also one whose entries do not show
  for (const entry of entries) {
    const match = SPEAKER_KEY.exec(entry.key);
    if (match?.[2] !== "client_id") continue;
    const number = Number(match[1]);
    const state = entries.find((e) => e.key === `speaker_${number}_state`);
    speakers.set(number, {
      number,
      name: String(valueOf(number, "name") ?? entry.value ?? ""),
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
    if (match[2] === "channel") speaker.channel = entry;
    // the row of the speaker says it is online, which is all its state says then
    if (match[2] === "state" && speaker.online) continue;
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

/** The place of the channel of a speaker among the channels it can have, unknown ones last. */
function channelOrder(speaker: MultiChannelSpeaker): number {
  const channel = speaker.channel;
  const index =
    channel?.options.findIndex((option) => option.value === channel.value) ??
    -1;
  return index === -1 ? Number.MAX_SAFE_INTEGER : index;
}
