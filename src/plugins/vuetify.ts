/**
 * plugins/vuetify.ts
 *
 * Framework documentation: https://vuetifyjs.com`
 */

// Styles
import "@mdi/font/css/materialdesignicons.css";
import "vuetify/styles";
import colors from 'vuetify/lib/util/colors';

// Composables
import { createVuetify } from "vuetify";
export default createVuetify(
  // https://vuetifyjs.com/en/introduction/why-vuetify/#feature-guides
  {
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
      defaultTheme: "light",
      themes: {
        light: {
          dark: false,
          colors: {
            primary: colors.blue.base,
            accent: colors.blue.darken2,
          },
        },
        dark: {
          dark: true,
          colors: {
            primary: colors.blue.darken4,
            accent: colors.blue.lighten2,
          },
        },
      },
    },
  }
);
