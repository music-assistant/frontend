<template>
  <Card
    v-hold="onHold"
    class="relative justify-center gap-0 rounded-lg p-2 shadow-none transition-colors"
    :class="{
      'border-primary bg-primary/15': player.player_id === store.activePlayerId,
      'ring-primary/50 ring-1':
        showSelectedIndicator && player.player_id === store.activePlayerId,
      'pt-4':
        showSelectedIndicator && player.player_id === store.activePlayerId,
      'opacity-80':
        !player.needs_setup && player.playback_state === PlaybackState.IDLE,
      'opacity-60': !player.needs_setup && player.powered === false,
      'opacity-40': !player.available && !player.needs_setup,
    }"
    @click.capture="swallowClickAfterHold"
    @contextmenu.prevent.stop="openPlayerMenu"
    @touchstart.passive="onTouchStart"
  >
    <Badge
      v-if="showSelectedIndicator && player.player_id === store.activePlayerId"
      as="span"
      class="selected-player-badge absolute -top-2 left-3 z-10 h-5 rounded-full px-2.5 py-0 text-[11px] leading-none shadow-xs"
    >
      {{ $t("player_tip.selected_player") }}
    </Badge>
    <div class="flex min-w-0 items-center gap-1">
      <div class="relative flex min-w-0 flex-1">
        <button
          type="button"
          class="player-select-action focus-visible:ring-ring absolute inset-0 z-0 rounded-md text-left outline-none focus-visible:ring-2"
          :disabled="!player.available && !player.needs_setup"
          @click="emit('click', player)"
        >
          <span class="sr-only">
            {{
              player.needs_setup
                ? $t("configure_player")
                : $t("tooltip.select_player")
            }}:
            {{ accessiblePlayerLabel }}
            <template v-if="player.needs_setup">
              . {{ $t("settings.setup_required") }}
            </template>
            <template v-else-if="playerStatus">
              . {{ $t(playerStatus) }}
            </template>
          </span>
        </button>
        <div
          class="player-card-main pointer-events-none relative z-[1] flex min-w-0 flex-1"
          :class="
            useStackedMediaLayout ? 'flex-col gap-1.5' : 'items-center gap-3'
          "
        >
          <PlayerCardTitle
            v-if="useStackedMediaLayout"
            :player-name="cardPlayerName"
            :member-names="displayedGroupMemberNames"
            :member-layout="groupMemberLayout"
          >
            <PlayerDeviceBadge v-if="isBuiltinPlayer(player)" />
          </PlayerCardTitle>
          <div
            class="player-card-media-row"
            :class="
              useStackedMediaLayout
                ? 'flex min-w-0 items-center gap-3'
                : 'contents'
            "
          >
            <div
              class="bg-muted flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-md"
            >
              <img
                v-if="artworkUrl"
                :src="artworkUrl"
                alt=""
                class="size-full object-cover"
                loading="lazy"
                @error="artworkFailed = true"
              />
              <PlayerIcon
                v-else
                :icon="player.icon"
                :grouped="
                  player.type === PlayerType.PLAYER &&
                  player.group_members.some(
                    (playerId) => playerId !== player.player_id,
                  )
                "
                :size="24"
                class="opacity-80"
              />
            </div>

            <div class="min-w-0 flex-1 py-0.5">
              <PlayerCardTitle
                v-if="!useStackedMediaLayout"
                :player-name="cardPlayerName"
                :member-names="displayedGroupMemberNames"
                :member-layout="groupMemberLayout"
              >
                <PlayerDeviceBadge v-if="isBuiltinPlayer(player)" />
              </PlayerCardTitle>
              <Badge
                v-if="player.needs_setup"
                variant="secondary"
                class="mt-0.5 gap-1 text-[10px]"
                :style="{ color: 'rgb(var(--v-theme-warning))' }"
              >
                <TriangleAlert class="size-3" />
                {{ $t("settings.setup_required") }}
              </Badge>
              <p
                v-if="player.powered !== false && player.current_media?.title"
                class="truncate text-xs font-medium"
              >
                {{ player.current_media.title }}
              </p>
              <p
                v-if="player.powered !== false && mediaByline"
                class="text-muted-foreground truncate text-xs"
              >
                {{ mediaByline }}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div
        class="player-card-actions flex shrink-0 items-center"
        :class="{ 'self-end mb-1.5': useStackedMediaLayout }"
      >
        <Button
          v-if="
            player.power_control !== PLAYER_CONTROL_NONE &&
            allowPowerControl &&
            !player.powered
          "
          variant="ghost"
          size="icon-sm"
          :disabled="!player.available"
          :aria-label="$t('tooltip.toggle_power')"
          @click.stop="api.playerCommandPowerToggle(player.player_id)"
        >
          <Power class="size-5" />
        </Button>

        <Button
          v-if="canPlayPause"
          variant="ghost"
          size="icon-sm"
          :disabled="!player.available || playActionInProgress"
          :aria-label="
            player.playback_state === PlaybackState.PLAYING
              ? $t('pause')
              : $t('play')
          "
          @click.stop="api.playerCommandPlayPause(player.player_id)"
        >
          <Spinner v-if="playActionInProgress" class="size-5" />
          <Pause
            v-else-if="player.playback_state === PlaybackState.PLAYING"
            class="size-5"
          />
          <Play v-else class="size-5" />
        </Button>

        <Button
          v-if="showGroupControl"
          data-player-group-control
          variant="ghost"
          size="icon-sm"
          :disabled="!player.available || !canEditGroupMembers"
          :aria-label="`${$t('tooltip.group_members')}: ${groupMemberCount}`"
          :aria-controls="groupControlsExpanded ? groupControlsId : undefined"
          :aria-expanded="groupControlsExpanded"
          @click.stop="toggleMemberControls"
        >
          <PlayerGroupIcon
            :count="groupMemberCount"
            outset-count
            class="size-5"
          />
        </Button>

        <Button
          v-if="showMenuButton"
          variant="ghost"
          size="icon-sm"
          :class="{ '-ml-1': showGroupControl || canPlayPause }"
          :disabled="!player.available"
          :aria-label="$t('tooltip.more_options')"
          @click.stop="openPlayerMenu"
        >
          <EllipsisVertical class="size-5" />
        </Button>
      </div>
    </div>

    <VolumeControl
      v-if="showVolumeControl || showMemberControls"
      :id="showMemberControls ? groupControlsId : undefined"
      :player="player"
      :show-member-controls="player.available && showMemberControls"
      :show-child-volumes="player.available && showChildVolumes"
      :show-volume-control="showVolumeControl && player.powered !== false"
      :allow-wheel="false"
      @toggle-child-volumes="emit('toggle-child-volumes', player)"
    />
  </Card>
</template>

<script setup lang="ts">
import PlayerCardTitle from "@/components/PlayerCardTitle.vue";
import PlayerDeviceBadge from "@/components/PlayerDeviceBadge.vue";
import PlayerGroupIcon from "@/components/PlayerGroupIcon.vue";
import PlayerIcon from "@/components/PlayerIcon.vue";
import VolumeControl from "@/components/VolumeControl.vue";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { useActiveSource } from "@/composables/activeSource";
import {
  getEventPosition,
  useHoldToOpenMenu,
} from "@/composables/useHoldToOpenMenu";
import { getPlayerMenuItems } from "@/helpers/player_menu_items";
import {
  canEditPlayerGroup,
  getPlayerGroupMemberCount,
  isBuiltinPlayer,
} from "@/helpers/players";
import { isQueueEnded } from "@/helpers/queue_position";
import { getMediaImageUrl, getPlayerName } from "@/helpers/utils";
import api from "@/plugins/api";
import { resolvePlayerQueue } from "@/plugins/api/helpers";
import {
  PlaybackState,
  type Player,
  PLAYER_CONTROL_NONE,
  PlayerType,
} from "@/plugins/api/interfaces";
import { eventbus } from "@/plugins/eventbus";
import { store } from "@/plugins/store";
import {
  EllipsisVertical,
  Pause,
  Play,
  Power,
  TriangleAlert,
} from "@lucide/vue";
import { computed, ref, toRef, watch } from "vue";

export interface Props {
  player: Player;
  showVolumeControl?: boolean;
  showMenuButton?: boolean;
  showChildVolumes?: boolean;
  showMemberControls?: boolean;
  showGroupControls?: boolean;
  showGroupMemberNames?: boolean;
  groupMemberLayout?: "subtitle" | "subtitle-list" | "title-list";
  stackMediaDetails?: boolean;
  allowPowerControl?: boolean;
  showDisabledGroupControl?: boolean;
  groupControlExpanded?: boolean;
  groupControlsId?: string;
  showSelectedIndicator?: boolean;
}
const props = withDefaults(defineProps<Props>(), {
  groupMemberLayout: "subtitle",
  groupControlsId: undefined,
});
const emit = defineEmits<{
  (event: "click", player: Player): void;
  (event: "toggle-child-volumes", player: Player): void;
  (event: "toggle-member-controls", player: Player, trigger: HTMLElement): void;
}>();

const artworkFailed = ref(false);
const { activeSource } = useActiveSource(toRef(props, "player"));

const playerQueue = computed(() => resolvePlayerQueue(props.player));

const artworkUrl = computed(() => {
  if (
    artworkFailed.value ||
    props.player.powered === false ||
    !props.player.current_media?.image_url ||
    (props.player.playback_state !== PlaybackState.PLAYING &&
      props.player.playback_state !== PlaybackState.PAUSED)
  ) {
    return undefined;
  }
  return getMediaImageUrl(props.player.current_media.image_url);
});

const mediaByline = computed(() =>
  [props.player.current_media?.artist, props.player.current_media?.album]
    .filter(Boolean)
    .join(" • "),
);

const hasMediaDetails = computed(
  () =>
    props.player.powered !== false &&
    Boolean(props.player.current_media?.title || mediaByline.value),
);

const useStackedMediaLayout = computed(
  () => props.stackMediaDetails === true && hasMediaDetails.value,
);

const canPlayPause = computed(
  () => activeSource.value?.can_play_pause === true,
);

const playActionInProgress = computed(
  () =>
    api.queues[props.player.player_id]?.extra_attributes
      ?.play_action_in_progress === true,
);

const canEditGroupMembers = computed(
  () => props.showGroupControls && canEditPlayerGroup(props.player),
);
const showGroupControl = computed(
  () =>
    props.showGroupControls &&
    (canEditGroupMembers.value || props.showDisabledGroupControl === true),
);
const groupControlsExpanded = computed(
  () => props.groupControlExpanded ?? props.showMemberControls === true,
);

const groupMemberCount = computed(() =>
  getPlayerGroupMemberCount(props.player),
);

const groupMemberNames = computed(() => {
  if (!props.showGroupMemberNames) return [];

  const childNames = [...new Set(props.player.group_members)]
    .filter((playerId) => playerId !== props.player.player_id)
    .map((playerId) => api.players[playerId])
    .filter(
      (member): member is Player =>
        Boolean(member) &&
        (props.player.type === PlayerType.GROUP || member.available),
    )
    .map((member) => member.name);

  if (childNames.length === 0 || props.player.type === PlayerType.GROUP) {
    return childNames;
  }
  return [props.player.name, ...childNames];
});

const cardPlayerName = computed(() =>
  props.groupMemberLayout === "subtitle-list" &&
  groupMemberNames.value.length > 0
    ? props.player.name
    : getPlayerName(props.player, 27),
);

const displayedGroupMemberNames = computed(() => {
  if (
    props.groupMemberLayout === "subtitle-list" &&
    props.player.type !== PlayerType.GROUP
  ) {
    return groupMemberNames.value.slice(1);
  }
  return groupMemberNames.value;
});

const accessibleGroupMemberNames = computed(() =>
  props.player.type !== PlayerType.GROUP &&
  props.groupMemberLayout !== "subtitle-list"
    ? displayedGroupMemberNames.value.slice(1)
    : displayedGroupMemberNames.value,
);

const accessiblePlayerLabel = computed(() =>
  [
    props.player.name,
    ...accessibleGroupMemberNames.value,
    props.player.current_media?.title,
    mediaByline.value,
  ]
    .filter(Boolean)
    .join(". "),
);

const playerStatus = computed(() => {
  if (mediaByline.value) return undefined;
  if (isQueueEnded(playerQueue.value)) return "queue_ended";
  if (playerQueue.value?.items === 0) return "queue_empty";
  return undefined;
});

watch(
  () => props.player.current_media?.image_url,
  () => {
    artworkFailed.value = false;
  },
);

function openPlayerMenu(event: Event) {
  event.stopPropagation();
  if (!props.player.available) return;
  const position = getEventPosition(event);
  eventbus.emit("contextmenu", {
    items: getPlayerMenuItems(props.player, playerQueue.value, {
      context: "player",
    }),
    posX: position.x,
    posY: position.y,
  });
}

function toggleMemberControls(event: MouseEvent) {
  const trigger = event.currentTarget;
  if (trigger instanceof HTMLElement) {
    emit("toggle-member-controls", props.player, trigger);
  }
}

const { onHold, onTouchStart, swallowClickAfterHold } =
  useHoldToOpenMenu(openPlayerMenu);
</script>
