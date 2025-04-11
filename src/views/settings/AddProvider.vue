<template>
  <section>
    <v-card-text>
      <!-- Header with provider details -->
      <div v-if="api.providerManifests[domain]" style="margin-left: -5px; margin-right: -5px">
        <v-card-title>
          {{ $t("settings.setup_provider", [api.providerManifests[domain].name]) }}
        </v-card-title>
        <v-card-subtitle v-html="markdownToHtml(api.providerManifests[domain].description)" /><br />
        <v-card-subtitle v-if="api.providerManifests[domain].codeowners.length" v-html="markdownToHtml(
          getAuthorsMarkdown(api.providerManifests[domain].codeowners),
        )" />
        <v-card-subtitle v-if="api.providerManifests[domain].documentation">
          <b>{{ $t("settings.need_help_setup_provider") }}</b>&nbsp;
          <a @click="openLinkInNewTab(api.providerManifests[domain].documentation!)">
            {{ $t("settings.check_docs") }}
          </a>
        </v-card-subtitle>
      </div>
      <br />
      <v-divider />
      <br />
      <br />
      <!-- Config editor component -->
      <edit-config :config-entries="config_entries" :disabled="false" @submit="onSubmit" @action="onAction" />
    </v-card-text>

    <!-- Overlay during authentication -->
    <v-overlay v-model="overlayVisible" scrim persistent class="d-flex align-center justify-center">
      <v-card class="pa-4 bg-surface text-white" max-width="400" elevation="12" rounded="xl">
        <div class="d-flex justify-space-between align-center mb-2">
          <v-card-title class="text-h6 pa-0">{{ $t("settings.authenticating") }}</v-card-title>
          <v-btn icon variant="text" size="small" @click="handleManualCancel" title="Close">
            <v-icon class="text-on-surface">mdi-close</v-icon>
          </v-btn>
        </div>

        <v-card-text class="text-body-2">
          {{ $t("settings.auth_popup_message") }}<br />
          {{ $t("settings.auth_if_popup_does_not_appear") }}
          <a id="auth" href="" target="_blank" class="font-weight-bold text-purple-lighten-2">
            {{ $t("settings.click_here") }}
          </a>.
        </v-card-text>
      </v-card>
    </v-overlay>

    <!-- Snackbar for error messages -->
    <v-snackbar v-model="snackbar.visible" :color="snackbar.color" timeout="6000" location="bottom">
      {{ snackbar.message }}
    </v-snackbar>
  </section>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch, nextTick } from "vue";
import { nanoid } from "nanoid";
import { useRouter } from "vue-router";
import { api } from "@/plugins/api";
import { ConfigValueType, ConfigEntry, EventType, EventMessage } from "@/plugins/api/interfaces";
import EditConfig from "./EditConfig.vue";
import { openLinkInNewTab, markdownToHtml } from "@/helpers/utils";
import { useI18n } from "vue-i18n";  // Import useI18n correctly

const { t } = useI18n();  // Make sure to destructure `t()` from useI18n

const router = useRouter();
const config_entries = ref<ConfigEntry[]>([]);
const sessionId = ref("");
const activeSessionId = ref<string | null>(null);
const overlayVisible = ref(false);

const snackbar = ref({ visible: false, message: "", color: "error" });

// Show error message in the snackbar
function showSnackbar(message: string, color: string = "error") {
  snackbar.value.message = message;
  snackbar.value.color = color;
  snackbar.value.visible = true;
}

// Timers for auth session
let showLinkTimer: ReturnType<typeof setTimeout> | null = null;
let authTimeoutTimer: ReturnType<typeof setTimeout> | null = null;

// Props to handle the domain
const props = defineProps<{ domain: string }>();

// Cancel authentication process
const cancelAuth = () => {
  console.debug("[Auth] cancelAuth called");
  overlayVisible.value = false;
  activeSessionId.value = null;

  if (showLinkTimer) clearTimeout(showLinkTimer);
  if (authTimeoutTimer) clearTimeout(authTimeoutTimer);

  showLinkTimer = null;
  authTimeoutTimer = null;

  api.abortAllCommands();
};

// Manual cancel handler
const handleManualCancel = () => {
  cancelAuth();
  showSnackbar(t("settings.auth_aborted")); // Using t() instead of $t()
};

// Generate session ID
const generateSessionId = () => {
  sessionId.value = nanoid(11);
};

onMounted(() => {
  const unsub = api.subscribe(EventType.AUTH_SESSION, (evt: EventMessage) => {
    if (evt.object_id !== activeSessionId.value) return;

    const url = evt.data as string;

    if (showLinkTimer) clearTimeout(showLinkTimer);
    if (authTimeoutTimer) clearTimeout(authTimeoutTimer);

    // Trigger popup after short delay
    showLinkTimer = setTimeout(async () => {
      await nextTick();
      const a = document.getElementById("auth") as HTMLAnchorElement;
      if (a && url) {
        a.setAttribute("href", url);
        a.click();
      }

      // Show overlay after popup trigger
      setTimeout(() => {
        overlayVisible.value = true;
      }, 750);
    }, 250);

    // Set timeout for authentication callback
    authTimeoutTimer = setTimeout(() => {
      if (overlayVisible.value) {
        console.warn("[Auth] Timeout reached – no callback received");
        api.abortAllCommands("auth_timeout"); // Abort with timeout error
      }
    }, 60000);
  });

  onBeforeUnmount(() => {
    unsub();
    cancelAuth();
  });
});

watch(
  () => props.domain,
  async (val) => {
    if (val) {
      generateSessionId();
      activeSessionId.value = sessionId.value;
      config_entries.value = await api.getProviderConfigEntries(
        props.domain,
        undefined,
        undefined,
        { session_id: sessionId.value },
      );
    }
  },
  { immediate: true },
);

// Handle form submission
const onSubmit = async function (values: Record<string, ConfigValueType>) {
  overlayVisible.value = true;
  try {
    await api.saveProviderConfig(props.domain, values);
    router.push({ name: "providersettings" });
  } catch (err) {
    const detail = typeof err === "object" && err?.details ? err.details : err;

    // Handle different error types
    if (detail === "auth_aborted") {
      console.debug("[Auth] Submit aborted by user.");
      showSnackbar(t("settings.auth_aborted"), "error"); // Using t() for translation
    } else if (detail === "auth_timeout") {
      console.debug("[Auth] Authentication timeout.");
      showSnackbar(t("settings.auth_timeout"), "error"); // Using t() for translation
    } else {
      console.error("[Auth] Submit error:", err);
      showSnackbar(detail?.message || String(detail), "error");
    }
  } finally {
    overlayVisible.value = false;
  }
};

// Handle actions like fetching or submitting new configuration data
const onAction = async function (action: string, values: Record<string, ConfigValueType>) {
  cancelAuth();
  generateSessionId();
  activeSessionId.value = sessionId.value;

  overlayVisible.value = true;

  for (const entry of config_entries.value) {
    if (entry.value !== undefined && values[entry.key] === undefined) {
      values[entry.key] = entry.value;
    }
  }

  values["session_id"] = sessionId.value;

  try {
    const entries = await api.getProviderConfigEntries(
      props.domain,
      undefined,
      action,
      values,
    );
    config_entries.value = entries;
  } catch (err) {
    const detail = typeof err === "object" && err?.details ? err.details : err;
    if (detail === "auth_aborted") {
      showSnackbar(t("settings.auth_aborted"), "error"); // Using t() for translation
    } else if (detail === "auth_timeout") {
      showSnackbar(t("settings.auth_timeout"), "error"); // Using t() for translation
    } else {
      showSnackbar(String(detail), "error");
    }
  } finally {
    overlayVisible.value = false;
  }
};

// Generate markdown for authors
const getAuthorsMarkdown = function (authors: string[]) {
  const allAuthors: string[] = [];
  for (const author of authors) {
    if (author.includes("@")) {
      allAuthors.push(
        `[${author.replace("@", "")}](https://github.com/${author.replace("@", "")})`,
      );
    } else {
      allAuthors.push(author);
    }
  }
  return `**${t("settings.codeowners")}**: ` + allAuthors.join(" / ");
};
</script>


<style scoped></style>
