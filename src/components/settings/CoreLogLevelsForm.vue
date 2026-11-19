<template>
  <div v-if="canEdit" :aria-busy="busy" data-testid="core-log-levels">
    <!-- the log levels are what this form is about, so none is left to the advanced toggle -->
    <EditConfig
      v-if="loaded"
      ref="editConfig"
      :config-entries="entries"
      :disabled="false"
      inline-save
      hide-header
      :show-advanced-settings="true"
      @submit="onSubmit"
    />

    <Empty v-else-if="loadFailed" class="rounded-xl border border-dashed py-6">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <SlidersHorizontal />
        </EmptyMedia>
        <EmptyTitle>{{ $t("settings.settings_load_failed") }}</EmptyTitle>
      </EmptyHeader>
    </Empty>

    <div v-else class="flex min-h-24 items-center justify-center">
      <Spinner class="size-6" />
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Spinner } from "@/components/ui/spinner";
import { useCoreLogLevels } from "@/composables/settings/useCoreLogLevels";
import type { ConfigValueType } from "@/plugins/api/interfaces";
import { $t } from "@/plugins/i18n";
import EditConfig from "@/views/settings/EditConfig.vue";
import { SlidersHorizontal } from "@lucide/vue";
import { ref } from "vue";
import { toast } from "vue-sonner";

/**
 * The log level of each core module, as a form that saves them in place.
 * Renders nothing for a user who may not change them.
 */

const editConfig = ref<InstanceType<typeof EditConfig>>();

const { entries, loaded, loadFailed, busy, canEdit, save } = useCoreLogLevels();

const onSubmit = async function (values: Record<string, ConfigValueType>) {
  if (!(await save(values))) {
    editConfig.value?.saveFailed();
    return;
  }
  // the form stays on screen, so it takes the saved values as its baseline
  editConfig.value?.saveSucceeded(values);
  toast.success($t("settings.settings_saved"));
};
</script>
