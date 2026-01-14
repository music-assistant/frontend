import React from 'react';
import {LibraryItemsList} from '../../components/LibraryItemsList';
import {api} from '../../api/client';

export function PlaylistsScreen() {
  const loadItems = async (search?: string, limit?: number, offset?: number) => {
    return api.getLibraryPlaylists(undefined, search, limit, offset);
  };

  return (
    <LibraryItemsList
      loadItems={loadItems}
      title="Playlists"
      emptyMessage="No playlists found"
    />
  );
}
