import {
  isSameOwner,
  sourceIncludesEntry,
  type SettingsOwner,
  type SettingsSource,
} from "@/helpers/settings_pages";
import type { ConfigEntry, ConfigValueType } from "@/plugins/api/interfaces";

// the entries of an owner as loaded for one source of a settings page
export interface LoadedSettingsSource {
  source: SettingsSource;
  entries: readonly ConfigEntry[];
}

export interface SettingsForm {
  entries: ConfigEntry[];
  // the owner of each entry, by entry key
  owners: Map<string, SettingsOwner>;
}

// the values of one owner that a save sends
export interface OwnerChanges {
  owner: SettingsOwner;
  values: Record<string, ConfigValueType>;
}

/**
 * The form of a settings page: the entries each source shows, in their given
 * order. Throws when two entries of the form share a key.
 */
export function buildSettingsForm(
  loaded: readonly LoadedSettingsSource[],
): SettingsForm {
  const entries: ConfigEntry[] = [];
  const owners = new Map<string, SettingsOwner>();
  for (const { source, entries: sourceEntries } of loaded) {
    for (const entry of sourceEntries) {
      if (!sourceIncludesEntry(source, entry)) continue;
      if (owners.has(entry.key)) {
        throw new Error(`Settings form has the key "${entry.key}" twice`);
      }
      owners.set(entry.key, source.owner);
      entries.push(entry);
    }
  }
  return { entries, owners };
}

/**
 * The value the server has for each entry, as the settings form shows it: the
 * default for an entry without a value of its own.
 */
export function storedValues(
  entries: readonly ConfigEntry[],
): Record<string, ConfigValueType> {
  return Object.fromEntries(
    entries.map((entry) => [
      entry.key,
      entry.value ?? entry.default_value ?? null,
    ]),
  );
}

/**
 * The form values that differ from the saved ones, grouped per owner. Values
 * of keys outside the form are left out.
 *
 * @param values - The values the form hands over.
 * @param saved - The values the server has.
 * @param owners - The owner of each key of the form.
 */
export function changedValuesByOwner(
  values: Record<string, ConfigValueType>,
  saved: Record<string, ConfigValueType>,
  owners: ReadonlyMap<string, SettingsOwner>,
): OwnerChanges[] {
  const changes: OwnerChanges[] = [];
  for (const [key, value] of Object.entries(values)) {
    const owner = owners.get(key);
    if (!owner || isSameValue(value, saved[key])) continue;
    let ownerChanges = changes.find((change) =>
      isSameOwner(change.owner, owner),
    );
    if (!ownerChanges) {
      ownerChanges = { owner, values: {} };
      changes.push(ownerChanges);
    }
    ownerChanges.values[key] = value;
  }
  return changes;
}

function isSameValue(
  a: ConfigValueType | undefined,
  b: ConfigValueType | undefined,
): boolean {
  if (Array.isArray(a) || Array.isArray(b)) {
    return JSON.stringify(a) === JSON.stringify(b);
  }
  return a === b;
}
