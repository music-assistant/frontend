<template>
  <section class="mx-auto w-full max-w-5xl space-y-6 p-4 md:p-6">
    <header
      class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between"
    >
      <div>
        <h1
          class="inline-flex items-center text-2xl font-semibold tracking-tight"
        >
          <Workflow class="mr-2 h-5 w-5" />
          {{ $t("providers.library_automations.title") }}
        </h1>
        <p class="text-sm text-muted-foreground">
          {{ $t("providers.library_automations.subtitle") }}
        </p>
      </div>
      <Button @click="openCreateDialog">
        <Plus class="mr-1 h-4 w-4" />
        {{ $t("providers.library_automations.add_rule") }}
      </Button>
    </header>

    <div
      v-if="showEmptyState"
      class="flex flex-col items-center gap-3 rounded-xl border border-dashed py-16 text-center"
    >
      <Workflow class="h-10 w-10 text-muted-foreground" />
      <div>
        <h2 class="text-lg font-semibold">
          {{ $t("providers.library_automations.empty_title") }}
        </h2>
        <p class="mt-1 max-w-md text-sm text-muted-foreground">
          {{ $t("providers.library_automations.empty_description") }}
        </p>
      </div>
      <Button @click="openCreateDialog">
        <Plus class="mr-1 h-4 w-4" />
        {{ $t("providers.library_automations.create_cta") }}
      </Button>
    </div>

    <div v-else class="flex flex-col gap-2">
      <LibraryAutomationRuleCard
        v-for="rule in rules"
        :key="rule.id"
        :rule="rule"
        @edit="openEditDialog"
      />
    </div>

    <LibraryAutomationRuleFormDialog
      v-model:open="formDialogOpen"
      :rule="editingRule"
      :trigger-types="triggerTypes"
      :action-types="actionTypes"
    />
  </section>
</template>

<script setup lang="ts">
import LibraryAutomationRuleCard from "@/components/library-automations/LibraryAutomationRuleCard.vue";
import LibraryAutomationRuleFormDialog from "@/components/library-automations/LibraryAutomationRuleFormDialog.vue";
import { Button } from "@/components/ui/button";
import { useLibraryAutomationRules } from "@/composables/library-automations/useLibraryAutomationRules";
import { errorMessage } from "@/helpers/library_automations";
import type { LibraryAutomationRule } from "@/plugins/api/interfaces";
import { Plus, Workflow } from "@lucide/vue";
import { computed, onMounted, ref } from "vue";
import { toast } from "vue-sonner";

const { rules, triggerTypes, actionTypes, loadingRules, loadRules, loadTypes } =
  useLibraryAutomationRules();

const formDialogOpen = ref(false);
const editingRule = ref<LibraryAutomationRule | null>(null);

const showEmptyState = computed(
  () => !loadingRules.value && rules.value.length === 0,
);

function openCreateDialog() {
  editingRule.value = null;
  formDialogOpen.value = true;
}

function openEditDialog(rule: LibraryAutomationRule) {
  editingRule.value = rule;
  formDialogOpen.value = true;
}

onMounted(async () => {
  try {
    await Promise.all([loadRules(), loadTypes()]);
  } catch (error) {
    toast.error(errorMessage(error));
  }
});
</script>
