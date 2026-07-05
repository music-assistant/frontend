<template>
  <Dialog v-model:open="model">
    <DialogContent class="sm:max-w-[520px]">
      <DialogHeader>
        <DialogTitle>{{ $t("add_genre") }}</DialogTitle>
      </DialogHeader>
      <form id="form-add-genre" @submit.prevent="form.handleSubmit">
        <FieldGroup>
          <form.Field name="name">
            <template #default="{ field }">
              <Field :data-invalid="isInvalid(field)">
                <FieldLabel :for="field.name">
                  {{ $t("enter_name") }}
                </FieldLabel>
                <Input
                  :id="field.name"
                  :name="field.name"
                  :model-value="field.state.value"
                  :aria-invalid="isInvalid(field)"
                  :disabled="loading"
                  autofocus
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

          <form.Field name="sortName">
            <template #default="{ field }">
              <Field>
                <FieldLabel :for="field.name">
                  {{ $t("sort.sort_name") }}
                </FieldLabel>
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

          <form.Field name="contentType">
            <template #default="{ field }">
              <Field>
                <FieldLabel :for="field.name">
                  {{ $t("tooltip.genre_content_type") }}
                </FieldLabel>
                <Select
                  :model-value="field.state.value"
                  :disabled="loading"
                  @update:model-value="
                    (val: unknown) =>
                      field.handleChange(
                        val as 'music' | 'podcast' | 'audiobook',
                      )
                  "
                >
                  <SelectTrigger :id="field.name" class="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="music">
                      {{ $t("genre_content_type.music") }}
                    </SelectItem>
                    <SelectItem value="podcast">
                      {{ $t("genre_content_type.podcasts") }}
                    </SelectItem>
                    <SelectItem value="audiobook">
                      {{ $t("genre_content_type.audiobooks") }}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            </template>
          </form.Field>

          <form.Field name="description">
            <template #default="{ field }">
              <Field>
                <FieldLabel :for="field.name">
                  {{ $t("description") }}
                </FieldLabel>
                <Textarea
                  :id="field.name"
                  :name="field.name"
                  :model-value="field.state.value"
                  :disabled="loading"
                  rows="3"
                  @blur="field.handleBlur"
                  @input="
                    (e: Event) => {
                      field.handleChange(
                        (e.target as HTMLTextAreaElement).value,
                      );
                    }
                  "
                />
              </Field>
            </template>
          </form.Field>
        </FieldGroup>
      </form>
      <DialogFooter>
        <Button type="button" variant="outline" @click="handleClose">
          {{ $t("cancel") }}
        </Button>
        <Button
          type="submit"
          form="form-add-genre"
          :disabled="loading"
          :loading="loading"
        >
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { addGenreSchema } from "@/lib/forms/genre";
import api from "@/plugins/api";
import { store } from "@/plugins/store";

const model = defineModel<boolean>();
const emit = defineEmits<{
  success: [];
}>();
const loading = ref(false);
const { t } = useI18n();

const form = useForm({
  defaultValues: {
    name: "",
    sortName: "",
    description: "",
    contentType: "music" as "music" | "podcast" | "audiobook",
  },
  validators: {
    onSubmit: addGenreSchema(t),
  },
  onSubmit: async ({ value }) => {
    loading.value = true;

    const item: Record<string, unknown> = {
      item_id: "0",
      provider: "library",
      name: value.name,
      sort_name: value.sortName || value.name,
      provider_mappings: [],
      favorite: false,
      content_type: value.contentType === "music" ? null : value.contentType,
    };

    if (value.description) {
      item.metadata = { description: value.description };
    }

    try {
      await api.addGenreToLibrary(item, true);
      toast.success(t("genre_added_successfully"));
      form.reset();
      emit("success");
      model.value = false;
    } catch (error) {
      toast.error(t("genre_add_failed"));
    } finally {
      loading.value = false;
    }
  },
});

const isInvalid = (field: AnyFieldApi) => {
  return field.state.meta.isTouched && field.state.meta.errors.length > 0;
};

const handleClose = () => {
  form.reset();
  model.value = false;
};

watch(
  () => model.value,
  (active) => {
    if (active != null) store.dialogActive = active;
    if (!active) {
      form.reset();
    }
  },
  { immediate: true },
);
</script>
