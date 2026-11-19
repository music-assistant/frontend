/**
 * The name of a core module: its translated name, else the name in its
 * manifest, else its domain.
 *
 * @param domain - The domain of the core module.
 * @param translate - Gives the text of a translation key, or the key itself
 * when there is no text for it.
 * @param manifestName - The name the manifest of the module gives.
 */
export function coreModuleName(
  domain: string,
  translate: (key: string) => string,
  manifestName?: string,
): string {
  const key = `settings.core_module.${domain}.name`;
  const translated = translate(key);
  if (translated !== key) return translated;
  return manifestName || domain;
}
