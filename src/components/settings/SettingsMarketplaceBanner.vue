<template>
  <RouterLink
    :to="section.route"
    class="group rounded-(--radius-xl) text-inherit no-underline outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
    data-testid="settings-marketplace-banner"
  >
    <Card
      class="flex-row items-center gap-4 rounded-(--radius-xl) card-hover px-5 py-5 max-md:gap-3 max-md:px-4 max-md:py-4"
    >
      <SettingsIcon
        :icon="section.icon"
        :color="section.color"
        class="size-12 max-md:size-10"
      />
      <div class="min-w-0 flex-1">
        <h3 class="m-0 text-lg leading-snug font-semibold max-md:text-base">
          {{ t(section.label) }}
        </h3>
        <p class="m-0 mt-0.5 text-sm leading-normal text-muted-foreground">
          {{ t(section.description) }}
        </p>
      </div>
      <!-- the whole banner is the link, so this only looks like a button -->
      <span :class="buttonVariants({ size: 'sm' })">
        {{ t("browse") }}
      </span>
    </Card>
  </RouterLink>
</template>

<script setup lang="ts">
import SettingsIcon from "@/components/settings/SettingsIcon.vue";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { SettingsMenuPage } from "@/helpers/settings_sections";
import { useI18n } from "vue-i18n";
import { RouterLink } from "vue-router";

/**
 * The Marketplace as a banner across the settings page, inviting to browse it.
 */
defineProps<{
  section: SettingsMenuPage;
}>();

const { t } = useI18n();
</script>
