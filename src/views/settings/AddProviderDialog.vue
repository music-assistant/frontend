<template>
  <Dialog :open="props.show" @update:open="handleOpenChange">
    <!-- a fixed height keeps the dialog still while the search narrows the list;
         the sm: max width has to be restated or the 512px default of
         DialogContent caps it -->
    <DialogContent
      class="flex h-[calc(100dvh-2rem)] flex-col gap-0 p-0 sm:h-[85dvh] sm:max-w-[calc(100%-2rem)] lg:max-w-[900px]"
      @open-auto-focus="preventOnScreenKeyboardOnOpen"
    >
      <DialogHeader class="border-b px-5 py-4 pr-12 text-left">
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
        <FacetedFilter
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
                <Badge
                  v-if="shouldShowStageBadge(provider.stage)"
                  :variant="getStageVariant(provider.stage)"
                  class="uppercase"
                >
                  {{ getStageLabel(provider.stage) }}
                </Badge>
              </ItemTitle>
              <ItemDescription>{{ provider.description }}</ItemDescription>
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
import { Badge } from "@/components/ui/badge";
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
import { isSelfServiceProvider } from "@/helpers/provider_access";
import {
  getProviderStageTranslationKey,
  shouldShowStageBadge,
} from "@/helpers/provider_config";
import { api } from "@/plugins/api";
import {
  ProviderConfig,
  ProviderManifest,
  ProviderStage,
  ProviderType,
} from "@/plugins/api/interfaces";
import { eventbus } from "@/plugins/eventbus";
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

const POPULAR_PROVIDERS = [
  "spotify",
  "tidal",
  "qobuz",
  "filesystem_local",
  "filesystem_smb",
  "sonos",
  "chromecast",
  "airplay",
];

const emit = defineEmits<{
  (e: "update:show", value: boolean): void;
}>();

const route = useRoute();
const providerConfigs = ref<ProviderConfig[]>([]);
const searchQuery = ref("");
const selectedProviderStages = ref<string[]>([]);

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

const providerStageOptions = computed(() => [
  { label: $t("settings.stage.options.stable"), value: ProviderStage.STABLE },
  { label: $t("settings.stage.options.beta"), value: ProviderStage.BETA },
  { label: $t("settings.stage.options.alpha"), value: ProviderStage.ALPHA },
  {
    label: $t("settings.stage.options.experimental"),
    value: ProviderStage.EXPERIMENTAL,
  },
  {
    label: $t("settings.stage.options.unmaintained"),
    value: ProviderStage.UNMAINTAINED,
  },
  // no deprecated option: those providers never reach this list
]);

const availableProviders = computed(() => {
  let providers = Object.values(api.providerManifests);

  // a deprecated provider is retired: it can no longer be set up, so keep it
  // out of the list even though it is no longer builtin
  providers = providers.filter(
    (x) =>
      !x.builtin &&
      x.type !== ("core" as ProviderType) &&
      x.stage !== ProviderStage.DEPRECATED,
  );

  if (props.multiInstanceOnly) {
    providers = providers.filter((x) => x.multi_instance);
  }

  if (props.selfServiceOnly) {
    providers = providers.filter((x) => isSelfServiceProvider(x));
  }

  return providers
    .filter(
      (x) =>
        x.multi_instance ||
        !providerConfigs.value.find((y) => y.domain == x.domain),
    )
    .sort((a, b) => {
      const aPopularIndex = POPULAR_PROVIDERS.indexOf(a.domain);
      const bPopularIndex = POPULAR_PROVIDERS.indexOf(b.domain);
      const aIsPopular = aPopularIndex !== -1;
      const bIsPopular = bPopularIndex !== -1;

      if (aIsPopular && !bIsPopular) return -1;
      if (!aIsPopular && bIsPopular) return 1;
      if (aIsPopular && bIsPopular) return aPopularIndex - bPopularIndex;

      const nameA = (
        a.name || api.providerManifests[a.domain].name
      ).toUpperCase();
      const nameB = (
        b.name || api.providerManifests[b.domain].name
      ).toUpperCase();
      return nameA > nameB ? 1 : -1;
    });
});

const filteredProviders = computed(() => {
  let providers = availableProviders.value;

  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase();
    providers = providers.filter(
      (provider) =>
        provider.name.toLowerCase().includes(query) ||
        provider.description.toLowerCase().includes(query),
    );
  }

  if (activeTypeFilter.value) {
    const activeTypes = Array.isArray(activeTypeFilter.value)
      ? activeTypeFilter.value
      : String(activeTypeFilter.value)
          .split(",")
          .map((type) => type.trim())
          .filter((type) => type.length > 0);

    if (activeTypes.length > 0) {
      providers = providers.filter((x) => activeTypes.includes(x.type));
    }
  }

  if (selectedProviderStages.value.length > 0) {
    providers = providers.filter((x) =>
      selectedProviderStages.value.includes(x.stage),
    );
  }

  return providers;
});

const loadItems = async function () {
  providerConfigs.value = await api.getProviderConfigs();
};

const addProvider = function (provider: ProviderManifest) {
  const dependsOn = provider.depends_on;
  if (dependsOn && !api.getProvider(dependsOn)) {
    // the provider it depends on has to be set up first, so offer that flow
    // instead of this one
    const depProvName = api.getProviderName(dependsOn);
    eventbus.emit("deleteConfirmationDialog", {
      title: $t("settings.setup_flow.setup_title", [depProvName]),
      message: $t("settings.provider_depends_on_confirm", [
        provider.name,
        depProvName,
      ]),
      confirmLabel: $t("settings.start_setup"),
      destructive: false,
      onConfirm: () => {
        close();
        eventbus.emit("setupFlowDialog", {
          kind: "provider",
          domain: dependsOn,
        });
      },
    });
    return;
  }
  close();
  eventbus.emit("setupFlowDialog", {
    kind: "provider",
    domain: provider.domain,
  });
};

const getStageLabel = function (stage?: string) {
  const key = getProviderStageTranslationKey(stage);
  return key ? $t(key) : "";
};

const getStageVariant = function (
  stage?: string,
): "default" | "secondary" | "outline" | "destructive" {
  return match(stage)
    .with("stable", () => "default" as const)
    .with("beta", () => "secondary" as const)
    .with("alpha", () => "outline" as const)
    .with("experimental", () => "outline" as const)
    .with("unmaintained", () => "secondary" as const)
    .with("deprecated", () => "destructive" as const)
    .otherwise(() => "default" as const);
};

const handleOpenChange = (open: boolean) => {
  store.dialogActive = open;
  emit("update:show", open);
};

const close = function () {
  emit("update:show", false);
};

// Load items initially and when providers change
watch(
  () => api.providers,
  () => {
    loadItems();
  },
  { immediate: true, deep: true },
);

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
