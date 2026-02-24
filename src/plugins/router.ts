import { createRouter, createWebHashHistory } from "vue-router";
import { watch } from "vue";
import { notifyHARouteChange } from "./homeassistant";
import { store } from "./store";
import { api, ConnectionState } from "./api";

const routes = [
  // All routes go through default layout - authentication is handled by server redirect
  {
    path: "/",
    component: () => import("@/layouts/default/Default.vue"),
    children: [
      {
        path: "",
        redirect: "/home",
      },
      {
        path: "/home",
        name: "home",
        component: () =>
          import(/* webpackChunkName: "home" */ "@/views/HomeView.vue"),
      },
      {
        path: "/search",
        name: "search",
        component: () =>
          import(/* webpackChunkName: "search" */ "@/views/Search.vue"),
        props: true,
      },
      {
        path: "/browse",
        name: "browse",
        component: () =>
          import(/* webpackChunkName: "browse" */ "@/views/BrowseView.vue"),
        props: (route: { query: Record<string, any> }) => ({ ...route.query }),
      },
      {
        path: "/artists",
        children: [
          {
            path: "",
            name: "artists",
            component: () =>
              import(
                /* webpackChunkName: "artists" */ "@/views/LibraryArtists.vue"
              ),
            props: true,
          },
          {
            path: ":provider/:itemId",
            name: "artist",
            component: () =>
              import(
                /* webpackChunkName: "artist" */ "@/views/ArtistDetails.vue"
              ),
            props: true,
          },
        ],
      },
      {
        path: "/albums",
        children: [
          {
            path: "",
            name: "albums",
            component: () =>
              import(
                /* webpackChunkName: "albums" */ "@/views/LibraryAlbums.vue"
              ),
            props: true,
          },
          {
            path: ":provider/:itemId",
            name: "album",
            component: () =>
              import(
                /* webpackChunkName: "album" */ "@/views/AlbumDetails.vue"
              ),
            props: true,
          },
        ],
      },
      {
        path: "/tracks",
        children: [
          {
            path: "",
            name: "tracks",
            component: () =>
              import(
                /* webpackChunkName: "tracks" */ "@/views/LibraryTracks.vue"
              ),
            props: true,
          },
          {
            path: ":provider/:itemId",
            name: "track",
            component: () =>
              import(
                /* webpackChunkName: "track" */ "@/views/TrackDetails.vue"
              ),
            props: (route: { params: any; query: any }) => ({
              ...route.params,
              ...route.query,
            }),
          },
        ],
      },
      {
        path: "/playlists",
        children: [
          {
            path: "",
            name: "playlists",
            component: () =>
              import(
                /* webpackChunkName: "playlists" */ "@/views/LibraryPlaylists.vue"
              ),
            props: true,
          },
          {
            path: ":provider/:itemId",
            name: "playlist",
            component: () =>
              import(
                /* webpackChunkName: "playlist" */ "@/views/PlaylistDetails.vue"
              ),
            props: true,
          },
        ],
      },
      {
        path: "/podcasts",
        children: [
          {
            path: "",
            name: "podcasts",
            component: () =>
              import(
                /* webpackChunkName: "podcasts" */ "@/views/LibraryPodcasts.vue"
              ),
            props: true,
          },
          {
            path: ":provider/:itemId",
            name: "podcast",
            component: () =>
              import(
                /* webpackChunkName: "podcast" */ "@/views/PodcastDetails.vue"
              ),
            props: true,
          },
        ],
      },
      {
        path: "/audiobooks",
        children: [
          {
            path: "",
            name: "audiobooks",
            component: () =>
              import(
                /* webpackChunkName: "audiobooks" */ "@/views/LibraryAudiobooks.vue"
              ),
            props: true,
          },
          {
            path: ":provider/:itemId",
            name: "audiobook",
            component: () =>
              import(
                /* webpackChunkName: "audiobook" */ "@/views/AudiobookDetails.vue"
              ),
            props: true,
          },
        ],
      },
      {
        path: "/radios",
        children: [
          {
            path: "",
            name: "radios",
            component: () =>
              import(
                /* webpackChunkName: "radios" */ "@/views/LibraryRadios.vue"
              ),
            props: true,
          },
          {
            path: ":provider/:itemId",
            name: "radio",
            component: () =>
              import(
                /* webpackChunkName: "radio" */ "@/views/RadioDetails.vue"
              ),
            props: true,
          },
        ],
      },
      {
        path: "/genres",
        children: [
          {
            path: "",
            name: "genres",
            component: () =>
              import(
                /* webpackChunkName: "genres" */ "@/views/LibraryGenres.vue"
              ),
            props: true,
          },
          {
            path: ":provider/:itemId",
            name: "genre",
            component: () =>
              import(
                /* webpackChunkName: "genre" */ "@/views/GenreDetails.vue"
              ),
            props: true,
          },
        ],
      },
      {
        path: "/settings",
        name: "settings",
        component: () =>
          import(
            /* webpackChunkName: "settings" */ "@/views/settings/Settings.vue"
          ),
        props: true,
        children: [
          {
            path: "profile",
            name: "profile",
            component: () =>
              import(
                /* webpackChunkName: "profile" */ "@/views/UserProfile.vue"
              ),
            props: true,
          },
          {
            path: "providers",
            name: "providersettings",
            component: () =>
              import(
                /* webpackChunkName: "providersettings" */ "@/views/settings/Providers.vue"
              ),
            props: true,
            meta: { requiresAdmin: true },
          },
          {
            path: "players",
            name: "playersettings",
            component: () =>
              import(
                /* webpackChunkName: "playersettings" */ "@/views/settings/Players.vue"
              ),
            props: true,
            meta: { requiresAdmin: true },
          },
          {
            path: "system",
            name: "systemsettings",
            component: () =>
              import(
                /* webpackChunkName: "systemsettings" */ "@/views/settings/SystemConfig.vue"
              ),
            props: true,
            meta: { requiresAdmin: true },
          },
          {
            path: "remote-access",
            name: "remoteaccesssettings",
            component: () =>
              import(
                /* webpackChunkName: "remoteaccesssettings" */ "@/views/settings/RemoteAccessSettings.vue"
              ),
            props: true,
            meta: { requiresAdmin: true },
          },
          {
            path: "frontend",
            name: "frontendsettings",
            component: () =>
              import(
                /* webpackChunkName: "frontendsettings" */ "@/views/settings/FrontendConfig.vue"
              ),
            props: true,
          },
          {
            path: "users",
            name: "usersettings",
            component: () =>
              import(
                /* webpackChunkName: "usersettings" */ "@/views/settings/UserManagement.vue"
              ),
            props: true,
            meta: { requiresAdmin: true },
          },
          {
            path: "about",
            name: "aboutsettings",
            component: () =>
              import(
                /* webpackChunkName: "aboutsettings" */ "@/views/settings/About.vue"
              ),
            props: true,
          },
          {
            path: "serverlogs",
            name: "serverlogs",
            component: () =>
              import(
                /* webpackChunkName: "serverlogs" */ "@/views/settings/ServerLogs.vue"
              ),
            props: true,
            meta: { requiresAdmin: true },
          },
          {
            path: "genremanagement",
            name: "genremanagement",
            component: () =>
              import(
                /* webpackChunkName: "genremanagement" */ "@/views/settings/GenreManagement.vue"
              ),
            props: true,
            meta: { requiresAdmin: true },
          },
          {
            path: "addprovider/:domain",
            name: "addproviderdetails",
            component: () =>
              import(
                /* webpackChunkName: "addproviderdetails" */ "@/views/settings/AddProviderDetails.vue"
              ),
            props: true,
            meta: { requiresAdmin: true },
          },
          {
            path: "editprovider/:instanceId",
            name: "editprovider",
            component: () =>
              import(
                /* webpackChunkName: "editprovider" */ "@/views/settings/EditProvider.vue"
              ),
            props: true,
            meta: { requiresAdmin: true },
          },
          {
            path: "editplayer/:playerId",
            name: "editplayer",
            component: () =>
              import(
                /* webpackChunkName: "editplayer" */ "@/views/settings/EditPlayer.vue"
              ),
            props: true,
            meta: { requiresAdmin: true },
          },
          {
            path: "editplayer/:playerId/dsp",
            name: "editplayerdsp",
            component: () =>
              import(
                /* webpackChunkName: "editdsp" */ "@/views/settings/EditPlayerDsp.vue"
              ),
            props: true,
            meta: { requiresAdmin: true },
          },
          {
            path: "editcore/:domain",
            name: "editcore",
            component: () =>
              import(
                /* webpackChunkName: "editcore" */ "@/views/settings/EditCoreConfig.vue"
              ),
            props: true,
            meta: { requiresAdmin: true },
          },
          {
            path: "addgroup/:provider",
            name: "addgroup",
            component: () =>
              import(
                /* webpackChunkName: "addgroup" */ "@/views/settings/AddPlayerGroup.vue"
              ),
            props: true,
            meta: { requiresAdmin: true },
          },
        ],
      },
    ],
  },
];

const router = createRouter({
  history: createWebHashHistory(),
  routes,
});

// Handle chunk loading errors (e.g., after frontend update with stale cache)
// When a dynamic import fails with a 404, it means the chunk no longer exists
// on the server (likely due to a new deployment with different hashes).
// In this case, we reload the page to get the fresh assets.
router.onError((error, to) => {
  // Check if this is a chunk loading error
  const isChunkLoadError =
    error.message.includes("Failed to fetch dynamically imported module") ||
    error.message.includes("Loading chunk") ||
    error.message.includes("Loading CSS chunk") ||
    (error.name === "TypeError" && error.message.includes("fetch"));

  if (isChunkLoadError) {
    console.warn(
      "Chunk loading failed, likely due to app update. Reloading page...",
      error,
    );
    // Use location.href to do a full reload to the intended route
    // This ensures we get fresh HTML and assets from the server
    window.location.href =
      window.location.origin + window.location.pathname + "#" + to.fullPath;
  }
});

// Navigation guard for admin-only routes
router.beforeEach(async (to, _from, next) => {
  // Check admin-only routes - check all matched routes for requiresAdmin meta
  const requiresAdmin = to.matched.some((record) => record.meta.requiresAdmin);

  if (requiresAdmin) {
    // Wait for API to be initialized before checking admin access
    // This ensures store.currentUser is set before we check permissions
    if (api.state.value !== ConnectionState.INITIALIZED) {
      // Wait for initialization to complete
      await new Promise<void>((resolve) => {
        const unwatch = watch(
          () => api.state.value,
          (newState) => {
            if (newState === ConnectionState.INITIALIZED) {
              unwatch();
              resolve();
            }
          },
          { immediate: true },
        );
      });
    }

    const currentUser = store.currentUser;
    console.debug(
      "Admin route check:",
      to.path,
      "user:",
      currentUser?.username,
      "role:",
      currentUser?.role,
    );

    if (!currentUser || currentUser.role !== "admin") {
      console.warn("Admin access required for", to.path);
      next({ name: "home" });
      return;
    }
  }

  next();
});

router.afterEach((to, from) => {
  if (!from?.path) return;
  store.prevRoute = from.path;

  if (store.isIngressSession) {
    notifyHARouteChange(to.fullPath);
  }

  // Clean up onboard parameter from URL if present
  if (store.isOnboarding && to.path === "/settings/providers") {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has("onboard")) {
      urlParams.delete("onboard");
      const cleanUrl =
        window.location.pathname +
        (urlParams.toString() ? "?" + urlParams.toString() : "") +
        window.location.hash;
      window.history.replaceState({}, "", cleanUrl);
    }
  }

  // Reset onboarding flag when navigating away from the providers page
  if (
    store.isOnboarding &&
    from.path === "/settings/providers" &&
    to.path !== "/settings/providers"
  ) {
    store.isOnboarding = false;
  }
});

export default router;
