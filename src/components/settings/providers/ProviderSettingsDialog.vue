<template>
  <Dialog v-model:open="open">
    <DialogContent
      class="flex max-h-[85vh] flex-col gap-0 p-0 sm:max-w-[640px]"
      data-testid="provider-settings-dialog"
      @pointer-down-outside="keepOpenForOverlays"
      @interact-outside="keepOpenForOverlays"
    >
      <DialogHeader
        class="flex-row items-center gap-3 border-b px-5 py-4 pr-12 text-left"
      >
        <ProviderIcon
          v-if="domain"
          :domain="domain"
          :size="32"
          class="shrink-0"
        />
        <div class="flex min-w-0 flex-1 flex-col gap-0.5">
          <DialogTitle class="truncate">{{ name }}</DialogTitle>
          <DialogDescription class="line-clamp-2">
            {{ description }}
          </DialogDescription>
        </div>
      </DialogHeader>

      <div class="min-h-[120px] flex-1 overflow-y-auto px-5 py-5">
        <EditConfig
          v-if="config"
          ref="editConfig"
          :config-entries="entries"
          :disabled="!config.enabled"
          :provider-domain="config.domain"
          inline-save
          @submit="save"
          @action="onAction"
          @immediate-apply="applyNow"
        />
        <div v-else class="flex items-center justify-center py-8">
          <Spinner class="size-6" />
        </div>
      </div>
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
import ProviderIcon from "@/components/ProviderIcon.vue";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { useConfigAction } from "@/composables/useConfigAction";
import { isInVuetifyOverlay } from "@/helpers/vuetify_overlay";
import { api } from "@/plugins/api";
import type { ConfigValueType, ProviderConfig } from "@/plugins/api/interfaces";
import { $t } from "@/plugins/i18n";
import EditConfig from "@/views/settings/EditConfig.vue";
import { computed, ref, watch } from "vue";
import { toast } from "vue-sonner";

/**
 * A provider's settings in a dialog, for a page that should stay where it is
 * while they are changed, such as the setup wizard. Saving closes it.
 */
const props = defineProps<{
  instanceId: string;
}>();

const open = defineModel<boolean>("open", { required: true });

const config = ref<ProviderConfig>();
const loading = ref(false);
const editConfig = ref<InstanceType<typeof EditConfig> | null>(null);

const entries = computed(() =>
  config.value ? Object.values(config.value.values) : [],
);
const domain = computed(
  () => config.value?.domain ?? api.providers[props.instanceId]?.domain,
);
const name = computed(
  () =>
    api.getProvider(props.instanceId)?.name ||
    (domain.value ? api.providerManifests[domain.value]?.name : undefined) ||
    "",
);
const description = computed(() =>
  domain.value ? (api.providerManifests[domain.value]?.description ?? "") : "",
);

// the settings are read fresh on every open, so the form never shows values
// that changed since it was last open
watch(
  open,
  async (isOpen) => {
    if (!isOpen) return;
    config.value = undefined;
    try {
      const loaded = await api.getProviderConfig(props.instanceId);
      if (open.value) config.value = loaded;
    } catch (error) {
      toast.error(String(error));
      open.value = false;
    }
  },
  { immediate: true },
);

const save = async function (values: Record<string, ConfigValueType>) {
  const current = config.value;
  if (!current) return;
  try {
    // the error toast below says why, so the global one stays quiet
    await api.saveProviderConfig(
      current.domain,
      { ...values, enabled: current.enabled },
      current.instance_id,
      { suppressGlobalError: true },
    );
    toast.success($t("settings.provider_saved"));
    open.value = false;
  } catch (error) {
    editConfig.value?.saveFailed();
    toast.error(String(error));
  }
};

// an entry that applies the moment it changes, as on the provider's own page
const applyNow = async function (values: Record<string, ConfigValueType>) {
  const current = config.value;
  if (!current) return;
  const updated = await api.saveProviderConfig(
    current.domain,
    values,
    current.instance_id,
  );
  for (const [key, entry] of Object.entries(updated.values)) {
    current.values[key] = entry;
  }
};

const { onAction } = useConfigAction({
  config,
  loading,
  invokeAction: (action) =>
    api.invokeProviderConfigAction(props.instanceId, action),
  saveValues: (values) =>
    api.saveProviderConfig(config.value!.domain, values, props.instanceId),
  answeredBy: () => config.value?.domain,
});

const keepOpenForOverlays = function (event: Event) {
  if (isInVuetifyOverlay(event)) event.preventDefault();
};
</script>
