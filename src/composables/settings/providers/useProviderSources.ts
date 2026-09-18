import { isOwnMusicSource } from "@/helpers/provider_access";
import { isBuiltinProvider } from "@/helpers/provider_config";
import { api } from "@/plugins/api";
import {
  EventType,
  type ProviderConfig,
  type ProviderStatus,
  ProviderType,
} from "@/plugins/api/interfaces";
import { eventbus } from "@/plugins/eventbus";
import { $t } from "@/plugins/i18n";
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

interface UseProviderSourcesOptions {
  managesAllSources: MaybeRefOrGetter<boolean>;
  currentType: MaybeRefOrGetter<string | undefined>;
  getProviderName: (config: ProviderConfig) => string;
  isErrorStatus: (status?: ProviderStatus | null) => boolean;
}

/**
 * The provider configs of the current type, kept in sync with the server and
 * shaped for the settings list: searched, sorted and split into sections.
 */
export function useProviderSources(options: UseProviderSourcesOptions) {
  const { getProviderName, isErrorStatus } = options;

  const providerConfigs = ref<ProviderConfig[]>([]);
  // the empty states wait for the first load, so they never flash before the list
  const loaded = ref(false);
  const searchQuery = ref("");

  // the providers of the current type (the music sources for a member), before
  // the search narrows them down
  const listedProviders = computed(() => {
    let listed = providerConfigs.value;

    const typesQuery = toValue(options.currentType);
    if (typesQuery && typesQuery.trim().length > 0) {
      const types = typesQuery.split(",");
      listed = listed.filter((item) => types.includes(item.type));
    } else {
      // Default to showing only music providers when no types are specified
      listed = listed.filter((item) => item.type === ProviderType.MUSIC);
    }

    // a provider that ships with the server is not a source anyone chose, so a
    // member is not shown it among the sources it may use
    if (!toValue(options.managesAllSources)) {
      listed = listed.filter(
        (item) => !isBuiltinProvider(api.providerManifests[item.domain]),
      );
    }
    return listed;
  });

  // sources needing attention (error/auth/incompatible) first, then alphabetically
  const filteredProviders = computed(() => {
    let filtered = listedProviders.value;

    if (searchQuery.value) {
      const query = searchQuery.value.toLowerCase();
      filtered = filtered.filter((item) =>
        getProviderName(item).toLowerCase().includes(query),
      );
    }

    return [...filtered].sort((a, b) => {
      const aHasError = isErrorStatus(a.status) ? 1 : 0;
      const bHasError = isErrorStatus(b.status) ? 1 : 0;
      if (aHasError !== bHasError) return bHasError - aHasError;
      return getProviderName(a).localeCompare(getProviderName(b));
    });
  });

  const showSearch = computed(
    () => listedProviders.value.length >= MIN_PROVIDERS_FOR_SEARCH,
  );

  // a search typed before the list shrank below the threshold would keep
  // narrowing it down unseen
  watch(showSearch, (shown) => {
    if (!shown) searchQuery.value = "";
  });

  // a member's own sources come first, then the ones shared with it; an admin
  // gets a single untitled section with everything
  const sections = computed((): ProviderSection[] => {
    const listed = filteredProviders.value;
    const userId = store.currentUser?.user_id;
    const split = toValue(options.managesAllSources)
      ? [{ key: "all", items: listed }]
      : [
          {
            key: "own",
            label: "settings.music_sources_own",
            items: listed.filter((item) => isOwnMusicSource(item, userId)),
          },
          {
            key: "shared",
            label: "settings.music_sources_shared",
            items: listed.filter((item) => !isOwnMusicSource(item, userId)),
          },
        ];
    return split.filter((section) => section.items.length > 0);
  });

  // an empty music list invites a first source of one's own, or tells a viewer
  // who cannot add any that nothing has been shared yet; any other empty list is
  // the result of the active search or type filter
  const showMusicEmptyState = computed(
    () =>
      loaded.value &&
      filteredProviders.value.length === 0 &&
      !searchQuery.value &&
      (toValue(options.currentType) || ProviderType.MUSIC) ===
        ProviderType.MUSIC,
  );

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
      // a member only ever lists music sources
      providerConfigs.value = await api.getProviderConfigs(
        toValue(options.managesAllSources) ? undefined : ProviderType.MUSIC,
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
    eventbus.emit("deleteConfirmationDialog", {
      title: $t("settings.remove_provider"),
      message: $t("settings.remove_provider_confirm", [
        getProviderName(config),
      ]),
      confirmLabel: $t("settings.remove_provider"),
      onConfirm: async () => {
        try {
          await api.removeProviderConfig(instanceId);
          providerConfigs.value = providerConfigs.value.filter(
            (x) => x.instance_id != instanceId,
          );
        } catch (err) {
          toast.error(String(err));
        }
      },
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

  return {
    loaded,
    searchQuery,
    filteredProviders,
    sections,
    showSearch,
    showMusicEmptyState,
    loadItems,
    removeSource,
  };
}
