<template>
  <section class="edit-provider">
    <div v-if="config && api.providerManifests[config.domain]">
      <!-- Disabled banner -->
      <Alert v-if="!config.enabled" variant="warning" class="mb-4">
        <AlertTriangle class="h-4 w-4" />
        <AlertDescription>
          <div class="disabled-banner">
            <span>{{ $t("settings.provider_disabled") }}</span>
            <Button size="sm" variant="outline" @click="config.enabled = true">
              {{ $t("settings.enable_provider") }}
            </Button>
          </div>
        </AlertDescription>
      </Alert>

      <!-- Header card -->
      <Card class="mb-4">
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
              <Button
                variant="ghost"
                size="icon-sm"
                class="rename-btn"
                @click="showRenameDialog = true"
              >
                <Pencil class="h-4 w-4" />
              </Button>
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
      </Card>
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
    <Dialog v-model:open="showRenameDialog">
      <DialogContent class="max-w-[400px]">
        <DialogHeader>
          <DialogTitle>{{ $t("settings.provider_name") }}</DialogTitle>
          <DialogDescription class="sr-only">{{
            $t("aria.rename_provider")
          }}</DialogDescription>
        </DialogHeader>
        <Input
          v-model="editName"
          :placeholder="
            api.getProvider(config?.instance_id ?? '')?.name ||
            api.providerManifests[config?.domain ?? '']?.name
          "
          autofocus
          @keyup.enter="saveRename"
        />
        <DialogFooter>
          <Button variant="outline" @click="showRenameDialog = false">
            {{ $t("close") }}
          </Button>
          <Button @click="saveRename">
            {{ $t("settings.save") }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    <div
      v-if="loading"
      class="fixed inset-0 z-50 flex items-center justify-center bg-background/80"
    >
      <Card v-if="showAuthLink" class="bg-card p-6">
        <h3 class="text-lg font-semibold mb-2">Authenticating...</h3>
        <p class="text-sm text-muted-foreground mb-4">
          A new tab/popup should be opened where you can authenticate
        </p>
        <a id="auth" href="" target="_blank">
          <Button variant="outline"
            >Click here if the popup did not open</Button
          >
        </a>
      </Card>
      <Spinner v-else class="h-16 w-16" />
    </div>
  </section>
</template>

<script setup lang="ts">
import ProviderIcon from "@/components/ProviderIcon.vue";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { markdownToHtml } from "@/helpers/utils";
import { api } from "@/plugins/api";
import {
  ConfigValueType,
  EventMessage,
  EventType,
  ProviderConfig,
} from "@/plugins/api/interfaces";
import { AlertTriangle, Pencil } from "lucide-vue-next";
import { nanoid } from "nanoid";
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useRouter } from "vue-router";
import EditConfig from "./EditConfig.vue";

// global refs
const router = useRouter();
const config = ref<ProviderConfig>();
const sessionId = nanoid(11);
const loading = ref(false);
const showAuthLink = ref(false);
const showRenameDialog = ref(false);
const editName = ref<string | undefined>(undefined);

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
    editName.value = config.value.name || undefined;
  }
});

// methods
const onSubmit = async function (values: Record<string, ConfigValueType>) {
  // save new provider config
  loading.value = true;
  values["enabled"] = config.value!.enabled;
  api
    .saveProviderConfig(config.value!.domain, values, config.value!.instance_id)
    .then(() => {
      router.push({
        name: "providersettings",
        query: { types: config.value!.type },
      });
    })
    .catch((err) => {
      // TODO: make this a bit more fancy someday
      alert(err);
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
      // TODO: make this a bit more fancy someday
      alert(err);
    })
    .finally(() => {
      loading.value = false;
      showAuthLink.value = false;
    });
};

const getAuthorsMarkdown = function (authors: string[]) {
  const allAuthors: string[] = [];
  const { t } = useI18n();
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
  const { t } = useI18n();
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
  color: var(--foreground);
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
  color: var(--muted-foreground);
  margin: 0 0 12px 0;
  line-height: 1.5;
}

.header-authors {
  font-size: 0.813rem;
  color: var(--muted-foreground);
}
</style>

<style>
.header-authors a {
  color: var(--primary);
  text-decoration: none;
}

.header-authors a:hover {
  text-decoration: underline;
}
</style>

<style scoped>
@media (max-width: 600px) {
  .header-content {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
