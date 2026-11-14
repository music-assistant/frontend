// What can be added and how the Catalog and the add dialog list it. Both decide
// from here, so they never offer a different set.
import { isCommunityRunning } from "@/helpers/community_catalog";
import { isSelfServiceProvider } from "@/helpers/provider_access";
import {
  getProviderMaintainers,
  isBuiltinProvider,
} from "@/helpers/provider_config";
import {
  type CommunityProvider,
  CommunityProviderState,
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
  // what the community catalog lists for it, for one that comes from there
  community?: CommunityProvider;
}

/** A row of entries to scroll through above the list. */
export interface CatalogRow {
  // names the row in its test id: catalog-<key>
  key: string;
  // the translation key of its title
  title: string;
  entries: CatalogEntry[];
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
 * The Catalog entries for the offerable providers, alphabetically by name: one
 * per provider the server knows or the community catalog runs, and one per
 * provider the community catalog offers that is not installed yet.
 *
 * @param manifests - Every provider manifest the server knows.
 * @param configs - The provider instances set up that the user can see.
 * @param restrictions - What the user may add.
 * @param canManage - Whether the user manages an instance; by default every one.
 * @param community - What the community catalog lists; nothing by default.
 */
export const buildCatalogEntries = (
  manifests: readonly ProviderManifest[],
  configs: readonly ProviderConfig[],
  restrictions: AddRestrictions = {},
  canManage: (config: ProviderConfig) => boolean = () => true,
  community: readonly CommunityProvider[] = [],
): CatalogEntry[] => {
  const communityByDomain = new Map(
    community.map((provider) => [provider.domain, provider]),
  );
  const knownDomains = new Set(manifests.map((manifest) => manifest.domain));
  // the list and the manifests change at different moments around an install,
  // so one just installed stays on the manifest the community catalog gave
  const justInstalled = community
    .filter(
      (provider) =>
        isCommunityRunning(provider) && !knownDomains.has(provider.domain),
    )
    .map((provider) => provider.manifest);
  const known = [...manifests, ...justInstalled]
    .filter((manifest) => isOfferable(manifest, restrictions))
    // one the community catalog withdrew keeps running, but is no longer offered;
    // one still on offer may already be registered
    .filter((manifest) => {
      const provider = communityByDomain.get(manifest.domain);
      return (
        !provider ||
        provider.state === CommunityProviderState.AVAILABLE ||
        isCommunityRunning(provider)
      );
    })
    .map((manifest): CatalogEntry => {
      const instances = configs.filter(
        (config) => config.domain === manifest.domain,
      );
      return {
        manifest,
        instances: instances.filter(canManage),
        canAdd: manifest.multi_instance || instances.length === 0,
        community: communityByDomain.get(manifest.domain),
      };
    });
  const installable = community
    .filter(
      (provider) =>
        provider.state === CommunityProviderState.AVAILABLE &&
        !knownDomains.has(provider.domain) &&
        isOfferable(provider.manifest, restrictions),
    )
    .map((provider): CatalogEntry => ({
      manifest: provider.manifest,
      instances: [],
      canAdd: true,
      community: provider,
    }));
  return [...known, ...installable].sort((a, b) =>
    compareNames(a.manifest.name, b.manifest.name),
  );
};

/**
 * Who maintains an entry: the maintainers the community catalog names for one
 * from there, else the people among its codeowners; none when only the team does.
 */
export const getEntryMaintainers = (entry: CatalogEntry): string[] =>
  entry.community?.maintainers.length
    ? entry.community.maintainers
    : getProviderMaintainers(entry.manifest);

/** Whether adding the entry first installs it from the community catalog. */
export const needsInstall = (
  entry: CatalogEntry,
): entry is CatalogEntry & { community: CommunityProvider } =>
  entry.community?.state === CommunityProviderState.AVAILABLE;

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

/** How many entries a row of what is new in the community catalog shows at most. */
export const COMMUNITY_ROW_SIZE = 8;

/** How long an addition or a release counts as new in the community catalog. */
export const COMMUNITY_RECENT_MS = 30 * 24 * 60 * 60 * 1000;

export interface CommunityHighlights {
  // the latest additions to the community catalog
  added: CatalogEntry[];
  // the latest releases among the rest
  updated: CatalogEntry[];
}

/**
 * What is new in the community catalog among the entries that can be added,
 * newest first: added, or with a latest version released, within
 * COMMUNITY_RECENT_MS. An entry is in one row at most, and one without a valid
 * date for a row is left out of it.
 *
 * @param entries - The Catalog entries.
 * @param now - The current time, in milliseconds since the epoch.
 */
export const getCommunityHighlights = (
  entries: readonly CatalogEntry[],
  now: number,
): CommunityHighlights => {
  const since = now - COMMUNITY_RECENT_MS;
  const community = entries.filter((entry) => entry.community && entry.canAdd);
  const added = newestFirst(community, (provider) => provider.added, since);
  const addedDomains = new Set(added.map((entry) => entry.manifest.domain));
  const updated = newestFirst(
    community.filter((entry) => !addedDomains.has(entry.manifest.domain)),
    (provider) => provider.released,
    since,
  );
  return { added, updated };
};

/**
 * The rows that lead a tab of the Catalog, each with something to show: the
 * popular entries, and what is new in the community catalog when asked for.
 *
 * @param entries - The Catalog entries of the tab.
 * @param withCommunity - Whether to show what is new in the community catalog.
 * @param now - The current time, in milliseconds since the epoch.
 */
export const getCatalogRows = (
  entries: readonly CatalogEntry[],
  withCommunity: boolean,
  now: number,
): CatalogRow[] => {
  const highlights = withCommunity
    ? getCommunityHighlights(entries, now)
    : { added: [], updated: [] };
  return [
    {
      key: "popular",
      title: "settings.catalog.popular",
      entries: getPopularEntries(entries),
    },
    {
      key: "community-new",
      title: "settings.catalog.community.new_title",
      entries: highlights.added,
    },
    {
      key: "community-updated",
      title: "settings.catalog.community.updated_title",
      entries: highlights.updated,
    },
  ].filter((row) => row.entries.length);
};

export const CATALOG_ALL_TAB = "all";
export const CATALOG_INSTALLED_TAB = "installed";
/** The route query that opens the details of an entry, by its domain. */
export const CATALOG_DETAIL_QUERY = "detail";

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

/**
 * The Catalog with the details of an entry open.
 *
 * @param domain - The domain of the entry.
 */
export const getCatalogDetailRoute = (domain: string): RouteLocationRaw => ({
  name: "catalog",
  query: { [CATALOG_DETAIL_QUERY]: domain },
});

/** The Catalog on its Installed view. */
export const getCatalogInstalledRoute = (): RouteLocationRaw => ({
  name: "catalog",
  query: getCatalogTabQuery(CATALOG_INSTALLED_TAB),
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

function newestFirst(
  entries: readonly CatalogEntry[],
  getDate: (provider: CommunityProvider) => string | null,
  since: number,
): CatalogEntry[] {
  // a date that is not a date parses to NaN, which is never this recent
  return entries
    .map((entry) => ({
      entry,
      time: Date.parse(getDate(entry.community!) ?? ""),
    }))
    .filter(({ time }) => time >= since)
    .sort((a, b) => b.time - a.time)
    .slice(0, COMMUNITY_ROW_SIZE)
    .map(({ entry }) => entry);
}

function popularRank(domain: string): number {
  const index = POPULAR_PROVIDERS.indexOf(domain);
  return index === -1 ? POPULAR_PROVIDERS.length : index;
}

function compareNames(a: string, b: string): number {
  return a.localeCompare(b, undefined, { sensitivity: "base" });
}
