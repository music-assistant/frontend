<template>
  <section class="edit-provider">
    <div v-if="config && providerManifest">
      <!-- Disabled banner -->
      <v-alert
        v-if="!config.enabled"
        type="warning"
        variant="tonal"
        class="mb-4"
        closable
      >
        <div class="disabled-banner">
          <span>{{ $t("settings.provider_disabled") }}</span>
          <v-btn
            size="small"
            color="warning"
            variant="flat"
            :loading="toggleLoading"
            @click="toggleEnabled"
          >
            {{ $t("settings.enable_provider") }}
          </v-btn>
        </div>
      </v-alert>

      <!-- Error banner: shows why the provider failed to load -->
      <div
        v-if="
          config.enabled &&
          (config.last_error || config.status === ProviderStatus.AUTH_REQUIRED)
        "
        class="mb-4 flex gap-3 rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-destructive"
      >
        <TriangleAlert class="size-5 shrink-0" />
        <div class="min-w-0 flex-1">
          <div class="font-semibold">
            {{ $t("settings.provider_requires_attention") }}
          </div>
          <div
            class="mt-0.5 text-sm whitespace-pre-wrap break-words opacity-90"
          >
            {{
              config.last_error?.message ||
              $t("settings.provider_status_auth_required")
            }}
          </div>
          <div
            v-if="
              config.status === ProviderStatus.INCOMPATIBLE ||
              canReconfigure ||
              config.status === ProviderStatus.ERROR
            "
            class="mt-3 flex gap-2"
          >
            <!-- incompatible: nothing to fix, offer to remove the provider -->
            <Button
              v-if="config.status === ProviderStatus.INCOMPATIBLE"
              size="sm"
              variant="destructive"
              @click="onRemove"
            >
              <Trash2 class="size-4" />
              {{ $t("settings.remove_provider") }}
            </Button>
            <template v-else>
              <!-- auth required / error: relaunch the setup (reconfigure) flow -->
              <Button
                v-if="canReconfigure"
                size="sm"
                variant="destructive"
                @click="onReconfigure"
              >
                <RefreshCw class="size-4" />
                {{ $t("settings.reconfigure") }}
              </Button>
              <!-- error: also offer a plain reload -->
              <Button
                v-if="config.status === ProviderStatus.ERROR"
                size="sm"
                variant="outline"
                @click="onReload"
              >
                <RefreshCw class="size-4" />
                {{ $t("settings.reload_provider") }}
              </Button>
            </template>
          </div>
        </div>
      </div>

      <!-- Header card -->
      <Card class="mb-4 gap-0 py-0">
        <CardHeader class="relative flex flex-col gap-4 p-6 pr-16 sm:flex-row">
          <ProviderIcon :domain="config.domain" :size="48" class="shrink-0" />
          <div class="min-w-0 flex-1">
            <div class="flex flex-wrap items-center gap-2">
              <h2 class="text-xl leading-tight font-semibold">
                {{ providerName }}
              </h2>
              <Button
                variant="ghost"
                size="icon-sm"
                :title="$t('settings.provider_name')"
                @click="showRenameDialog = true"
              >
                <Pencil class="size-4" />
                <span class="sr-only">{{ $t("settings.provider_name") }}</span>
              </Button>
              <Badge
                data-testid="provider-status"
                variant="outline"
                :class="providerStatusClass"
              >
                <span
                  class="size-1.5 rounded-full bg-current"
                  aria-hidden="true"
                ></span>
                {{ providerStatusLabel }}
              </Badge>
            </div>
            <CardDescription class="mt-2 max-w-3xl leading-relaxed">
              {{ providerManifest.description }}
            </CardDescription>
            <div
              v-if="providerManifest.codeowners.length"
              class="mt-3 text-xs text-muted-foreground [&_a]:text-primary [&_a]:hover:underline"
              v-html="
                markdownToHtml(getAuthorsMarkdown(providerManifest.codeowners))
              "
            ></div>
            <div
              v-if="providerManifest.credits.length"
              class="mt-1 text-xs text-muted-foreground [&_a]:text-primary [&_a]:hover:underline"
              v-html="
                markdownToHtml(getCreditsMarkdown(providerManifest.credits))
              "
            ></div>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger as-child>
              <Button
                data-testid="provider-menu"
                variant="ghost"
                size="icon-sm"
                class="absolute top-4 right-4"
                :aria-label="$t('more_options')"
              >
                <MoreVertical class="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                data-testid="provider-reset-defaults"
                :disabled="!config.enabled"
                @click="resetToDefaults"
              >
                <RotateCcw class="size-4" />
                {{ $t("settings.reset_to_defaults") }}
              </DropdownMenuItem>
              <template v-if="canToggleEnabled">
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  data-testid="provider-toggle-enabled"
                  :disabled="toggleLoading"
                  @click="toggleEnabled"
                >
                  <Power class="size-4" />
                  {{
                    config.enabled
                      ? $t("settings.disable")
                      : $t("settings.enable")
                  }}
                </DropdownMenuItem>
              </template>
            </DropdownMenuContent>
          </DropdownMenu>
        </CardHeader>
        <CardContent
          class="flex flex-wrap items-center gap-3 border-t bg-muted/20 px-6 py-4"
        >
          <Button
            v-if="canReconfigure"
            data-testid="provider-reconfigure"
            @click="onReconfigure"
          >
            <RefreshCw class="size-4" />
            {{ $t("settings.reconfigure") }}
          </Button>
          <Button
            v-if="documentationUrl"
            as="a"
            data-testid="provider-documentation"
            variant="outline"
            :href="documentationUrl"
            target="_blank"
            rel="noopener noreferrer"
          >
            <BookOpen class="size-4" />
            {{ $t("settings.documentation") }}
          </Button>
          <Button
            as="a"
            data-testid="provider-known-issues"
            variant="outline"
            :href="knownIssuesUrl"
            target="_blank"
            rel="noopener noreferrer"
          >
            <CircleAlert class="size-4" />
            {{ $t("settings.known_issues") }}
          </Button>
          <AdvancedSettingsToggle
            v-if="config.enabled && hasAdvancedEntries(allConfigEntries)"
            v-model:show-advanced-settings="showAdvancedSettings"
            test-id="provider-advanced-settings"
          />
        </CardContent>
      </Card>

      <!-- ambient sounds: manage user-added custom sounds -->
      <AmbientSoundsCustomSounds
        v-if="config.domain === 'ambient_sounds' && config.enabled"
      />
    </div>

    <edit-config
      v-if="config"
      ref="editConfig"
      v-model:show-advanced-settings="showAdvancedSettings"
      :config-entries="allConfigEntries"
      :disabled="!config.enabled"
      :provider-domain="config.domain"
      @submit="onSubmit"
      @action="onAction"
      @immediate-apply="onImmediateApply"
    />

    <!-- Rename dialog -->
    <v-dialog v-model="showRenameDialog" max-width="400">
      <v-card>
        <v-card-title>{{ $t("settings.provider_name") }}</v-card-title>
        <v-card-text>
          <v-text-field
            v-model="editName"
            :placeholder="
              api.getProvider(config?.instance_id ?? '')?.name ||
              api.providerManifests[config?.domain ?? '']?.name
            "
            variant="outlined"
            density="comfortable"
            autofocus
            clearable
            @keyup.enter="saveRename"
          />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="showRenameDialog = false">
            {{ $t("close") }}
          </v-btn>
          <v-btn color="primary" variant="flat" @click="saveRename">
            {{ $t("settings.save") }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
    <v-overlay
      :model-value="loading || toggleLoading"
      scrim="true"
      persistent
      style="display: flex; align-items: center; justify-content: center"
    >
      <v-progress-circular indeterminate size="64" color="primary" />
    </v-overlay>

    <provider-save-error-dialog
      v-model:open="saveErrorOpen"
      :message="saveErrorMessage"
      mode="edit"
      @retry="retrySave"
    />
  </section>
</template>

<script setup lang="ts">
import ProviderIcon from "@/components/ProviderIcon.vue";
import ProviderSaveErrorDialog from "@/components/ProviderSaveErrorDialog.vue";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useConfigAction } from "@/composables/useConfigAction";
import {
  hasAdvancedEntries,
  mergeConfigEntries,
} from "@/helpers/config_entry_ui";
import {
  canReconfigureProvider,
  getProviderStatusTranslationKey,
  getProviderSupportIssuesUrl,
} from "@/helpers/provider_config";
import { getExternalLinkUrl, markdownToHtml } from "@/helpers/utils";
import { api } from "@/plugins/api";
import {
  ConfigValueType,
  EventType,
  ProviderConfig,
  ProviderStatus,
} from "@/plugins/api/interfaces";
import { eventbus } from "@/plugins/eventbus";
import {
  BookOpen,
  CircleAlert,
  MoreVertical,
  Pencil,
  Power,
  RefreshCw,
  RotateCcw,
  Trash2,
  TriangleAlert,
} from "@lucide/vue";
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useRouter } from "vue-router";
import { toast } from "vue-sonner";
import AdvancedSettingsToggle from "./AdvancedSettingsToggle.vue";
import AmbientSoundsCustomSounds from "./AmbientSoundsCustomSounds.vue";
import EditConfig from "./EditConfig.vue";

// global refs
const router = useRouter();
const { t } = useI18n();
const config = ref<ProviderConfig>();
const editConfig = ref<InstanceType<typeof EditConfig>>();
const loading = ref(false);
const showAdvancedSettings = ref(false);
const toggleLoading = ref(false);
const showRenameDialog = ref(false);
const editName = ref<string | null>(null);
const saveErrorOpen = ref(false);
const saveErrorMessage = ref("");
const lastSubmitValues = ref<Record<string, ConfigValueType>>();
let configLoadRequestId = 0;
let configRefreshRequestId = 0;
let toggleRequestId = 0;
let unsubProvidersUpdated: (() => void) | undefined;

// props
const props = defineProps<{
  instanceId?: string;
}>();

// computed properties
const allConfigEntries = computed(() => {
  if (!config.value) return [];
  return Object.values(config.value.values);
});

const providerManifest = computed(() => {
  if (!config.value) return undefined;
  return api.providerManifests[config.value.domain];
});

const providerName = computed(
  () =>
    config.value?.name ||
    api.providers[config.value?.instance_id ?? ""]?.name ||
    providerManifest.value?.name,
);

const canReconfigure = computed(() =>
  canReconfigureProvider(
    config.value?.status,
    providerManifest.value?.has_setup_flow,
    config.value?.enabled,
  ),
);

const canToggleEnabled = computed(
  () =>
    !!config.value &&
    (!config.value.enabled || providerManifest.value?.allow_disable === true),
);

const providerStatusLabel = computed(() =>
  t(getProviderStatusTranslationKey(config.value?.status)),
);

const providerStatusClass = computed(() =>
  getProviderStatusBadgeClass(config.value?.status),
);

const knownIssuesUrl = computed(() =>
  getProviderSupportIssuesUrl(config.value?.domain ?? ""),
);

const documentationUrl = computed(() => {
  return getExternalLinkUrl(providerManifest.value?.documentation);
});

// watchers
watch(
  () => props.instanceId,
  (val) => {
    if (val) void loadConfig(val);
  },
  { immediate: true },
);

watch(showRenameDialog, (val) => {
  if (val && config.value) {
    editName.value = config.value.name || null;
  }
});

onMounted(() => {
  unsubProvidersUpdated = api.subscribe(EventType.PROVIDERS_UPDATED, () => {
    if (props.instanceId) void refreshProviderConfig(props.instanceId);
  });
});

onBeforeUnmount(() => {
  unsubProvidersUpdated?.();
});

// methods
const backToProviders = function () {
  router.push({
    name: "providersettings",
    query: { types: config.value?.type },
  });
};

const resetToDefaults = function () {
  editConfig.value?.resetToDefaults();
};

const onReload = function () {
  if (!config.value) return;
  api
    .reloadProvider(config.value.instance_id)
    .then(() => toast.success(t("settings.provider_reloading")))
    .catch((err) => toast.error(String(err)));
  backToProviders();
};

const toggleEnabled = async function () {
  if (
    !config.value ||
    (config.value.enabled && !providerManifest.value?.allow_disable)
  ) {
    return;
  }

  const instanceId = config.value.instance_id;
  const requestId = ++toggleRequestId;
  toggleLoading.value = true;
  try {
    const updatedConfig = await api.saveProviderConfig(
      config.value.domain,
      { enabled: !config.value.enabled },
      instanceId,
    );
    if (!isCurrentProvider(instanceId)) return;

    config.value.enabled = updatedConfig.enabled;
    config.value.status = updatedConfig.status;
    config.value.last_error = updatedConfig.last_error;
    toast.success(t("settings.provider_saved"));
  } catch (err) {
    if (!isCurrentProvider(instanceId)) return;

    toast.error(String(err));
    await refreshProviderConfig(instanceId);
  } finally {
    if (requestId === toggleRequestId) {
      toggleLoading.value = false;
    }
  }
};

const onReconfigure = function () {
  if (!config.value) return;
  const instanceId = config.value.instance_id;
  eventbus.emit("setupFlowDialog", {
    kind: "reconfigure",
    instanceId,
    onFlowEnded: () => {
      void refreshProviderConfig(instanceId);
    },
  });
};

const onRemove = function () {
  if (!config.value) return;
  const instanceId = config.value.instance_id;
  eventbus.emit("deleteConfirmationDialog", {
    title: t("settings.remove_provider"),
    message: t("settings.remove_provider_confirm"),
    confirmLabel: t("settings.remove_provider"),
    onConfirm: async () => {
      try {
        await api.removeProviderConfig(instanceId);
        toast.success(t("settings.provider_removed"));
        backToProviders();
      } catch (err) {
        toast.error(String(err));
      }
    },
  });
};

const retrySave = function () {
  saveErrorOpen.value = false;
  if (lastSubmitValues.value) onSubmit(lastSubmitValues.value);
};

const onSubmit = async function (values: Record<string, ConfigValueType>) {
  // save provider config
  loading.value = true;
  lastSubmitValues.value = values;
  values["enabled"] = config.value!.enabled;
  api
    .saveProviderConfig(config.value!.domain, values, config.value!.instance_id)
    .then(() => {
      toast.success(t("settings.provider_saved"));
      router.push({
        name: "providersettings",
        query: { types: config.value!.type },
      });
    })
    .catch((err) => {
      saveErrorMessage.value = String(err);
      saveErrorOpen.value = true;
      editConfig.value?.saveFailed();
    })
    .finally(() => {
      loading.value = false;
    });
};

const onImmediateApply = async function (
  values: Record<string, ConfigValueType>,
) {
  // Immediately apply a config value change to the backend
  // and refresh the local config with the server response
  const updatedConfig = await api.saveProviderConfig(
    config.value!.domain,
    values,
    config.value!.instance_id,
  );
  for (const [key, entry] of Object.entries(updatedConfig.values)) {
    config.value!.values[key] = entry;
  }
};

const { onAction } = useConfigAction({
  config,
  loading,
  invokeAction: (action) =>
    api.invokeProviderConfigAction(config.value!.instance_id, action),
  saveValues: (values) =>
    api.saveProviderConfig(
      config.value!.domain,
      values,
      config.value!.instance_id,
    ),
});

const getAuthorsMarkdown = function (authors: string[]) {
  const allAuthors: string[] = [];
  for (const author of authors) {
    if (author.includes("@")) {
      let authorName = author.replace("@", "");
      if (authorName == "music-assistant") {
        authorName = "the Music Assistant team";
      }
      allAuthors.push(
        `[${authorName}](https://github.com/${author.replace("@", "")})`,
      );
    } else {
      allAuthors.push(author);
    }
  }
  return `**${t("settings.provider_codeowners")}**: ` + allAuthors.join(" / ");
};

const getCreditsMarkdown = function (credits: string[]) {
  return `**${t("settings.provider_credits")}**: ` + credits.join(" / ");
};

const saveRename = function () {
  if (config.value) {
    config.value.name = editName.value || "";
  }
  api
    .saveProviderConfig(
      config.value!.domain,
      { name: config.value!.name || null },
      config.value!.instance_id,
    )
    .then(() => {
      loading.value = true;
    })
    .finally(() => {
      loading.value = false;
      showRenameDialog.value = false;
    });
};

async function loadConfig(instanceId: string) {
  const requestId = ++configLoadRequestId;
  try {
    const updatedConfig = await api.getProviderConfig(instanceId);
    if (requestId === configLoadRequestId && props.instanceId === instanceId) {
      config.value = updatedConfig;
    }
  } catch (err) {
    if (requestId === configLoadRequestId) {
      toast.error(String(err));
    }
  }
}

async function refreshProviderConfig(instanceId: string) {
  if (config.value?.instance_id !== instanceId) return;
  const requestId = ++configRefreshRequestId;
  try {
    const updatedConfig = await api.getProviderConfig(instanceId);
    if (
      requestId === configRefreshRequestId &&
      props.instanceId === instanceId &&
      config.value?.instance_id === instanceId
    ) {
      config.value.enabled = updatedConfig.enabled;
      config.value.status = updatedConfig.status;
      config.value.last_error = updatedConfig.last_error;
      config.value.values = mergeConfigEntries(
        config.value.values,
        updatedConfig.values,
      );
    }
  } catch (err) {
    if (requestId === configRefreshRequestId) {
      toast.error(String(err));
    }
  }
}

function getProviderStatusBadgeClass(status?: ProviderStatus | null) {
  switch (status) {
    case ProviderStatus.LOADED:
      return "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400";
    case ProviderStatus.LOADING:
      return "border-blue-500/40 bg-blue-500/10 text-blue-700 dark:text-blue-400";
    case ProviderStatus.AUTH_REQUIRED:
    case ProviderStatus.INCOMPATIBLE:
      return "border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-400";
    case ProviderStatus.ERROR:
      return "border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-400";
    default:
      return "border-muted-foreground/30 bg-muted text-muted-foreground";
  }
}

function isCurrentProvider(instanceId: string) {
  return (
    props.instanceId === instanceId && config.value?.instance_id === instanceId
  );
}
</script>

<style scoped>
.edit-provider {
  padding: 16px;
}

.disabled-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}
</style>
