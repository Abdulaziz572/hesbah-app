import { describe, it, expect, beforeEach } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import {
  queryKeys,
  invalidateUserMeals,
  invalidateUserProfile,
  clearQueryCache,
} from "../queryKeys";

describe("TanStack Query User-Scoped Keys & Cache Management", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          staleTime: 60 * 1000,
          gcTime: 10 * 60 * 1000,
        },
      },
    });
  });

  describe("Query Key Factories", () => {
    it("strictly includes userId in all query key factories", () => {
      const userA = "usr_alice_123";
      const userB = "usr_bob_456";
      const date = "2026-10-26";
      const from = "2026-10-01";
      const to = "2026-10-31";

      // 1. Daily meals key
      const mealsKeyA = queryKeys.meals(userA, date);
      const mealsKeyB = queryKeys.meals(userB, date);
      expect(mealsKeyA).toEqual(["meals", userA, date]);
      expect(mealsKeyB).toEqual(["meals", userB, date]);
      expect(mealsKeyA).not.toEqual(mealsKeyB);

      // 2. All meals prefix key (for hierarchical invalidation)
      expect(queryKeys.allMeals(userA)).toEqual(["meals", userA]);

      // 3. Summaries key
      const summariesKeyA = queryKeys.summaries(userA, from, to);
      const summariesKeyB = queryKeys.summaries(userB, from, to);
      expect(summariesKeyA).toEqual(["summaries", userA, from, to]);
      expect(summariesKeyB).toEqual(["summaries", userB, from, to]);
      expect(summariesKeyA).not.toEqual(summariesKeyB);

      // 4. Profile key
      expect(queryKeys.profile(userA)).toEqual(["profile", userA]);
      expect(queryKeys.profile(userB)).toEqual(["profile", userB]);

      // 5. Previous meals key
      expect(queryKeys.previousMeals(userA)).toEqual(["previous-meals", userA]);
      expect(queryKeys.previousMeals(userB)).toEqual(["previous-meals", userB]);
    });
  });

  describe("Cache Invalidation on Meal Create / Update / Delete Mutations", () => {
    it("invalidates all daily dates, summaries, and previous meals for the target user only", async () => {
      const targetUser = "user_target";
      const otherUser = "user_other";

      // Seed cache for target user
      queryClient.setQueryData(queryKeys.meals(targetUser, "2026-10-26"), [{ id: "m1" }]);
      queryClient.setQueryData(queryKeys.meals(targetUser, "2026-10-25"), [{ id: "m2" }]);
      queryClient.setQueryData(queryKeys.summaries(targetUser, "2026-10-01", "2026-10-31"), { count: 2 });
      queryClient.setQueryData(queryKeys.previousMeals(targetUser), [{ signature: "s1" }]);

      // Seed cache for another user
      queryClient.setQueryData(queryKeys.meals(otherUser, "2026-10-26"), [{ id: "other_m1" }]);
      queryClient.setQueryData(queryKeys.summaries(otherUser, "2026-10-01", "2026-10-31"), { count: 10 });

      // Trigger mutation invalidation for targetUser
      await invalidateUserMeals(queryClient, targetUser);

      // Target user queries should now be invalidated / stale
      const targetMeal1 = queryClient.getQueryState(queryKeys.meals(targetUser, "2026-10-26"));
      const targetMeal2 = queryClient.getQueryState(queryKeys.meals(targetUser, "2026-10-25"));
      const targetSummary = queryClient.getQueryState(queryKeys.summaries(targetUser, "2026-10-01", "2026-10-31"));
      const targetPrev = queryClient.getQueryState(queryKeys.previousMeals(targetUser));

      expect(targetMeal1?.isInvalidated).toBe(true);
      expect(targetMeal2?.isInvalidated).toBe(true);
      expect(targetSummary?.isInvalidated).toBe(true);
      expect(targetPrev?.isInvalidated).toBe(true);

      // Other user queries must NOT be invalidated
      const otherMeal = queryClient.getQueryState(queryKeys.meals(otherUser, "2026-10-26"));
      const otherSummary = queryClient.getQueryState(queryKeys.summaries(otherUser, "2026-10-01", "2026-10-31"));

      expect(otherMeal?.isInvalidated).toBe(false);
      expect(otherSummary?.isInvalidated).toBe(false);
    });

    it("safely handles empty or missing userId without crashing", async () => {
      await expect(invalidateUserMeals(queryClient, "")).resolves.toBeUndefined();
    });
  });

  describe("Profile Target Invalidation", () => {
    it("invalidates profile and daily diary queries when user saves new target calories/macros", async () => {
      const user = "user_settings";

      queryClient.setQueryData(queryKeys.profile(user), { target_calories: 2000 });
      queryClient.setQueryData(queryKeys.meals(user, "2026-10-26"), [{ id: "m1" }]);

      await invalidateUserProfile(queryClient, user);

      const profileState = queryClient.getQueryState(queryKeys.profile(user));
      const mealsState = queryClient.getQueryState(queryKeys.meals(user, "2026-10-26"));

      expect(profileState?.isInvalidated).toBe(true);
      expect(mealsState?.isInvalidated).toBe(true);
    });
  });

  describe("Logout Cache Wipe", () => {
    it("completely wipes all cached query data upon sign out", () => {
      // Seed multiple queries for multiple users
      queryClient.setQueryData(queryKeys.meals("user1", "2026-10-26"), [{ id: "m1" }]);
      queryClient.setQueryData(queryKeys.profile("user1"), { target_calories: 2200 });
      queryClient.setQueryData(queryKeys.previousMeals("user1"), [{ signature: "s1" }]);
      queryClient.setQueryData(queryKeys.meals("user2", "2026-10-26"), [{ id: "m2" }]);

      expect(queryClient.getQueryCache().getAll().length).toBe(4);

      // Execute logout cleanup
      clearQueryCache(queryClient);

      // Cache must be completely empty: no stale data can leak to subsequent logins
      expect(queryClient.getQueryCache().getAll().length).toBe(0);
      expect(queryClient.getQueryData(queryKeys.meals("user1", "2026-10-26"))).toBeUndefined();
      expect(queryClient.getQueryData(queryKeys.profile("user1"))).toBeUndefined();
    });
  });
});
