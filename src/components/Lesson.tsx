import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CheckCircle,
  Loader2,
  Play,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Lesson as LessonType, QuizQuestion } from "../data/courseData";
import { courseDataService } from "../services/courseDataService";
import { pocketbaseService } from "../services/pocketbase";
import { quizGeneratorService } from "../services/quizGeneratorService";
import { quizQueueService } from "../services/quizQueueService";
import type { VocabWord } from "../types/vocabulary";
import { logger } from "../utils/logger";
import { loadProgress } from "../utils/storage";
import { Quiz } from "./Quiz";

interface LessonProps {
  lessonId: number;
  onBack: () => void;
  onNext: () => void;
  onPrevious: () => void;
}

export function Lesson({ lessonId, onBack, onNext, onPrevious }: LessonProps) {
  const [showQuiz, setShowQuiz] = useState(false);
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>([]);
  const [isGeneratingQuiz, setIsGeneratingQuiz] = useState(false);
  const [materialCompleted, setMaterialCompleted] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [lesson, setLesson] = useState<LessonType | null>(null);

  // Reset material completed state when lesson changes
  useEffect(() => {
    setMaterialCompleted(false);
  }, [lessonId]);

  // Load lesson content and completion status
  useEffect(() => {
    const loadLessonData = async () => {
      try {
        setIsLoading(true);
        setLoadError(false);

        // Wait for PocketBase authentication to complete (non-blocking)
        try {
          await pocketbaseService.waitForUserId(5000);
        } catch (authError) {
          logger.warn(
            "Lesson load proceeding without PocketBase user ID:",
            authError,
          );
        }

        // Fetch lesson content from PocketBase or fallback
        const lessonData = await courseDataService.getLessonContent(lessonId);

        if (!lessonData) {
          setLoadError(true);
          setLesson(null);
          return;
        }

        setLesson(lessonData);

        try {
          const progress = await loadProgress();
          setIsCompleted(progress.completedLessons.includes(lessonId));
        } catch (progressError) {
          logger.warn("Failed to load progress data:", progressError);
        }
      } catch (error) {
        logger.error("Failed to load lesson data:", error);
        setLoadError(true);
        setLesson(null);
      } finally {
        setIsLoading(false);
      }
    };

    loadLessonData();
  }, [lessonId]);

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex flex-col items-center justify-center min-h-[400px]">
          <Loader2 className="h-12 w-12 text-red-900 dark:text-red-600 animate-spin mb-4" />
          <p className="text-lg text-gray-600 dark:text-gray-400">
            Loading lesson...
          </p>
        </div>
      </div>
    );
  }

  if (loadError || !lesson) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
            Unable to Load Lesson
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            {loadError
              ? "An error occurred while loading the lesson. Please try again."
              : "The lesson could not be found."}
          </p>
          <button
            onClick={onBack}
            className="inline-flex items-center gap-2 px-4 py-2 text-red-900 hover:text-red-700 dark:text-red-600 dark:hover:text-red-400 font-semibold"
          >
            <ArrowLeft className="h-4 w-4" />
            Return to Course Overview
          </button>
        </div>
      </div>
    );
  }

  const handleQuizComplete = () => {
    logger.debug(`[Lesson] handleQuizComplete called for lesson ${lessonId}`);
    logger.debug(`[Lesson] Setting showQuiz to false and calling onNext`);
    setShowQuiz(false);
    onNext();
    logger.debug(`[Lesson] onNext() called, should navigate to next lesson`);
  };

  /**
   * Handle "Take Quiz" button click
   * Get from queue or fallback to sync generation
   */
  const handleStartQuiz = async () => {
    if (!lesson) return;

    setIsGeneratingQuiz(true);

    try {
      // Try queue first (should be instant)
      let quiz = quizQueueService.getNextQuiz(lessonId);

      if (!quiz) {
        // Fallback: generate synchronously on main thread
        // This is slower but ensures we always have a quiz
        const vocabWords: VocabWord[] = lesson.vocabulary
          .map((v) => {
            // Parse "word - meaning" format
            const parts = v.split(" - ");
            return {
              id: `${lessonId}-${parts[0]}`,
              lessonId: String(lessonId),
              word: parts[0] || "",
              meaning: parts[1] || "",
              frequency: "unknown",
            } as VocabWord;
          })
          .filter((v) => v.word && v.meaning);

        logger.debug(
          `Generating quiz with ${vocabWords.length} vocab words and ${lesson.quiz.length} static questions`,
        );
        if (lesson.quiz.length === 0) {
          logger.warn(
            `No static questions found for lesson ${lessonId} - only vocab questions will be generated`,
          );
        }
        quiz = quizGeneratorService.generateLessonQuiz(vocabWords, lesson.quiz);
        logger.debug(`Generated quiz with ${quiz.length} total questions`);
      }

      setQuizQuestions(quiz || []);
      setShowQuiz(true);
    } catch (error) {
      logger.error("Failed to load quiz:", error);
    } finally {
      setIsGeneratingQuiz(false);
    }
  };

  /**
   * Check if quiz is ready from queue (for UI indicator)
   */
  const quizReady = quizQueueService.isQuizReady(lessonId);

  return (
    <div className="max-w-4xl mx-auto px-3 sm:px-4 py-6 sm:py-8">
      {/* Header */}
      <div className="mb-6 sm:mb-8">
        <button
          onClick={onBack}
          className="flex items-center space-x-2 min-h-touch-target sm:min-h-0 text-red-900 hover:text-red-700 active:text-red-950 dark:text-red-600 dark:hover:text-red-400 dark:active:text-red-300 mb-4 touch-manipulation"
        >
          <ArrowLeft className="h-4 w-4" />
          <span className="text-sm sm:text-base">Back to Course Overview</span>
        </button>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mb-1">
              Module {lesson.module} • Day {lesson.id}
            </p>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
              {lesson.title}
            </h1>
          </div>

          {isCompleted && (
            <CheckCircle className="h-6 w-6 sm:h-8 sm:w-8 text-green-600" />
          )}
        </div>
      </div>

      {!showQuiz ? (
        <div className="space-y-6 sm:space-y-8">
          {/* Materials to Learn */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-4 sm:p-6">
            <div className="flex items-center space-x-2 mb-4">
              <BookOpen className="h-5 w-5 sm:h-6 sm:w-6 text-red-900 dark:text-red-600" />
              <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white">
                Materials to Learn
              </h2>
            </div>

            <ul className="space-y-3">
              {lesson.materials.map((material, index) => (
                <li key={index} className="flex items-start space-x-3">
                  <div className="bg-red-900 dark:bg-red-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs sm:text-sm font-bold mt-0.5 flex-shrink-0">
                    {index + 1}
                  </div>
                  <p className="text-sm sm:text-base text-gray-700 dark:text-gray-300">
                    {material}
                  </p>
                </li>
              ))}
            </ul>
          </div>

          {/* Content Section */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-4 sm:p-6">
            <div className="flex items-center space-x-2 mb-4">
              <BookOpen className="h-5 w-5 sm:h-6 sm:w-6 text-red-900 dark:text-red-600" />
              <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white">
                Lesson Content
              </h2>
            </div>

            <div className="space-y-4 text-sm sm:text-base text-gray-700 dark:text-gray-300">
              {lesson.content.map((paragraph, index) => (
                <p key={index} className="leading-relaxed">
                  {paragraph}
                </p>
              ))}
            </div>
          </div>

          {/* Vocabulary */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-4 sm:p-6">
            <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white mb-4">
              Vocabulary ({lesson.vocabulary.length} words)
            </h2>

            <div className="grid sm:grid-cols-2 gap-3 sm:gap-4">
              {lesson.vocabulary.map((word, index) => {
                const [latin, english] = word.split(" - ");
                return (
                  <div
                    key={index}
                    className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-700 rounded-lg gap-2"
                  >
                    <span className="font-semibold text-sm sm:text-base text-red-900 dark:text-red-400">
                      {latin}
                    </span>
                    <span className="text-xs sm:text-sm text-gray-600 dark:text-gray-300 text-right">
                      {english}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Practice */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-4 sm:p-6">
            <div className="flex items-center space-x-2 mb-4">
              <Play className="h-5 w-5 sm:h-6 sm:w-6 text-yellow-700 dark:text-yellow-500" />
              <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white">
                Practice
              </h2>
            </div>

            <div className="space-y-4 text-sm sm:text-base text-gray-700 dark:text-gray-300 mb-6">
              {Array.isArray(lesson.practice) ? (
                lesson.practice.map((paragraph, index) => (
                  <p key={index} className="leading-relaxed">
                    {paragraph}
                  </p>
                ))
              ) : (
                <p className="leading-relaxed">{lesson.practice}</p>
              )}
            </div>

            <div className="space-y-4">
              <div className="flex items-start space-x-3 sm:space-x-4">
                <label className="flex items-start space-x-2 sm:space-x-3 cursor-pointer touch-manipulation">
                  <input
                    type="checkbox"
                    checked={materialCompleted}
                    onChange={(e) => setMaterialCompleted(e.target.checked)}
                    className="w-5 h-5 sm:w-4 sm:h-4 mt-0.5 text-red-900 bg-gray-100 border-gray-300 rounded focus:ring-red-900 dark:focus:ring-red-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600 touch-manipulation"
                  />
                  <span className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                    I have completed the practice exercises / I am ready to see
                    the answer
                  </span>
                </label>
              </div>
              {materialCompleted && lesson.answer && (
                <div className="mt-4 p-3 sm:p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                  <h3 className="text-base sm:text-lg font-bold text-green-800 dark:text-green-200 mb-2">
                    Answer:
                  </h3>
                  <div className="space-y-3">
                    {Array.isArray(lesson.answer) ? (
                      lesson.answer.map((paragraph, index) => (
                        <p
                          key={index}
                          className="text-sm sm:text-base text-green-700 dark:text-green-300"
                        >
                          {paragraph}
                        </p>
                      ))
                    ) : (
                      <p className="text-sm sm:text-base text-green-700 dark:text-green-300">
                        {lesson.answer}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row justify-between gap-3 sm:gap-4">
            <button
              onClick={(e) => {
                e.preventDefault();
                onPrevious();
              }}
              disabled={lessonId === 1}
              className="flex items-center justify-center space-x-2 min-h-touch-target px-6 py-3 sm:py-3 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 active:bg-gray-100 dark:active:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors touch-manipulation"
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="text-sm sm:text-base">Previous Lesson</span>
            </button>

            <button
              onClick={handleStartQuiz}
              disabled={!materialCompleted || isGeneratingQuiz}
              className="flex items-center justify-center space-x-2 min-h-touch-target bg-red-900 hover:bg-red-800 active:bg-red-950 disabled:bg-gray-400 disabled:cursor-not-allowed text-white px-6 py-3 sm:py-3 rounded-lg transition-colors touch-manipulation"
            >
              {!quizReady && !isGeneratingQuiz && (
                <Loader2 className="h-4 w-4 animate-spin" />
              )}
              {isGeneratingQuiz && <Loader2 className="h-4 w-4 animate-spin" />}
              <span className="text-sm sm:text-base">Take Daily Quiz</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      ) : (
        <Quiz
          questions={quizQuestions}
          lessonId={lessonId}
          onComplete={handleQuizComplete}
        />
      )}
    </div>
  );
}
