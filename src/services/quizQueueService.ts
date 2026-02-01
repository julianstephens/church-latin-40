/**
 * Quiz Queue Service - Manages eager quiz generation via Web Worker
 *
 * Strategy:
 *   1. Lesson loads → Start generating 3 quizzes in background
 *   2. User clicks "Take Quiz" → Return from queue (instant) or fallback
 *   3. User completes quiz → Worker regenerates to maintain queue
 *   4. If worker unavailable → Graceful degradation to sync generation
 */

import type { QuizQuestion } from "../data/courseData";
import type { VocabWord } from "../types/vocabulary";
import { logger } from "../utils/logger";

interface QueuedQuiz {
  id: string;
  questions: QuizQuestion[];
  timestamp: number;
}

interface GenerateQuizMessage {
  type: "GENERATE_QUIZ";
  lessonId: number;
  vocabWords: VocabWord[];
  staticQuestions: QuizQuestion[];
}

interface QuizReadyMessage {
  type: "QUIZ_READY";
  lessonId: number;
  quizId: string;
  quiz: QuizQuestion[];
}

class QuizQueueService {
  private quizQueue: Map<number, QueuedQuiz[]> = new Map();
  private worker: Worker | null = null;
  private isInitialized = false;
  private readonly QUEUE_SIZE = 5; // Max quizzes to keep queued
  private readonly EAGER_GENERATE_COUNT = 3; // Quizzes to generate upfront

  constructor() {
    this.initializeWorker();
  }

  /**
   * Initialize Web Worker for off-thread generation
   * Gracefully handles failure (worker optional, not required)
   */
  private initializeWorker() {
    if (typeof window === "undefined") return; // SSR check

    try {
      this.worker = new Worker(
        new URL("../workers/quizGenerator.worker.ts", import.meta.url),
        { type: "module" },
      );
      this.isInitialized = true;
      logger.info("Quiz generation worker initialized");
    } catch (error) {
      logger.warn("Failed to initialize quiz generation worker:", error);
      this.isInitialized = false;
    }
  }

  /**
   * Start eager generation of quizzes for a lesson
   * Called when lesson content loads with fresh vocab + static questions
   *
   * This is NON-BLOCKING: lesson displays immediately while worker generates
   *
   * @param lessonId - Lesson identifier
   * @param vocabWords - All vocabulary words for the lesson
   * @param staticQuestions - Static content questions (from PocketBase)
   */
  eagerlyGenerateQuizzes(
    lessonId: number,
    vocabWords: VocabWord[],
    staticQuestions: QuizQuestion[],
  ): void {
    if (!this.isInitialized || !this.worker) {
      logger.warn(
        "Quiz queue service not available, quizzes will be generated on-demand",
      );
      return;
    }

    // Initialize queue for this lesson if needed
    if (!this.quizQueue.has(lessonId)) {
      this.quizQueue.set(lessonId, []);
    }

    logger.info(
      `Starting eager generation for lesson ${lessonId} (${this.EAGER_GENERATE_COUNT} quizzes)`,
    );

    // Send requests to worker to generate EAGER_GENERATE_COUNT quizzes
    for (let i = 0; i < this.EAGER_GENERATE_COUNT; i++) {
      this.worker.postMessage({
        type: "GENERATE_QUIZ",
        lessonId,
        vocabWords,
        staticQuestions,
      } as GenerateQuizMessage);
    }

    // Setup message handler for quiz completion
    // Uses arrow function to preserve `this` context
    this.worker.onmessage = (event: MessageEvent<QuizReadyMessage>) => {
      const { type, lessonId: msgLessonId, quizId, quiz } = event.data;

      if (type === "QUIZ_READY") {
        this.handleQuizReady(
          msgLessonId,
          quizId,
          quiz,
          vocabWords,
          staticQuestions,
        );
      }
    };

    this.worker.onerror = (error) => {
      logger.error("Quiz generation worker error:", error);
    };
  }

  /**
   * Handle completed quiz from worker
   * Add to queue, trigger regeneration if queue below threshold
   */
  private handleQuizReady(
    lessonId: number,
    quizId: string,
    quiz: QuizQuestion[],
    vocabWords: VocabWord[],
    staticQuestions: QuizQuestion[],
  ): void {
    const queue = this.quizQueue.get(lessonId) || [];
    queue.push({
      id: quizId,
      questions: quiz,
      timestamp: Date.now(),
    });
    this.quizQueue.set(lessonId, queue);

    logger.debug(
      `Quiz ready for lesson ${lessonId}, queue size: ${queue.length}`,
    );

    // If queue below threshold, request more generation
    if (queue.length < this.QUEUE_SIZE && this.worker) {
      this.worker.postMessage({
        type: "GENERATE_QUIZ",
        lessonId,
        vocabWords,
        staticQuestions,
      } as GenerateQuizMessage);
    }
  }

  /**
   * Get next quiz from queue (immediate) or null (use fallback)
   *
   * Returns quiz if available in queue (0ms, no waiting)
   * Returns null if queue empty → caller triggers sync generation
   *
   * @returns Quiz questions if available, null to trigger fallback
   */
  getNextQuiz(lessonId: number): QuizQuestion[] | null {
    const queue = this.quizQueue.get(lessonId);

    if (!queue || queue.length === 0) {
      logger.debug(
        `No queued quiz for lesson ${lessonId}, will use fallback generation`,
      );
      return null; // Caller will trigger sync generation
    }

    // Remove first quiz from queue and return it
    const queuedQuiz = queue.shift();
    const questions = queuedQuiz?.questions || null;

    logger.debug(
      `Serving queued quiz for lesson ${lessonId}, ${queue.length} remaining in queue`,
    );
    return questions;
  }

  /**
   * Check if quiz is immediately available (no loading needed)
   * Can be used to hide/show loading indicator
   *
   * @returns true if at least 1 quiz in queue and ready
   */
  isQuizReady(lessonId: number): boolean {
    const queue = this.quizQueue.get(lessonId);
    return queue ? queue.length > 0 : false;
  }

  /**
   * Get current queue size for monitoring/debugging
   */
  getQueueSize(lessonId: number): number {
    return this.quizQueue.get(lessonId)?.length || 0;
  }

  /**
   * Cleanup queue when leaving lesson (e.g., back to course overview)
   */
  clearQueue(lessonId: number): void {
    logger.debug(`Clearing quiz queue for lesson ${lessonId}`);
    this.quizQueue.delete(lessonId);
  }
}

// Export singleton instance
export const quizQueueService = new QuizQueueService();
