import React from 'react';
import {View, StyleSheet, Text, ScrollView, TouchableOpacity, Image} from 'react-native';
import {Card} from './ui/card';
import type {RecommendationFolder} from '../shared/types';
import {ImageType} from '../shared/types';
import {getImageThumbForItem} from '../lib/images';

interface WidgetRowProps {
  widgetRow: RecommendationFolder;
}

export function WidgetRow({widgetRow}: WidgetRowProps) {
  if (!widgetRow.items || widgetRow.items.length === 0) {
    return null;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{widgetRow.name}</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}>
        {widgetRow.items.map((item, index) => (
          <TouchableOpacity
            key={item.item_id || `${item.uri}-${index}`}
            style={styles.itemCard}>
            <Card style={styles.card}>
              {(() => {
                const thumbUrl = getImageThumbForItem(item, ImageType.THUMB, 256);
                if (thumbUrl) {
                  return (
                    <Image
                      source={{uri: thumbUrl}}
                      style={styles.image}
                      resizeMode="cover"
                    />
                  );
                }
                return (
                <View style={[styles.image, styles.placeholderImage]}>
                  <Text style={styles.placeholderText}>
                    {item.name.charAt(0).toUpperCase()}
                  </Text>
                </View>
                );
              })()}
              <Text style={styles.itemName} numberOfLines={2}>
                {item.name}
              </Text>
              {'artists' in item && item.artists && item.artists.length > 0 && (
                <Text style={styles.itemSubtitle} numberOfLines={1}>
                  {item.artists.map(a => a.name).join(', ')}
                </Text>
              )}
            </Card>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 24,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 12,
    color: '#212121',
    paddingHorizontal: 4,
  },
  scrollContent: {
    paddingHorizontal: 4,
    gap: 12,
  },
  itemCard: {
    width: 140,
  },
  card: {
    padding: 0,
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: 140,
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
  itemName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#212121',
    marginTop: 8,
    marginBottom: 4,
    paddingHorizontal: 8,
    minHeight: 36,
  },
  itemSubtitle: {
    fontSize: 12,
    color: '#757575',
    paddingHorizontal: 8,
    marginBottom: 8,
  },
});
