import CustomizeHost from "@/components/ai-radio/CustomizeHost.vue";
import { flushPromises, mount, type VueWrapper } from "@vue/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";

const { sendCommand } = vi.hoisted(() => ({
  sendCommand: vi.fn(async () => []),
}));

vi.mock("@/plugins/api", () => ({
  default: {
    // useHosts derives ai_radio availability from the provider list.
    providers: {},
    sendCommand,
  },
}));

vi.mock("vue-router", async (importOriginal) => ({
  ...(await importOriginal<typeof import("vue-router")>()),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  onBeforeRouteLeave: vi.fn(),
}));

vi.mock("@/plugins/eventbus", () => ({
  eventbus: { emit: vi.fn() },
}));

vi.mock("vue-sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

/** Mounts the editor in create mode (a new host seeded from the first preset). */
async function mountEditor() {
  const wrapper = mount(CustomizeHost);
  await flushPromises();
  return wrapper;
}

async function save(wrapper: VueWrapper) {
  const button = wrapper
    .findAll("button")
    .find((candidate) => candidate.text() === "Save host");
  await button?.trigger("click");
  await flushPromises();
}

const aiRadioCommands = () =>
  sendCommand.mock.calls
    .map((call) => call[0] as unknown as string)
    .filter((command) => command.startsWith("ai_radio/"));

afterEach(() => {
  vi.clearAllMocks();
});

describe("CustomizeHost save", () => {
  it("writes every section before the host that references them", async () => {
    const wrapper = await mountEditor();
    await wrapper.find("#customize-host-name").setValue("Morning Crew");

    await save(wrapper);

    const commands = aiRadioCommands();
    const lastSectionSave = commands.lastIndexOf("ai_radio/sections/save");
    expect(lastSectionSave).toBeGreaterThan(-1);
    expect(commands.indexOf("ai_radio/hosts/save")).toBeGreaterThan(
      lastSectionSave,
    );
  });

  it("writes nothing when the draft fails validation", async () => {
    const { toast } = await import("vue-sonner");
    // The name is empty on a fresh draft, and sections are written before the
    // host, so a save that can't succeed must not reach the server at all.
    const wrapper = await mountEditor();

    await save(wrapper);

    expect(aiRadioCommands()).not.toContain("ai_radio/sections/save");
    expect(aiRadioCommands()).not.toContain("ai_radio/hosts/save");
    expect(toast.error).toHaveBeenCalledWith("Host name is required");
  });
});
