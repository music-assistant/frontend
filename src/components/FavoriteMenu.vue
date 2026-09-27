<template>
  <!-- reka owns the open state; mirroring it here keeps the trigger's hover
       suppression in step with it -->
  <DropdownMenu v-if="canEditLibrary" @update:open="menuOpen = $event">
    <DropdownMenuTrigger as-child>
      <Button
        type="button"
        :variant="variant"
        :size="size"
        v-bind="$attrs"
        :disabled="!item"
        :data-active="state === true || undefined"
        :data-suppress-hover="suppressHover"
        :title="$t('favorites_menu')"
        :aria-label="$t('favorites_menu')"
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
      <DropdownMenuItem v-if="state === true" @click="clear">
        <Heart class="size-4" fill="currentColor" />
        {{ $t("favorites_remove") }}
      </DropdownMenuItem>
      <DropdownMenuItem v-else @click="like">
        <Heart class="size-4" fill="none" />
        {{ $t("favorites_add") }}
      </DropdownMenuItem>
      <!-- the heart only ever says "liked", so the dislike gets its own entry.
           Older servers have no dislike. -->
      <template v-if="api.supportsPersonalFavorites">
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
  clearFavorite,
  favoriteState,
  setFavoriteState,
  type FavoritableItem,
} from "@/helpers/favorites";
import { canAddToPlaylist } from "@/helpers/playlist_access";
import api from "@/plugins/api";
import { Scope } from "@/plugins/api/interfaces";
import { authManager } from "@/plugins/auth";
import { eventbus } from "@/plugins/eventbus";
import { Heart, PlusCircle, ThumbsDown } from "@lucide/vue";
import { computed, ref } from "vue";

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
// favouring and adding to a playlist both change the library
const canEditLibrary = computed(() =>
  authManager.hasScope(Scope.LIBRARY_WRITE),
);
const offersPlaylist = computed(
  () => !!props.item && canAddToPlaylist(props.item),
);

const menuOpen = ref(false);
const { suppressHover, onPointerEnter } = usePopoutTriggerHover(
  () => menuOpen.value,
);

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
