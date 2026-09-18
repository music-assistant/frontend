import {
  effectiveProviderAccess,
  getProviderSharingTranslationKey,
  hasConfigurableAccess,
  isOwnMusicSource,
  servesNobody,
  shareCandidates,
  userDisplayName,
} from "@/helpers/provider_access";
import { api } from "@/plugins/api";
import {
  type ProviderConfig,
  ProviderSharing,
  type User,
  type UserSummary,
} from "@/plugins/api/interfaces";
import { $t } from "@/plugins/i18n";
import { store } from "@/plugins/store";
import { computed, type MaybeRefOrGetter, onMounted, ref, toValue } from "vue";
import { toast } from "vue-sonner";

interface UseProviderAccessOptions {
  managesAllSources: MaybeRefOrGetter<boolean>;
  canOwnSources: MaybeRefOrGetter<boolean>;
  canManageSource: (item: ProviderConfig) => boolean;
}

/**
 * The owner and sharing of the listed music sources: who they may be shared
 * with, the compact access summary shown per source, and the access dialog.
 */
export function useProviderAccess(options: UseProviderAccessOptions) {
  const users = ref<User[]>([]);
  // the members a member may share its sources with, null until listed
  const memberShareCandidates = ref<UserSummary[] | null>(null);
  const accessDialogConfig = ref<ProviderConfig | null>(null);
  const showAccessDialog = ref(false);

  const usersById = computed(
    () => new Map(users.value.map((user) => [user.user_id, user])),
  );

  // an admin picks the members to share with from its own user list
  const accessShareCandidates = computed(() =>
    toValue(options.managesAllSources)
      ? shareCandidates(users.value)
      : memberShareCandidates.value,
  );

  // only a music source carries an owner and sharing, and only whoever manages
  // the source may change them
  const canConfigureAccess = function (item: ProviderConfig) {
    return (
      options.canManageSource(item) &&
      hasConfigurableAccess(item, api.providerManifests[item.domain])
    );
  };

  // the access record in its compact form: "<owner> · <who it is shared with>",
  // without the owner for a member, which only summarizes its own sources; a
  // source nobody can use says so instead
  const accessSummary = function (item: ProviderConfig) {
    const access = effectiveProviderAccess(item.access);
    if (servesNobody(access)) return $t("settings.source_access.nobody");
    const sharedCount = access.shared_users.length;
    const sharing =
      access.sharing === ProviderSharing.SELECTED
        ? $t("settings.source_access.shared_with_count", sharedCount, {
            named: { count: sharedCount },
          })
        : $t(
            getProviderSharingTranslationKey(
              access.sharing,
              isOwnMusicSource(item, store.currentUser?.user_id),
            ),
          );
    if (!toValue(options.managesAllSources)) return sharing;
    const owner =
      access.owner === null
        ? $t("settings.source_access.household")
        : getUserName(access.owner);
    return `${owner} · ${sharing}`;
  };

  const openAccessDialog = function (config: ProviderConfig) {
    accessDialogConfig.value = config;
    showAccessDialog.value = true;
  };

  const loadUsers = async function () {
    try {
      users.value = await api.getAllUsers();
    } catch {
      toast.error($t("auth.users_load_failed"));
    }
  };

  const loadShareCandidates = async function () {
    try {
      memberShareCandidates.value = await api.getShareCandidates();
    } catch {
      toast.error($t("auth.users_load_failed"));
    }
  };

  // a user that is no longer in the list is shown by its id
  const getUserName = function (userId: string) {
    const user = usersById.value.get(userId);
    return user ? userDisplayName(user) : userId;
  };

  onMounted(() => {
    // listing the users is an admin call, so a member picks from the share
    // candidates; the server lists them to whoever may own a source, older
    // servers not at all
    if (toValue(options.managesAllSources)) loadUsers();
    else if (toValue(options.canOwnSources) && api.supportsShareCandidates)
      loadShareCandidates();
  });

  return {
    users,
    accessShareCandidates,
    accessDialogConfig,
    showAccessDialog,
    canConfigureAccess,
    accessSummary,
    openAccessDialog,
  };
}
