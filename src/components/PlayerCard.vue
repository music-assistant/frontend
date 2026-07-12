<template>
  <Card
    v-hold="onHold"
    class="gap-0 rounded-lg p-2 shadow-none transition-colors"
    :class="{
      'border-primary bg-primary/15': player.player_id === store.activePlayerId,
      'opacity-80': player.playback_state === PlaybackState.IDLE,
      'opacity-60': player.powered === false,
      'opacity-40': !player.available,
    }"
    @click.capture="swallowClickAfterHold"
    @contextmenu.prevent="openPlayerMenu"
    @touchstart.passive="onTouchStart"
  >
    <div class="flex min-w-0 items-center gap-1">
      <button
        type="button"
        class="player-select-action focus-visible:ring-ring flex min-w-0 flex-1 items-center gap-3 rounded-md text-left outline-none focus-visible:ring-2"
        :disabled="!player.available"
        @click="emit('click', player)"
      >
        <span class="sr-only">{{ $t("tooltip.select_player") }}: </span>
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
          <div class="flex min-w-0 items-center gap-1.5">
            <span class="truncate text-sm font-medium">
              {{ getPlayerName(player, 27) }}
            </span>
            <Badge
              v-if="isBuiltinPlayer(player)"
              as="span"
              variant="secondary"
              class="h-5 shrink-0 gap-1 px-1.5 text-[11px]"
            >
              <Smartphone v-if="store.deviceType === 'phone'" class="size-3" />
              <Monitor v-else class="size-3" />
              <span v-if="store.deviceType !== 'phone'">
                {{ $t("this_device") }}
              </span>
            </Badge>
          </div>
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
          <span
            v-else-if="playerQueue?.items === 0"
            class="sr-only"
            :aria-label="$t('queue_empty')"
          ></span>
        </div>
      </button>

      <div class="flex shrink-0 items-center">
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
          v-if="canEditGroupMembers"
          variant="ghost"
          size="icon-sm"
          class="relative"
          :disabled="!player.available"
          :aria-label="`${$t('tooltip.group_members')}: ${groupMemberCount}`"
          :aria-pressed="showMemberControls"
          @click.stop="emit('toggle-member-controls', player)"
        >
          <Speaker class="size-5" />
          <Badge
            as="span"
            class="absolute -top-1 -right-1 h-4 min-w-4 rounded-full px-1 text-[10px]"
          >
            {{ groupMemberCount }}
          </Badge>
        </Button>

        <Button
          v-if="canPlayPause"
          variant="ghost"
          size="icon-sm"
          :class="{ 'ml-1': canEditGroupMembers }"
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
          v-if="showMenuButton"
          variant="ghost"
          size="icon-sm"
          :class="{ '-ml-1': canPlayPause }"
          :disabled="!player.available"
          :aria-label="$t('tooltip.more_options')"
          @click.stop="openPlayerMenu"
        >
          <EllipsisVertical class="size-5" />
        </Button>
      </div>
    </div>

    <VolumeControl
      v-if="showVolumeControl"
      :player="player"
      :show-member-controls="player.available && showMemberControls"
      :show-child-volumes="player.available && showChildVolumes"
      :show-volume-control="player.powered !== false"
      :allow-wheel="false"
      @toggle-child-volumes="emit('toggle-child-volumes', player)"
    />
  </Card>
</template>

<script setup lang="ts">
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
  getMediaImageUrl,
  getPlayerName,
  isBuiltinPlayer,
} from "@/helpers/utils";
import api from "@/plugins/api";
import {
  PlaybackState,
  type Player,
  PLAYER_CONTROL_NONE,
  PlayerFeature,
  PlayerType,
} from "@/plugins/api/interfaces";
import { eventbus } from "@/plugins/eventbus";
import { store } from "@/plugins/store";
import {
  EllipsisVertical,
  Monitor,
  Pause,
  Play,
  Power,
  Smartphone,
  Speaker,
} from "@lucide/vue";
import { computed, ref, toRef, watch } from "vue";

export interface Props {
  player: Player;
  showVolumeControl?: boolean;
  showMenuButton?: boolean;
  showChildVolumes?: boolean;
  showMemberControls?: boolean;
  showGroupControls?: boolean;
  allowPowerControl?: boolean;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  (event: "click", player: Player): void;
  (event: "toggle-child-volumes", player: Player): void;
  (event: "toggle-member-controls", player: Player): void;
}>();

const artworkFailed = ref(false);
const { activeSource } = useActiveSource(toRef(props, "player"));

const playerQueue = computed(() => {
  if (props.player.active_source && props.player.active_source in api.queues) {
    return api.queues[props.player.active_source];
  }
  if (!props.player.active_source && props.player.player_id in api.queues) {
    return api.queues[props.player.player_id];
  }
  return undefined;
});

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

const canPlayPause = computed(
  () => activeSource.value?.can_play_pause === true,
);

const playActionInProgress = computed(
  () =>
    api.queues[props.player.player_id]?.extra_attributes
      ?.play_action_in_progress === true,
);

const canEditGroupMembers = computed(
  () =>
    props.showGroupControls &&
    props.player.supported_features.includes(PlayerFeature.SET_MEMBERS) &&
    (props.player.can_group_with.length > 0 ||
      props.player.group_members.some(
        (playerId) =>
          playerId !== props.player.player_id &&
          !props.player.static_group_members.includes(playerId),
      )),
);

const groupMemberCount = computed(() => {
  const childCount = new Set(
    props.player.group_members.filter(
      (playerId) => playerId !== props.player.player_id,
    ),
  ).size;
  return props.player.type === PlayerType.GROUP ? childCount : childCount + 1;
});

watch(
  () => props.player.current_media?.image_url,
  () => {
    artworkFailed.value = false;
  },
);

function openPlayerMenu(event: Event) {
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

const { onHold, onTouchStart, swallowClickAfterHold } =
  useHoldToOpenMenu(openPlayerMenu);
</script>
