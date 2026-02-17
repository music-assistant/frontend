<template>
  <!-- Header -->
  <v-container>
    <div v-if="props.playerId">
      <!-- Settable options -->
      <div v-if="playerOptionsSettable.length > 0">
        <v-card
          class="mx-auto my-8"
          elevation="2"
          min-width="100%"
          :title="$t('player_options.settable', [playerName])"
        >
          <div style="padding: 0px 20px 20px 20px">
            <div v-for="option in playerOptionsSettable" :key="option.key">
              <PlayerOptionField
                :player-option="option"
                :player-id="props.playerId"
              />
            </div>
          </div>
        </v-card>
      </div>

      <!-- Read-only options -->
      <div v-if="playerOptionsReadOnly.length > 0">
        <v-card
          class="mx-auto my-8"
          elevation="2"
          min-width="100%"
          :title="$t('player_options.read_only', [playerName])"
        >
          <div style="padding: 0px 20px 20px 20px">
            <div v-for="option in playerOptionsReadOnly" :key="option.key">
              <PlayerOptionField
                :player-option="option"
                :player-id="props.playerId"
              />
            </div>
          </div>
        </v-card>
      </div>
    </div>
  </v-container>
</template>

<script setup lang="ts">
import api from "@/plugins/api";
import {
  EventType,
  PlayerOption,
  PlayerOptionType,
} from "@/plugins/api/interfaces";
import { onBeforeUnmount, computed, ref, watch } from "vue";
import PlayerOptionField from "./PlayerOptionField.vue";
import { $t } from "@/plugins/i18n";

// props
const props = defineProps<{
  playerId?: string;
}>();

// global refs
const playerName = ref<string>();
const playerOptions = ref<PlayerOption[]>([]);
const playerOptionsSettable = computed(() => {
  return playerOptions.value.filter((x) => !x.read_only);
});
const playerOptionsReadOnly = computed(() => {
  return playerOptions.value.filter((x) => x.read_only);
});

// Full load on entry
watch(
  () => props.playerId,
  async (val) => {
    if (val) {
      const player = await api.getPlayer(val);
      playerName.value = player.name;

      // sort for more consistency in UI experience
      let arrBool: PlayerOption[] = [];
      let arrNumber: PlayerOption[] = [];
      let arrString: PlayerOption[] = [];
      let arrSelect: PlayerOption[] = [];
      let arrSensor: PlayerOption[] = [];

      player.options.forEach((option) => {
        if (option.read_only) {
          arrSensor.push(option);
        } else if (option.options && option.options.length > 0) {
          arrSelect.push(option);
        } else if (option.type === PlayerOptionType.STRING) {
          arrString.push(option);
        } else if (option.type === PlayerOptionType.BOOLEAN) {
          arrBool.push(option);
        } else {
          arrNumber.push(option);
        }
      });

      playerOptions.value = [
        arrBool.sort((a, b) => a.key.localeCompare(b.key)),
        arrNumber.sort((a, b) => a.key.localeCompare(b.key)),
        arrString.sort((a, b) => a.key.localeCompare(b.key)),
        arrSelect.sort((a, b) => a.key.localeCompare(b.key)),
        arrSensor.sort((a, b) => a.key.localeCompare(b.key)),
      ].flat();
    }
  },
  { immediate: true },
);

// subscribe to option updates
const unsub = api.subscribe(
  EventType.PLAYER_OPTIONS_UPDATED,
  // data: [old , new ]
  (evt: { data: [PlayerOption[], PlayerOption[]] }) => {
    evt.data[1].forEach((updatedOption) => {
      const optionIndex = playerOptions.value.findIndex(
        (prevOption) => prevOption.key === updatedOption.key,
      );
      if (optionIndex === -1) {
        // option not yet present
        playerOptions.value.push(updatedOption);
        return;
      }
      playerOptions.value[optionIndex] = updatedOption;
    });
  },
  props.playerId,
);
onBeforeUnmount(unsub);
</script>
