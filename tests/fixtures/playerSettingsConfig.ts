import {
  ConfigEntryType,
  type ConfigEntry,
  type ConfigValueType,
  type OutputProtocol,
  type PlayerConfig,
} from "@/plugins/api/interfaces";
import { outputProtocol } from "./outputProtocol";
import { playerConfig } from "./playerConfig";

// the protocols a Chromecast plays over besides its own: AirPlay, and Sendspin riding on AirPlay
export const AIRPLAY_OUTPUT_ID = "ap0a1b2c3d4e5f";
export const SENDSPIN_OUTPUT_ID = "ss0a1b2c3d4e5f";

// the category headings as the server resolves them
const CATEGORY_LABELS: Record<string, string> = {
  generic: "Generic",
  announcements: "Announcements",
  player_controls: "Player controls",
  protocol_general: "General",
  protocol_chromecast: "Enable Chromecast support",
  protocol_airplay: "Enable AirPlay support",
  protocol_sendspin: "Enable Sendspin support (over AirPlay)",
};

const OUTPUT_CHANNEL_OPTIONS = [
  { title: "Stereo (both channels)", value: "stereo" },
  { title: "Left channel only", value: "left" },
  { title: "Right channel only", value: "right" },
  { title: "Mono (both channels)", value: "mono" },
];

const airplayKey = (key: string) => `${AIRPLAY_OUTPUT_ID}||protocol||${key}`;
const sendspinKey = (key: string) => `${SENDSPIN_OUTPUT_ID}||protocol||${key}`;

/**
 * The outputs of a Chromecast that also plays over AirPlay, and over Sendspin
 * riding on AirPlay.
 */
export function playerSettingsOutputs(): OutputProtocol[] {
  return [
    outputProtocol({
      output_protocol_id: "native",
      name: "Chromecast",
      is_native: true,
      protocol_domain: "chromecast",
      priority: 0,
    }),
    outputProtocol({
      output_protocol_id: AIRPLAY_OUTPUT_ID,
      name: "AirPlay",
      protocol_domain: "airplay",
      priority: 10,
    }),
    outputProtocol({
      output_protocol_id: SENDSPIN_OUTPUT_ID,
      name: "Sendspin",
      protocol_domain: "sendspin",
      priority: 20,
      derived_from: AIRPLAY_OUTPUT_ID,
    }),
  ];
}

/**
 * The config of that player as the server builds it: the entries of the player
 * itself, of its player controls and of each of its outputs, by key.
 */
export function playerSettingsConfig(
  overrides: Partial<PlayerConfig> = {},
): PlayerConfig {
  const entries: ConfigEntry[] = [
    // the player itself
    entry("hide_in_ui", ConfigEntryType.BOOLEAN, "generic", false, {
      label: "Hide this player in the user interface",
    }),
    entry("expose_player_to_ha", ConfigEntryType.BOOLEAN, "generic", true, {
      label: "Expose this player to Home Assistant",
    }),
    entry(
      "play_media_overrides_group",
      ConfigEntryType.BOOLEAN,
      "generic",
      true,
      { label: "Play Media overrides active group" },
    ),
    entry("tts_pre_announce", ConfigEntryType.BOOLEAN, "announcements", true, {
      label: "Pre-announce TTS announcements",
    }),
    entry(
      "pre_announcement_chime_url",
      ConfigEntryType.STRING,
      "announcements",
      null,
      {
        label: "Custom (pre)announcement chime URL",
        advanced: true,
        depends_on: "tts_pre_announce",
        depends_on_value: true,
      },
    ),
    // its player controls
    entry("power_control", ConfigEntryType.STRING, "player_controls", "none", {
      label: "Power Control",
      options: [
        { title: "Native power control", value: "native", disabled: true },
        { title: "None", value: "none" },
        { title: "Fake power control", value: "fake" },
      ],
    }),
    entry(
      "volume_control",
      ConfigEntryType.STRING,
      "player_controls",
      "native",
      {
        label: "Volume Control",
        required: true,
        options: [
          { title: "Native volume control", value: "native" },
          { title: "Follow protocol", value: "follow_protocol" },
          { title: "None", value: "none" },
        ],
      },
    ),
    entry("mute_control", ConfigEntryType.STRING, "player_controls", "native", {
      label: "Mute Control",
      required: true,
      options: [
        { title: "Native mute control", value: "native" },
        { title: "Follow protocol", value: "follow_protocol" },
        { title: "None", value: "none" },
        { title: "Fake mute control", value: "fake" },
      ],
    }),
    entry("min_volume", ConfigEntryType.INTEGER, "player_controls", 0, {
      label: "Minimum volume",
      advanced: true,
      depends_on: "volume_control",
      depends_on_value_not: "none",
    }),
    entry("max_volume", ConfigEntryType.INTEGER, "player_controls", 100, {
      label: "Maximum volume",
      advanced: true,
      depends_on: "volume_control",
      depends_on_value_not: "none",
    }),
    entry("auto_play", ConfigEntryType.BOOLEAN, "player_controls", false, {
      label: "Automatically play (resume on power on)",
      depends_on: "power_control",
      depends_on_value_not: "none",
    }),
    // which output plays, and the settings of each output
    entry(
      "preferred_output_protocol",
      ConfigEntryType.STRING,
      "protocol_general",
      "native",
      {
        label: "Preferred Output Protocol",
        required: true,
        options: [
          { title: "Chromecast (native)", value: "native" },
          { title: "AirPlay", value: AIRPLAY_OUTPUT_ID },
          { title: "Sendspin (over AirPlay)", value: SENDSPIN_OUTPUT_ID },
        ],
      },
    ),
    entry(
      "output_codec",
      ConfigEntryType.STRING,
      "protocol_chromecast",
      "flac",
      {
        label: "Output codec to use for streaming audio to the player",
        options: [
          { title: "FLAC (lossless, compressed)", value: "flac" },
          { title: "MP3 (lossy)", value: "mp3" },
          { title: "AAC (lossy)", value: "aac" },
          { title: "WAV (uncompressed PCM)", value: "wav" },
        ],
        advanced: true,
      },
    ),
    entry("flow_mode", ConfigEntryType.BOOLEAN, "protocol_chromecast", true, {
      label: "Enable queue flow mode",
      advanced: true,
    }),
    entry(
      "output_channels",
      ConfigEntryType.STRING,
      "protocol_chromecast",
      "stereo",
      {
        label: "Output Channel Mode",
        options: OUTPUT_CHANNEL_OPTIONS,
        advanced: true,
      },
    ),
    entry(
      airplayKey("enabled"),
      ConfigEntryType.BOOLEAN,
      "protocol_airplay",
      true,
      {
        label: "Enable this protocol on this player",
      },
    ),
    entry(
      airplayKey("sync_adjust"),
      ConfigEntryType.INTEGER,
      "protocol_airplay",
      0,
      {
        label: "Audio synchronization delay correction",
        depends_on: airplayKey("enabled"),
      },
    ),
    entry(
      airplayKey("output_channels"),
      ConfigEntryType.STRING,
      "protocol_airplay",
      "stereo",
      {
        label: "Output Channel Mode",
        options: OUTPUT_CHANNEL_OPTIONS,
        advanced: true,
        depends_on: airplayKey("enabled"),
      },
    ),
    entry(
      sendspinKey("enabled"),
      ConfigEntryType.BOOLEAN,
      "protocol_sendspin",
      true,
      {
        label: "Enable this protocol on this player",
      },
    ),
    entry(
      sendspinKey("output_channels"),
      ConfigEntryType.STRING,
      "protocol_sendspin",
      "stereo",
      {
        label: "Output Channel Mode",
        options: OUTPUT_CHANNEL_OPTIONS,
        advanced: true,
        depends_on: sendspinKey("enabled"),
      },
    ),
  ];
  return playerConfig({
    name: "Kitchen",
    values: Object.fromEntries(entries.map((e) => [e.key, e])),
    ...overrides,
  });
}

function entry(
  key: string,
  type: ConfigEntryType,
  category: string,
  value: ConfigValueType,
  overrides: Partial<ConfigEntry> = {},
): ConfigEntry {
  return {
    key,
    type,
    label: key,
    category,
    category_label: CATEGORY_LABELS[category],
    required: false,
    options: [],
    default_value: value,
    value,
    ...overrides,
  };
}
