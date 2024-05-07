import { createRouter, createWebHashHistory } from 'vue-router';
import { store } from './store';
import { nextTick } from 'vue';
import { scrollElement, sleep } from '@/helpers/utils';

const mainListings = ['artists', 'albums', 'tracks', 'playlists', 'browse'];

const routes = [
  {
    path: '/',
    component: () => import('@/layouts/default/Default.vue'),
    children: [
      {
        path: '',
        redirect: '/home',
        name: 'homeredirect',
      },
      {
        path: '/home',
        name: 'home',
        component: () =>
          import(/* webpackChunkName: "home" */ '@/views/HomeView.vue'),
        props: true,
      },
      {
        path: '/search',
        name: 'search',
        component: () =>
          import(/* webpackChunkName: "search" */ '@/views/Search.vue'),
        props: true,
      },
      {
        path: '/browse',
        name: 'browse',
        component: () =>
          import(/* webpackChunkName: "browse" */ '@/views/BrowseView.vue'),
        props: (route: { query: Record<string, any> }) => ({ ...route.query }),
      },

      {
        path: '/artists',
        children: [
          {
            path: '',
            name: 'artists',
            component: () =>
              import(
                /* webpackChunkName: "artists" */ '@/views/LibraryArtists.vue'
              ),
            props: true,
          },
          {
            path: ':provider/:itemId',
            name: 'artist',
            component: () =>
              import(
                /* webpackChunkName: "artist" */ '@/views/ArtistDetails.vue'
              ),
            props: true,
          },
        ],
      },

      {
        path: '/albums',
        children: [
          {
            path: '',
            name: 'albums',
            component: () =>
              import(
                /* webpackChunkName: "albums" */ '@/views/LibraryAlbums.vue'
              ),
            props: true,
          },
          {
            path: ':provider/:itemId',
            name: 'album',
            component: () =>
              import(
                /* webpackChunkName: "album" */ '@/views/AlbumDetails.vue'
              ),
            props: true,
          },
        ],
      },

      {
        path: '/tracks',
        children: [
          {
            path: '',
            name: 'tracks',
            component: () =>
              import(
                /* webpackChunkName: "tracks" */ '@/views/LibraryTracks.vue'
              ),
            props: true,
          },
          {
            path: ':provider/:itemId',
            name: 'track',
            component: () =>
              import(
                /* webpackChunkName: "track" */ '@/views/TrackDetails.vue'
              ),
            props: (route: { params: any; query: any }) => ({
              ...route.params,
              ...route.query,
            }),
          },
        ],
      },

      {
        path: '/playlists',
        children: [
          {
            path: '',
            name: 'playlists',
            component: () =>
              import(
                /* webpackChunkName: "playlists" */ '@/views/LibraryPlaylists.vue'
              ),
            props: true,
          },
          {
            path: ':provider/:itemId',
            name: 'playlist',
            component: () =>
              import(
                /* webpackChunkName: "playlist" */ '@/views/PlaylistDetails.vue'
              ),
            props: true,
          },
        ],
      },

      {
        path: '/radios',
        children: [
          {
            path: '',
            name: 'radios',
            component: () =>
              import(
                /* webpackChunkName: "radios" */ '@/views/LibraryRadios.vue'
              ),
            props: true,
          },
          {
            path: ':provider/:itemId',
            name: 'radio',
            component: () =>
              import(
                /* webpackChunkName: "radio" */ '@/views/RadioDetails.vue'
              ),
            props: true,
          },
        ],
      },

      {
        path: '/playerqueue',
        name: 'playerqueue',
        component: () =>
          import(
            /* webpackChunkName: "playerqueue" */ '@/views/PlayerQueue.vue'
          ),
        props: true,
      },
      {
        path: '/settings',
        name: 'settings',
        component: () =>
          import(
            /* webpackChunkName: "settings" */ '@/views/settings/Settings.vue'
          ),
        props: true,
        children: [
          {
            path: 'providers',
            name: 'providersettings',
            component: () =>
              import(
                /* webpackChunkName: "providersettings" */ '@/views/settings/Providers.vue'
              ),
            props: true,
          },
          {
            path: 'players',
            name: 'playersettings',
            component: () =>
              import(
                /* webpackChunkName: "playersettings" */ '@/views/settings/Players.vue'
              ),
            props: true,
          },
          {
            path: 'core',
            name: 'coresettings',
            component: () =>
              import(
                /* webpackChunkName: "coresettings" */ '@/views/settings/CoreConfigs.vue'
              ),
            props: true,
          },
          {
            path: 'frontend',
            name: 'frontendsettings',
            component: () =>
              import(
                /* webpackChunkName: "frontendsettings" */ '@/views/settings/FrontendConfig.vue'
              ),
            props: true,
          },
          {
            path: 'client',
            name: 'clientsettings',
            component: () =>
              import(
                /* webpackChunkName: "clientsettings" */ '@/views/settings/ClientConfigs.vue'
              ),
            props: true,
          },
          {
            path: 'addprovider/:domain',
            name: 'addprovider',
            component: () =>
              import(
                /* webpackChunkName: "addprovider" */ '@/views/settings/AddProvider.vue'
              ),
            props: true,
          },
          {
            path: 'editprovider/:instanceId',
            name: 'editprovider',
            component: () =>
              import(
                /* webpackChunkName: "editprovider" */ '@/views/settings/EditProvider.vue'
              ),
            props: true,
          },
          {
            path: 'editplayer/:playerId',
            name: 'editplayer',
            component: () =>
              import(
                /* webpackChunkName: "editplayer" */ '@/views/settings/EditPlayer.vue'
              ),
            props: true,
          },
          {
            path: 'editcore/:domain',
            name: 'editcore',
            component: () =>
              import(
                /* webpackChunkName: "editcore" */ '@/views/settings/EditCoreConfig.vue'
              ),
            props: true,
          },
          {
            path: 'addgroup/:provider',
            name: 'addgroup',
            component: () =>
              import(
                /* webpackChunkName: "addgroup" */ '@/views/settings/AddGroupPlayer.vue'
              ),
            props: true,
          },
          {
            path: '',
            redirect: '/settings/providers', // default child path
            name: 'settingsredirect',
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

router.beforeEach((to, from) => {
  if (!from?.name) return;
  const el = document.querySelector('#cont');
  if (el) store.prevScrollPos[from.name.toString()] = el.scrollTop;
});

router.afterEach((to, from) => {
  if (!from?.name) return;
  if (!to?.name) return;
  if (!(to.name.toString() in store.prevScrollPos)) return;
  // for the main listings (e.g. artists, albums etc.) we remember the scroll position
  // so we can jump back there on back navigation
  if (!mainListings.includes(to.name.toString())) return;
  const prevPos = store.prevScrollPos[to.name.toString()];
  if (prevPos) {
    // scroll the main listing back to its previous scroll position
    nextTick(() => {
      const el = document.getElementById('cont');
      if (el) {
        scrollElement(el, prevPos, 0);
      }
    });
  }
});

export default router;
