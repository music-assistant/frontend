import React, {useState, useEffect, useCallback} from 'react';
import {
  View,
  StyleSheet,
  Text,
  FlatList,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import {Card} from './ui/card';
import {getImageThumbForItem} from '../lib/images';
import type {MediaItem} from '../shared/types';
import {ImageType} from '../shared/types';

interface LibraryItemsListProps {
  loadItems: (
    search?: string,
    limit?: number,
    offset?: number,
  ) => Promise<MediaItem[]>;
  title: string;
  emptyMessage?: string;
}

export function LibraryItemsList({
  loadItems,
  title,
  emptyMessage = 'No items found',
}: LibraryItemsListProps) {
  const [items, setItems] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const limit = 50;

  const fetchItems = useCallback(
    async (reset = false) => {
      try {
        if (reset) {
          setLoading(true);
          setOffset(0);
        }
        const currentOffset = reset ? 0 : offset;
        const results = await loadItems(
          searchQuery || undefined,
          limit,
          currentOffset,
        );
        if (reset) {
          setItems(results);
          setOffset(results.length);
        } else {
          setItems(prev => [...prev, ...results]);
          setOffset(prev => prev + results.length);
        }
        setHasMore(results.length === limit);
      } catch (error) {
        console.error('Failed to load items:', error);
      } finally {
        setLoading(false);
      }
    },
    [loadItems, searchQuery, offset],
  );

  useEffect(() => {
    fetchItems(true);
  }, [searchQuery, fetchItems]);

  const handleLoadMore = () => {
    if (!loading && hasMore) {
      fetchItems(false);
    }
  };

  const renderItem = ({item}: {item: MediaItem}) => {
    const imageUrl = getImageThumbForItem(item, ImageType.THUMB, 200);

    return (
      <TouchableOpacity style={styles.itemContainer}>
        <Card style={styles.card}>
          {imageUrl ? (
            <Image source={{uri: imageUrl}} style={styles.image} />
          ) : (
            <View style={[styles.image, styles.placeholderImage]}>
              <Text style={styles.placeholderText}>
                {item.name.charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
          <View style={styles.itemInfo}>
            <Text style={styles.itemName} numberOfLines={2}>
              {item.name}
            </Text>
            {'artists' in item && item.artists && item.artists.length > 0 && (
              <Text style={styles.itemSubtitle} numberOfLines={1}>
                {item.artists.map(a => a.name).join(', ')}
              </Text>
            )}
            {'year' in item && item.year && (
              <Text style={styles.itemYear}>{item.year}</Text>
            )}
          </View>
        </Card>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>
        <TextInput
          style={styles.searchInput}
          placeholder="Search..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholderTextColor="#9e9e9e"
        />
      </View>

      {loading && items.length === 0 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#1976d2" />
        </View>
      ) : items.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>{emptyMessage}</Text>
        </View>
      ) : (
        <FlatList
          data={items}
          renderItem={renderItem}
          keyExtractor={item => item.item_id || item.uri}
          numColumns={2}
          contentContainerStyle={styles.listContent}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.5}
          ListFooterComponent={
            loading && items.length > 0 ? (
              <ActivityIndicator size="small" color="#1976d2" />
            ) : null
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  header: {
    padding: 16,
    backgroundColor: '#ffffff',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#212121',
  },
  searchInput: {
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#212121',
  },
  listContent: {
    padding: 8,
  },
  itemContainer: {
    flex: 1,
    margin: 4,
  },
  card: {
    padding: 0,
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    aspectRatio: 1,
    backgroundColor: '#f5f5f5',
  },
  placeholderImage: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#e0e0e0',
  },
  placeholderText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#9e9e9e',
  },
  itemInfo: {
    padding: 8,
  },
  itemName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#212121',
    marginBottom: 4,
  },
  itemSubtitle: {
    fontSize: 12,
    color: '#757575',
    marginBottom: 2,
  },
  itemYear: {
    fontSize: 11,
    color: '#9e9e9e',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: 16,
    color: '#757575',
  },
});
