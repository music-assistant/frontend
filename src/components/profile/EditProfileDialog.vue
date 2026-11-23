<template>
  <Dialog v-model:open="open">
    <DialogContent
      class="sm:max-w-md"
      @open-auto-focus="preventOnScreenKeyboardOnOpen"
    >
      <DialogHeader>
        <DialogTitle>{{ $t("auth.edit_profile") }}</DialogTitle>
      </DialogHeader>
      <form id="form-edit-profile" @submit.prevent="form.handleSubmit">
        <FieldGroup>
          <Avatar class="size-24 self-center">
            <AvatarImage
              v-if="values.avatarUrl"
              :key="values.avatarUrl"
              :src="values.avatarUrl"
            />
            <AvatarFallback class="bg-muted">
              <User :size="40" class="text-muted-foreground" />
            </AvatarFallback>
          </Avatar>

          <form.Field name="username">
            <template #default="{ field }">
              <FormTextField
                :field="field"
                :label="$t('auth.username')"
                autocomplete="username"
              />
            </template>
          </form.Field>

          <form.Field name="displayName">
            <template #default="{ field }">
              <FormTextField
                :field="field"
                :label="$t('auth.display_name')"
                autocomplete="name"
                :description="$t('optional')"
              />
            </template>
          </form.Field>

          <form.Field name="avatarUrl">
            <template #default="{ field }">
              <FormTextField
                :field="field"
                :label="$t('auth.avatar_url')"
                :description="$t('auth.avatar_url_hint')"
              />
            </template>
          </form.Field>
        </FieldGroup>
      </form>
      <DialogFooter>
        <Button variant="outline" @click="open = false">
          {{ $t("cancel") }}
        </Button>
        <Button
          type="submit"
          form="form-edit-profile"
          :disabled="!hasChanges"
          :loading="updating"
        >
          {{ $t("auth.save_changes") }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
import { User } from "@lucide/vue";
import { useForm } from "@tanstack/vue-form";
import { computed, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { toast } from "vue-sonner";

import FormTextField from "@/components/forms/FormTextField.vue";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FieldGroup } from "@/components/ui/field";
import { runAfterPreferenceWrites } from "@/composables/userPreferences";
import { accountFormValues, accountUpdates } from "@/helpers/account_form";
import { preventOnScreenKeyboardOnOpen } from "@/helpers/dialog_focus";
import { profileSettingsSchema } from "@/lib/forms/profile";
import { api, ApiCommandError } from "@/plugins/api";
import { store } from "@/plugins/store";

/**
 * A dialog to change the username, display name and avatar of the signed-in
 * user. Opens on the account as it is, and closes once the change is saved.
 */
const open = defineModel<boolean>("open", { required: true });

const { t } = useI18n();

const updating = ref(false);

const form = useForm({
  defaultValues: accountFormValues(store.currentUser),
  validators: {
    onSubmit: profileSettingsSchema(t),
  },
  onSubmit: async ({ value }) => {
    if (!store.currentUser) return;
    const updates = accountUpdates(value, store.currentUser);
    if (Object.keys(updates).length === 0) return;

    updating.value = true;

    try {
      // The reply carries the whole account, preferences and all, and it is
      // what the store is handed: a save that overtook a preference write on
      // its way out would put the set back as it was before it, and one that
      // handed the store its reply after the next write had started would take
      // that write off again. So both the request and the replacement happen
      // in the one turn — and on the account that asked for them, which is not
      // always the one signed in by the time the reply is in.
      const userId = store.currentUser.user_id;
      const updatedUser = await runAfterPreferenceWrites(async () => {
        const saved = await api.updateUser(userId, updates, {
          suppressGlobalError: true,
        });
        if (saved && store.currentUser?.user_id === userId) {
          store.currentUser = saved;
        }
        return saved;
      });

      if (updatedUser) {
        toast.success(t("auth.profile_updated"));
        open.value = false;
      }
    } catch (error) {
      toast.error(
        error instanceof ApiCommandError && error.details
          ? error.details
          : t("error_generic"),
      );
    } finally {
      updating.value = false;
    }
  },
});

const values = form.useStore((state) => state.values);

const hasChanges = computed(
  () =>
    !!store.currentUser &&
    Object.keys(accountUpdates(values.value, store.currentUser)).length > 0,
);

// each time it opens, the form starts over from the account as it is
watch(open, (isOpen) => {
  if (isOpen) form.reset(accountFormValues(store.currentUser));
});
</script>
