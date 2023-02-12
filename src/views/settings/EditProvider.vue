<template>
  <section>
    <v-card-text>
      <!-- header -->
      <div
        v-if="config && config.domain in availableProviders"
        style="margin-left: -5px; margin-right: -5px"
      >
        <v-card-title>{{
          $t("settings.add_music_provider", [availableProviders[config.domain].name])
        }}</v-card-title>
        <v-card-subtitle>{{
          availableProviders[config.domain].description
        }}</v-card-subtitle>
        <v-card-subtitle v-if="availableProviders[config.domain].codeowners.length"
          ><b>{{ $t("settings.codeowners") }}: </b
          ><span v-for="codeowner in availableProviders[config.domain].codeowners"
            ><a :href="getCodeOwnerLink(codeowner)" target="_blank"
              >{{ codeowner }}
            </a>
          </span></v-card-subtitle
        >
        <v-card-subtitle v-if="availableProviders[config.domain].documentation"
          ><a
            :href="availableProviders[config.domain].documentation"
            target="_blank"
            >{{ $t("settings.documentation") }}</a
          ></v-card-subtitle
        >
      </div>
      <br />
      <v-divider />
      <br />
      <br />
      <edit-config
        v-if="config"
        :modelValue="config"
        @update:modelValue="onSubmit($event as ProviderConfig)"
      />
    </v-card-text>
  </section>
</template>

<script setup lang="ts">
import { reactive, ref } from "vue";
import { useRouter } from "vue-router";
import { api } from "@/plugins/api";
import { ProviderConfig, ProviderManifest } from "@/plugins/api/interfaces";
import EditConfig from "./EditConfig.vue";
import { watchEffect } from "vue";
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

// watchers
watchEffect(async () => {
  if (props.domain || props.instanceId) {
    store.loading = true;
    const manifests: ProviderManifest[] = await api.getData(
      "providers/available"
    );
    for (const prov of manifests) {
      availableProviders[prov.domain] = prov;
    }
    if (props.domain) {
      // create a default config using the helper on the server
      config.value = await api.getData("config/providers/create", {
        provider_domain: props.domain,
      });
    } else {
      config.value = await api.getData("config/providers/get", {
        instance_id: props.instanceId,
      });
    }

    store.loading = false;
  }
});

// methods
const onSubmit = async function (value: ProviderConfig) {
  api.sendCommand("config/providers/set", { config: value });
  router.push({ name: "settings" });
};
const getCodeOwnerLink = function (value: string) {
  if (value.startsWith("@")) {
    return `https://github.com/${value.replace("@", "")}`;
  } else if (value.startsWith("http")) {
    return value;
  } else if (value.includes(".")) {
    return `https://${value}`;
  }
  return "";
};
</script>

<style scoped></style>
