<template>
  <section>
    <v-card-text>
      <!-- header -->
      <div
        v-if="config && availableProviders[config.domain]"
        style="margin-left: -5px; margin-right: -5px"
      >
        <v-card-title>
          {{
            $t("settings.setup_provider", [
              availableProviders[config.domain].name,
            ])
          }}
        </v-card-title>
        <v-card-subtitle>
          {{ availableProviders[config.domain].description }}
        </v-card-subtitle><br>
        <v-card-subtitle
          v-if="availableProviders[config.domain].codeowners.length"
        >
          <b>{{ $t("settings.codeowners") }}: </b>{{ availableProviders[config.domain].codeowners.join(" / ") }}
        </v-card-subtitle>

        <v-card-subtitle v-if="availableProviders[config.domain].documentation">
          <b>{{ $t("settings.need_help_setup_provider") }} </b>&nbsp;
          <a
            :href="availableProviders[config.domain].documentation"
            target="_blank"
          >{{ $t("settings.check_docs") }}</a>
        </v-card-subtitle>
      </div>
      <br>
      <v-divider />
      <br>
      <br>
      <edit-config
        v-if="config"
        :model-value="config"
        @update:modelValue="onSubmit($event as ConfigUpdate)"
      />
    </v-card-text>
  </section>
</template>

<script setup lang="ts">
import { reactive, ref, onMounted } from "vue";
import { useRouter } from "vue-router";
import { api } from "@/plugins/api";
import {
  ProviderConfig,
  ProviderManifest,
  ConfigUpdate,
} from "@/plugins/api/interfaces";
import EditConfig from "./EditConfig.vue";
import { watch } from "vue";

// global refs
const router = useRouter();
const config = ref<ProviderConfig>();
const availableProviders = reactive<{
  [provider_domain: string]: ProviderManifest;
}>({});

// props
const props = defineProps<{
  domain?: string;
}>();

onMounted(async () => {
  const manifests: ProviderManifest[] = await api.getData(
    "providers/available"
  );
  for (const provManifest of manifests) {
    availableProviders[provManifest.domain] = provManifest;
  }
});

// watchers

watch(
  () => props.domain,
  async (val) => {
    if (val) {
      // create a default config using the helper on the server
      config.value = await api.getData("config/providers/add", {
        provider_domain: props.domain,
      });
    }
  },
  { immediate: true }
);

// methods
const onSubmit = async function (update: ConfigUpdate) {
  config.value!.enabled = update.enabled as boolean;
  config.value!.name = update.name as string;
  for (const key in update.values) {
    config.value!.values[key].value = update.values[key];
  }
  api
    .getData("config/providers/add", {
      provider_domain: props.domain,
      config: config.value,
    })
    .then(() => {
      router.push({ name: "providersettings" });
    })
    .catch((err) => {
      // TODO: make this a bit more fancy someday
      alert(err);
    });
};
</script>

<style scoped></style>
