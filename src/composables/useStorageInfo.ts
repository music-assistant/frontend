import { storageErrorText } from "@/helpers/storage";
import { api } from "@/plugins/api";
import {
  type StorageInfo,
  type StorageLocation,
  StorageUsage,
} from "@/plugins/api/interfaces";
import { $t } from "@/plugins/i18n";
import { computed, ref } from "vue";
import { toast } from "vue-sonner";

/**
 * The storage the server reports to the current user, fetched on `refresh`.
 *
 * A failed refresh keeps what an earlier one loaded and reports the failure in a toast.
 */
export function useStorageInfo() {
  const info = ref<StorageInfo | null>(null);
  const loading = ref(false);
  const failed = ref(false);
  // only the latest refresh may apply its answer
  let generation = 0;

  const mediaLocations = computed<StorageLocation[]>(
    () =>
      info.value?.locations.filter(
        (location) => location.usage === StorageUsage.MEDIA,
      ) ?? [],
  );

  const refresh = async (): Promise<void> => {
    const current = ++generation;
    loading.value = true;
    failed.value = false;
    try {
      const result = await api.getStorageInfo();
      if (current !== generation) return;
      info.value = result;
    } catch (error) {
      if (current !== generation) return;
      failed.value = true;
      toast.error(storageErrorText(error, $t("settings.storage.load_failed")));
    } finally {
      if (current === generation) loading.value = false;
    }
  };

  return { info, loading, failed, mediaLocations, refresh };
}
