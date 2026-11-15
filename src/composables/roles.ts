import { roleScopesById } from "@/helpers/roles";
import { api, type CommandOptions } from "@/plugins/api";
import { store } from "@/plugins/store";

/**
 * Load the user roles into the store, along with the scopes each one grants.
 *
 * @param options - Options for the command, such as leaving its error to the caller.
 */
export async function loadRoles(options?: CommandOptions): Promise<void> {
  const roles = await api.getRoles(options);
  store.roles = roles;
  store.roleScopes = roleScopesById(roles);
}
