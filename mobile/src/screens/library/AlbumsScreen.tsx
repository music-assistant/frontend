import React from 'react';
import {LibraryItemsList} from '../../components/LibraryItemsList';
import {api} from '../../api/client';

export function AlbumsScreen() {
  const loadItems = async (search?: string, limit?: number, offset?: number) => {
    return api.getLibraryAlbums(undefined, search, limit, offset);
  };

  return (
    <LibraryItemsList
      loadItems={loadItems}
      title="Albums"
      emptyMessage="No albums found"
    />
  );
}
