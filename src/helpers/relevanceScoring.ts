/**
 * Relevance scoring utilities for search results.
 * Pure functions with no Vue reactivity dependencies.
 */

import type { Artist, Track } from "@/plugins/api/interfaces";

export const levenshteinDistance = (str1: string, str2: string): number => {
  const m = str1.length;
  const n = str2.length;
  const dp: number[][] = Array(m + 1)
    .fill(null)
    .map(() => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
  }
  return dp[m][n];
};

export const calculateRelevanceScore = (
  item: Track | Artist,
  query: string,
): number => {
  const normalizedQuery = query.toLowerCase().trim();
  const normalizedName = (item.name || "").toLowerCase().trim();

  // Get artist name for tracks
  let artistName = "";
  if ("artists" in item && item.artists.length > 0) {
    artistName = item.artists
      .map((a) => a.name)
      .join(" ")
      .toLowerCase();
  }

  // Base score starts at 0, higher is better
  let score = 0;

  // 1. Exact match bonus (highest priority)
  if (normalizedName === normalizedQuery) {
    score += 1000;
  } else if (normalizedName.startsWith(normalizedQuery)) {
    // Starts with query - strong match
    score += 500;
  } else if (normalizedName.includes(normalizedQuery)) {
    // Contains query
    score += 200;
  }

  // 2. Artist name match for tracks
  if (artistName) {
    if (artistName === normalizedQuery) {
      score += 800;
    } else if (artistName.startsWith(normalizedQuery)) {
      score += 400;
    } else if (artistName.includes(normalizedQuery)) {
      score += 150;
    }
  }

  // 3. Levenshtein similarity (normalized to 0-100)
  const distance = levenshteinDistance(
    normalizedName.slice(0, 50),
    normalizedQuery,
  );
  const maxLen = Math.max(normalizedName.length, normalizedQuery.length, 1);
  const similarity = Math.max(0, 100 - (distance / maxLen) * 100);
  score += similarity;

  // 4. Popularity bonus (0-100 from metadata)
  const popularity = item.metadata?.popularity ?? 0;
  score += popularity * 0.5; // Weight popularity at 50%

  // 5. Artist type bonus when searching for artists
  // (so artist "Taylor Swift" ranks above track "Taylor Swift" when name matches)
  if (
    item.media_type === "artist" &&
    normalizedName.includes(normalizedQuery)
  ) {
    score += 100;
  }

  return score;
};

export const sortByRelevance = (
  items: (Track | Artist)[],
  query: string,
): (Track | Artist)[] => {
  return [...items].sort((a, b) => {
    const scoreA = calculateRelevanceScore(a, query);
    const scoreB = calculateRelevanceScore(b, query);
    return scoreB - scoreA; // Higher score first
  });
};
