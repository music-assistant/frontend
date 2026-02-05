<template>
  <Dialog :open="modelValue" @update:open="emit('update:modelValue', $event)">
    <DialogContent class="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>
          {{ createdToken ? tokenName : $t("auth.create_token") }}
        </DialogTitle>
        <DialogDescription v-if="!createdToken">
          {{ $t("auth.token_name_hint") }}
        </DialogDescription>
      </DialogHeader>

      <div v-if="!createdToken" class="py-4">
        <form id="form-create-token" @submit.prevent="form.handleSubmit">
          <form.Field
            name="tokenName"
            :validators="{
              onChange: tokenNameSchema(t),
            }"
          >
            <template #default="{ field }">
              <Field :data-invalid="isInvalid(field)">
                <FieldLabel :for="field.name">
                  {{ $t("auth.token_name") }}
                </FieldLabel>
                <Input
                  :id="field.name"
                  :name="field.name"
                  :model-value="tokenName"
                  :aria-invalid="isInvalid(field)"
                  :placeholder="$t('auth.token_name_hint')"
                  autofocus
                  autocomplete="off"
                  @blur="field.handleBlur"
                  @input="
                    (e: Event) => {
                      tokenName = (e.target as HTMLInputElement).value;
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
        </form>
      </div>

      <div v-else class="py-4">
        <p class="text-sm text-muted-foreground mb-4">
          {{ $t("auth.copy_new_token_hint") }}
        </p>
        <InputGroup>
          <InputGroupInput
            :model-value="createdToken"
            readonly
            class="font-mono text-sm"
          />
          <InputGroupAddon align="inline-end">
            <InputGroupButton size="icon-sm" variant="ghost" @click="copyToken">
              <Copy :size="16" />
            </InputGroupButton>
          </InputGroupAddon>
        </InputGroup>
      </div>

      <DialogFooter>
        <template v-if="!createdToken">
          <Button variant="outline" @click="handleClose">
            {{ $t("cancel") }}
          </Button>
          <Button
            type="submit"
            form="form-create-token"
            :disabled="!canCreate"
            :loading="loading"
          >
            {{ $t("create") }}
          </Button>
        </template>
        <template v-else>
          <Button variant="default" @click="handleClose">
            {{ $t("close") }}
          </Button>
        </template>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
import { useForm } from "@tanstack/vue-form";
import { Copy } from "lucide-vue-next";
import { computed, ref, watch } from "vue";
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
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import { copyToClipboard } from "@/helpers/utils";
import { createTokenSchema, tokenNameSchema } from "@/lib/forms/profile";
import { api } from "@/plugins/api";

const { t } = useI18n();

const props = defineProps<{
  modelValue: boolean;
  userId?: string;
}>();

const emit = defineEmits<{
  "update:modelValue": [value: boolean];
  created: [];
}>();

const loading = ref(false);
const createdToken = ref("");
const tokenName = ref("");

const form = useForm({
  defaultValues: {
    tokenName: "",
  },
  validators: {
    onSubmit: createTokenSchema(t) as any,
  },
  onSubmit: async ({ value }) => {
    loading.value = true;

    try {
      const token = await api.createToken(value.tokenName, props.userId);
      if (token) {
        toast.success(t("auth.token_created"));
        createdToken.value = token;
        tokenName.value = value.tokenName;
        emit("created");
      } else {
        toast.error(t("auth.token_create_failed"));
      }
    } catch (error: any) {
      toast.error(error.message || t("auth.token_create_failed"));
    } finally {
      loading.value = false;
    }
  },
});

function isInvalid(field: any) {
  return field.state.meta.isTouched && !field.state.meta.isValid;
}

const canCreate = computed(() => {
  const name = tokenName.value || "";
  return name.trim().length > 0 && name.length <= 100 && !loading.value;
});

const handleClose = () => {
  form.reset();
  createdToken.value = "";
  tokenName.value = "";
  requestAnimationFrame(() => {
    emit("update:modelValue", false);
  });
};

const copyToken = async () => {
  if (!createdToken.value) return;

  const success = await copyToClipboard(createdToken.value);
  if (success) {
    toast.success(t("auth.token_copied"));
  } else {
    toast.error(t("auth.token_copy_failed"));
  }
};

watch(
  () => props.modelValue,
  (newVal) => {
    if (!newVal) {
      form.reset();
      createdToken.value = "";
      tokenName.value = "";
    } else {
      tokenName.value = "";
    }
  },
);
</script>
