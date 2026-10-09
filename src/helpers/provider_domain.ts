/** The domain of the Local files provider, which reads a folder on the server. */
export const LOCAL_FILES_DOMAIN = "filesystem_local";

/**
 * Providers the server has folded into another provider. An instance keeps its id when
 * its provider is converted, because the library refers to it by that id, so the id
 * still starts with the old domain while the instance now belongs to the new one. The
 * table can go once the server no longer carries the conversion (it marks it "remove
 * after 2.13 release").
 */
const MERGED_PROVIDER_DOMAINS: Readonly<Record<string, string>> = {
  filesystem_smb: LOCAL_FILES_DOMAIN,
  filesystem_nfs: LOCAL_FILES_DOMAIN,
};

/** What the app knows of the providers: the loaded instances and the manifests. */
export interface KnownProviders {
  providers: Readonly<Record<string, { domain: string }>>;
  providerManifests: Readonly<Record<string, unknown>>;
}

/**
 * The domain an instance id names, which is the part before `--`, or the domain itself.
 * An id of a provider the server has folded into another names the new provider.
 *
 * @param idOrDomain - A provider instance id, e.g. `spotify--abc`, or a domain.
 */
export function embeddedProviderDomain(idOrDomain: string): string {
  const embedded = idOrDomain.split("--")[0];
  return MERGED_PROVIDER_DOMAINS[embedded] ?? embedded;
}

/**
 * Every domain an instance id names: the part before `--`, or the domain itself, and for
 * a provider the server has folded into another also the provider it went into.
 *
 * @param idOrDomain - A provider instance id, e.g. `filesystem_smb--abc`, or a domain.
 */
export function embeddedProviderDomains(idOrDomain: string): string[] {
  const embedded = idOrDomain.split("--")[0];
  const merged = MERGED_PROVIDER_DOMAINS[embedded];
  return merged ? [embedded, merged] : [embedded];
}

/**
 * The domain of the provider an instance id or domain belongs to, undefined when the
 * app can not know it.
 *
 * A loaded instance and a known manifest come first; an instance that is not loaded
 * (not shared with the user, or a source whose storage is not connected) is known by
 * the domain its id names, when that provider has a manifest.
 *
 * @param idOrDomain - A provider instance id or domain, e.g. of a media item.
 * @param known - The loaded instances and the manifests the app has.
 */
export function resolveProviderDomain(
  idOrDomain: string,
  known: KnownProviders,
): string | undefined {
  const instance = known.providers[idOrDomain];
  if (instance) return instance.domain;
  if (idOrDomain in known.providerManifests) return idOrDomain;
  const domain = embeddedProviderDomain(idOrDomain);
  return domain in known.providerManifests ? domain : undefined;
}
