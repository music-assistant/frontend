import ProviderRow from "@/components/settings/providers/ProviderRow.vue";
import { enableAutoUnmount, mount } from "@vue/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";
import { providerConfig } from "../../fixtures/providerConfig";

vi.mock("vue-i18n", async (importOriginal) => ({
  ...(await importOriginal<typeof import("vue-i18n")>()),
  useI18n: () => ({ t: (key: string) => key }),
}));

enableAutoUnmount(afterEach);

const VARIANTS = ["list", "card"] as const;

describe("ProviderRow", () => {
  it.each(VARIANTS)(
    "renders the name as an open button when manageable (%s)",
    (variant) => {
      const wrapper = mountRow({ variant, manageable: true, name: "Spotify" });

      const nameButton = wrapper.get('[data-testid="provider-open"]');
      expect(nameButton.element.tagName).toBe("BUTTON");
      expect(nameButton.text()).toBe("Spotify");
    },
  );

  it.each(VARIANTS)(
    "renders the name as plain text when not manageable (%s)",
    (variant) => {
      const wrapper = mountRow({ variant, manageable: false, name: "Spotify" });

      expect(wrapper.find('[data-testid="provider-open"]').exists()).toBe(
        false,
      );
      expect(wrapper.text()).toContain("Spotify");
    },
  );

  it.each(VARIANTS)(
    "emits open when the name button is clicked (%s)",
    async (variant) => {
      const wrapper = mountRow({ variant, manageable: true });

      await wrapper.get('[data-testid="provider-open"]').trigger("click");

      expect(wrapper.emitted("open")).toHaveLength(1);
    },
  );

  it.each(VARIANTS)(
    "emits open when the row is clicked and manageable (%s)",
    async (variant) => {
      const wrapper = mountRow({ variant, manageable: true });

      await wrapper.get('[data-testid="provider-row"]').trigger("click");

      expect(wrapper.emitted("open")).toHaveLength(1);
    },
  );

  it.each(VARIANTS)(
    "emits nothing when the row is clicked and not manageable (%s)",
    async (variant) => {
      const wrapper = mountRow({ variant, manageable: false });

      await wrapper.get('[data-testid="provider-row"]').trigger("click");

      expect(wrapper.emitted("open")).toBeUndefined();
    },
  );

  it.each(VARIANTS)(
    "shows the menu action and emits menu with the click event when manageable (%s)",
    async (variant) => {
      const wrapper = mountRow({ variant, manageable: true });

      await wrapper.get('[data-testid="provider-menu"]').trigger("click");

      const emitted = wrapper.emitted("menu");
      expect(emitted).toBeTruthy();
      expect(emitted?.[0]).toHaveLength(1);
      expect(emitted?.[0]?.[0]).toBeInstanceOf(Event);
    },
  );

  it.each(VARIANTS)(
    "hides the menu action when not manageable (%s)",
    (variant) => {
      const wrapper = mountRow({ variant, manageable: false });

      expect(wrapper.find('[data-testid="provider-menu"]').exists()).toBe(
        false,
      );
    },
  );

  it.each(VARIANTS)(
    "shows the access summary when provided (%s)",
    (variant) => {
      const wrapper = mountRow({
        variant,
        accessSummary: "Shared with everyone",
      });

      expect(wrapper.get('[data-testid="provider-access"]').text()).toBe(
        "Shared with everyone",
      );
    },
  );

  it.each(VARIANTS)(
    "hides the access summary when it is null or unset (%s)",
    (variant) => {
      expect(
        mountRow({ variant, accessSummary: null })
          .find('[data-testid="provider-access"]')
          .exists(),
      ).toBe(false);
      expect(
        mountRow({ variant, accessSummary: undefined })
          .find('[data-testid="provider-access"]')
          .exists(),
      ).toBe(false);
    },
  );

  it.each(VARIANTS)(
    "shows the status badge when a status variant is set (%s)",
    (variant) => {
      const wrapper = mountRow({
        variant,
        statusVariant: "destructive",
        statusLabel: "Needs attention",
      });

      expect(wrapper.get('[data-testid="provider-status"]').text()).toBe(
        "Needs attention",
      );
    },
  );

  it.each(VARIANTS)(
    "hides the status badge when no status variant is set (%s)",
    (variant) => {
      const wrapper = mountRow({ variant, statusVariant: undefined });

      expect(wrapper.find('[data-testid="provider-status"]').exists()).toBe(
        false,
      );
    },
  );

  it.each(VARIANTS)(
    "shows the stage badge when a stage label is set (%s)",
    (variant) => {
      const wrapper = mountRow({ variant, stageLabel: "Beta" });

      expect(wrapper.get('[data-testid="stage-badge"]').text()).toBe("Beta");
    },
  );

  it.each(VARIANTS)(
    "hides the stage badge when the stage label is empty (%s)",
    (variant) => {
      const wrapper = mountRow({ variant, stageLabel: "" });

      expect(wrapper.find('[data-testid="stage-badge"]').exists()).toBe(false);
    },
  );

  it.each(VARIANTS)(
    "shows the reconfigure action and emits reconfigure when in error and reconfigurable (%s)",
    async (variant) => {
      const wrapper = mountRow({
        variant,
        isError: true,
        reconfigurable: true,
      });

      await wrapper.get('[data-testid="provider-action"]').trigger("click");

      expect(wrapper.emitted("reconfigure")).toHaveLength(1);
    },
  );

  it.each(VARIANTS)(
    "hides the reconfigure action when the source is not in error (%s)",
    (variant) => {
      const wrapper = mountRow({
        variant,
        isError: false,
        reconfigurable: true,
      });

      expect(wrapper.find('[data-testid="provider-action"]').exists()).toBe(
        false,
      );
    },
  );

  it.each(VARIANTS)(
    "hides the reconfigure action when it is not reconfigurable (%s)",
    (variant) => {
      const wrapper = mountRow({
        variant,
        isError: true,
        reconfigurable: false,
      });

      expect(wrapper.find('[data-testid="provider-action"]').exists()).toBe(
        false,
      );
    },
  );

  it.each(VARIANTS)("shows the sync spinner while syncing (%s)", (variant) => {
    const wrapper = mountRow({ variant, syncing: true });

    expect(wrapper.find('[title="settings.sync_running"]').exists()).toBe(true);
  });

  it.each(VARIANTS)(
    "hides the sync spinner when not syncing (%s)",
    (variant) => {
      const wrapper = mountRow({ variant, syncing: false });

      expect(wrapper.find('[title="settings.sync_running"]').exists()).toBe(
        false,
      );
    },
  );

  it.each(VARIANTS)(
    "shows the error text instead of the description when in error (%s)",
    (variant) => {
      const wrapper = mountRow({
        variant,
        isError: true,
        errorText: "Needs re-authentication",
        description: "A great music service",
      });

      expect(wrapper.text()).toContain("Needs re-authentication");
      expect(wrapper.text()).not.toContain("A great music service");
    },
  );

  it.each(VARIANTS)(
    "shows the description when the source is healthy (%s)",
    (variant) => {
      const wrapper = mountRow({
        variant,
        isError: false,
        description: "A great music service",
      });

      expect(wrapper.text()).toContain("A great music service");
    },
  );

  it.each(VARIANTS)(
    "dims the row when the source is disabled (%s)",
    (variant) => {
      const wrapper = mountRow({
        variant,
        config: providerConfig({ enabled: false }),
      });

      expect(wrapper.get('[data-testid="provider-row"]').classes()).toContain(
        "opacity-60",
      );
    },
  );

  it.each(VARIANTS)(
    "does not dim the row when the source is enabled (%s)",
    (variant) => {
      const wrapper = mountRow({
        variant,
        config: providerConfig({ enabled: true }),
      });

      expect(
        wrapper.get('[data-testid="provider-row"]').classes(),
      ).not.toContain("opacity-60");
    },
  );

  it("renders an outline item as the list root", () => {
    const wrapper = mountRow({ variant: "list" });

    const root = wrapper.get('[data-testid="provider-row"]');
    expect(root.attributes("data-slot")).toBe("item");
    expect(root.classes()).toContain("border-border");
    // the row only follows the pointer, so it must not read as a control that
    // wraps the name button
    expect(root.attributes("role")).toBeUndefined();
  });

  it("renders a card as the card root", () => {
    const wrapper = mountRow({ variant: "card" });

    const root = wrapper.get('[data-testid="provider-row"]');
    expect(root.attributes("data-slot")).toBe("card");
    expect(root.classes()).toContain("provider-card");
    expect(root.attributes("role")).toBeUndefined();
  });

  it("adds interactive hover styling to the card root when manageable", () => {
    const wrapper = mountRow({ variant: "card", manageable: true });

    const root = wrapper.get('[data-testid="provider-row"]');
    expect(root.classes()).toContain("cursor-pointer");
    expect(root.classes()).toContain("hover:-translate-y-0.5");
  });

  it("leaves the card root static when not manageable", () => {
    const wrapper = mountRow({ variant: "card", manageable: false });

    const root = wrapper.get('[data-testid="provider-row"]');
    expect(root.classes()).not.toContain("cursor-pointer");
    expect(root.classes()).not.toContain("hover:-translate-y-0.5");
  });
});

function mountRow(
  overrides: Partial<InstanceType<typeof ProviderRow>["$props"]> = {},
) {
  return mount(ProviderRow, {
    props: {
      config: providerConfig(),
      variant: "list",
      manageable: true,
      reconfigurable: false,
      syncing: false,
      name: "Spotify",
      ...overrides,
    },
    global: { stubs: { ProviderIcon: true } },
  });
}
