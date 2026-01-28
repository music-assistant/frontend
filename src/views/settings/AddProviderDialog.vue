<template>
  <Dialog :open="props.show" @update:open="handleOpenChange">
    <DialogContent
      class="add-provider-dialog h-[60vh] max-h-[60vh] flex flex-col p-0"
    >
      <DialogHeader class="px-6 pt-6 pb-4 flex-shrink-0">
        <DialogTitle>{{ $t("settings.add_provider") }}</DialogTitle>
      </DialogHeader>

      <div class="px-6 pb-2 flex-shrink-0">
        <InputGroup class="search-field">
          <InputGroupInput
            ref="searchInput"
            v-model="searchQuery"
            :placeholder="$t('search')"
          />
          <InputGroupAddon>
            <Search />
          </InputGroupAddon>
        </InputGroup>
      </div>

      <div class="px-6 flex-shrink-0">
        <div class="filter-buttons">
          <FacetedFilter
            v-model="selectedProviderTypes"
            :title="$t('settings.provider_type')"
            :options="providerTypeOptions"
          />
          <FacetedFilter
            v-model="selectedProviderStages"
            :title="$t('settings.stage.label')"
            :options="providerStageOptions"
          />
        </div>
      </div>

      <div
        class="provider-list-container px-6 pt-2 pb-6 flex-1 min-h-0 overflow-y-auto"
      >
        <div v-if="filteredProviders.length > 0" class="provider-list">
          <div
            v-for="provider in filteredProviders"
            :key="provider.domain"
            class="provider-item"
            @click="addProvider(provider)"
          >
            <provider-icon
              :domain="provider.domain"
              :size="40"
              class="provider-icon"
            />
            <div class="provider-content">
              <div class="provider-name">{{ provider.name }}</div>
              <div class="provider-description">
                {{ provider.description }}
              </div>
            </div>
            <div class="provider-actions">
              <Badge
                :variant="getStageVariant(provider.stage)"
                class="text-uppercase"
              >
                {{ $t(String(provider.stage || "").toLowerCase()) }}
              </Badge>
              <ChevronRight class="h-4 w-4" />
            </div>
          </div>
        </div>

        <div v-else class="empty-state">
          <Search class="empty-icon" />
          <div class="empty-title">{{ $t("no_content") }}</div>
          <div class="empty-message">
            {{ $t("no_content_filter") }}
          </div>
        </div>
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
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import { api } from "@/plugins/api";
import {
  ProviderConfig,
  ProviderManifest,
  ProviderStage,
  ProviderType,
} from "@/plugins/api/interfaces";
import { $t } from "@/plugins/i18n";
import { store } from "@/plugins/store";
import { ChevronRight, Search } from "lucide-vue-next";
import { match } from "ts-pattern";
import { computed, nextTick, ref, watch } from "vue";
import { useRouter } from "vue-router";

const props = defineProps<{
  show?: boolean;
  initialType?: string;
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

const router = useRouter();
const providerConfigs = ref<ProviderConfig[]>([]);
const searchQuery = ref("");
const selectedProviderTypes = ref<string[]>([]);
const selectedProviderStages = ref<string[]>([]);
const searchInput = ref<{ focus: () => void } | null>(null);

const providerTypeOptions = computed(() => [
  { label: $t("settings.musicprovider"), value: ProviderType.MUSIC },
  { label: $t("settings.playerprovider"), value: ProviderType.PLAYER },
  { label: $t("settings.metadataprovider"), value: ProviderType.METADATA },
  { label: $t("settings.pluginprovider"), value: ProviderType.PLUGIN },
]);

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
  {
    label: $t("settings.stage.options.deprecated"),
    value: ProviderStage.DEPRECATED,
  },
]);

const availableProviders = computed(() => {
  let providers = Object.values(api.providerManifests);

  providers = providers.filter(
    (x) => !x.builtin && x.type !== ("core" as ProviderType),
  );

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

  if (selectedProviderTypes.value.length > 0) {
    providers = providers.filter((x) =>
      selectedProviderTypes.value.includes(x.type),
    );
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
  if (provider.depends_on) {
    if (!api.getProvider(provider.depends_on)) {
      const depProvName = api.getProviderName(provider.depends_on);
      if (
        confirm(
          $t("settings.provider_depends_on_confirm", [
            provider.name,
            depProvName,
          ]),
        )
      ) {
        router.push(`/settings/addprovider/${provider.depends_on}`);
      }
      return;
    }
  }
  router.push(`/settings/addprovider/${provider.domain}`);
  close();
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

watch(
  () => api.providers,
  (val) => {
    if (val) loadItems();
  },
  { immediate: true },
);

watch(
  () => props.show,
  (isOpen) => {
    if (isOpen && props.initialType) {
      selectedProviderTypes.value = [props.initialType];
      searchQuery.value = "";
    } else if (!isOpen) {
      selectedProviderTypes.value = [];
      selectedProviderStages.value = [];
      searchQuery.value = "";
    }

    if (isOpen) {
      nextTick(() => {
        searchInput.value?.focus();
      });
    }
  },
);
</script>

<style scoped>
.add-provider-dialog {
  display: flex;
  flex-direction: column;
}

.search-field {
  width: 100%;
}

.filter-buttons {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.provider-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.provider-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  border-radius: 8px;
  transition: all 0.2s ease;
  cursor: pointer;
}

.provider-item:hover {
  background-color: rgba(var(--v-theme-primary), 0.04);
  transform: translateY(-1px);
}

.provider-icon {
  flex-shrink: 0;
}

.provider-content {
  flex: 1;
  min-width: 0;
}

.provider-name {
  font-weight: 500;
  font-size: 16px;
  line-height: 1.2;
  margin-bottom: 4px;
}

.provider-description {
  font-size: 14px;
  color: rgba(var(--v-theme-on-surface), 0.6);
  line-height: 1.3;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  text-overflow: ellipsis;
  max-height: 2.6em;
}

.provider-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 300px;
  text-align: center;
  padding: 40px 20px;
}

.empty-icon {
  width: 48px;
  height: 48px;
  color: rgba(var(--v-theme-on-surface), 0.3);
  margin-bottom: 16px;
}

.empty-title {
  font-size: 18px;
  font-weight: 500;
  color: rgba(var(--v-theme-on-surface), 0.7);
  margin-bottom: 8px;
}

.empty-message {
  font-size: 14px;
  color: rgba(var(--v-theme-on-surface), 0.5);
  line-height: 1.4;
}

@media (max-width: 600px) {
  .add-provider-dialog {
    max-height: 500px;
  }
}
</style>
