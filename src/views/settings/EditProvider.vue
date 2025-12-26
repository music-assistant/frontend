<template>
  <v-container fluid class="pa-6">
    <v-row>
      <v-col cols="12" md="8" offset-md="2">
        <div v-if="config && api.providerManifests[config.domain]">
          <!-- Disabled banner -->
          <v-alert
            v-if="!config.enabled"
            type="warning"
            variant="tonal"
            class="mb-6"
            closable
          >
            <div class="d-flex align-center justify-space-between w-100">
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

          <!-- Header card -->
          <v-card class="mb-6">
            <v-card-text class="d-flex gap-4 align-start">
              <provider-icon :domain="config.domain" :size="48" class="flex-shrink-0" />
              <div class="flex-grow-1">
                <div class="d-flex align-center gap-2 mb-2">
                  <h2 class="text-h5 font-weight-bold">
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
                    class="text-medium-emphasis"
                    @click="showRenameDialog = true"
                  />
                </div>
                <p class="text-body-2 text-medium-emphasis mb-3">
                  {{ api.providerManifests[config.domain].description }}
                </p>
                <div
                  v-if="api.providerManifests[config.domain].codeowners.length"
                  class="text-caption text-medium-emphasis"
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
                  class="text-caption text-medium-emphasis"
                  v-html="
                    markdownToHtml(
                      getCreditsMarkdown(
                        api.providerManifests[config.domain].credits,
                      ),
                    )
                  "
                ></div>
              </div>
            </v-card-text>
          </v-card>
        </div>

        <v-card>
          <v-card-text>
            <edit-config
              v-if="config"
              :config-entries="allConfigEntries"
              :disabled="!config.enabled"
              @submit="onSubmit"
              @action="onAction"
              @immediate-apply="onImmediateApply"
            />
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

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
      class="align-center justify-center"
      scrim="true"
      persistent
    >
      <v-card v-if="showAuthLink" color="surface">
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
  </v-container>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch, computed } from "vue";
import { useRouter } from "vue-router";
import { api } from "@/plugins/api";
import {
  ProviderConfig,
  ConfigValueType,
  EventMessage,
  EventType,
  ConfigEntry,
} from "@/plugins/api/interfaces";
import EditConfig from "./EditConfig.vue";
import ProviderIcon from "@/components/ProviderIcon.vue";
import { nanoid } from "nanoid";
import { markdownToHtml } from "@/helpers/utils";
import { useI18n } from "vue-i18n";

// global refs
const router = useRouter();
const config = ref<ProviderConfig>();
const sessionId = nanoid(11);
const loading = ref(false);
const showAuthLink = ref(false);
const showRenameDialog = ref(false);
const editName = ref<string | null>(null);

// props
const props = defineProps<{
  instanceId?: string;
}>();

// computed properties
const allConfigEntries = computed(() => {
  if (!config.value) return [];
  // Pass all entries (including hidden ones) to EditConfig
  // Hidden entries contain values that need to be preserved on save
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
const onSubmit = async function (values: Record<string, ConfigValueType>) {
  // save new provider config
  loading.value = true;
  values["enabled"] = config.value!.enabled;
  api
    .saveProviderConfig(config.value!.domain, values, config.value!.instance_id)
    .then(() => {
      router.push({ name: "providersettings" });
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
  api.saveProviderConfig(
    config.value!.domain,
    values,
    config.value!.instance_id,
  );
};

const onAction = async function (
  action: string,
  values: Record<string, ConfigValueType>,
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
    .then((entries) => {
      config.value!.values = {};
      for (const entry of entries) {
        config.value!.values[entry.key] = entry;
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
.gap-4 {
  gap: 16px;
}
.gap-2 {
  gap: 8px;
}
</style>
