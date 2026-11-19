// The menu entries a provider declares in its manifest, as the menu of a media
// item shows them. A manifest may come from outside the project, so what it says
// is only ever shown as text, in a submenu under the provider's name.
import ProviderIcon from "@/components/ProviderIcon.vue";
import type { ContextMenuItem } from "@/helpers/context_menu_item";
import type {
  MediaType,
  ProviderInstance,
  ProviderManifest,
  Scope,
} from "@/plugins/api/interfaces";
import { Puzzle } from "@lucide/vue";
import { type Component, defineComponent, h, markRaw } from "vue";

// a plain material design icon name, as the server accepts it
const ICON_PATTERN = /^mdi-[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MAX_ICON_LENGTH = 64;

/** A menu entry a provider instance declares, chosen for one media item. */
export interface ProviderMenuChoice {
  instanceId: string;
  actionId: string;
  // whether the action acts on a player, which is then passed with it
  requiresPlayer: boolean;
}

/** Which entries a menu offers, and what the user sees and may do. */
export interface ProviderMenuContext {
  // the entries of actions that act on a player, the others, or all of them
  offer: "player" | "other" | "all";
  // whether a player is chosen; without one an entry that acts on a player is disabled
  hasPlayer: boolean;
  // the provider instances the user sees
  providers: readonly ProviderInstance[];
  manifests: Readonly<Record<string, ProviderManifest>>;
  hasScope: (scope: Scope) => boolean;
}

/**
 * The menu entries the available provider instances declare for an item of a
 * media type: one entry per instance, named and drawn as the instance, with
 * its entries for the item in a submenu, sorted by name. An instance offers
 * the entries of a media type the item has, of the kind the menu offers and
 * with a scope the user holds; an instance without any is left out.
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
    .flatMap((provider) => {
      const manifest = context.manifests[provider.domain];
      // an older server declares none
      const subItems = (manifest?.menu_actions ?? [])
        .filter(
          (action) =>
            (context.offer === "all" ||
              action.requires_player === (context.offer === "player")) &&
            action.media_types.includes(mediaType) &&
            context.hasScope(action.scope),
        )
        .map((action) => ({
          // the label only names the entry; what it says is its text
          label: `provider_menu_action/${provider.instance_id}/${action.id}`,
          text: action.label,
          icon: isPlainIconName(action.icon) ? action.icon : markRaw(Puzzle),
          disabled: action.requires_player && !context.hasPlayer,
          action: () =>
            choose({
              instanceId: provider.instance_id,
              actionId: action.id,
              requiresPlayer: action.requires_player,
            }),
        }));
      if (!subItems.length) return [];
      return [
        {
          label: `provider_menu/${provider.instance_id}`,
          // an instance renamed to blanks is named after its provider
          text:
            provider.name.trim() || manifest?.name.trim() || provider.domain,
          icon: providerIcon(provider.domain),
          subItems,
        },
      ];
    })
    .sort((a, b) =>
      a.text.localeCompare(b.text, undefined, { sensitivity: "base" }),
    );
};

/**
 * Whether an icon a manifest declares is a plain material design icon name,
 * which is all the app draws from a manifest.
 *
 * @param icon - The icon the manifest declares, if any.
 */
export function isPlainIconName(icon: string | null): icon is string {
  return !!icon && icon.length <= MAX_ICON_LENGTH && ICON_PATTERN.test(icon);
}

// one component per domain, so a menu that is built again keeps its icons
const providerIcons = new Map<string, Component>();

function providerIcon(domain: string): Component {
  let icon = providerIcons.get(domain);
  if (!icon) {
    icon = markRaw(
      defineComponent({
        name: "ProviderMenuIcon",
        render: () => h(ProviderIcon, { domain, size: 20 }),
      }),
    );
    providerIcons.set(domain, icon);
  }
  return icon;
}
