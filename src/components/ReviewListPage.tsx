import { ArrowRight, Clock, Pause, Play } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { pocketbaseService } from "../services/pocketbase";
import { ReviewItem, reviewService } from "../services/reviewService";
import { logger } from "../utils/logger";

type TabType = "due" | "upcoming" | "suspended";

interface ReviewItemWithLesson extends ReviewItem {
  lessonTitle?: string;
  lessonNumber?: number;
  questionText?: string;
}

export function ReviewListPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabType>("due");
  const [isLoading, setIsLoading] = useState(true);
  const [dueItems, setDueItems] = useState<ReviewItemWithLesson[]>([]);
  const [upcomingItems, setUpcomingItems] = useState<ReviewItemWithLesson[]>(
    [],
  );
  const [suspendedItems, setSuspendedItems] = useState<ReviewItemWithLesson[]>(
    [],
  );
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Load all review items on mount
  useEffect(() => {
    const loadReviewItems = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const [dueList, upcomingList, suspendedList] = await Promise.all([
          reviewService.getDueReviewItems(100),
          reviewService.getUpcomingReviewItems(100),
          reviewService.getSuspendedReviewItems(100),
        ]);

        // Enrich items with lesson information
        const enrichedDue = await enrichItemsWithLessonData(dueList);
        const enrichedUpcoming = await enrichItemsWithLessonData(upcomingList);
        const enrichedSuspended =
          await enrichItemsWithLessonData(suspendedList);

        setDueItems(enrichedDue);
        setUpcomingItems(enrichedUpcoming);
        setSuspendedItems(enrichedSuspended);
      } catch (err) {
        logger.error("[ReviewListPage] Failed to load review items:", err);
        setError("Failed to load review items. Please try again.");
      } finally {
        setIsLoading(false);
      }
    };

    loadReviewItems();
  }, []);

  const enrichItemsWithLessonData = async (
    items: ReviewItem[],
  ): Promise<ReviewItemWithLesson[]> => {
    if (items.length === 0) {
      return [];
    }

    const pb = pocketbaseService.getPocketBase();
    const lessonIds = Array.from(new Set(items.map((item) => item.lessonId)));
    const lessonTitleMap = new Map<string, string>();

    await Promise.all(
      lessonIds.map(async (lessonId) => {
        try {
          const record = await pb
            .collection("church_latin_lessons")
            .getOne(lessonId);
          const title =
            (record.name as string | undefined) ||
            (record.title as string | undefined) ||
            "Lesson";
          lessonTitleMap.set(lessonId, title);
        } catch (error) {
          logger.warn(
            `[ReviewListPage] Failed to load lesson ${lessonId}:`,
            error,
          );
          lessonTitleMap.set(lessonId, "Lesson");
        }
      }),
    );

    const questionTextMap = new Map<string, string>();

    await Promise.all(
      items.map(async (item) => {
        try {
          if (item.vocabWordId) {
            const vocabRecord = await pb
              .collection("church_latin_vocabulary")
              .getOne(item.vocabWordId);
            const vocabWord =
              (vocabRecord.word as string | undefined) || "Vocabulary word";
            questionTextMap.set(item.id, vocabWord);
            return;
          }

          const record = await pb
            .collection("church_latin_quiz_questions")
            .getList(1, 1, {
              filter: `lessonId = "${item.lessonId}" && questionId = "${item.questionId}"`,
            });
          if (record.items.length > 0) {
            const question = record.items[0] as Record<string, unknown>;
            const questionText =
              (question.question as string | undefined) || "Review item";
            questionTextMap.set(item.id, questionText);
          } else {
            questionTextMap.set(item.id, "Review item");
          }
        } catch (error) {
          logger.warn(
            `[ReviewListPage] Failed to load question ${item.questionId}:`,
            error,
          );
          questionTextMap.set(item.id, "Review item");
        }
      }),
    );

    return items.map((item) => ({
      ...item,
      lessonNumber: parseInt(item.questionId.split("-")[0].substring(1)),
      lessonTitle: lessonTitleMap.get(item.lessonId) || "Lesson",
      questionText: questionTextMap.get(item.id) || "Review item",
    }));
  };

  const handleSuspend = async (item: ReviewItemWithLesson) => {
    try {
      setActionLoading(item.id);
      await reviewService.setSuspended(item.lessonId, item.questionId, true);

      // Move item from due/upcoming to suspended
      setDueItems((prev) => prev.filter((i) => i.id !== item.id));
      setUpcomingItems((prev) => prev.filter((i) => i.id !== item.id));
      setSuspendedItems((prev) => [...prev, item]);

      logger.info(`[ReviewListPage] Suspended review item: ${item.questionId}`);
    } catch (err) {
      logger.error("[ReviewListPage] Failed to suspend item:", err);
      setError("Failed to suspend item. Please try again.");
    } finally {
      setActionLoading(null);
    }
  };

  const handleUnsuspend = async (item: ReviewItemWithLesson) => {
    try {
      setActionLoading(item.id);
      await reviewService.setSuspended(item.lessonId, item.questionId, false);

      // Move item from suspended back to appropriate list
      setSuspendedItems((prev) => prev.filter((i) => i.id !== item.id));

      const now = new Date();
      if (new Date(item.dueAt) <= now) {
        setDueItems((prev) => [...prev, item]);
      } else {
        setUpcomingItems((prev) => [...prev, item]);
      }

      logger.info(
        `[ReviewListPage] Unsuspended review item: ${item.questionId}`,
      );
    } catch (err) {
      logger.error("[ReviewListPage] Failed to unsuspend item:", err);
      setError("Failed to unsuspend item. Please try again.");
    } finally {
      setActionLoading(null);
    }
  };

  const handleStartReview = () => {
    navigate("/review");
  };

  const handleJumpToLesson = (lessonId: string) => {
    // Parse lesson number from ID and navigate
    const lessonNumber = parseInt(lessonId.split("-")[0].substring(1)) || 1;
    navigate(`/lesson/${lessonNumber}`);
  };

  const renderItems = (items: ReviewItemWithLesson[]) => {
    if (items.length === 0) {
      return (
        <div className="text-center py-12">
          <p className="text-gray-500 dark:text-gray-400 mb-4">
            {activeTab === "due"
              ? "No items due right now. Great job staying on top of your reviews!"
              : activeTab === "upcoming"
                ? "No upcoming items."
                : "No suspended items."}
          </p>
        </div>
      );
    }

    return (
      <div className="space-y-2">
        {items.map((item) => (
          <div
            key={item.id}
            className="flex items-center justify-between p-4 bg-white dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600 hover:shadow-md transition-shadow"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900 dark:text-white text-sm">
                    {item.questionText || item.questionId}
                  </h3>
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    {item.lessonTitle}
                  </p>
                </div>

                <div className="text-right">
                  <p className="text-xs font-medium text-gray-600 dark:text-gray-300">
                    Due: {formatDate(new Date(item.dueAt))}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Streak: {item.streak || 0} • Lapses: {item.lapses || 0}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 ml-4">
              {activeTab === "due" && (
                <button
                  onClick={() => handleJumpToLesson(item.lessonId)}
                  className="p-2 hover:bg-blue-50 dark:hover:bg-blue-900 text-blue-600 dark:text-blue-400 rounded transition-colors"
                  title="Jump to lesson"
                >
                  <ArrowRight size={18} />
                </button>
              )}

              {activeTab !== "suspended" && (
                <button
                  onClick={() => handleSuspend(item)}
                  disabled={actionLoading === item.id}
                  className="p-2 hover:bg-yellow-50 dark:hover:bg-yellow-900 text-yellow-600 dark:text-yellow-400 rounded transition-colors disabled:opacity-50"
                  title="Suspend this item"
                >
                  <Pause size={18} />
                </button>
              )}

              {activeTab === "suspended" && (
                <button
                  onClick={() => handleUnsuspend(item)}
                  disabled={actionLoading === item.id}
                  className="p-2 hover:bg-green-50 dark:hover:bg-green-900 text-green-600 dark:text-green-400 rounded transition-colors disabled:opacity-50"
                  title="Resume this item"
                >
                  <Play size={18} />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    );
  };

  const activeItems =
    activeTab === "due"
      ? dueItems
      : activeTab === "upcoming"
        ? upcomingItems
        : suspendedItems;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 py-8">
      <div className="max-w-4xl mx-auto px-4">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">
            Review Queue
          </h1>
          <p className="text-gray-600 dark:text-gray-300">
            Manage your spaced repetition review items
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-900 border border-red-200 dark:border-red-700 rounded-lg">
            <p className="text-red-800 dark:text-red-200 text-sm">{error}</p>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-4 mb-6 border-b border-gray-200 dark:border-gray-700">
          <button
            onClick={() => setActiveTab("due")}
            className={`px-4 py-3 font-medium transition-colors border-b-2 -mb-1 ${
              activeTab === "due"
                ? "border-blue-500 text-blue-600 dark:text-blue-400"
                : "border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
            }`}
          >
            <Clock className="inline mr-2" size={18} />
            Due Now ({dueItems.length})
          </button>
          <button
            onClick={() => setActiveTab("upcoming")}
            className={`px-4 py-3 font-medium transition-colors border-b-2 -mb-1 ${
              activeTab === "upcoming"
                ? "border-blue-500 text-blue-600 dark:text-blue-400"
                : "border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
            }`}
          >
            📅 Upcoming ({upcomingItems.length})
          </button>
          <button
            onClick={() => setActiveTab("suspended")}
            className={`px-4 py-3 font-medium transition-colors border-b-2 -mb-1 ${
              activeTab === "suspended"
                ? "border-blue-500 text-blue-600 dark:text-blue-400"
                : "border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
            }`}
          >
            <Pause className="inline mr-2" size={18} />
            Suspended ({suspendedItems.length})
          </button>
        </div>

        {/* Loading State */}
        {isLoading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            <p className="text-gray-600 dark:text-gray-400 mt-4">
              Loading review items...
            </p>
          </div>
        ) : (
          <>
            {/* Items List */}
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 mb-6">
              {renderItems(activeItems)}
            </div>

            {/* Start Review Button */}
            {dueItems.length > 0 && activeTab === "due" && (
              <button
                onClick={handleStartReview}
                className="w-full py-3 px-6 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-semibold rounded-lg transition-all shadow-md hover:shadow-lg"
              >
                Start Review Session ({dueItems.length} items)
              </button>
            )}

            {/* Back Button */}
            <button
              onClick={() => navigate("/")}
              className="mt-4 w-full py-2 px-4 text-gray-700 dark:text-gray-300 font-medium hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              Back to Course
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function formatDate(date: Date): string {
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  // Check if it's today
  if (date.toDateString() === today.toDateString()) {
    return "Today";
  }

  // Check if it's tomorrow
  if (date.toDateString() === tomorrow.toDateString()) {
    return "Tomorrow";
  }

  // Otherwise, show the date
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}
