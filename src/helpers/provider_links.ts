import type { ProviderMapping } from "@/plugins/api/interfaces";

export interface ProviderLink {
  url: string;
  provider: string;
}

/** Public website links supplied by the server, deduplicated across accounts. */
export function providerLinks(mappings: ProviderMapping[]): ProviderLink[] {
  const links = new Map<string, ProviderLink>();
  for (const mapping of mappings) {
    if (!mapping.url || mapping.provider_domain.startsWith("file")) continue;
    let url: URL;
    try {
      url = new URL(mapping.url);
    } catch {
      continue;
    }
    if (!["https:", "http:"].includes(url.protocol)) continue;
    if (url.searchParams.get("list") === "None") continue;
    links.set(mapping.url, {
      url: mapping.url,
      provider: mapping.provider_domain,
    });
  }
  return [...links.values()];
}
