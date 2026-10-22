import ToolbarHeading from "@/components/ToolbarHeading.vue";
import { mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMemoryHistory, createRouter } from "vue-router";
import { createVuetify } from "vuetify";
import * as components from "vuetify/components";
import * as directives from "vuetify/directives";

vi.mock("vue-i18n", () => ({ useI18n: () => ({ t: (key: string) => key }) }));

const screen = vi.hoisted(() => ({ isPhone: false }));
vi.mock("@/plugins/breakpoint", () => ({
  isPhoneSizedScreen: () => screen.isPhone,
}));

const vuetify = createVuetify({ components, directives });

const blank = { template: "<div />" };
const testRoutes = [
  { path: "/", name: "root", component: blank },
  { path: "/section", name: "section", component: blank },
  { path: "/section/child", name: "child", component: blank },
];

describe("ToolbarHeading", () => {
  beforeEach(() => {
    screen.isPhone = false;
  });

  it("links the heading back to the section root", async () => {
    const wrapper = await mountHeading({
      title: "Settings",
      to: { name: "section" },
      items: [{ title: "Players", disabled: true }],
    });

    expect(wrapper.get(".toolbar-heading-title").attributes("href")).toBe(
      "/section",
    );
  });

  it("renders the heading as plain text on the section root", async () => {
    const wrapper = await mountHeading({ title: "Settings" });

    const heading = wrapper.get(".toolbar-heading-title");
    expect(heading.element.tagName).toBe("SPAN");
    expect(heading.text()).toBe("Settings");
  });

  it("leaves out the trail when there is nothing below the section", async () => {
    const wrapper = await mountHeading({ title: "Settings" });

    expect(wrapper.find(".toolbar-heading-trail").exists()).toBe(false);
  });

  it("keeps ancestor crumbs clickable and marks the current page", async () => {
    const wrapper = await mountHeading({
      title: "Settings",
      to: { name: "section" },
      items: [
        { title: "Players", disabled: false, to: { name: "section" } },
        { title: "Kitchen", disabled: true, to: { name: "child" } },
      ],
    });

    const crumbs = wrapper.findAll(".v-breadcrumbs-item");
    expect(crumbs.map((crumb) => crumb.text())).toEqual(["Players", "Kitchen"]);
    expect(crumbs[0].get("a").attributes("href")).toBe("/section");
    expect(crumbs[0].classes()).not.toContain("v-breadcrumbs-item--disabled");
    expect(crumbs[1].classes()).toContain("v-breadcrumbs-item--disabled");
  });

  it("drops the middle of a long trail on a phone", async () => {
    screen.isPhone = true;
    const wrapper = await mountHeading({
      title: "Browse",
      to: { name: "section" },
      items: deepTrail(),
    });

    expect(crumbText(wrapper)).toEqual(["one", "\u2026", "five"]);
    const more = wrapper.get(".toolbar-heading-more");
    expect(more.attributes("aria-label")).toBe("tooltip.show_full_path");
    expect(more.attributes("type")).toBe("button");
  });

  it("reveals the whole trail once the ellipsis is tapped", async () => {
    screen.isPhone = true;
    const wrapper = await mountHeading({
      title: "Browse",
      to: { name: "section" },
      items: deepTrail(),
    });

    await wrapper.get(".toolbar-heading-more").trigger("click");

    expect(crumbText(wrapper)).toEqual(["one", "two", "three", "four", "five"]);
  });

  it("keeps the whole trail where there is room for it", async () => {
    const wrapper = await mountHeading({
      title: "Browse",
      to: { name: "section" },
      items: deepTrail(),
    });

    expect(wrapper.find(".toolbar-heading-more").exists()).toBe(false);
    expect(crumbText(wrapper)).toEqual(["one", "two", "three", "four", "five"]);
  });

  it("lets only the crumb you are on announce itself as the current page", async () => {
    // browse-style trail: every crumb shares one route and differs only by query
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: "/browse", name: "browse", component: blank }],
    });
    await router.push({ name: "browse", query: { path: "fs://Music" } });
    await router.isReady();

    const wrapper = mount(ToolbarHeading, {
      props: {
        title: "Browse",
        to: { name: "browse" },
        items: [
          {
            title: "fs",
            disabled: false,
            to: { name: "browse", query: { path: "fs://" } },
          },
          {
            title: "Music",
            disabled: true,
            to: { name: "browse", query: { path: "fs://Music" } },
          },
        ],
      },
      global: { plugins: [router, vuetify] },
    });

    const announced = wrapper
      .findAll(".v-breadcrumbs-item a")
      .filter((crumb) => crumb.attributes("aria-current") === "page");
    expect(announced.map((crumb) => crumb.text())).toEqual(["Music"]);
  });
});

function deepTrail() {
  const names = ["one", "two", "three", "four", "five"];
  return names.map((title, index) => ({
    title,
    disabled: index === names.length - 1,
    to: { name: "section" },
  }));
}

function crumbText(wrapper: ReturnType<typeof mount>) {
  return wrapper
    .findAll(".v-breadcrumbs-item, .toolbar-heading-more")
    .map((crumb) => crumb.text());
}

async function mountHeading(
  props: InstanceType<typeof ToolbarHeading>["$props"],
) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: testRoutes,
  });
  await router.push("/");
  await router.isReady();

  return mount(ToolbarHeading, {
    props,
    global: { plugins: [router, vuetify] },
  });
}
