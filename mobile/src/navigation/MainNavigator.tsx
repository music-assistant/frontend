import React from 'react';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {Text} from 'react-native';
import {HomeScreen} from '../screens/HomeScreen';
import {SearchScreen} from '../screens/SearchScreen';
import {BrowseScreen} from '../screens/BrowseScreen';
import {LibraryScreen} from '../screens/LibraryScreen';
import {SettingsScreen} from '../screens/SettingsScreen';
import {ArtistsScreen} from '../screens/library/ArtistsScreen';
import {AlbumsScreen} from '../screens/library/AlbumsScreen';
import {TracksScreen} from '../screens/library/TracksScreen';
import {PlaylistsScreen} from '../screens/library/PlaylistsScreen';
import {PodcastsScreen} from '../screens/library/PodcastsScreen';
import {AudiobooksScreen} from '../screens/library/AudiobooksScreen';
import {RadiosScreen} from '../screens/library/RadiosScreen';
import {LibraryMenuTab} from './LibraryMenuTab';

const Tab = createBottomTabNavigator();
const LibraryStack = createNativeStackNavigator();
const SettingsStack = createNativeStackNavigator();

// Icon components for tab bar
function HomeIcon({color, size}: {color: string; size: number}) {
  return <Text style={{color, fontSize: size}}>🏠</Text>;
}

function SearchIcon({color, size}: {color: string; size: number}) {
  return <Text style={{color, fontSize: size}}>🔍</Text>;
}

function LibraryIcon({color, size}: {color: string; size: number}) {
  return <Text style={{color, fontSize: size}}>🎵</Text>;
}

// Icon renderer functions for tab bar
const renderHomeIcon = ({color, size}: {color: string; size: number}) => (
  <HomeIcon color={color} size={size} />
);

const renderSearchIcon = ({color, size}: {color: string; size: number}) => (
  <SearchIcon color={color} size={size} />
);

const renderLibraryIcon = ({color, size}: {color: string; size: number}) => (
  <LibraryIcon color={color} size={size} />
);

function LibraryStackNavigator() {
  return (
    <LibraryStack.Navigator>
      <LibraryStack.Screen
        name="LibraryHome"
        component={LibraryScreen}
        options={{title: 'Library'}}
      />
      <LibraryStack.Screen
        name="Artists"
        component={ArtistsScreen}
        options={{title: 'Artists'}}
      />
      <LibraryStack.Screen
        name="Albums"
        component={AlbumsScreen}
        options={{title: 'Albums'}}
      />
      <LibraryStack.Screen
        name="Tracks"
        component={TracksScreen}
        options={{title: 'Tracks'}}
      />
      <LibraryStack.Screen
        name="Playlists"
        component={PlaylistsScreen}
        options={{title: 'Playlists'}}
      />
      <LibraryStack.Screen
        name="Podcasts"
        component={PodcastsScreen}
        options={{title: 'Podcasts'}}
      />
      <LibraryStack.Screen
        name="Audiobooks"
        component={AudiobooksScreen}
        options={{title: 'Audiobooks'}}
      />
      <LibraryStack.Screen
        name="Radios"
        component={RadiosScreen}
        options={{title: 'Radios'}}
      />
    </LibraryStack.Navigator>
  );
}

function SettingsStackNavigator() {
  return (
    <SettingsStack.Navigator>
      <SettingsStack.Screen
        name="SettingsHome"
        component={SettingsScreen}
        options={{title: 'Settings'}}
      />
    </SettingsStack.Navigator>
  );
}

export function MainNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#1976d2',
        tabBarInactiveTintColor: '#757575',
      }}>
      {/* Visible tabs */}
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          tabBarLabel: 'Home',
          tabBarIcon: renderHomeIcon,
        }}
      />
      <Tab.Screen
        name="Search"
        component={SearchScreen}
        options={{
          tabBarLabel: 'Search',
          tabBarIcon: renderSearchIcon,
        }}
      />
      <Tab.Screen
        name="LibraryMenu"
        component={LibraryMenuTab}
        options={{
          tabBarLabel: 'Library',
          tabBarIcon: renderLibraryIcon,
        }}
      />

      {/* Hidden tabs – navigated to from the Library menu */}
      <Tab.Screen
        name="Browse"
        component={BrowseScreen}
        options={{
          tabBarButton: () => null,
        }}
      />
      <Tab.Screen
        name="Library"
        component={LibraryStackNavigator}
        options={{
          tabBarButton: () => null,
        }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsStackNavigator}
        options={{
          tabBarButton: () => null,
        }}
      />
    </Tab.Navigator>
  );
}
