<template>
  <!-- players side menu -->
  <v-navigation-drawer
    v-model="store.showPlayersMenu"
    location="right"
    app
    clipped
    temporary
    width="300"
    style="z-index: 99999"
  >
    <!-- heading with Players as title-->
    <v-card-title class="headline">
      <b>{{ $t("players") }}</b>
    </v-card-title>

    <!-- close button in the top right (accessibility reasons)-->
    <v-btn
      variant="plain"
      style="position: absolute; right: -10px; top: 0px"
      icon="mdi-close"
      dark
      text
      @click="store.showPlayersMenu = !store.showPlayersMenu"
    />
    <v-divider />

    <!-- collapsable player rows-->
    <v-expansion-panels v-model="panelItem" focusable accordion flat>
      <v-expansion-panel
        v-for="player in sortedPlayers"
        :id="player.player_id"
        :key="player.player_id"
        :disabled="!player.available"
        flat
      >
        <v-expansion-panel-title
          class="playerrow"
          :style="
            store.selectedPlayer?.player_id == player.player_id
              ? 'padding:0;background-color:rgba(50, 115, 220, 0.2);'
              : 'padding:0'
          "
          expand-icon="mdi-chevron-down"
          collapse-icon="mdi-chevron-up"
          @click="
            store.selectedPlayer = player;
            scrollToTop(player.player_id);
          "
        >
          <v-list-item density="compact">
            <template #prepend>
              <v-icon
                size="50"
                :icon="
                  player.group_childs.length > 0
                    ? 'mdi-speaker-multiple'
                    : 'mdi-speaker'
                "
                color="accent"
                style="
                  padding-left: 0px;
                  padding-right: 0px;
                  margin-left: -10px;
                  margin-right: 10px;
                  width: 42px;
                  height: 50px;
                "
              />
            </template>
            <template #title>
              <div class="text-subtitle-1">
                <b>{{ player.display_name.substring(0, 26) }}</b>
              </div>
            </template>
            <template #subtitle>
              <div
                :key="player.state"
                class="text-body-2"
                style="line-height: 1em"
              >
                {{ $t("state." + player.state) }}
              </div>
            </template>
          </v-list-item>
        </v-expansion-panel-title>
        <v-expansion-panel-text variant="contain">
          <VolumeControl :player="player" />
        </v-expansion-panel-text>
      </v-expansion-panel>
    </v-expansion-panels>
  </v-navigation-drawer>
</template>

<script setup lang="ts">
import { computed, getCurrentInstance, onMounted, ref, watch } from "vue";
import type { Player } from "../../plugins/api/interfaces";
import { store } from "../../plugins/store";
import VolumeControl from "../../components/VolumeControl.vue";
import { api } from "../../plugins/api";

const panelItem = ref<number | undefined>(undefined);

// computed properties
const sortedPlayers = computed(() => {
  const res: Player[] = [];
  for (const player_id in api?.players) {
    const player = api?.players[player_id];
    if (player.synced_to) continue;
    res.push(player);
  }
  return res
    .slice()
    .sort((a, b) => (a.name.toUpperCase() > b.name.toUpperCase() ? 1 : -1));
});

//watchers
watch(
  () => store.showPlayersMenu,
  (newVal) => {
    if (!newVal) {
      panelItem.value = undefined;
    }
  }
);

const shadowRoot = ref<ShadowRoot>();
const lastClicked = ref();
onMounted(() => {
  shadowRoot.value = getCurrentInstance()?.vnode?.el?.getRootNode();
});
const scrollToTop = function (playerId: string) {
  if (lastClicked.value == playerId) return;
  lastClicked.value = playerId;
  setTimeout(() => {
    const elmnt = shadowRoot.value?.getElementById(playerId);
    elmnt?.scrollIntoView({ behavior: "smooth" });
  }, 0);
};
</script>

<style>
.playerrow {
  height: 60px;
  margin-right: 15px;
}

div.v-expansion-panel-text__wrapper {
  padding-left: 0px;
  padding-right: 0px;
  padding-top: 0px;
  padding-bottom: 0px;
}

div.v-expansion-panel--active:not(:first-child),
.v-expansion-panel--active + .v-expansion-panel {
  margin-top: 0px;
}
div.v-expansion-panel__shadow {
  box-shadow: none;
}
/* .v-expansion-panel-title.v-expansion-panel-title__icon {
  margin-right: 15px;
} */
.v-expansion-panel-title__icon {
    display: inline-flex;
    margin-bottom: -4px;
    margin-top: -4px;
    user-select: none;
    margin-inline-start: auto;
    margin-right: 5px;
}
</style>
