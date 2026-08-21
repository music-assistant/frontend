import { api } from "@/plugins/api";
import { ProviderIconVariant } from "@/plugins/api/interfaces";
import { computed, type MaybeRefOrGetter, toValue, watchEffect } from "vue";
import { useTheme } from "vuetify";

interface ProviderIconOptions {
  monochrome?: MaybeRefOrGetter<boolean | undefined>;
}

/**
 * Icon of a provider, resolved from its domain or instance id.
 *
 * `iconDataUri` is null while loading and for providers without a usable icon.
 * `applyInvert` signals that the image needs inverting to stay visible.
 */
export function useProviderIcon(
  domain: MaybeRefOrGetter<string | undefined>,
  options?: ProviderIconOptions,
) {
  const theme = useTheme();

  const providerDomain = computed(() => {
    const value = toValue(domain);
    if (!value) return undefined;
    // handle case where provider domain is provided as instance id.
    if (value in api.providers) return api.providers[value].domain;
    if (value in api.providerManifests) return value;
    return undefined;
  });

  const manifest = computed(() =>
    providerDomain.value
      ? api.providerManifests[providerDomain.value]
      : undefined,
  );

  const providerName = computed(() => manifest.value?.name ?? "");

  // pick the best available variant for the current theme + monochrome request
  const variant = computed<ProviderIconVariant | undefined>(() => {
    const available = manifest.value?.icon_images ?? [];
    if (
      toValue(options?.monochrome) &&
      available.includes(ProviderIconVariant.MONOCHROME)
    )
      return ProviderIconVariant.MONOCHROME;
    if (
      theme.current.value.dark &&
      available.includes(ProviderIconVariant.DARK)
    )
      return ProviderIconVariant.DARK;
    if (available.includes(ProviderIconVariant.DEFAULT))
      return ProviderIconVariant.DEFAULT;
    return undefined;
  });

  const applyInvert = computed(
    () =>
      variant.value === ProviderIconVariant.MONOCHROME &&
      !theme.current.value.dark,
  );

  const iconKey = computed(() =>
    providerDomain.value && variant.value
      ? `${providerDomain.value}:${variant.value}`
      : undefined,
  );

  // the request only fills the shared cache; reading the icon back out of it
  // keeps it tied to the provider on screen now, so a request that resolves
  // after the domain has moved on cannot leave the wrong icon behind
  watchEffect(() => {
    if (providerDomain.value && variant.value) {
      void api.getProviderIcon(providerDomain.value, variant.value);
    }
  });

  const iconDataUri = computed(() =>
    iconKey.value ? (api.providerIcons[iconKey.value] ?? null) : null,
  );

  return { iconDataUri, applyInvert, providerName };
}
