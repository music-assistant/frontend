import React, {useEffect, useState} from 'react';
import {View, StyleSheet, Text, ScrollView, ActivityIndicator} from 'react-native';
import {useAuthStore} from '../store/authStore';
import {api} from '../api/client';
import {PlayersWidgetRow} from '../components/PlayersWidgetRow';
import {WidgetRow} from '../components/WidgetRow';
import type {RecommendationFolder} from '../shared/types';

export function HomeScreen() {
  const user = useAuthStore(state => state.user);
  const [recommendations, setRecommendations] = useState<RecommendationFolder[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadRecommendations();
  }, []);

  const loadRecommendations = async () => {
    try {
      setLoading(true);
      const recs = await api.getRecommendations();
      setRecommendations(recs);
    } catch (error) {
      console.error('Failed to load recommendations:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>Welcome</Text>
          <Text style={styles.subtitle}>
            {user?.display_name || user?.username || 'User'}
          </Text>
        </View>

        <PlayersWidgetRow />

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#1976d2" />
          </View>
        ) : (
          recommendations.map(widgetRow => (
            <WidgetRow key={widgetRow.uri || widgetRow.item_id} widgetRow={widgetRow} />
          ))
        )}

        {!loading && recommendations.length === 0 && (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No recommendations available</Text>
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
  header: {
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 4,
    color: '#212121',
  },
  subtitle: {
    fontSize: 16,
    color: '#757575',
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
