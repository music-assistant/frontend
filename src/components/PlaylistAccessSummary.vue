<!--
  The access record of a playlist in its compact form:
  "<owner> · <who it is shared with> · <collaborative>".
-->
<template>
  <span>{{ summary }}</span>
</template>

<script setup lang="ts">
import { canSharePlaylist } from "@/helpers/playlist_access";
import {
  getProviderSharingTranslationKey,
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
import { $t } from "@/plugins/i18n";
import { store } from "@/plugins/store";
import { computed, ref, watch } from "vue";

const props = defineProps<{
  playlist: Playlist;
}>();

// the members, to name an owner that is somebody else; null while they are not
// loaded or the server refused to list them
const members = ref<UserSummary[] | null>(null);

const summary = computed(() => {
  const access = props.playlist.access;
  if (access === null)
    return `${$t("playlist_access.shared")} · ${$t("settings.source_access.options.everyone")}`;
  const parts = [ownerName(access.owner), sharedWith(access)];
  if (access.collaborative) parts.push($t("playlist_access.collaborative"));
  return parts.join(" · ");
});

// an owner nobody can name is shown as a playlist without owner
const ownerName = (ownerId: string | null) => {
  if (ownerId === null) return $t("playlist_access.shared");
  if (ownerId === store.currentUser?.user_id)
    return $t("playlist_access.personal");
  const owner = members.value?.find((user) => user.user_id === ownerId);
  return owner ? userDisplayName(owner) : $t("playlist_access.shared");
};

const sharedWith = (access: PlaylistAccess) => {
  if (access.sharing !== ProviderSharing.SELECTED)
    return $t(
      getProviderSharingTranslationKey(
        access.sharing,
        access.owner === store.currentUser?.user_id,
      ),
    );
  const count = access.shared_users.length;
  return $t("settings.source_access.shared_with_count", count, {
    named: { count },
  });
};

// only a caller that may share the playlist can list the members, so the name
// of another owner is only asked for then
const loadMembers = async (playlist: Playlist) => {
  const ownerId = playlist.access?.owner;
  if (
    !ownerId ||
    ownerId === store.currentUser?.user_id ||
    !canSharePlaylist(
      playlist,
      store.currentUser,
      authManager.hasScope(Scope.LIBRARY_MANAGE),
    )
  )
    return;
  try {
    members.value = await api.getShareCandidates();
  } catch {
    members.value = null;
  }
};

watch(
  () => props.playlist.access?.owner,
  () => loadMembers(props.playlist),
  {
    immediate: true,
  },
);
</script>
