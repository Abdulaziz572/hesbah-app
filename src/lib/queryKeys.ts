import type { QueryClient } from "@tanstack/react-query";

/**
 * User-scoped query key factories for TanStack Query.
 * All query keys MUST include the authenticated user's ID to prevent
 * cross-account data leaks.
 */
export const queryKeys = {
  /** All meals queries for a specific user (used for broad invalidations) */
  allMeals: (userId: string) => ["meals", userId] as const,

  /** Meals for a specific user on a specific calendar day (YYYY-MM-DD) */
  meals: (userId: string, dateKey: string) => ["meals", userId, dateKey] as const,

  /** All day summaries queries for a specific user */
  allSummaries: (userId: string) => ["summaries", userId] as const,

  /** Day summaries for a specific user across a date range */
  summaries: (userId: string, fromKey: string, toKey: string) =>
    ["summaries", userId, fromKey, toKey] as const,

  /** User profile and daily target settings */
  profile: (userId: string) => ["profile", userId] as const,

  /** Previous / saved meals list for the Add Meal screen */
  previousMeals: (userId: string) => ["previous-meals", userId] as const,
};

/**
 * Immediately invalidates all meal-related queries (daily meals, summaries, previous meals)
 * for the user upon meal creation, update, delete, or copy.
 */
export async function invalidateUserMeals(
  queryClient: QueryClient,
  userId: string,
): Promise<void> {
  if (!userId) return;
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.allMeals(userId) }),
    queryClient.invalidateQueries({ queryKey: queryKeys.allSummaries(userId) }),
    queryClient.invalidateQueries({ queryKey: queryKeys.previousMeals(userId) }),
  ]);
}

/**
 * Immediately invalidates profile targets and recalculates dependent diary queries.
 */
export async function invalidateUserProfile(
  queryClient: QueryClient,
  userId: string,
): Promise<void> {
  if (!userId) return;
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.profile(userId) }),
    queryClient.invalidateQueries({ queryKey: queryKeys.allMeals(userId) }),
  ]);
}

/**
 * Completely wipes all cached query data across the entire app upon user logout.
 */
export function clearQueryCache(queryClient: QueryClient): void {
  queryClient.clear();
}
