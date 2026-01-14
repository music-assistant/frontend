import React, {useState, useEffect, useCallback} from 'react';
import {
  View,
  StyleSheet,
  Text,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Image,
} from 'react-native';
import {api} from '../api/client';
import {Card} from '../components/ui/card';
import {getImageThumbForItem} from '../lib/images';
import type {MediaItem} from '../shared/types';
import {MediaType, ImageType} from '../shared/types';

export function BrowseScreen() {
  const [items, setItems] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPath, setCurrentPath] = useState<string | undefined>(undefined);
  const [pathHistory, setPathHistory] = useState<string[]>([]);

  const loadItems = useCallback(async () => {
    try {
      setLoading(true);
      const results = await api.browse(currentPath);
      setItems(results);
    } catch (error) {
      console.error('Failed to load browse items:', error);
    } finally {
      setLoading(false);
    }
  }, [currentPath]);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  const handleItemPress = (item: MediaItem) => {
    if (item.media_type === MediaType.FOLDER) {
      const newPath = item.uri || item.item_id;
      setPathHistory([...pathHistory, currentPath || 'root']);
      setCurrentPath(newPath);
    } else {
      // Navigate to item details (to be implemented)
      console.log('Navigate to:', item);
    }
  };

  const handleBackPress = () => {
    if (pathHistory.length > 0) {
      const previousPath = pathHistory[pathHistory.length - 1];
      setPathHistory(pathHistory.slice(0, -1));
      setCurrentPath(previousPath === 'root' ? undefined : previousPath);
    }
  };

  const renderItem = ({item}: {item: MediaItem}) => {
    const imageUrl = getImageThumbForItem(item, ImageType.THUMB, 200);
    const isFolder = item.media_type === MediaType.FOLDER;

    return (
      <TouchableOpacity
        style={styles.itemContainer}
        onPress={() => handleItemPress(item)}>
        <Card style={styles.card}>
          {imageUrl ? (
            <View style={styles.imageContainer}>
              <Image source={{uri: imageUrl}} style={styles.image} />
              {isFolder && (
                <View style={styles.folderOverlay}>
                  <Text style={styles.folderIcon}>📁</Text>
                </View>
              )}
            </View>
          ) : (
            <View style={[styles.image, styles.placeholderImage]}>
              <Text style={styles.placeholderText}>
                {isFolder ? '📁' : item.name.charAt(0).toUpperCase()}
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
          </View>
        </Card>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Browse</Text>
        {pathHistory.length > 0 && (
          <TouchableOpacity onPress={handleBackPress} style={styles.backButton}>
            <Text style={styles.backButtonText}>← Back</Text>
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#1976d2" />
        </View>
      ) : items.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No items found</Text>
        </View>
      ) : (
        <FlatList
          data={items}
          renderItem={renderItem}
          keyExtractor={item => item.item_id || item.uri}
          numColumns={2}
          contentContainerStyle={styles.listContent}
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
    marginBottom: 8,
    color: '#212121',
  },
  backButton: {
    marginTop: 8,
  },
  backButtonText: {
    fontSize: 16,
    color: '#1976d2',
    fontWeight: '500',
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
  imageContainer: {
    position: 'relative',
  },
  image: {
    width: '100%',
    aspectRatio: 1,
    backgroundColor: '#f5f5f5',
  },
  folderOverlay: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 4,
    padding: 4,
  },
  folderIcon: {
    fontSize: 16,
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
