export const ROTATION_PROVIDER_DOMAIN = "rotation_playlist";

export const CHIP_CLASS =
  "h-7 max-w-full rounded-full border border-transparent bg-primary/15 px-2.5 text-sm text-foreground shadow-none hover:bg-primary/25 dark:bg-primary/15 dark:hover:bg-primary/25 [&_svg]:text-foreground! dark:text-primary dark:[&_svg]:text-primary!";

// red text on a red tint stays below 4.5:1 in both themes, so the text keeps
// the foreground color and the border, tint and chevron carry the red
export const CHIP_INVALID_CLASS =
  "border-destructive bg-destructive/10 text-foreground hover:bg-destructive/20 dark:bg-destructive/20 dark:hover:bg-destructive/30 dark:text-foreground [&_svg]:text-destructive! dark:[&_svg]:text-destructive!";

/** The values of the audio_quality field, from lowest to highest. */
export const AUDIO_QUALITIES = ["lossy", "lossless", "hi_res"];
