<template>
  <Dialog :open="props.show" @update:open="handleOpenChange">
    <!-- a fixed height keeps the dialog still while the search narrows the list;
         the sm: max width has to be restated or the 512px default of
         DialogContent caps it -->
    <DialogContent
      class="flex h-[calc(100dvh-2rem)] flex-col gap-0 p-0 sm:h-[85dvh] sm:max-w-[calc(100%-2rem)] lg:max-w-[900px]"
      @open-auto-focus="preventOnScreenKeyboardOnOpen"
    >
      <DialogHeader class="border-b px-5 py-4 pr-12">
        <DialogTitle>{{ dialogTitle }}</DialogTitle>
      </DialogHeader>

      <!-- the search and the filter stay put; only the list below scrolls -->
      <div class="flex flex-wrap items-center gap-2 px-5 py-4">
        <SearchInput
          v-model="searchQuery"
          :placeholder="$t('search')"
          clearable
          class="min-w-48 flex-1"
        />
        <!-- on a phone the filter only crowds the search row -->
        <FacetedFilter
          v-if="!isPhone"
          v-model="selectedProviderStages"
          :title="$t('settings.stage.label')"
          :options="providerStageOptions"
        />
      </div>

      <div
        class="min-h-0 flex-1 overflow-y-auto px-5 pb-4"
        data-testid="provider-list"
      >
        <ItemGroup v-if="filteredProviders.length > 0" class="gap-2">
          <Item
            v-for="provider in filteredProviders"
            :key="provider.domain"
            variant="outline"
            size="sm"
            class="hover:bg-accent/50 cursor-pointer"
            data-testid="provider-row"
            @click="addProvider(provider)"
          >
            <ItemMedia>
              <ProviderIcon :domain="provider.domain" :size="40" />
            </ItemMedia>
            <ItemContent>
              <ItemTitle class="flex-wrap">
                <!-- the name is the focusable control; the row itself only follows the pointer -->
                <button
                  type="button"
                  class="cursor-pointer text-left"
                  data-testid="provider-open"
                  @click.stop="addProvider(provider)"
                >
                  {{ provider.name }}
                </button>
                <ProviderStageBadge :stage="provider.stage" />
              </ItemTitle>
              <ItemDescription>{{ provider.description }}</ItemDescription>
              <ProviderMaintainerMarker
                v-if="
                  isCommunityProvider(provider) ||
                  getProviderMaintainers(provider).length
                "
                variant="line"
                :community="isCommunityProvider(provider)"
                :maintainers="getProviderMaintainers(provider)"
              />
            </ItemContent>
            <ItemActions>
              <ChevronRight class="text-muted-foreground size-4" />
            </ItemActions>
          </Item>
        </ItemGroup>

        <Empty v-else class="h-full">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Search />
            </EmptyMedia>
            <EmptyTitle>{{ $t("no_content") }}</EmptyTitle>
            <EmptyDescription>{{ $t("no_content_filter") }}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
import FacetedFilter from "@/components/FacetedFilter.vue";
import ProviderIcon from "@/components/ProviderIcon.vue";
import ProviderMaintainerMarker from "@/components/settings/providers/ProviderMaintainerMarker.vue";
import ProviderStageBadge from "@/components/settings/providers/ProviderStageBadge.vue";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item";
import { SearchInput } from "@/components/ui/search-input";
import { preventOnScreenKeyboardOnOpen } from "@/helpers/dialog_focus";
import { startAddProvider } from "@/helpers/provider_add";
import {
  ADDABLE_PROVIDER_STAGES,
  buildCatalogEntries,
  filterCatalogEntries,
  sortPopularFirst,
} from "@/helpers/provider_catalog";
import {
  getProviderMaintainers,
  getProviderStageTranslationKey,
  isCommunityProvider,
} from "@/helpers/provider_config";
import { api } from "@/plugins/api";
import {
  ProviderConfig,
  ProviderManifest,
  ProviderType,
} from "@/plugins/api/interfaces";
import { isPhoneSizedScreen } from "@/plugins/breakpoint";
import { $t } from "@/plugins/i18n";
import { store } from "@/plugins/store";
import { ChevronRight, Search } from "@lucide/vue";
import { match } from "ts-pattern";
import { computed, ref, watch } from "vue";
import { useRoute } from "vue-router";

const props = defineProps<{
  show?: boolean;
  // the type to offer, for a caller whose route carries no types query
  providerType?: ProviderType;
  // only offer providers that allow more than one account
  multiInstanceOnly?: boolean;
  // only offer providers that members may set up themselves
  selfServiceOnly?: boolean;
}>();

const emit = defineEmits<{
  (e: "update:show", value: boolean): void;
}>();

const route = useRoute();
const providerConfigs = ref<ProviderConfig[]>([]);
const searchQuery = ref("");
const selectedProviderStages = ref<string[]>([]);

const isPhone = computed(() => isPhoneSizedScreen());

const activeTypeFilter = computed(
  () => props.providerType ?? ((route.query.types as string) || null),
);

const dialogTitle = computed(() =>
  match(activeTypeFilter.value)
    .with(ProviderType.MUSIC, () => $t("settings.add_music_provider"))
    .with(ProviderType.PLAYER, () => $t("settings.add_player_provider"))
    .with(ProviderType.METADATA, () => $t("settings.add_metadata_provider"))
    .with(ProviderType.PLUGIN, () => $t("settings.add_plugin_provider"))
    .with(ProviderType.AUDIO_ANALYSIS, () =>
      $t("settings.add_audio_analysis_provider"),
    )
    .otherwise(() => $t("settings.add_new")),
);

const providerStageOptions = computed(() =>
  ADDABLE_PROVIDER_STAGES.map((stage) => ({
    label: $t(getProviderStageTranslationKey(stage)!),
    value: stage,
  })),
);

// a configured provider that allows a single instance cannot be added again
const availableProviders = computed(() =>
  sortPopularFirst(
    buildCatalogEntries(
      Object.values(api.providerManifests),
      providerConfigs.value,
      {
        multiInstanceOnly: props.multiInstanceOnly,
        selfServiceOnly: props.selfServiceOnly,
      },
    ).filter((entry) => entry.canAdd),
  ),
);

const activeTypes = computed(() =>
  (activeTypeFilter.value ?? "")
    .split(",")
    .map((type) => type.trim())
    .filter((type) => type.length > 0),
);

const filteredProviders = computed(() =>
  filterCatalogEntries(availableProviders.value, {
    query: searchQuery.value,
    types: activeTypes.value,
    stages: selectedProviderStages.value,
  }).map((entry) => entry.manifest),
);

const loadItems = async function () {
  providerConfigs.value = await api.getProviderConfigs();
};

const addProvider = function (provider: ProviderManifest) {
  startAddProvider(provider, close);
};

const handleOpenChange = (open: boolean) => {
  store.dialogActive = open;
  emit("update:show", open);
};

const close = function () {
  emit("update:show", false);
};

// keep the configs in step with the providers, but only while the dialog is
// open; a hidden dialog must not fetch
watch(
  () => api.providers,
  () => {
    if (props.show) loadItems();
  },
  { immediate: true, deep: true },
);

// a stage picked before the screen turned phone-sized would keep filtering
// the list without its control, so it goes along with the filter
watch(isPhone, (phone) => {
  if (phone) selectedProviderStages.value = [];
});

watch(
  () => props.show,
  (isOpen) => {
    if (!isOpen) {
      selectedProviderStages.value = [];
      searchQuery.value = "";
    }

    if (isOpen) {
      // Refresh provider configs when dialog opens
      loadItems();
    }
  },
);
</script>
