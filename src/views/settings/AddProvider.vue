<template>
  <section>
    <v-card-text>
      <!-- header -->
      <div
        v-if="api.providerManifests[domain]"
        style="margin-left: -5px; margin-right: -5px"
      >
        <v-card-title>
          {{
            $t("settings.setup_provider", [api.providerManifests[domain].name])
          }}
        </v-card-title>
        <v-card-subtitle>
          {{ api.providerManifests[domain].description }} </v-card-subtitle
        ><br />
        <v-card-subtitle v-if="api.providerManifests[domain].codeowners.length">
          <b>{{ $t("settings.codeowners") }}: </b
          >{{ api.providerManifests[domain].codeowners.join(" / ") }}
        </v-card-subtitle>

        <v-card-subtitle v-if="api.providerManifests[domain].documentation">
          <b>{{ $t("settings.need_help_setup_provider") }} </b>&nbsp;
          <a
            :href="
              api.getDocumentationAddress(
                api.providerManifests[domain].documentation!,
              )
            "
            target="_blank"
            >{{ $t("settings.check_docs") }}</a
          >
        </v-card-subtitle>
      </div>
      <br />
      <v-divider />
      <br />
      <br />
      <edit-config
        :config-entries="config_entries"
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
      <v-card v-if="showAuthLink" style="background-color: white">
        <v-card-title>Authenticating...</v-card-title>
        <v-card-subtitle
          >A new tab/popup should be opened where you can
          authenticate</v-card-subtitle
        >
        <v-card-actions>
          <a id="auth" href="" target="_blank"
            ><v-btn>Click here if the popup did not open</v-btn></a
          >
        </v-card-actions>
      </v-card>
      <v-progress-circular v-else indeterminate size="64" color="primary" />
    </v-overlay>
  </section>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from "vue";
import { nanoid } from "nanoid";
import { useRouter } from "vue-router";
import { api } from "@/plugins/api";
import {
  ConfigValueType,
  ConfigEntry,
  EventType,
  EventMessage,
} from "@/plugins/api/interfaces";
import EditConfig from "./EditConfig.vue";
import { watch } from "vue";

// global refs
const router = useRouter();
const config_entries = ref<ConfigEntry[]>([]);
const sessionId = nanoid(11);
const loading = ref(false);
const showAuthLink = ref(false);

// props
const props = defineProps<{
  domain: string;
}>();

onMounted(() => {
  //reload if/when item updates
  const unsub = api.subscribe(EventType.AUTH_SESSION, (evt: EventMessage) => {
    // handle AUTH_SESSION event (used for auth flows to open the auth url)
    // ignore any events that not match our session id.
    if (evt.object_id !== sessionId) return;
    const url = evt.data as string;
    // Some browsers (e.g. iOS) have a weird limitation that we're not allowed to do window.open,
    // unless a user interaction has happened. So we need to do this the hard way
    showAuthLink.value = true;
    window.setTimeout(() => {
      const a = document.getElementById("auth") as HTMLAnchorElement;
      a.setAttribute("href", url);
      a.click();
    }, 100);
  });
  onBeforeUnmount(unsub);
});

// watchers

watch(
  () => props.domain,
  async (val) => {
    if (val) {
      // fetch initial config entries (without any action) but pass along our session id
      config_entries.value = await api.getProviderConfigEntries(
        props.domain,
        undefined,
        undefined,
        {
          session_id: sessionId,
        },
      );
    }
  },
  { immediate: true },
);

// methods
const onSubmit = async function (values: Record<string, ConfigValueType>) {
  // save new provider config
  loading.value = true;
  api
    .saveProviderConfig(props.domain, values)
    .then(() => {
      router.push({ name: "providersettings" });
    })
    .catch((err) => {
      // TODO: make this a bit more fancy someday
      alert(err);
    })
    .finally(() => {
      loading.value = false;
      showAuthLink.value = false;
    });
};

const onAction = async function (
  action: string,
  values: Record<string, ConfigValueType>,
) {
  loading.value = true;
  // append existing ConfigEntry values to allow
  // values be passed between flow steps
  for (const entry of config_entries.value) {
    if (entry.value !== undefined && values[entry.key] == undefined) {
      values[entry.key] = entry.value;
    }
  }
  // ensure the session id is passed along (for auth actions)
  values["session_id"] = sessionId;
  api
    .getProviderConfigEntries(props.domain, undefined, action, values)
    .then((entries) => {
      config_entries.value = entries;
    })
    .catch((err) => {
      // TODO: make this a bit more fancy someday
      alert(err);
    })
    .finally(() => {
      loading.value = false;
      showAuthLink.value = false;
    });
};
</script>

<style scoped></style>
