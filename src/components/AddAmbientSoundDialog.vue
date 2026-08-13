<!--
  Dialog to add a custom ambient sound (stream url) to the ambient sounds
  provider. The server probes the url on submit and rejects it when it does
  not point to playable audio, so submission can take a moment.
-->
<template>
  <Dialog v-model:open="model">
    <DialogContent class="sm:max-w-[520px]">
      <DialogHeader>
        <DialogTitle>{{ $t("audio_overlay_add_custom") }}</DialogTitle>
        <DialogDescription>
          {{ $t("audio_overlay_add_custom_explanation") }}
        </DialogDescription>
      </DialogHeader>
      <form id="form-add-ambient-sound" @submit.prevent="form.handleSubmit">
        <FieldGroup>
          <form.Field name="url">
            <template #default="{ field }">
              <Field :data-invalid="isInvalid(field)">
                <FieldLabel :for="field.name">{{ $t("enter_url") }}</FieldLabel>
                <Input
                  :id="field.name"
                  :name="field.name"
                  :model-value="field.state.value"
                  :aria-invalid="isInvalid(field)"
                  :disabled="loading"
                  @blur="field.handleBlur"
                  @input="
                    (e: Event) => {
                      field.handleChange((e.target as HTMLInputElement).value);
                    }
                  "
                />
                <FieldError
                  v-if="isInvalid(field)"
                  :errors="field.state.meta.errors"
                />
              </Field>
            </template>
          </form.Field>

          <form.Field name="name">
            <template #default="{ field }">
              <Field :data-invalid="isInvalid(field)">
                <FieldLabel :for="field.name">{{
                  $t("enter_name")
                }}</FieldLabel>
                <Input
                  :id="field.name"
                  :name="field.name"
                  :model-value="field.state.value"
                  :aria-invalid="isInvalid(field)"
                  :disabled="loading"
                  @blur="field.handleBlur"
                  @input="
                    (e: Event) => {
                      field.handleChange((e.target as HTMLInputElement).value);
                    }
                  "
                />
                <FieldError
                  v-if="isInvalid(field)"
                  :errors="field.state.meta.errors"
                />
              </Field>
            </template>
          </form.Field>

          <form.Field name="image">
            <template #default="{ field }">
              <Field>
                <FieldLabel :for="field.name">{{ $t("image_url") }}</FieldLabel>
                <Input
                  :id="field.name"
                  :name="field.name"
                  :model-value="field.state.value"
                  :disabled="loading"
                  @blur="field.handleBlur"
                  @input="
                    (e: Event) => {
                      field.handleChange((e.target as HTMLInputElement).value);
                    }
                  "
                />
              </Field>
            </template>
          </form.Field>
        </FieldGroup>
      </form>
      <DialogFooter>
        <Button variant="outline" :disabled="loading" @click="model = false">
          {{ $t("cancel") }}
        </Button>
        <Button
          type="submit"
          form="form-add-ambient-sound"
          :disabled="loading || !isFormValid"
        >
          <Spinner v-if="loading" />
          {{ $t("add") }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
import type { AnyFieldApi } from "@tanstack/form-core";
import { useForm } from "@tanstack/vue-form";
import { ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { toast } from "vue-sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { manualLinkSchema } from "@/lib/forms/manual-link";
import api from "@/plugins/api";
import { store } from "@/plugins/store";

const model = defineModel<boolean>();
const emit = defineEmits<{ success: [] }>();
const { t } = useI18n();

const loading = ref<boolean>(false);

const schema = manualLinkSchema(t);

const form = useForm({
  defaultValues: {
    url: "",
    name: "",
    image: "",
  },
  validators: {
    onChange: schema,
    onSubmit: schema,
  },
  onSubmit: async ({ value }) => {
    await save(value);
  },
});

const isFormValid = form.useStore(
  (state) => schema.safeParse(state.values).success,
);

const isInvalid = (field: AnyFieldApi) =>
  field.state.meta.isTouched && !field.state.meta.isValid;

watch(
  () => model.value,
  (active) => {
    if (active != null) store.dialogActive = active;
    if (active === false) {
      form.reset({ url: "", name: "", image: "" });
    }
  },
);

const save = async function (value: {
  url: string;
  name: string;
  image: string;
}) {
  loading.value = true;
  try {
    await api.addAmbientSound(value.url, value.name, value.image || undefined);
    toast.success(t("audio_overlay_custom_added", [value.name]));
    model.value = false;
    emit("success");
  } catch (e) {
    console.error("Failed to add ambient sound:", e);
    toast.error(t("audio_overlay_custom_add_failed"));
  } finally {
    loading.value = false;
  }
};
</script>
