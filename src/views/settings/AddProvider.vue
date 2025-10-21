<template>
  <div class="filters">
    <ProviderFilters
      @update:search="searchQuery = $event"
      @update:types="selectedProviderTypes = $event"
    />
  </div>

  <div class="pl-5 font-weight-medium">
    {{
      $t("settings.providers_total", [
        filteredProviders.length,
        filteredProviders.length > 1 ? "s" : "",
      ])
    }}
  </div>

  <Container variant="comfortable" class="mt-4">
    <v-row>
      <v-col
        v-for="provider in filteredProviders"
        :key="provider.domain"
        cols="12"
        md="6"
        lg="4"
        class="d-flex"
      >
        <v-card
          class="flex-fill rounded-lg"
          min-height="200px"
          @click="addProvider(provider)"
        >
          <template #prepend>
            <provider-icon
              :domain="provider.domain"
              :size="50"
              class="listitem-media-thumb"
              style="margin-top: 5px; margin-bottom: 5px"
            />
          </template>

          <template #append>
            <v-btn
              variant="text"
              size="small"
              icon
              :title="getProviderTypeTitle(provider.type)"
            >
              <v-icon :icon="getProviderTypeIcon(provider.type)" />
            </v-btn>

            <v-chip
              size="x-small"
              variant="flat"
              class="mx-1 text-uppercase"
              :color="getStageColor(provider.stage)"
            >
              {{ $t(String(provider.stage || "").toLowerCase()) }}
            </v-chip>
          </template>

          <v-card-title class="text-truncate">
            {{ provider.name }}
          </v-card-title>

          <v-card-text
            class="provider-description"
            :class="{
              'truncated-text': isTextTruncated(provider.description),
            }"
          >
            {{ provider.description }}
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>
  </Container>
</template>

<script setup lang="ts">
import Container from "@/components/Container.vue";
import ProviderFilters from "@/components/ProviderFilters.vue";
import ProviderIcon from "@/components/ProviderIcon.vue";
import { api } from "@/plugins/api";
import {
  ProviderConfig,
  ProviderManifest,
  ProviderType,
} from "@/plugins/api/interfaces";
import { $t } from "@/plugins/i18n";
import { match } from "ts-pattern";
import { computed, ref, watch } from "vue";
import { useRouter } from "vue-router";

// global refs
const router = useRouter();

// local refs
const providerConfigs = ref<ProviderConfig[]>([]);
const searchQuery = ref("");
const selectedProviderTypes = ref<string[]>([]);

// computed properties
const availableProviders = computed(() => {
  let providers = Object.values(api.providerManifests);

  // Filter out builtin/core modules
  providers = providers.filter(
    (x) => !x.builtin && x.type !== ("core" as ProviderType),
  );

  // Filter by selected types if specified
  if (selectedProviderTypes.value.length > 0) {
    providers = providers.filter((x) =>
      selectedProviderTypes.value.includes(x.type),
    );
  }

  return providers
    .filter(
      (x) =>
        // provider is either multi instance or does not exist at all
        x.multi_instance ||
        !providerConfigs.value.find((y) => y.domain == x.domain),
    )
    .sort((a, b) => {
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
  if (!searchQuery.value) return availableProviders.value;

  const query = searchQuery.value.toLowerCase();
  return availableProviders.value.filter(
    (provider) =>
      provider.name.toLowerCase().includes(query) ||
      provider.description.toLowerCase().includes(query),
  );
});

// methods
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
};

const isTextTruncated = function (text: string) {
  return text && text.length > 150;
};

const getProviderTypeIcon = function (type: ProviderType) {
  const iconMap = {
    [ProviderType.MUSIC]: "mdi-music",
    [ProviderType.PLAYER]: "mdi-speaker",
    [ProviderType.METADATA]: "mdi-file-code",
    [ProviderType.PLUGIN]: "mdi-puzzle",
  };

  return iconMap[type] || "mdi-help-circle";
};

const getProviderTypeTitle = function (type: ProviderType) {
  return match(type)
    .with(ProviderType.MUSIC, () => $t("settings.music"))
    .with(ProviderType.PLAYER, () => $t("settings.player"))
    .with(ProviderType.METADATA, () => $t("settings.metadata"))
    .with(ProviderType.PLUGIN, () => $t("settings.plugin"))
    .otherwise(() => $t("settings.player"));
};

const getStageColor = function (stage?: string) {
  return match(stage)
    .with("stable", () => "green")
    .with("beta", () => "blue")
    .with("alpha", () => "purple")
    .with("experimental", () => "orange")
    .with("unmaintained", () => "grey")
    .with("deprecated", () => "red")
    .otherwise(() => "green");
};

// watchers
watch(
  () => api.providers,
  (val) => {
    if (val) loadItems();
  },
  { immediate: true },
);
</script>

<style scoped>
.filters {
  padding: 20px 20px 6px 20px;
}

.provider-description {
  display: -webkit-box;
  -webkit-line-clamp: 3;
  line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 1.4em;
  max-height: 4.2em;
}

.provider-description.truncated-text {
  margin-bottom: 16px !important;
}
</style>
