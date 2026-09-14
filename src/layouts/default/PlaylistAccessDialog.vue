<!--
  Global dialog to set who owns a Music Assistant playlist, who may see it and
  who may edit it. Because this dialog can be called from various places
  throughout the app, we steer its visibility through the centralized eventbus.
-->
<template>
  <Dialog :key="dialogKey" v-model:open="showDialog">
    <DialogContent class="sm:max-w-[480px]">
      <DialogHeader>
        <DialogTitle>
          {{ $t("playlist_access.title", { name: playlist?.name ?? "" }) }}
        </DialogTitle>
        <DialogDescription>
          {{ $t("playlist_access.description") }}
        </DialogDescription>
      </DialogHeader>
      <form id="form-playlist-access" @submit.prevent="save">
        <FieldGroup>
          <Field v-if="canChangeOwner">
            <FieldLabel for="playlist-access-owner">
              {{ $t("settings.source_access.owner") }}
            </FieldLabel>
            <Select v-model="owner">
              <SelectTrigger id="playlist-access-owner" class="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem :value="NO_OWNER">
                  {{ $t("settings.source_access.household") }}
                </SelectItem>
                <SelectItem
                  v-for="user in members ?? []"
                  :key="user.user_id"
                  :value="user.user_id"
                >
                  {{ userDisplayName(user) }}
                </SelectItem>
              </SelectContent>
            </Select>
            <FieldDescription>
              {{ $t("playlist_access.owner_hint") }}
            </FieldDescription>
          </Field>

          <Field>
            <FieldLabel for="playlist-access-sharing">
              {{ $t("settings.source_access.sharing") }}
            </FieldLabel>
            <Select v-model="sharing">
              <SelectTrigger id="playlist-access-sharing" class="w-full">
                <!-- rendered from state, as the select keeps the label an
                     option had when it mounted -->
                <SelectValue>
                  {{
                    $t(getProviderSharingTranslationKey(sharing, ownedByViewer))
                  }}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem
                  v-for="option in sharingOptions"
                  :key="option"
                  :value="option"
                >
                  {{
                    $t(getProviderSharingTranslationKey(option, ownedByViewer))
                  }}
                </SelectItem>
              </SelectContent>
            </Select>
            <FieldDescription>
              {{ $t(getPlaylistSharingHintTranslationKey(formAccess)) }}
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

          <!-- nobody else may edit a playlist that only its owner sees -->
          <Field
            v-if="sharing !== ProviderSharing.PRIVATE"
            orientation="horizontal"
          >
            <FieldContent>
              <FieldLabel for="playlist-access-collaborative">
                {{ $t("playlist_access.collaborative") }}
              </FieldLabel>
              <FieldDescription>
                {{ $t("playlist_access.collaborative_hint") }}
              </FieldDescription>
            </FieldContent>
            <Switch
              id="playlist-access-collaborative"
              v-model="collaborative"
            />
          </Field>
        </FieldGroup>
      </form>
      <DialogFooter>
        <Button variant="outline" @click="showDialog = false">
          {{ $t("cancel") }}
        </Button>
        <Button
          type="submit"
          form="form-playlist-access"
          :disabled="saving || servesNobody(formAccess)"
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
  FieldContent,
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
import { Switch } from "@/components/ui/switch";
import MultiSelect from "@/components/users/MultiSelect.vue";
import { getPlaylistSharingHintTranslationKey } from "@/helpers/playlist_access";
import {
  getProviderSharingTranslationKey,
  servesNobody,
  userDisplayName,
} from "@/helpers/provider_access";
import { api } from "@/plugins/api";
import {
  type Playlist,
  type PlaylistAccess,
  ProviderSharing,
  Scope,
  type UserSummary,
} from "@/plugins/api/interfaces";
import { authManager } from "@/plugins/auth";
import { type PlaylistAccessDialogEvent, eventbus } from "@/plugins/eventbus";
import { store } from "@/plugins/store";
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { toast } from "vue-sonner";

// a select option needs a non-empty value, so a playlist without owner is
// picked through this stand-in
const NO_OWNER = "none";

const { t } = useI18n();

const showDialog = ref(false);
// force Dialog remount via dynamic key to prevent the enter animation from
// stalling at opacity:0 when opened from a context menu
const dialogKey = ref(0);
const playlist = ref<Playlist>();
// the members to pick an owner and shared members from; null while the caller
// may not list them
const members = ref<UserSummary[] | null>(null);
const owner = ref(NO_OWNER);
const sharing = ref(ProviderSharing.EVERYONE);
const sharedUsers = ref<string[]>([]);
const collaborative = ref(false);
const saving = ref(false);

const currentAccess = computed<PlaylistAccess>(
  () =>
    playlist.value?.access ?? {
      owner: null,
      sharing: ProviderSharing.EVERYONE,
      shared_users: [],
      collaborative: false,
    },
);

const canChangeOwner = computed(
  () => authManager.hasScope(Scope.LIBRARY_MANAGE) && members.value !== null,
);

const canPickSharedUsers = computed(
  () => members.value !== null && sharing.value === ProviderSharing.SELECTED,
);

const selectedOwner = computed(() =>
  owner.value === NO_OWNER ? null : owner.value,
);

const shareOptions = computed(() =>
  (members.value ?? [])
    .filter((user) => user.user_id !== selectedOwner.value)
    .map((user) => ({ label: userDisplayName(user), value: user.user_id })),
);

const sharingOptions = computed(() =>
  Object.values(ProviderSharing).filter((option) => {
    // without a member list there is nobody to select, so that choice is only
    // kept when it is already the current one
    if (option === ProviderSharing.SELECTED)
      return (
        members.value !== null ||
        currentAccess.value.sharing === ProviderSharing.SELECTED
      );
    // a playlist without an owner has to be shared with somebody
    if (option === ProviderSharing.PRIVATE) return selectedOwner.value !== null;
    return true;
  }),
);

// an owner may not hand the playlist over, so the record keeps its own
const recordOwner = computed(() =>
  canChangeOwner.value ? selectedOwner.value : currentAccess.value.owner,
);

// the access record the form describes, as it is saved
const formAccess = computed<PlaylistAccess>(() => ({
  owner: recordOwner.value,
  sharing: sharing.value,
  shared_users:
    sharing.value === ProviderSharing.SELECTED ? sharedUsers.value : [],
  collaborative: collaborative.value,
}));

const ownedByViewer = computed(
  () => recordOwner.value === store.currentUser?.user_id,
);

watch(showDialog, (open) => {
  store.dialogActive = open;
});

watch(selectedOwner, (ownerId) => {
  if (ownerId === null) {
    if (sharing.value === ProviderSharing.PRIVATE)
      sharing.value = ProviderSharing.MEMBERS;
    return;
  }
  // the owner sees the playlist anyway, so it leaves the shared list once picked
  sharedUsers.value = sharedUsers.value.filter((id) => id !== ownerId);
});

onMounted(() => {
  eventbus.on("playlistAccessDialog", (evt: PlaylistAccessDialogEvent) => {
    playlist.value = evt.playlist;
    resetForm();
    dialogKey.value++;
    showDialog.value = true;
    loadMembers();
  });
});

onBeforeUnmount(() => {
  eventbus.off("playlistAccessDialog");
});

const save = async () => {
  if (!playlist.value) return;
  saving.value = true;
  try {
    await api.setPlaylistAccess(playlist.value.item_id, formAccess.value);
    toast.success(t("playlist_access.updated"));
    showDialog.value = false;
  } catch (err) {
    toast.error(String(err));
  } finally {
    saving.value = false;
  }
};

const resetForm = () => {
  const access = currentAccess.value;
  members.value = null;
  owner.value = access.owner ?? NO_OWNER;
  sharing.value = access.sharing;
  sharedUsers.value = [...access.shared_users];
  collaborative.value = access.collaborative;
};

const loadMembers = async () => {
  try {
    members.value = await api.getShareCandidates();
  } catch {
    // a plain member may not list the members yet; the dialog then leaves out
    // what it can not offer
  }
};
</script>
