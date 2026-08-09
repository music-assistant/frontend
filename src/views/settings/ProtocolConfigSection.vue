<template>
  <div
    v-if="protocolGeneralEntries.length > 0 || protocolPanels.length > 0"
    class="category-section"
  >
    <div class="category-header">
      <span class="category-icon">
        <Antenna :size="16" />
      </span>
      <span class="category-title">
        {{ $t("settings.category.protocol_settings") }}
      </span>
    </div>
    <div class="category-content">
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
        @open-dsp="emit('open-dsp')"
        @open-options="emit('open-options')"
        @help="emit('help', conf_entry)"
      />

      <template v-if="protocolPanels.length > 0">
        <Accordion type="single" collapsible class="space-y-2">
          <AccordionItem
            v-for="panel of protocolPanels"
            :key="panel"
            :value="panel"
            class="rounded-[6px] border bg-card px-4 shadow-sm"
          >
            <AccordionTrigger class="hover:no-underline">
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
            </AccordionTrigger>
            <AccordionContent class="border-t pt-4">
              <ConfigEntryRow
                v-for="conf_entry of protocolEntriesForCategory(panel)"
                :key="conf_entry.key"
                :conf-entry="conf_entry"
                :show-password-values="showPasswordValues"
                :disabled="isProtocolEntryDisabled(panel, conf_entry)"
                @update:value="emit('update:value', conf_entry, $event)"
                @toggle-password="emit('toggle-password')"
                @action="emit('action', conf_entry)"
                @open-dsp="emit('open-dsp')"
                @open-options="emit('open-options')"
                @help="emit('help', conf_entry)"
              />
              <div
                v-if="entriesForCategory(panel).length === 0"
                class="protocol-empty-message"
              >
                {{ getProtocolEmptyMessage(panel) }}
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </template>
    </div>
  </div>
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
import { ConfigEntryUI } from "@/helpers/config_entry_ui";
import { api } from "@/plugins/api";
import { ConfigValueType, OutputProtocol } from "@/plugins/api/interfaces";
import { $t } from "@/plugins/i18n";
import { Antenna } from "@lucide/vue";
import { computed } from "vue";
import ConfigEntryRow from "./ConfigEntryRow.vue";

const props = defineProps<{
  entries: ConfigEntryUI[];
  protocolPanels: string[];
  visibleEntriesByCategory: Record<string, ConfigEntryUI[]>;
  showPasswordValues: boolean;
  isDisabled: (entry: ConfigEntryUI) => boolean;
  // The player's output protocols, used to resolve derived-transport relationships.
  // Empty for non-player configs (providers/core), which have no output protocols.
  outputProtocols?: OutputProtocol[];
}>();

const emit = defineEmits<{
  (e: "update:value", entry: ConfigEntryUI, value: ConfigValueType): void;
  (e: "action", entry: ConfigEntryUI): void;
  (e: "help", entry: ConfigEntryUI): void;
  (e: "toggle-password"): void;
  (e: "open-dsp"): void;
  (e: "open-options"): void;
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
  const enabledEntry = getProtocolEnabledEntry(category);

  // Optional protocol whose backing provider is unavailable
  if (enabledEntry && !isProtocolProviderAvailable(category)) {
    return $t("settings.protocol_provider_unavailable");
  }

  if (hasHiddenAdvancedSettings(category)) {
    return $t("settings.protocol_no_settings_with_advanced");
  }

  return $t("settings.protocol_no_settings");
};
</script>

<style scoped>
/* Mirrors the config category card in EditConfig.vue */
.category-section {
  margin-bottom: 14px;
  border: 1px solid rgba(var(--v-theme-on-surface), 0.08);
  border-radius: 14px;
  background: rgb(var(--v-theme-surface));
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
  overflow: hidden;
}

.category-header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 11px 16px;
  background: rgba(var(--v-theme-on-surface), 0.03);
  border-bottom: 1px solid rgba(var(--v-theme-on-surface), 0.08);
}

.category-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 8px;
  background: rgba(var(--v-theme-primary), 0.12);
  color: rgb(var(--v-theme-primary));
  flex-shrink: 0;
}

.category-title {
  font-size: 0.9rem;
  font-weight: 600;
  color: rgb(var(--v-theme-on-surface));
}

.category-content {
  padding: 14px 16px;
}

.protocol-empty-message {
  padding: 2px 0 6px;
  color: rgba(var(--v-theme-on-surface), 0.6);
  font-style: italic;
  font-size: 0.875rem;
}
</style>
