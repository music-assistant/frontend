import {
  PLAYER_SECTIONS,
  type PlayerSectionKey,
} from "@/helpers/player_sections";
import {
  canBeGroupMember,
  getPlayerDisplayName,
  groupMemberPickerVisible,
} from "@/helpers/players";
import {
  type Player,
  PlayerFeature,
  PlayerType,
  ProviderFeature,
  type ProviderInstance,
  type ProviderManifest,
} from "@/plugins/api/interfaces";

export type PlayerGroupFilter = "all" | PlayerSectionKey;

/** A kind of group the user can create: the provider that creates it. */
export interface GroupKind {
  // the instance id of the provider
  provider: string;
  domain: string;
  name: string;
  description: string;
}

// a universal group plays to any player, the others only group players that sync
const UNIVERSAL_GROUP_DOMAIN = "universal_group";

export function isPlayerGroupFilter(
  value: unknown,
): value is PlayerGroupFilter {
  return value === "all" || PLAYER_SECTIONS.some(({ key }) => key === value);
}

/**
 * Return the kinds of group that can be created, by their names.
 *
 * @param providers - The loaded providers, by instance id.
 * @param manifests - The provider manifests, by domain.
 */
export function getGroupKinds(
  providers: Record<string, ProviderInstance>,
  manifests: Record<string, ProviderManifest>,
): GroupKind[] {
  return Object.values(providers)
    .filter(
      (provider) =>
        provider.available &&
        provider.supported_features.includes(
          ProviderFeature.CREATE_GROUP_PLAYER,
        ),
    )
    .map((provider) => ({
      provider: provider.instance_id,
      domain: provider.domain,
      name:
        provider.name || manifests[provider.domain]?.name || provider.domain,
      description: manifests[provider.domain]?.description ?? "",
    }))
    .sort((left, right) => left.name.localeCompare(right.name));
}

/**
 * Return the players a new group can take as members, by their names.
 *
 * A universal group takes any player that plays. Any other group only takes players
 * that sync, and once members are picked only those that sync with one of them.
 *
 * @param players - All players, by player id.
 * @param domain - The domain of the provider that creates the group.
 * @param picked - The player ids of the members picked so far.
 */
export function getGroupMemberCandidates(
  players: Record<string, Player>,
  domain: string,
  picked: readonly string[],
): Player[] {
  const syncs = domain !== UNIVERSAL_GROUP_DOMAIN;
  return Object.values(players)
    .filter((player) => {
      if (
        !player.available ||
        player.type === PlayerType.GROUP ||
        !groupMemberPickerVisible(player) ||
        !canBeGroupMember(player)
      ) {
        return false;
      }
      if (!syncs) return true;
      if (!player.supported_features.includes(PlayerFeature.SET_MEMBERS)) {
        return false;
      }
      // a player synced to another one lists no players to group with, the
      // players its sync leader lists stand in for them
      let canGroupWith = player.can_group_with;
      if (canGroupWith.length === 0 && player.synced_to) {
        canGroupWith = players[player.synced_to]?.can_group_with ?? [];
      }
      if (canGroupWith.length === 0) return false;
      return (
        picked.length === 0 ||
        picked.includes(player.player_id) ||
        picked.some((playerId) => canGroupWith.includes(playerId))
      );
    })
    .sort((left, right) =>
      getPlayerDisplayName(left).localeCompare(
        getPlayerDisplayName(right),
        undefined,
        { sensitivity: "base" },
      ),
    );
}
