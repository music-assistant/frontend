import ToolbarHeading from "@/components/ToolbarHeading.vue";
import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import { createMemoryHistory, createRouter } from "vue-router";
import { createVuetify } from "vuetify";
import * as components from "vuetify/components";
import * as directives from "vuetify/directives";

const vuetify = createVuetify({ components, directives });

const blank = { template: "<div />" };
const testRoutes = [
  { path: "/", name: "root", component: blank },
  { path: "/section", name: "section", component: blank },
  { path: "/section/child", name: "child", component: blank },
];

describe("ToolbarHeading", () => {
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
    expect(crumbs[0].classes()).not.toContain("v-breadcrumbs-item--disabled");
    expect(crumbs[1].classes()).toContain("v-breadcrumbs-item--disabled");
  });
});

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
