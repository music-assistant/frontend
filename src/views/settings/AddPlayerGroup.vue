<template>
  <section>
    <v-card-text>
      <!-- header -->
      <div style="margin-left: -5px; margin-right: -5px">
        <v-card-title>
          {{ $t("settings.add_group_player") }}
        </v-card-title>
        <v-card-subtitle
          v-if="providerDetails?.domain === 'universal_group'"
          style="white-space: break-spaces"
          v-html="
            markdownToHtml($t('settings.add_group_player_desc_universal'))
          "
        />
        <v-card-subtitle
          v-else-if="providerDetails?.domain === 'sync_group'"
          style="white-space: break-spaces"
          v-html="markdownToHtml($t('settings.add_group_player_desc_sync'))"
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
            :rules="[(v) => v.length > 0 || $t('settings.invalid_input')]"
          />
          <!-- dropdown with group members -->
          <v-select
            v-model="members"
            clearable
            multiple
            :items="syncPlayers"
            item-title="name"
            item-value="player_id"
            :label="$t('settings.group_members')"
          />
          <!-- dynamic mode -->
          <v-switch
            v-model="dynamic"
            color="primary"
            :label="$t('settings.dynamic_members.label')"
          />
          <v-card-subtitle
            v-if="providerDetails?.domain !== 'universal_group'"
            style="
              white-space: break-spaces;
              padding-left: 0;
              margin-top: -25px;
              margin-bottom: 35px;
            "
          >
            {{ $t("settings.dynamic_members.description") }}
          </v-card-subtitle>
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
import { PlayerFeature, PlayerType } from "@/plugins/api/interfaces";

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
  if (props.provider === "universal_group") {
    // for universal groups, show all available non-group players, regardless of provider
    return Object.values(api.players)
      .filter((x) => x.available && x.type != PlayerType.GROUP && !x.hide_in_ui)
      .sort((a, b) =>
        (a.name ?? "")
          .toUpperCase()
          .localeCompare((b.name ?? "").toUpperCase()),
      );
  }
  if (props.provider === "sync_group") {
    // for sync groups, show all available non-group players that are sync compatible
    return Object.values(api.players)
      .filter((x) => {
        if (!x.available || x.type === PlayerType.GROUP || x.hide_in_ui)
          return false;
        if (!x.supported_features.includes(PlayerFeature.SET_MEMBERS))
          return false;
        // If a player is temporarily synced, can_group_with will be empty.
        // In that case, use the sync leader's can_group_with as a proxy.
        let canGroupWith = x.can_group_with;
        if (
          canGroupWith.length === 0 &&
          x.synced_to &&
          api.players[x.synced_to]
        ) {
          canGroupWith = api.players[x.synced_to].can_group_with;
        }
        if (canGroupWith.length === 0) return false;
        if (members.value.length === 0) return true;
        if (members.value.includes(x.player_id)) return true;
        return members.value.some((m) => canGroupWith.includes(m));
      })
      .sort((a, b) =>
        (a.name ?? "")
          .toUpperCase()
          .localeCompare((b.name ?? "").toUpperCase()),
      );
  }
  return Object.values(api.players)
    .filter(
      (x) =>
        x.available &&
        x.type != PlayerType.GROUP &&
        !x.hide_in_ui &&
        x.provider == providerDetails.value?.instance_id,
    )
    .sort((a, b) =>
      (a.name ?? "").toUpperCase().localeCompare((b.name ?? "").toUpperCase()),
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
