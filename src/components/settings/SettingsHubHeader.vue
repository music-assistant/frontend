<template>
  <header v-if="heading" data-testid="settings-hub-header">
    <h1 class="m-0 text-2xl leading-tight font-semibold">
      {{ $t(heading.label) }}
    </h1>
    <!-- a phone keeps the header to the title -->
    <p class="m-0 mt-1 text-sm text-muted-foreground max-md:hidden">
      {{ $t(heading.description) }}
    </p>
  </header>
</template>

<script setup lang="ts">
import { settingsHeading } from "@/helpers/settings_sections";
import { $t } from "@/plugins/i18n";
import { computed } from "vue";

/**
 * The header of a hub: its title and description, as its card on the settings
 * page or its tile gives them.
 */
const props = defineProps<{
  // the name of the settings section, or the key of a page below one
  name: string | undefined;
}>();

const heading = computed(() => settingsHeading(props.name));
</script>
