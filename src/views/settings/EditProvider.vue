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
            $t("settings.setup_music_provider", [
              availableProviders[config.domain].name,
            ])
          }}
        </v-card-title>
        <v-card-subtitle>
          {{
            availableProviders[config.domain].description
          }}
        </v-card-subtitle><br>
        <v-card-subtitle
          v-if="availableProviders[config.domain].codeowners.length"
        >
          <b>{{ $t("settings.codeowners") }}: </b>{{
            availableProviders[config.domain].codeowners.join(" / ")
          }}
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
        @update:modelValue="onSubmit($event as ProviderConfig)"
      />
    </v-card-text>
  </section>
</template>

<script setup lang="ts">
import { reactive, ref, onMounted } from "vue";
import { useRouter } from "vue-router";
import { api } from "@/plugins/api";
import { ProviderConfig, ProviderManifest } from "@/plugins/api/interfaces";
import EditConfig from "./EditConfig.vue";
import { watch } from "vue";
import { store } from "@/plugins/store";

// global refs
const router = useRouter();
const config = ref<ProviderConfig>();
const availableProviders = reactive<{
  [provider_domain: string]: ProviderManifest;
}>({});

// props
const props = defineProps<{
  domain?: string;
  instanceId?: string;
}>();

onMounted( async () => {
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
      config.value = await api.getData("config/providers/create", {
        provider_domain: props.domain,
      });
    }
  },
  { immediate: true }
);

watch(
  () => props.instanceId,
  async (val) => {
    if (val) {
      config.value = await api.getData("config/providers/get", {
        instance_id: props.instanceId,
      });
    }
  },
  { immediate: true }
);

// methods
const onSubmit = async function (value: ProviderConfig) {
  api.sendCommand("config/providers/set", { config: value });
  router.push({ name: "musicprovidersettings" });
};

</script>

<style scoped></style>
