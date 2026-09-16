<template>
  <Item
    variant="outline"
    size="sm"
    :class="{ 'opacity-60': !player.enabled }"
    data-testid="onboarding-player"
  >
    <ItemMedia variant="icon">
      <PlayerIcon :icon="player.icon" aria-hidden="true" />
    </ItemMedia>
    <ItemContent>
      <Input
        v-if="renaming"
        ref="renameInput"
        v-model="draftName"
        class="h-8"
        :disabled="saving"
        :aria-label="$t('settings.player_name')"
        autocomplete="off"
        data-testid="onboarding-player-name-input"
        @keydown.enter.prevent="commitRename"
        @keydown.esc="cancelRename"
        @blur="commitRename"
      />
      <ItemTitle v-else>{{ player.name }}</ItemTitle>
      <ItemDescription>{{ player.providerLabel }}</ItemDescription>
    </ItemContent>
    <ItemActions>
      <!-- a player that is switched on but not reachable says so; one that
           still has to be set up says that instead, as its setup is why -->
      <CircleAlert
        v-if="player.enabled && player.needsSetup"
        class="text-muted-foreground size-4"
        :aria-label="$t('settings.player_needs_setup')"
        :title="$t('settings.player_needs_setup')"
      />
      <Hourglass
        v-else-if="player.enabled && !player.available"
        class="text-muted-foreground size-4"
        :aria-label="$t('settings.player_not_available')"
        :title="$t('settings.player_not_available')"
      />
      <Button
        v-if="canEdit && !renaming"
        variant="ghost"
        size="icon-xs"
        :aria-label="renameLabel"
        :title="renameLabel"
        data-testid="onboarding-player-rename"
        @click="startRename"
      >
        <Pencil class="size-3.5" />
      </Button>
      <Switch
        :model-value="enabled"
        :disabled="!canEdit || !player.canToggle || saving"
        :aria-label="
          $t('onboarding.steps.players.enable', { name: player.name })
        "
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
const saving = ref(false);
// the state the switch was just set to, shown while the save is on its way
// and until the list catches up
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
};

const cancelRename = function () {
  renaming.value = false;
};

// Enter and leaving the field both keep what was typed; an empty field hands
// the player back to the name its provider reports. Leaving the name as it is,
// custom or not, is nothing to save.
const commitRename = async function () {
  if (!renaming.value || saving.value) return;
  const name = draftName.value.trim() || null;
  const unchanged =
    name === props.player.customName ||
    (props.player.customName === null && name === props.player.name);
  if (unchanged) {
    renaming.value = false;
    return;
  }
  saving.value = true;
  try {
    // a save that did not land keeps the field open to try again or cancel
    if (await renamePlayer(props.player.player_id, name)) {
      renaming.value = false;
    }
  } finally {
    saving.value = false;
  }
};

const setEnabled = async function (value: boolean) {
  if (saving.value) return;
  saving.value = true;
  pendingEnabled.value = value;
  try {
    await setPlayerEnabled(props.player.player_id, value);
  } finally {
    saving.value = false;
    pendingEnabled.value = null;
  }
};
</script>
