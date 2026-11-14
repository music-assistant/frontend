import type { RotationStepError } from "@/plugins/api/interfaces";

/**
 * Return the errors of a step that concern a path inside the step.
 *
 * An error concerns the path when its field is the path itself or a path
 * inside it, such as `conditions[0].op` for `conditions[0]`.
 *
 * @param errors The validation errors of one step.
 * @param path The path of a step part, such as `mode` or `keys[1].field`.
 */
export function errorsAt(
  errors: readonly RotationStepError[] | undefined,
  path: string,
): RotationStepError[] {
  return (errors ?? []).filter(
    ({ field }) =>
      field === path ||
      (field?.startsWith(`${path}.`) ?? false) ||
      (field?.startsWith(`${path}[`) ?? false),
  );
}

/**
 * Return the messages of the errors at a path, one per line, or undefined
 * when the path has no error.
 *
 * @param errors The validation errors of one step.
 * @param path The path of a step part, such as `mode` or `keys[1].field`.
 */
export function errorTextAt(
  errors: readonly RotationStepError[] | undefined,
  path: string,
): string | undefined {
  const found = errorsAt(errors, path);
  return found.length > 0 ? found.map((e) => e.message).join("\n") : undefined;
}
