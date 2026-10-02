<template>
  <Item
    variant="outline"
    size="sm"
    class="flex-nowrap"
    :class="{ 'opacity-60': !player.enabled }"
    data-testid="onboarding-player"
  >
    <ItemMedia variant="icon">
      <PlayerIcon :icon="player.icon" aria-hidden="true" />
    </ItemMedia>
    <!-- the rename field sits over the name and label rather than in their
         place, so the row keeps its height while the name is being edited -->
    <ItemContent class="relative min-w-0">
      <ItemTitle :class="{ invisible: renaming }">{{ player.name }}</ItemTitle>
      <ItemDescription :class="{ invisible: renaming }">
        {{ player.providerLabel }}
      </ItemDescription>
      <Input
        v-if="renaming"
        ref="renameInput"
        v-model="draftName"
        class="absolute inset-0 h-full"
        :disabled="savingName"
        :aria-label="$t('settings.player_name')"
        autocomplete="off"
        data-testid="onboarding-player-name-input"
        @keydown.enter.prevent="commitRename"
        @keydown.esc="cancelRename"
        @blur="commitRename"
      />
    </ItemContent>
    <ItemActions>
      <!-- a player that is switched on but not reachable says so; one that
           still has to be set up says that instead, as its setup is why -->
      <Button
        v-if="player.enabled && player.needsSetup && canEdit"
        variant="secondary"
        size="sm"
        :title="$t('settings.player_needs_setup')"
        data-testid="onboarding-player-setup"
        @click="startSetup"
      >
        <CircleAlert class="size-4 text-amber-500" aria-hidden="true" />
        <span class="hidden sm:inline">{{ $t("settings.start_setup") }}</span>
      </Button>
      <span
        v-else-if="player.enabled && player.needsSetup"
        :title="$t('settings.player_needs_setup')"
      >
        <CircleAlert
          class="size-4 text-amber-500"
          :aria-label="$t('settings.player_needs_setup')"
        />
      </span>
      <span
        v-else-if="player.enabled && !player.available"
        :title="$t('settings.player_not_available')"
      >
        <Hourglass
          class="text-muted-foreground size-4"
          :aria-label="$t('settings.player_not_available')"
        />
      </span>
      <!-- the pencil keeps its place while the field is open, so the switch
           next to it stays put; no transition, or it is still hidden on the
           frame the closing field hands focus back to it -->
      <Button
        v-if="canEdit"
        ref="renameButton"
        variant="ghost"
        size="icon-xs"
        class="transition-none"
        :class="{ invisible: renaming }"
        :aria-label="renameLabel"
        :title="renameLabel"
        data-testid="onboarding-player-rename"
        @click="startRename"
      >
        <Pencil class="size-3.5" />
      </Button>
      <!-- named after the player alone: the switch itself says on or off -->
      <Switch
        :model-value="enabled"
        :disabled="!canEdit || !player.canToggle || savingEnabled"
        :aria-label="player.name"
        data-testid="onboarding-player-enabled"
        @update:model-value="setEnabled"
      />
    </ItemActions>
  </Item>
</template>

<script setup lang="ts">
import PlayerIcon from "@/components/PlayerIcon.vue";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item";
import { Switch } from "@/components/ui/switch";
import type { DiscoveredPlayer } from "@/composables/useOnboarding";
import {
  renamePlayer,
  setPlayerEnabled,
} from "@/helpers/player_settings_actions";
import { eventbus } from "@/plugins/eventbus";
import { $t } from "@/plugins/i18n";
import { CircleAlert, Hourglass, Pencil } from "@lucide/vue";
import { computed, nextTick, ref } from "vue";

const props = defineProps<{
  player: DiscoveredPlayer;
  // whether this user may switch players on and off and rename them
  canEdit: boolean;
}>();

const renaming = ref(false);
const draftName = ref("");
const renameInput = ref<InstanceType<typeof Input> | null>(null);
const renameButton = ref<InstanceType<typeof Button> | null>(null);
// the two saves are separate, so leaving the field by clicking the switch
// commits the name and still flips the switch
const savingName = ref(false);
const savingEnabled = ref(false);
// the state the switch was just set to, shown while the save is on its way;
// by the time it lands, the list has taken the change from the server's event
const pendingEnabled = ref<boolean | null>(null);

const enabled = computed(() => pendingEnabled.value ?? props.player.enabled);
const renameLabel = computed(() =>
  $t("onboarding.steps.players.rename", { name: props.player.name }),
);

const startRename = async function () {
  draftName.value = props.player.name;
  renaming.value = true;
  await nextTick();
  renameInput.value?.focus();
  // the whole name is selected, so typing replaces it and an arrow key edits it
  (renameInput.value?.$el as HTMLInputElement | undefined)?.select();
};

const startSetup = function () {
  eventbus.emit("setupFlowDialog", {
    kind: "player",
    playerId: props.player.player_id,
  });
};

// the field closing takes the focus with it, so it goes back to the pencil
// rather than to the dialog
const closeRename = async function () {
  renaming.value = false;
  await nextTick();
  (renameButton.value?.$el as HTMLElement | undefined)?.focus();
};

const cancelRename = function () {
  void closeRename();
};

// Enter and leaving the field both keep what was typed; an empty field hands
// the player back to the name its provider reports. Leaving the name as it is,
// custom or not, is nothing to save.
const commitRename = async function () {
  if (!renaming.value || savingName.value) return;
  const name = draftName.value.trim() || null;
  const unchanged =
    name === props.player.customName ||
    (props.player.customName === null && name === props.player.name);
  if (unchanged) {
    await closeRename();
    return;
  }
  savingName.value = true;
  try {
    // a save that did not land keeps the field open to try again or cancel
    if (await renamePlayer(props.player.player_id, name)) {
      await closeRename();
    }
  } finally {
    savingName.value = false;
  }
};

const setEnabled = async function (value: boolean) {
  if (savingEnabled.value) return;
  savingEnabled.value = true;
  pendingEnabled.value = value;
  try {
    await setPlayerEnabled(props.player.player_id, value);
  } finally {
    savingEnabled.value = false;
    pendingEnabled.value = null;
  }
};
</script>
