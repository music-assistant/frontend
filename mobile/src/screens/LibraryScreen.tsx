import React from 'react';
import {View, StyleSheet, Text, ScrollView, TouchableOpacity} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import {Card} from '../components/ui/card';

export function LibraryScreen() {
  const navigation = useNavigation();

  const librarySections = [
    {name: 'Artists', route: 'Artists'},
    {name: 'Albums', route: 'Albums'},
    {name: 'Tracks', route: 'Tracks'},
    {name: 'Playlists', route: 'Playlists'},
    {name: 'Podcasts', route: 'Podcasts'},
    {name: 'Audiobooks', route: 'Audiobooks'},
    {name: 'Radios', route: 'Radios'},
  ];

  return (
    <ScrollView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Library</Text>
        <View style={styles.sections}>
          {librarySections.map(section => (
            <TouchableOpacity
              key={section.name}
              onPress={() => navigation.navigate(section.route as never)}>
              <Card style={styles.card}>
                <Text style={styles.cardTitle}>{section.name}</Text>
              </Card>
            </TouchableOpacity>
          ))}
        </View>
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
    padding: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 24,
    color: '#212121',
  },
  sections: {
    gap: 12,
  },
  card: {
    padding: 16,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#212121',
  },
});
