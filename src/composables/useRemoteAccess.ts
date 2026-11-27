import { formatRemoteId } from "@/helpers/segmented_code";
import { copyToClipboard } from "@/helpers/utils";
import { api } from "@/plugins/api";
import type { RemoteAccessInfo } from "@/plugins/api/interfaces";
import { $t } from "@/plugins/i18n";
import { computed, ref } from "vue";
import { toast } from "vue-sonner";

/**
 * Music Assistant's own remote access: whether it is on, whether it runs
 * through Home Assistant Link, the id to connect with, and turning it on and
 * off.
 *
 * Nothing is read on creation; call `load` for the details of remote access
 * that is already on: its id and whether it runs through Home Assistant Link.
 */
export function useRemoteAccess() {
  const info = ref<RemoteAccessInfo>();
  const busy = ref(false);
  // whether the details of remote access that is already on are still coming in
  const loadingId = ref(false);
  // which request the latest answer belongs to: a read may land after a switch
  // has been answered, and must not undo that answer (while a switch the server
  // refused leaves that read as good as it was)
  let request = 0;

  // what the last answer about remote access said, else what server info says
  const enabled = computed(
    () =>
      info.value?.enabled ?? api.serverInfo.value?.has_remote_access ?? false,
  );
  // unknown until the details of remote access came in
  const usingHaCloud = computed(() => info.value?.using_ha_cloud);
  // as the server hands it over, for a link that fills it in
  const rawRemoteId = computed(() => info.value?.remote_id || undefined);
  const remoteId = computed(() =>
    rawRemoteId.value ? formatRemoteId(rawRemoteId.value) : undefined,
  );

  const load = async function (): Promise<void> {
    const current = ++request;
    loadingId.value = true;
    try {
      const answer = await api.getRemoteAccessInfo();
      if (current === request) info.value = answer;
    } catch (error) {
      // the api already told the user; the state still follows server info
      console.warn("Failed to load the remote access details:", error);
    } finally {
      loadingId.value = false;
    }
  };

  const setEnabled = async function (value: boolean): Promise<void> {
    if (busy.value) return;
    busy.value = true;
    try {
      const answer = await api.configureRemoteAccess(value);
      // answered: a read still on its way is about the state before this
      request += 1;
      info.value = answer;
      toast.success(
        $t(
          value
            ? "settings.remote_access_enabled_success"
            : "settings.remote_access_disabled_success",
        ),
      );
    } catch (error) {
      // the api already told the user; the state stays where the server left it
      console.warn("Failed to switch remote access:", error);
    } finally {
      busy.value = false;
    }
  };

  const copyId = async function (): Promise<void> {
    if (!remoteId.value) return;
    if (await copyToClipboard(remoteId.value)) {
      toast.success($t("settings.remote_access_id_copied"));
    } else {
      toast.error($t("settings.remote_access_error_copy"));
    }
  };

  return {
    enabled,
    usingHaCloud,
    remoteId,
    rawRemoteId,
    loadingId,
    busy,
    load,
    setEnabled,
    copyId,
  };
}
