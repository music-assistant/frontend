import {
  emptyNetworkShareForm,
  type ManagedShareLocation,
  type NetworkShareForm,
  networkShareFormChanged,
  networkShareFormFromLocation,
  networkShareSettings,
  storageErrorText,
} from "@/helpers/storage";
import { api } from "@/plugins/api";
import { ShareType, type StorageLocation } from "@/plugins/api/interfaces";
import { $t } from "@/plugins/i18n";
import { computed, ref, watch } from "vue";
import { type Action, toast } from "vue-sonner";

/** What the network share form is opened on; read reactively, e.g. component props. */
export interface NetworkShareFormOptions {
  // opening starts the form over
  open: boolean;
  // the managed share to edit; null adds a new one
  location: ManagedShareLocation | null;
  // the share types this install can mount
  shareTypes: ShareType[];
  // the protocol versions this install can honour per share type, next to automatic
  shareVersions: Partial<Record<ShareType, string[]>>;
  // the next step the toast of a newly added share offers, if any
  addedAction?: (location: StorageLocation) => Action | undefined;
}

/**
 * How a save ended: `saved` added or replaced the share, `unchanged` found nothing to
 * replace, `invalid` and `failed` leave the form open with the reason shown.
 */
export type NetworkShareSaveResult =
  "saved" | "unchanged" | "invalid" | "failed";

/**
 * The state of the form that adds a network share or edits a managed one, and the
 * command that saves it.
 *
 * @param options - What the form is opened on.
 */
export function useNetworkShareForm(options: NetworkShareFormOptions) {
  const form = ref<NetworkShareForm>(emptyNetworkShareForm(ShareType.CIFS));
  const showAdvanced = ref(false);
  // the required fields are only flagged once saving was tried
  const submitted = ref(false);
  const saving = ref(false);
  const error = ref<string | null>(null);

  const isCifs = computed(() => form.value.shareType === ShareType.CIFS);
  // the type of an existing share is fixed
  const shareTypeChoices = computed(() =>
    options.location ? [options.location.share_type] : options.shareTypes,
  );
  // empty when the version of this share type can not be chosen
  const versionChoices = computed<readonly string[]>(
    () => options.shareVersions[form.value.shareType] ?? [],
  );
  const serverInvalid = computed(
    () => submitted.value && !form.value.server.trim(),
  );
  const shareInvalid = computed(
    () => submitted.value && !form.value.share.trim(),
  );

  const setShareType = (shareType: ShareType) => {
    form.value.shareType = shareType;
    // the versions differ per share type
    if (
      form.value.version &&
      !versionChoices.value.includes(form.value.version)
    ) {
      form.value.version = null;
    }
  };

  const save = async (): Promise<NetworkShareSaveResult> => {
    submitted.value = true;
    if (!form.value.server.trim() || !form.value.share.trim()) return "invalid";
    saving.value = true;
    error.value = null;
    try {
      const settings = networkShareSettings(form.value);
      if (options.location) {
        // an untouched form has nothing to replace
        if (!networkShareFormChanged(options.location, form.value)) {
          return "unchanged";
        }
        await api.updateNetworkShare(options.location.share_name, settings);
        toast.success($t("settings.storage.share_saved"));
      } else {
        const added = await api.addNetworkShare(form.value.shareType, settings);
        const action = options.addedAction?.(added);
        if (action) {
          toast.success($t("settings.storage.share_added"), { action });
        } else {
          toast.success($t("settings.storage.share_added"));
        }
      }
      return "saved";
    } catch (err) {
      // the form stays open, so the reason shows next to what the user can correct
      error.value = storageErrorText(
        err,
        $t("settings.storage.share_save_failed"),
      );
      return "failed";
    } finally {
      saving.value = false;
    }
  };

  watch(
    () => options.open,
    (open) => {
      if (!open) return;
      const location = options.location;
      form.value = location
        ? networkShareFormFromLocation(
            location,
            options.shareVersions[location.share_type] ?? [],
          )
        : emptyNetworkShareForm(options.shareTypes[0] ?? ShareType.CIFS);
      showAdvanced.value = form.value.version !== null;
      submitted.value = false;
      error.value = null;
    },
    { immediate: true },
  );

  return {
    form,
    showAdvanced,
    saving,
    error,
    isCifs,
    shareTypeChoices,
    versionChoices,
    serverInvalid,
    shareInvalid,
    setShareType,
    save,
  };
}
