import React, {useState} from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Pressable,
} from 'react-native';
import {useNavigation} from '@react-navigation/native';

type Nav = any;

export function LibraryMenuTab() {
  const navigation = useNavigation<Nav>();
  const [visible, setVisible] = useState(true);

  const openRoute = (route: string, params?: any) => {
    setVisible(false);
    // Navigate to the underlying tab routes (some are hidden from the tab bar)
    navigation.navigate(route as never, params as never);
  };

  const openLibrarySection = (screen: string) => {
    setVisible(false);
    navigation.navigate('Library' as never, {screen} as never);
  };

  return (
    <>
      {/* Invisible screen content – the tab only serves to open the menu */}
      <View style={styles.invisibleContent} />

      <Modal
        visible={visible}
        animationType="slide"
        transparent
        onRequestClose={() => setVisible(false)}>
        <Pressable
          style={styles.backdrop}
          onPress={() => setVisible(false)}
          aria-hidden="true">
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>Library & More</Text>

            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => openRoute('Browse')}>
              <Text style={styles.menuText}>Browse</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => openLibrarySection('Artists')}>
              <Text style={styles.menuText}>Artists</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => openLibrarySection('Albums')}>
              <Text style={styles.menuText}>Albums</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => openLibrarySection('Tracks')}>
              <Text style={styles.menuText}>Tracks</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => openLibrarySection('Playlists')}>
              <Text style={styles.menuText}>Playlists</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => openLibrarySection('Podcasts')}>
              <Text style={styles.menuText}>Podcasts</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => openLibrarySection('Audiobooks')}>
              <Text style={styles.menuText}>Audiobooks</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => openLibrarySection('Radios')}>
              <Text style={styles.menuText}>Radios</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.menuItem, styles.menuItemLast]}
              onPress={() => openRoute('Settings')}>
              <Text style={styles.menuText}>Settings</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  invisibleContent: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#ffffff',
    paddingTop: 16,
    paddingBottom: 32,
    paddingHorizontal: 20,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
    color: '#212121',
  },
  menuItem: {
    paddingVertical: 10,
  },
  menuItemLast: {
    marginTop: 8,
  },
  menuText: {
    fontSize: 16,
    color: '#1976d2',
  },
});

