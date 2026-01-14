import React from 'react';
import {LibraryItemsList} from '../../components/LibraryItemsList';
import {api} from '../../api/client';

export function PodcastsScreen() {
  const loadItems = async (search?: string, limit?: number, offset?: number) => {
    return api.getLibraryPodcasts(undefined, search, limit, offset);
  };

  return (
    <LibraryItemsList
      loadItems={loadItems}
      title="Podcasts"
      emptyMessage="No podcasts found"
    />
  );
}
