<template>
  <Accordion type="multiple" class="space-y-2">
    <AccordionItem
      v-for="{ speaker, fields } of rows"
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
          v-for="{ entry, shown } of fields"
          :key="entry.key"
          :conf-entry="shown"
          :show-password-values="showPasswordValues"
          :disabled="isDisabled(entry)"
          :clearable="entry !== speaker.channel"
          @update:value="setValue(entry, $event)"
          @toggle-password="emit('toggle-password')"
          @action="emit('action', entry)"
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
  getSpeakerField,
  type MultiChannelSpeaker,
} from "@/helpers/multi_channel";
import type { ConfigValueType } from "@/plugins/api/interfaces";
import { $t } from "@/plugins/i18n";
import { computed } from "vue";
import ConfigEntryRow from "./ConfigEntryRow.vue";

// the row names the speaker already, so these fields go by a plain label
const FIELD_LABELS: Record<string, string> = {
  channel_setting: "settings.multi_channel.channel",
  output_delay: "settings.multi_channel.output_delay",
};

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

// each speaker with its entries as the row shows them; a change goes to the entry itself
const rows = computed(() =>
  props.speakers.map((speaker) => ({
    speaker,
    fields: speaker.entries.map((entry) => ({
      entry,
      shown: getShownEntry(speaker, entry),
    })),
  })),
);

const getShownEntry = function (
  speaker: MultiChannelSpeaker,
  entry: ConfigEntryUI,
): ConfigEntryUI {
  const label = FIELD_LABELS[getSpeakerField(entry.key) ?? ""];
  if (!label) return entry;
  return {
    ...entry,
    label: $t(label),
    // the default of a channel is the one stored, which tells the user nothing
    ...(entry === speaker.channel ? { default_value: null } : {}),
  };
};

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
  // a speaker always plays a channel, and the server would store an empty one
  if (isChannel(entry) && (value === null || value === "")) return;
  const swap = getChannelSwap(props.speakers, entry, value);
  emit("update:value", entry, value);
  if (swap) emit("update:value", swap.entry, swap.value);
};

function isChannel(entry: ConfigEntryUI): boolean {
  return props.speakers.some((speaker) => speaker.channel === entry);
}
</script>
