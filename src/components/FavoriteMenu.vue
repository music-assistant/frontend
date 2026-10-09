<template>
  <!-- reka owns the open state; mirroring it here keeps the trigger's hover
       suppression in step with it -->
  <DropdownMenu
    v-if="canEditLibrary && hasAnyAction"
    @update:open="menuOpen = $event"
  >
    <DropdownMenuTrigger as-child>
      <Button
        type="button"
        :variant="variant"
        :size="size"
        v-bind="$attrs"
        :disabled="!item"
        :data-active="state === true || undefined"
        :data-suppress-hover="suppressHover"
        :title="$t(triggerLabelKey)"
        :aria-label="$t(triggerLabelKey)"
        @pointerenter="onPointerEnter"
        @click.stop
      >
        <!-- one slot, three looks: a dislike takes the heart's place -->
        <ThumbsDown v-if="state === false" :class="iconClass" />
        <Heart
          v-else
          :class="iconClass"
          :fill="state === true ? 'currentColor' : 'none'"
        />
      </Button>
    </DropdownMenuTrigger>
    <!-- the player bar's trigger sits low on the screen, so the menu can be
         asked to hang above it -->
    <DropdownMenuContent :side="side" align="center" class="z-[100001]">
      <template v-if="offersFavorite">
        <DropdownMenuItem v-if="state === true" @click="clear">
          <Heart class="size-4" fill="currentColor" />
          {{ $t("favorites_remove") }}
        </DropdownMenuItem>
        <DropdownMenuItem v-else @click="like">
          <Heart class="size-4" fill="none" />
          {{ $t("favorites_add") }}
        </DropdownMenuItem>
        <!-- the heart only ever says "liked", so the dislike gets its own
             entry -->
        <DropdownMenuItem v-if="state === false" @click="clear">
          <ThumbsDown class="size-4" />
          {{ $t("favorites_dislike_remove") }}
        </DropdownMenuItem>
        <DropdownMenuItem v-else @click="dislike">
          <ThumbsDown class="size-4" />
          {{ $t("favorites_dislike") }}
        </DropdownMenuItem>
      </template>
      <DropdownMenuItem v-if="offersPlaylist" @click="addToPlaylist">
        <PlusCircle class="size-4" />
        {{ $t("add_playlist") }}
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
</template>

<script setup lang="ts">
defineOptions({ inheritAttrs: false });
import { Button, type ButtonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { usePopoutTriggerHover } from "@/composables/usePopoutTriggerHover";
import {
  canHoldFavorite,
  clearFavorite,
  favoriteState,
  setFavoriteState,
  subscribeOwnFavorites,
  type FavoritableItem,
} from "@/helpers/favorites";
import { canAddToPlaylist } from "@/helpers/playlist_access";
import api from "@/plugins/api";
import { Scope } from "@/plugins/api/interfaces";
import { authManager } from "@/plugins/auth";
import { eventbus } from "@/plugins/eventbus";
import { Heart, PlusCircle, ThumbsDown } from "@lucide/vue";
import { computed, onMounted, onUnmounted, ref } from "vue";

export interface Props {
  /** The item the menu acts on; without one the trigger is disabled. */
  item?: FavoritableItem;
  /**
   * The state to show and act on, for a caller that holds it apart from the
   * item; read from the item itself when left out.
   */
  favorite?: boolean | null;
  /** Look of the trigger button. */
  variant?: ButtonVariants["variant"];
  /** Box size of the trigger button. */
  size?: ButtonVariants["size"];
  /** Size class of the glyph, which the button box shrinks without one. */
  iconClass?: string;
  /** The side the menu hangs on. */
  side?: "top" | "bottom";
}

const props = withDefaults(defineProps<Props>(), {
  item: undefined,
  favorite: undefined,
  variant: "ghost-icon",
  size: "icon-sm",
  iconClass: "size-5",
  side: "bottom",
});

const emit = defineEmits<{
  "update:favorite": [favorite: boolean | null];
}>();

const state = computed(() =>
  props.favorite === undefined ? favoriteState(props.item) : props.favorite,
);
const triggerLabelKey = computed(() => {
  if (state.value === true) return "favorites_menu_liked";
  if (state.value === false) return "favorites_menu_disliked";
  return "favorites_menu";
});
// favouring and adding to a playlist both change the library
const canEditLibrary = computed(() =>
  authManager.hasScope(Scope.LIBRARY_WRITE),
);
// the server keeps no favorite state for some item types the player bar and
// other callers still hand over, e.g. a podcast episode
const offersFavorite = computed(
  () => !!props.item && canHoldFavorite(props.item),
);
const offersPlaylist = computed(
  () => !!props.item && canAddToPlaylist(props.item),
);
// without an item the trigger stays visible but disabled, e.g. while the
// player bar has nothing loaded yet
const hasAnyAction = computed(
  () => !props.item || offersFavorite.value || offersPlaylist.value,
);

const menuOpen = ref(false);
const { suppressHover, onPointerEnter } = usePopoutTriggerHover(
  () => menuOpen.value,
);

// likes and dislikes made elsewhere (another tab, another row showing the
// same item) reach every menu that renders the item, not just the one acted on
let unsubscribeFavorites: (() => void) | undefined;
onMounted(() => {
  unsubscribeFavorites = subscribeOwnFavorites((update) => {
    if (props.item?.uri === update.uri) {
      setFavoriteState(props.item, update.favorite);
    }
  });
});
onUnmounted(() => unsubscribeFavorites?.());

const like = async () => {
  if (!props.item) return;
  markFavorite(true);
  await api.addItemToFavorites(props.item);
};

const dislike = async () => {
  if (!props.item) return;
  markFavorite(false);
  await api.setFavorite(props.item, false);
};

const clear = async () => {
  if (!props.item) return;
  // a state the library cannot be addressed for is still on the server, so it
  // has to stay on screen
  if (await clearFavorite(props.item)) markFavorite(null);
};

const addToPlaylist = () => {
  if (!props.item) return;
  eventbus.emit("playlistdialog", { items: [props.item] });
};

// show the new state before the server confirms it
const markFavorite = (favorite: boolean | null) => {
  setFavoriteState(props.item, favorite);
  emit("update:favorite", favorite);
};
</script>
