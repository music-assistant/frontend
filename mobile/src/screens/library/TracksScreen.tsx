import React from 'react';
import {LibraryItemsList} from '../../components/LibraryItemsList';
import {api} from '../../api/client';

export function TracksScreen() {
  const loadItems = async (search?: string, limit?: number, offset?: number) => {
    return api.getLibraryTracks(undefined, search, limit, offset);
  };

  return (
    <LibraryItemsList
      loadItems={loadItems}
      title="Tracks"
      emptyMessage="No tracks found"
    />
  );
}
