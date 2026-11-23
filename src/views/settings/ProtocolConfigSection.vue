<template>
  <section
    v-if="protocolGeneralEntries.length > 0 || protocolPanels.length > 0"
    class="pt-7 first:pt-5"
  >
    <!-- Mirrors the category title in EditConfig.vue -->
    <h4
      class="mb-5 flex items-center gap-3 text-xs font-medium tracking-wider text-primary uppercase"
    >
      <span>{{ $t("settings.category.protocol_settings") }}</span>
      <span class="h-px flex-1 bg-border"></span>
    </h4>
    <!-- Explain the multi-protocol setup when more than one is available -->
    <div
      v-if="protocolPanels.length > 1"
      class="text-muted-foreground mb-4 rounded-md bg-muted/50 px-3 py-2 text-sm leading-relaxed"
    >
      {{ $t("settings.protocol_multi_info") }}
    </div>
    <!-- General protocol settings, shown before the protocol list -->
    <ConfigEntryRow
      v-for="conf_entry of protocolGeneralEntries"
      :key="conf_entry.key"
      :conf-entry="conf_entry"
      :show-password-values="showPasswordValues"
      :disabled="isDisabled(conf_entry)"
      @update:value="emit('update:value', conf_entry, $event)"
      @toggle-password="emit('toggle-password')"
      @action="emit('action', conf_entry)"
    />

    <template v-if="protocolPanels.length > 0">
      <component
        :is="hasMultipleProtocols ? Accordion : 'div'"
        :type="hasMultipleProtocols ? 'single' : undefined"
        :collapsible="hasMultipleProtocols || undefined"
        class="space-y-2"
      >
        <component
          :is="hasMultipleProtocols ? AccordionItem : 'div'"
          v-for="panel of protocolPanels"
          :key="panel"
          :value="hasMultipleProtocols ? panel : undefined"
          class="rounded-[6px] border bg-card px-4 shadow-sm"
        >
          <!-- The menu button sits beside the trigger, as a button can not hold another one -->
          <div class="flex items-center gap-2 [&>*:first-child]:flex-1">
            <component
              :is="hasMultipleProtocols ? AccordionTrigger : 'div'"
              :class="
                hasMultipleProtocols
                  ? 'hover:no-underline'
                  : 'flex items-start py-4 text-left text-sm font-medium'
              "
            >
              <span class="flex items-center gap-2">
                <ProviderIcon
                  v-if="getProtocolDomain(panel)"
                  :domain="getProtocolDomain(panel)!"
                  :size="22"
                />
                <span>{{ getProtocolConfigureTitle(panel) }}</span>
                <Badge
                  v-if="getOutputProtocol(panel)?.is_native"
                  variant="secondary"
                >
                  {{ $t("settings.protocol_native_badge") }}
                </Badge>
              </span>
            </component>
            <Button
              v-if="getOutputMenuItems(panel).length"
              data-testid="output-menu"
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-haspopup="menu"
              :aria-label="`${$t('more_options')}: ${getProtocolName(panel)}`"
              @click="openOutputMenu($event, panel)"
            >
              <MoreVertical class="size-4" />
            </Button>
            <!-- keeps the place of the menu button, so the chevrons line up -->
            <span
              v-else-if="hasOutputMenus"
              data-testid="output-menu-placeholder"
              class="size-8 shrink-0"
              aria-hidden="true"
            ></span>
          </div>
          <component
            :is="hasMultipleProtocols ? AccordionContent : 'div'"
            :class="['border-t pt-4', { 'pb-4': !hasMultipleProtocols }]"
          >
            <div
              v-if="!isProtocolProviderAvailable(panel)"
              class="protocol-empty-message"
            >
              {{ $t("settings.protocol_provider_unavailable") }}
            </div>
            <ConfigEntryRow
              v-for="conf_entry of speakerEntriesByPanel[panel].others"
              :key="conf_entry.key"
              :conf-entry="conf_entry"
              :show-password-values="showPasswordValues"
              :disabled="isProtocolEntryDisabled(panel, conf_entry)"
              @update:value="emit('update:value', conf_entry, $event)"
              @toggle-password="emit('toggle-password')"
              @action="emit('action', conf_entry)"
            />
            <!-- the protocol of a multi-channel player shows a row per speaker -->
            <MultiChannelSpeakers
              v-if="speakerEntriesByPanel[panel].speakers.length > 0"
              :class="{
                'mt-4': speakerEntriesByPanel[panel].others.length > 0,
              }"
              :speakers="speakerEntriesByPanel[panel].speakers"
              :show-password-values="showPasswordValues"
              :is-disabled="(entry) => isProtocolEntryDisabled(panel, entry)"
              @update:value="
                (entry, value) => emit('update:value', entry, value)
              "
              @toggle-password="emit('toggle-password')"
              @action="(entry) => emit('action', entry)"
            />
            <div
              v-if="
                isProtocolProviderAvailable(panel) &&
                entriesForCategory(panel).length === 0
              "
              class="protocol-empty-message"
            >
              {{ getProtocolEmptyMessage(panel) }}
            </div>
          </component>
        </component>
      </component>
    </template>
  </section>
</template>

<script setup lang="ts">
import ProviderIcon from "@/components/ProviderIcon.vue";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { ConfigEntryUI } from "@/helpers/config_entry_ui";
import type { ContextMenuItem } from "@/helpers/context_menu_item";
import { groupSpeakerEntries } from "@/helpers/multi_channel";
import { api } from "@/plugins/api";
import { ConfigValueType, OutputProtocol } from "@/plugins/api/interfaces";
import { eventbus } from "@/plugins/eventbus";
import { $t } from "@/plugins/i18n";
import { MoreVertical } from "@lucide/vue";
import { computed } from "vue";
import ConfigEntryRow from "./ConfigEntryRow.vue";
import MultiChannelSpeakers from "./MultiChannelSpeakers.vue";

const props = defineProps<{
  entries: ConfigEntryUI[];
  protocolPanels: string[];
  visibleEntriesByCategory: Record<string, ConfigEntryUI[]>;
  showPasswordValues: boolean;
  isDisabled: (entry: ConfigEntryUI) => boolean;
  // The player's output protocols, used to resolve derived-transport relationships.
  // Empty for non-player configs (providers/core), which have no output protocols.
  outputProtocols?: OutputProtocol[];
  // The menu entries of an output of the player; an output without any gets no menu button.
  outputMenuItems?: (output: OutputProtocol) => ContextMenuItem[];
  // The config is that of a multi-channel player, whose speakers show as rows of their own.
  multiChannel?: boolean;
}>();

const emit = defineEmits<{
  (e: "update:value", entry: ConfigEntryUI, value: ConfigValueType): void;
  (e: "action", entry: ConfigEntryUI): void;
  (e: "toggle-password"): void;
}>();

const entriesForCategory = function (category: string) {
  return props.visibleEntriesByCategory[category] || [];
};

const getCategoryTranslation = function (category: string) {
  // The display name comes from `category_label`: resolved server-side for server entries, and
  // set at construction for frontend-only entries. Read it from any entry in this category.
  const entry =
    entriesForCategory(category)[0] ||
    props.entries.find((e) => e.category === category);
  return entry?.category_label || category;
};

const protocolGeneralEntries = computed(() =>
  entriesForCategory("protocol_general"),
);

const hasMultipleProtocols = computed(() => props.protocolPanels.length > 1);

const getProtocolDomain = function (category: string): string | undefined {
  if (!category.startsWith("protocol_")) return undefined;
  // Extract domain from "protocol_{domain}" format
  return category.replace("protocol_", "");
};

const getProtocolEnabledEntry = function (
  category: string,
): ConfigEntryUI | undefined {
  // Optional protocols carry an entry whose key ends in "||protocol||enabled".
  return props.entries.find(
    (entry) =>
      entry.category === category && entry.key.endsWith("||protocol||enabled"),
  );
};

const protocolEntriesForCategory = function (
  category: string,
): ConfigEntryUI[] {
  const entries = entriesForCategory(category);
  const enabledEntry = getProtocolEnabledEntry(category);
  return enabledEntry ? [enabledEntry, ...entries] : entries;
};

// The entries of each protocol panel, split into those of the speakers of a multi-channel
// player and the rest.
const speakerEntriesByPanel = computed(() =>
  Object.fromEntries(
    props.protocolPanels.map((panel) => [
      panel,
      props.multiChannel
        ? groupSpeakerEntries(
            props.entries.filter((entry) => entry.category === panel),
            protocolEntriesForCategory(panel),
          )
        : { speakers: [], others: protocolEntriesForCategory(panel) },
    ]),
  ),
);

// A protocol's backing provider can be disabled/unavailable independently. Only
// optional protocols (those with an enabled entry) are served by a separate,
// toggleable provider; native protocols have no separate provider.
const isProtocolProviderAvailable = function (category: string): boolean {
  const domain = getProtocolDomain(category);
  if (!domain) return true;
  const provider = api.getProvider(domain);
  // Only treat as unavailable when we resolve a provider that reports unavailable.
  return provider ? provider.available : true;
};

const isProtocolEntryDisabled = function (
  category: string,
  entry: ConfigEntryUI,
): boolean {
  return !isProtocolProviderAvailable(category) || props.isDisabled(entry);
};

// Display name for a protocol — the provider's own name, falling back to the
// category label with the "Enable … support (over …)" scaffolding stripped.
const getProtocolName = function (category: string): string {
  const domain = getProtocolDomain(category);
  const provider = domain ? api.getProvider(domain) : undefined;
  if (provider?.name) return provider.name;
  return getCategoryTranslation(category)
    .replace(/\s*\(over\s+[^)]+\)\s*$/i, "")
    .replace(/^Enable\s+/i, "")
    .replace(/\s+support$/i, "");
};

// The output protocol backing a panel, matched by domain.
const getOutputProtocol = function (
  category: string,
): OutputProtocol | undefined {
  const domain = getProtocolDomain(category);
  if (!domain) return undefined;
  return props.outputProtocols?.find((p) => p.protocol_domain === domain);
};

// Display name of the protocol a derived transport rides on (e.g. AirPlay for a Sendspin
// bridge), or undefined for direct outputs. The relationship is resolved structurally from
// `derived_from`; the name is a provider proper-noun, so no translation is involved.
const getProtocolBaseName = function (category: string): string | undefined {
  const derivedFrom = getOutputProtocol(category)?.derived_from;
  if (!derivedFrom) return undefined;
  const base = props.outputProtocols?.find(
    (p) => p.output_protocol_id === derivedFrom,
  );
  if (!base) return undefined;
  return api.getProvider(base.protocol_domain)?.name || base.name;
};

// Accordion title for a protocol's configuration section; derived transports include
// the protocol they ride on, e.g. "Configure Sendspin (over AirPlay)".
const getProtocolConfigureTitle = function (category: string): string {
  const name = getProtocolName(category);
  const base = getProtocolBaseName(category);
  return base
    ? $t("settings.protocol_configure_title_via", { name, base })
    : $t("settings.protocol_configure_title", { name });
};

// The menu entries of the output a panel configures.
const getOutputMenuItems = function (category: string): ContextMenuItem[] {
  const output = getOutputProtocol(category);
  return output && props.outputMenuItems ? props.outputMenuItems(output) : [];
};

const hasOutputMenus = computed(() =>
  props.protocolPanels.some((panel) => getOutputMenuItems(panel).length > 0),
);

// The menu opens under its button, so it never covers the output it acts on, whether
// it was tapped, clicked or opened from the keyboard.
const openOutputMenu = function (evt: MouseEvent, category: string) {
  const trigger = (evt.currentTarget as HTMLElement).getBoundingClientRect();
  eventbus.emit("contextmenu", {
    items: getOutputMenuItems(category),
    posX: trigger.left,
    posY: trigger.bottom,
  });
};

const hasHiddenAdvancedSettings = function (category: string): boolean {
  // The category has advanced (non-hidden) settings that the current advanced
  // toggle keeps out of the visible list.
  return props.entries.some(
    (entry) =>
      entry.category === category &&
      entry.advanced &&
      !entry.key.includes("||protocol||enabled") &&
      !entry.hidden,
  );
};

const getProtocolEmptyMessage = function (category: string): string {
  if (hasHiddenAdvancedSettings(category)) {
    return $t("settings.protocol_no_settings_with_advanced");
  }

  return $t("settings.protocol_no_settings");
};
</script>

<style scoped>
.protocol-empty-message {
  padding: 2px 0 6px;
  color: rgba(var(--v-theme-on-surface), 0.6);
  font-style: italic;
  font-size: 0.875rem;
}
</style>
