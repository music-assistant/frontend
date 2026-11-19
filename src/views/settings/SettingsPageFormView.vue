<template>
  <div class="flex flex-col gap-6 p-6 max-md:gap-5 max-md:px-3 max-md:py-4">
    <SettingsPageHeader :page="page" />
    <!-- the form loads its page once, so another page gets a form of its own -->
    <SettingsPageForm :key="page" :page="page" />
  </div>
</template>

<script setup lang="ts">
import SettingsPageForm from "@/components/settings/SettingsPageForm.vue";
import SettingsPageHeader from "@/components/settings/SettingsPageHeader.vue";
import type { SettingsPageId } from "@/helpers/settings_pages";

/**
 * A settings page that is only the form of its settings.
 */
defineProps<{
  page: SettingsPageId;
}>();
</script>
