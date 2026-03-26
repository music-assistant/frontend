<template>
  <section class="add-provider-details">
    <div v-if="api.providerManifests[domain]">
      <!-- Header card -->
      <Card class="mb-4">
        <div class="header-content">
          <div class="header-icon">
            <provider-icon :domain="domain" :size="48" />
          </div>
          <div class="header-info">
            <h2 class="header-title">
              {{
                $t("settings.setup_provider", [
                  api.providerManifests[domain].name,
                ])
              }}
            </h2>
            <p class="header-description">
              {{ api.providerManifests[domain].description }}
            </p>
            <div
              v-if="api.providerManifests[domain].codeowners.length"
              class="header-authors"
              v-html="
                markdownToHtml(
                  getAuthorsMarkdown(api.providerManifests[domain].codeowners),
                )
              "
            ></div>
            <div
              v-if="api.providerManifests[domain].credits.length"
              class="header-authors"
              v-html="
                markdownToHtml(
                  getCreditsMarkdown(api.providerManifests[domain].credits),
                )
              "
            ></div>
          </div>
        </div>
      </Card>
    </div>

    <edit-config
      :config-entries="config_entries"
      :disabled="false"
      @submit="onSubmit"
      @action="onAction"
    />
    <div
      v-if="loading"
      class="fixed inset-0 z-50 flex items-center justify-center bg-background/80"
    >
      <Card v-if="showAuthLink" class="bg-white p-6">
        <h3 class="text-lg font-semibold mb-2">Authenticating...</h3>
        <p class="text-sm text-muted-foreground mb-4">
          A new tab/popup should be opened where you can authenticate
        </p>
        <a id="auth" href="" target="_blank">
          <Button variant="outline">Click here if the popup did not open</Button>
        </a>
      </Card>
      <Spinner v-else class="h-16 w-16" />
    </div>
  </section>
</template>

<script setup lang="ts">
import ProviderIcon from "@/components/ProviderIcon.vue";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { markdownToHtml } from "@/helpers/utils";
import { api } from "@/plugins/api";
import {
  ConfigValueType,
  ConfigEntry,
  EventType,
  EventMessage,
} from "@/plugins/api/interfaces";
import { nanoid } from "nanoid";
import { ref, onMounted, onBeforeUnmount, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useRouter } from "vue-router";
import EditConfig from "./EditConfig.vue";

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
      const providerType = api.providerManifests[props.domain]?.type;
      if (providerType) {
        router.push({
          name: "providersettings",
          query: { types: providerType },
        });
      } else {
        // Fallback: navigate without a type filter if the manifest or type is unavailable
        router.push({ name: "providersettings" });
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

const onAction = async function (
  action: string,
  values: Record<string, ConfigValueType>,
  _immediateApply: boolean,
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
.add-provider-details {
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

.header-title {
  font-size: 1.25rem;
  font-weight: 600;
  margin: 0 0 8px 0;
  color: hsl(var(--foreground));
}

.header-description {
  font-size: 0.875rem;
  color: hsl(var(--muted-foreground));
  margin: 0 0 12px 0;
  line-height: 1.5;
}

.header-authors {
  font-size: 0.813rem;
  color: hsl(var(--muted-foreground));
}
</style>

<style>
.header-authors a {
  color: hsl(var(--primary));
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
