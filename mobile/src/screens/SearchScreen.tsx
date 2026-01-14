import React, {useState, useEffect, useCallback, useRef} from 'react';
import {
  View,
  StyleSheet,
  Text,
  TextInput,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import {api} from '../api/client';
import {WidgetRow} from '../components/WidgetRow';
import type {RecommendationFolder, SearchResults} from '../shared/types';

export function SearchScreen() {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResults | null>(null);
  const [loading, setLoading] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const performSearch = useCallback(async (query: string) => {
    if (!query.trim()) {
      setSearchResults(null);
      return;
    }

    setLoading(true);
    try {
      const results = await api.search(query, undefined, 8);
      setSearchResults(results);
    } catch (error) {
      console.error('Search failed:', error);
      setSearchResults(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    const timeout = setTimeout(() => {
      performSearch(searchQuery);
    }, 500);

    searchTimeoutRef.current = timeout;

    return () => {
      if (timeout) {
        clearTimeout(timeout);
      }
    };
  }, [searchQuery, performSearch]);

  const createWidgetRow = (
    title: string,
    items: any[],
  ): RecommendationFolder | null => {
    if (!items || items.length === 0) {return null;}
    return {
      item_id: `search-${title}`,
      provider: 'search',
      provider_instance: 'search',
      name: title,
      uri: `search://${title}`,
      media_type: 'unknown' as any,
      items,
    };
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Search</Text>
        <TextInput
          style={styles.searchInput}
          placeholder="Type to search..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholderTextColor="#9e9e9e"
          autoCapitalize="none"
          autoCorrect={false}
        />

        {loading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#1976d2" />
          </View>
        )}

        {!loading && searchResults && (
          <>
            {createWidgetRow('Tracks', searchResults.tracks) && (
              <WidgetRow
                widgetRow={createWidgetRow('Tracks', searchResults.tracks)!}
              />
            )}
            {createWidgetRow('Artists', searchResults.artists) && (
              <WidgetRow
                widgetRow={createWidgetRow('Artists', searchResults.artists)!}
              />
            )}
            {createWidgetRow('Albums', searchResults.albums) && (
              <WidgetRow
                widgetRow={createWidgetRow('Albums', searchResults.albums)!}
              />
            )}
            {createWidgetRow('Playlists', searchResults.playlists) && (
              <WidgetRow
                widgetRow={createWidgetRow('Playlists', searchResults.playlists)!}
              />
            )}
            {createWidgetRow('Podcasts', searchResults.podcasts) && (
              <WidgetRow
                widgetRow={createWidgetRow('Podcasts', searchResults.podcasts)!}
              />
            )}
            {createWidgetRow('Audiobooks', searchResults.audiobooks) && (
              <WidgetRow
                widgetRow={
                  createWidgetRow('Audiobooks', searchResults.audiobooks)!
                }
              />
            )}
            {createWidgetRow('Radios', searchResults.radio) && (
              <WidgetRow
                widgetRow={createWidgetRow('Radios', searchResults.radio)!}
              />
            )}
          </>
        )}

        {!loading &&
          !searchResults &&
          searchQuery.trim() === '' &&
          !searchQuery && (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>Type to search...</Text>
            </View>
          )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  content: {
    padding: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 16,
    color: '#212121',
  },
  searchInput: {
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#212121',
    marginBottom: 16,
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#757575',
  },
});
