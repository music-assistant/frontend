import {
  computed,
  inject,
  onBeforeUnmount,
  provide,
  ref,
  type ComputedRef,
  type InjectionKey,
  type Ref,
} from "vue";

interface ConfigFormValidation {
  // set once the form was checked, so every field shows whether it is valid
  checked: Ref<boolean>;
  register: (isInvalid: () => boolean) => () => void;
}

const CONFIG_FORM_VALIDATION: InjectionKey<ConfigFormValidation> = Symbol(
  "config-form-validation",
);

/**
 * Lets a config form check the fields it renders. Only the fields on screen take
 * part: an entry that is hidden, for example behind the advanced toggle, does not
 * block a save.
 */
export function provideConfigFormValidation() {
  const checked = ref(false);
  const checks = new Set<() => boolean>();

  provide(CONFIG_FORM_VALIDATION, {
    checked,
    register: (isInvalid) => {
      checks.add(isInvalid);
      return () => checks.delete(isInvalid);
    },
  });

  /** Shows the errors of every field and tells whether all of them are valid. */
  const validate = (): boolean => {
    checked.value = true;
    return [...checks].every((isInvalid) => !isInvalid());
  };

  return { validate };
}

interface ConfigFieldValidation {
  // the reason the field is invalid, once it is time to show it
  error: ComputedRef<string | undefined>;
  // marks the field as visited, so it shows its error from then on
  touch: () => void;
}

/**
 * The validation of one field. The error shows once the user changed or left
 * the field, or the form it is on was checked. Outside a config form the field
 * only shows its own error.
 *
 * @param isInvalid Whether the field holds an invalid value now.
 * @param message The error text to show.
 */
export function useConfigFieldValidation(
  isInvalid: () => boolean,
  message: () => string,
): ConfigFieldValidation {
  const form = inject(CONFIG_FORM_VALIDATION, undefined);
  const touched = ref(false);

  if (form) onBeforeUnmount(form.register(isInvalid));

  const error = computed(() =>
    (touched.value || form?.checked.value) && isInvalid()
      ? message()
      : undefined,
  );

  return {
    error,
    touch: () => {
      touched.value = true;
    },
  };
}
