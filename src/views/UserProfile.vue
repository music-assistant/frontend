<template>
  <div
    class="mx-auto flex w-full max-w-2xl flex-col gap-6 px-5 py-6 max-sm:p-3"
  >
    <ProfileIdentityCard />
    <ThemeLanguageCard />
    <SettingsLinkRows :rows="rows" test-id-prefix="profile" />
  </div>
</template>

<script setup lang="ts">
import { MonitorSmartphone, PanelsTopLeft, ShieldCheck } from "@lucide/vue";
import { computed, markRaw } from "vue";

import ProfileIdentityCard from "@/components/profile/ProfileIdentityCard.vue";
import ThemeLanguageCard from "@/components/profile/ThemeLanguageCard.vue";
import SettingsLinkRows, {
  type SettingsRow,
} from "@/components/settings/SettingsLinkRows.vue";
import { $t } from "@/plugins/i18n";

/**
 * The profile of the signed-in user: who they are, their theme and language,
 * and the rows leading to the rest of their settings.
 */

const rows = computed<SettingsRow[]>(() => [
  {
    key: "interface",
    icon: markRaw(PanelsTopLeft),
    label: $t("auth.profile_pages.interface"),
    description: $t("auth.profile_pages.interface_description"),
    to: { name: "profileinterface" },
  },
  {
    key: "device",
    icon: markRaw(MonitorSmartphone),
    label: $t("auth.profile_pages.device"),
    description: $t("auth.profile_pages.device_description"),
    to: { name: "profiledevice" },
  },
  {
    key: "security",
    icon: markRaw(ShieldCheck),
    label: $t("auth.profile_pages.security"),
    description: $t("auth.profile_pages.security_description"),
    to: { name: "profilesecurity" },
  },
]);
</script>
