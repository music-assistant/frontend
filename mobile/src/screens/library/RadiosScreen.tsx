import React from 'react';
import {LibraryItemsList} from '../../components/LibraryItemsList';
import {api} from '../../api/client';

export function RadiosScreen() {
  const loadItems = async (search?: string, limit?: number, offset?: number) => {
    return api.getLibraryRadios(undefined, search, limit, offset);
  };

  return (
    <LibraryItemsList
      loadItems={loadItems}
      title="Radios"
      emptyMessage="No radios found"
    />
  );
}
