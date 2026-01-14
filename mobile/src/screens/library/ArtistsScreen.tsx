import React from 'react';
import {LibraryItemsList} from '../../components/LibraryItemsList';
import {api} from '../../api/client';

export function ArtistsScreen() {
  const loadItems = async (search?: string, limit?: number, offset?: number) => {
    return api.getLibraryArtists(undefined, search, limit, offset);
  };

  return (
    <LibraryItemsList
      loadItems={loadItems}
      title="Artists"
      emptyMessage="No artists found"
    />
  );
}
