<template>
  <Dialog v-model:open="model">
    <DialogContent class="sm:max-w-[520px]">
      <DialogHeader>
        <DialogTitle>
          {{ isEditMode ? $t(editTitleKey) : $t("add_url_item") }}
        </DialogTitle>
      </DialogHeader>
      <form id="form-add-manual-link" @submit.prevent="form.handleSubmit">
        <FieldGroup>
          <form.Field name="url">
            <template #default="{ field }">
              <Field :data-invalid="isInvalid(field)">
                <FieldLabel :for="field.name">
                  {{ isEditMode ? $t("uri_read_only") : $t("enter_url") }}
                </FieldLabel>
                <Input
                  :id="field.name"
                  :name="field.name"
                  :model-value="field.state.value"
                  :aria-invalid="isInvalid(field)"
                  :disabled="loading"
                  :readonly="isEditMode"
                  @blur="
                    () => {
                      field.handleBlur();
                      fetchItemDetails();
                    }
                  "
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
          form="form-add-manual-link"
          :disabled="loading || !isFormValid"
        >
          <Spinner v-if="loading" />
          {{ isEditMode ? $t("save") : $t("add") }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
import type { AnyFieldApi } from "@tanstack/form-core";
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
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { manualLinkSchema } from "@/lib/forms/manual-link";
import api from "@/plugins/api";
import type { Playlist, Radio, Track } from "@/plugins/api/interfaces";
import { ImageType, MediaType } from "@/plugins/api/interfaces";
import { store } from "@/plugins/store";

export interface Props {
  type: MediaType;
  editItem?: Radio | Track | Playlist;
}

const model = defineModel<boolean>();
const compProps = defineProps<Props>();
const emit = defineEmits<{ success: [] }>();
const { t } = useI18n();

const loading = ref<boolean>(false);
const itemDetails = ref<Radio | Track>();

const isEditMode = computed(() => !!compProps.editItem);

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

const editTitleKey = computed(() => {
  if (!compProps.editItem) return "add_url_item";
  const titleMap: Record<string, string> = {
    [MediaType.RADIO]: "edit_radio",
    [MediaType.TRACK]: "edit_track",
    [MediaType.PLAYLIST]: "edit_playlist",
  };
  return titleMap[compProps.editItem.media_type] || "add_url_item";
});

const updateEndpoint = computed(() => {
  if (!compProps.editItem) return "";
  const endpointMap: Record<string, string> = {
    [MediaType.RADIO]: "music/radios/update",
    [MediaType.TRACK]: "music/tracks/update",
    [MediaType.PLAYLIST]: "music/playlists/update",
  };
  return endpointMap[compProps.editItem.media_type] || "";
});

watch(
  () => model.value,
  (active) => {
    if (active != null) store.dialogActive = active;
    if (active && compProps.editItem) {
      // Pre-populate fields with current values
      const thumbImage = compProps.editItem.metadata?.images?.find(
        (img) => img.type === ImageType.THUMB,
      );
      form.reset({
        url: compProps.editItem.uri || "",
        name: compProps.editItem.name || "",
        image: thumbImage?.path || "",
      });
    } else if (active === false) {
      form.reset({ url: "", name: "", image: "" });
      itemDetails.value = undefined;
    }
  },
  { immediate: true },
);

watch(
  () => itemDetails.value,
  (details) => {
    if (details && !isEditMode.value) {
      if (!form.getFieldValue("name")) form.setFieldValue("name", details.name);
      for (const img of details.metadata.images || []) {
        if (img.type == "thumb") {
          form.setFieldValue("image", img.path);
          break;
        }
      }
    }
  },
);

const fetchItemDetails = () => {
  if (isEditMode.value) return;
  const url = form.getFieldValue("url");
  if (!url || !["http", "rtsp"].some((prefix) => url.startsWith(prefix))) {
    return;
  }
  loading.value = true;
  if (compProps.type == MediaType.RADIO) {
    api
      .getRadio(url, "builtin")
      .then((x) => {
        itemDetails.value = x;
      })
      .catch((e) => {
        console.error(e);
        itemDetails.value = undefined;
      })
      .finally(() => {
        loading.value = false;
      });
  } else {
    api
      .getTrack(url, "builtin")
      .then((x) => {
        itemDetails.value = x;
      })
      .catch((e) => {
        console.error(e);
        itemDetails.value = undefined;
      })
      .finally(() => {
        loading.value = false;
      });
  }
};

const save = async function (value: {
  url: string;
  name: string;
  image: string;
}) {
  if (isEditMode.value && compProps.editItem) {
    loading.value = true;
    try {
      const updatedItem = {
        ...compProps.editItem,
        name: value.name,
      };
      delete updatedItem.sort_name;
      if (value.image) {
        updatedItem.metadata = {
          ...updatedItem.metadata,
          images: [
            {
              type: ImageType.THUMB,
              path: value.image,
              provider: "builtin",
              remotely_accessible: true,
            },
          ],
        };
      } else {
        updatedItem.metadata = {
          ...updatedItem.metadata,
          images: [],
        };
      }
      await api.sendCommand(updateEndpoint.value, {
        item_id: parseInt(compProps.editItem.item_id, 10),
        update: updatedItem,
        overwrite: true,
      });
      model.value = false;
    } catch (e) {
      console.error("Failed to edit item:", e);
    } finally {
      loading.value = false;
    }
  } else {
    if (!itemDetails.value) {
      return;
    }
    const item = itemDetails.value;
    item.name = value.name || item.name;
    delete item.sort_name;
    if (value.image) {
      item.metadata.images = [
        {
          type: ImageType.THUMB,
          path: value.image,
          provider: "builtin",
          remotely_accessible: true,
        },
      ];
    }
    model.value = false;
    toast.success(t("added_to_library", [item.name]));
    api
      .addItemToLibrary(item, true)
      .then(() => emit("success"))
      .catch((e) => {
        console.error("Failed to add item:", e);
        toast.error(t("add_url_item_failed"));
      });
  }
};
</script>
