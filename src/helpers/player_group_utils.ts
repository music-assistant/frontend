import api from "@/plugins/api";
import { Player, PlayerFeature, PlayerType } from "@/plugins/api/interfaces";
import { CONFIG_KEY, type ConfigKey } from "@/plugins/api/constants";

const perGroupOnlyConfigKeys: ConfigKey[] = [
  CONFIG_KEY.CROSSFADE_DURATION,
  CONFIG_KEY.SMART_FADES_MODE,
  CONFIG_KEY.OUTPUT_CHANNELS,
  CONFIG_KEY.VOLUME_NORMALIZATION,
  CONFIG_KEY.OUTPUT_LIMITER,
];

const perPlayerRequires: Record<string, string> = {
  dsp_settings: PlayerFeature.MULTI_DEVICE_DSP,
  dsp_note_multi_device_group_not_supported: PlayerFeature.MULTI_DEVICE_DSP,
};

export interface GroupContext {
  inGroup: boolean;
  leaderId: string | null;
  leaderName: string | null;
  isLeader: boolean;
  // config keys which take affect per group rather than per group member
  perGrpCfgKeys: string[];
  // are the DSP settings of this player active in the group?
  ownsDSPSettings: boolean;
  dspPerPlayer: boolean;
  dspPerGroup: boolean;
}

export function deriveGroupContext(
  playerId: string | null | undefined,
  players: Record<
    string,
    {
      player_id: string;
      name?: string;
      active_group?: string | null;
      synced_to?: string | null;
      group_members: unknown[];
    }
  >,
): GroupContext {
  const p = playerId ? api.players[playerId] : null;
  if (!p) {
    return {
      inGroup: false,
      leaderId: null,
      leaderName: null,
      isLeader: false,
      perGrpCfgKeys: [],
      global_dsp: false,
      individual_dsp: false,
    };
  }

  const leaderId =
    p.active_group ??
    p.synced_to ??
    (p.group_members.length ? p.player_id : null);

  const isLeader = leaderId === p.player_id;
  const leaderName = leaderId ? (players[leaderId]?.name ?? null) : null;
  const inGroup = leaderId != null;
  const dspPerPlayer =
    !inGroup || p.supported_features.includes(PlayerFeature.MULTI_DEVICE_DSP);
  // dsp settings per group are not supported yet
  const dspPerGroup = false;

  const ownsDSPSettings =
    (p.type != PlayerType.GROUP && dspPerPlayer) || (isLeader && dspPerGroup);

  const missingFeatureKeys = Object.entries(perPlayerRequires)
    .filter(([_, feature]) => !p.supported_features.includes(feature))
    .map(([key]) => key);
  const perGrpCfgKeys = [...perGroupOnlyConfigKeys, ...missingFeatureKeys];

  return {
    inGroup,
    leaderId,
    leaderName,
    isLeader,
    perGrpCfgKeys,
    ownsDSPSettings,
    dspPerPlayer,
    dspPerGroup,
  };
}
