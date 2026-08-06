import { ConfigEntryType, type ConfigEntry } from "@/plugins/api/interfaces";

export const CONFIG_KEY_UI = {
  DSP_SETTINGS_LINK: "dsp_settings_link",
} as const;

export type UiOnlyKey = (typeof CONFIG_KEY_UI)[keyof typeof CONFIG_KEY_UI];
export type ConfigKeyUI = string | UiOnlyKey;

export const UI_ENTRY_TYPE = {
  // entry type equals key for dsp_settings_link
  DSP_SETTINGS_LINK: CONFIG_KEY_UI.DSP_SETTINGS_LINK,
} as const;

export type UiOnlyEntryType =
  (typeof UI_ENTRY_TYPE)[keyof typeof UI_ENTRY_TYPE];
export type ConfigEntryUIType = ConfigEntryType | UiOnlyEntryType;

export type InjectedConfigEntry = Omit<ConfigEntry, "type"> & {
  injected: true;
  type: ConfigEntryUIType;
  read_only?: boolean;
};

export type ServerConfigEntryUI = ConfigEntry & {
  injected?: false;
};
export type ConfigEntryUI = ServerConfigEntryUI | InjectedConfigEntry;

/**
 * Entry types whose ConfigEntryField branch takes no `disabled` binding.
 *
 * An unmet `depends_on` normally leaves an entry visible but disabled. These types
 * have nothing to disable, so a form must hide them instead or they read as if the
 * dependency were met.
 *
 * {@link VALUELESS_ENTRY_TYPES} derives from this list, so adding a type here also
 * excludes it from validation and unsaved-change tracking.
 */
export const NON_INTERACTIVE_ENTRY_TYPES: ConfigEntryUIType[] = [
  ConfigEntryType.DIVIDER,
  ConfigEntryType.LABEL,
  ConfigEntryType.ALERT,
  ConfigEntryType.IMAGE,
];

/**
 * Entry types that hold no user-supplied value, so they take no part in validation
 * or unsaved-change tracking.
 *
 * A type here may still carry a value the server set — an IMAGE holds its data-URI —
 * but nothing the form does can change it. Wider than
 * {@link NON_INTERACTIVE_ENTRY_TYPES} by ACTION: an action button is interactive (an
 * unmet dependency disables it) but stores nothing.
 */
export const VALUELESS_ENTRY_TYPES: ConfigEntryUIType[] = [
  ...NON_INTERACTIVE_ENTRY_TYPES,
  ConfigEntryType.ACTION,
];

// the fields a dependency check reads, so both server and UI entry shapes fit
type DependencyFields = Pick<
  ConfigEntry,
  "key" | "value" | "depends_on" | "depends_on_value" | "depends_on_value_not"
>;

// the fields a required-value check reads, on top of the dependency fields it also evaluates
type ValidationFields = DependencyFields &
  Pick<ConfigEntry, "required" | "default_value"> & { type: ConfigEntryUIType };

/**
 * Whether `entry` should be disabled because its `depends_on` dependency is unmet
 * within `entries`.
 *
 * `depends_on_value` requires the dependency to hold that value and
 * `depends_on_value_not` requires it not to; with neither, any truthy dependency
 * value satisfies it. An entry without a dependency is never disabled, while one
 * naming a key that is not on the form always is.
 */
export const isEntryDisabled = (
  entry: DependencyFields,
  entries: readonly DependencyFields[],
): boolean => {
  if (isNullOrUndefined(entry.depends_on)) return false;
  const dependency = entries.find((e) => e.key === entry.depends_on);
  // a key that resolves to nothing stays gated, so a typo cannot silently open the gate
  if (!dependency) return true;
  const dependencyValue = dependency.value;
  if (!isNullOrUndefined(entry.depends_on_value)) {
    return dependencyValue != entry.depends_on_value;
  }
  if (!isNullOrUndefined(entry.depends_on_value_not)) {
    return dependencyValue == entry.depends_on_value_not;
  }
  return !dependencyValue;
};

/**
 * Whether every required entry in `entries` holds something to submit.
 *
 * An entry counts as satisfied by its own value or by a default the server will fall
 * back to. Two kinds never block a submission: {@link VALUELESS_ENTRY_TYPES}, which hold
 * nothing to give, and those {@link isEntryDisabled} gates behind an unmet dependency —
 * including a dependency naming a key that is not on the form, which is unsatisfiable
 * by definition.
 */
export const allRequiredValuesPresent = (
  entries: readonly ValidationFields[],
): boolean =>
  entries.every(
    (entry) =>
      !entry.required ||
      VALUELESS_ENTRY_TYPES.includes(entry.type) ||
      isEntryDisabled(entry, entries) ||
      !isNullOrUndefined(entry.value) ||
      !isNullOrUndefined(entry.default_value),
  );

export const isInjected = (e: ConfigEntryUI): e is InjectedConfigEntry =>
  (e as InjectedConfigEntry).injected === true;

export const isDspLinkEntry = (
  e: ConfigEntryUI,
): e is InjectedConfigEntry & {
  type: typeof UI_ENTRY_TYPE.DSP_SETTINGS_LINK;
} => isInjected(e) && e.type === UI_ENTRY_TYPE.DSP_SETTINGS_LINK;

/**
 * Merges a freshly fetched set of config entries into the entries currently
 * on screen after a PROVIDERS_UPDATED refresh.
 *
 * `incoming` wins for everything about an entry's definition (options,
 * read_only, whether it exists at all), since that's what the server just
 * told us is current. `current` wins for `value`, so a refresh never
 * discards something the user typed but hasn't saved yet.
 *
 * Every returned entry is a fresh object, so the form is free to keep editing
 * them in place without reaching back into either argument.
 */
export const mergeConfigEntries = (
  current: Record<string, ConfigEntry>,
  incoming: Record<string, ConfigEntry>,
): Record<string, ConfigEntry> => {
  const merged: Record<string, ConfigEntry> = {};
  for (const [key, incomingEntry] of Object.entries(incoming)) {
    const currentEntry = current[key];
    merged[key] = currentEntry
      ? { ...incomingEntry, value: currentEntry.value }
      : { ...incomingEntry };
  }
  return merged;
};

/**
 * Merges the entries a config action returned into the ones currently on screen.
 *
 * An action response carries entry definitions without the stored values, so every
 * entry it does not explicitly set keeps the value the form already holds. Without
 * that, pressing any action button would drop the whole form back to its defaults.
 */
export const mergeActionEntries = (
  current: Record<string, ConfigEntry>,
  incoming: ConfigEntry[],
): Record<string, ConfigEntry> => {
  const merged: Record<string, ConfigEntry> = {};
  for (const entry of incoming) {
    merged[entry.key] = {
      ...entry,
      value: entry.value ?? current[entry.key]?.value,
    };
  }
  return merged;
};

const isNullOrUndefined = (value: unknown): boolean =>
  value === null || value === undefined;
