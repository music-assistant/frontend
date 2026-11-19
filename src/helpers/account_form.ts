import type { User } from "@/plugins/api/interfaces";

/** The values of the form that edits the account of the signed-in user. */
export interface AccountFormValues {
  username: string;
  displayName: string;
  avatarUrl: string;
}

/** The fields of an account to change, as the api takes them. */
export interface AccountUpdates {
  username?: string;
  displayName?: string;
  avatarUrl?: string;
}

type AccountFields = Pick<User, "username" | "display_name" | "avatar_url">;

/**
 * The form values for an account as it is now, with empty fields for what it
 * leaves unset.
 */
export function accountFormValues(
  user: AccountFields | undefined,
): AccountFormValues {
  return {
    username: user?.username ?? "",
    displayName: user?.display_name ?? "",
    avatarUrl: user?.avatar_url ?? "",
  };
}

/**
 * The fields the form values change on the account; empty when they change
 * nothing.
 */
export function accountUpdates(
  values: AccountFormValues,
  user: AccountFields,
): AccountUpdates {
  const current = accountFormValues(user);
  const updates: AccountUpdates = {};
  if (values.username !== current.username) updates.username = values.username;
  if (values.displayName !== current.displayName) {
    updates.displayName = values.displayName;
  }
  if (values.avatarUrl !== current.avatarUrl) {
    updates.avatarUrl = values.avatarUrl;
  }
  return updates;
}
