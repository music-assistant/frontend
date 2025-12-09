<template>
  <section class="edit-provider">
    <div v-if="config && api.providerManifests[config.domain]">
      <!-- Header card -->
      <v-card class="header-card mb-4" elevation="0">
        <div class="header-content">
          <div class="header-icon">
            <provider-icon :domain="config.domain" :size="48" />
          </div>
          <div class="header-info">
            <h2 class="header-title">
              {{ api.providerManifests[config.domain].name }}
            </h2>
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

      <!-- Basic settings card -->
      <v-card class="settings-card mb-4" elevation="0">
        <div class="settings-card-header">
          <v-icon size="20">mdi-cog</v-icon>
          <h3 class="settings-card-title">
            {{ $t("settings.category.generic", "Basic settings") }}
          </h3>
        </div>
        <div class="settings-card-content">
          <v-text-field
            v-if="'name' in config"
            v-model="config.name"
            :placeholder="api.getProvider(config.instance_id)?.name"
            :label="$t('settings.provider_name')"
            variant="outlined"
            density="comfortable"
            clearable
          />
          <v-switch
            v-if="'enabled' in config"
            v-model="config.enabled"
            :label="$t('settings.enable_provider')"
            color="primary"
            :disabled="!api.providerManifests[config.domain]?.allow_disable"
            hide-details
          />
          <!-- Generic config entries -->
          <div
            v-for="conf_entry of genericConfigEntries"
            :key="conf_entry.key"
            class="config-entry"
          >
            <ConfigEntryField
              :conf-entry="conf_entry"
              :show-password-values="showPasswordValues"
              :disabled="isDisabled(conf_entry)"
              @toggle-password="showPasswordValues = !showPasswordValues"
              @clear-value="conf_entry.value = conf_entry.default_value"
              @update:value="conf_entry.value = $event"
              @action="
                onAction(conf_entry.action || conf_entry.key, {});
                conf_entry.value = conf_entry.action ? null : conf_entry.key;
              "
            />
            <v-btn
              v-if="hasDescriptionOrHelpLink(conf_entry)"
              icon="mdi-help-circle-outline"
              variant="text"
              size="small"
              class="help-btn"
              @click="
                $t(
                  `settings.${conf_entry?.key}.description`,
                  conf_entry.description || '',
                )
                  ? (showHelpInfo = conf_entry)
                  : openLink(conf_entry.help_link!)
              "
            />
          </div>
        </div>
      </v-card>
    </div>

    <edit-config
      v-if="config"
      :config-entries="nonGenericConfigEntries"
      :disabled="!config.enabled"
      :show-generic-section="false"
      @submit="onSubmit"
      @action="onAction"
    />
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
    <v-dialog
      :model-value="showHelpInfo !== undefined"
      width="auto"
      @update:model-value="showHelpInfo = undefined"
    >
      <v-card>
        <v-card-text>
          <h2>
            {{
              $t(
                `settings.${showHelpInfo?.key}.label`,
                showHelpInfo?.label || "",
              )
            }}
          </h2>
        </v-card-text>
        <!-- eslint-disable vue/no-v-html -->
        <!-- eslint-disable vue/no-v-text-v-html-on-component -->
        <v-card-text
          v-html="
            markdownToHtml(
              $t(
                `settings.${showHelpInfo?.key}.description`,
                showHelpInfo?.description || '',
              ),
            )
          "
        />
        <!-- eslint-enable vue/no-v-html -->
        <!-- eslint-enable vue/no-v-text-v-html-on-component -->
        <v-card-actions>
          <v-btn
            v-if="showHelpInfo?.help_link"
            @click="openLink(showHelpInfo!.help_link!)"
          >
            {{ $t("read_more") }}
          </v-btn>
          <v-spacer />
          <v-btn color="primary" @click="showHelpInfo = undefined">
            {{ $t("close") }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </section>
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
import ConfigEntryField from "./ConfigEntryField.vue";
import { nanoid } from "nanoid";
import { markdownToHtml } from "@/helpers/utils";
import { useI18n } from "vue-i18n";

// global refs
const router = useRouter();
const config = ref<ProviderConfig>();
const sessionId = nanoid(11);
const loading = ref(false);
const showAuthLink = ref(false);

// props
const props = defineProps<{
  instanceId?: string;
}>();

const showPasswordValues = ref(false);
const showHelpInfo = ref<ConfigEntry>();

// helper functions
const isNullOrUndefined = (value: unknown) => {
  return value === null || value === undefined;
};

const isVisible = (entry: ConfigEntry) => {
  return !entry.hidden;
};

const isDisabled = (entry: ConfigEntry) => {
  if (!config.value) return false;
  if (!isNullOrUndefined(entry.depends_on)) {
    const allEntries = Object.values(config.value.values);
    const dependentEntry = allEntries.find((x) => x.key == entry.depends_on);
    if (!dependentEntry) return false;

    const dependentValue = dependentEntry.value;

    if (!isNullOrUndefined(entry.depends_on_value)) {
      return dependentValue != entry.depends_on_value;
    }

    if (!isNullOrUndefined(entry.depends_on_value_not)) {
      return dependentValue == entry.depends_on_value_not;
    }

    return !dependentValue;
  }
  return false;
};

// computed properties
const genericConfigEntries = computed(() => {
  if (!config.value) return [];
  return Object.values(config.value.values).filter(
    (entry) =>
      (!entry.category || entry.category === "generic") && isVisible(entry),
  );
});

const nonGenericConfigEntries = computed(() => {
  if (!config.value) return [];
  return Object.values(config.value.values).filter(
    (entry) => entry.category && entry.category !== "generic",
  );
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

// methods
const onSubmit = async function (values: Record<string, ConfigValueType>) {
  // save new provider config
  loading.value = true;
  values["enabled"] = config.value!.enabled;
  values["name"] = config.value!.name || null;
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

const openLink = function (url: string) {
  const a = document.createElement("a");
  a.setAttribute("href", url);
  a.setAttribute("target", "_blank");
  a.click();
};

const hasDescriptionOrHelpLink = function (conf_entry: ConfigEntry) {
  const { t } = useI18n();
  return (
    (
      t(
        `settings.${conf_entry?.key}.description`,
        conf_entry.description || " ",
      ) ||
      conf_entry.help_link ||
      " "
    )?.length > 1
  );
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

.header-title {
  font-size: 1.25rem;
  font-weight: 600;
  margin: 0 0 8px 0;
  color: rgb(var(--v-theme-on-surface));
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

.settings-card {
  border: 1px solid rgba(var(--v-theme-on-surface), 0.12);
  border-radius: 12px;
  overflow: hidden;
}

.settings-card-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 20px;
  background: rgba(var(--v-theme-primary), 0.08);
  border-bottom: 1px solid rgba(var(--v-theme-primary), 0.12);
}

.settings-card-header .v-icon {
  color: rgb(var(--v-theme-primary));
}

.settings-card-title {
  font-size: 1.1rem;
  font-weight: 600;
  margin: 0;
  color: rgb(var(--v-theme-primary));
}

.settings-card-content {
  padding: 20px;
}

/* Config entry row */
.config-entry {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin-top: 12px;
}

.config-entry:first-child {
  margin-top: 0;
}

/* Help button */
.help-btn {
  flex-shrink: 0;
  margin-top: 8px;
  opacity: 0.6;
  transition: opacity 0.2s ease;
}

.help-btn:hover {
  opacity: 1;
}

/* Add extra top margin for entries that follow a checkbox (which is shorter) */
.config-entry:has(.v-checkbox) + .config-entry:has(.v-text-field),
.config-entry:has(.v-checkbox) + .config-entry:has(.v-select),
.config-entry:has(.v-checkbox) + .config-entry:has(.v-slider),
.config-entry:has(.v-checkbox) + .config-entry:has(.v-combobox) {
  margin-top: 16px;
}

@media (max-width: 600px) {
  .header-content {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
