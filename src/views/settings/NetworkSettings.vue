<template>
  <div class="space-y-6 p-6">
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
import type { SettingsField } from "@/helpers/settings_form";
import { coreOwner, WEBSERVER_DOMAIN } from "@/helpers/settings_pages";
import { api } from "@/plugins/api";
import { Scope } from "@/plugins/api/interfaces";
import { authManager } from "@/plugins/auth";
import { $t } from "@/plugins/i18n";
import { CloudCog } from "@lucide/vue";
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

const rows = computed<SettingsRow[]>(() =>
  authManager.hasScope(Scope.SYSTEM_MANAGE)
    ? [
        {
          key: "remote_access",
          icon: markRaw(CloudCog),
          label: $t("settings.remote_access"),
          description: $t("settings.remote_access_description"),
          state: $t(api.serverInfo.value?.has_remote_access ? "on" : "off"),
          to: { name: "remoteaccesssettings" },
        },
      ]
    : [],
);
</script>
