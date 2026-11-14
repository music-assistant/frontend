import {
  buildCatalogEntries,
  groupInstalledProviders,
  MEMBER_ADD_RESTRICTIONS,
} from "@/helpers/provider_catalog";
import { providerDisplayName } from "@/helpers/provider_config";
import {
  canManageSource,
  managesAllSources,
} from "@/helpers/provider_permissions";
import { api } from "@/plugins/api";
import {
  type CommunityProvider,
  EventType,
  type ProviderConfig,
  ProviderType,
} from "@/plugins/api/interfaces";
import {
  computed,
  type MaybeRefOrGetter,
  onBeforeUnmount,
  onMounted,
  ref,
  toValue,
} from "vue";
import { toast } from "vue-sonner";

/**
 * What the Catalog lists for the current user: an entry for everything it may
 * add, and what is set up per type, kept in step with the server.
 *
 * @param community - What the community catalog lists, to join the entries.
 */
export function useProviderCatalog(
  community: MaybeRefOrGetter<readonly CommunityProvider[]> = [],
) {
  const configs = ref<ProviderConfig[]>([]);
  // the page waits for the first load, so it never shows a state from before it
  const loaded = ref(false);
  // whether the latest load failed, for the page to offer another try
  const failed = ref(false);

  const restrictions = computed(() =>
    managesAllSources() ? {} : MEMBER_ADD_RESTRICTIONS,
  );

  const entries = computed(() =>
    buildCatalogEntries(
      Object.values(api.providerManifests),
      configs.value,
      restrictions.value,
      canManageSource,
      toValue(community),
    ),
  );

  // as on the settings pages, a member is not shown the providers that ship
  // with the server among its music sources
  const installed = computed(() =>
    groupInstalledProviders(
      configs.value,
      api.providerManifests,
      managesAllSources(),
      getInstanceName,
      canManageSource,
    ),
  );

  const loadConfigs = async function () {
    failed.value = false;
    try {
      // a member only ever lists music sources
      configs.value = await api.getProviderConfigs(
        managesAllSources() ? undefined : ProviderType.MUSIC,
      );
      loaded.value = true;
    } catch (err) {
      failed.value = true;
      toast.error(String(err));
    }
  };

  let unsubProvidersUpdated: (() => void) | undefined;

  onMounted(() => {
    void loadConfigs();
    unsubProvidersUpdated = api.subscribe(
      EventType.PROVIDERS_UPDATED,
      loadConfigs,
    );
  });

  onBeforeUnmount(() => {
    unsubProvidersUpdated?.();
  });

  return { entries, installed, loaded, failed, reload: loadConfigs };
}

function getInstanceName(config: ProviderConfig): string {
  return (
    providerDisplayName(
      config,
      api.providers[config.instance_id],
      api.providerManifests[config.domain],
    ) || config.instance_id
  );
}
