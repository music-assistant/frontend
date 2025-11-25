/* eslint-disable @typescript-eslint/no-var-requires */
import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import vuetify, { transformAssetUrls } from "vite-plugin-vuetify";
import { VitePWA } from "vite-plugin-pwa";
import { fileURLToPath, URL } from "node:url";
import webfontDownload from "vite-plugin-webfont-dl";
import VueI18nPlugin from "@intlify/unplugin-vue-i18n/vite";
import svgLoader from "vite-svg-loader";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig({
  base: "./",
  plugins: [
    vue({
      template: { transformAssetUrls },
    }),
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
      includeAssets: [
        "favicon.svg",
        "favicon.ico",
        "robots.txt",
        "apple-touch-icon.png",
      ],
      workbox: {
        // Cache album art and images from imageproxy
        runtimeCaching: [
          {
            // Cache imageproxy responses (album art, thumbnails)
            urlPattern: /\/imageproxy\?/,
            handler: "CacheFirst",
            options: {
              cacheName: "album-art-cache",
              expiration: {
                maxEntries: 1000, // Cache up to 1000 images
                maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            // Cache external images (Apple Music, etc.)
            urlPattern: /^https:\/\/is\d+-ssl\.mzstatic\.com\//,
            handler: "CacheFirst",
            options: {
              cacheName: "apple-music-images",
              expiration: {
                maxEntries: 500,
                maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            // Cache avatar images (fallback placeholders)
            urlPattern: /^https:\/\/ui-avatars\.com\//,
            handler: "CacheFirst",
            options: {
              cacheName: "avatar-cache",
              expiration: {
                maxEntries: 200,
                maxAgeSeconds: 60 * 60 * 24 * 7, // 7 days
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
        ],
      },
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
    target: ["safari15", "es2020"],
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ["vue", "vue-router"],
          vuetify: ["vuetify"],
          api: ["websocket-ts"],
          utils: ["color", "colorthief"],
        },
      },
    },
  },
});
