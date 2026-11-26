<template>
  <DropdownMenu>
    <DropdownMenuTrigger as-child>
      <Button
        variant="outline"
        class="px-3 max-md:w-full"
        data-testid="catalog-section-picker"
      >
        <!-- the menu takes its name from this button, so it says what it is for -->
        <span class="sr-only" data-testid="catalog-section-picker-purpose">{{
          $t("settings.catalog.choose_section")
        }}</span>
        <component :is="current.icon" aria-hidden="true" />
        <span class="font-semibold">{{ current.label }}</span>
        <span
          v-if="current.count !== null"
          class="text-[13px] font-normal text-muted-foreground"
          >{{ current.count }}</span
        >
        <span class="relative inline-flex max-md:ml-auto">
          <ChevronDown class="text-muted-foreground" aria-hidden="true" />
          <span
            v-if="updatesHidden"
            :class="ACTIVE_DOT_CLASS"
            aria-hidden="true"
            data-testid="catalog-updates-dot"
          ></span>
        </span>
        <span v-if="updatesHidden" class="sr-only">{{ updatesWaiting }}</span>
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="start" class="min-w-64">
      <DropdownMenuRadioGroup :model-value="tab" @update:model-value="select">
        <template v-for="section in sections" :key="section.tab">
          <!-- what is set up is a view of its own rather than more to add -->
          <DropdownMenuSeparator v-if="section.tab === CATALOG_INSTALLED_TAB" />
          <DropdownMenuRadioItem
            :value="section.tab"
            class="gap-3"
            data-testid="catalog-section"
            :data-tab="section.tab"
          >
            <template #indicator-icon>
              <Check class="size-3.5" />
            </template>
            <component
              :is="section.icon"
              class="text-muted-foreground"
              aria-hidden="true"
            />
            <span class="min-w-0 flex-1 truncate">{{ section.label }}</span>
            <Badge
              v-if="section.tab === CATALOG_INSTALLED_TAB && updateCount"
              class="h-5 min-w-5 rounded-full px-1.5"
              :aria-label="updatesWaiting"
              data-testid="catalog-updates-count"
            >
              {{ updateCount }}
            </Badge>
            <span
              v-if="section.count !== null"
              class="text-[13px] text-muted-foreground"
              >{{ section.count }}</span
            >
          </DropdownMenuRadioItem>
        </template>
      </DropdownMenuRadioGroup>
    </DropdownMenuContent>
  </DropdownMenu>
</template>

<script setup lang="ts">
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ACTIVE_DOT_CLASS } from "@/constants";
import {
  CATALOG_DISCOVER_TAB,
  CATALOG_INSTALLED_TAB,
  type CatalogTab,
  type CatalogTypeCount,
} from "@/helpers/provider_catalog";
import { ProviderType } from "@/plugins/api/interfaces";
import { $t } from "@/plugins/i18n";
import {
  AudioWaveform,
  Check,
  ChevronDown,
  Music,
  PackageCheck,
  Puzzle,
  Sparkles,
  Speaker,
  Tags,
} from "@lucide/vue";
import { type Component, computed } from "vue";

interface Props {
  // the section shown
  tab: CatalogTab;
  // the types with what each lists, in the order they are offered
  types: CatalogTypeCount[];
  // how many are set up
  installedCount: number;
  // the updates waiting in the community catalog
  updateCount: number;
}

interface Section {
  tab: CatalogTab;
  label: string;
  icon: Component;
  // none for Discover, which is no list
  count: number | null;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  (e: "select", tab: CatalogTab): void;
}>();

const SECTION_ICONS: Record<CatalogTab, Component> = {
  [CATALOG_DISCOVER_TAB]: Sparkles,
  [ProviderType.MUSIC]: Music,
  [ProviderType.PLAYER]: Speaker,
  [ProviderType.METADATA]: Tags,
  [ProviderType.PLUGIN]: Puzzle,
  [ProviderType.AUDIO_ANALYSIS]: AudioWaveform,
  [CATALOG_INSTALLED_TAB]: PackageCheck,
};

const sections = computed<Section[]>(() => [
  {
    tab: CATALOG_DISCOVER_TAB,
    label: $t("settings.catalog.discover"),
    icon: SECTION_ICONS[CATALOG_DISCOVER_TAB],
    count: null,
  },
  ...props.types.map(({ type, count }) => ({
    tab: type.type,
    label: $t(type.label),
    icon: SECTION_ICONS[type.type],
    count,
  })),
  {
    tab: CATALOG_INSTALLED_TAB,
    label: $t("settings.catalog.installed"),
    icon: SECTION_ICONS[CATALOG_INSTALLED_TAB],
    count: props.installedCount,
  },
]);

const current = computed(
  () =>
    sections.value.find((section) => section.tab === props.tab) ??
    sections.value[0],
);

// the updates show on Installed, so elsewhere the picker points them out
const updatesHidden = computed(
  () => props.updateCount > 0 && props.tab !== CATALOG_INSTALLED_TAB,
);

const updatesWaiting = computed(() =>
  $t("settings.catalog.community.updates_waiting", props.updateCount, {
    named: { count: props.updateCount },
  }),
);

const select = (tab: unknown) => {
  if (typeof tab === "string") emit("select", tab as CatalogTab);
};
</script>
