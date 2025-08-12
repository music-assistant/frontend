<template>
  <section>
    <v-card-text>
      <!-- header -->
      <div style="margin-left: -5px; margin-right: -5px">
        <v-card-title>
          {{ $t("settings.add_group_player") }}
        </v-card-title>
        <v-card-subtitle
          v-if="providerDetails?.lookup_key === 'universal_group'"
          style="white-space: break-spaces"
          v-html="
            markdownToHtml($t('settings.add_group_player_desc_universal'))
          "
        />
        <v-card-subtitle
          v-else
          style="white-space: break-spaces"
          v-html="
            markdownToHtml(
              $t('settings.add_group_player_desc', [providerDetails?.name]),
            )
          "
        />
        <br />
        <v-divider />
        <br />
        <br />
        <v-form ref="form" v-model="valid" style="margin-right: 10px">
          <!-- name field -->
          <v-text-field
            v-model="name"
            :label="$t('settings.player_name')"
            variant="outlined"
            clearable
            required
            :rules="[(v) => v.length || $t('settings.invalid_input')]"
          />
          <!-- dynamic mode -->
          <v-switch
            v-model="dynamic"
            color="primary"
            :label="$t('settings.dynamic_members.label')"
          />
          <v-card-subtitle
            v-if="providerDetails?.lookup_key !== 'universal_group'"
            style="
              white-space: break-spaces;
              padding-left: 0;
              margin-top: -25px;
              margin-bottom: 35px;
            "
          >
            {{ $t("settings.dynamic_members.description") }}
          </v-card-subtitle>

          <!-- dropdown with group members -->
          <v-select
            v-model="members"
            clearable
            multiple
            :items="syncPlayers"
            item-title="display_name"
            item-value="player_id"
            :label="$t('settings.group_members')"
          />
          <br />
          <v-btn
            block
            color="primary"
            :disabled="!valid || (members.length == 0 && !dynamic)"
            @click="onSubmit"
          >
            {{ $t("settings.save") }}
          </v-btn>
        </v-form>
        <br />
        <v-btn block @click="router.back()">
          {{ $t("close") }}
        </v-btn>
      </div>
    </v-card-text>
  </section>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { useRouter } from "vue-router";
import { api } from "@/plugins/api";
import { markdownToHtml } from "@/helpers/utils";

// global refs
const router = useRouter();
const name = ref<string>("");
const members = ref<string[]>([]);
const dynamic = ref<boolean>(false);
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
  return Object.values(api.players).filter(
    (x) => x.available && x.provider == providerDetails.value?.lookup_key,
  );
});

// methods
const onSubmit = async function () {
  api.createPlayerGroup(
    props.provider,
    name.value,
    members.value,
    dynamic.value,
  );
  router.push({ name: "playersettings" });
};
</script>
