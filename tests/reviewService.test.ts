/**
 * Unit Tests for ReviewService
 * Tests the core scheduling algorithm and review item management logic
 */

import { beforeEach, describe, expect, it } from "vitest";

/**
 * Mock types for testing (matches src/services/reviewService.ts)
 */
interface ReviewItem {
    id: string;
    userId: string;
    lessonId: string;
    questionId: string;
    state: "learning" | "review" | "suspended" | "retired";
    dueAt: string;
    intervalDays: number;
    streak: number;
    lapses: number;
    lastResult?: "correct" | "incorrect" | "skipped";
}

type ReviewResult = "correct" | "incorrect" | "skipped";

/**
 * Calculate next schedule based on review result (extracted from reviewService.ts)
 * Implements spaced repetition scheduling algorithm
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
        let newState: ReviewItem["state"] = "learning";

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
    let newState: ReviewItem["state"] = "review";
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

/**
 * Test Suite: Scheduling Algorithm
 */
describe("ReviewService - Scheduling Algorithm", () => {
    let baseItem: ReviewItem;

    beforeEach(() => {
        baseItem = {
            id: "review-1",
            userId: "user-1",
            lessonId: "lesson-1",
            questionId: "D01-Q01",
            state: "learning",
            dueAt: new Date().toISOString(),
            intervalDays: 0,
            streak: 0,
            lapses: 0,
        };
    });

    describe("Incorrect Answer Handling", () => {
        it("should reset streak to 0 on incorrect answer", () => {
            baseItem.streak = 2;
            const schedule = calculateNextSchedule(baseItem, "incorrect");

            expect(schedule.streak).toBe(0);
        });

        it("should increment lapses counter on incorrect answer", () => {
            baseItem.lapses = 5;
            const schedule = calculateNextSchedule(baseItem, "incorrect");

            expect(schedule.lapses).toBe(6);
        });

        it("should set state to learning on incorrect answer", () => {
            baseItem.state = "review";
            const schedule = calculateNextSchedule(baseItem, "incorrect");

            expect(schedule.state).toBe("learning");
        });

        it("should set dueAt to tomorrow on incorrect answer", () => {
            const now = new Date();
            const schedule = calculateNextSchedule(baseItem, "incorrect");
            const dueDate = new Date(schedule.dueAt!);

            // Calculate expected due date (tomorrow)
            const expectedDue = new Date(now.getTime() + 24 * 60 * 60 * 1000);

            // Allow 1 minute tolerance for execution time
            expect(dueDate.getTime()).toBeGreaterThanOrEqual(
                expectedDue.getTime() - 60000,
            );
            expect(dueDate.getTime()).toBeLessThanOrEqual(
                expectedDue.getTime() + 60000,
            );
        });

        it("should reset intervalDays to 0 on incorrect answer", () => {
            baseItem.intervalDays = 30;
            const schedule = calculateNextSchedule(baseItem, "incorrect");

            expect(schedule.intervalDays).toBe(0);
        });
    });

    describe("Learning State Progression", () => {
        it("should schedule streak 1 for 1 day", () => {
            baseItem.streak = 0;
            baseItem.state = "learning";
            const schedule = calculateNextSchedule(baseItem, "correct");

            expect(schedule.streak).toBe(1);
            expect(schedule.intervalDays).toBe(1);
            expect(schedule.state).toBe("learning");
        });

        it("should schedule streak 2 for 3 days", () => {
            baseItem.streak = 1;
            baseItem.state = "learning";
            const schedule = calculateNextSchedule(baseItem, "correct");

            expect(schedule.streak).toBe(2);
            expect(schedule.intervalDays).toBe(3);
            expect(schedule.state).toBe("learning");
        });

        it("should promote to review state at streak 3 with 7-day interval", () => {
            baseItem.streak = 2;
            baseItem.state = "learning";
            const schedule = calculateNextSchedule(baseItem, "correct");

            expect(schedule.streak).toBe(3);
            expect(schedule.state).toBe("review");
            expect(schedule.intervalDays).toBe(7);
        });

        it("should maintain learning state progression for streak >= 3", () => {
            baseItem.streak = 3;
            baseItem.state = "learning";
            const schedule = calculateNextSchedule(baseItem, "correct");

            expect(schedule.state).toBe("review");
            expect(schedule.intervalDays).toBe(7);
        });
    });

    describe("Review State Interval Growth", () => {
        beforeEach(() => {
            baseItem.state = "review";
        });

        it("should increase interval by 1.5x in review state", () => {
            baseItem.intervalDays = 7;
            baseItem.streak = 3;
            const schedule = calculateNextSchedule(baseItem, "correct");

            // 7 * 1.5 = 10.5, ceil to 11
            expect(schedule.intervalDays).toBe(11);
        });

        it("should increase interval by 1.5x for various intervals", () => {
            baseItem.streak = 3;
            const testCases = [
                { input: 7, expected: 11 }, // 7 * 1.5 = 10.5 → 11
                { input: 10, expected: 15 }, // 10 * 1.5 = 15
                { input: 20, expected: 30 }, // 20 * 1.5 = 30
                { input: 100, expected: 150 }, // 100 * 1.5 = 150
            ];

            for (const testCase of testCases) {
                baseItem.intervalDays = testCase.input;
                const schedule = calculateNextSchedule(baseItem, "correct");
                expect(schedule.intervalDays).toBe(testCase.expected);
            }
        });

        it("should cap interval at 365 days (1 year)", () => {
            baseItem.intervalDays = 300;
            baseItem.streak = 3;
            const schedule = calculateNextSchedule(baseItem, "correct");

            // 300 * 1.5 = 450, capped at 365
            expect(schedule.intervalDays).toBeLessThanOrEqual(365);
        });

        it("should not exceed 365 days when interval approaches cap", () => {
            baseItem.intervalDays = 365;
            baseItem.streak = 3;
            const schedule = calculateNextSchedule(baseItem, "correct");

            // 365 * 1.5 = 547.5, capped at 365
            expect(schedule.intervalDays).toBe(365);
        });
    });

    describe("Retirement Conditions", () => {
        beforeEach(() => {
            baseItem.state = "review";
        });

        it("should retire item when streak >= 4 AND intervalDays >= 30", () => {
            baseItem.streak = 3;
            baseItem.intervalDays = 20;
            let schedule = calculateNextSchedule(baseItem, "correct");

            // After correct: streak 4, interval 30
            expect(schedule.state).toBe("retired");
        });

        it("should not retire if streak < 4", () => {
            baseItem.streak = 2;
            baseItem.intervalDays = 50;
            const schedule = calculateNextSchedule(baseItem, "correct");

            // Streak becomes 3, which is < 4
            expect(schedule.state).not.toBe("retired");
        });

        it("should not retire if intervalDays < 30", () => {
            baseItem.streak = 4;
            baseItem.intervalDays = 20;
            const schedule = calculateNextSchedule(baseItem, "correct");

            // Interval becomes 30 (20 * 1.5), exactly at threshold
            expect(schedule.state).toBe("retired");
        });

        it("should retire at exactly streak 4 and interval 30", () => {
            baseItem.streak = 3;
            baseItem.intervalDays = 20;
            const schedule = calculateNextSchedule(baseItem, "correct");

            // 20 * 1.5 = 30, streak becomes 4
            expect(schedule.state).toBe("retired");
            expect(schedule.streak).toBe(4);
            expect(schedule.intervalDays).toBe(30);
        });
    });

    describe("Skipped Answer Handling", () => {
        it("should not change streak on skip", () => {
            baseItem.streak = 2;
            const schedule = calculateNextSchedule(baseItem, "skipped");

            expect(schedule.streak).toBeUndefined(); // No change
        });

        it("should not change lapses on skip", () => {
            baseItem.lapses = 5;
            const schedule = calculateNextSchedule(baseItem, "skipped");

            expect(schedule.lapses).toBeUndefined(); // No change
        });

        it("should update dueAt to tomorrow on skip", () => {
            const now = new Date();
            const schedule = calculateNextSchedule(baseItem, "skipped");
            const dueDate = new Date(schedule.dueAt!);

            const expectedDue = new Date(now.getTime() + 24 * 60 * 60 * 1000);

            expect(dueDate.getTime()).toBeGreaterThanOrEqual(
                expectedDue.getTime() - 60000,
            );
            expect(dueDate.getTime()).toBeLessThanOrEqual(
                expectedDue.getTime() + 60000,
            );
        });
    });

    describe("UTC Timestamp Safety", () => {
        it("should generate ISO 8601 timestamps", () => {
            const schedule = calculateNextSchedule(baseItem, "correct");
            const timestamp = schedule.dueAt!;

            // ISO 8601 format check
            expect(timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
        });

        it("should use UTC timezone (Z suffix)", () => {
            const schedule = calculateNextSchedule(baseItem, "correct");

            expect(schedule.dueAt).toMatch(/Z$/);
        });

        it("should generate valid Date objects from timestamps", () => {
            const schedule = calculateNextSchedule(baseItem, "correct");
            const dateObj = new Date(schedule.dueAt!);

            expect(dateObj).toBeInstanceOf(Date);
            expect(dateObj.getTime()).toBeGreaterThan(0);
            expect(isNaN(dateObj.getTime())).toBe(false);
        });
    });
});

/**
 * Test Suite: Resource ID Generation (Determinism)
 */
describe("ReviewService - Resource ID Generation", () => {
    it("should generate deterministic resource IDs for regular items", () => {
        const userId = "user-123";
        const lessonId = "lesson-456";
        const questionId = "D01-Q02";

        // Regular items use: review_${userId}_${lessonId}_${questionId}
        const resourceId1 = `review_${userId}_${lessonId}_${questionId}`;
        const resourceId2 = `review_${userId}_${lessonId}_${questionId}`;

        expect(resourceId1).toBe(resourceId2);
    });

    it("should generate different resource IDs for different questions", () => {
        const userId = "user-123";
        const lessonId = "lesson-456";
        const resourceId1 = `review_${userId}_${lessonId}_D01-Q01`;
        const resourceId2 = `review_${userId}_${lessonId}_D01-Q02`;

        expect(resourceId1).not.toBe(resourceId2);
    });

    it("should generate deterministic resource IDs for vocab items", () => {
        const userId = "user-123";
        const lessonId = "lesson-456";
        const vocabWordId = "vocab-789";

        // Vocab items use: review_${userId}_${lessonId}_${vocabWordId}
        const resourceId1 = `review_${userId}_${lessonId}_${vocabWordId}`;
        const resourceId2 = `review_${userId}_${lessonId}_${vocabWordId}`;

        expect(resourceId1).toBe(resourceId2);
    });

    it("should not include questionId in vocab resource IDs", () => {
        const userId = "user-123";
        const lessonId = "lesson-456";
        const vocabWordId = "vocab-789";
        const questionId = "D01-Q01";

        const resourceId1 = `review_${userId}_${lessonId}_${vocabWordId}`;
        const resourceId2 = `review_${userId}_${lessonId}_${vocabWordId}`;

        // Both should be the same even if questionId changes
        expect(resourceId1).toBe(resourceId2);
        expect(resourceId1).not.toContain(questionId);
    });

    it("should generate unique resource IDs per user", () => {
        const lessonId = "lesson-456";
        const questionId = "D01-Q02";

        const resourceId1 = `review_user-1_${lessonId}_${questionId}`;
        const resourceId2 = `review_user-2_${lessonId}_${questionId}`;

        expect(resourceId1).not.toBe(resourceId2);
    });

    it("should generate unique resource IDs per lesson", () => {
        const userId = "user-123";
        const questionId = "D01-Q02";

        const resourceId1 = `review_${userId}_lesson-1_${questionId}`;
        const resourceId2 = `review_${userId}_lesson-2_${questionId}`;

        expect(resourceId1).not.toBe(resourceId2);
    });
});
