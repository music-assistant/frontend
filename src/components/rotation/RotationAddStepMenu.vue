<template>
  <DropdownMenu>
    <DropdownMenuTrigger as-child>
      <Button variant="outline" size="sm" :disabled="entries.length === 0">
        <Plus class="h-4 w-4" />
        {{ $t("rotation.add_step.button") }}
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="start" class="w-72">
      <DropdownMenuItem
        v-for="entry in entries"
        :key="entry.key"
        class="flex flex-col items-start gap-0.5"
        @select="emit('add', entry.type, entry.to)"
      >
        <span class="text-sm font-medium">
          {{ $t(`rotation.add_step.${entry.key}`) }}
        </span>
        <span class="text-xs text-muted-foreground">
          {{ $t(`rotation.add_step.${entry.key}_desc`) }}
        </span>
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
</template>

<script setup lang="ts">
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { ItemKind } from "@/helpers/rotation";
import type { RotationStep } from "@/plugins/api/interfaces";
import { $t } from "@/plugins/i18n";
import { Plus } from "@lucide/vue";
import { computed } from "vue";

type ExpandTarget = Extract<RotationStep, { type: "expand" }>["to"];

interface MenuEntry {
  key: string;
  type: RotationStep["type"];
  to?: ExpandTarget;
}

const props = defineProps<{
  allowed: RotationStep["type"][];
  // the kind of the list the new step would work on
  kind?: ItemKind;
}>();

const emit = defineEmits<{
  add: [type: RotationStep["type"], to?: ExpandTarget];
}>();

// from an artist list the expand target is chosen here, as the row cannot switch it
const entries = computed<MenuEntry[]>(() =>
  props.allowed.flatMap((type): MenuEntry[] =>
    type === "expand" && props.kind === "artist"
      ? [
          { key: "expand_artist_albums", type, to: "album" },
          { key: "expand_artist_tracks", type, to: "track" },
        ]
      : [{ key: type, type }],
  ),
);
</script>
