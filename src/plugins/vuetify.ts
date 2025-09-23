/**
 * plugins/vuetify.ts
 *
 * Framework documentation: https://vuetifyjs.com`
 */

// Styles
import "@mdi/font/css/materialdesignicons.css";
import "material-design-icons-iconfont/dist/material-design-icons.css";
import "vuetify/styles";
import colors from "vuetify/lib/util/colors";
import { aliases as defaultAliases, mdi } from "vuetify/iconsets/mdi";
import { md } from "vuetify/iconsets/md";

// Composables
import { IconAliases, createVuetify } from "vuetify";

const aliases: IconAliases = {
  ...defaultAliases,
};

export default createVuetify(
  // https://vuetifyjs.com/en/introduction/why-vuetify/#feature-guides
  {
    icons: {
      defaultSet: "mdi",
      aliases,
      sets: {
        md,
        mdi,
      },
    },
    display: {
      mobileBreakpoint: "md",
      thresholds: {
        xs: 0,
        sm: 340,
        md: 540,
        lg: 800,
        xl: 1280,
      },
    },
    theme: {
      defaultTheme: "dark",
      themes: {
        light: {
          dark: false,
          colors: {
            fg: "#000000",
            background: "#f5f5f5",
            overlay: "#e7e7e7ff",
            panel: "#ffffff",
            default: "#ffffff",
            primary: "#03a9f4",
          },
        },
        dark: {
          dark: true,
          colors: {
            fg: "#ffffff",
            background: "#181818",
            overlay: "#181818",
            panel: "#232323",
            default: "#000000",
            primary: "#03a9f4",
          },
        },
      },
    },
  },
);
