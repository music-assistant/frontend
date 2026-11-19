<template>
  <div class="space-y-6 p-6">
    <SettingsPageHeader page="network" />
    <SettingsLinkRows :rows="rows" test-id-prefix="network" />
    <SettingsPageForm
      page="network"
      :custom-settings="SERVER_URL_SETTINGS"
      @reset="urlCard?.reset()"
    >
      <template #custom="{ entries: [baseUrl, externalUrl], setValue }">
        <ServerUrlsCard
          ref="urlCard"
          :base-url="baseUrl"
          :external-url="externalUrl"
          @update:value="setValue"
        />
      </template>
    </SettingsPageForm>
  </div>
</template>

<script setup lang="ts">
import SettingsLinkRows, {
  type SettingsRow,
} from "@/components/settings/SettingsLinkRows.vue";
import SettingsPageForm from "@/components/settings/SettingsPageForm.vue";
import SettingsPageHeader from "@/components/settings/SettingsPageHeader.vue";
import type { SettingsField } from "@/helpers/settings_form";
import { coreOwner, WEBSERVER_DOMAIN } from "@/helpers/settings_pages";
import { sectionPages } from "@/helpers/settings_sections";
import { api } from "@/plugins/api";
import { authManager } from "@/plugins/auth";
import { $t } from "@/plugins/i18n";
import { computed, markRaw, ref } from "vue";
import ServerUrlsCard from "./ServerUrlsCard.vue";

/**
 * How Music Assistant is reached on the network: remote access, the addresses
 * and ports of the server, and the discovery of devices.
 */

// the URLs the server is reached at, edited with a card of their own
const SERVER_URL_SETTINGS: readonly SettingsField[] = [
  { owner: coreOwner(WEBSERVER_DOMAIN), key: "base_url" },
  { owner: coreOwner(WEBSERVER_DOMAIN), key: "external_url" },
];

const urlCard = ref<InstanceType<typeof ServerUrlsCard>>();

// the page below is remote access, which says whether it is on
const rows = computed<SettingsRow[]>(() =>
  sectionPages("network", (scope) => authManager.hasScope(scope)).map(
    (page) => ({
      key: page.key,
      icon: markRaw(page.icon),
      label: $t(page.label),
      description: $t(page.description),
      state: $t(api.serverInfo.value?.has_remote_access ? "on" : "off"),
      to: page.route,
    }),
  ),
);
</script>
