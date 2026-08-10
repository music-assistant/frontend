import CustomizeHost from "@/components/ai-radio/CustomizeHost.vue";
import { useHosts } from "@/composables/ai-radio/useHosts";
import type { AIRadioHost } from "@/plugins/api/interfaces";
import { flushPromises, mount, type VueWrapper } from "@vue/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";

type SendCommand = (
  command: string,
  args?: Record<string, unknown>,
) => Promise<unknown>;

const { sendCommand } = vi.hoisted(() => ({
  sendCommand: vi.fn<SendCommand>(async () => []),
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

/** Mounts the editor in create mode (a new host seeded with one generic example segment per placement). */
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
    .map(([command]) => command)
    .filter((command) => command.startsWith("ai_radio/"));

const savedHost = (): AIRadioHost => {
  const call = sendCommand.mock.calls.find(
    ([command]) => command === "ai_radio/hosts/save",
  );
  const args = call?.[1] as { host: AIRadioHost } | undefined;
  if (!args) throw new Error("no host was saved");
  return args.host;
};

afterEach(() => {
  vi.clearAllMocks();
  sendCommand.mockImplementation(async () => []);
  useHosts().hosts.value = [];
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

  it("refuses to create a host that would overwrite one with the same name", async () => {
    const { toast } = await import("vue-sonner");
    const existing: AIRadioHost = {
      id: "morning_crew",
      name: "Morning Crew",
      instructions: "",
      tts_engine: "",
      section_ids: [],
      section_order: [],
      merge_section_id: "",
    };
    sendCommand.mockImplementation(async (command) =>
      command === "ai_radio/hosts/list" ? [existing] : [],
    );
    const wrapper = await mountEditor();
    await wrapper.find("#customize-host-name").setValue("Morning Crew");

    await save(wrapper);

    expect(aiRadioCommands()).not.toContain("ai_radio/hosts/save");
    expect(toast.error).toHaveBeenCalledWith(
      "A host named «Morning Crew» already exists",
    );
  });
});
