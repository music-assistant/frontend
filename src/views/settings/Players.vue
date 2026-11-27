<template>
  <div class="flex flex-col gap-6 p-6 max-md:gap-5 max-md:px-3 max-md:py-4">
    <SettingsPageHeader page="players" />
    <SettingsPageLinks section="players" />

    <SettingsListPanel
      :title="$t('players')"
      :count="filteredPlayers.length"
      :view-mode="viewMode"
      :actions="actions"
      data-testid="player-list"
      @toggle-view-mode="playersViewMode.toggleViewMode()"
    >
      <template #filters>
        <PlayerFilters
          @update:search="searchQuery = $event"
          @update:providers="selectedProviders = $event"
          @update:types="selectedPlayerTypes = $event"
          @update:statuses="selectedStatuses = $event"
        />
      </template>
      <div class="space-y-6">
        <section
          v-for="section in sections"
          :key="section.key"
          class="space-y-3"
          data-testid="player-section"
          :data-section="section.key"
        >
          <!-- the panel heads the players, the other kinds of devices follow
               under a heading of their own -->
          <h3
            v-if="section.key !== 'players'"
            class="m-0 text-sm font-medium text-muted-foreground"
          >
            {{ $t(section.label) }}
          </h3>
          <ItemGroup v-if="viewMode === 'list'" class="gap-2">
            <SettingsPlayerRow
              v-for="item in section.items"
              :key="item.player_id"
              :player-config="item"
              @click="handlePlayerClick"
              @menu="(evt, config) => onMenu(evt, config)"
              @setup="(config) => startPlayerSetup(config.player_id)"
            />
          </ItemGroup>

          <div
            v-else
            class="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3"
          >
            <SettingsPlayerCard
              v-for="item in section.items"
              :key="item.player_id"
              :player-config="item"
              @click="handlePlayerClick"
              @menu="(evt, config) => onMenu(evt, config)"
              @setup="(config) => startPlayerSetup(config.player_id)"
            />
          </div>
        </section>
      </div>

      <FilterEmptyState
        v-if="filteredPlayers.length === 0"
        :icon="VolumeOff"
        data-testid="players-empty"
      />
    </SettingsListPanel>

    <div
      v-if="canAddPlayerProviders"
      class="missing-players-hint flex items-center justify-center gap-1.5 text-[13px] text-muted-foreground"
    >
      <Info class="size-4 shrink-0" aria-hidden="true" />
      <i18n-t keypath="settings.missing_players_hint" tag="span" scope="global">
        <router-link
          :to="PLAYER_PROVIDERS_ROUTE"
          class="text-primary no-underline hover:underline"
        >
          {{ $t("settings.add_player_providers") }}
        </router-link>
      </i18n-t>
    </div>
  </div>
</template>

<script setup lang="ts">
import FilterEmptyState from "@/components/FilterEmptyState.vue";
import PlayerFilters from "@/components/PlayerFilters.vue";
import SettingsPlayerRow from "@/components/settings/players/SettingsPlayerRow.vue";
import SettingsPageHeader from "@/components/settings/SettingsPageHeader.vue";
import SettingsListPanel, {
  type SettingsPanelAction,
} from "@/components/settings/SettingsListPanel.vue";
import SettingsPageLinks from "@/components/settings/SettingsPageLinks.vue";
import SettingsPlayerCard from "@/components/SettingsPlayerCard.vue";
import { ItemGroup } from "@/components/ui/item";

import type { ToolBarMenuItem } from "@/components/Toolbar.vue";
import { useSettingsPlayerList } from "@/composables/settings/players/useSettingsPlayerList";
import { getEventPosition } from "@/composables/useHoldToOpenMenu";
import { useSettingsPageMenu } from "@/composables/useSettingsPageMenu";
import { getGroupKinds } from "@/helpers/player_group";
import {
  getPlayerSettingsMenuItems,
  removeUnavailablePlayers,
} from "@/helpers/player_settings_actions";
import { providerListRoute } from "@/helpers/settings_sections";

import { api } from "@/plugins/api";
import { PlayerConfig, ProviderType, Scope } from "@/plugins/api/interfaces";
import { authManager } from "@/plugins/auth";
import { eventbus } from "@/plugins/eventbus";
import { $t } from "@/plugins/i18n";
import { EyeOff, Info, Plus, Trash2, VolumeOff } from "@lucide/vue";
import { computed, inject, markRaw, onBeforeUnmount, watch } from "vue";
import { useRouter } from "vue-router";

// the list of the player providers
const PLAYER_PROVIDERS_ROUTE = providerListRoute(ProviderType.PLAYER);

// global refs
const router = useRouter();

const playersViewMode = inject<{
  viewMode: { value: "list" | "card" };
  toggleViewMode: () => void;
}>("playersViewMode")!;

const viewMode = computed(() => playersViewMode.viewMode.value);

const {
  playerConfigs,
  searchQuery,
  selectedProviders,
  selectedPlayerTypes,
  selectedStatuses,
  hideUnavailable,
  filteredPlayers,
  sections,
  toggleHideUnavailable,
  dropPlayerConfigs,
  loadItems,
} = useSettingsPlayerList();

// computed properties
const actions = computed<SettingsPanelAction[]>(() =>
  getGroupKinds(api.providers, api.providerManifests).length > 0
    ? [
        {
          key: "add-player-group",
          label: $t("settings.add_group_player"),
          icon: markRaw(Plus),
          onSelect: () => {
            // the list does not hear of a new player, so it is read again
            eventbus.emit("addGroupDialog", {
              onCreated: () => void loadItems(),
            });
          },
        },
      ]
    : [],
);
// the hint leads to adding player providers, which takes config.providers.write
const canAddPlayerProviders = computed(() =>
  authManager.hasScope(Scope.CONFIG_PROVIDERS_WRITE),
);
const canRemovePlayers = computed(() =>
  authManager.hasScope(Scope.CONFIG_PLAYERS_WRITE),
);

const pageMenu = useSettingsPageMenu();
const pageMenuItems = computed<ToolBarMenuItem[]>(() => {
  const items: ToolBarMenuItem[] = [
    {
      label: "settings.hide_unavailable_players",
      icon: markRaw(EyeOff),
      action: toggleHideUnavailable,
      active: hideUnavailable.value,
    },
  ];
  if (canRemovePlayers.value) {
    items.push({
      label: "settings.remove_unavailable_players",
      icon: markRaw(Trash2),
      // the server decides which players it removes, whatever the list shows
      action: () =>
        removeUnavailablePlayers(playerConfigs.value, dropPlayerConfigs),
    });
  }
  return items;
});
watch(
  pageMenuItems,
  (items) => {
    pageMenu.value = items;
  },
  { immediate: true },
);
onBeforeUnmount(() => {
  pageMenu.value = [];
});

// methods
const editPlayer = function (playerId: string) {
  router.push(`/settings/editplayer/${playerId}`);
};

const startPlayerSetup = function (playerId: string) {
  eventbus.emit("setupFlowDialog", { kind: "player", playerId });
};

const handlePlayerClick = function (playerConfig: PlayerConfig) {
  if (
    playerConfig.enabled &&
    api.players[playerConfig.player_id]?.needs_setup
  ) {
    startPlayerSetup(playerConfig.player_id);
    return;
  }
  editPlayer(playerConfig.player_id);
};

const onMenu = function (evt: Event, playerConfig: PlayerConfig) {
  // the list has no PLAYER_REMOVED/PLAYER_CONFIG_REMOVED subscription, so a
  // deleted player has to be dropped from it here
  const menuItems = getPlayerSettingsMenuItems(playerConfig, {
    includeSections: true,
    onDeleted: () => dropPlayerConfigs([playerConfig.player_id]),
    // one player went
    onMerged: () => void loadItems(),
  });
  const position = getEventPosition(evt);
  eventbus.emit("contextmenu", {
    items: menuItems,
    posX: position.x,
    posY: position.y,
  });
};
</script>
