<template>
  <Dialog v-model:open="open">
    <DialogContent class="sm:max-w-[760px]">
      <DialogHeader>
        <DialogTitle>{{ $t("providers.ai_radio.tutorial.title") }}</DialogTitle>
        <DialogDescription>
          {{ $t("providers.ai_radio.tutorial.description") }}
        </DialogDescription>
      </DialogHeader>

      <div class="space-y-3 text-sm">
        <div class="rounded-md border p-3">
          <div class="font-medium">
            {{ $t("providers.ai_radio.tutorial.station_title") }}
          </div>
          <p class="mt-1 text-muted-foreground">
            {{ $t("providers.ai_radio.tutorial.station_text") }}
          </p>
        </div>

        <div class="rounded-md border p-3">
          <div class="font-medium">
            {{ $t("providers.ai_radio.tutorial.section_title") }}
          </div>
          <p class="mt-1 text-muted-foreground">
            {{ $t("providers.ai_radio.tutorial.section_text") }}
          </p>
        </div>

        <div class="rounded-md border p-3">
          <div class="font-medium">
            {{ $t("providers.ai_radio.tutorial.flow_title") }}
          </div>
          <p class="mt-1 text-muted-foreground">
            {{ $t("providers.ai_radio.tutorial.flow_text") }}
          </p>
        </div>

        <div class="rounded-md border p-3">
          <div class="font-medium">
            {{ $t("providers.ai_radio.tutorial.run_modes_title") }}
          </div>
          <p class="mt-1 text-muted-foreground">
            {{ $t("providers.ai_radio.tutorial.run_modes_text") }}
          </p>
        </div>
      </div>

      <DialogFooter>
        <Button @click="closeTutorial">{{
          $t("providers.ai_radio.actions.done")
        }}</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { $t } from "@/plugins/i18n";

const open = defineModel<boolean>("open", { default: false });

const closeTutorial = () => {
  open.value = false;
};
</script>
