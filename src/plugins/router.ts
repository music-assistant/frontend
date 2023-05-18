import { createRouter, createWebHashHistory } from 'vue-router';
import { store } from './store';

declare module 'vue-router' {
  interface RouteMeta {
    scrollPos?: number;
  }
}

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
        component: () => import(/* webpackChunkName: "home" */ '@/views/HomeView.vue'),
        props: true,
      },
      {
        path: '/search',
        name: 'search',
        component: () => import(/* webpackChunkName: "search" */ '@/views/Search.vue'),
        props: true,
      },
      {
        path: '/browse',
        name: 'browse',
        component: () => import(/* webpackChunkName: "browse" */ '@/views/BrowseView.vue'),
        props: (route: { query: { path: any } }) => ({ path: route.query.path }),
      },
      {
        path: '/artists',
        name: 'artists',
        component: () => import(/* webpackChunkName: "artists" */ '@/views/LibraryArtists.vue'),
        props: true,
      },
      {
        path: '/tracks',
        name: 'tracks',
        component: () => import(/* webpackChunkName: "tracks" */ '@/views/LibraryTracks.vue'),
        props: true,
      },
      {
        path: '/albums',
        name: 'albums',
        component: () => import(/* webpackChunkName: "albums" */ '@/views/LibraryAlbums.vue'),
        props: true,
      },
      {
        path: '/playlists',
        name: 'playlists',
        component: () => import(/* webpackChunkName: "playlists" */ '@/views/LibraryPlaylists.vue'),
        props: true,
      },
      {
        path: '/radios',
        name: 'radios',
        component: () => import(/* webpackChunkName: "radios" */ '@/views/LibraryRadios.vue'),
        props: true,
      },
      {
        path: '/artists/:provider/:itemId',
        name: 'artist',
        component: () => import(/* webpackChunkName: "artist" */ '@/views/ArtistDetails.vue'),
        props: true,
      },
      {
        path: '/albums/:provider/:itemId',
        name: 'album',
        component: () => import(/* webpackChunkName: "album" */ '@/views/AlbumDetails.vue'),
        props: true,
      },
      {
        path: '/tracks/:provider/:itemId',
        name: 'track',
        component: () => import(/* webpackChunkName: "track" */ '@/views/TrackDetails.vue'),
        props: (route: { params: any; query: any }) => ({ ...route.params, ...route.query }),
      },
      {
        path: '/radios/:provider/:itemId',
        name: 'radio',
        component: () => import(/* webpackChunkName: "radio" */ '@/views/RadioDetails.vue'),
        props: true,
      },
      {
        path: '/playlists/:provider/:itemId',
        name: 'playlist',
        component: () => import(/* webpackChunkName: "playlist" */ '@/views/PlaylistDetails.vue'),
        props: true,
      },
      {
        path: '/playerqueue',
        name: 'playerqueue',
        component: () => import(/* webpackChunkName: "playerqueue" */ '@/views/PlayerQueue.vue'),
        props: true,
      },
      {
        path: '/settings',
        name: 'settings',
        component: () => import(/* webpackChunkName: "settings" */ '@/views/settings/Settings.vue'),
        props: true,
        children: [
          {
            path: 'providers',
            name: 'providersettings',
            component: () => import(/* webpackChunkName: "providersettings" */ '@/views/settings/Providers.vue'),
            props: true,
          },
          {
            path: 'players',
            name: 'playersettings',
            component: () => import(/* webpackChunkName: "playersettings" */ '@/views/settings/Players.vue'),
            props: true,
          },
          {
            path: 'addprovider/:domain',
            name: 'addprovider',
            component: () => import(/* webpackChunkName: "addprovider" */ '@/views/settings/AddProvider.vue'),
            props: true,
          },
          {
            path: 'editprovider/:instanceId',
            name: 'editprovider',
            component: () => import(/* webpackChunkName: "editprovider" */ '@/views/settings/EditProvider.vue'),
            props: true,
          },
          {
            path: 'editplayer/:playerId',
            name: 'editplayer',
            component: () => import(/* webpackChunkName: "editplayer" */ '@/views/settings/EditPlayer.vue'),
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
  store.topBarTitle = undefined;
  store.topBarContextMenuItems = [];
  if (!from.name) return;
  if (to.params['backnav']) return;
  from.meta.scrollPos = window.scrollY;
  store.prevRoutes.push({
    name: from.name as string,
    path: from.path,
    query: from.query,
    params: from.params,
    meta: from.meta,
  });
});

export default router;
