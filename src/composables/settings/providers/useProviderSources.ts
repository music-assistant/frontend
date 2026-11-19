import { isOwnMusicSource } from "@/helpers/provider_access";
import { isBuiltinProvider } from "@/helpers/provider_config";
import { getFilterLabels, type ProviderLabel } from "@/helpers/provider_labels";
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
  // the labels the list can be filtered on; none while it offers no filter
  labels: ProviderLabel[];
  // the label narrowing the list down; null for all of them
  labelFilter: ProviderLabel | null;
  // what the search and the label leave: sources needing attention first, then
  // alphabetically
  filteredProviders: ProviderConfig[];
  sections: ProviderSection[];
  showSearch: boolean;
  // an empty music list invites a first source of one's own, or tells a viewer
  // who cannot add any that nothing has been shared yet
  showMusicEmptyState: boolean;
}

interface UseProviderSourcesOptions {
  managesAllSources: MaybeRefOrGetter<boolean>;
  // the list type, as providerListType gives it
  listType: MaybeRefOrGetter<string>;
  getProviderName: (config: ProviderConfig) => string;
  // what a provider offers
  getLabels: (config: ProviderConfig) => ProviderLabel[];
  isErrorStatus: (status?: ProviderStatus | null) => boolean;
}

/**
 * The provider configs of a list on a settings page, kept in sync with the
 * server and shaped for the list: searched, filtered on what the providers
 * offer, sorted and split into sections.
 */
export function useProviderSources(options: UseProviderSourcesOptions) {
  const { getProviderName, getLabels, isErrorStatus } = options;

  const providerConfigs = ref<ProviderConfig[]>([]);
  // the empty states wait for the first load, so they never flash before the list
  const loaded = ref(false);
  // the search and label as last set, which the list only applies while it
  // offers them
  const search = ref("");
  const pickedLabel = ref<ProviderLabel | null>(null);

  const list = computed((): ProviderList =>
    buildList(toValue(options.listType)),
  );

  /** Narrow the list down to what matches the query. */
  const setSearchQuery = function (query: string) {
    search.value = query;
  };

  /**
   * Narrow the list down to the providers offering the label; null shows them
   * all again.
   */
  const setLabelFilter = function (label: ProviderLabel | null) {
    pickedLabel.value = label;
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
    const searchQuery = showSearch ? search.value : "";
    const labels = getFilterLabels(listed.map(getLabels));
    // the same goes for a label no provider in the list offers any more
    const picked = pickedLabel.value;
    const labelFilter = picked && labels.includes(picked) ? picked : null;
    const filteredProviders = sortProviders(
      searchProviders(listed, searchQuery, getProviderName).filter(
        (item) => !labelFilter || getLabels(item).includes(labelFilter),
      ),
      getProviderName,
      isErrorStatus,
    );
    return {
      type,
      searchQuery,
      labels,
      labelFilter,
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
        providerListType(item.type, manifest?.provides) === type &&
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
    list,
    setSearchQuery,
    setLabelFilter,
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
