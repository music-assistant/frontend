import type {
  RotationCondition,
  RotationDescribe,
  RotationFieldInfo,
  RotationMediaType,
} from "@/plugins/api/interfaces";

export const RANDOM_FIELD = "random";
export const BETWEEN_OPERATOR = "between";
export const IN_LAST_DAYS_OPERATOR = "in_last_days";
export const ONE_OF_OPERATOR = "one_of";
const DEFAULT_LAST_DAYS = 30;
const TEXT_OPERATORS = ["contains", "not_contains", "starts_with", "ends_with"];

/** A reference field matched by the name of its item is typed as plain text. */
export function isRefTextOperator(
  type: RotationFieldInfo["type"],
  op: string,
): boolean {
  return type === "ref" && TEXT_OPERATORS.includes(op);
}

/** Fields a Keep / Leave out condition can use; sort-only fields have no operators. */
export function conditionFields(
  kind: RotationMediaType,
  describe: RotationDescribe,
): RotationFieldInfo[] {
  return (describe.media_types[kind]?.fields ?? []).filter(
    (field) => field.operators.length > 0,
  );
}

/** The sort keys of a kind with their labels; the random key comes first. */
export function sortFields(
  kind: RotationMediaType,
  describe: RotationDescribe,
): { name: string; label: string | null }[] {
  const entry = describe.media_types[kind];
  if (!entry) return [];
  const labels = new Map(entry.fields.map((f) => [f.name, f.label]));
  return entry.sort_keys.map((name) => ({
    name,
    label: labels.get(name) ?? null,
  }));
}

/** The empty value that fits a field type and operator. */
export function defaultConditionValue(
  type: RotationFieldInfo["type"],
  op: string,
): unknown {
  // the server asks to pick an item only for a missing reference
  if (type === "ref") return isRefTextOperator(type, op) ? "" : null;
  if (op === BETWEEN_OPERATOR) return type === "date" ? ["", ""] : [0, 0];
  if (op === IN_LAST_DAYS_OPERATOR) return DEFAULT_LAST_DAYS;
  if (op === ONE_OF_OPERATOR) return [];
  switch (type) {
    case "number":
      return 0;
    case "bool":
      return true;
    default:
      return "";
  }
}

export function newCondition(field: RotationFieldInfo): RotationCondition {
  const op = field.operators[0]!;
  return {
    field: field.name,
    op,
    value: defaultConditionValue(field.type, op),
  };
}

/** Switch the operator and reset the value when its shape no longer fits. */
export function withOperator(
  condition: RotationCondition,
  field: RotationFieldInfo,
  op: string,
): RotationCondition {
  const shape = (operator: string) => {
    if (isRefTextOperator(field.type, operator)) return "text";
    return [BETWEEN_OPERATOR, IN_LAST_DAYS_OPERATOR, ONE_OF_OPERATOR].includes(
      operator,
    )
      ? operator
      : "single";
  };
  if (shape(op) === shape(condition.op)) return { ...condition, op };
  return { ...condition, op, value: defaultConditionValue(field.type, op) };
}
