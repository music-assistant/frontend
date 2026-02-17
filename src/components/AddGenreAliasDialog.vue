<template>
  <Dialog v-model:open="model">
    <DialogContent class="sm:max-w-[520px]">
      <DialogHeader>
        <DialogTitle>{{ dialogTitle }}</DialogTitle>
      </DialogHeader>
      <form id="form-add-genre-alias" @submit.prevent="form.handleSubmit">
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
          form="form-add-genre-alias"
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
import { useForm } from "@tanstack/vue-form";
import { computed, ref, watch } from "vue";
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
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { addGenreAliasSchema } from "@/lib/forms/genre";
import api from "@/plugins/api";
import { MediaType } from "@/plugins/api/interfaces";
import { store } from "@/plugins/store";

export interface Props {
  type: MediaType.GENRE | MediaType.GENRE_ALIAS;
}

const props = defineProps<Props>();
const model = defineModel<boolean>();
const emit = defineEmits<{
  success: [];
}>();
const loading = ref(false);
const { t } = useI18n();

const dialogTitle = computed(() =>
  props.type === MediaType.GENRE ? t("add_genre") : t("add_alias"),
);

const successMessage = computed(() =>
  props.type === MediaType.GENRE
    ? t("genre_added_successfully")
    : t("alias_added_successfully"),
);

const errorMessage = computed(() =>
  props.type === MediaType.GENRE
    ? t("genre_add_failed")
    : t("alias_add_failed"),
);

const form = useForm({
  defaultValues: {
    name: "",
    sortName: "",
    description: "",
  },
  validators: {
    onSubmit: addGenreAliasSchema(t) as any,
  },
  onSubmit: async ({ value }) => {
    loading.value = true;

    const item: Record<string, any> = {
      item_id: "0",
      provider: "library",
      name: value.name,
      sort_name: value.sortName || value.name,
      provider_mappings: [],
      favorite: false,
    };

    if (value.description) {
      item.metadata = { description: value.description };
    }

    try {
      if (props.type === MediaType.GENRE) {
        await api.addGenreToLibrary(item, true);
      } else {
        await api.addAliasToLibrary(item, true);
      }

      toast.success(successMessage.value);
      form.reset();
      emit("success");
      model.value = false;
    } catch (error) {
      toast.error(errorMessage.value);
    } finally {
      loading.value = false;
    }
  },
});

const isInvalid = (field: any) => {
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
