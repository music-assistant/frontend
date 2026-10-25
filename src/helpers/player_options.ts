import {
  PlayerOption,
  PlayerOptionType,
  PlayerOptionValueType,
} from "@/plugins/api/interfaces";

export type PlayerOptionControl =
  "switch" | "slider" | "number" | "text" | "select";

// the order the controls of the adjustable options are listed in
const CONTROL_ORDER: PlayerOptionControl[] = [
  "switch",
  "slider",
  "number",
  "text",
  "select",
];

const isNumberOption = (option: PlayerOption) =>
  option.type === PlayerOptionType.INTEGER ||
  option.type === PlayerOptionType.FLOAT;

/** The control that edits an option. */
export const getPlayerOptionControl = (
  option: PlayerOption,
): PlayerOptionControl => {
  if (option.options?.length) return "select";
  if (option.type === PlayerOptionType.BOOLEAN) return "switch";
  if (isNumberOption(option)) {
    const hasRange =
      option.min_value !== null &&
      option.max_value !== null &&
      option.step !== null;
    return hasRange ? "slider" : "number";
  }
  return "text";
};

/** Options grouped by their control, then by name. */
export const sortPlayerOptions = (options: PlayerOption[]): PlayerOption[] =>
  [...options].sort(
    (a, b) =>
      CONTROL_ORDER.indexOf(getPlayerOptionControl(a)) -
        CONTROL_ORDER.indexOf(getPlayerOptionControl(b)) ||
      a.name.localeCompare(b.name),
  );

/**
 * The value to send for what was typed into an option's field, or undefined
 * when there is nothing to send: unchanged, or not a number for a number option.
 */
export const parsePlayerOptionInput = (
  option: PlayerOption,
  input: string,
): PlayerOptionValueType | undefined => {
  if (!isNumberOption(option)) {
    return input === option.value ? undefined : input;
  }
  if (input.trim() === "") return undefined;
  let value = Number(input);
  if (!Number.isFinite(value)) return undefined;
  if (option.type === PlayerOptionType.INTEGER) value = Math.round(value);
  if (option.min_value !== null) value = Math.max(option.min_value, value);
  if (option.max_value !== null) value = Math.min(option.max_value, value);
  return value === option.value ? undefined : value;
};

/** The text a read-only option shows for its value. */
export const formatPlayerOptionValue = (option: PlayerOption): string => {
  const entry = option.options?.find((x) => x.value === option.value);
  return entry ? entry.name : String(option.value);
};
