import {
  buildCatalogEntries,
  groupInstalledProviders,
  MEMBER_ADD_RESTRICTIONS,
} from "@/helpers/provider_catalog";
import { providerDisplayName } from "@/helpers/provider_config";
import { managesAllSources } from "@/helpers/provider_permissions";
import { api } from "@/plugins/api";
import {
  EventType,
  type ProviderConfig,
  ProviderType,
} from "@/plugins/api/interfaces";
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { toast } from "vue-sonner";

/**
 * What the Catalog lists for the current user: an entry for everything it may
 * add, and what is set up per type, kept in step with the server.
 */
export function useProviderCatalog() {
  const configs = ref<ProviderConfig[]>([]);
  // the empty states wait for the first load, so they never flash before the list
  const loaded = ref(false);

  const restrictions = computed(() =>
    managesAllSources() ? {} : MEMBER_ADD_RESTRICTIONS,
  );

  const entries = computed(() =>
    buildCatalogEntries(
      Object.values(api.providerManifests),
      configs.value,
      restrictions.value,
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
    ),
  );

  const loadConfigs = async function () {
    try {
      // a member only ever lists music sources
      configs.value = await api.getProviderConfigs(
        managesAllSources() ? undefined : ProviderType.MUSIC,
      );
      loaded.value = true;
    } catch (err) {
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

  return { entries, installed, loaded };
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
