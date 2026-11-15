// What can be added and how the Catalog and the add dialog list it. Both decide
// from here, so they never offer a different set.
import { isSelfServiceProvider } from "@/helpers/provider_access";
import { isBuiltinProvider } from "@/helpers/provider_config";
import {
  type ProviderConfig,
  type ProviderManifest,
  ProviderStage,
  ProviderType,
} from "@/plugins/api/interfaces";
import type {
  LocationQuery,
  LocationQueryRaw,
  RouteLocationRaw,
} from "vue-router";

export interface CatalogType {
  type: ProviderType;
  // the plural name, as the settings page of the type is called
  label: string;
  // the name of one of them, as a card shows it
  itemLabel: string;
  // the link to the settings page of the type
  manageLabel: string;
}

/** The types the Catalog offers, in the order of its tabs. */
export const CATALOG_TYPES: readonly CatalogType[] = [
  {
    type: ProviderType.MUSIC,
    label: "settings.music_sources",
    itemLabel: "settings.catalog.type.music",
    manageLabel: "settings.catalog.manage_type.music",
  },
  {
    type: ProviderType.PLAYER,
    label: "settings.playerproviders",
    itemLabel: "settings.catalog.type.player",
    manageLabel: "settings.catalog.manage_type.player",
  },
  {
    type: ProviderType.METADATA,
    label: "settings.metadataproviders",
    itemLabel: "settings.catalog.type.metadata",
    manageLabel: "settings.catalog.manage_type.metadata",
  },
  {
    type: ProviderType.PLUGIN,
    label: "settings.plugins",
    itemLabel: "settings.catalog.type.plugin",
    manageLabel: "settings.catalog.manage_type.plugin",
  },
  {
    type: ProviderType.AUDIO_ANALYSIS,
    label: "settings.audio_analysis_providers",
    itemLabel: "settings.catalog.type.audio_analysis",
    manageLabel: "settings.catalog.manage_type.audio_analysis",
  },
];

/** Listed first, in this order. */
export const POPULAR_PROVIDERS: readonly string[] = [
  "spotify",
  "tidal",
  "qobuz",
  "filesystem_local",
  "sonos",
  "chromecast",
  "airplay",
  "spotify_connect",
  "airplay_receiver",
];

/** The stages a provider that can be added may have, to filter on. */
export const ADDABLE_PROVIDER_STAGES: readonly ProviderStage[] = [
  ProviderStage.STABLE,
  ProviderStage.BETA,
  ProviderStage.ALPHA,
  ProviderStage.EXPERIMENTAL,
  ProviderStage.UNMAINTAINED,
  // no deprecated stage: those providers are never offered
];

export const FEATURE_REQUESTS_URL =
  "https://github.com/orgs/music-assistant/discussions/categories/feature-requests-and-ideas";

export interface AddRestrictions {
  // only these types, when set
  types?: readonly ProviderType[];
  // only providers that allow more than one instance
  multiInstanceOnly?: boolean;
  // only providers that a member may set up itself
  selfServiceOnly?: boolean;
}

/** What a user who does not manage every provider may add: a music source of its own. */
export const MEMBER_ADD_RESTRICTIONS: AddRestrictions = {
  types: [ProviderType.MUSIC],
  multiInstanceOnly: true,
  selfServiceOnly: true,
};

/** One thing the Catalog lists. */
export interface CatalogEntry {
  manifest: ProviderManifest;
  // the instances of it that the user manages, empty when there is none
  instances: ProviderConfig[];
  // whether an instance (or another one) may be added
  canAdd: boolean;
}

export interface CatalogFilter {
  query?: string;
  types?: readonly string[];
  stages?: readonly string[];
}

/**
 * Whether the type is one the Catalog offers.
 *
 * @param type - A provider type, or any string read from a route.
 */
export const isCatalogType = (type: unknown): type is ProviderType =>
  CATALOG_TYPES.some((item) => item.type === type);

/** The Catalog type of a provider type, or undefined for one the Catalog does not offer. */
export const getCatalogType = (type: string): CatalogType | undefined =>
  CATALOG_TYPES.find((item) => item.type === type);

/**
 * Whether a provider can be set up at all within the given restrictions. A
 * provider that ships with the server, a retired one and a type the Catalog
 * does not offer never can.
 *
 * @param manifest - The manifest of the provider.
 * @param restrictions - What the user may add.
 */
export const isOfferable = (
  manifest: ProviderManifest,
  restrictions: AddRestrictions = {},
): boolean =>
  !isBuiltinProvider(manifest) &&
  // a deprecated provider is retired: it can no longer be set up, even though
  // it is no longer builtin
  manifest.stage !== ProviderStage.DEPRECATED &&
  isCatalogType(manifest.type) &&
  (!restrictions.types || restrictions.types.includes(manifest.type)) &&
  (!restrictions.multiInstanceOnly || manifest.multi_instance) &&
  (!restrictions.selfServiceOnly || isSelfServiceProvider(manifest));

/**
 * The Catalog entries for the offerable providers, alphabetically by name.
 *
 * @param manifests - Every provider manifest the server knows.
 * @param configs - The provider instances set up that the user can see.
 * @param restrictions - What the user may add.
 * @param canManage - Whether the user manages an instance; by default every one.
 */
export const buildCatalogEntries = (
  manifests: readonly ProviderManifest[],
  configs: readonly ProviderConfig[],
  restrictions: AddRestrictions = {},
  canManage: (config: ProviderConfig) => boolean = () => true,
): CatalogEntry[] =>
  manifests
    .filter((manifest) => isOfferable(manifest, restrictions))
    .map((manifest) => {
      const instances = configs.filter(
        (config) => config.domain === manifest.domain,
      );
      return {
        manifest,
        instances: instances.filter(canManage),
        canAdd: manifest.multi_instance || instances.length === 0,
      };
    })
    .sort((a, b) => compareNames(a.manifest.name, b.manifest.name));

/**
 * The entries that match the search text, the types and the stages; an empty
 * or missing criterion matches everything.
 *
 * @param entries - The entries to narrow down.
 * @param filter - The search text (on name and description), types and stages.
 */
export const filterCatalogEntries = (
  entries: readonly CatalogEntry[],
  filter: CatalogFilter,
): CatalogEntry[] => {
  const query = filter.query?.trim().toLowerCase();
  return entries.filter(
    ({ manifest }) =>
      (!query ||
        manifest.name.toLowerCase().includes(query) ||
        manifest.description.toLowerCase().includes(query)) &&
      (!filter.types?.length || filter.types.includes(manifest.type)) &&
      (!filter.stages?.length || filter.stages.includes(manifest.stage)),
  );
};

/** The entries with the popular ones first, in their popular order. */
export const sortPopularFirst = (
  entries: readonly CatalogEntry[],
): CatalogEntry[] =>
  [...entries].sort((a, b) => {
    const aRank = popularRank(a.manifest.domain);
    const bRank = popularRank(b.manifest.domain);
    if (aRank !== bRank) return aRank - bRank;
    return compareNames(a.manifest.name, b.manifest.name);
  });

/** The popular entries that can be added, in their popular order. */
export const getPopularEntries = (
  entries: readonly CatalogEntry[],
): CatalogEntry[] =>
  sortPopularFirst(
    entries.filter(
      (entry) =>
        entry.canAdd && POPULAR_PROVIDERS.includes(entry.manifest.domain),
    ),
  );

export const CATALOG_ALL_TAB = "all";
export const CATALOG_INSTALLED_TAB = "installed";

/** A tab of the Catalog: everything, one type, or what is set up. */
export type CatalogTab =
  typeof CATALOG_ALL_TAB | typeof CATALOG_INSTALLED_TAB | ProviderType;

/**
 * The Catalog tab a route query opens: the Installed view for `view=installed`,
 * else the first type in `types` that is one of the given ones, else everything.
 *
 * @param query - The query of the Catalog route.
 * @param types - The types that have a tab.
 */
export const getCatalogTab = (
  query: LocationQuery,
  types: readonly ProviderType[],
): CatalogTab => {
  if (query.view === CATALOG_INSTALLED_TAB) return CATALOG_INSTALLED_TAB;
  const type = String(query.types ?? "").split(",")[0];
  return types.find((item) => item === type) ?? CATALOG_ALL_TAB;
};

/** The route query that opens a Catalog tab. */
export const getCatalogTabQuery = (tab: CatalogTab): LocationQueryRaw => {
  if (tab === CATALOG_ALL_TAB) return {};
  if (tab === CATALOG_INSTALLED_TAB) return { view: CATALOG_INSTALLED_TAB };
  return { types: tab };
};

/**
 * The Catalog, opened on the tab of the given type when the Catalog offers it.
 *
 * @param type - A provider type, as a settings page reads it from its route.
 */
export const getCatalogRoute = (type?: string): RouteLocationRaw => ({
  name: "catalog",
  query: isCatalogType(type) ? getCatalogTabQuery(type) : {},
});

/** The settings page of a provider type. */
export const getTypeSettingsRoute = (type: ProviderType): RouteLocationRaw => ({
  name: "providersettings",
  query: { types: type },
});

/** The settings page of a provider instance. */
export const getInstanceSettingsRoute = (
  config: ProviderConfig,
): RouteLocationRaw => ({
  name: "editprovider",
  params: { instanceId: config.instance_id },
});

/**
 * Where an entry that is set up is managed: the settings of its one instance,
 * or the settings page of its type that lists them all.
 */
export const getManageRoute = (entry: CatalogEntry): RouteLocationRaw =>
  entry.instances.length === 1
    ? getInstanceSettingsRoute(entry.instances[0])
    : getTypeSettingsRoute(entry.manifest.type);

export interface InstalledProvider {
  config: ProviderConfig;
  name: string;
  // whether the user manages it, and so may open its settings
  manageable: boolean;
}

export interface InstalledGroup {
  type: CatalogType;
  items: InstalledProvider[];
}

/**
 * The provider instances set up, per Catalog type in tab order and by name
 * within a type; types without any are left out.
 *
 * @param configs - The provider instances set up that the user can see.
 * @param manifests - The provider manifests by domain.
 * @param includeBuiltin - Whether to list the providers that ship with the server.
 * @param getName - The name an instance is shown by.
 * @param canManage - Whether the user manages an instance; by default every one.
 */
export const groupInstalledProviders = (
  configs: readonly ProviderConfig[],
  manifests: Readonly<Record<string, ProviderManifest>>,
  includeBuiltin: boolean,
  getName: (config: ProviderConfig) => string,
  canManage: (config: ProviderConfig) => boolean = () => true,
): InstalledGroup[] =>
  CATALOG_TYPES.map((type) => ({
    type,
    items: configs
      .filter(
        (config) =>
          config.type === type.type &&
          (includeBuiltin || !isBuiltinProvider(manifests[config.domain])),
      )
      .map((config) => ({
        config,
        name: getName(config),
        manageable: canManage(config),
      }))
      .sort((a, b) => compareNames(a.name, b.name)),
  })).filter((group) => group.items.length > 0);

/** The GitHub profile of a maintainer, by its handle. */
export const getMaintainerProfileUrl = (handle: string) =>
  `https://github.com/${handle.replace(/^@/, "")}`;

function popularRank(domain: string): number {
  const index = POPULAR_PROVIDERS.indexOf(domain);
  return index === -1 ? POPULAR_PROVIDERS.length : index;
}

function compareNames(a: string, b: string): number {
  return a.localeCompare(b, undefined, { sensitivity: "base" });
}
