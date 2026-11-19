<template>
  <div v-if="viewMode === 'card'" class="flex flex-col gap-4">
    <SettingsMarketplaceBanner v-if="marketplace" :section="marketplace" />
    <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
      <SettingsSectionLink
        v-for="section in featuredSections"
        :key="section.key"
        :section="section"
        variant="featured"
      />
    </div>
    <div
      class="grid grid-cols-1 gap-3 md:grid-cols-[repeat(auto-fill,minmax(240px,1fr))] md:gap-4 min-[960px]:grid-cols-2 xl:grid-cols-3"
    >
      <SettingsSectionLink
        v-for="section in regularSections"
        :key="section.key"
        :section="section"
        variant="card"
      />
    </div>
  </div>

  <nav v-else :aria-label="t('settings.settings')">
    <ItemGroup>
      <SettingsSectionLink
        v-for="section in sections"
        :key="section.key"
        :section="section"
        variant="list"
      />
    </ItemGroup>
  </nav>
</template>

<script setup lang="ts">
import SettingsMarketplaceBanner from "@/components/settings/SettingsMarketplaceBanner.vue";
import SettingsSectionLink from "@/components/settings/SettingsSectionLink.vue";
import { ItemGroup } from "@/components/ui/item";
import type { SettingsMenuPage } from "@/helpers/settings_sections";
import { computed } from "vue";
import { useI18n } from "vue-i18n";

/**
 * The menu of the settings page. As cards, the Marketplace leads as a banner
 * and Music and Players follow as featured cards; as a list, every section in
 * its order.
 */
const props = defineProps<{
  // the sections the current user may open, in display order
  sections: readonly SettingsMenuPage[];
  viewMode: "list" | "card";
}>();

const MARKETPLACE_SECTION = "catalog";
const FEATURED_SECTIONS = ["music", "players"];

const { t } = useI18n();

const marketplace = computed(() =>
  props.sections.find((section) => section.key === MARKETPLACE_SECTION),
);

const featuredSections = computed(() =>
  props.sections.filter((section) => FEATURED_SECTIONS.includes(section.key)),
);

const regularSections = computed(() =>
  props.sections.filter(
    (section) =>
      section.key !== MARKETPLACE_SECTION &&
      !FEATURED_SECTIONS.includes(section.key),
  ),
);
</script>
