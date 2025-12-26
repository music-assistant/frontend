<template>
  <v-container fluid class="pa-6">
    <v-row>
      <v-col cols="12" md="8" offset-md="2">
        <div v-if="api.providerManifests[domain]" class="mb-6">
          <v-card>
            <v-card-text class="d-flex gap-4 align-start">
              <provider-icon :domain="domain" :size="48" class="flex-shrink-0" />
              <div>
                <h2 class="text-h5 font-weight-bold mb-2">
                  {{
                    $t("settings.setup_provider", [
                      api.providerManifests[domain].name,
                    ])
                  }}
                </h2>
                <p class="text-body-2 text-medium-emphasis mb-3">
                  {{ api.providerManifests[domain].description }}
                </p>
                <div
                  v-if="api.providerManifests[domain].codeowners.length"
                  class="text-caption text-medium-emphasis"
                  v-html="
                    markdownToHtml(
                      getAuthorsMarkdown(api.providerManifests[domain].codeowners),
                    )
                  "
                ></div>
                <div
                  v-if="api.providerManifests[domain].credits.length"
                  class="text-caption text-medium-emphasis"
                  v-html="
                    markdownToHtml(
                      getCreditsMarkdown(api.providerManifests[domain].credits),
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
              :config-entries="config_entries"
              :disabled="false"
              @submit="onSubmit"
              @action="onAction"
            />
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

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
import { ref, onMounted, onBeforeUnmount } from "vue";
import { nanoid } from "nanoid";
import { useRouter } from "vue-router";
import { api } from "@/plugins/api";
import {
  ConfigValueType,
  ConfigEntry,
  EventType,
  EventMessage,
} from "@/plugins/api/interfaces";
import EditConfig from "./EditConfig.vue";
import ProviderIcon from "@/components/ProviderIcon.vue";
import { watch } from "vue";
import { markdownToHtml } from "@/helpers/utils";
import { useI18n } from "vue-i18n";

// global refs
const router = useRouter();
const config_entries = ref<ConfigEntry[]>([]);
const sessionId = nanoid(11);
const loading = ref(false);
const showAuthLink = ref(false);

// props
const props = defineProps<{
  domain: string;
}>();

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
  () => props.domain,
  async (val) => {
    if (val) {
      // fetch initial config entries (without any action) but pass along our session id
      config_entries.value = await api.getProviderConfigEntries(
        props.domain,
        undefined,
        undefined,
        {
          session_id: sessionId,
        },
      );
    }
  },
  { immediate: true },
);

// methods
const onSubmit = async function (values: Record<string, ConfigValueType>) {
  // save new provider config
  loading.value = true;
  api
    .saveProviderConfig(props.domain, values)
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
  for (const entry of config_entries.value) {
    if (entry.value !== undefined && values[entry.key] == undefined) {
      values[entry.key] = entry.value;
    }
  }
  // ensure the session id is passed along (for auth actions)
  values["session_id"] = sessionId;
  api
    .getProviderConfigEntries(props.domain, undefined, action, values)
    .then((entries) => {
      config_entries.value = entries;
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
</script>

<style scoped>
.gap-4 {
  gap: 16px;
}
</style>
