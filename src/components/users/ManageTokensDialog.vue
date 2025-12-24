<template>
  <Dialog v-model:open="isOpen">
    <DialogContent class="sm:max-w-[900px] max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>
          {{ $t("auth.tokens") }} -
          {{ user?.display_name || user?.username }}
        </DialogTitle>
      </DialogHeader>

      <div class="space-y-6">
        <!-- Active Sessions Section -->
        <div>
          <h3 class="text-base font-semibold mb-2 mt-4">
            {{ $t("auth.active_sessions") }}
          </h3>
          <p class="text-sm text-muted-foreground mb-4">
            {{ $t("auth.active_sessions_description") }}
          </p>
          <div
            v-if="sessionTokens.length === 0"
            class="flex flex-col items-center justify-center py-12 border-2 border-dashed rounded-lg"
          >
            <div
              class="size-16 rounded-full bg-blue-900/20 flex items-center justify-center mb-3"
            >
              <Monitor :size="32" class="text-blue-500" />
            </div>
            <p class="text-sm text-muted-foreground">
              {{ $t("auth.no_active_sessions") }}
            </p>
          </div>
          <div v-else class="space-y-2">
            <Card
              v-for="token in sessionTokens"
              :key="token.token_id"
              class="p-4"
            >
              <div class="flex items-center gap-4">
                <div
                  class="size-10 rounded-full bg-blue-900/20 flex items-center justify-center shrink-0"
                >
                  <Monitor :size="20" class="text-blue-500" />
                </div>
                <div class="flex-1 min-w-0">
                  <div class="font-medium text-sm truncate">
                    {{ token.name }}
                  </div>
                  <div
                    class="text-xs text-muted-foreground flex items-center gap-2 flex-wrap"
                  >
                    <span>
                      {{ $t("created") }}: {{ formatDate(token.created_at) }}
                    </span>
                    <span
                      v-if="token.last_used_at"
                      class="text-muted-foreground"
                    >
                      •
                    </span>
                    <span v-if="token.last_used_at">
                      {{ $t("last_used") }}:
                      {{ formatDate(token.last_used_at) }}
                    </span>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  class="text-destructive hover:text-destructive"
                  @click.stop="emit('revoke', token)"
                >
                  <Trash2 :size="16" />
                </Button>
              </div>
            </Card>
          </div>
        </div>

        <div>
          <div class="flex items-start justify-between gap-4 mb-4">
            <div class="flex-1">
              <h3 class="text-base font-semibold mb-2">
                {{ $t("auth.long_lived_tokens") }}
              </h3>
              <p class="text-sm text-muted-foreground">
                {{ $t("auth.long_lived_tokens_description") }}
              </p>
            </div>
            <Button
              v-if="!showCreateForm"
              size="sm"
              @click="showCreateForm = true"
            >
              <Plus :size="16" />
              {{ $t("auth.create_token") }}
            </Button>
            <Button
              v-else
              variant="outline"
              size="sm"
              @click="showCreateForm = false"
            >
              {{ $t("cancel") }}
            </Button>
          </div>

          <Card v-if="showCreateForm" class="p-4 mb-4 border-primary/20">
            <form id="form-create-token" @submit.prevent="handleCreateToken">
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
                          field.handleChange(
                            (e.target as HTMLInputElement).value,
                          );
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
              <div class="flex justify-end gap-2 mt-4">
                <Button variant="outline" @click="showCreateForm = false">
                  {{ $t("cancel") }}
                </Button>
                <Button
                  type="submit"
                  :disabled="!canCreate"
                  :loading="creating"
                >
                  {{ $t("create") }}
                </Button>
              </div>
            </form>
          </Card>

          <Card
            v-if="createdToken"
            class="p-4 mb-4 bg-destructive/10 border-destructive/20"
          >
            <p class="text-sm text-muted-foreground">
              {{ $t("auth.copy_new_token_hint") }}
            </p>
            <InputGroup>
              <InputGroupInput
                :model-value="createdToken"
                readonly
                class="font-mono text-sm"
              />
              <InputGroupAddon align="inline-end">
                <InputGroupButton
                  size="icon-sm"
                  variant="ghost"
                  @click="copyToken"
                >
                  <Copy :size="16" />
                </InputGroupButton>
              </InputGroupAddon>
            </InputGroup>
            <Button
              variant="outline"
              class="mt-4 w-full"
              @click="handleCloseCreateForm"
            >
              {{ $t("close") }}
            </Button>
          </Card>

          <div
            v-if="longLivedTokens.length === 0"
            class="flex flex-col items-center justify-center py-12 border-2 border-dashed rounded-lg"
          >
            <div
              class="size-16 rounded-full bg-purple-900/20 flex items-center justify-center mb-3"
            >
              <Key :size="32" class="text-purple-500" />
            </div>
            <p class="text-sm text-muted-foreground">
              {{ $t("auth.no_long_lived_tokens") }}
            </p>
          </div>
          <div v-else class="space-y-2">
            <Card
              v-for="token in longLivedTokens"
              :key="token.token_id"
              class="p-4"
            >
              <div class="flex items-center gap-4">
                <div
                  class="size-10 rounded-full bg-purple-900/20 flex items-center justify-center shrink-0"
                >
                  <Key :size="20" class="text-purple-500" />
                </div>
                <div class="flex-1 min-w-0">
                  <div class="font-medium text-sm truncate">
                    {{ token.name }}
                  </div>
                  <div
                    class="text-xs text-muted-foreground flex items-center gap-2 flex-wrap"
                  >
                    <span>
                      {{ $t("created") }}: {{ formatDate(token.created_at) }}
                    </span>
                    <span
                      v-if="token.last_used_at"
                      class="text-muted-foreground"
                    >
                      •
                    </span>
                    <span v-if="token.last_used_at">
                      {{ $t("last_used") }}:
                      {{ formatDate(token.last_used_at) }}
                    </span>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  class="text-destructive hover:text-destructive"
                  @click.stop="emit('revoke', token)"
                >
                  <Trash2 :size="16" />
                </Button>
              </div>
            </Card>
          </div>
        </div>
      </div>

      <DialogFooter>
        <Button variant="outline" @click="emit('update:modelValue', false)">
          {{ $t("close") }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
import { useForm } from "@tanstack/vue-form";
import { useVModel } from "@vueuse/core";
import { Copy, Key, Monitor, Plus, Trash2 } from "lucide-vue-next";
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import { toast } from "vuetify-sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
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
import type { AuthToken, User } from "@/plugins/api/interfaces";

const { t } = useI18n();

const props = defineProps<{
  modelValue: boolean;
  user: User | null;
  tokens: AuthToken[];
}>();

const emit = defineEmits<{
  "update:modelValue": [value: boolean];
  revoke: [token: AuthToken];
  "token-created": [];
}>();

const isOpen = useVModel(props, "modelValue", emit);

const showCreateForm = ref(false);
const creating = ref(false);
const tokenName = ref("");
const createdToken = ref("");

const sessionTokens = computed(() =>
  props.tokens.filter((token) => !token.is_long_lived),
);

const longLivedTokens = computed(() =>
  props.tokens.filter((token) => token.is_long_lived),
);

const formatDate = (dateStr: string) => {
  return new Date(dateStr).toLocaleString();
};

const form = useForm({
  defaultValues: {
    tokenName: "",
  },
  validators: {
    onSubmit: createTokenSchema(t) as any,
  },
  onSubmit: async () => {
    // Handled in handleCreateToken
  },
});

const isInvalid = (field: any) => {
  return field.state.meta.errors.length > 0;
};

const canCreate = computed(() => {
  const name = tokenName.value || "";
  return name.trim().length > 0 && name.length <= 100 && !creating.value;
});

const handleCreateToken = async () => {
  if (!props.user || !canCreate.value) return;

  creating.value = true;

  try {
    const token = await api.createToken(tokenName.value, props.user.user_id);

    if (token) {
      createdToken.value = token;
      tokenName.value = "";
      showCreateForm.value = false;
      form.reset();
      emit("token-created");
      toast.success(t("auth.token_created"));
    } else {
      toast.error(t("auth.token_create_failed"));
    }
  } catch (error: any) {
    toast.error(error.message || t("auth.token_create_failed"));
  } finally {
    creating.value = false;
  }
};

const copyToken = async () => {
  if (createdToken.value) {
    await copyToClipboard(createdToken.value);
    toast.success(t("auth.token_copied"));
  }
};

const handleCloseCreateForm = () => {
  createdToken.value = "";
  tokenName.value = "";
  showCreateForm.value = false;
  form.reset();
};
</script>
