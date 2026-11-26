import ProviderList from "@/components/settings/providers/ProviderList.vue";
import { enableAutoUnmount, mount } from "@vue/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ref } from "vue";
import { providerConfig } from "../../fixtures/providerConfig";

vi.mock("@/plugins/api", () => ({
  api: { providers: {}, providerManifests: {} },
}));
vi.mock("@/plugins/i18n", () => ({ $t: (key: string) => key }));
vi.mock("vue-router", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/helpers/provider_permissions", () => ({
  canConfigureSourceAccess: () => false,
  canManageSource: () => false,
  canOwnSources: () => false,
  canReconfigureSource: () => false,
  managesAllSources: () => false,
  maySetUpSource: () => false,
}));
vi.mock("@/helpers/provider_settings_actions", () => ({
  getProviderSettingsMenuItems: () => [],
}));
vi.mock("@/composables/background-tasks/useBackgroundTasks", () => ({
  useBackgroundTasks: () => ({ isProviderSyncing: () => false }),
}));
vi.mock("@/composables/settings/providers/useProviderAccess", async () => {
  const { ref } = await vi.importActual<typeof import("vue")>("vue");
  return {
    useProviderAccess: () => ({
      users: ref([]),
      accessShareCandidates: ref([]),
      accessDialogConfig: ref(null),
      showAccessDialog: ref(false),
      accessSummary: () => "",
      openAccessDialog: vi.fn(),
    }),
  };
});
vi.mock("@/composables/settings/providers/useProviderSources", async () => {
  const { ref } = await vi.importActual<typeof import("vue")>("vue");
  return {
    useProviderSources: () => ({
      loaded: ref(true),
      list: ref({ filteredProviders: [] }),
      setSearchQuery: vi.fn(),
      setLabelFilter: vi.fn(),
      loadItems: vi.fn(),
      removeSource: vi.fn(),
    }),
  };
});

enableAutoUnmount(afterEach);

const LISTED = [
  providerConfig({ domain: "loudness", instance_id: "loudness--1" }),
  providerConfig({ domain: "smart_fades", instance_id: "smart_fades--1" }),
];

// the panel renders the row of each listed provider
const PanelStub = {
  props: ["list"],
  setup: () => ({ items: LISTED }),
  template: `<div>
    <template v-for="item in items" :key="item.instance_id">
      <slot name="row" :item="item" />
    </template>
  </div>`,
};

// a row showing the details it is handed
const RowStub = {
  name: "ProviderRow",
  props: ["config"],
  template: `<div data-testid="provider-row"><slot name="details" /></div>`,
};

describe("ProviderList", () => {
  it("hands each row the details the page gives for its provider", () => {
    const wrapper = mountList(
      `<ProviderList type="audio_analysis">
        <template #details="{ config }">
          <span data-testid="details">{{ config.instance_id }}</span>
        </template>
      </ProviderList>`,
    );

    expect(
      wrapper
        .findAll('[data-testid="provider-row"]')
        .map((row) => row.get('[data-testid="details"]').text()),
    ).toEqual(["loudness--1", "smart_fades--1"]);
  });

  it("hands the rows no details when the page gives none", () => {
    const wrapper = mountList(`<ProviderList type="audio_analysis" />`);

    const rows = wrapper.findAllComponents(RowStub);
    expect(rows).toHaveLength(LISTED.length);
    for (const row of rows) {
      expect(row.vm.$slots.details).toBeUndefined();
    }
  });
});

// the list on a page with the given template
function mountList(template: string) {
  return mount(
    { components: { ProviderList }, template },
    {
      global: {
        provide: {
          providersViewMode: {
            viewMode: ref<"list" | "card">("list"),
            toggleViewMode: vi.fn(),
          },
        },
        stubs: {
          ProviderAccessDialog: true,
          ProviderListPanel: PanelStub,
          ProviderRow: RowStub,
        },
      },
    },
  );
}
