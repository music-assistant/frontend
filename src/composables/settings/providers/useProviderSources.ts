import { isOwnMusicSource } from "@/helpers/provider_access";
import { isBuiltinProvider } from "@/helpers/provider_config";
import { confirmProviderRemoval } from "@/helpers/provider_removal";
import {
  providerListType,
  providerSettingsPageId,
} from "@/helpers/settings_pages";
import { api } from "@/plugins/api";
import {
  EventType,
  type ProviderConfig,
  type ProviderStatus,
  ProviderType,
} from "@/plugins/api/interfaces";
import { store } from "@/plugins/store";
import {
  computed,
  type MaybeRefOrGetter,
  onBeforeUnmount,
  onMounted,
  ref,
  toValue,
  watch,
} from "vue";
import { toast } from "vue-sonner";

// a handful of providers is scanned faster than it is searched
const MIN_PROVIDERS_FOR_SEARCH = 10;

export interface ProviderSection {
  key: string;
  label?: string;
  items: ProviderConfig[];
}

// one list of providers on a settings page
export interface ProviderList {
  // the list type, as providerListType gives it
  type: string;
  // the search narrowing the list down; empty while the list offers none
  searchQuery: string;
  // what the search leaves: sources needing attention first, then alphabetically
  filteredProviders: ProviderConfig[];
  sections: ProviderSection[];
  showSearch: boolean;
  // an empty music list invites a first source of one's own, or tells a viewer
  // who cannot add any that nothing has been shared yet
  showMusicEmptyState: boolean;
}

interface UseProviderSourcesOptions {
  managesAllSources: MaybeRefOrGetter<boolean>;
  // the list types the page shows, in display order
  listTypes: MaybeRefOrGetter<readonly string[]>;
  getProviderName: (config: ProviderConfig) => string;
  isErrorStatus: (status?: ProviderStatus | null) => boolean;
}

/**
 * The provider configs of the lists of a settings page, kept in sync with the
 * server and shaped for each list: searched, sorted and split into sections.
 */
export function useProviderSources(options: UseProviderSourcesOptions) {
  const { getProviderName, isErrorStatus } = options;

  const providerConfigs = ref<ProviderConfig[]>([]);
  // the empty states wait for the first load, so they never flash before the list
  const loaded = ref(false);
  // the search of each list, by its type
  const searchQueries = ref<Record<string, string>>({});

  const lists = computed((): ProviderList[] =>
    toValue(options.listTypes).map((type) => buildList(type)),
  );

  /** Narrow the list of the given type down to what matches the query. */
  const setSearchQuery = function (type: string, query: string) {
    searchQueries.value = { ...searchQueries.value, [type]: query };
  };

  const loadItems = async function () {
    // Only load provider configs if provider manifests are available
    // to avoid race conditions during initial connection
    if (Object.keys(api.providerManifests).length === 0) {
      console.debug(
        "Waiting for provider manifests to load before loading provider configs",
      );
      return;
    }
    try {
      // a member only ever lists music sources; an entry whose provider is not
      // available is listed too, so it can be removed
      providerConfigs.value = await api.getProviderConfigs(
        toValue(options.managesAllSources) ? undefined : ProviderType.MUSIC,
        undefined,
        true,
      );
      loaded.value = true;
    } catch (err) {
      toast.error(String(err));
    }
  };

  // removing a source cannot be undone, so it is confirmed first and only
  // dropped from the list once the server has removed it
  const removeSource = function (config: ProviderConfig) {
    const instanceId = config.instance_id;
    confirmProviderRemoval(config, getProviderName(config), async () => {
      try {
        await api.removeProviderConfig(instanceId);
        providerConfigs.value = providerConfigs.value.filter(
          (x) => x.instance_id != instanceId,
        );
      } catch (err) {
        toast.error(String(err));
      }
    });
  };

  let unsubProvidersUpdated: (() => void) | undefined;

  onMounted(() => {
    unsubProvidersUpdated = api.subscribe(EventType.PROVIDERS_UPDATED, () => {
      loadItems();
    });
  });

  onBeforeUnmount(() => {
    unsubProvidersUpdated?.();
  });

  watch(
    () => api.providers,
    (val) => {
      if (val) loadItems();
    },
    { immediate: true },
  );

  watch(
    () => api.players,
    () => {
      loadItems();
    },
  );

  // the configs cannot load until the manifests are available
  watch(
    () => Object.keys(api.providerManifests).length,
    (manifestCount) => {
      if (manifestCount > 0) loadItems();
    },
  );

  function buildList(type: string): ProviderList {
    const listed = listedProviders(type);
    const showSearch = listed.length >= MIN_PROVIDERS_FOR_SEARCH;
    // a search typed before the list shrank below the threshold would keep
    // narrowing it down unseen
    const searchQuery = showSearch ? (searchQueries.value[type] ?? "") : "";
    const filteredProviders = sortProviders(
      searchProviders(listed, searchQuery, getProviderName),
      getProviderName,
      isErrorStatus,
    );
    return {
      type,
      searchQuery,
      filteredProviders,
      sections: splitSections(
        filteredProviders,
        toValue(options.managesAllSources),
        store.currentUser?.user_id,
      ),
      showSearch,
      showMusicEmptyState:
        loaded.value &&
        filteredProviders.length === 0 &&
        !searchQuery &&
        type === ProviderType.MUSIC,
    };
  }

  // the providers of a list, before the search narrows them down
  function listedProviders(type: string): ProviderConfig[] {
    const managesAll = toValue(options.managesAllSources);
    return providerConfigs.value.filter((item) => {
      const manifest = api.providerManifests[item.domain];
      return (
        providerListType(item.type, manifest?.features) === type &&
        // a provider with a settings page of its own is managed from that page
        !providerSettingsPageId(item.domain) &&
        // a provider that ships with the server is not a source anyone chose,
        // so a member is not shown it among the sources it may use
        (managesAll || !isBuiltinProvider(manifest))
      );
    });
  }

  return {
    loaded,
    lists,
    setSearchQuery,
    loadItems,
    removeSource,
  };
}

function searchProviders(
  providers: ProviderConfig[],
  query: string,
  getProviderName: (config: ProviderConfig) => string,
): ProviderConfig[] {
  if (!query) return providers;
  const lowerQuery = query.toLowerCase();
  return providers.filter((item) =>
    getProviderName(item).toLowerCase().includes(lowerQuery),
  );
}

// sources needing attention (error/auth/incompatible) first, then alphabetically
function sortProviders(
  providers: ProviderConfig[],
  getProviderName: (config: ProviderConfig) => string,
  isErrorStatus: (status?: ProviderStatus | null) => boolean,
): ProviderConfig[] {
  return [...providers].sort((a, b) => {
    const aHasError = isErrorStatus(a.status) ? 1 : 0;
    const bHasError = isErrorStatus(b.status) ? 1 : 0;
    if (aHasError !== bHasError) return bHasError - aHasError;
    return getProviderName(a).localeCompare(getProviderName(b));
  });
}

// a member's own sources come first, then the ones shared with it; an admin
// gets a single section with everything, which the list heads
function splitSections(
  providers: ProviderConfig[],
  managesAllSources: boolean,
  userId: string | undefined,
): ProviderSection[] {
  const split = managesAllSources
    ? [{ key: "all", items: providers }]
    : [
        {
          key: "own",
          label: "settings.music_sources_own",
          items: providers.filter((item) => isOwnMusicSource(item, userId)),
        },
        {
          key: "shared",
          label: "settings.music_sources_shared",
          items: providers.filter((item) => !isOwnMusicSource(item, userId)),
        },
      ];
  return split.filter((section) => section.items.length > 0);
}
