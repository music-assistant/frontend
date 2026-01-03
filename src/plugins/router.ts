import { createRouter, createWebHashHistory } from "vue-router";
import { store } from "./store";

const routes = [
  // Guest view uses minimal layout without navigation/player controls
  {
    path: "/guest",
    component: () => import("@/layouts/GuestLayout.vue"),
    children: [
      {
        path: "",
        name: "guest",
        component: () =>
          import(/* webpackChunkName: "guest" */ "@/views/GuestView.vue"),
        beforeEnter: async (to: any, _from: any, next: any) => {
          const token = to.query.token as string;
          if (token) {
            // Store the token using the correct storage key
            localStorage.setItem("ma_access_token", token);

            // Store the server address derived from the URL the guest accessed
            // This is needed for new users/devices that have never connected before
            const serverAddress =
              window.location.origin +
              window.location.pathname.replace(/\/$/, "");
            localStorage.setItem("mass_server_address", serverAddress);

            // Mark as guest mode
            localStorage.setItem("guest_mode", "true");

            // Small delay to ensure localStorage write completes
            await new Promise((resolve) => setTimeout(resolve, 50));

            // Navigate to guest without token in URL (removes ?ma_access_token=xxx)
            // This avoids full page reload and preserves app state
            next({ name: "guest", replace: true });
            return;
          }
          // Already authenticated as guest or no token, show guest view
          next();
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
        path: "/party",
        name: "party",
        component: () =>
          import(/* webpackChunkName: "party" */ "@/views/PartyView.vue"),
        props: (route: { query: Record<string, any> }) => ({ ...route.query }),
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

// Navigation guard for admin-only routes and guest mode restrictions
router.beforeEach((to, _from, next) => {
  // Check if user is in guest mode
  const isGuestMode = localStorage.getItem("guest_mode") === "true";

  // If in guest mode and trying to navigate away from /guest, redirect back to guest
  if (isGuestMode && to.path !== "/guest") {
    console.debug("Guest mode: preventing navigation to", to.path);
    next({ name: "guest" });
    return;
  }

  // Check admin-only routes - check all matched routes for requiresAdmin meta
  const requiresAdmin = to.matched.some((record) => record.meta.requiresAdmin);

  if (requiresAdmin) {
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
  console.debug("navigating from ", from.path, " to ", to.path);
  store.prevRoute = from.path;

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
