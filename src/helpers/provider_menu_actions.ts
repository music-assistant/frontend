// The menu entries a provider declares in its manifest, as the menu of a media
// item shows them. A manifest may come from outside the project, so what it says
// is only ever shown as text, and anything unexpected in it is left out.
import type { ContextMenuItem } from "@/helpers/context_menu_item";
import {
  MediaType,
  type ProviderInstance,
  type ProviderManifest,
  Scope,
} from "@/plugins/api/interfaces";
import { $t } from "@/plugins/i18n";
import { Puzzle } from "@lucide/vue";
import { markRaw } from "vue";

/** The media types whose menu offers the entries providers declare. */
export const MENU_ACTION_MEDIA_TYPES: readonly MediaType[] = [
  MediaType.TRACK,
  MediaType.ALBUM,
  MediaType.ARTIST,
  MediaType.PLAYLIST,
  MediaType.RADIO,
  MediaType.PODCAST,
  MediaType.PODCAST_EPISODE,
  MediaType.AUDIOBOOK,
];

// a plain material design icon name, as the server accepts it
const ICON_PATTERN = /^mdi-[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MAX_ICON_LENGTH = 64;
const KNOWN_SCOPES = new Set<string>(Object.values(Scope));

/** A menu entry a provider instance declares, chosen for one media item. */
export interface ProviderMenuChoice {
  instanceId: string;
  actionId: string;
}

/** Where the entries go: with the ways to play the item, or in its own menu. */
export interface ProviderMenuContext {
  // the entries of actions that act on a player, or the others
  requiresPlayer: boolean;
  // the provider instances the user sees
  providers: readonly ProviderInstance[];
  manifests: Readonly<Record<string, ProviderManifest>>;
  hasScope: (scope: Scope) => boolean;
}

/**
 * The menu entries the available provider instances declare for an item of a
 * media type, for the actions that act on a player or for the others: those of
 * a media type the item has, with a scope the user holds. Each instance gets its
 * own entry, named after the instance when more than one offers it.
 *
 * @param mediaType - The media type of the item.
 * @param context - Which entries, and what the user sees and may do.
 * @param choose - What choosing an entry does.
 */
export const getProviderMenuItems = (
  mediaType: MediaType,
  context: ProviderMenuContext,
  choose: (choice: ProviderMenuChoice) => void,
): ContextMenuItem[] => {
  if (!MENU_ACTION_MEDIA_TYPES.includes(mediaType)) return [];
  const offered = context.providers
    .filter((provider) => provider.available)
    .flatMap((provider) =>
      readMenuActions(context.manifests[provider.domain])
        .filter(
          (action) =>
            action.requires_player === context.requiresPlayer &&
            action.media_types.includes(mediaType) &&
            context.hasScope(action.scope as Scope),
        )
        .map((action) => ({ provider, action })),
    )
    .sort((a, b) =>
      a.provider.name.localeCompare(b.provider.name, undefined, {
        sensitivity: "base",
      }),
    );
  return offered.map(({ provider, action }) => {
    const sameAction = offered.filter(
      (other) =>
        other.provider.domain === provider.domain &&
        other.action.id === action.id,
    );
    return {
      // the label only names the entry; what it says is its text
      label: `provider_menu_action/${provider.instance_id}/${action.id}`,
      text:
        sameAction.length > 1
          ? $t("menu_action_of_instance", {
              action: action.label,
              instance: provider.name,
            })
          : action.label,
      icon: isPlainIconName(action.icon) ? action.icon : markRaw(Puzzle),
      action: () =>
        choose({ instanceId: provider.instance_id, actionId: action.id }),
    };
  });
};

interface MenuAction {
  id: string;
  label: string;
  media_types: string[];
  scope: string;
  icon: unknown;
  requires_player: boolean;
}

// the actions of a manifest that are what the app expects, with a scope it knows
function readMenuActions(manifest?: ProviderManifest): MenuAction[] {
  const declared: unknown = manifest?.menu_actions;
  if (!Array.isArray(declared)) return [];
  return declared.flatMap((item: unknown) => {
    if (!item || typeof item !== "object") return [];
    const action = item as Record<string, unknown>;
    const mediaTypes = action.media_types;
    if (
      typeof action.id !== "string" ||
      typeof action.label !== "string" ||
      typeof action.scope !== "string" ||
      !KNOWN_SCOPES.has(action.scope) ||
      !Array.isArray(mediaTypes)
    )
      return [];
    return [
      {
        id: action.id,
        label: action.label,
        media_types: mediaTypes.filter(
          (mediaType): mediaType is string => typeof mediaType === "string",
        ),
        scope: action.scope,
        icon: action.icon,
        requires_player: action.requires_player === true,
      },
    ];
  });
}

function isPlainIconName(icon: unknown): icon is string {
  return (
    typeof icon === "string" &&
    icon.length <= MAX_ICON_LENGTH &&
    ICON_PATTERN.test(icon)
  );
}
