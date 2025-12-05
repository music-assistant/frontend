import { api } from "@/plugins/api";
import { MediaType } from "@/plugins/api/interfaces";

export const useGenresApi = () => {
  const searchGenres = async (query: string) => {
    return api.search(query, [MediaType.GENRE]);
  };

  const getGenres = async (limit = 100, offset = 0) => {
    return api.getLibraryGenres(undefined, undefined, limit, offset);
  };

  const getGenre = async (id: number) => {
    return api.getLibraryItem(MediaType.GENRE, id.toString(), "library");
  };

  const addAlias = async (genreId: number, alias: string) => {
    return api.addGenreAlias(genreId, alias);
  };

  const createGenre = async (name: string) => {
    return api.createGenre(name);
  };

  const removeAlias = async (alias: string) => {
    return api.removeGenreAlias(alias);
  };

  const deleteGenre = async (genreId: number) => {
    return api.deleteGenre(genreId, true);
  };

  const mergeGenres = async (
    sourceGenreIds: number[],
    targetGenreId: number,
  ) => {
    return api.mergeGenres(sourceGenreIds, targetGenreId);
  };

  const splitGenre = async (genreId: number, alias: string) => {
    return api.splitGenre(genreId, alias);
  };

  const updateGenre = async (genre: any) => {
    // Use direct genre update to avoid metadata throttling
    return api.updateGenreDirectly(genre);
  };

  const toggleFavorite = async (genre: any) => {
    api.toggleFavorite(genre);
  };

  return {
    searchGenres,
    getGenres,
    getGenre,
    addAlias,
    createGenre,
    removeAlias,
    deleteGenre,
    mergeGenres,
    splitGenre,
    updateGenre,
    toggleFavorite,
  };
};
