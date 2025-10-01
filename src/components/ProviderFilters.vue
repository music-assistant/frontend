<template>
  <div class="d-flex align-center ga-3" style="flex: 1">
    <v-text-field
      v-model="searchQuery"
      prepend-inner-icon="mdi-magnify"
      label="Search providers..."
      variant="outlined"
      density="compact"
      clearable
      hide-details
      style="max-width: 400px; min-width: 300px"
    />
    <v-btn height="40" elevation="0">
      Type
      <v-icon end>mdi-chevron-down</v-icon>
      <v-menu activator="parent" :close-on-content-click="false">
        <v-list>
          <v-list-item
            v-for="(providerType, index) in providerTypes"
            :key="index"
            :value="index"
            @click="toggleProviderType(providerType.value)"
          >
            <template #append>
              <v-checkbox-btn
                :model-value="
                  selectedProviderTypes.includes(providerType.value)
                "
                @click.stop="toggleProviderType(providerType.value)"
              />
            </template>
            <v-list-item-title>{{ providerType.title }}</v-list-item-title>
          </v-list-item>
        </v-list>
      </v-menu>
    </v-btn>
    <v-btn v-if="showStageFilter" height="40" elevation="0">
      Stage
      <v-icon end>mdi-chevron-down</v-icon>
      <v-menu activator="parent" :close-on-content-click="false">
        <v-list>
          <v-list-item
            v-for="(stage, index) in providerStages"
            :key="index"
            :value="index"
            @click="toggleProviderStage(stage.value)"
          >
            <template #append>
              <v-checkbox-btn
                :model-value="selectedProviderStages.includes(stage.value)"
                @click.stop="toggleProviderStage(stage.value)"
              />
            </template>
            <v-list-item-title>{{ stage.title }}</v-list-item-title>
          </v-list-item>
        </v-list>
      </v-menu>
    </v-btn>
  </div>
</template>

<script setup lang="ts">
import { ProviderStage, ProviderType } from "@/plugins/api/interfaces";
import { ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";

// Props
const { showStageFilter = false } = defineProps<{
  showStageFilter?: boolean;
}>();

const router = useRouter();
const route = useRoute();

const searchQuery = ref<string>("");
const selectedProviderTypes = ref<string[]>([]);
const selectedProviderStages = ref<string[]>([]);
let searchDebounceTimeout: ReturnType<typeof setTimeout> | null = null;
let typesDebounceTimeout: ReturnType<typeof setTimeout> | null = null;
let stagesDebounceTimeout: ReturnType<typeof setTimeout> | null = null;

const providerTypes = ref([
  { title: "Music", value: ProviderType.MUSIC },
  { title: "Player", value: ProviderType.PLAYER },
  { title: "Metadata", value: ProviderType.METADATA },
  { title: "Plugin", value: ProviderType.PLUGIN },
]);

const providerStages = ref([
  { title: "Stable", value: ProviderStage.STABLE },
  { title: "Beta", value: ProviderStage.BETA },
  { title: "Alpha", value: ProviderStage.ALPHA },
  { title: "Experimental", value: ProviderStage.EXPERIMENTAL },
  { title: "Unmaintained", value: ProviderStage.UNMAINTAINED },
  { title: "Deprecated", value: ProviderStage.DEPRECATED },
]);

// Emits
const emit = defineEmits<{
  (e: "update:search", value: string): void;
  (e: "update:types", value: string[]): void;
  (e: "update:stages", value: string[]): void;
}>();

const toggleProviderType = function (type: string) {
  const index = selectedProviderTypes.value.indexOf(type);
  if (index > -1) {
    selectedProviderTypes.value.splice(index, 1);
  } else {
    selectedProviderTypes.value.push(type);
  }
};

const toggleProviderStage = function (stage: string) {
  const index = selectedProviderStages.value.indexOf(stage);
  if (index > -1) {
    selectedProviderStages.value.splice(index, 1);
  } else {
    selectedProviderStages.value.push(stage);
  }
};

const initializeFromUrl = function () {
  if (route.query.search) {
    searchQuery.value = route.query.search as string;
  }

  if (route.query.types) {
    const types = route.query.types as string;
    selectedProviderTypes.value = types.split(",");
  }

  if (route.query.stages) {
    const stages = route.query.stages as string;
    selectedProviderStages.value = stages.split(",");
  }
};

// Watch search query and update URL with debounce
watch(searchQuery, (newQuery) => {
  emit("update:search", newQuery);

  if (searchDebounceTimeout) {
    clearTimeout(searchDebounceTimeout);
  }
  searchDebounceTimeout = setTimeout(() => {
    const query = { ...route.query };
    if (newQuery) {
      query.search = newQuery;
    } else {
      delete query.search;
    }
    router.replace({ query });
  }, 750);
});

// Watch selected provider types and update URL with debounce
watch(
  selectedProviderTypes,
  (newTypes) => {
    emit("update:types", newTypes);

    if (typesDebounceTimeout) {
      clearTimeout(typesDebounceTimeout);
    }
    typesDebounceTimeout = setTimeout(() => {
      const query = { ...route.query };
      if (newTypes.length > 0) {
        query.types = newTypes.join(",");
      } else {
        delete query.types;
      }
      router.replace({ query });
    }, 750);
  },
  { deep: true },
);

// Watch selected provider stages and update URL with debounce
watch(
  selectedProviderStages,
  (newStages) => {
    emit("update:stages", newStages);

    if (stagesDebounceTimeout) {
      clearTimeout(stagesDebounceTimeout);
    }
    stagesDebounceTimeout = setTimeout(() => {
      const query = { ...route.query };
      if (newStages.length > 0) {
        query.stages = newStages.join(",");
      } else {
        delete query.stages;
      }
      router.replace({ query });
    }, 750);
  },
  { deep: true },
);

initializeFromUrl();
</script>

<style scoped>
:deep(.v-list-item .v-checkbox-btn) {
  display: flex;
  align-items: center;
}

:deep(.v-list-item .v-checkbox-btn .v-input__control) {
  display: flex;
  align-items: center;
}

:deep(.v-list-item .v-checkbox-btn .v-selection-control) {
  min-height: auto;
}
</style>
