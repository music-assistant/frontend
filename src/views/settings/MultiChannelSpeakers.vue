<template>
  <Accordion type="multiple" class="space-y-2">
    <AccordionItem
      v-for="speaker of speakers"
      :key="speaker.number"
      :value="String(speaker.number)"
      data-testid="multi-channel-speaker-row"
      class="rounded-md border bg-background px-3 last:border-b"
    >
      <AccordionTrigger class="items-center py-3 hover:no-underline">
        <span class="flex min-w-0 flex-1 items-center gap-3">
          <span
            data-testid="multi-channel-speaker-channel"
            class="w-12 shrink-0 text-xs font-semibold tracking-wider text-muted-foreground uppercase"
          >
            {{ getChannelTitle(speaker) }}
          </span>
          <span class="truncate">{{ speaker.name }}</span>
          <span
            data-testid="multi-channel-speaker-state"
            class="ml-auto flex shrink-0 items-center gap-1.5 text-xs font-normal text-muted-foreground"
          >
            <span
              class="size-2 rounded-full"
              :class="speaker.online ? 'bg-emerald-500' : 'bg-warning'"
            ></span>
            {{
              $t(
                speaker.online
                  ? "settings.multi_channel.speaker_online"
                  : "settings.multi_channel.speaker_offline",
              )
            }}
          </span>
        </span>
      </AccordionTrigger>
      <AccordionContent class="border-t pt-4">
        <ConfigEntryRow
          v-for="conf_entry of speaker.entries"
          :key="conf_entry.key"
          :conf-entry="conf_entry"
          :show-password-values="showPasswordValues"
          :disabled="isDisabled(conf_entry)"
          @update:value="setValue(conf_entry, $event)"
          @toggle-password="emit('toggle-password')"
          @action="emit('action', conf_entry)"
        />
      </AccordionContent>
    </AccordionItem>
  </Accordion>
</template>

<script setup lang="ts">
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import type { ConfigEntryUI } from "@/helpers/config_entry_ui";
import {
  getChannelSwap,
  type MultiChannelSpeaker,
} from "@/helpers/multi_channel";
import type { ConfigValueType } from "@/plugins/api/interfaces";
import ConfigEntryRow from "./ConfigEntryRow.vue";

const props = defineProps<{
  speakers: MultiChannelSpeaker[];
  showPasswordValues: boolean;
  isDisabled: (entry: ConfigEntryUI) => boolean;
}>();

const emit = defineEmits<{
  (e: "update:value", entry: ConfigEntryUI, value: ConfigValueType): void;
  (e: "action", entry: ConfigEntryUI): void;
  (e: "toggle-password"): void;
}>();

// the channel as the server names it, following the choice not saved yet
const getChannelTitle = function (speaker: MultiChannelSpeaker): string {
  const channel = speaker.channel;
  if (!channel) return "";
  const option = channel.options.find(({ value }) => value === channel.value);
  return option?.title ?? String(channel.value ?? "");
};

// a speaker that moves to the channel of another one swaps with it, which is what
// the server does on save as well
const setValue = function (entry: ConfigEntryUI, value: ConfigValueType) {
  const swap = getChannelSwap(props.speakers, entry, value);
  emit("update:value", entry, value);
  if (swap) emit("update:value", swap.entry, swap.value);
};
</script>
