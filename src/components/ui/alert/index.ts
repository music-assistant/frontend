import type { VariantProps } from "class-variance-authority";
import { cva } from "class-variance-authority";

export { default as Alert } from "./Alert.vue";
export { default as AlertDescription } from "./AlertDescription.vue";
export { default as AlertTitle } from "./AlertTitle.vue";

export const alertVariants = cva(
  "relative w-full rounded-lg border px-4 py-3 text-sm grid has-[>svg]:grid-cols-[calc(var(--spacing)*4)_1fr] grid-cols-[0_1fr] has-[>svg]:gap-x-3 gap-y-0.5 items-start [&>svg]:size-4 [&>svg]:translate-y-0.5 [&>svg]:text-current",
  {
    variants: {
      variant: {
        default: "bg-card text-card-foreground",
        destructive:
          "text-destructive bg-card [&>svg]:text-current *:data-[slot=alert-description]:text-destructive/90",
        warning:
          "border-yellow-500/50 text-yellow-600 bg-yellow-500/10 dark:text-yellow-500 [&>svg]:text-current *:data-[slot=alert-description]:text-yellow-600/90 dark:*:data-[slot=alert-description]:text-yellow-500/90",
        info: "border-blue-500/50 text-blue-600 bg-blue-500/10 dark:text-blue-500 [&>svg]:text-current *:data-[slot=alert-description]:text-blue-600/90 dark:*:data-[slot=alert-description]:text-blue-500/90",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export type AlertVariants = VariantProps<typeof alertVariants>;
