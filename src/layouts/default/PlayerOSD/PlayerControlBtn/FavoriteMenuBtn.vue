<template>
  <!-- reka owns the open state; mirroring it here keeps the trigger's hover
       suppression in step with it -->
  <DropdownMenu @update:open="menuOpen = $event">
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
import { Heart, PlusCircle } from "@lucide/vue";
import { ref } from "vue";

export interface Props {
  /** glyph size in px; the button box comes from the call site */
  size?: number;
}

withDefaults(defineProps<Props>(), {
  size: 20,
});

const { currentItem, isFavorite, toggleFavorite, addToPlaylist } =
  useCurrentItemFavorite();

const menuOpen = ref(false);
const { suppressHover, onPointerEnter } = usePopoutTriggerHover(
  () => menuOpen.value,
);
</script>
