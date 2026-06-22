<template>
  <section class="edit-provider">
    <div v-if="config && api.providerManifests[config.domain]">
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
            @click="config.enabled = true"
          >
            {{ $t("settings.enable_provider") }}
          </v-btn>
        </div>
      </v-alert>

      <!-- Error banner: shows why the provider failed to load -->
      <div
        v-if="config.enabled && config.last_error"
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
            {{ config.last_error?.message }}
          </div>
          <div
            v-if="
              config.status === ProviderStatus.INCOMPATIBLE ||
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
            <!-- other errors: offer to retry loading -->
            <Button v-else size="sm" variant="destructive" @click="onReload">
              <RefreshCw class="size-4" />
              {{ $t("settings.reload") }}
            </Button>
          </div>
        </div>
      </div>

      <!-- Header card -->
      <v-card class="header-card mb-4" elevation="0">
        <div class="header-content">
          <div class="header-icon">
            <provider-icon :domain="config.domain" :size="48" />
          </div>
          <div class="header-info">
            <div class="header-title-row">
              <h2 class="header-title">
                {{
                  config.name ||
                  api.providers[config.instance_id]?.name ||
                  api.providerManifests[config.domain].name
                }}
              </h2>
              <v-btn
                icon="mdi-pencil"
                variant="text"
                size="small"
                density="compact"
                class="rename-btn"
                @click="showRenameDialog = true"
              />
            </div>
            <p class="header-description">
              {{ api.providerManifests[config.domain].description }}
            </p>
            <div
              v-if="api.providerManifests[config.domain].codeowners.length"
              class="header-authors"
              v-html="
                markdownToHtml(
                  getAuthorsMarkdown(
                    api.providerManifests[config.domain].codeowners,
                  ),
                )
              "
            ></div>
            <div
              v-if="api.providerManifests[config.domain].credits.length"
              class="header-authors"
              v-html="
                markdownToHtml(
                  getCreditsMarkdown(
                    api.providerManifests[config.domain].credits,
                  ),
                )
              "
            ></div>
          </div>
        </div>
      </v-card>
    </div>

    <edit-config
      v-if="config"
      :config-entries="allConfigEntries"
      :disabled="!config.enabled"
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
      v-model="loading"
      scrim="true"
      persistent
      style="display: flex; align-items: center; justify-content: center"
    >
      <v-card v-if="showAuthLink" style="background-color: white">
        <v-card-title>Authenticating...</v-card-title>
        <v-card-subtitle
          >A new tab/popup should be opened where you can
          authenticate</v-card-subtitle
        >
        <v-card-actions>
          <a id="auth" href="" target="_blank"
            ><v-btn>Click here if the popup did not open</v-btn></a
          >
        </v-card-actions>
      </v-card>
      <v-progress-circular v-else indeterminate size="64" color="primary" />
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
import { Button } from "@/components/ui/button";
import { markdownToHtml } from "@/helpers/utils";
import { api } from "@/plugins/api";
import {
  ConfigValueType,
  EventMessage,
  EventType,
  ProviderConfig,
  ProviderStatus,
} from "@/plugins/api/interfaces";
import { eventbus } from "@/plugins/eventbus";
import { RefreshCw, Trash2, TriangleAlert } from "@lucide/vue";
import { nanoid } from "nanoid";
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useRouter } from "vue-router";
import { toast } from "vue-sonner";
import EditConfig from "./EditConfig.vue";

// global refs
const router = useRouter();
const { t } = useI18n();
const config = ref<ProviderConfig>();
const sessionId = nanoid(11);
const loading = ref(false);
const showAuthLink = ref(false);
const showRenameDialog = ref(false);
const editName = ref<string | null>(null);
const saveErrorOpen = ref(false);
const saveErrorMessage = ref("");
const lastSubmitValues = ref<Record<string, ConfigValueType>>();

// props
const props = defineProps<{
  instanceId?: string;
}>();

// computed properties
const allConfigEntries = computed(() => {
  if (!config.value) return [];
  return Object.values(config.value.values);
});

onMounted(() => {
  //reload if/when item updates
  const unsub = api.subscribe(EventType.AUTH_SESSION, (evt: EventMessage) => {
    // handle AUTH_SESSION event (used for auth flows to open the auth url)
    // ignore any events that not match our session id.
    if (evt.object_id !== sessionId) return;
    const url = evt.data as string;
    // Some browsers (e.g. iOS) have a weird limitation that we're not allowed to do window.open,
    // unless a user interaction has happened. So we need to do this the hard way
    showAuthLink.value = true;
    window.setTimeout(() => {
      const a = document.getElementById("auth") as HTMLAnchorElement;
      a.setAttribute("href", url);
      a.click();
    }, 100);
  });
  onBeforeUnmount(unsub);
});

// watchers
watch(
  () => props.instanceId,
  async (val) => {
    if (val) {
      config.value = await api.getProviderConfig(val);
    }
  },
  { immediate: true },
);

watch(showRenameDialog, (val) => {
  if (val && config.value) {
    editName.value = config.value.name || null;
  }
});

// methods
const backToProviders = function () {
  router.push({
    name: "providersettings",
    query: { types: config.value?.type },
  });
};

const onReload = function () {
  if (!config.value) return;
  api
    .reloadProvider(config.value.instance_id)
    .then(() => toast.success(t("settings.provider_reloading")))
    .catch((err) => toast.error(String(err)));
  backToProviders();
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
    })
    .finally(() => {
      loading.value = false;
      showAuthLink.value = false;
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

const onAction = async function (
  action: string,
  values: Record<string, ConfigValueType>,
  immediateApply: boolean,
) {
  loading.value = true;
  // append existing ConfigEntry values to allow
  // values be passed between flow steps
  for (const entry of Object.values(config.value!.values)) {
    if (entry.value !== undefined && values[entry.key] == undefined) {
      values[entry.key] = entry.value;
    }
  }
  // ensure the session id is passed along (for auth actions)
  values["session_id"] = sessionId;
  api
    .getProviderConfigEntries(
      config.value!.domain,
      config.value!.instance_id,
      action,
      values,
    )
    .then(async (entries) => {
      config.value!.values = {};
      for (const entry of entries) {
        config.value!.values[entry.key] = entry;
      }
      // If the action has immediate_apply, save the updated values right away
      if (immediateApply) {
        const saveValues: Record<string, ConfigValueType> = {};
        for (const entry of entries) {
          if (entry.value !== undefined) {
            saveValues[entry.key] = entry.value;
          }
        }
        const updatedConfig = await api.saveProviderConfig(
          config.value!.domain,
          saveValues,
          config.value!.instance_id,
        );
        for (const [key, entry] of Object.entries(updatedConfig.values)) {
          config.value!.values[key] = entry;
        }
      }
    })
    .catch((err) => {
      toast.error(String(err));
    })
    .finally(() => {
      loading.value = false;
      showAuthLink.value = false;
    });
};

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
</script>

<style scoped>
.edit-provider {
  padding: 16px;
}

.header-card {
  border: 1px solid rgba(var(--v-theme-on-surface), 0.12);
  border-radius: 12px;
}

.header-content {
  display: flex;
  gap: 20px;
  padding: 24px;
}

.header-icon {
  flex-shrink: 0;
}

.header-info {
  flex: 1;
  min-width: 0;
}

.header-title-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.header-title {
  font-size: 1.25rem;
  font-weight: 600;
  margin: 0;
  color: rgb(var(--v-theme-on-surface));
}

.rename-btn {
  opacity: 0.6;
  transition: opacity 0.2s ease;
}

.rename-btn:hover {
  opacity: 1;
}

.disabled-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.header-description {
  font-size: 0.875rem;
  color: rgba(var(--v-theme-on-surface), 0.7);
  margin: 0 0 12px 0;
  line-height: 1.5;
}

.header-authors {
  font-size: 0.813rem;
  color: rgba(var(--v-theme-on-surface), 0.6);
}

.header-authors :deep(a) {
  color: rgb(var(--v-theme-primary));
  text-decoration: none;
}

.header-authors :deep(a:hover) {
  text-decoration: underline;
}

@media (max-width: 600px) {
  .header-content {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
