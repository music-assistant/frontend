<template>
  <div class="p-6">
    <!-- the form loads its page once, so another page gets a form of its own -->
    <SettingsPageForm :key="page" :page="page" />
  </div>
</template>

<script setup lang="ts">
import SettingsPageForm from "@/components/settings/SettingsPageForm.vue";
import type { SettingsPageId } from "@/helpers/settings_pages";

/**
 * A settings page that is only the form of its settings.
 */
defineProps<{
  page: SettingsPageId;
}>();
</script>
