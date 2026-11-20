<template>
  <section class="space-y-4 p-4">
    <div
      v-if="settableOptions.length"
      class="bg-card overflow-hidden rounded-xl border shadow-sm"
    >
      <h2 class="border-b px-6 py-4 text-base font-medium">
        {{ $t("player_options.controls") }}
      </h2>
      <div class="divide-y">
        <PlayerOptionField
          v-for="option in settableOptions"
          :key="option.key"
          :player-option="option"
          :player-id="playerId"
        />
      </div>
    </div>

    <div
      v-if="readOnlyOptions.length"
      class="bg-card overflow-hidden rounded-xl border shadow-sm"
    >
      <h2 class="border-b px-6 py-4 text-base font-medium">
        {{ $t("player_options.status") }}
      </h2>
      <dl class="divide-y">
        <div
          v-for="option in readOnlyOptions"
          :key="option.key"
          class="flex items-center justify-between gap-6 px-6 py-4 text-sm"
        >
          <dt class="font-medium">{{ option.name }}</dt>
          <dd class="text-muted-foreground text-right">
            {{ formatValue(option) }}
          </dd>
        </div>
      </dl>
    </div>

    <p
      v-if="!settableOptions.length && !readOnlyOptions.length"
      class="text-muted-foreground px-2 text-sm"
    >
      {{ $t("player_options.none") }}
    </p>
  </section>
</template>

<script setup lang="ts">
import {
  formatPlayerOptionValue,
  sortPlayerOptions,
} from "@/helpers/player_options";
import api from "@/plugins/api";
import { PlayerOption } from "@/plugins/api/interfaces";
import { $t } from "@/plugins/i18n";
import { computed } from "vue";
import PlayerOptionField from "./PlayerOptionField.vue";

const props = defineProps<{
  playerId: string;
}>();

const options = computed(() =>
  sortPlayerOptions(api.players[props.playerId]?.options ?? []),
);
const settableOptions = computed(() =>
  options.value.filter((x) => !x.read_only),
);
const readOnlyOptions = computed(() =>
  options.value.filter((x) => x.read_only),
);

function formatValue(option: PlayerOption) {
  if (typeof option.value === "boolean") {
    return option.value ? $t("on") : $t("off");
  }
  return formatPlayerOptionValue(option);
}
</script>
