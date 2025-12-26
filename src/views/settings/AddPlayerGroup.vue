<template>
  <v-container fluid class="pa-6">
    <v-row>
      <v-col cols="12" md="8" offset-md="2">
        <v-card>
          <v-card-item>
            <template #prepend>
              <v-icon icon="mdi-account-group" size="32" class="mr-2" />
            </template>
            <v-card-title>{{ $t("settings.add_group_player") }}</v-card-title>
            <v-card-subtitle>
              {{ providerDetails?.name }}
            </v-card-subtitle>
          </v-card-item>

          <v-divider />

          <v-card-text class="pa-6">
            <div
              v-if="providerDetails?.domain === 'universal_group'"
              class="text-body-2 text-medium-emphasis mb-6"
              v-html="
                markdownToHtml($t('settings.add_group_player_desc_universal'))
              "
            ></div>
            <div
              v-else
              class="text-body-2 text-medium-emphasis mb-6"
              v-html="
                markdownToHtml(
                  $t('settings.add_group_player_desc', [providerDetails?.name]),
                )
              "
            ></div>

            <v-form ref="form" v-model="valid" @submit.prevent="onSubmit">
              <v-text-field
                v-model="name"
                :label="$t('settings.player_name')"
                variant="outlined"
                class="mb-4"
                required
                :rules="[(v) => !!v || $t('settings.invalid_input')]"
              />

              <v-select
                v-model="members"
                :items="syncPlayers"
                item-title="display_name"
                item-value="player_id"
                :label="$t('settings.group_members')"
                variant="outlined"
                multiple
                chips
                closable-chips
                class="mb-4"
              />

              <v-switch
                v-model="dynamic"
                color="primary"
                :label="$t('settings.dynamic_members.label')"
                hide-details
                class="mb-2"
              />

              <div
                v-if="providerDetails?.domain !== 'universal_group'"
                class="text-caption text-medium-emphasis ml-10 mb-6"
              >
                {{ $t("settings.dynamic_members.description") }}
              </div>
            </v-form>
          </v-card-text>

          <v-divider />

          <v-card-actions class="pa-4">
            <v-spacer />
            <v-btn variant="text" @click="router.back()">
              {{ $t("close") }}
            </v-btn>
            <v-btn
              color="primary"
              :disabled="!valid || (members.length == 0 && !dynamic)"
              @click="onSubmit"
            >
              {{ $t("settings.save") }}
            </v-btn>
          </v-card-actions>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { useRouter } from "vue-router";
import { api } from "@/plugins/api";
import { markdownToHtml } from "@/helpers/utils";
import { PlayerType } from "@/plugins/api/interfaces";

// global refs
const router = useRouter();
const name = ref<string>("");
const members = ref<string[]>([]);
const dynamic = ref<boolean>(true);
const valid = ref<boolean>(false);

// props
const props = defineProps<{
  provider: string;
}>();

// computed properties
const providerDetails = computed(() => {
  return api.getProvider(props.provider);
});

const syncPlayers = computed(() => {
  return Object.values(api.players)
    .filter(
      (x) =>
        x.available &&
        x.type != PlayerType.GROUP &&
        (x.provider == providerDetails.value?.instance_id ||
          props.provider === "universal_group"),
    )
    .sort((a, b) =>
      (a.display_name || a.name).localeCompare(b.display_name || b.name),
    );
});

// methods
const onSubmit = async function () {
  if (!valid.value) return;

  try {
    await api.createPlayerGroup(
      props.provider,
      name.value,
      members.value,
      dynamic.value,
    );
    router.push({ name: "playersettings" });
  } catch (err) {
    console.error(err);
  }
};
</script>
