import CatalogStageTag from "@/components/settings/catalog/CatalogStageTag.vue";
import { ProviderStage } from "@/plugins/api/interfaces";
import { enableAutoUnmount, mount } from "@vue/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/plugins/i18n", () => ({
  $t: (key: string) => key,
}));

enableAutoUnmount(afterEach);

describe("CatalogStageTag", () => {
  it.each([
    [ProviderStage.ALPHA, "bg-amber-500"],
    [ProviderStage.EXPERIMENTAL, "bg-amber-500"],
    [ProviderStage.BETA, "bg-primary"],
    [ProviderStage.UNMAINTAINED, "bg-orange-600"],
    [ProviderStage.DEPRECATED, "bg-destructive"],
  ])("names the %s stage after a dot of its colour", (stage, dotClass) => {
    const tag = mount(CatalogStageTag, { props: { stage } }).get(
      "[data-testid='catalog-stage-tag']",
    );

    expect(tag.text()).toBe(`settings.stage.options.${stage}`);
    expect(tag.get("[aria-hidden='true']").classes()).toContain(dotClass);
  });

  it.each([ProviderStage.STABLE, "unknown", null, undefined])(
    "shows nothing for the %s stage",
    (stage) => {
      expect(mount(CatalogStageTag, { props: { stage } }).html()).toBe(
        "<!--v-if-->",
      );
    },
  );
});
