<template>
  <div
    class="config-entry mb-4 flex items-start gap-2 last:mb-0 has-[+.config-entry-hass-picker]:mb-2"
    :class="{
      'opacity-90': confEntry.advanced,
      'config-entry-hass-picker': isHassControlPickerEntry(confEntry),
    }"
  >
    <ConfigEntryField
      :conf-entry="confEntry"
      :show-password-values="showPasswordValues"
      :disabled="disabled"
      :provider-domain="providerDomain"
      :clearable="clearable"
      @toggle-password="emit('toggle-password')"
      @update:value="emit('update:value', $event)"
      @action="emit('action')"
      @set-entry-value="
        (key: string, value: ConfigValueType, label?: string) =>
          emit('set-entry-value', key, value, label)
      "
    />
    <div
      v-if="confEntry.advanced || hasDescription || hasHelpLink"
      class="flex shrink-0 items-center gap-2"
      :class="asideOffset"
    >
      <Badge
        v-if="confEntry.advanced"
        variant="outline"
        class="text-muted-foreground font-normal"
      >
        {{ $t("settings.advanced") }}
      </Badge>
      <!-- a description shows in a popover beside the field; a lone docs link has
           nothing to show inline, so it just opens -->
      <Popover v-if="hasDescription">
        <PopoverTrigger as-child>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            class="opacity-60 transition-opacity hover:opacity-100"
            :aria-label="$t('tooltip.help')"
          >
            <HelpCircle class="size-5" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="end"
          :collision-padding="8"
          class="flex max-h-[60vh] flex-col gap-2 overflow-y-auto text-sm"
        >
          <MarkdownText :text="confEntry.description" />
          <a
            v-if="hasHelpLink"
            :href="helpLink"
            target="_blank"
            rel="noopener noreferrer"
            class="text-primary self-start underline underline-offset-2"
          >
            {{ $t("read_more") }}
          </a>
        </PopoverContent>
      </Popover>
      <Button
        v-else-if="hasHelpLink"
        as="a"
        :href="helpLink"
        target="_blank"
        rel="noopener noreferrer"
        variant="ghost"
        size="icon"
        class="opacity-60 transition-opacity hover:opacity-100"
        :aria-label="$t('tooltip.help')"
      >
        <HelpCircle class="size-5" />
      </Button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import MarkdownText from "@/components/MarkdownText.vue";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { HelpCircle } from "@lucide/vue";
import {
  ConfigEntryUI,
  isHassControlPickerEntry,
} from "@/helpers/config_entry_ui";
import { configFieldKind } from "@/helpers/config_field";
import { getExternalLinkUrl } from "@/helpers/utils";
import { ConfigValueType } from "@/plugins/api/interfaces";
import { $t } from "@/plugins/i18n";
import ConfigEntryField from "./ConfigEntryField.vue";

const props = withDefaults(
  defineProps<{
    confEntry: ConfigEntryUI;
    showPasswordValues: boolean;
    disabled: boolean;
    providerDomain?: string;
    // false leaves out the clear button of a dropdown, for a value that must stay set
    clearable?: boolean;
  }>(),
  { providerDomain: undefined, clearable: true },
);

const emit = defineEmits<{
  (e: "update:value", value: ConfigValueType): void;
  (e: "toggle-password"): void;
  (e: "action"): void;
  (
    e: "set-entry-value",
    key: string,
    value: ConfigValueType,
    label?: string,
  ): void;
}>();

// description is resolved server-side, or set by the frontend for its own
// settings; an entry carries a description, a docs link, or neither
const hasDescription = computed(() => !!props.confEntry.description?.trim());
// only ever a web URL: getExternalLinkUrl drops other schemes and rewrites the
// docs host on beta builds, matching how provider doc links are opened
const helpLink = computed(() => getExternalLinkUrl(props.confEntry.help_link));
const hasHelpLink = computed(() => !!helpLink.value);

// lines the badge and help button up with the control: a labelled field has its
// label above the control
const asideOffset = computed(() => {
  switch (configFieldKind(props.confEntry, props.providerDomain)) {
    case "select":
    case "text":
    case "secret":
    case "number":
    case "string_list":
      return props.confEntry.label === "" ? "mt-1" : "mt-8";
    case "boolean":
      return "mt-0.5";
    case "action":
      // the button's own margin plus half of what it is taller than the help button
      return "mt-[15px]";
    case "slider":
      return "min-[601px]:self-center";
    default:
      return "mt-0";
  }
});
</script>
