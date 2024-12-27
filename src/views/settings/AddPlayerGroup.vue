<template>
  <section>
    <v-card-text>
      <!-- header -->
      <div style="margin-left: -5px; margin-right: -5px">
        <v-card-title>
          {{ $t("settings.add_group_player") }}
        </v-card-title>
        <v-card-subtitle style="white-space: break-spaces">
          {{ $t("settings.add_group_player_desc") }}
        </v-card-subtitle>
        <br />
        <v-divider />
        <br />
        <br />
        <v-form ref="form" v-model="valid" style="margin-right: 10px">
          <!-- providertype with dropdown -->
          <v-select
            v-model="group_type"
            clearable
            :items="groupTypes"
            item-title="name"
            item-value="instance_id"
            :label="$t('settings.group_type')"
            required
            :disabled="members.length > 0"
          />
          <!-- dynamic mode -->
          <v-switch
            v-model="dynamic"
            color="primary"
            :label="$t('settings.dynamic_members.label')"
          />
          <v-card-subtitle
            style="
              white-space: break-spaces;
              padding-left: 0;
              margin-top: -25px;
              margin-bottom: 35px;
            "
          >
            {{ $t("settings.dynamic_members.description") }}
          </v-card-subtitle>
          <!-- name field -->
          <v-text-field
            v-model="name"
            :label="$t('settings.player_name')"
            variant="outlined"
            clearable
            required
          />
          <!-- value with dropdown -->
          <v-select
            v-model="members"
            clearable
            multiple
            :items="syncPlayers"
            item-title="display_name"
            item-value="player_id"
            :label="$t('settings.group_members')"
            required
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
import { ProviderFeature } from "@/plugins/api/interfaces";

// global refs
const router = useRouter();
const group_type = ref<string>("universal");
const name = ref<string>("");
const members = ref<string[]>([]);
const dynamic = ref<boolean>(false);
const valid = ref<boolean>(false);

// computed properties
const groupTypes = computed(() => {
  return [
    { name: "Universal", instance_id: "universal" },
    ...Object.values(api.providers).filter((x) =>
      x.supported_features.includes(ProviderFeature.SYNC_PLAYERS),
    ),
  ];
});

const syncPlayers = computed(() => {
  return Object.values(api.players).filter(
    (x) =>
      x.available &&
      // prevent group-in-group (for now)
      !x.provider.startsWith("player_group") &&
      (x.provider == group_type.value || group_type.value == "universal"),
  );
});

// methods
const onSubmit = async function () {
  api.createPlayerGroup(
    group_type.value,
    name.value,
    members.value,
    dynamic.value,
  );
  router.push({ name: "playersettings" });
};
</script>
