<template>
  <div class="flex flex-col gap-6 p-6 max-md:gap-5 max-md:px-3 max-md:py-4">
    <SettingsPageHeader page="ai" />
    <template v-if="loaded">
      <Empty
        v-if="engines.length === 0"
        class="rounded-xl border"
        data-testid="ai-no-engines"
      >
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Sparkles />
          </EmptyMedia>
          <EmptyTitle>{{ $t("settings.ai.no_engines") }}</EmptyTitle>
          <EmptyDescription>
            {{ $t("settings.ai.no_engines_description") }}
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button data-testid="ai-no-engines-add" @click="showAddDialog = true">
            <Plus />
            {{ $t("settings.ai.add_service") }}
          </Button>
        </EmptyContent>
      </Empty>
      <!-- the form loads the engines to pick from once, so other engines get a
           form of their own -->
      <SettingsPageForm v-else :key="engineKey" page="ai" @saved="refresh" />

      <AIEngineUsage :usage="usage" :engines="engines" @changed="refresh" />

      <section v-if="serviceRows.length" class="space-y-3">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <h2 class="text-muted-foreground text-sm font-medium">
            {{ $t("settings.ai.services") }}
          </h2>
          <!-- without engines, the empty state above offers it -->
          <Button
            v-if="engines.length"
            variant="outline"
            size="sm"
            data-testid="ai-services-add"
            @click="showAddDialog = true"
          >
            <Plus />
            {{ $t("settings.ai.add_service") }}
          </Button>
        </div>
        <SettingsLinkRows :rows="serviceRows" test-id-prefix="ai-services" />
      </section>
    </template>

    <Empty v-else-if="loadFailed" class="rounded-xl border border-dashed py-6">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Sparkles />
        </EmptyMedia>
        <EmptyTitle>{{ $t("settings.settings_load_failed") }}</EmptyTitle>
      </EmptyHeader>
    </Empty>

    <div v-else class="flex min-h-24 items-center justify-center">
      <Spinner class="size-6" />
    </div>

    <AIAssistantAccess />

    <AddProviderDialog
      v-model:show="showAddDialog"
      :provider-type="ProviderType.PLUGIN"
      ai-service-only
    />
  </div>
</template>

<script setup lang="ts">
import AIAssistantAccess from "@/components/settings/ai/AIAssistantAccess.vue";
import AIEngineUsage from "@/components/settings/ai/AIEngineUsage.vue";
import SettingsLinkRows from "@/components/settings/SettingsLinkRows.vue";
import SettingsPageForm from "@/components/settings/SettingsPageForm.vue";
import SettingsPageHeader from "@/components/settings/SettingsPageHeader.vue";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Spinner } from "@/components/ui/spinner";
import { useAIEngines } from "@/composables/settings/useAIEngines";
import { aiServiceRows } from "@/helpers/ai_settings";
import { api } from "@/plugins/api";
import { ProviderType } from "@/plugins/api/interfaces";
import { $t } from "@/plugins/i18n";
import AddProviderDialog from "@/views/settings/AddProviderDialog.vue";
import { Plus, Sparkles } from "@lucide/vue";
import { computed, ref } from "vue";

/**
 * The AI engines Music Assistant uses: the default engine of each kind, what
 * uses which engine, the services providing them, and access for AI
 * assistants.
 */

const showAddDialog = ref(false);

const { engines, usage, loaded, loadFailed, refresh } = useAIEngines();

const engineKey = computed(() =>
  engines.value.map((engine) => engine.uid).join(),
);

const serviceRows = computed(() =>
  aiServiceRows(Object.values(api.providers), engines.value),
);
</script>
