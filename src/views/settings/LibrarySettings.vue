<template>
  <div class="space-y-6 p-6">
    <SettingsLinkRows :rows="rows" test-id-prefix="library" />
    <SettingsPageForm page="library" />
  </div>
</template>

<script setup lang="ts">
import GenreIcon from "@/components/icons/GenreIcon.vue";
import SettingsLinkRows, {
  type SettingsRow,
} from "@/components/settings/SettingsLinkRows.vue";
import SettingsPageForm from "@/components/settings/SettingsPageForm.vue";
import { Scope } from "@/plugins/api/interfaces";
import { authManager } from "@/plugins/auth";
import { $t } from "@/plugins/i18n";
import { HardDrive } from "@lucide/vue";
import { computed, markRaw } from "vue";

/**
 * The options of the music library: where the music is, which source plays a
 * track, the genres and the maintenance of the library.
 */

const rows = computed<SettingsRow[]>(() => {
  const items: SettingsRow[] = [];
  if (authManager.hasScope(Scope.CONFIG_PROVIDERS_WRITE)) {
    items.push({
      key: "music_locations",
      icon: markRaw(HardDrive),
      label: $t("settings.storage.music_locations"),
      description: $t("settings.storage.description"),
      to: { name: "storagesettings" },
    });
  }
  if (authManager.hasScope(Scope.LIBRARY_MANAGE)) {
    items.push({
      key: "genres",
      icon: markRaw(GenreIcon),
      label: $t("genres"),
      description: $t("settings.genre_management_description"),
      to: { name: "genremanagement" },
    });
  }
  return items;
});
</script>
