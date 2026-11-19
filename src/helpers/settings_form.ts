import {
  coreOwner,
  isSameOwner,
  LOG_LEVEL_KEY,
  sourceIncludesEntry,
  type SettingsOwner,
  type SettingsSource,
} from "@/helpers/settings_pages";
import type {
  ConfigEntry,
  ConfigValueType,
  CoreConfig,
} from "@/plugins/api/interfaces";

// the section of the form of the log levels
const LOG_LEVELS_CATEGORY = "log_levels";

// the entries of an owner as loaded for one source of a settings page
export interface LoadedSettingsSource {
  source: SettingsSource;
  entries: readonly ConfigEntry[];
}

// where the value of an entry of the form is stored
export interface SettingsField {
  owner: SettingsOwner;
  // the key of the entry at its owner
  key: string;
}

export interface SettingsForm {
  entries: ConfigEntry[];
  // the field of each entry, by the key the entry has in the form
  fields: Map<string, SettingsField>;
}

// the values of one owner that a save sends
export interface OwnerChanges {
  owner: SettingsOwner;
  values: Record<string, ConfigValueType>;
}

/**
 * The form of a settings page: copies of the entries each source shows, in
 * their given order. On a page with several sources, the keys of the entries
 * are qualified by their owner, so owners sharing a key do not clash, and a
 * source with a title is a section of its own under that title; the entries of
 * a source without one keep their categories, so the entries of owners sharing
 * a category share its section.
 *
 * @param loaded - The entries loaded for each source of the page.
 * @param translate - Gives the text of a translation key.
 */
export function buildSettingsForm(
  loaded: readonly LoadedSettingsSource[],
  translate: (key: string) => string,
): SettingsForm {
  const sectioned = loaded.length > 1;
  const entries: ConfigEntry[] = [];
  const fields = new Map<string, SettingsField>();
  for (const { source, entries: sourceEntries } of loaded) {
    const { owner } = source;
    const formKey = (key: string) =>
      sectioned ? `${ownerQualifier(owner)}/${key}` : key;
    for (const entry of sourceEntries) {
      if (!sourceIncludesEntry(source, entry)) continue;
      const formEntry: ConfigEntry = {
        ...entry,
        key: formKey(entry.key),
        depends_on: entry.depends_on && formKey(entry.depends_on),
        action: entry.action && formKey(entry.action),
      };
      if (sectioned && source.title) {
        formEntry.category = ownerQualifier(owner);
        formEntry.category_label = translate(source.title);
      }
      fields.set(formEntry.key, { owner, key: entry.key });
      entries.push(formEntry);
    }
  }
  return { entries, fields };
}

/**
 * The form of the log levels of the core modules: the log level of each
 * module, labelled with the name of the module, in one section, by name.
 *
 * @param configs - The config of each core module.
 * @param moduleName - Gives the name of a core module, by its domain.
 * @param sectionLabel - The heading of the section.
 */
export function buildLogLevelForm(
  configs: readonly Pick<CoreConfig, "domain" | "values">[],
  moduleName: (domain: string) => string,
  sectionLabel: string,
): SettingsForm {
  const entries: ConfigEntry[] = [];
  const fields = new Map<string, SettingsField>();
  for (const config of configs) {
    const entry = config.values[LOG_LEVEL_KEY];
    if (!entry) continue;
    const owner = coreOwner(config.domain);
    const key = `${ownerQualifier(owner)}/${LOG_LEVEL_KEY}`;
    entries.push({
      ...entry,
      key,
      label: moduleName(config.domain),
      // the description speaks of a single module, which the section does not
      description: null,
      category: LOG_LEVELS_CATEGORY,
      category_label: sectionLabel,
    });
    fields.set(key, { owner, key: LOG_LEVEL_KEY });
  }
  entries.sort((a, b) => (a.label ?? "").localeCompare(b.label ?? ""));
  return { entries, fields };
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
 * The form values that differ from the saved ones, grouped per owner and keyed
 * the way the owner knows them. Values of keys outside the form are left out.
 *
 * @param values - The values the form hands over.
 * @param saved - The values the server has, keyed like the form.
 * @param fields - The field of each key of the form.
 */
export function changedValuesByOwner(
  values: Record<string, ConfigValueType>,
  saved: Record<string, ConfigValueType>,
  fields: ReadonlyMap<string, SettingsField>,
): OwnerChanges[] {
  const changes: OwnerChanges[] = [];
  for (const [formKey, value] of Object.entries(values)) {
    const field = fields.get(formKey);
    if (!field || isSameValue(value, saved[formKey])) continue;
    let ownerChanges = changes.find((change) =>
      isSameOwner(change.owner, field.owner),
    );
    if (!ownerChanges) {
      ownerChanges = { owner: field.owner, values: {} };
      changes.push(ownerChanges);
    }
    ownerChanges.values[field.key] = value;
  }
  return changes;
}

function ownerQualifier(owner: SettingsOwner): string {
  return `${owner.kind}/${owner.id}`;
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
