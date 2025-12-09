export const mergeClasses = (
  ...classes: (string | false | undefined | null)[]
) => classes.filter(Boolean).join(" ");
