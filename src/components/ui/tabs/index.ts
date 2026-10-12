import type { VariantProps } from "class-variance-authority";
import { cva } from "class-variance-authority";

export { default as Tabs } from "./Tabs.vue";
export { default as TabsContent } from "./TabsContent.vue";
export { default as TabsList } from "./TabsList.vue";
export { default as TabsTrigger } from "./TabsTrigger.vue";

// The `line` variant is the underlined page-level tab row (the library listings
// use it); the list sets it and TabsTrigger picks it up through the group.
export const tabsListVariants = cva(
  "group/tabs-list text-muted-foreground inline-flex w-fit items-center justify-center",
  {
    variants: {
      variant: {
        default: "bg-muted h-9 rounded-lg p-[3px]",
        line: "gap-6 bg-transparent",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);
export type TabsListVariants = VariantProps<typeof tabsListVariants>;
