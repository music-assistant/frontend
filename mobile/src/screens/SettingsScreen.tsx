import React from 'react';
import {View, StyleSheet, Text, ScrollView} from 'react-native';
import {useAuthStore} from '../store/authStore';
import {Button} from '../components/ui/button';

export function SettingsScreen() {
  const user = useAuthStore(state => state.user);
  const logout = useAuthStore(state => state.logout);

  return (
    <ScrollView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Settings</Text>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Profile</Text>
          <Text style={styles.sectionText}>
            {user?.display_name || user?.username || 'User'}
          </Text>
          <Text style={styles.sectionText}>
            Role: {user?.role || 'user'}
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>About</Text>
          <Text style={styles.sectionText}>Music Assistant Mobile</Text>
          <Text style={styles.sectionText}>Version 1.0.0</Text>
        </View>

        <Button onPress={logout} variant="outline">
          Logout
        </Button>
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
  section: {
    marginBottom: 24,
    padding: 16,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 8,
    color: '#212121',
  },
  sectionText: {
    fontSize: 14,
    color: '#757575',
    marginBottom: 4,
  },
});
