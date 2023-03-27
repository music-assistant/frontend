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
        :is-builtin="availableProviders[config.domain]?.builtin"
        @update:model-value="onSubmit($event as ConfigUpdate)"
      />
    </v-card-text>
  </section>
</template>

<script setup lang="ts">
import { reactive, ref, onMounted } from "vue";
import { useRouter } from "vue-router";
import { api } from "@/plugins/api";
import { ProviderConfig, ProviderManifest, ConfigUpdate } from "@/plugins/api/interfaces";
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
const onSubmit = async function (update: ConfigUpdate) {
  api
    .getData("config/providers/update", {
      instance_id: config.value?.instance_id, update
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
