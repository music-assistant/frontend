<template>
  <Alert
    v-if="api.serverInfo.value?.unsupported_install"
    variant="destructive"
    role="alert"
  >
    <TriangleAlert />
    <AlertTitle>{{ $t("settings.unsupported_install_title") }}</AlertTitle>
    <AlertDescription>
      <p>{{ $t("settings.unsupported_install_description") }}</p>
      <a
        :href="installationDocsUrl"
        target="_blank"
        rel="noopener noreferrer"
        class="font-medium underline underline-offset-4"
      >
        {{ $t("settings.unsupported_install_link") }}
      </a>
    </AlertDescription>
  </Alert>
</template>

<script setup lang="ts">
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { getExternalLinkUrl } from "@/helpers/utils";
import { api } from "@/plugins/api";
import { $t } from "@/plugins/i18n";
import { TriangleAlert } from "@lucide/vue";
import { computed } from "vue";

const INSTALLATION_DOCS_URL = "https://music-assistant.io/installation/";

const installationDocsUrl = computed(() =>
  getExternalLinkUrl(INSTALLATION_DOCS_URL),
);
</script>
