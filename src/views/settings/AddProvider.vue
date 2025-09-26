<template>
  <div class="input-search">
    <v-text-field
      v-model="searchQuery"
      prepend-inner-icon="mdi-magnify"
      label="Search providers..."
      variant="outlined"
      density="comfortable"
      clearable
      hide-details
    />
  </div>
  <v-toolbar color="transparent" density="compact">
    <template #title>
      {{ filteredProviders.length }}
      {{ $t(`settings.${providerType?.toLowerCase()}providers`) }} available
    </template>
  </v-toolbar>

  <Container variant="comfortable" class="mt-4">
    <v-row>
      <v-col
        v-for="provider in filteredProviders"
        :key="provider.domain"
        cols="12"
        sm="4"
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

          <v-card-title>
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
import ProviderIcon from "@/components/ProviderIcon.vue";
import { api } from "@/plugins/api";
import {
  ProviderConfig,
  ProviderManifest,
  ProviderType,
} from "@/plugins/api/interfaces";
import { $t } from "@/plugins/i18n";
import { computed, onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";

// global refs
const router = useRouter();
const route = useRoute();

// local refs
const providerConfigs = ref<ProviderConfig[]>([]);
const providerType = ref<ProviderType | null>(null);
const searchQuery = ref("");

// computed properties
const availableProviders = computed(() => {
  if (!providerType.value) return [];

  return Object.values(api.providerManifests)
    .filter((x) => x.type === providerType.value)
    .filter(
      (x) =>
        // provider is either multi instance or does not exist at all
        x.multi_instance ||
        !providerConfigs.value.find((y) => y.domain == x.domain),
    )
    .sort((a, b) =>
      (a.name || api.providerManifests[a.domain].name).toUpperCase() >
      (b.name || api.providerManifests[b.domain].name).toUpperCase()
        ? 1
        : -1,
    );
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

onMounted(() => {
  initializeFromRoute();
});

const initializeFromRoute = () => {
  const typeParam = route.query.type as string;
  if (
    typeParam &&
    Object.values(ProviderType).includes(typeParam as ProviderType)
  ) {
    providerType.value = typeParam as ProviderType;
  }
};

// watchers
watch(
  () => api.providers,
  (val) => {
    if (val) loadItems();
  },
  { immediate: true },
);

watch(
  () => route.query.type,
  () => {
    initializeFromRoute();
  },
  { immediate: true },
);
</script>

<style scoped>
.input-search {
  padding: 20px;
}
.titlebar.v-toolbar {
  height: 55px;
  font-family: "JetBrains Mono Medium";
}

.provider-description {
  display: -webkit-box;
  -webkit-line-clamp: 3;
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
