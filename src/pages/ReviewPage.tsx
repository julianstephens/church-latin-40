import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ReviewSession } from "../components/ReviewSession";
import { logger } from "../utils/logger";
import { loadProgress } from "../utils/storage";

export function ReviewPage() {
  const navigate = useNavigate();
  const [maxLessonId, setMaxLessonId] = useState(1);
  const [isLoading, setIsLoading] = useState(true);

  // Load user progress to determine max lesson
  useEffect(() => {
    const loadUserProgress = async () => {
      try {
        const progress = await loadProgress();
        // Get the highest completed lesson, or currentLesson if no lessons completed
        const maxCompleted = Math.max(
          ...(progress.completedLessons || []),
          progress.currentLesson || 1,
        );
        setMaxLessonId(maxCompleted);
        logger.debug(
          `[ReviewPage] Loaded user progress: maxLessonId=${maxCompleted}`,
        );
      } catch (error) {
        logger.warn(
          "[ReviewPage] Failed to load progress, using default:",
          error,
        );
        setMaxLessonId(1);
      } finally {
        setIsLoading(false);
      }
    };

    loadUserProgress();
  }, []);

  const handleBackToOverview = async () => {
    logger.debug(
      "[ReviewPage] User clicked back, triggering refresh signal...",
    );
    // Set a flag in sessionStorage as a fallback mechanism
    sessionStorage.setItem("reviewSessionJustCompleted", "true");
    // Dispatch a custom event that CourseOverview can listen for
    // Use a small delay to ensure listeners are attached after navigation
    setTimeout(() => {
      window.dispatchEvent(new Event("reviewSessionCompleted"));
    }, 100);
    navigate("/");
  };

  const handleToViewQueue = async () => {
    logger.debug("[ReviewPage] User clicked view queue");
    navigate("/practice-queue");
  };

  if (isLoading) {
    return (
      <div className="w-full md:w-1/2 min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 py-8 flex items-center justify-center">
        <p className="text-gray-600 dark:text-gray-400">Loading progress...</p>
      </div>
    );
  }

  return (
    <div className="w-full md:w-1/2 min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 py-8">
      <ReviewSession
        sessionSize={10}
        maxLessonId={maxLessonId}
        onBack={handleBackToOverview}
        onViewQueue={handleToViewQueue}
        onComplete={(stats) => {
          logger.debug("[ReviewPage] Session completed with stats:", stats);
        }}
      />
    </div>
  );
}
