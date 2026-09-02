<template>
  <template v-if="player && canEditGroup">
    <Teleport to="body">
      <Transition
        enter-active-class="transition-opacity duration-200"
        enter-from-class="opacity-0"
        leave-active-class="transition-opacity duration-200"
        leave-to-class="opacity-0"
      >
        <button
          v-if="open"
          data-player-group-backdrop
          type="button"
          :class="[
            'modal-backdrop player-group-backdrop fixed inset-x-0 top-0 z-[997]',
            store.mobileLayout
              ? 'player-group-backdrop-mobile'
              : 'player-group-backdrop-desktop',
          ]"
          :aria-label="$t('close')"
          @click.stop.prevent="handleOpenChange(false)"
        ></button>
      </Transition>
    </Teleport>

    <Popover :open="open" @update:open="handleOpenChange">
      <PopoverAnchor :reference="playerBarEndAnchor" />
      <PopoverTrigger as-child>
        <Button
          data-player-group-trigger
          variant="ghost"
          :class="[
            'player-control-button rounded-none px-1',
            floating
              ? 'size-11 rounded-full me-3'
              : 'player-bar-action player-bar-group-button h-20 w-[72px]',
          ]"
          :data-active="open"
          :data-suppress-hover="suppressHover"
          :aria-label="groupMembersLabel"
          @pointerenter="onPointerEnter"
        >
          <span v-if="floating" class="inline-flex">
            <!-- matches the track menu beside it in the floating bar -->
            <component
              :is="groupIcon"
              :stroke-width="1.5"
              class="size-7"
              aria-hidden="true"
            />
          </span>
          <template v-else>
            <span class="player-bar-action-icon">
              <component
                :is="groupIcon"
                :stroke-width="1.4"
                class="size-7"
                aria-hidden="true"
              />
            </span>
            <span class="player-bar-action-label">
              {{ groupControlLabel }}
            </span>
          </template>
        </Button>
      </PopoverTrigger>

      <PopoverContent
        data-player-panel
        side="top"
        align="end"
        :side-offset="PLAYER_BAR_POPOUT_GAP"
        :collision-padding="PLAYER_BAR_POPOUT_COLLISION_PADDING"
        :class="[
          'player-bar-popout player-group-popover flex flex-col gap-0 overflow-hidden p-0',
          store.mobileLayout
            ? 'w-[calc(100vw-2*var(--player-bar-popout-inset-x)-var(--device-inset-left)-var(--device-inset-right))]'
            : 'w-[400px] max-w-[calc(100vw-2*var(--player-bar-popout-inset-x)-var(--device-inset-left)-var(--device-inset-right))]',
        ]"
        @open-auto-focus="preventAutoFocus"
        @interact-outside="handleInteractOutside"
      >
        <PlayerGroupPanel
          v-model:filter="filter"
          :player="player"
          :members="groupMembers"
          :has-lights="hasLights"
          :has-screens="hasScreens"
          @dismiss="handleOpenChange(false)"
        />
      </PopoverContent>
    </Popover>
  </template>
</template>

<script setup lang="ts">
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { usePopoutTriggerHover } from "@/composables/usePopoutTriggerHover";
import {
  PLAYER_BAR_POPOUT_COLLISION_PADDING,
  PLAYER_BAR_POPOUT_GAP,
  playerBarEndAnchor,
} from "@/helpers/player_bar";
import type { PlayerGroupFilter } from "@/helpers/player_group";
import {
  canBeGroupMember,
  canEditPlayerGroup,
  getPlayerGroupMemberCount,
  groupMemberPickerVisible,
  isScreenPlayer,
} from "@/helpers/players";
import { api } from "@/plugins/api";
import { type Player, PlayerType } from "@/plugins/api/interfaces";
import { $t } from "@/plugins/i18n";
import { store } from "@/plugins/store";
import { CircleFadingPlus, Copy } from "@lucide/vue";
import { computed, ref, watch } from "vue";
import PlayerGroupPanel from "./PlayerGroupPanel.vue";

withDefaults(
  defineProps<{
    /** compact round trigger for the floating mobile player */
    floating?: boolean;
  }>(),
  {
    floating: false,
  },
);

const open = ref(false);
const { suppressHover, onPointerEnter } = usePopoutTriggerHover(
  () => open.value,
);
const filter = ref<PlayerGroupFilter>("all");
const player = computed(() => store.activePlayer);
const canEditGroup = computed(
  () => player.value && canEditPlayerGroup(player.value),
);
const memberCount = computed(() =>
  player.value ? getPlayerGroupMemberCount(player.value) : 0,
);
const isGrouped = computed(() => memberCount.value > 1);
const groupIcon = computed(() => (isGrouped.value ? Copy : CircleFadingPlus));
const memberCountLabel = computed(
  () => `${memberCount.value} ${$t("players")}`,
);
const groupControlLabel = computed(() =>
  isGrouped.value ? memberCountLabel.value : $t("player_type.group"),
);
// The spoken label contains the visible label and names the panel reka-ui
// associates with this trigger. A single player is an invitation to group;
// once grouped, the member count becomes useful state.
const groupMembersLabel = computed(() =>
  isGrouped.value
    ? `${$t("tooltip.group_members")}: ${memberCountLabel.value}`
    : $t("tooltip.group_members"),
);
const groupMembers = computed(() => {
  if (!player.value) return [];
  const playerIds = new Set(player.value.group_members);
  if (player.value.type !== PlayerType.GROUP) {
    playerIds.add(player.value.player_id);
  }
  return [...playerIds]
    .map((playerId) => api.players[playerId])
    .filter((member): member is Player => member?.available === true)
    .sort((left, right) =>
      left.name.localeCompare(right.name, undefined, {
        sensitivity: "base",
      }),
    );
});

const groupCandidates = computed(() => {
  if (!player.value) return [];
  const memberIds = new Set(player.value.group_members);
  return Object.values(api.players).filter(
    (candidate) =>
      candidate.available &&
      groupMemberPickerVisible(candidate) &&
      canBeGroupMember(candidate) &&
      candidate.type !== PlayerType.GROUP &&
      (!candidate.active_group ||
        candidate.active_group === player.value?.player_id) &&
      (memberIds.has(candidate.player_id) ||
        (candidate.player_id !== player.value?.player_id &&
          (player.value?.can_group_with.includes(candidate.player_id) ||
            player.value?.can_group_with.includes(candidate.provider)))),
  );
});

const hasLights = computed(() =>
  groupCandidates.value.some(
    (candidate) => candidate.type === PlayerType.LIGHT,
  ),
);
const hasScreens = computed(() =>
  groupCandidates.value.some((candidate) => isScreenPlayer(candidate)),
);

watch(
  () => store.activePlayerId,
  () => handleOpenChange(false),
);

watch([hasLights, hasScreens], () => {
  if (
    (filter.value === "lights" && !hasLights.value) ||
    (filter.value === "screens" && !hasScreens.value)
  ) {
    filter.value = "all";
  }
});

function handleOpenChange(value: boolean) {
  open.value = value;
  if (!value) filter.value = "all";
}

function preventAutoFocus(event: Event) {
  event.preventDefault();
}

function handleInteractOutside(event: Event) {
  const originalEvent = (event as CustomEvent<{ originalEvent?: Event }>).detail
    ?.originalEvent;
  const target = originalEvent?.target;
  if (
    target instanceof Element &&
    target.closest(
      "[data-player-group-trigger], [data-player-group-backdrop], [data-slot='dropdown-menu-content']",
    )
  ) {
    event.preventDefault();
  }
}
</script>

<style>
.player-group-backdrop-desktop {
  bottom: var(--bottom-bars-height) !important;
}

.player-group-backdrop-mobile {
  bottom: var(--mobile-navigation-height) !important;
}

/* the paired class outweighs the equally-!important z-index utility the popover
   component carries */
.player-bar-popout.player-group-popover {
  z-index: 998 !important;
}
</style>
