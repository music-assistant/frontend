/* eslint-disable @typescript-eslint/no-var-requires */
import VueI18nPlugin from "@intlify/unplugin-vue-i18n/vite";
import tailwindcss from "@tailwindcss/vite";
import vue from "@vitejs/plugin-vue";
import { fileURLToPath, URL } from "node:url";
import path from "path";
import { defineConfig } from "vitest/config";
import { VitePWA } from "vite-plugin-pwa";
import vuetify, { transformAssetUrls } from "vite-plugin-vuetify";
import webfontDownload from "vite-plugin-webfont-dl";

// https://vitejs.dev/config/
export default defineConfig({
  base: "./",
  plugins: [
    vue({
      template: { transformAssetUrls },
    }),
    tailwindcss(),
    webfontDownload([
      "https://fonts.googleapis.com/css?family=Roboto:100,300,400,500,700,900&display=swap",
    ]),
    vuetify({
      autoImport: true,
      styles: {
        configFile: "src/styles/settings.scss",
      },
    }),
    VitePWA({
      strategies: "injectManifest",
      srcDir: "public",
      filename: "sw.js",
      injectManifest: {
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024, // 3 MiB
      },
      includeAssets: [
        "favicon.svg",
        "favicon.ico",
        "robots.txt",
        "apple-touch-icon.png",
      ],
      manifest: {
        name: "Music Assistant",
        short_name: "Music Assistant",
        description:
          "Music Assistant is a free, opensource Media library manager that connects to your streaming services and a wide range of connected speakers.",
        theme_color: "#424242",
        icons: [
          {
            src: "pwa-192x192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "pwa-512x512.png",
            sizes: "512x512",
            type: "image/png",
          },
          {
            src: "pwa-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any maskable",
          },
        ],
      },
    }),
    VueI18nPlugin({
      include: [path.resolve(__dirname, "./src/translations/**")],
    }),
  ],
  define: { "process.env": {} },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
    extensions: [".js", ".json", ".jsx", ".mjs", ".ts", ".tsx", ".vue"],
  },
  server: {
    port: 3000,
    host: true,
  },
  build: {
    outDir: "./music_assistant_frontend",
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules")) {
            if (id.includes("vuetify")) return "vuetify";
            if (id.includes("vue-i18n") || id.includes("@intlify"))
              return "vue-i18n";
            if (id.includes("vue-router")) return "vue-router";
            if (id.includes("@vueuse")) return "vueuse";
            if (id.includes("reka-ui")) return "reka-ui";
            if (id.includes("swiper")) return "swiper";
            if (id.includes("lucide")) return "lucide";
            if (id.includes("colorthief") || id.includes("color/"))
              return "color";
            if (id.includes("@mdi/js") || id.includes("material-design-icons"))
              return "mdi";
            if (id.includes("marked")) return "marked";
            if (id.includes("qrcode")) return "qrcode";
          }
        },
      },
    },
  },
  // https://vuetifyjs.com/en/getting-started/unit-testing/#using-vite
  test: {
    server: {
      deps: {
        inline: ["vuetify"],
      },
    },
  },
});
