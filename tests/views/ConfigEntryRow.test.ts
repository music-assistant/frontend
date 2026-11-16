import { enableAutoUnmount, flushPromises, mount } from "@vue/test-utils";
import { nextTick } from "vue";
import { afterEach, describe, expect, it, vi } from "vitest";
import MarkdownText from "@/components/MarkdownText.vue";
import { ConfigEntryType } from "@/plugins/api/interfaces";
import type { ConfigEntryUI } from "@/helpers/config_entry_ui";
import ConfigEntryRow from "@/views/settings/ConfigEntryRow.vue";

vi.mock("@/plugins/i18n", () => ({
  $t: (key: string) => key,
}));

enableAutoUnmount(afterEach);

const DOCS = "https://music-assistant.io/docs/server_name";

// the field itself is exercised by ConfigEntryField.test.ts; here only the help
// control matters, so render the popover slots inline and keep Button real, so
// the docs-link branch renders an actual anchor
const STUBS = {
  ConfigEntryField: { template: "<div />" },
  Popover: { template: "<div data-testid='help-popover'><slot /></div>" },
  PopoverTrigger: { template: "<div><slot /></div>" },
  PopoverContent: { template: "<div><slot /></div>" },
};

describe("ConfigEntryRow help", () => {
  it("shows a description in a popover, with no docs link when there is none", () => {
    const wrapper = mountRow(
      entry({ description: "What the server is called." }),
    );

    expect(wrapper.find("[data-testid='help-popover']").exists()).toBe(true);
    // a button, not a submit, so it can never submit the form the row sits in
    expect(helpControl(wrapper).attributes("type")).toBe("button");
    expect(wrapper.findComponent(MarkdownText).props("text")).toBe(
      "What the server is called.",
    );
    expect(wrapper.find(`a[href='${DOCS}']`).exists()).toBe(false);
  });

  it("adds a read more link inside the popover when a docs link is also set", () => {
    const wrapper = mountRow(
      entry({ description: "What the server is called.", help_link: DOCS }),
    );

    const readMore = wrapper.get(`a[href='${DOCS}']`);
    expect(readMore.attributes("target")).toBe("_blank");
    expect(readMore.attributes("rel")).toBe("noopener noreferrer");
    expect(helpControl(wrapper).element.tagName).toBe("BUTTON");
  });

  it("opens the docs directly for an entry with only a docs link", () => {
    const wrapper = mountRow(entry({ help_link: DOCS }));

    expect(wrapper.find("[data-testid='help-popover']").exists()).toBe(false);
    const control = helpControl(wrapper);
    expect(control.element.tagName).toBe("A");
    expect(control.attributes("href")).toBe(DOCS);
    expect(control.attributes("target")).toBe("_blank");
  });

  it("shows no help control when the entry has neither", () => {
    const wrapper = mountRow(entry({}));

    expect(wrapper.find("[aria-label='tooltip.help']").exists()).toBe(false);
    expect(wrapper.find("[data-testid='help-popover']").exists()).toBe(false);
  });

  it("drops an unsafe docs link but keeps the description popover", () => {
    const wrapper = mountRow(
      entry({
        description: "What the server is called.",
        help_link: "javascript:alert(1)",
      }),
    );

    expect(wrapper.find("[data-testid='help-popover']").exists()).toBe(true);
    expect(wrapper.findComponent(MarkdownText).props("text")).toBe(
      "What the server is called.",
    );
    // a rejected scheme never becomes a clickable link
    expect(wrapper.find("a").exists()).toBe(false);
  });

  it("shows no help control when the only docs link is unsafe", () => {
    const wrapper = mountRow(entry({ help_link: "javascript:alert(1)" }));

    expect(wrapper.find("[aria-label='tooltip.help']").exists()).toBe(false);
  });

  // the popover is real here (not stubbed), so clicking the ? proves it opens
  // and portals its content, which the structural tests above cannot show
  it("opens the popover on the real component when the ? is clicked", async () => {
    const wrapper = mount(ConfigEntryRow, {
      attachTo: document.body,
      props: {
        confEntry: entry({
          description: "What the server is called.",
          help_link: DOCS,
        }),
        showPasswordValues: false,
        disabled: false,
      },
      global: { stubs: { ConfigEntryField: { template: "<div />" } } },
    });

    await wrapper.get("[aria-label='tooltip.help']").trigger("click");
    await nextTick();
    await flushPromises();

    const content = document.body.querySelector(
      '[data-slot="popover-content"]',
    );
    expect(content?.textContent).toContain("What the server is called.");
    expect(
      content?.querySelector(`a[href='${DOCS}']`)?.getAttribute("target"),
    ).toBe("_blank");
  });
});

function entry(overrides: Partial<ConfigEntryUI>): ConfigEntryUI {
  return {
    key: "server_name",
    type: ConfigEntryType.STRING,
    category: "generic",
    default_value: null,
    label: "Server name",
    required: false,
    options: [],
    value: null,
    ...overrides,
  } as ConfigEntryUI;
}

function mountRow(confEntry: ConfigEntryUI) {
  return mount(ConfigEntryRow, {
    props: { confEntry, showPasswordValues: false, disabled: false },
    global: {
      stubs: STUBS,
    },
  });
}

function helpControl(wrapper: ReturnType<typeof mountRow>) {
  return wrapper.get("[aria-label='tooltip.help']");
}
