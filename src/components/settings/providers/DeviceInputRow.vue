<template>
  <!-- list view: a horizontal row -->
  <Item
    v-if="variant === 'list'"
    variant="outline"
    class="cursor-pointer rounded-(--radius-xl)"
    data-testid="device-input-row"
    @click="open"
  >
    <ItemMedia>
      <div :class="ICON_BOX_CLASS" class="size-10">
        <component :is="icon" class="size-5" aria-hidden="true" />
      </div>
    </ItemMedia>
    <ItemContent>
      <ItemTitle>
        <!-- the name is the focusable control; the row itself only follows the pointer -->
        <button
          type="button"
          class="cursor-pointer text-left"
          @click.stop="open"
        >
          {{ source.name }}
        </button>
      </ItemTitle>
      <ItemDescription v-if="playerName">{{ playerName }}</ItemDescription>
      <ProviderLabels :labels="DEVICE_INPUT_LABELS" />
    </ItemContent>
  </Item>

  <!-- card view: a vertical card carrying the same information -->
  <Card
    v-else
    class="card-hover flex h-full min-h-[200px] flex-col gap-3 rounded-(--radius-xl) py-4"
    data-testid="device-input-row"
    @click="open"
  >
    <div class="flex items-start gap-3 px-4">
      <div :class="ICON_BOX_CLASS" class="size-[50px]">
        <component :is="icon" class="size-6" aria-hidden="true" />
      </div>
      <button
        type="button"
        class="min-w-0 flex-1 cursor-pointer text-left text-base font-semibold"
        @click.stop="open"
      >
        {{ source.name }}
      </button>
    </div>
    <div class="flex flex-1 flex-col gap-3 px-4">
      <p v-if="playerName" class="text-muted-foreground m-0 text-sm">
        {{ playerName }}
      </p>
      <!-- at the bottom, so the labels line up across the cards of a row -->
      <ProviderLabels :labels="DEVICE_INPUT_LABELS" class="mt-auto" />
    </div>
  </Card>
</template>

<script setup lang="ts">
import ProviderLabels from "@/components/settings/providers/ProviderLabels.vue";
import { Card } from "@/components/ui/card";
import {
  Item,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item";
import {
  getLiveSourceIcon,
  getLiveSourceOwnerName,
} from "@/helpers/live_sources";
import { DEVICE_INPUT_LABELS } from "@/helpers/source_labels";
import { api } from "@/plugins/api";
import type { PlayerSource } from "@/plugins/api/interfaces";
import { computed } from "vue";
import { useRouter } from "vue-router";

/**
 * An input of a device, such as TV or Line-in, among the music sources; it
 * opens the settings of the player it belongs to, which the viewer must be
 * allowed to change.
 */
const props = defineProps<{
  // the input, with the player it belongs to
  source: PlayerSource;
  variant: "list" | "card";
}>();

const ICON_BOX_CLASS =
  "bg-muted text-muted-foreground flex shrink-0 items-center justify-center rounded-(--radius-lg)";

const router = useRouter();

const icon = computed(() => getLiveSourceIcon(props.source));
const playerName = computed(() =>
  getLiveSourceOwnerName(props.source, api.players),
);

const open = function () {
  void router.push(`/settings/editplayer/${props.source.owner_player_id}`);
};
</script>
