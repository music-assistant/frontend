<template>
  <Dialog :open="open" @update:open="emit('update:open', $event)">
    <DialogContent class="sm:max-w-[480px]">
      <DialogHeader>
        <DialogTitle>
          {{ $t("settings.source_access.title", { name: sourceName }) }}
        </DialogTitle>
        <DialogDescription>
          {{ $t("settings.source_access.description") }}
        </DialogDescription>
      </DialogHeader>
      <form id="form-provider-access" @submit.prevent="save">
        <FieldGroup>
          <Field v-if="canChangeOwner">
            <FieldLabel for="provider-access-owner">
              {{ $t("settings.source_access.owner") }}
            </FieldLabel>
            <Select v-model="owner">
              <SelectTrigger id="provider-access-owner" class="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem :value="HOUSEHOLD_OWNER">
                  {{ $t("settings.source_access.household") }}
                </SelectItem>
                <SelectItem
                  v-for="user in owners"
                  :key="user.user_id"
                  :value="user.user_id"
                >
                  {{ userDisplayName(user) }}
                </SelectItem>
              </SelectContent>
            </Select>
            <FieldDescription>
              {{ $t("settings.source_access.owner_hint") }}
            </FieldDescription>
          </Field>

          <Field>
            <FieldLabel for="provider-access-sharing">
              {{ $t("settings.source_access.sharing") }}
            </FieldLabel>
            <Select v-model="sharing">
              <SelectTrigger id="provider-access-sharing" class="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem
                  v-for="option in sharingOptions"
                  :key="option"
                  :value="option"
                >
                  {{ $t(getProviderSharingTranslationKey(option)) }}
                </SelectItem>
              </SelectContent>
            </Select>
            <FieldDescription>
              {{ $t(getProviderSharingHintTranslationKey(sharing)) }}
            </FieldDescription>
          </Field>

          <Field v-if="canPickSharedUsers">
            <FieldLabel>
              {{ $t("settings.source_access.shared_users") }}
            </FieldLabel>
            <MultiSelect
              v-model="sharedUsers"
              :options="shareOptions"
              :placeholder="$t('settings.source_access.select_members')"
            />
          </Field>
        </FieldGroup>
      </form>
      <DialogFooter>
        <Button variant="outline" @click="emit('update:open', false)">
          {{ $t("cancel") }}
        </Button>
        <Button
          type="submit"
          form="form-provider-access"
          :disabled="saving"
          :loading="saving"
        >
          {{ $t("settings.save") }}
        </Button>
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
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import MultiSelect from "@/components/users/MultiSelect.vue";
import {
  effectiveProviderAccess,
  getProviderSharingHintTranslationKey,
  getProviderSharingTranslationKey,
  ownerCandidates,
  shareCandidates,
  userDisplayName,
} from "@/helpers/provider_access";
import { api } from "@/plugins/api";
import {
  type ProviderConfig,
  ProviderSharing,
  type User,
} from "@/plugins/api/interfaces";
import { computed, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { toast } from "vue-sonner";

// a select option needs a non-empty value, so a household source (no owner)
// is picked through this stand-in
const HOUSEHOLD_OWNER = "household";

const props = defineProps<{
  open: boolean;
  // the music source to set the access of
  config: ProviderConfig | null;
  // the users to pick an owner and shared members from; null when the caller
  // may only share a source it owns and can not list the users
  users: User[] | null;
}>();

const emit = defineEmits<{
  "update:open": [open: boolean];
  saved: [config: ProviderConfig];
}>();

const { t } = useI18n();

const owner = ref(HOUSEHOLD_OWNER);
const sharing = ref(ProviderSharing.EVERYONE);
const sharedUsers = ref<string[]>([]);
const saving = ref(false);

const canChangeOwner = computed(() => props.users !== null);

const canPickSharedUsers = computed(
  () => canChangeOwner.value && sharing.value === ProviderSharing.SELECTED,
);

const sourceName = computed(() => {
  if (!props.config) return "";
  return (
    props.config.name ||
    api.providers[props.config.instance_id]?.name ||
    api.providerManifests[props.config.domain]?.name ||
    props.config.instance_id
  );
});

const selectedOwner = computed(() =>
  owner.value === HOUSEHOLD_OWNER ? null : owner.value,
);

const owners = computed(() => ownerCandidates(props.users ?? []));

const shareOptions = computed(() =>
  shareCandidates(props.users ?? [], selectedOwner.value).map((user) => ({
    label: userDisplayName(user),
    value: user.user_id,
  })),
);

// an owner that can not list the users is not offered to share with selected
// ones, but keeps that choice when an admin made it for its source
const sharingOptions = computed(() =>
  Object.values(ProviderSharing).filter(
    (option) =>
      option !== ProviderSharing.SELECTED ||
      canChangeOwner.value ||
      currentAccess.value.sharing === ProviderSharing.SELECTED,
  ),
);

const currentAccess = computed(() =>
  effectiveProviderAccess(props.config?.access ?? null),
);

watch(
  () => props.open,
  (open) => {
    if (open) resetForm();
  },
);

// the owner uses the source anyway, so it leaves the shared list once picked
watch(selectedOwner, (ownerId) => {
  if (ownerId === null) return;
  sharedUsers.value = sharedUsers.value.filter((id) => id !== ownerId);
});

const save = async () => {
  if (!props.config) return;
  saving.value = true;
  try {
    const updated = await api.setProviderAccess(props.config.instance_id, {
      // an owner may not change the owner, so the record keeps its own
      owner: canChangeOwner.value
        ? selectedOwner.value
        : currentAccess.value.owner,
      sharing: sharing.value,
      shared_users:
        sharing.value === ProviderSharing.SELECTED ? sharedUsers.value : [],
    });
    toast.success(t("settings.source_access.updated"));
    emit("saved", updated);
    emit("update:open", false);
  } catch (err) {
    toast.error(String(err));
  } finally {
    saving.value = false;
  }
};

const resetForm = () => {
  const access = currentAccess.value;
  owner.value = access.owner ?? HOUSEHOLD_OWNER;
  sharing.value = access.sharing;
  sharedUsers.value = [...access.shared_users];
};
</script>
