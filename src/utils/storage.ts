import { pocketbaseService, UserProgress } from '../services/pocketbase';

export type { UserProgress };

export async function loadProgress(): Promise<UserProgress> {
  return pocketbaseService.loadProgress();
}

export async function saveProgress(progress: UserProgress): Promise<void> {
  return pocketbaseService.saveProgress(progress);
}

export async function completeLesson(lessonId: number): Promise<void> {
  const progress = await loadProgress();
  if (!progress.completedLessons.includes(lessonId)) {
    progress.completedLessons.push(lessonId);
    progress.currentLesson = Math.min(40, lessonId + 1);
    await saveProgress(progress);
  }
}

export async function saveQuizScore(lessonId: number, score: number): Promise<void> {
  const progress = await loadProgress();
  progress.quizScores[lessonId] = score;
  await saveProgress(progress);
}

export async function toggleTheme(): Promise<'light' | 'dark'> {
  const progress = await loadProgress();
  progress.theme = progress.theme === 'light' ? 'dark' : 'light';
  await saveProgress(progress);
  return progress.theme;
}