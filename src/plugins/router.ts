import { watch } from "vue";
import {
  createRouter,
  createWebHashHistory,
  type RouteLocationNormalized,
  type RouteRecordRaw,
} from "vue-router";
import { api, ConnectionState } from "./api";
import { authManager } from "./auth";
import { notifyHARouteChange } from "./homeassistant";
import { store } from "./store";

const routes: RouteRecordRaw[] = [
  // Guest view uses minimal layout without navigation/player controls
  // Guest authentication is handled by Login.vue via the ?join= query parameter
  // which exchanges the short join code for a JWT before navigating here
  {
    path: "/guest",
    // Guest users don't have access to the player.
    meta: { disableWebPlayer: true },
    component: () => import("@/layouts/PartyGuestLayout.vue"),
    children: [
      {
        path: "",
        name: "guest",
        component: () =>
          import(/* webpackChunkName: "guest" */ "@/views/PartyGuestView.vue"),
      },
    ],
  },
  // Party display uses minimal layout (fullscreen for wall-mounted tablets)
  // Placed at top level so it renders without navigation/player controls
  {
    path: "/party",
    // Party only displays the dashboard and doesn't need the player.
    meta: { disableWebPlayer: true },
    component: () => import("@/layouts/PartyGuestLayout.vue"),
    children: [
      {
        path: "",
        name: "party",
        component: () =>
          import(
            /* webpackChunkName: "party" */ "@/views/PartyDashboardView.vue"
          ),
        props: (route: { query: Record<string, string> }) => ({
          ...route.query,
        }),
        beforeEnter: async (
          _to: RouteLocationNormalized,
          _from: RouteLocationNormalized,
        ) => {
          // Wait for API initialization before checking plugin status
          if (api.state.value !== ConnectionState.INITIALIZED) {
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
          // Only allow access if party plugin is enabled
          if (!store.enabledPlugins.has("party")) {
            return { name: "discover" };
          }
        },
      },
    ],
  },
  // All other routes go through default layout with navigation/player controls
  {
    path: "/",
    component: () => import("@/layouts/default/Default.vue"),
    children: [
      {
        path: "",
        redirect: "/discover",
      },
      {
        // "/home" has now been renamed to "/discover". This
        // redirect is to help avoid blank page loads for anyone who
        // has bookmarked the old /home url.
        path: "/home",
        redirect: "/discover",
      },
      {
        path: "/discover",
        name: "discover",
        component: () =>
          import(/* webpackChunkName: "discover" */ "@/views/HomeView.vue"),
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
        props: (route: {
          query: Record<string, string | (string | null)[] | null | undefined>;
        }) => ({ ...route.query }),
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
            props: (route: {
              params: Record<string, string | string[]>;
              query: Record<
                string,
                string | (string | null)[] | null | undefined
              >;
            }) => ({
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
            path: "tasks",
            name: "backgroundtasks",
            component: () =>
              import(
                /* webpackChunkName: "backgroundtasks" */ "@/views/settings/BackgroundTasks.vue"
              ),
            props: true,
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
            path: "editplayer/:playerId/options",
            name: "editplayeroptions",
            component: () =>
              import(
                /* webpackChunkName: "editplayer" */ "@/views/settings/EditPlayerOptions.vue"
              ),
            props: true,
            meta: { requiresAdmin: false },
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
      {
        path: ":pathMatch(.*)*",
        name: "not-found",
        component: () =>
          import(/* webpackChunkName: "not-found" */ "@/views/NotFound.vue"),
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
    const reloadKey = "chunkReloadAttempted";
    if (sessionStorage.getItem(reloadKey)) {
      // Already tried reloading once this session — avoid an infinite loop.
      // Clear the flag so a future manual navigation can try again.
      sessionStorage.removeItem(reloadKey);
      console.error(
        "Chunk loading failed again after reload. Server may be unavailable.",
        error,
      );
      return;
    }
    sessionStorage.setItem(reloadKey, "1");
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

// Navigation guard for admin-only routes and guest mode restrictions
router.beforeEach(async (to, _from, next) => {
  const currentUser = store.currentUser;

  // If party guest is trying to navigate away from /guest, redirect back to guest
  // We check JWT claims (via authManager) rather than role so regular guest users aren't affected
  if (authManager.isPartyGuest() && to.path !== "/guest") {
    console.debug("Party guest: preventing navigation to", to.path);
    next({ name: "guest" });
    return;
  }

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
      next({ name: "discover" });
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
  if (store.isOnboarding && to.path === "/settings") {
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

  // Reset onboarding flag when navigating away from settings
  if (
    store.isOnboarding &&
    from.path === "/settings" &&
    to.path !== "/settings"
  ) {
    store.isOnboarding = false;
  }
});

export default router;
