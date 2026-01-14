import React from 'react';
import {LibraryItemsList} from '../../components/LibraryItemsList';
import {api} from '../../api/client';

export function AudiobooksScreen() {
  const loadItems = async (search?: string, limit?: number, offset?: number) => {
    return api.getLibraryAudiobooks(undefined, search, limit, offset);
  };

  return (
    <LibraryItemsList
      loadItems={loadItems}
      title="Audiobooks"
      emptyMessage="No audiobooks found"
    />
  );
}
