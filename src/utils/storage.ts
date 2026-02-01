import { pocketbaseService, UserProgress } from "../services/pocketbase";
import { logger } from "./logger";

export type { UserProgress };

export async function loadProgress(): Promise<UserProgress> {
  return pocketbaseService.loadProgress();
}

export async function saveProgress(progress: UserProgress): Promise<void> {
  return pocketbaseService.saveProgress(progress);
}

export async function completeLesson(lessonId: number): Promise<void> {
  logger.debug(`[Storage] completeLesson(${lessonId}) called`);
  const progress = await loadProgress();
  logger.debug(`[Storage] Loaded progress:`, {
    completedLessons: progress.completedLessons,
    currentLesson: progress.currentLesson,
  });

  if (!progress.completedLessons.includes(lessonId)) {
    logger.debug(`[Storage] Lesson ${lessonId} not yet completed, adding it`);
    progress.completedLessons.push(lessonId);
    progress.currentLesson = Math.min(40, lessonId + 1);
    logger.debug(`[Storage] Updated progress:`, {
      completedLessons: progress.completedLessons,
      currentLesson: progress.currentLesson,
    });
    logger.debug(`[Storage] Saving updated progress...`);
    await saveProgress(progress);
    logger.debug(
      `[Storage] completeLesson(${lessonId}) completed successfully`,
    );
  } else {
    logger.debug(`[Storage] Lesson ${lessonId} already completed, skipping`);
  }
}

export async function saveQuizScore(
  lessonId: number,
  score: number,
): Promise<void> {
  const progress = await loadProgress();
  progress.quizScores[lessonId] = score;
  await saveProgress(progress);
}

export async function toggleTheme(): Promise<"light" | "dark"> {
  const progress = await loadProgress();
  progress.theme = progress.theme === "light" ? "dark" : "light";
  await saveProgress(progress);
  return progress.theme;
}
