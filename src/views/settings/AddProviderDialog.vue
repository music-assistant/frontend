<template>
  <v-dialog
    :model-value="show"
    max-width="800"
    scrollable
    @update:model-value="(val) => emit('update:show', val)"
  >
    <v-card>
      <v-card-title class="d-flex align-center justify-space-between pa-4">
        {{ $t("settings.add_provider") }}
        <v-btn
          icon="mdi-close"
          variant="text"
          @click="emit('update:show', false)"
        />
      </v-card-title>

      <v-divider />

      <div class="pa-4">
        <v-text-field
          ref="searchInput"
          v-model="searchQuery"
          prepend-inner-icon="mdi-magnify"
          :label="$t('search')"
          variant="outlined"
          hide-details
          class="mb-4"
          autofocus
          clearable
        />

        <div class="d-flex gap-4 flex-wrap">
          <v-select
            v-model="selectedProviderTypes"
            :items="providerTypeOptions"
            :label="$t('settings.provider_type')"
            item-title="label"
            item-value="value"
            multiple
            chips
            closable-chips
            variant="outlined"
            hide-details
            density="comfortable"
            style="min-width: 200px; flex: 1"
          />
          <v-select
            v-model="selectedProviderStages"
            :items="providerStageOptions"
            :label="$t('settings.stage.label')"
            item-title="label"
            item-value="value"
            multiple
            chips
            closable-chips
            variant="outlined"
            hide-details
            density="comfortable"
            style="min-width: 200px; flex: 1"
          />
        </div>
      </div>

      <v-divider />

      <v-card-text class="pa-0" style="height: 60vh">
        <v-list v-if="filteredProviders.length > 0" lines="two">
          <v-list-item
            v-for="provider in filteredProviders"
            :key="provider.domain"
            :title="provider.name"
            link
            @click="addProvider(provider)"
          >
            <template #prepend>
              <ProviderIcon :domain="provider.domain" :size="40" class="mr-4" />
            </template>
            <template #subtitle>
              <div class="text-truncate">{{ provider.description }}</div>
            </template>
            <template #append>
              <v-chip
                size="small"
                class="text-uppercase font-weight-bold"
                :color="getStageColor(provider.stage)"
                label
              >
                {{ $t(String(provider.stage || "").toLowerCase()) }}
              </v-chip>
            </template>
          </v-list-item>
        </v-list>
        <div
          v-else
          class="d-flex flex-column align-center justify-center fill-height pa-6"
        >
          <v-icon icon="mdi-magnify" size="64" class="mb-4 text-disabled" />
          <div class="text-h6 text-medium-emphasis">{{ $t("no_content") }}</div>
          <div class="text-body-2 text-disabled">
            {{ $t("no_content_filter") }}
          </div>
        </div>
      </v-card-text>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import ProviderIcon from "@/components/ProviderIcon.vue";
import { api } from "@/plugins/api";
import {
  ProviderConfig,
  ProviderManifest,
  ProviderStage,
  ProviderType,
} from "@/plugins/api/interfaces";
import { $t } from "@/plugins/i18n";
import { store } from "@/plugins/store";
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
const searchInput = ref<HTMLInputElement | null>(null);

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

const getStageColor = function (stage?: string) {
  return match(stage)
    .with("stable", () => "success")
    .with("beta", () => "info")
    .with("alpha", () => "warning")
    .with("experimental", () => "warning")
    .with("unmaintained", () => "grey")
    .with("deprecated", () => "error")
    .otherwise(() => "grey");
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
    store.dialogActive = isOpen;
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
.gap-4 {
  gap: 16px;
}
</style>
