import React from 'react';
import {View, StyleSheet, Text, ScrollView, TouchableOpacity} from 'react-native';
import {useApiStore} from '../store/apiStore';
import {Card} from './ui/card';

export function PlayersWidgetRow() {
  const players = useApiStore(state => state.playersList);

  if (players.length === 0) {
    return null;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Players</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}>
        {players.map(player => (
          <TouchableOpacity key={player.player_id} style={styles.playerCard}>
            <Card style={styles.card}>
              <Text style={styles.playerName} numberOfLines={1}>
                {player.name}
              </Text>
              <Text style={styles.playerStatus}>
                {player.available ? 'Available' : 'Unavailable'}
              </Text>
              {(player.state === 'playing' || player.playback_state === 'playing') && (
                <View style={styles.playingIndicator}>
                  <Text style={styles.playingText}>▶ Playing</Text>
                </View>
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
  playerCard: {
    width: 200,
  },
  card: {
    padding: 16,
    minHeight: 100,
  },
  playerName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#212121',
    marginBottom: 4,
  },
  playerStatus: {
    fontSize: 14,
    color: '#757575',
  },
  playingIndicator: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  playingText: {
    fontSize: 12,
    color: '#1976d2',
    fontWeight: '500',
  },
});
