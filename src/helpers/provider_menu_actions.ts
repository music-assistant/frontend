// The menu entries a provider declares in its manifest, as the menu of a media
// item shows them. A manifest may come from outside the project, so what it says
// is only ever shown as text, with the provider named under it.
import type { ContextMenuItem } from "@/helpers/context_menu_item";
import type {
  MediaType,
  ProviderInstance,
  ProviderManifest,
  Scope,
} from "@/plugins/api/interfaces";
import { Puzzle } from "@lucide/vue";
import { markRaw } from "vue";

// a plain material design icon name, as the server accepts it
const ICON_PATTERN = /^mdi-[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MAX_ICON_LENGTH = 64;

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
 * own entry, with the instance named under the label.
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
  return context.providers
    .filter((provider) => provider.available)
    .flatMap((provider) =>
      // an older server declares none
      (context.manifests[provider.domain]?.menu_actions ?? [])
        .filter(
          (action) =>
            action.requires_player === context.requiresPlayer &&
            action.media_types.includes(mediaType) &&
            context.hasScope(action.scope),
        )
        .map((action) => ({ provider, action })),
    )
    .sort((a, b) =>
      a.provider.name.localeCompare(b.provider.name, undefined, {
        sensitivity: "base",
      }),
    )
    .map(({ provider, action }) => ({
      // the label only names the entry; what it says is its text
      label: `provider_menu_action/${provider.instance_id}/${action.id}`,
      text: action.label,
      addedBy: provider.name,
      icon: isPlainIconName(action.icon) ? action.icon : markRaw(Puzzle),
      action: () =>
        choose({ instanceId: provider.instance_id, actionId: action.id }),
    }));
};

function isPlainIconName(icon: string | null): icon is string {
  return !!icon && icon.length <= MAX_ICON_LENGTH && ICON_PATTERN.test(icon);
}
