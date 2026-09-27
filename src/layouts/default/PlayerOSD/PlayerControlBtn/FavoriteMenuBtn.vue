<template>
  <!-- reka owns the open state; mirroring it here keeps the trigger's hover
       suppression in step with it -->
  <DropdownMenu v-if="canEditLibrary" @update:open="menuOpen = $event">
    <DropdownMenuTrigger as-child>
      <Button
        variant="ghost"
        size="icon-lg"
        v-bind="$attrs"
        :disabled="!currentItem"
        :data-suppress-hover="suppressHover"
        :title="$t('tooltip.favorite')"
        :aria-label="$t('tooltip.favorite')"
        @pointerenter="onPointerEnter"
      >
        <Heart :size="size" :fill="isFavorite ? 'currentColor' : 'none'" />
      </Button>
    </DropdownMenuTrigger>
    <!-- the button sits low on both surfaces it is used on, so the menu hangs
         above it rather than over the volume slider under it -->
    <DropdownMenuContent side="top" align="center" class="z-[100001]">
      <DropdownMenuItem @click="toggleFavorite">
        <Heart class="size-4" :fill="isFavorite ? 'currentColor' : 'none'" />
        {{ isFavorite ? $t("favorites_remove") : $t("favorites_add") }}
      </DropdownMenuItem>
      <!-- the heart only ever says "liked", so the dislike gets its own entry -->
      <DropdownMenuItem
        v-if="api.supportsPersonalFavorites"
        @click="setFavorite(isDisliked ? null : false)"
      >
        <ThumbsDown class="size-4" />
        {{
          isDisliked ? $t("favorites_dislike_remove") : $t("favorites_dislike")
        }}
      </DropdownMenuItem>
      <DropdownMenuItem @click="addToPlaylist">
        <PlusCircle class="size-4" />
        {{ $t("add_playlist") }}
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
</template>

<script setup lang="ts">
defineOptions({ inheritAttrs: false });
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useCurrentItemFavorite } from "@/composables/useCurrentItemFavorite";
import { usePopoutTriggerHover } from "@/composables/usePopoutTriggerHover";
import api from "@/plugins/api";
import { Scope } from "@/plugins/api/interfaces";
import { authManager } from "@/plugins/auth";
import { Heart, PlusCircle, ThumbsDown } from "@lucide/vue";
import { computed, ref } from "vue";

export interface Props {
  /** glyph size in px; the button box comes from the call site */
  size?: number;
}

withDefaults(defineProps<Props>(), {
  size: 20,
});

const {
  currentItem,
  isFavorite,
  isDisliked,
  toggleFavorite,
  setFavorite,
  addToPlaylist,
} = useCurrentItemFavorite();
// favouring and adding to a playlist both change the library
const canEditLibrary = computed(() =>
  authManager.hasScope(Scope.LIBRARY_WRITE),
);

const menuOpen = ref(false);
const { suppressHover, onPointerEnter } = usePopoutTriggerHover(
  () => menuOpen.value,
);
</script>
