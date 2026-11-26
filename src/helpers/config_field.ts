import {
  HASS_CONTROL_KEYS,
  isHassControlPickerEntry,
  type ConfigEntryUI,
} from "@/helpers/config_entry_ui";
import { HASS_DOMAIN } from "@/helpers/home_assistant";
import {
  ConfigEntryType,
  type ConfigValueOption,
  type ConfigValueType,
} from "@/plugins/api/interfaces";

/** The control a config entry is rendered with. */
export type ConfigFieldKind =
  | "divider"
  | "label"
  | "alert"
  | "image"
  | "action"
  | "hass_control_picker"
  | "hass_controls"
  | "boolean"
  | "slider"
  | "secret"
  | "pairing_code"
  | "folder"
  | "expanded_options"
  | "select"
  | "number"
  | "icon"
  | "string_list"
  | "text";

const isNumberType = (type: ConfigEntryUI["type"]) =>
  type === ConfigEntryType.INTEGER || type === ConfigEntryType.FLOAT;

/**
 * Picks the control for `entry`. The order matters: an entry can match several
 * kinds, and the first one wins.
 *
 * @param providerDomain The domain of the provider the config belongs to, absent
 *   for player and core configs.
 */
export const configFieldKind = (
  entry: ConfigEntryUI,
  providerDomain?: string,
): ConfigFieldKind => {
  const { type } = entry;
  if (type === ConfigEntryType.DIVIDER) return "divider";
  if (type === ConfigEntryType.LABEL) return "label";
  if (type === ConfigEntryType.ALERT) return "alert";
  if (type === ConfigEntryType.IMAGE) return "image";
  if (type === ConfigEntryType.ACTION || (entry.action && !entry.value)) {
    return "action";
  }
  if (isHassControlPickerEntry(entry)) return "hass_control_picker";
  // only the Home Assistant provider's own control lists get the entity picker
  if (providerDomain === HASS_DOMAIN && HASS_CONTROL_KEYS.has(entry.key)) {
    return "hass_controls";
  }
  if (type === ConfigEntryType.BOOLEAN) return "boolean";
  if (isNumberType(type) && entry.range?.length === 2) return "slider";
  if (type === ConfigEntryType.SECURE_STRING) return "secret";
  if (type === ConfigEntryType.PAIRING_CODE) return "pairing_code";
  if (type === ConfigEntryType.FOLDER) return "folder";
  if (entry.options.length > 0) {
    return entry.expanded_options && !entry.multi_value
      ? "expanded_options"
      : "select";
  }
  if (isNumberType(type)) return "number";
  if (type === ConfigEntryType.ICON) return "icon";
  if (type === ConfigEntryType.STRING && entry.multi_value) {
    return "string_list";
  }
  return "text";
};

const VALIDATED_KINDS: ReadonlySet<ConfigFieldKind> = new Set([
  "select",
  "secret",
  "number",
  "string_list",
  "text",
]);

/**
 * Whether a required entry shown as `kind` has no value to save. Only the kinds
 * that check their value take part; the others always count as filled in.
 *
 * A dropdown is empty without a value. A typed value is also empty as an empty
 * string, while 0 and an empty list count as values.
 */
export const isRequiredValueMissing = (
  entry: Pick<ConfigEntryUI, "required" | "value">,
  kind: ConfigFieldKind,
): boolean => {
  if (!entry.required || !VALIDATED_KINDS.has(kind)) return false;
  const { value } = entry;
  if (value === null || value === undefined) return true;
  return kind !== "select" && value === "";
};

/**
 * The options of a dropdown or option list: the option holding the default is
 * marked as such, and a value the options do not list yet, such as a player
 * control registered moments ago, is offered as an option of its own so the
 * control does not show up blank.
 *
 * @param defaultSuffix The text put after the title of the default option.
 */
export const configFieldOptions = (
  entry: Pick<ConfigEntryUI, "options" | "value" | "default_value">,
  defaultSuffix: string,
): ConfigValueOption[] => {
  const options: ConfigValueOption[] = entry.options.map((option) => ({
    // option titles are resolved server-side for the connection locale
    title: option.title?.toString() || option.value?.toString() || "",
    value: option.value,
    disabled: option.disabled,
    disabled_reason: option.disabled_reason,
    description: option.description,
  }));
  for (const option of options) {
    if (option.value == entry.default_value) {
      option.title += ` [${defaultSuffix}]`;
    }
  }
  const listed = new Set<ConfigValueType>(options.map((o) => o.value));
  const values = Array.isArray(entry.value) ? entry.value : [entry.value];
  for (const value of values) {
    if (value === null || value === undefined || listed.has(value)) continue;
    listed.add(value);
    options.push({ title: value.toString(), value });
  }
  return options;
};

/**
 * The first enabled option whose title starts with `prefix`, ignoring case: what
 * typing on a closed dropdown picks.
 */
export const findOptionByPrefix = (
  options: ConfigValueOption[],
  prefix: string,
): ConfigValueOption | undefined => {
  const lower = prefix.toLowerCase();
  return options.find(
    (option) =>
      !option.disabled && option.title?.toLowerCase().startsWith(lower),
  );
};
