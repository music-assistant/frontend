<template>
  <Card>
    <CardHeader>
      <CardTitle>{{ $t("auth.account_settings") }}</CardTitle>
      <CardDescription>
        {{ $t("auth.manage_your_profile_info") }}
      </CardDescription>
    </CardHeader>
    <CardContent>
      <form id="form-profile-settings" @submit.prevent="form.handleSubmit">
        <FieldGroup>
          <div class="flex flex-col sm:flex-row gap-6 mb-6">
            <div class="flex flex-col items-center gap-3">
              <div class="relative">
                <Avatar class="size-32">
                  <AvatarImage
                    v-if="
                      currentAvatarUrl ||
                      form.state.values.avatarUrl ||
                      user?.avatar_url
                    "
                    :key="
                      currentAvatarUrl ||
                      form.state.values.avatarUrl ||
                      user?.avatar_url ||
                      ''
                    "
                    :src="
                      currentAvatarUrl ||
                      form.state.values.avatarUrl ||
                      user?.avatar_url ||
                      ''
                    "
                    @error="avatarError = true"
                  />
                  <AvatarFallback class="bg-muted">
                    <User :size="48" class="text-muted-foreground" />
                  </AvatarFallback>
                </Avatar>
                <Button
                  v-if="!isIngressSession"
                  type="button"
                  variant="outline"
                  size="icon"
                  class="absolute bottom-0 right-0 size-8 rounded-full border-2 border-background bg-background shadow-md hover:bg-accent"
                  @click="showAvatarDialog = true"
                >
                  <Camera :size="14" />
                </Button>
              </div>
            </div>

            <div class="flex-1 space-y-4">
              <form.Field name="username">
                <template #default="{ field }">
                  <Field :data-invalid="isInvalid(field)">
                    <FieldLabel :for="field.name">
                      {{ $t("auth.username") }}
                    </FieldLabel>
                    <Input
                      :id="field.name"
                      :name="field.name"
                      :model-value="field.state.value"
                      :aria-invalid="isInvalid(field)"
                      :disabled="isIngressSession"
                      autocomplete="username"
                      @blur="field.handleBlur"
                      @input="handleUsernameInput($event, field)"
                    />
                    <FieldError
                      v-if="isInvalid(field)"
                      :errors="field.state.meta.errors"
                    />
                  </Field>
                </template>
              </form.Field>

              <form.Field name="displayName">
                <template #default="{ field }">
                  <Field :data-invalid="isInvalid(field)">
                    <FieldLabel :for="field.name">
                      {{ $t("auth.display_name") }}
                    </FieldLabel>
                    <Input
                      :id="field.name"
                      :name="field.name"
                      :model-value="field.state.value"
                      :aria-invalid="isInvalid(field)"
                      :disabled="isIngressSession"
                      autocomplete="name"
                      @blur="field.handleBlur"
                      @input="handleDisplayNameInput($event, field)"
                    />
                    <FieldDescription>
                      {{ $t("optional") }}
                    </FieldDescription>
                    <FieldError
                      v-if="isInvalid(field)"
                      :errors="field.state.meta.errors"
                    />
                  </Field>
                </template>
              </form.Field>

              <form.Field name="role">
                <template #default="{ field }">
                  <Field>
                    <FieldLabel :for="field.name">
                      {{ $t("auth.role") }}
                    </FieldLabel>
                    <Input
                      :id="field.name"
                      :name="field.name"
                      :model-value="field.state.value"
                      readonly
                      disabled
                      class="bg-muted"
                    />
                  </Field>
                </template>
              </form.Field>
            </div>
          </div>
        </FieldGroup>
      </form>
    </CardContent>
    <CardFooter>
      <Field orientation="horizontal">
        <Button
          v-if="hasChanges"
          type="button"
          variant="outline"
          @click="handleReset"
        >
          {{ $t("cancel") }}
        </Button>
        <Button
          type="submit"
          form="form-profile-settings"
          :disabled="!hasChanges || updating"
          :loading="updating"
        >
          {{ $t("auth.save_changes") || "Save changes" }}
        </Button>
      </Field>
    </CardFooter>
  </Card>

  <Dialog v-model:open="showAvatarDialog">
    <DialogContent class="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>{{ $t("auth.change_avatar") }}</DialogTitle>
        <DialogDescription>
          {{ $t("auth.avatar_url_hint") }}
        </DialogDescription>
      </DialogHeader>
      <div class="flex flex-col items-center gap-4 py-4">
        <Avatar class="size-36">
          <AvatarImage
            v-if="tempAvatarUrl"
            :src="tempAvatarUrl"
            @error="avatarError = true"
          />
          <AvatarFallback class="bg-muted">
            <User :size="72" class="text-muted-foreground" />
          </AvatarFallback>
        </Avatar>
        <Field class="w-full">
          <FieldLabel>
            {{ $t("auth.avatar_url") }}
          </FieldLabel>
          <Input
            v-model="tempAvatarUrl"
            :placeholder="$t('auth.avatar_url_hint')"
          />
          <FieldDescription>
            {{ $t("auth.avatar_url_hint") }}
          </FieldDescription>
        </Field>
      </div>
      <DialogFooter>
        <Button variant="outline" @click="closeAvatarDialog">
          {{ $t("cancel") }}
        </Button>
        <Button @click="handleAvatarChange">
          {{ $t("auth.save_changes") || "Save changes" }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
import { useForm } from "@tanstack/vue-form";
import { Camera, User } from "lucide-vue-next";
import { computed, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { toast } from "vuetify-sonner";
import { z } from "zod";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { api } from "@/plugins/api";
import { store } from "@/plugins/store";

const { t } = useI18n();

const user = computed(() => store.currentUser);
const isIngressSession = computed(() => store.isIngressSession);

const showAvatarDialog = ref(false);
const tempAvatarUrl = ref("");
const avatarError = ref(false);
const updating = ref(false);
const originalAvatarUrl = ref("");

const currentUsername = ref("");
const currentDisplayName = ref("");
const currentAvatarUrl = ref("");

const formSchema = z.object({
  username: z
    .string()
    .min(3, t("auth.username_min_length"))
    .max(50, "Username must be at most 50 characters."),
  displayName: z
    .string()
    .max(100, "Display name must be at most 100 characters."),
  avatarUrl: z
    .string()
    .refine((val) => !val || z.string().url().safeParse(val).success, {
      message: "Invalid URL format.",
    }),
  role: z.string(),
});

const form = useForm({
  defaultValues: {
    username: user.value?.username || "",
    displayName: user.value?.display_name || "",
    avatarUrl: user.value?.avatar_url || "",
    role: user.value ? t(`auth.${user.value.role}_role`) : "",
  },
  validators: {
    onSubmit: formSchema as any,
  },
  onSubmit: async ({ value }) => {
    if (!user.value) return;

    updating.value = true;

    try {
      const updates: {
        username?: string;
        displayName?: string;
        avatarUrl?: string;
      } = {};

      if (value.username !== user.value.username) {
        updates.username = value.username;
      }
      if (value.displayName !== (user.value.display_name || "")) {
        updates.displayName = value.displayName;
      }
      if (value.avatarUrl !== (user.value.avatar_url || "")) {
        updates.avatarUrl = value.avatarUrl;
      }

      if (Object.keys(updates).length === 0) {
        return;
      }

      const updatedUser = await api.updateUser(user.value.user_id, updates);

      if (updatedUser) {
        store.currentUser = updatedUser;

        if (updates.username) {
          currentUsername.value = updatedUser.username || "";
        }
        if (updates.displayName !== undefined) {
          currentDisplayName.value = updatedUser.display_name || "";
        }
        if (updates.avatarUrl !== undefined) {
          currentAvatarUrl.value = updatedUser.avatar_url || "";
          form.setFieldValue("avatarUrl", updatedUser.avatar_url || "");
          avatarError.value = false;
        }
        toast.success(t("auth.profile_updated"));
      }
    } catch (err: any) {
      toast.error(err.message || t("error_generic"));
    } finally {
      updating.value = false;
    }
  },
});

const hasChanges = computed(() => {
  if (!user.value) return false;
  const username = currentUsername.value || form.state.values.username || "";
  const displayName =
    currentDisplayName.value || form.state.values.displayName || "";
  const avatarUrl = currentAvatarUrl.value || form.state.values.avatarUrl || "";
  const originalUsername = user.value.username || "";
  const originalDisplayName = user.value.display_name || "";
  const originalAvatarUrl = user.value.avatar_url || "";
  return (
    username !== originalUsername ||
    displayName !== originalDisplayName ||
    avatarUrl !== originalAvatarUrl
  );
});

function isInvalid(field: any) {
  return field.state.meta.isTouched && !field.state.meta.isValid;
}

const handleUsernameInput = (e: Event, field: any) => {
  const value = (e.target as HTMLInputElement).value;
  currentUsername.value = value;
  field.handleChange(value);
};

const handleDisplayNameInput = (e: Event, field: any) => {
  const value = (e.target as HTMLInputElement).value;
  currentDisplayName.value = value;
  field.handleChange(value);
};

const handleReset = () => {
  if (user.value) {
    const originalAvatar = user.value.avatar_url || "";
    currentUsername.value = user.value.username || "";
    currentDisplayName.value = user.value.display_name || "";
    currentAvatarUrl.value = originalAvatar;
    originalAvatarUrl.value = originalAvatar;
    form.setFieldValue("username", user.value.username);
    form.setFieldValue("displayName", user.value.display_name || "");
    form.setFieldValue("avatarUrl", originalAvatar);
    form.setFieldValue("role", t(`auth.${user.value.role}_role`));
  }
};

const closeAvatarDialog = () => {
  currentAvatarUrl.value = originalAvatarUrl.value;
  form.setFieldValue("avatarUrl", originalAvatarUrl.value);
  tempAvatarUrl.value = originalAvatarUrl.value;
  showAvatarDialog.value = false;
  avatarError.value = false;
};

const handleAvatarChange = () => {
  const newUrl = tempAvatarUrl.value;
  currentAvatarUrl.value = newUrl;
  if (newUrl !== form.state.values.avatarUrl) {
    form.setFieldValue("avatarUrl", newUrl);
  }
  showAvatarDialog.value = false;
  avatarError.value = false;
};

watch(
  () => user.value?.avatar_url,
  (newAvatarUrl) => {
    if (newAvatarUrl !== undefined) {
      currentAvatarUrl.value = newAvatarUrl || "";
      form.setFieldValue("avatarUrl", newAvatarUrl || "");
      if (!showAvatarDialog.value) {
        tempAvatarUrl.value = newAvatarUrl || "";
      }
    }
  },
  { immediate: true },
);

watch(showAvatarDialog, (isOpen) => {
  if (isOpen) {
    originalAvatarUrl.value =
      user.value?.avatar_url ||
      currentAvatarUrl.value ||
      form.state.values.avatarUrl ||
      "";
    tempAvatarUrl.value =
      currentAvatarUrl.value ||
      form.state.values.avatarUrl ||
      user.value?.avatar_url ||
      "";
    avatarError.value = false;
  }
});

watch(
  user,
  (newUser) => {
    if (newUser) {
      const username = newUser.username || "";
      const displayName = newUser.display_name || "";

      currentUsername.value = username;
      currentDisplayName.value = displayName;

      form.setFieldValue("username", username);
      form.setFieldValue("displayName", displayName);
      form.setFieldValue("role", t(`auth.${newUser.role}_role`));
    }
  },
  { immediate: true },
);

watch(tempAvatarUrl, (newValue) => {
  if (showAvatarDialog.value) {
    currentAvatarUrl.value = newValue;
    form.setFieldValue("avatarUrl", newValue);
  }
});
</script>
