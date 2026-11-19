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
import { computed, markRaw } from "vue";

import ProfileIdentityCard from "@/components/profile/ProfileIdentityCard.vue";
import ThemeLanguageCard from "@/components/profile/ThemeLanguageCard.vue";
import SettingsLinkRows, {
  type SettingsRow,
} from "@/components/settings/SettingsLinkRows.vue";
import { sectionPages } from "@/helpers/settings_sections";
import { authManager } from "@/plugins/auth";
import { $t } from "@/plugins/i18n";

/**
 * The profile of the signed-in user: who they are, their theme and language,
 * and the rows leading to the rest of their settings.
 */

const rows = computed<SettingsRow[]>(() =>
  sectionPages("profile", (scope) => authManager.hasScope(scope)).map(
    (page) => ({
      key: page.key,
      icon: markRaw(page.icon),
      label: $t(page.label),
      description: $t(page.description),
      to: page.route,
    }),
  ),
);
</script>
