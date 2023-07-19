<template>
  <section>
    <v-card-text>
      <!-- header -->
      <div v-if="config" style="margin-left: -5px; margin-right: -5px">
        <v-card-title>
          {{ $t('settings.setup_provider', [api.providerManifests[config.domain].name]) }}
        </v-card-title>
        <v-card-subtitle> {{ api.providerManifests[config.domain].description }} </v-card-subtitle><br />
        <v-card-subtitle v-if="api.providerManifests[config.domain].codeowners.length">
          <b>{{ $t('settings.codeowners') }}: </b>{{ api.providerManifests[config.domain].codeowners.join(' / ') }}
        </v-card-subtitle>

        <v-card-subtitle v-if="api.providerManifests[config.domain].documentation">
          <b>{{ $t('settings.need_help_setup_provider') }} </b>&nbsp;
          <a :href="api.providerManifests[config.domain].documentation" target="_blank">{{ $t('settings.check_docs') }}</a>
        </v-card-subtitle>
        <br />
        <v-divider />
        <br />
        <br />
      </div>
      <v-divider />
      <edit-config
        v-if="config"
        :config-entries="Object.values(config.values)"
        :disabled="false"
        @submit="onSubmit"
        @action="onAction"
      />
    </v-card-text>
    <v-overlay
      v-model="loading"
      scrim="true"
      persistent
      style="display: flex; align-items: center; justify-content: center"
    >
      <v-progress-circular indeterminate size="64" color="primary" />
    </v-overlay>
  </section>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { api } from '@/plugins/api';
import { CoreConfig, ConfigValueType } from '@/plugins/api/interfaces';
import EditConfig from './EditConfig.vue';
import { nanoid } from 'nanoid';

// global refs
const router = useRouter();
const config = ref<CoreConfig>();
const sessionId = nanoid(11);
const loading = ref(false);

// props
const props = defineProps<{
  domain?: string;
}>();

// watchers
watch(
  () => props.domain,
  async (val) => {
    if (val) {
      config.value = await api.getCoreConfig(val);
    }
  },
  { immediate: true },
);

// methods
const onSubmit = async function (values: Record<string, ConfigValueType>) {
  // save new provider config
  loading.value = true;
  api
    .saveCoreConfig(config.value!.domain, values)
    .then(() => {
      loading.value = false;
      router.push({ name: 'providersettings' });
    })
    .catch((err) => {
      // TODO: make this a bit more fancy someday
      alert(err);
      loading.value = false;
    });
};

const onAction = async function (action: string, values: Record<string, ConfigValueType>) {
  loading.value = true;
  // append existing ConfigEntry values to allow
  // values be passed between flow steps
  for (const entry of Object.values(config.value!.values)) {
    if (entry.value !== undefined && values[entry.key] == undefined) {
      values[entry.key] = entry.value;
    }
  }
  // ensure the session id is passed along
  values['session_id'] = sessionId;
  api
    .getCoreConfigEntries(config.value!.domain, action, values)
    .then((entries) => {
      config.value!.values = {};
      for (const entry of entries) {
        config.value!.values[entry.key] = entry;
      }
      loading.value = false;
    })
    .catch((err) => {
      // TODO: make this a bit more fancy someday
      alert(err);
      loading.value = false;
    });
};
</script>
