import { logger } from "../utils/logger";
import { pocketbaseService } from "./pocketbase";

// Get the PocketBase instance
const pb = pocketbaseService.getPocketBase();

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const isAutoCancelError = (error: unknown): boolean => {
  if (!error || typeof error !== "object") {
    return false;
  }

  const maybeError = error as { message?: unknown; status?: unknown };
  const message =
    typeof maybeError.message === "string" ? maybeError.message : "";
  const status = maybeError.status;

  return (
    status === 0 ||
    message.toLowerCase().includes("autocancel") ||
    message.toLowerCase().includes("aborted")
  );
};

const runWithoutAutoCancel = async <T>(
  action: () => Promise<T>,
): Promise<T> => {
  pb.autoCancellation(false);
  try {
    return await action();
  } finally {
    pb.autoCancellation(true);
  }
};

/**
 * Review item state in the spaced repetition system
 */
export type ReviewState = "learning" | "review" | "suspended" | "retired";

/**
 * Question type for review
 */
export type ReviewQuestionType =
  | "multiple-choice"
  | "matching"
  | "translation"
  | "recitation";

/**
 * Result of a review attempt
 */
export type ReviewResult = "correct" | "incorrect" | "skipped";

/**
 * Represents a review item in the spaced repetition queue
 */
export interface ReviewItem {
  id: string; // PocketBase record ID
  userId: string;
  lessonId: string; // PocketBase collection ID
  questionId: string; // Stable ID (e.g., "D01-Q01")
  questionType: ReviewQuestionType;
  state: ReviewState;
  dueAt: string; // ISO 8601 datetime
  lastReviewedAt?: string; // ISO 8601 datetime, optional
  intervalDays: number; // Days between reviews
  streak: number; // Consecutive correct answers
  lapses: number; // Total incorrect answers
  lastResult?: ReviewResult; // Last review result
  created: string;
  updated: string;
  // Vocabulary question fields
  vocabWordId?: string; // PocketBase record ID of vocabulary word (optional)
  originalQuestionId?: string; // Track which template question was used
}

/**
 * Represents a review event (audit log)
 */
export interface ReviewEvent {
  id: string;
  userId: string;
  lessonId: string;
  questionId: string;
  reviewItemId: string;
  result: ReviewResult;
  occurredAt: string; // ISO 8601 datetime
  answer?: unknown; // JSON data
  created: string;
  updated: string;
}

/**
 * Quiz question structure
 */
export interface QuizQuestion {
  id: string;
  quizId: string;
  lessonId: string;
  questionId: string;
  questionIndex: number;
  type: ReviewQuestionType;
  question: string;
  options?: string[];
  correctAnswer: string | string[];
  explanation: string;
  created: string;
  updated: string;
  // Template question fields (for dynamic vocabulary questions)
  isTemplateQuestion?: boolean;
  templateId?: string;
  vocabWordId?: string;
}

/**
 * Service for managing spaced repetition review items
 */
export class ReviewService {
  /**
   * Get review items due for the user, ordered by due date
   * @param limit Maximum number of items to return
   * @returns Array of due review items
   */
  async getDueReviewItems(limit: number = 10): Promise<ReviewItem[]> {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const authStore = pb.authStore;
        if (!authStore.isValid || !authStore.model) {
          throw new Error("User not authenticated");
        }

        const userId = authStore.model.id;
        const now = new Date().toISOString();

        logger.debug(
          `[ReviewService] Fetching due items for user ${userId}, comparing against now: ${now}`,
        );

        // Fetch review items due now or earlier, ordered by dueAt
        const records = await runWithoutAutoCancel(() =>
          pb.collection("church_latin_review_items").getList(1, limit, {
            filter: `userId = "${userId}" && dueAt <= "${now}" && state != "retired"`,
            sort: "dueAt",
          }),
        );

        logger.debug(
          `[ReviewService] Got ${records.items.length} due items, now=${now}:`,
          records.items.map((item: ReviewItem) => ({
            id: item.id,
            questionId: item.questionId,
            dueAt: item.dueAt,
            state: item.state,
            streak: item.streak,
            intervalDays: item.intervalDays,
            lastResult: item.lastResult,
          })),
        );

        // Deduplicate by questionId + lessonId, keeping the item with highest streak (most recent activity)
        const deduplicatedMap = new Map<string, ReviewItem>();
        records.items.forEach((item: ReviewItem) => {
          const key = `${item.questionId}|${item.lessonId}`;
          const existing = deduplicatedMap.get(key);

          // Keep the item with the higher streak (more recent activity)
          if (!existing || (item.streak || 0) > (existing.streak || 0)) {
            deduplicatedMap.set(key, item);
          }
        });

        const uniqueItems = Array.from(deduplicatedMap.values());

        if (uniqueItems.length < records.items.length) {
          logger.warn(
            `[ReviewService] Removed ${records.items.length - uniqueItems.length} duplicate items. Keeping highest-streak versions.`,
          );
        }

        return uniqueItems as unknown as ReviewItem[];
      } catch (error) {
        if (isAutoCancelError(error) && attempt === 0) {
          logger.warn(
            "Due review items request was auto-cancelled. Retrying...",
            error,
          );
          await delay(200);
          continue;
        }

        logger.error("Failed to fetch due review items:", error);
        throw error;
      }
    }

    return [];
  }

  /**
   * Submit a review result and update the scheduling
   * @param lessonId PocketBase lesson collection ID
   * @param questionId Stable question ID (e.g., "D01-Q01")
   * @param result User's answer result
   */
  async submitReviewResult(
    lessonId: string,
    questionId: string,
    result: ReviewResult,
  ): Promise<void> {
    try {
      const authStore = pb.authStore;
      if (!authStore.isValid || !authStore.model) {
        throw new Error("User not authenticated");
      }

      const userId = authStore.model.id;
      logger.debug(
        `[ReviewService] Submitting review result for question ${questionId} in lesson ${lessonId}: ${result}`,
      );

      // Find existing review item
      logger.debug(
        `[ReviewService] Searching for review item: userId=${userId}, lessonId=${lessonId}, questionId=${questionId}`,
      );

      const records = await pb
        .collection("church_latin_review_items")
        .getList(1, 1, {
          filter: `userId = "${userId}" && lessonId = "${lessonId}" && questionId = "${questionId}"`,
        });

      if (records.items.length === 0) {
        throw new Error(`Review item not found for question ${questionId}`);
      }

      // Also check for duplicates
      const allMatches = await pb
        .collection("church_latin_review_items")
        .getList(1, 100, {
          filter: `userId = "${userId}" && questionId = "${questionId}"`,
        });

      if (allMatches.items.length > 1) {
        logger.warn(
          `[ReviewService] WARNING: Found ${allMatches.items.length} items with questionId=${questionId} for this user. IDs:`,
          {
            ids: allMatches.items.map((item: ReviewItem) => ({
              id: item.id,
              lessonId: item.lessonId,
              state: item.state,
              streak: item.streak,
              dueAt: item.dueAt,
            })),
          },
        );
      }

      const reviewItem = records.items[0] as unknown as ReviewItem;
      logger.debug(
        `[ReviewService] Found review item ${reviewItem.id}, current state before update:`,
        {
          id: reviewItem.id,
          questionId: reviewItem.questionId,
          lessonId: reviewItem.lessonId,
          state: reviewItem.state,
          streak: reviewItem.streak,
          intervalDays: reviewItem.intervalDays,
          dueAt: reviewItem.dueAt,
          lastResult: reviewItem.lastResult,
        },
      );
      logger.debug(`[ReviewService] Submitting answer with result: ${result}`);

      // Calculate next schedule based on result
      const schedule = calculateNextSchedule(reviewItem, result);
      logger.debug(
        `[ReviewService] Calculated schedule for result "${result}":`,
        {
          state: schedule.state,
          streak: schedule.streak,
          lapses: schedule.lapses,
          intervalDays: schedule.intervalDays,
          dueAt: schedule.dueAt,
        },
      );

      // Update review item
      const now = new Date().toISOString();
      const updatePayload = {
        ...schedule,
        lastReviewedAt: now,
        lastResult: result,
      };
      logger.debug(
        `[ReviewService] Update payload for ${reviewItem.id}:`,
        updatePayload,
      );

      let updateResult;
      try {
        updateResult = await runWithoutAutoCancel(() =>
          pb
            .collection("church_latin_review_items")
            .update(reviewItem.id, updatePayload as never),
        );
        logger.debug(
          `[ReviewService] Successfully updated review item ${reviewItem.id}`,
          {
            updatedRecord: updateResult,
          },
        );
      } catch (updateError) {
        logger.error(
          `[ReviewService] Failed to update review item ${reviewItem.id}:`,
          updateError,
        );
        throw updateError;
      }

      // Clean up old duplicate items with same questionId - delete the ones with lower/equal streak
      // This ensures we don't have multiple items for the same question confusing the system
      if (allMatches.items.length > 1) {
        const updatedItem = updateResult as unknown as ReviewItem;
        const oldDuplicates = allMatches.items.filter((item: ReviewItem) => {
          // Keep the item we just updated, delete all others
          if (item.id === reviewItem.id) return false;
          // Delete if this duplicate has a lower or equal streak (it's older data)
          return (item.streak || 0) <= (updatedItem.streak || 0);
        });

        if (oldDuplicates.length > 0) {
          logger.debug(
            `[ReviewService] Cleaning up ${oldDuplicates.length} old duplicate items for questionId=${questionId}. Keeping item ${reviewItem.id} with streak=${updatedItem.streak}.`,
          );

          // Delete old duplicates in parallel
          const deletePromises = oldDuplicates.map((item: ReviewItem) =>
            runWithoutAutoCancel(() =>
              pb.collection("church_latin_review_items").delete(item.id),
            ).catch((error: unknown) => {
              logger.warn(
                `[ReviewService] Failed to delete old duplicate item ${item.id}:`,
                error,
              );
              // Don't rethrow - cleanup failure shouldn't fail the whole operation
            }),
          );

          await Promise.all(deletePromises);
          logger.debug(
            `[ReviewService] Successfully cleaned up duplicate items for questionId=${questionId}`,
          );
        }
      }

      // Log review event
      const eventId = `event_${userId}_${reviewItem.id}_${Date.now()}`;
      try {
        const eventRecord = await runWithoutAutoCancel(() =>
          pb.collection("church_latin_review_events").create({
            resourceId: eventId,
            userId,
            lessonId,
            questionId,
            reviewItemId: reviewItem.id,
            result,
            occurredAt: new Date().toISOString(),
          } as never),
        );
        logger.debug(
          `[ReviewService] Created review event ${eventRecord.id} for result: ${result}`,
        );
      } catch (eventError) {
        logger.error(
          `[ReviewService] Failed to create review event:`,
          eventError,
        );
        throw eventError;
      }
    } catch (error) {
      logger.error("[ReviewService] Failed to submit review result:", error);
      throw error;
    }
  }

  /**
   * Get full question content for review
   * @param lessonId PocketBase lesson collection ID
   * @param questionId Stable question ID
   * @returns Quiz question with all content
   */
  async getReviewQuestion(
    lessonId: string,
    questionId: string,
  ): Promise<QuizQuestion> {
    try {
      const records = await pb
        .collection("church_latin_quiz_questions")
        .getList(1, 1, {
          filter: `lessonId = "${lessonId}" && questionId = "${questionId}"`,
        });

      if (records.items.length === 0) {
        throw new Error(
          `Question not found: ${questionId} in lesson ${lessonId}`,
        );
      }

      return records.items[0] as unknown as QuizQuestion;
    } catch (error) {
      logger.error("Failed to fetch review question:", error);
      throw error;
    }
  }

  /**
   * Create or update review item when user misses a quiz question
   * Called after quiz completion with score < 100%
   * @param lessonId Lesson number (1-40)
   * @param questionId Stable question ID
   * @param vocabWordId Optional vocabulary word ID for vocab questions
   */
  async handleQuizMiss(
    lessonId: number,
    questionId: string,
    vocabWordId?: string,
    questionTypeOverride?: ReviewQuestionType,
  ): Promise<void> {
    try {
      const authStore = pb.authStore;
      if (!authStore.isValid || !authStore.model) {
        throw new Error("User not authenticated");
      }

      const userId = authStore.model.id;

      // Get lesson collection to fetch actual PB lesson ID
      const lessons = await pb
        .collection("church_latin_lessons")
        .getList(1, 1, {
          filter: `lessonNumber = ${lessonId}`,
        });

      if (lessons.items.length === 0) {
        logger.warn(
          `[ReviewService] Lesson not found: ${lessonId}. This may indicate a data sync issue.`,
        );
        return;
      }

      const pbLessonId = lessons.items[0].id;

      let questionType = questionTypeOverride;

      if (!questionType) {
        // Fetch question to get its type
        const questionRecord = await pb
          .collection("church_latin_quiz_questions")
          .getList(1, 1, {
            filter: `lessonId = "${pbLessonId}" && questionId = "${questionId}"`,
          });

        if (questionRecord.items.length === 0) {
          logger.warn(
            `[ReviewService] Question not found: ${questionId} in lesson ${lessonId}`,
          );
          return;
        }

        const question = questionRecord.items[0] as unknown as QuizQuestion;
        questionType = question.type;
      }

      logger.debug(
        `[ReviewService] Found lesson ${lessonId} -> ${pbLessonId} for questionId: ${questionId}`,
      );
      logger.debug(
        `[ReviewService] Question ${questionId} type: ${questionType}`,
      );

      // Check if review item already exists
      const filter = vocabWordId
        ? `userId = "${userId}" && lessonId = "${pbLessonId}" && vocabWordId = "${vocabWordId}"`
        : `userId = "${userId}" && lessonId = "${pbLessonId}" && questionId = "${questionId}"`;

      const existing = await pb
        .collection("church_latin_review_items")
        .getList(1, 1, {
          filter,
        });

      const now = new Date();
      const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

      if (existing.items.length > 0) {
        // Update existing review item
        const item = existing.items[0] as unknown as ReviewItem;
        logger.debug(
          `[ReviewService] Updating existing review item for ${questionId}`,
        );
        await pb.collection("church_latin_review_items").update(item.id, {
          state: "learning",
          streak: 0,
          lapses: (item.lapses || 0) + 1,
          dueAt: tomorrow.toISOString(),
          lastResult: "incorrect",
        } as never);
      } else {
        // Create new review item
        logger.debug(
          `[ReviewService] Creating new review item for ${questionId}${vocabWordId ? ` with vocabWordId: ${vocabWordId}` : ""}`,
        );
        const resourceId = vocabWordId
          ? `review_${userId}_${pbLessonId}_${vocabWordId}`
          : `review_${userId}_${pbLessonId}_${questionId}`;

        const reviewItemData: Record<string, unknown> = {
          resourceId,
          userId,
          lessonId: pbLessonId,
          questionId,
          questionType: questionType ?? "translation",
          state: "learning",
          dueAt: tomorrow.toISOString(),
          intervalDays: 0,
          streak: 0,
          lapses: 1,
          lastResult: "incorrect",
        };

        // Add vocabWordId if provided (for vocabulary questions)
        if (vocabWordId) {
          reviewItemData.vocabWordId = vocabWordId;
        }

        const created = await pb
          .collection("church_latin_review_items")
          .create(reviewItemData as never);
        logger.debug(
          `[ReviewService] Successfully created review item ${created.id} for ${questionId}${vocabWordId ? ` with vocabWordId: ${vocabWordId}` : ""}`,
        );
      }
    } catch (error) {
      logger.error(
        `[ReviewService] Failed to handle quiz miss for ${questionId}:`,
        error,
      );
      // Don't rethrow - don't break quiz flow if review service fails
    }
  }

  /**
   * Get all upcoming review items (due in the future)
   * @param limit Maximum number of items to return
   * @returns Array of upcoming review items
   */
  async getUpcomingReviewItems(limit: number = 50): Promise<ReviewItem[]> {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const authStore = pb.authStore;
        if (!authStore.isValid || !authStore.model) {
          throw new Error("User not authenticated");
        }

        const userId = authStore.model.id;
        const now = new Date().toISOString();

        logger.debug(
          `[ReviewService] Fetching upcoming items for user ${userId}, comparing against now: ${now}`,
        );

        // Fetch review items due in the future, ordered by dueAt
        const records = await runWithoutAutoCancel(() =>
          pb.collection("church_latin_review_items").getList(1, limit, {
            filter: `userId = "${userId}" && dueAt > "${now}" && state != "retired" && state != "suspended"`,
            sort: "dueAt",
          }),
        );

        logger.debug(
          `[ReviewService] Got ${records.items.length} upcoming items, now=${now}:`,
          records.items.map((item: ReviewItem) => ({
            id: item.id,
            questionId: item.questionId,
            dueAt: item.dueAt,
            state: item.state,
            streak: item.streak,
            intervalDays: item.intervalDays,
            lastResult: item.lastResult,
          })),
        );

        // Deduplicate by questionId + lessonId, keeping the item with highest streak (most recent activity)
        const deduplicatedMap = new Map<string, ReviewItem>();
        records.items.forEach((item: ReviewItem) => {
          const key = `${item.questionId}|${item.lessonId}`;
          const existing = deduplicatedMap.get(key);

          // Keep the item with the higher streak (more recent activity)
          if (!existing || (item.streak || 0) > (existing.streak || 0)) {
            deduplicatedMap.set(key, item);
          }
        });

        const uniqueItems = Array.from(deduplicatedMap.values());

        if (uniqueItems.length < records.items.length) {
          logger.warn(
            `[ReviewService] Removed ${records.items.length - uniqueItems.length} duplicate items from upcoming. Keeping highest-streak versions.`,
          );
        }

        return uniqueItems as unknown as ReviewItem[];
      } catch (error) {
        if (isAutoCancelError(error) && attempt === 0) {
          logger.warn(
            "Upcoming review items request was auto-cancelled. Retrying...",
            error,
          );
          await delay(200);
          continue;
        }

        logger.error("Failed to fetch upcoming review items:", error);
        throw error;
      }
    }

    return [];
  }

  /**
   * Get all suspended review items
   * @param limit Maximum number of items to return
   * @returns Array of suspended review items
   */
  async getSuspendedReviewItems(limit: number = 50): Promise<ReviewItem[]> {
    try {
      const authStore = pb.authStore;
      if (!authStore.isValid || !authStore.model) {
        throw new Error("User not authenticated");
      }

      const userId = authStore.model.id;

      // Fetch suspended review items, ordered by dueAt
      const records = await pb
        .collection("church_latin_review_items")
        .getList(1, limit, {
          filter: `userId = "${userId}" && state = "suspended"`,
          sort: "dueAt",
        });

      return records.items as unknown as ReviewItem[];
    } catch (error) {
      logger.error("Failed to fetch suspended review items:", error);
      throw error;
    }
  }

  /**
   * Suspend or unsuspend a review item
   * @param lessonId PocketBase lesson collection ID
   * @param questionId Stable question ID
   * @param suspended True to suspend, false to resume
   */
  async setSuspended(
    lessonId: string,
    questionId: string,
    suspended: boolean,
  ): Promise<void> {
    try {
      const authStore = pb.authStore;
      if (!authStore.isValid || !authStore.model) {
        throw new Error("User not authenticated");
      }

      const userId = authStore.model.id;

      const records = await pb
        .collection("church_latin_review_items")
        .getList(1, 1, {
          filter: `userId = "${userId}" && lessonId = "${lessonId}" && questionId = "${questionId}"`,
        });

      if (records.items.length === 0) {
        throw new Error("Review item not found");
      }

      const reviewItem = records.items[0] as unknown as ReviewItem;
      const newState: ReviewState = suspended ? "suspended" : "learning";

      await pb
        .collection("church_latin_review_items")
        .update(reviewItem.id, { state: newState } as never);
    } catch (error) {
      logger.error("Failed to update suspension status:", error);
      throw error;
    }
  }
}

/**
 * Calculate next schedule based on review result
 * Implements spaced repetition scheduling algorithm
 * @param currentItem Current review item state
 * @param result Result of the review attempt
 * @returns Partial review item with updated schedule fields
 */
function calculateNextSchedule(
  currentItem: ReviewItem,
  result: ReviewResult,
): Partial<ReviewItem> {
  const now = new Date();

  if (result === "incorrect") {
    // Incorrect: reset streak, increment lapses, back to learning
    return {
      state: "learning",
      streak: 0,
      lapses: (currentItem.lapses || 0) + 1,
      intervalDays: 0,
      dueAt: new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString(), // +1 day
    };
  }

  if (result === "skipped") {
    // Skipped: no changes except dueAt
    return {
      dueAt: new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString(), // +1 day
    };
  }

  // Result is "correct"
  const newStreak = (currentItem.streak || 0) + 1;

  if (currentItem.state === "learning") {
    // Learning state progression
    let newIntervalDays = 0;
    let newState: ReviewState = "learning";

    if (newStreak === 1) {
      newIntervalDays = 1;
    } else if (newStreak === 2) {
      newIntervalDays = 3;
    } else if (newStreak >= 3) {
      // Promote to review
      newState = "review";
      newIntervalDays = 7;
    }

    const dueAt = new Date(
      now.getTime() + newIntervalDays * 24 * 60 * 60 * 1000,
    );

    return {
      state: newState,
      streak: newStreak,
      intervalDays: newIntervalDays,
      dueAt: dueAt.toISOString(),
    };
  }

  // Review state: increase interval using exponential backoff
  const currentInterval = currentItem.intervalDays || 7;
  const newIntervalDays = Math.min(
    Math.ceil(currentInterval * 1.5),
    365, // Cap at 1 year
  );

  // Check for retirement
  let newState: ReviewState = "review";
  if (newStreak >= 4 && newIntervalDays >= 30) {
    newState = "retired";
  }

  const dueAt = new Date(now.getTime() + newIntervalDays * 24 * 60 * 60 * 1000);

  return {
    state: newState,
    streak: newStreak,
    intervalDays: newIntervalDays,
    dueAt: dueAt.toISOString(),
  };
}

// Export singleton instance
export const reviewService = new ReviewService();
